# Elimination Feed

While the Accolade System focuses on visually distinct, timed pop-ups celebrating specific achievements (like multi-kills or streaks), most shooters also feature a running **Elimination Feed** (often called a Kill Feed). This feed provides a continuous log of eliminations happening across the match, typically showing who eliminated whom.

Shooter Base includes a separate but related system to handle this feed, centered around the **`UEliminationFeedRelay`** component.

### Distinction from Accolades

It's important to understand the difference:

* **Accolade System:** Deals with specific, often conditional achievements (streaks, chains, assists). Uses `UAccoladeRelay` to send targeted `FLyraNotificationMessage` notifications containing a single `PayloadTag` (e.g., `Accolade.DoubleKill`) to `UAccoladeHostWidget` for timed, often stylized visual display.
* **Elimination Feed System:** Deals with logging _every_ elimination event. Uses `UEliminationFeedRelay` to process elimination messages and broadcast _local_ `FEliminationFeedMessage` notifications containing formatted text and team data for consumption by a dedicated kill feed UI element.

While both systems listen to the `Lyra.Elimination.Message`, their processing logic, output format, and intended UI consumers are different.

### `UEliminationFeedRelay`

This `UGameplayMessageProcessor` subclass is specifically responsible for handling elimination events for the purpose of generating the UI kill feed.

```cpp
// Relays the eliminations to the player (for the feed)
UCLASS(Blueprintable, BlueprintType)
class UEliminationFeedRelay : public UGameplayMessageProcessor
{
	GENERATED_BODY()
// ... (StartListening, OnEliminationMessage, UpdateEliminationGrudge)
public:
    // Tracks kill/death counts between the local player and others
	UPROPERTY(BlueprintReadOnly)
	TMap<TObjectPtr<APlayerState>, FEliminationGrudge> EliminationGrudgeTracker;
// ...
};
```

**Role:** Like other processors, it's typically added as a component to the GameState. Its job is to capture elimination events, distribute the raw information, and then (on each client) process that information into a format suitable for the kill feed UI, including adding team context and tracking personal rivalries (grudges).

**1. Listening (`StartListening`)**

It subscribes to the core elimination message:

```cpp
// Listens for the same basic elimination message as other processors
AddListenerHandle(MessageSubsystem.RegisterListener(EliminationFeed::TAG_Lyra_Elimination_Message, this, &ThisClass::OnEliminationMessage));
```

**2. Processing (`OnEliminationMessage`) - Server Role**

When an elimination message occurs, the _server's_ instance of `UEliminationFeedRelay` first handles multicasting the raw event data:

```cpp
void UEliminationFeedRelay::OnEliminationMessage(FGameplayTag Channel, const FLyraVerbMessage& Payload)
{
    // --- Server Authority Section ---
    if (GetOwner()->HasAuthority()) // Check if we are the server
    {
        AGameStateBase* GameState = UGameplayStatics::GetGameState(GetWorld());
        if(ALyraGameState* LyraGS = Cast<ALyraGameState>(GameState))
        {
            // Multicast the raw FLyraVerbMessage to ALL connected clients reliably
            LyraGS->MulticastReliableMessageToClients(Payload);
        }

        // If this is a dedicated server, its job for this message is done.
        // The client-side processing below happens on each receiving client.
        bool bIsDedicated = UKismetSystemLibrary::IsDedicatedServer(this);
        if(bIsDedicated)
            return;
    }
    // --- Client-Side Processing continues below (also runs on Listen Server) ---
    // ...
}
```

* **Authority Check:** Ensures only the server performs the multicast.
* **Multicast:** It uses `GameState->MulticastReliableMessageToClients(Payload)` to send the original `FLyraVerbMessage` (containing instigator, target, tags, etc.) to _every_ connected client. This ensures all players have the base information needed to display the feed entry.
* **Dedicated Server Exit:** If running on a dedicated server, the relay's work for this message _on the server instance_ is complete after multicasting.

**3. Processing (`OnEliminationMessage`) - Client Role**

The code following the server block runs on **each client** (including the host client on a listen server) _after_ it receives the multicasted `Payload` message (or immediately on a listen server/standalone after the server block).

