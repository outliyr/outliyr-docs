# Team Agent Interface

For an Actor to be recognized as belonging to a team and participate in the team system (especially for AI Perception and generic team queries), it needs to implement the `ILyraTeamAgentInterface`. This interface provides the standard mechanism for setting and retrieving an Actor's team affiliation.

### Role and Purpose

* **Declare Team Affiliation:** Provides the standardized functions (`SetGenericTeamId`, `GetGenericTeamId`) for an Actor to report its team membership.
* **Engine Integration:** Extends the engine's base `IGenericTeamAgentInterface`, ensuring compatibility with systems like AI Perception (`UAIPerceptionSystem::RegisterSource`, team-based sensing) which rely on this standard interface.
* **Change Notification:** Defines a delegate (`FOnLyraTeamIndexChangedDelegate`) that implementing actors should broadcast whenever their team ID changes, allowing other systems to react dynamically.

### Implementation

Actors that directly participate in teams should implement this interface. Common implementers include:

* `APlayerState` (specifically `ALyraPlayerState` in Lyra): Represents the persistent team affiliation of a player throughout a match.
* `APawn` (potentially): While often relying on the PlayerState's team, Pawns might implement it directly for team-based AI or if they can exist independently of a PlayerState.
* `AController` (potentially): Controllers could implement it, although typically the PlayerState or Pawn is the primary agent.

**Implementing in C++:**

1.  **Inherit:** Add `ILyraTeamAgentInterface` to the inheritance list of your Actor class header.

    ```cpp
    #include "Teams/LyraTeamAgentInterface.h" // Include the interface header

    UCLASS()
    class MYGAME_API AMyPlayerState : public APlayerState, public ILyraTeamAgentInterface
    {
        GENERATED_BODY()

        // ... other class members ...
    ```
2.  **Implement Functions:** Provide implementations for the core interface functions, typically storing the Team ID in a replicated variable.

    ```cpp
    // AMyPlayerState.h
    private:
        UPROPERTY(ReplicatedUsing = OnRep_MyTeamID)
        FGenericTeamId MyTeamID = FGenericTeamId::NoTeam;

        UPROPERTY(BlueprintAssignable) // If needed for BP
        FOnLyraTeamIndexChangedDelegate OnTeamChangedDelegate;

    public:
        //~ IGenericTeamAgentInterface
        virtual void SetGenericTeamId(const FGenericTeamId& NewTeamID) override;
        virtual FGenericTeamId GetGenericTeamId() const override;
        //~ End IGenericTeamAgentInterface

        //~ ILyraTeamAgentInterface
        virtual FOnLyraTeamIndexChangedDelegate* GetOnTeamIndexChangedDelegate() override;
        //~ End ILyraTeamAgentInterface

    protected:
        UFUNCTION() // Must be UFUNCTION for OnRep
        void OnRep_MyTeamID(FGenericTeamId OldTeamID);

    // AMyPlayerState.cpp
    #include "Net/UnrealNetwork.h" // For DOREPLIFETIME

    void AMyPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
    {
        Super::GetLifetimeReplicatedProps(OutLifetimeProps);
        DOREPLIFETIME_CONDITION(AMyPlayerState, MyTeamID, COND_None); // Replicate team ID
    }

    void AMyPlayerState::SetGenericTeamId(const FGenericTeamId& NewTeamID)
    {
        if (HasAuthority()) // Team changes should be authoritative
        {
            const FGenericTeamId OldTeamID = MyTeamID;
            MyTeamID = NewTeamID;
            OnRep_MyTeamID(OldTeamID); // Call OnRep manually on server
        }
    }

    FGenericTeamId AMyPlayerState::GetGenericTeamId() const
    {
        return MyTeamID;
    }

    FOnLyraTeamIndexChangedDelegate* AMyPlayerState::GetOnTeamIndexChangedDelegate()
    {
        return &OnTeamChangedDelegate;
    }

    void AMyPlayerState::OnRep_MyTeamID(FGenericTeamId OldTeamID)
    {
        // Call the static helper to broadcast the delegate
        ILyraTeamAgentInterface::ConditionalBroadcastTeamChanged(this, OldTeamID, MyTeamID);
    }

    ```
3. **Replication:** Ensure the variable storing the `FGenericTeamId` is replicated (e.g., `UPROPERTY(ReplicatedUsing=OnRep_MyTeamID)`).
4. **Broadcast Delegate:** In the `OnRep` function (and ideally also immediately after setting it on the server), call the static helper `ILyraTeamAgentInterface::ConditionalBroadcastTeamChanged(this, OldTeamID, NewTeamID)` to ensure the `OnTeamChangedDelegate` is broadcast correctly on both server and clients when the ID actually changes.

### Key Interface Elements

* **`SetGenericTeamId(const FGenericTeamId& NewTeamID)`:** Sets the team affiliation. Should typically only be called on the server/authority.
* **`GetGenericTeamId() const`:** Returns the current `FGenericTeamId` of the actor.
* **`GetOnTeamIndexChangedDelegate()`:** Returns a pointer to the multicast delegate that should be broadcast when the team ID changes. Implementing classes need to provide an actual delegate instance (`UPROPERTY(BlueprintAssignable)` if needed in BP).
* **`ConditionalBroadcastTeamChanged(TScriptInterface<ILyraTeamAgentInterface> This, FGenericTeamId OldTeamID, FGenericTeamId NewTeamID)` (Static Helper):**
  * Compares the Old and New Team IDs.
  * If they are different, it retrieves the delegate using `GetTeamChangedDelegateChecked()` and broadcasts it, passing the implementing UObject, the old integer ID, and the new integer ID.
  * Includes logging.

### Usage by Other Systems

* **`ULyraTeamSubsystem::FindTeamFromObject`:** This is the primary consumer. It attempts to cast the queried object to `ILyraTeamAgentInterface` and calls `GetGenericTeamId()` to determine team membership.
* **AI Perception System:** Relies on `GetGenericTeamId()` for affiliation checks (Friend, Neutral, Hostile).
* **Async Actions:** `UAsyncAction_ObserveTeam` and `UAsyncAction_ObserveTeamColors` bind to the `GetOnTeamIndexChangedDelegate()` to react to team changes on specific agents.
* **Gameplay Logic:** Any system needing to know an actor's team can query the interface.

***

The `ILyraTeamAgentInterface` provides the essential link between an Actor and the Team System. By implementing this interface and correctly broadcasting the change delegate, actors can reliably report their team affiliation to the `ULyraTeamSubsystem` and other interested gameplay systems.
