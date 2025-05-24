# Observing & Reacting to Phases

A major benefit of the Game Phase System is decoupling. Instead of systems directly querying the Game Mode's state, they can **observe** the `ULyraGamePhaseSubsystem` and **react** when specific phases begin or end. This promotes modularity and makes it easier to manage complex interactions based on the game's current stage.

### Purpose of Observing

Various game systems often need to change their behavior based on the active phase:

* **UI:** Show/hide specific HUD elements (e.g., "Waiting for Players" text during `GamePhase.WaitingToStart`, scoreboard during `GamePhase.PostGame.Scoreboard`).
* **AI:** Switch behavior trees or targeting priorities (e.g., passive during `Warmup`, aggressive during `Playing`).
* **Spawning:** Enable/disable player respawning or item spawner locations.
* **Objectives:** Activate or deactivate capture points, payload progression, or other mode-specific goals.
* **Scoring:** Enable or disable score tracking or apply different scoring rules.
* **Audio:** Change background music tracks or ambient sounds.

### Primary Mechanism: Observer Delegates

The `ULyraGamePhaseSubsystem` provides functions to register callback delegates that are automatically invoked when phase changes occur. This event-driven approach is generally more efficient and cleaner than constantly checking (polling) the current phase.

1. **`WhenPhaseStartsOrIsActive(FGameplayTag PhaseTag, EPhaseTagMatchType MatchType, const FLyraGamePhaseTagDelegate& WhenPhaseActive)`**
   * **Purpose:** Registers a delegate (`WhenPhaseActive`) that will be called when a phase matching `PhaseTag` (according to `MatchType`) begins.
   * **Immediate Execution:** Critically, if a matching phase is **already active** when this function is called, the delegate is executed **immediately**. This ensures systems initialize correctly even if they start up _after_ a relevant phase has already begun.
   * **Later Execution:** The delegate will also be called whenever a _new_ phase starts that matches the criteria.
   * **Delegate Signature:** The bound function receives the specific `FGameplayTag` of the phase that actually started (which might be a child tag if using `PartialMatch`).
2. **`WhenPhaseEnds(FGameplayTag PhaseTag, EPhaseTagMatchType MatchType, const FLyraGamePhaseTagDelegate& WhenPhaseEnd)`**
   * **Purpose:** Registers a delegate (`WhenPhaseEnd`) that will be called **only** when a phase matching `PhaseTag` (according to `MatchType`) **ends** (either naturally or due to cancellation by a new phase starting).
   * **No Immediate Execution:** This delegate does _not_ fire immediately if a matching phase is already active. It only fires upon the phase's conclusion.
   * **Delegate Signature:** The bound function receives the specific `FGameplayTag` of the phase that ended.

### Understanding `EPhaseTagMatchType`

The `MatchType` parameter is crucial for controlling how broadly your observer reacts:

* **`EPhaseTagMatchType::ExactMatch`:**
  * Your delegate will only be called if the starting/ending phase's tag is **exactly identical** to the `PhaseTag` you registered with.
  * _Example:_ Registering for `GamePhase.Playing` with `ExactMatch` will _only_ trigger the delegate when the phase associated specifically with the `GamePhase.Playing` tag starts/ends. It will _not_ trigger for `GamePhase.Playing.SuddenDeath`.
* **`EPhaseTagMatchType::PartialMatch`:**
  * Your delegate will be called if the starting/ending phase's tag **matches or is a child tag (or grandchild, etc.)** of the `PhaseTag` you registered with.
  * _Example:_ Registering for `GamePhase.Playing` with `PartialMatch` will trigger the delegate when any of the following phases start/end:
    * `GamePhase.Playing`
    * `GamePhase.Playing.Warmup`
    * `GamePhase.Playing.Standard`
    * `GamePhase.Playing.SuddenDeath`
  * This is extremely useful for reacting to broader states. For instance, enabling core player controls when _any_ sub-phase under `GamePhase.Playing` becomes active.

### Binding Delegates

You can bind functions to these observer notifications from C++ or Blueprint.

