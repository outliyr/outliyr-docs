# Customization & Extension

While `UShooterScoring_Base` provides a foundation for tracking scores, its primary role in a sophisticated game mode is to act as the **central controller for the game's flow**. It does this by listening to and triggering **Game Phases**.

Instead of simply reacting to isolated events like eliminations, this component should manage the entire lifecycle of a match—from warmup, to active play, to round end, to the final scoreboard—by using the `ULyraGamePhaseSubsystem`.

> [!success]
> You can explore the included game mode examples to see how flexible the system is, and how different rules, game phases, and win conditions can be implemented.

### Prerequisites

Before proceeding, a strong understanding of the **Game Phase System** is required. This documentation assumes you are familiar with its core concepts, including `ULyraGamePhaseSubsystem,` `ULyraGamePhaseAbility`, and how hierarchical Gameplay Tags are used to manage the game's flow. The custom scoring component's main role is to act as a controller for this system.

Please review the [**Game Phase System documentation**](../../../base-lyra-modified/game-phase-system/) first.

### The Phase-Driven Workflow

The intended workflow is to subclass `UShooterScoring_Base` and use it as the "brain" for your game mode's progression.

1. **Create a Subclass:** For your game mode (e.g., Headquarters, Search & Destroy), create a new Blueprint Class inheriting from `UShooterScoring_Base` (e.g., `BP_Scoring_Headquarters`).
2.  **Listen to Phases:** In your subclass's **Begin Play** event, get the `ULyraGamePhaseSubsystem` and register listeners. This is how your scoring component knows what state the game is in. You will bind custom functions to phase start and end events.

    <img src=".gitbook/assets/image (181).png" alt="" width="375" title="">
3. **Gate Logic by Phase:** In event handlers like `OnEliminationScored`, first check the current game phase using `IsPhaseActive`. You typically only want to award points or check for win conditions during a `GamePhase.Playing` phase, not during `GamePhase.Warmup` or `GamePhase.PostGame`.
4. **Trigger Phase Transitions:** When a game-altering event occurs (a team reaches the score limit, a bomb is defused, a headquarters is destroyed), your scoring component is responsible for telling the `ULyraGamePhaseSubsystem` to `StartPhase`, moving the entire game into its next logical state.

### Hook 1: Connecting to the Game Flow in Begin Play (Core Logic)

This is the most important part of setting up your custom scoring component. In `BeginPlay`, you subscribe to the phases relevant to your game mode.

**Purpose:** To activate and deactivate pieces of your game mode logic as the game progresses through its phases.

**Implementation (Blueprint Example in `BP_Scoring_Headquarters`):**

1. On `Event BeginPlay` (after calling the `Super`), get the `Lyra Game Phase Subsystem`.
2. Call `When Phase Starts or Is Active` and listen for `GamePhase.Playing`. Bind this to a function like `OnPlayingPhaseStarted`.
   * Inside `OnPlayingPhaseStarted`, you might reset scores, enable objective markers, and start a match timer.
3. Call `When Phase Ends` and listen for `GamePhase.Playing`. Bind this to a function like `OnPlayingPhaseEnded`.
   * Inside `OnPlayingPhaseEnded`, you would disable player input and stop the match timer.
4. Set up listeners for your mode's specific sub-phases. For Headquarters:
   * `WhenPhaseStartsOrIsActive(GamePhase.Playing.Captured, ...)` -> Bind to `OnHeadquartersCaptured`. This function would disable respawning for the capturing team and start a countdown timer.
   * `WhenPhaseEnds(GamePhase.Playing.Captured, ...)` -> Bind to `OnHeadquartersLost`. This function would re-enable respawning for all players (using `ResetAllActivePlayers`) and start the next `GamePhase.Playing.Locked` phase.

This observer pattern is the foundation of a clean, phase-driven architecture.

### Hook 2: OnEliminationScored (Reacting During a Phase)

This function is still your primary hook for reacting to kills, but its logic should be conditional on the current game phase.

**Purpose:** To handle scoring and check for win conditions **only when scoring is appropriate.**

**Implementation (Blueprint/C++):**

```cpp
// Inside OnEliminationScored_Implementation
// FIRST, check if we are in a phase where scoring is allowed.
ULyraGamePhaseSubsystem* PhaseSubsystem = GetWorld()->GetSubsystem<ULyraGamePhaseSubsystem>();
if (!PhaseSubsystem || !PhaseSubsystem->IsPhaseActive(LyraGameplayTags::GamePhase_Playing))
{
    // Not in a playing phase, so don't award points or check for wins.
    return;
}

// Now, proceed with the default scoring logic from the base class.
Super::OnEliminationScored_Implementation(TeamKillComparision);

// Check for win conditions
// This logic now only runs during the Playing phase.
if (CheckForWinCondition())
{
    // A team has won! End the playing phase and start the post-game phase.
    PhaseSubsystem->StartPhase(BP_GamePhase_PostGame::StaticClass());
}
```

**Common Use Cases (Now Phase-Aware):**

* **Check Win Conditions:** After a kill, get team scores and if a limit is reached, call `StartPhase` to transition to `GamePhase.PostGame`.
* **Friendly Fire/Suicide:** Apply penalties, but only if the active phase dictates it.
* **Mode-Specific Bonuses:** Award extra points for killing an enemy near an objective, but only if the objective is active (which can be tied to a sub-phase like `GamePhase.Playing.HillActive`).

### Hook 3: ResetAllActivePlayers (Responding to a Phase Change)

This function is a powerful tool for synchronizing all players, often used as a direct result of a phase transition.

**Purpose:** Force a respawn or reset on all players, typically at the end of a round or when an objective is cleared.

**How to Use with Phases:**\
Instead of calling this function arbitrarily, trigger it from a phase event handler.

**Example (Search & Destroy):**\
In `BeginPlay`, you would set up a listener:`WhenPhaseEnds(GamePhase.Playing.Round, MatchType: ExactMatch, ...)` -> Bind to `OnRoundEnded`.

Inside the `OnRoundEnded` function, you would call `ResetAllActivePlayers` to ensure everyone is ready for the next round, which might be triggered by starting a new `GamePhase.Playing.Round` or `GamePhase.RoundSwitchSides` phase.

### Hook 4: Adding New Scoring Logic (Triggering New Phases)

When your game mode has unique events (capturing a point, delivering a flag), these events are often the catalyst for a phase transition.

**Workflow:**

1. **Define Custom Messages:** Create Gameplay Tags for your events (e.g., `ShooterGame.Event.ObjectiveCaptured`).
2. **Register Listeners:** In your scoring component's `BeginPlay`, register a listener for this message.
3. **Implement Handler & Trigger Phase:** Inside the handler function:
   * Apply the score using `AddTeamTagStack`.
   * **Crucially, determine if this event changes the state of the game.** If capturing the point ends the round or a lockdown period, call `StartPhase` to move to the next phase (e.g., `StartPhase(Phase_RoundEnd::StaticClass())`).

By making your scoring component the master of phase transitions, you create a clear and authoritative source for your game's flow logic.

***
