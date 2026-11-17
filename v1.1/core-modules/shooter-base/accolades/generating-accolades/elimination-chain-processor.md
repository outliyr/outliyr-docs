# Elimination Chain Processor

This processor is designed to detect and reward players for achieving "Elimination Chains" – scoring multiple eliminations within a short, predefined time window (often referred to as multi-kills like Double Kills, Triple Kills, etc.).

### Purpose

The `UEliminationChainProcessor` monitors elimination events and tracks the time between consecutive eliminations for each player. If a player achieves eliminations rapidly enough to meet the configured time limit, the processor broadcasts specific Gameplay Messages corresponding to the length of the chain (Double Kill, Triple Kill, etc.), triggering the associated accolades.

### Listening for Events

To track consecutive eliminations, the processor only needs to listen for one core Gameplay Message:

1. **`Lyra.Elimination.Message`:** Triggered whenever a player is eliminated. Each time this message is received, the processor updates the chain status for the instigating player.

```cpp
// From UEliminationChainProcessor::StartListening
AddListenerHandle(MessageSubsystem.RegisterListener(EliminationChain::TAG_Lyra_Elimination_Message, this, &ThisClass::OnEliminationMessage));
```

### Mechanism: Tracking Chains

The processor maintains the state of each player's current elimination chain using the `PlayerChainHistory` map:

```cpp
// Tracks the current chain status for each player (the Key)
UPROPERTY(Transient)
TMap<TObjectPtr<APlayerState>, FPlayerEliminationChainInfo> PlayerChainHistory;

// Stores info about a player's ongoing elimination chain
USTRUCT()
struct FPlayerEliminationChainInfo
{
    GENERATED_BODY()

    // The server time of the most recent elimination in the current chain
    UPROPERTY()
    double LastEliminationTime = 0.0;

    // How many eliminations are currently in this chain
    UPROPERTY()
    int32 ChainCounter = 1; // Starts at 1 for the first kill in a potential chain
};
```

**How it works (`OnEliminationMessage`):**

1. **Ignore Self-Eliminations:** If the `Instigator` and `Target` of the elimination are the same, the message is ignored.
2. **Get Instigator:** Retrieves the `APlayerState` of the player who scored the elimination.
3. **Get Current Time:** Calls `GetServerTime()` to get the reliable server timestamp of the current elimination.
4. **Access History:** Finds (or adds) the `FPlayerEliminationChainInfo` entry for the instigating player in `PlayerChainHistory`.
5. **Check Time Limit:** Compares the `CurrentTime` with the `LastEliminationTime` stored in the player's history against the configured `ChainTimeLimit`.
   * `bStreakReset = (History.LastEliminationTime == 0.0) || (History.LastEliminationTime + ChainTimeLimit < CurrentTime);`
   * The chain is considered "reset" if this is the player's very first elimination tracked (`LastEliminationTime == 0.0`) OR if the time elapsed since the last elimination exceeds the `ChainTimeLimit`.
6. **Update History:** Sets the `History.LastEliminationTime` to the `CurrentTime`.
7. **Update Counter:**
   * If `bStreakReset` is true, the `History.ChainCounter` is reset to `1` (this elimination starts a new potential chain).
   * If `bStreakReset` is false (the elimination continues the chain), the `History.ChainCounter` is incremented (`++History.ChainCounter`).
8. **Check for Accolade:** If the chain _wasn't_ reset and the counter was incremented, the processor checks if the _new_ `ChainCounter` value corresponds to a defined accolade.

### Configuration

This processor offers two key properties for configuration in its Blueprint or C++ subclass:

1. **`ChainTimeLimit` (float):**
   * Defines the maximum time (in seconds) allowed between consecutive eliminations for the chain to continue.
   * `UPROPERTY(EditDefaultsOnly) float ChainTimeLimit = 4.5f;`
   * If an elimination occurs more than `ChainTimeLimit` seconds after the previous one, the chain resets.
2. **`EliminationChainTags` (TMap\<int32, FGameplayTag>):**
   * This map links a specific chain length (the `int32` key) to a specific Accolade Gameplay Tag (the `FGameplayTag` value).
   * `UPROPERTY(EditDefaultsOnly) TMap<int32, FGameplayTag> EliminationChainTags;`
   * **Example:** You might configure this map like so:
     * `{ 2 : Accolade.DoubleKill }`
     * `{ 3 : Accolade.TripleKill }`
     * `{ 4 : Accolade.QuadKill }`
     * `{ 5 : Accolade.PentaKill }`
   * When the `ChainCounter` reaches a value that exists as a key in this map (e.g., reaches `2`), the processor broadcasts the corresponding Gameplay Tag (`Accolade.DoubleKill`).

### Broadcasting Accolade Messages

When the `ChainCounter` increments and matches a key in the `EliminationChainTags` map, the processor constructs and broadcasts a `FLyraVerbMessage` to signal the specific multi-kill accolade:

```cpp
// Simplified snippet from OnEliminationMessage, inside the 'else' block for chain continuation
if (FGameplayTag* pTag = EliminationChainTags.Find(History.ChainCounter))
{
    FLyraVerbMessage EliminationChainMessage;
    EliminationChainMessage.Verb = *pTag; // The tag from the map (e.g., Accolade.DoubleKill)
    EliminationChainMessage.Instigator = InstigatorPS; // Player who got the multi-kill
    // ... (InstigatorTags, ContextTags might be copied from original elim message)
    EliminationChainMessage.Magnitude = History.ChainCounter; // The length of the chain (e.g., 2)

    UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
    MessageSubsystem.BroadcastMessage(EliminationChainMessage.Verb, EliminationChainMessage);
}
```

* **`Verb`:** Set to the Gameplay Tag retrieved from `EliminationChainTags` based on the current chain count. This is the specific tag the `UAccoladeRelay` will likely listen for.
* **`Instigator`:** The `APlayerState` of the player who achieved the multi-kill.
* **`Magnitude`:** Set to the current `ChainCounter`, indicating the level of the multi-kill (2 for double, 3 for triple, etc.).

### Role in Accolade Flow

The `UEliminationChainProcessor` acts as a specialized detector for multi-kill events. It translates sequences of `Lyra.Elimination.Message` events occurring within the `ChainTimeLimit` into distinct, higher-level accolade messages (like `Accolade.DoubleKill`, `Accolade.TripleKill`). These specific messages are then processed by the `UAccoladeRelay`, which triggers the display of the corresponding accolade defined in the `Accolades` Data Table for the player who achieved the chain.

***