**C++ Example (e.g., in an Actor Component's `BeginPlay`):**

```cpp
#include "LyraGamePhaseSubsystem.h"
#include "GameplayTags/LyraGameplayTags.h" // Assuming your tags are defined here

void UMyGameSystemComponent::BeginPlay()
{
    Super::BeginPlay();

    UWorld* World = GetWorld();
    if (ULyraGamePhaseSubsystem* PhaseSubsystem = UWorld::GetSubsystem<ULyraGamePhaseSubsystem>(World))
    {
        // --- Example: React when ANY playing phase starts ---
        FLyraGamePhaseTagDelegate PlayingPhaseStartedDelegate =
            FLyraGamePhaseTagDelegate::CreateUObject(this, &UMyGameSystemComponent::HandlePlayingPhaseStarted);

        PhaseSubsystem->WhenPhaseStartsOrIsActive(
            LyraGameplayTags::GamePhase_Playing, // The PARENT tag
            EPhaseTagMatchType::PartialMatch,    // Match Playing OR its children
            PlayingPhaseStartedDelegate
        );

        // --- Example: React ONLY when the Scoreboard phase ends ---
        FLyraGamePhaseTagDelegate ScoreboardPhaseEndedDelegate =
            FLyraGamePhaseTagDelegate::CreateUObject(this, &UMyGameSystemComponent::HandleScoreboardPhaseEnded);

        PhaseSubsystem->WhenPhaseEnds(
            LyraGameplayTags::GamePhase_PostGame_Scoreboard, // The EXACT tag
            EPhaseTagMatchType::ExactMatch,                  // Only match this specific tag
            ScoreboardPhaseEndedDelegate
        );
    }
}

void UMyGameSystemComponent::HandlePlayingPhaseStarted(const FGameplayTag& PhaseTag)
{
    // Enable player input, activate objectives, etc.
    // PhaseTag will be GamePhase.Playing, GamePhase.Playing.Warmup, etc.
    UE_LOG(LogTemp, Log, TEXT("Phase %s started (matched via GamePhase.Playing partial match). Enabling core gameplay."), *PhaseTag.ToString());
    EnableGameplayFeatures();
}

void UMyGameSystemComponent::HandleScoreboardPhaseEnded(const FGameplayTag& PhaseTag)
{
    // Hide scoreboard UI, maybe trigger level transition...
    // PhaseTag will be GamePhase.PostGame.Scoreboard
    UE_LOG(LogTemp, Log, TEXT("Phase %s ended. Hiding scoreboard."), *PhaseTag.ToString());
    HideScoreboard();
}

// Remember to implement EnableGameplayFeatures() and HideScoreboard()
```

**Blueprint Example:**

1. Get a reference to the **Game Phase Subsystem**.
2. Use the nodes:
   * **When Phase Starts or Is Active:** Drag off the delegate pin (`When Phase Active`) and choose **"Bind Event to When Phase Active"** (or "Create Event"). Connect the red event node to your logic. Select the desired `Phase Tag` and `Match Type`.
   * **When Phase Ends:** Similar process using the `When Phase End` delegate pin.
3. Implement the logic within the bound custom events.

_(Self/Weak Pointers: When using `CreateUObject` or Blueprint binding, ensure the object instance (`this` in C++, `Self` in BP) will still be valid when the delegate fires. For longer-lived bindings or potential destruction scenarios, consider using `CreateWeakLambda` in C++ or carefully managing Blueprint object lifecycles)._

### Polling (`IsPhaseActive`)

While observer delegates are preferred, you can directly check if a phase is currently active:

```cpp
// C++ Example
if (PhaseSubsystem->IsPhaseActive(LyraGameplayTags::GamePhase_Playing))
{
    // Do something only if currently in the Playing phase (or any sub-phase like Playing.SuddenDeath)
}

// Blueprint Example
Get Game Phase Subsystem -> Is Phase Active (Node) -> Branch
```

* **Functionality:** `IsPhaseActive(PhaseTag)` checks if _any_ currently active phase tag in the `ActivePhaseMap` matches the provided `PhaseTag` using `MatchesTag` (which inherently handles parent/child relationships, similar to `PartialMatch`).
* **Use Case:** Useful for one-off checks within conditional logic or when initializing state based on the phase _at that specific moment_.
* **Caution:** Avoid excessive polling. Relying on the `WhenPhase...` delegates for reactive behavior is generally more efficient and robust.

By utilizing the observer pattern provided by `ULyraGamePhaseSubsystem`, your various game systems can cleanly and efficiently respond to the evolving state of the game session, leading to more modular, maintainable, and reactive gameplay logic.

***
