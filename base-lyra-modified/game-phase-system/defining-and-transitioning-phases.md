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
   * Give it a descriptive name, often mirroring the tag (e.g., `Phase_Warmup`, `Phase_Playing`, `Phase_RoundEnd`).
3. **Set the `GamePhaseTag`:**
   * Open the newly created Blueprint Ability asset.
   * Go to the **Class Defaults**.
   * Locate the **`Game Phase Tag`** property (under the "Lyra|Game Phase" category).
   * Select the specific Gameplay Tag you created in Step 1 from the dropdown list. **This step is crucial for linking the ability to the phase.**
4. **(Optional) Add Phase-Specific Logic:**
   * In most cases, the phase ability subclass doesn't need any custom logic. The base `ULyraGamePhaseAbility` handles the necessary interaction with the `ULyraGamePhaseSubsystem` during activation and ending.
   * However, if you need something specific to happen _only_ when this exact phase begins or ends (beyond what observers handle), you could override `ActivateAbility` or `EndAbility` in your subclass and add logic **after** calling the `Super::` implementation. This is generally less common, as observer patterns are preferred for decoupling.

Repeat these steps for every distinct phase required by your game mode or experience.

### 2. How Phase Abilities Are Activated

The `ULyraGamePhaseSubsystem` handles activation of phase abilities internally. When a phase transition is triggered via `StartPhase`, the subsystem:

* Grants the specified `ULyraGamePhaseAbility` class to the GameState’s Ability System Component (if not already granted).
* Immediately activates the ability, which in turn notifies the subsystem that the phase has begun.
* No manual setup or ability pre-granting is required in the experience or via `GameFeatureAction_AddAbilities`.

This on-demand approach ensures a clean and streamlined activation pipeline with minimal asset management overhead.

### 3. Initiating a Phase Transition

Transitions don't happen automatically based on time (unless you build timer logic); they are **explicitly triggered** by your game logic when conditions are met (e.g., warmup timer ends, score limit reached, objective completed).

<img src=".gitbook/assets/image (127).png" alt="" width="563" title="Example starting the warmup phase in Search And Destroy">

**Blueprint Execution Flow**

1. Authority checks are made (this is crucial as modifying the current gameplay phase can only be run on the server)
2. Wait for the experience to finish loading everything. (Only neccessary after BeginPlay)
3. Then start the phase the initial phase for your specific game

<div class="collapse">
<p class="collapse-title">Advanced: Internal Execution Flow</p>
<div class="collapse-content">

* Your game logic calls `StartPhase(TargetPhaseAbilityClass)`.

- The subsystem finds or creates an ability spec for `TargetPhaseAbilityClass` on the GameState's ASC.

* It activates that ability spec (`GiveAbilityAndActivateOnce`).

- The `TargetPhaseAbilityClass`'s `ActivateAbility` function runs.

* It calls `Super::ActivateAbility`, which in turn calls `PhaseSubsystem->OnBeginPhase`.

- `OnBeginPhase` executes the core hierarchy cancellation logic, potentially ending other active phases.

* The `TargetPhaseAbilityClass` instance is now considered active, and the game is officially in the new phase.

- Phase start observers are notified.

</div>
</div>

By defining your phases as tagged abilities and triggering transitions via the subsystem, you establish a robust and manageable flow for your game's lifecycle, enabling other systems to react appropriately through the observer pattern discussed next.

***
