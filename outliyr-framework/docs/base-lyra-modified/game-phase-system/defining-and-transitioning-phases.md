# Defining & Transitioning Phases

Leveraging the Game Phase System involves two main steps: first, defining the distinct phases your game requires using Gameplay Tags and `ULyraGamePhaseAbility` subclasses, and second, triggering transitions between these phases using the `ULyraGamePhaseSubsystem`.

### 1. Defining a New Game Phase

Follow these steps for each unique stage or state in your game flow:

1. **Create the Gameplay Tag:**
   * Navigate to **Project Settings -> Project -> Gameplay Tags**.
   * Click **"Add New Gameplay Tag"**.
   * Define a tag that clearly represents the phase and fits logically within your desired hierarchy. Use dots (`.`) for nesting.
     * _Examples:_ `GamePhase.Warmup`, `GamePhase.Playing.CaptureTheFlag`, `GamePhase.PostGame.Scoreboard`.
   * **Hierarchy Planning:** Think carefully about parent/child/sibling relationships, as this directly impacts the automatic cancellation logic (See "Core Concept: The Phase Hierarchy").
2. **Create the Phase Ability Class:**
   * In your Content Browser, right-click and choose **Blueprint Class**.
   * Search for and select **`LyraGamePhaseAbility`** as the parent class.
   * Give it a descriptive name, often mirroring the tag (e.g., `BP_GamePhase_Warmup`, `BP_GamePhase_PlayingCTF`, `BP_GamePhase_Scoreboard`).
3. **Set the `GamePhaseTag`:**
   * Open the newly created Blueprint Ability asset.
   * Go to the **Class Defaults**.
   * Locate the **`Game Phase Tag`** property (under the "Lyra|Game Phase" category).
   * Select the specific Gameplay Tag you created in Step 1 from the dropdown list. **This step is crucial for linking the ability to the phase.**
4. **(Optional) Add Phase-Specific Logic:**
   * In most cases, the phase ability subclass doesn't need any custom logic. The base `ULyraGamePhaseAbility` handles the necessary interaction with the `ULyraGamePhaseSubsystem` during activation and ending.
   * However, if you need something specific to happen _only_ when this exact phase begins or ends (beyond what observers handle), you could override `ActivateAbility` or `EndAbility` in your subclass and add logic **after** calling the `Super::` implementation. This is generally less common, as observer patterns are preferred for decoupling.

Repeat these steps for every distinct phase required by your game mode or experience.

### 2. Granting Phase Abilities to GameState

The `ULyraGamePhaseSubsystem` activates phase abilities on the **GameState's Ability System Component (ASC)**. Therefore, the GameState ASC must be granted all the potential phase abilities _before_ they can be activated.

* **Recommended Method:** Use `GameFeatureAction_AddAbilities` within the relevant `ULyraExperienceDefinition` or a shared `ULyraExperienceActionSet`.
  * **Target Actor:** Set the `ActorClass` in the `FGameFeatureAbilitiesEntry` to `GameState` (or your specific `AGameStateBase` subclass).
  * **Granted Abilities:** Add entries for each of your `ULyraGamePhaseAbility` subclasses (`BP_GamePhase_Warmup`, `BP_GamePhase_Playing`, etc.) to the `GrantedAbilities` list.
  * **Context:** Ensure this action runs on the server context where the GameState exists and has authority.

This ensures that when the experience loads, the GameState is equipped with all the phase abilities it might need to transition between during the session.

### 3. Initiating a Phase Transition

Transitions don't happen automatically based on time (unless you build timer logic); they are **explicitly triggered** by your game logic when conditions are met (e.g., setup timer ends, score limit reached, objective completed).

* **The Trigger:** Call the `StartPhase` function on the `ULyraGamePhaseSubsystem`.
*   **Accessing the Subsystem:** Get a reference to the subsystem from the World:

    ```cpp
    // C++ Example (e.g., inside your GameMode or another server-side actor)
    UWorld* World = GetWorld();
    if (ULyraGamePhaseSubsystem* PhaseSubsystem = UWorld::GetSubsystem<ULyraGamePhaseSubsystem>(World))
    {
        // ... call StartPhase ...
    }
    ```

    ```blueprint
    # Blueprint Example
    Get Game Phase Subsystem -> Start Phase (Node)
    ```
* **Calling `StartPhase` / `Start Phase` Node:**
  * **Input:** Provide the **Class** of the `ULyraGamePhaseAbility` subclass corresponding to the phase you want to _enter_ (e.g., `BP_GamePhase_Playing::StaticClass()` in C++, or select `BP Game Phase Playing` in the Blueprint node's dropdown).
  * **Optional Callback (`PhaseEndedCallback`):** You can provide a delegate (C++ `FLyraGamePhaseDelegate` or Blueprint `Lyra Game Phase Dynamic Delegate`) that will be executed specifically when the phase instance _you just started_ eventually ends (either naturally or by being cancelled by a later transition). This is useful for chaining phase transitions or performing cleanup tied to a specific phase instance ending.
    * _Blueprint Note:_ Wire an event dispatcher or custom event to the `Phase Ended` output pin of the `Start Phase` node.

**Execution Flow:**

1. Your game logic calls `StartPhase(TargetPhaseAbilityClass)`.
2. The subsystem finds or creates an ability spec for `TargetPhaseAbilityClass` on the GameState's ASC.
3. It activates that ability spec (`GiveAbilityAndActivateOnce`).
4. The `TargetPhaseAbilityClass`'s `ActivateAbility` function runs.
5. It calls `Super::ActivateAbility`, which in turn calls `PhaseSubsystem->OnBeginPhase`.
6. `OnBeginPhase` executes the core hierarchy cancellation logic, potentially ending other active phases.
7. The `TargetPhaseAbilityClass` instance is now considered active, and the game is officially in the new phase.
8. Phase start observers are notified.

By defining your phases as tagged abilities and triggering transitions via the subsystem, you establish a robust and manageable flow for your game's lifecycle, enabling other systems to react appropriately through the observer pattern discussed next.

***
