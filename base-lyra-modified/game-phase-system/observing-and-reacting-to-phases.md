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

1.  **`WhenPhaseStartsOrIsActive(FGameplayTag PhaseTag, EPhaseTagMatchType MatchType, const FLyraGamePhaseTagDelegate& WhenPhaseActive)`**

    * **Purpose:** Registers a delegate (`WhenPhaseActive`) that will be called when a phase matching `PhaseTag` (according to `MatchType`) begins.
    * **Immediate Execution:** Critically, if a matching phase is **already active** when this function is called, the delegate is executed **immediately**. This ensures systems initialize correctly even if they start up _after_ a relevant phase has already begun.
    * **Later Execution:** The delegate will also be called whenever a _new_ phase starts that matches the criteria.
    * **Delegate Signature:** The bound function receives the specific `FGameplayTag` of the phase that actually started (which might be a child tag if using `PartialMatch`).

    <img src=".gitbook/assets/image (130).png" alt="" title="B_Scoring_Headquarters binding phases to functions">
2.  **`WhenPhaseEnds(FGameplayTag PhaseTag, EPhaseTagMatchType MatchType, const FLyraGamePhaseTagDelegate& WhenPhaseEnd)`**

    * **Purpose:** Registers a delegate (`WhenPhaseEnd`) that will be called **only** when a phase matching `PhaseTag` (according to `MatchType`) **ends** (either naturally or due to cancellation by a new phase starting).
    * **No Immediate Execution:** This delegate does _not_ fire immediately if a matching phase is already active. It only fires upon the phase's conclusion.
    * **Delegate Signature:** The bound function receives the specific `FGameplayTag` of the phase that ended.

    <img src=".gitbook/assets/image (131).png" alt="" title="B_Scoring_Headquarters binds the end of the Headquarters Captured phase to a script that revives dead players after the objective is secured.">

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

### Query (`IsPhaseActive`)

While observer delegates are preferred, you can directly check if a phase is currently active:

<img src=".gitbook/assets/image (129).png" alt="" title="Example of preventing the player from respawning if they captured the control point">

* **Functionality:** `IsPhaseActive(PhaseTag)` checks if _any_ currently active phase tag in the `ActivePhaseMap` matches the provided `PhaseTag` using `MatchesTag` (which inherently handles parent/child relationships, similar to `PartialMatch`).
* **Use Case:** Useful for one-off checks within conditional logic or when initializing state based on the phase _at that specific moment_.
* **Caution:** Avoid excessive polling. Relying on the `WhenPhase...` delegates for reactive behavior is generally more efficient and robust.

By utilizing the observer pattern provided by `ULyraGamePhaseSubsystem`, your various game systems can cleanly and efficiently respond to the evolving state of the game session, leading to more modular, maintainable, and reactive gameplay logic.

***
