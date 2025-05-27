# Customization & Extension

While `UShooterScoring_Base` provides essential default scoring for eliminations and assists, its true value lies in its extensibility. Game modes rarely have identical scoring rules or win conditions. This component is designed to be **subclassed** (in Blueprint or C++) to implement the unique logic required for your specific game experience.

### Primary Method: Subclassing `UShooterScoring_Base`

The intended workflow is:

1. **Create Subclass:** For your specific game mode (e.g., Domination, CTF, Arena), create a new Blueprint Class inheriting from `UShooterScoring_Base` (e.g., `BP_Scoring_Domination`, `BP_Scoring_Arena`).
2. **Override Hooks:** Implement custom logic by overriding the virtual functions and `BlueprintNativeEvent` implementations provided by the base class.
3. **Activate Subclass:** Use Lyra Experiences to add _your subclass_ component (instead of the base class) to the GameState for that specific game mode (See "Activating the Scoring Component").

### Hook 1: `OnEliminationScored` (Reacting to Kills)

This is the **most commonly overridden** function for implementing mode-specific logic related to eliminations.

* **Purpose:** Called automatically by the base class _after_ it has processed a `Lyra.Elimination.Message` and potentially applied the default score changes (for enemy kills).
* **Signature (C++):** `virtual void OnEliminationScored_Implementation(ELyraTeamComparison TeamKillComparision);`
* **Override (BP/C++):** Implement your logic within this function.
* **`TeamKillComparision` Parameter:** Provides context about the kill (DifferentTeams, SameTeam, NoComparison, InvalidArgument).
* **Common Use Cases:**
  * **Check Win Conditions:** Get current team scores (using `ULyraTeamSubsystem::GetTeamTagStackCount` with `ShooterGame.Score.Eliminations`) and check if a team has reached the target score limit or if other win conditions (like score difference) are met.
  * **Trigger Game End:** If a win condition is met, use the `ULyraGamePhaseSubsystem` to start the appropriate end-game phase (e.g., `StartPhase(BP_GamePhase_PostGame::StaticClass())`).
  * **Friendly Fire Penalties:** If `TeamKillComparision == ELyraTeamComparison::SameTeam`, you could implement logic here to _subtract_ points from the offending team or player using `AddTeamTagStack`/`AddStatTagStack` with a negative value.
  * **Suicide Penalties:** Check if `Payload.Instigator == Payload.Target` (requires accessing the original payload - might need modifications or storing it) and apply penalties.
  * **Mode-Specific Bonuses:** Award extra points based on the context (e.g., killing the flag carrier, eliminating an enemy near an objective) - this might require accessing more game state information within the override.
  * **Update Custom UI:** Send messages or update replicated variables related to kill events specific to your mode.

### Hook 2: `ResetAllActivePlayers` (Forcing Resets)

This function provides a convenient way to trigger a reset/respawn on all currently active players.

* **Purpose:** Useful for synchronizing state changes, like ending a round, resetting positions after a major event, or forcing players back to spawn points between phases.
* **Signature (C++):** `virtual void ResetAllActivePlayers_Implementation();` (It's a `BlueprintNativeEvent`, so override the `_Implementation` in C++ or the event in BP).
* **Default Logic:** Iterates through all `PlayerState`s, checks if they have a valid Pawn/Controller and _don't_ have the `Status.SpawningIn` tag, and then sends the `GameplayEvent.RequestReset` event to their ASC. This event typically triggers a death/respawn ability.
* **Override Use Cases:**
  * **Different Reset Tag:** Send a different Gameplay Event tag if your respawn logic uses a custom event.
  * **Excluding Players:** Add logic to skip resetting certain players based on team, role, or custom state tags.
  * **Additional Cleanup:** Perform extra cleanup actions on the player's Pawn or Controller before sending the reset event.
  * **Conditional Reset:** Only reset players if certain game state conditions are met.

### Hook 3: `PostWarmup` (Transitioning to Main Phase)

This is a simple placeholder intended for logic that should run once the main scoring phase of the game begins.

* **Purpose:** Designed to be called explicitly by your game mode logic, often triggered by a Game Phase transition (e.g., when `GamePhase.Playing` starts after `GamePhase.Warmup` ends).
* **Signature (C++):** `virtual void PostWarmup_Implementation();`
* **Override Use Cases:**
  * Reset scores/stats that might have accumulated during a non-scoring warmup phase.
  * Enable objective scoring mechanisms that were disabled during warmup.
  * Log the official match start time.
  * Initialize mode-specific timers or counters.

### Hook 4: Overriding Message Handlers (Advanced - Use Cautiously)

You _can_ override the functions that handle the incoming messages directly.

* **Functions (C++ `_Implementation` / BP Event):** `OnEliminationMessage`, `OnAssistMessage`.
* **Warning:** Overriding these **completely replaces** the default scoring logic provided by `UShooterScoring_Base` for that message type. You would be responsible for implementing _all_ score/stat tag updates yourself.
* **When to Use:** Only override these if the default scoring logic (e.g., +1 kill for enemy elim, +1 assist) is fundamentally wrong for your game mode and cannot be corrected by adjustments in `OnEliminationScored`. For example, if eliminations grant variable points based on kill streaks or objectives, you might override `OnEliminationMessage`.
* **Recommendation:** Prefer using `OnEliminationScored` for checks and adjustments _after_ the default scoring, as it's less error-prone.

### Adding New Scoring Logic (Custom Events)

Your game mode might have unique scoring events beyond eliminations and assists (e.g., capturing a point, delivering a flag, completing an interaction).

1. **Define Custom Messages/Events:** Create new Gameplay Tags (e.g., `ShooterGame.Event.ObjectiveCaptured`) and potentially custom payload structs if needed. Broadcast these messages from the relevant server-side game logic (e.g., from the control point actor when captured).
2.  **Register Listeners:** In your scoring component subclass's `BeginPlay` override (remember to call `Super::BeginPlay()`), register listeners for your custom message tags.

    ```cpp
    // Inside BP_Scoring_MyMode::BeginPlay()
    Super::BeginPlay(); // Call base class first!
    if(HasAuthority())
    {
        UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
        MessageSubsystem.RegisterListener(MyGameplayTags::ObjectiveCaptured, this, &ThisClass::OnObjectiveCaptured);
    }
    ```
3. **Implement Handlers:** Create the handler functions (e.g., `void UBP_Scoring_MyMode::OnObjectiveCaptured(FGameplayTag Channel, const FMyObjectiveCapturePayload& Payload)`).
4. **Apply Scoring:** Inside the handler, determine which player/team scored and apply points using `AddStatTagStack` or `AddTeamTagStack` with appropriate custom score tags (e.g., `ShooterGame.Score.ObjectivePoints`).
5. **Check Win Conditions:** Optionally, check win conditions within these custom handlers as well.

By subclassing `UShooterScoring_Base` and strategically overriding its hooks or adding listeners for custom events, you can build comprehensive and mode-specific scoring and win condition logic upon the provided foundation.

***
