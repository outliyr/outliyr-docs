# Elimination Streak Processor

This processor focuses on tracking and rewarding "Elimination Streaks" – achieving a certain number of eliminations consecutively without being eliminated yourself.

### Purpose

The `UEliminationStreakProcessor` monitors elimination events to count how many eliminations each player achieves in a single life. When a player's streak count reaches predefined milestones (e.g., 5 kills, 10 kills), the processor broadcasts specific Gameplay Messages corresponding to that streak level (e.g., "Killing Spree," "Unstoppable"), triggering the associated accolades. The streak for a player is reset when they are eliminated.

### Listening for Events

Similar to the Chain processor, the Streak processor primarily needs to listen for one core Gameplay Message to track both increments and resets:

1. **`Lyra.Elimination.Message`:** Triggered whenever a player is eliminated. The processor uses this message to:
   * Increment the streak count for the `Instigator` (if it wasn't a self-elimination).
   * Reset the streak count for the `Target` (the player who was eliminated).

```cpp
// From UEliminationStreakProcessor::StartListening
AddListenerHandle(MessageSubsystem.RegisterListener(EliminationStreak::TAG_Lyra_Elimination_Message, this, &ThisClass::OnEliminationMessage));
```

### Mechanism: Tracking Streaks

The processor maintains the current elimination streak count for each active player using the `PlayerStreakHistory` map:

```cpp
// Tracks the current elimination streak count for each player (the Key)
UPROPERTY(Transient)
TMap<TObjectPtr<APlayerState>, int32> PlayerStreakHistory;
```

* **`PlayerStreakHistory`:** This `TMap` uses the `APlayerState` of a player as the key and stores their current consecutive elimination count (the `int32` value) for their current life. If a player is not in the map, it implies their current streak is 0.

**How it works (`OnEliminationMessage`):**

1. **Increment Instigator's Streak:**
   * Checks if it's _not_ a self-elimination (`Payload.Instigator != Payload.Target`).
   * If not, it retrieves the `Instigator`'s `APlayerState`.
   * It finds (or adds, defaulting to 0) the entry for the `InstigatorPS` in `PlayerStreakHistory`.
   * It increments the streak count (`StreakCount++`).
   * It then checks if this new `StreakCount` matches any configured accolade milestones.
2. **Reset Target's Streak:**
   * Retrieves the `Target`'s `APlayerState` (the player who was eliminated).
   * It **removes** the entry for the `TargetPS` from `PlayerStreakHistory`. This effectively resets their streak count to 0 for their next life. The `FindOrAdd` operation in step 1 will handle re-adding them when they get their next elimination.

### Configuration

This processor has one key property for configuration in its Blueprint or C++ subclass:

1. **`EliminationStreakTags` (TMap\<int32, FGameplayTag>):**
   * Similar to the Chain processor, this map links a specific streak length (the `int32` key) to a specific Accolade Gameplay Tag (the `FGameplayTag` value).
   * `UPROPERTY(EditDefaultsOnly) TMap<int32, FGameplayTag> EliminationStreakTags;`
   * **Example:** You might configure this map like so:
     * `{ 5 : Accolade.KillingSpree }`
     * `{ 10 : Accolade.Rampage }`
     * `{ 15 : Accolade.Unstoppable }`
     * `{ 20 : Accolade.Godlike }`
   * When a player's `StreakCount` reaches a value that exists as a key in this map (e.g., reaches `5`), the processor broadcasts the corresponding Gameplay Tag (`Accolade.KillingSpree`).

### Broadcasting Accolade Messages

When the instigator's `StreakCount` increments and matches a key in the `EliminationStreakTags` map, the processor constructs and broadcasts a `FLyraVerbMessage` to signal the specific streak accolade achieved:

```cpp
// Simplified snippet from OnEliminationMessage, inside the check for Instigator != Target
int32& StreakCount = PlayerStreakHistory.FindOrAdd(InstigatorPS);
StreakCount++;

if (FGameplayTag* pTag = EliminationStreakTags.Find(StreakCount))
{
    FLyraVerbMessage EliminationStreakMessage;
    EliminationStreakMessage.Verb = *pTag; // The tag from the map (e.g., Accolade.KillingSpree)
    EliminationStreakMessage.Instigator = InstigatorPS; // Player who got the streak
    // ... (InstigatorTags, ContextTags might be copied from original elim message)
    EliminationStreakMessage.Magnitude = StreakCount; // The length of the streak (e.g., 5)

    UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
    MessageSubsystem.BroadcastMessage(EliminationStreakMessage.Verb, EliminationStreakMessage);
}
```

* **`Verb`:** Set to the Gameplay Tag retrieved from `EliminationStreakTags` based on the current streak count.
* **`Instigator`:** The `APlayerState` of the player who achieved the streak milestone.
* **`Magnitude`:** Set to the current `StreakCount`, indicating the level of the streak (5, 10, 15, etc.).

### Role in Accolade Flow

The `UEliminationStreakProcessor` identifies players who consistently perform well within a single life. It translates the ongoing count of eliminations into discrete, high-value accolade messages (like `Accolade.KillingSpree`, `Accolade.Unstoppable`) when milestones are reached. These specific messages are then typically processed by the `UAccoladeRelay`, which initiates the display of the corresponding accolade defined in the `Accolades` Data Table for the player achieving the streak. The processor also ensures streaks are correctly reset upon death, maintaining the integrity of the streak tracking.

***