```cpp
void UEliminationFeedRelay::OnEliminationMessage(FGameplayTag Channel, const FLyraVerbMessage& Payload)
{
    // ... (Server block above) ...

    // --- Client-Side / Listen Server Processing ---
    ULyraTeamSubsystem* TeamSubsystem = GetWorld()->GetSubsystem<ULyraTeamSubsystem>();
    // ... (Get AttackerTeamId and AttackeeTeamId using TeamSubsystem) ...

    APlayerState* InstigatorPS = ULyraVerbMessageHelpers::GetPlayerStateFromObject(Payload.Instigator);
    APlayerState* TargetPS = ULyraVerbMessageHelpers::GetPlayerStateFromObject(Payload.Target);

    // Ignore if generated during killcam playback
    if(UKillcamManager::IsInKillCamWorld(InstigatorPS ? InstigatorPS->GetPawn() : nullptr)) // Added null check
        return;

    // Update the local player's grudge tracking
    UpdateEliminationGrudge(InstigatorPS, TargetPS);

    // Construct the formatted message for the local UI kill feed
    FEliminationFeedMessage EliminationFeedMessage;
    EliminationFeedMessage.Attacker = FText::FromString(InstigatorPS ? InstigatorPS->GetPlayerName() : FString("World")); // Added null check/default
    EliminationFeedMessage.Attackee = FText::FromString(TargetPS ? TargetPS->GetPlayerName() : FString("World")); // Added null check/default
    EliminationFeedMessage.AttackerTeamID = AttackerTeamId;
    EliminationFeedMessage.InstigatorTags = Payload.InstigatorTags;
    EliminationFeedMessage.AttackeeTeamID = AttackeeTeamId;

    // Broadcast the formatted message LOCALLY for the UI to pick up
    UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
    MessageSubsystem.BroadcastMessage(TAG_Lyra_Notification_KillFeed, EliminationFeedMessage);
}
```

* **Team Context:** Uses `ULyraTeamSubsystem` to determine the team IDs of the attacker and attackee based on their PlayerStates/Pawns.
* **Killcam Check:** Ignores messages generated within the Killcam system to prevent duplicate feed entries.
* **Grudge Update:** Calls `UpdateEliminationGrudge` to update the local player's personal kill/death stats against other players involved in this elimination.
* **Construct `FEliminationFeedMessage`:** Creates the specific structure containing formatted player names, team IDs, and relevant tags needed by the UI feed widget.
* **Local Broadcast:** Broadcasts this `EliminationFeedMessage` structure on the _local_ `GameplayMessageSubsystem` using the `TAG_Lyra_Notification_KillFeed` (`Lyra.AddNotification.KillFeed`) channel. This message is _not_ networked further; it's purely for the local client's UI.

### `FEliminationFeedMessage` Structure

This struct packages the information needed specifically for a kill feed entry:

```cpp
USTRUCT(BlueprintType)
struct FEliminationFeedMessage
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Player name of the attacker
    FText Attacker;

    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Player name of the victim
    FText Attackee;

    // No TargetChannel/TargetPlayer - broadcast uses a specific tag

    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Team ID of the attacker
    int32 AttackerTeamID;

    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Gameplay Tags associated with the attacker at time of kill
    FGameplayTagContainer InstigatorTags;

    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Team ID of the victim
    int32 AttackeeTeamID;
};
```

It contains pre-formatted text and team information, making it easy for the UI widget to consume.

### Grudge Tracking (`UpdateEliminationGrudge`)

This client-side feature maintains a simple rivalry tracker for the local player:

```cpp
// Structure holding kill/death counts against one specific opponent
USTRUCT(BlueprintType) struct FEliminationGrudge { /* ... TimesKilledOpponent, TimesKilledByOpponent ... */ };

// Map on UEliminationFeedRelay holding grudges against multiple opponents
UPROPERTY(BlueprintReadOnly) TMap<TObjectPtr<APlayerState>, FEliminationGrudge> EliminationGrudgeTracker;

void UEliminationFeedRelay::UpdateEliminationGrudge(APlayerState* InstigatorPS, APlayerState* TargetPS)
{
    // Get the local player controller and player state
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    if (!PC || !PC->IsLocalController()) return;
    APlayerState* ClientPlayerState = PC->PlayerState;
    if (!ClientPlayerState) return;

    // If the local player was the instigator, update kills against the target
    if (InstigatorPS == ClientPlayerState && TargetPS)
    {
        FEliminationGrudge& Grudge = EliminationGrudgeTracker.FindOrAdd(TargetPS);
        Grudge.TimesKilledOpponent++;
    }
    // If the local player was the target, update deaths by the instigator
    else if (TargetPS == ClientPlayerState && InstigatorPS)
    {
        FEliminationGrudge& Grudge = EliminationGrudgeTracker.FindOrAdd(InstigatorPS);
        Grudge.TimesKilledByOpponent++;
    }
}
```

* It runs only on the client.
* It checks if the `ClientPlayerState` (the player viewing the screen) was either the `InstigatorPS` or the `TargetPS` in the elimination.
* It updates the `TimesKilledOpponent` or `TimesKilledByOpponent` count in the `EliminationGrudgeTracker` map, using the _other_ involved player's `APlayerState` as the key.
* This allows the UI to potentially display rivalry information (e.g., "Revenge!" or "Dominated!").

### UI Consumption

A dedicated UMG widget (different from `UAccoladeHostWidget`) would be created to display the kill feed. This widget would:

1. Register a listener on the `GameplayMessageSubsystem` for the `TAG_Lyra_Notification_KillFeed` (`Lyra.AddNotification.KillFeed`) channel.
2. When a `FEliminationFeedMessage` is received, use its data (`Attacker`, `Attackee`, team IDs, tags) to create and add a new visual entry to the feed display (e.g., a styled text row).
3. Manage the scrolling and fading out of old entries as needed.

This keeps the logic for the feed separate from the logic for accolade pop-ups, allowing independent UI design and behavior.

***
