# Elimination Assist Processor

This processor is responsible for detecting and awarding "Assists" – situations where a player deals damage to an enemy who is subsequently eliminated by a _different_ player.

### Purpose

The primary function of `UEliminationAssistProcessor` is to track damage dealt between players and, upon receiving an elimination message, grant an assist credit to players who contributed damage but did not score the final blow. This adds a reward mechanism for teamwork and acknowledges contributions beyond just securing the elimination.

### Listening for Events

To track damage and eliminations, the processor listens for two specific Gameplay Messages:

1. **`Lyra.Damage.Message`:** Triggered whenever damage is dealt. The processor uses this to record who damaged whom and by how much.
2. **`Lyra.Elimination.Message`:** Triggered when a player is eliminated. This serves as the event that prompts the processor to check its recorded damage history for potential assists.

```cpp
// From UEliminationAssistProcessor::StartListening
AddListenerHandle(MessageSubsystem.RegisterListener(EliminationAssist::TAG_Lyra_Elimination_Message, this, &ThisClass::OnEliminationMessage));
AddListenerHandle(MessageSubsystem.RegisterListener(EliminationAssist::TAG_Lyra_Damage_Message, this, &ThisClass::OnDamageMessage));
```

### Mechanism: Tracking Damage History

The core of the processor is its internal state, stored in the `DamageHistory` map:

```cpp
// Tracks damage dealt TO a specific player (the Key)
UPROPERTY(Transient)
TMap<TObjectPtr<APlayerState>, FPlayerAssistDamageTracking> DamageHistory;

// Tracks damage dealt BY specific players (the Key) TO the player tracked above
USTRUCT()
struct FPlayerAssistDamageTracking
{
    GENERATED_BODY()

    // Map of damager (Instigator PlayerState) to total damage dealt
    UPROPERTY(Transient)
    TMap<TObjectPtr<APlayerState>, float> AccumulatedDamageByPlayer;
};
```

* **`DamageHistory`:** The outer `TMap` uses the `APlayerState` of the player _receiving_ damage as the key. The value is an `FPlayerAssistDamageTracking` struct containing details about who damaged _that specific player_.
* **`FPlayerAssistDamageTracking`:** The inner `TMap`, `AccumulatedDamageByPlayer`, uses the `APlayerState` of the player _dealing_ the damage (the instigator) as the key, and the `float` value stores the total accumulated damage dealt by that instigator to the target player since tracking began (or was last reset).

**How it works:**

1. **`OnDamageMessage`:** When a damage message arrives, the processor extracts the Instigator's and Target's `APlayerState`. It finds (or adds) the Target `APlayerState` entry in `DamageHistory`. Then, within that target's `FPlayerAssistDamageTracking`, it finds (or adds) the Instigator `APlayerState` and adds the `Payload.Magnitude` (damage amount) to the accumulated float value. Self-damage (`Instigator == Target`) is ignored.
2. **`OnEliminationMessage`:** When an elimination message arrives, the processor extracts the Target's `APlayerState` (the player who was eliminated).
   * It looks up this Target `APlayerState` in the `DamageHistory`.
   * If found, it iterates through the `AccumulatedDamageByPlayer` map within the `FPlayerAssistDamageTracking` struct.
   * For **each** player (`AssistPS`) listed in `AccumulatedDamageByPlayer`:
     * It checks if this assisting player (`AssistPS`) is **different** from the player who actually got the elimination (`Payload.Instigator`).
     * If they are different (meaning they damaged the target but didn't get the final blow), an assist is granted.
   * After processing assists, the entry for the eliminated player (`TargetPS`) is **removed** from `DamageHistory` to clear the slate for their next life.

### Broadcasting the Assist Message

When the processor determines a player deserves an assist, it constructs and broadcasts a `FLyraVerbMessage` specifically indicating an assist event:

```cpp
// Simplified snippet from OnEliminationMessage
FLyraVerbMessage AssistMessage;
AssistMessage.Verb = EliminationAssist::TAG_Lyra_Assist_Message; // "Lyra.Assist.Message"
AssistMessage.Instigator = AssistPS; // The player getting the assist
AssistMessage.Target = TargetPS;     // The player who was eliminated
AssistMessage.Magnitude = KVP.Value; // The amount of damage the assister dealt

UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
MessageSubsystem.BroadcastMessage(AssistMessage.Verb, AssistMessage);
```

* **`Verb`:** Set to `Lyra.Assist.Message`. This is the unique tag identifying this event as an assist.
* **`Instigator`:** Set to the `APlayerState` of the player who _earned_ the assist.
* **`Target`:** Set to the `APlayerState` of the player who was eliminated.
* **`Magnitude`:** Contains the total damage the assisting player dealt to the target before elimination.

### Configuration

The `UEliminationAssistProcessor` in its current form does not have any exposed `UPROPERTY` fields for configuration (like minimum damage thresholds for an assist). Its logic is based purely on tracking _any_ amount of damage dealt by players other than the eliminator. If specific thresholds were desired, the class would need modification.

### Role in Accolade Flow

This processor acts as a generator for the `Lyra.Assist.Message`. While this message itself _could_ be listened for directly by UI or other systems, typically the `UAccoladeRelay` would listen for `Lyra.Assist.Message` and, if an "Assist" accolade is defined in the `Accolades` Data Table (e.g., with Row Name "Assist" corresponding to Gameplay Tag `Accolade.Assist`), the relay would then trigger the standard visual accolade display process for the player who earned the assist.

***
