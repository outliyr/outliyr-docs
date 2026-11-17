# Setup & Integration

To control your game's flow, you must install your custom logic components into the game world. This is done by adding the components to the `GameState` when your Lyra Experience loads.

### Goal: Installing the Game Flow Controller(s)

The objective is to attach your chosen logic components (e.g., `BP_Scoring_Arena`, `BP_EconomyManager_Arena`) to the `AGameStateBase` actor. These components are server-authoritative and will collectively manage the game's progression by listening to and triggering game phases via the `ULyraGamePhaseSubsystem`.

#### Conceptual Link

* **Lyra Experience:** Defines the map, game mode, and other high-level rules.
* **Game Phase System:** A global system for managing game states (Warmup, Playing, PostGame).
* **Your Custom Components:** The **brains** of the operation. They interpret game events (kills, objectives, timers) and tell the Game Phase System when to change states. They must be added to the world to perform this role.

### Method: Lyra Experiences & GameFeatureAction_AddComponents

The standard Lyra method for adding components is to use the `GameFeatureAction_AddComponents` action within your Experience Definition.

**Steps:**

1. **Identify Target Experience:** Open the `ULyraExperienceDefinition` asset for your game mode (e.g., `B_Experience_Arena`).
2. **Add the Action:** In the `Actions` list, add a new `GameFeatureAction_AddComponents`.
3. **Configure the Action:**
   * **Target Actor:** Set to `GameState`.
   * **Component List:** Add one entry for **each** custom component you need.
     * **Component Class:** Select your custom component subclass (e.g., `BP_Scoring_Arena`, `BP_EconomyManager_Arena`).
     * **Spawn Actor Condition:** Set to **Server Component and Client Component**. Game flow, scoring, and economy change state on the server but we want variables to replicate to the clients, along with delegates and OnRep functions to be called.
4. **Save:** Save the `ULyraExperienceDefinition` asset.

### A Single Controller vs. Multiple Specialists

#### The Simple Approach: One Central Controller

For most game modes (like a standard Deathmatch), having a single custom scoring component that manages the entire game flow is the simplest and cleanest approach. It acts as the one central brain for the match.

#### The Advanced Approach: Multiple Specialist Components

For more complex game modes, trying to cram all logic into a single class can become messy. It is often better to split responsibilities into multiple, specialized components, as long as you follow good design principles.

A great example is an Arena mode (like CS:GO or Valorant), which might use three distinct components on the GameState:

* **`BP_CharacterSelectionManager`:** Its only job is to manage the pre-game. It handles character pick/ban logic, team validation, and the initial countdown. Once character selection is complete, it triggers the `GamePhase.RoundStart` and its job is done until the next match.
* **`BP_Scoring_Arena`:** This is the primary game flow controller during the match. It initially starts the character selection and listens for the `GamePhase.RoundStart` to begin. It also listens to other phases relevant to the game mode. It manages the buy phase timer, the main round timer, handles what happens when the bomb is planted (starting `GamePhase.Playing.BombPlanted`), and triggers team swaps and round-end/post-game phases.
* **`BP_EconomyManager`:** A pure specialist. It listens for game phase events and gameplay messages triggered by the other components. It listens for `GamePhase.RoundWon` to payout teams after the round, and elimination gameplay message (`WhenPhaseEnds(GamePhase.Playing.Round, ...)` to award currency to players when they kill opponents. It also tracks the currency of each players, and performs the server validation for buying and selling in the buy menu.

**Guiding Principles for Multiple Components:**

1. **Separation of Concerns:** This is the most important rule. Each component must have a single, clearly defined responsibility. The Economy Manager should **only** handle the economy. The Scoring component should **only** handle the match flow.
2. **Clear, Non-Overlapping Authority:** Avoid clashes. Two components should not be trying to control the same piece of logic. For example, only the `BP_Scoring_Arena` component should be responsible for starting the `GamePhase.PostGame`. The `BP_EconomyManager` might react to that phase, but it should never trigger it.
3. **Communicate via Phases:** The components coordinate their actions by listening to the Game Phase System. The Character Selection manager ends its work by starting a phase that the Scoring manager is waiting for. The Scoring manager starts a round end phase that the Economy manager listens to. They work together, triggered by the shared state of the game, not by calling each other directly.

### Verification

When using one or more custom components, your verification process is key:

1. **Inspect the GameState:** Use the World Outliner and confirm that **all** your intended components are attached to the `GameState` on the server.
2. **Verify Initial State:** Confirm the game starts in the correct initial phase, handled by the correct component (e.g., `GamePhase.CharacterSelect` is started by the `CharacterSelectionManager`).
3. **Test Hand-offs:** Play through the game's lifecycle and verify that the "baton" is passed correctly between components via phase changes. Does the end of character selection correctly start the main game loop? Does the end of a round correctly trigger the economy rewards?
4. **Check for Conflicts:** Ensure that game logic is not being duplicated and that phase transitions are only being triggered by the single, authoritative component responsible for that specific transition.
