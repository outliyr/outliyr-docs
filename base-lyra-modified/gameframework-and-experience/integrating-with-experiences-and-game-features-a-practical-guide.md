# Creating New Experiences & Game Features Plugins

This guide provides a practical, recommended workflow for creating new game modes or significant gameplay features using this asset's Experience and Game Feature systems. The core philosophy is **modularity** and **data-driven configuration**, where base game features provide foundational logic, and specific game modes (often implemented as their own Game Features) customize and extend this foundation primarily through **Experience Definitions and Action Sets configured in Blueprints.**

### Guiding Principles

* **Game Features for Modularity:** Encapsulate distinct game modes or major features within their own Game Feature Plugins. This promotes clean separation, allows for optional content, and simplifies dependency management. Your "Target Practice" mode, for example, will be its own Game Feature.m
* **One-Way Dependencies:** Game Feature Plugins can depend on core framework plugins (like a `ShooterBase` or the base `LyraInventorySystem`) and the base Lyra game. Core plugins should _not_ depend on specific game mode plugins. Game modes sit "on top."
* **Experience Definitions as the Primary Config Point:** The `ULyraExperienceDefinition` is where most game mode-specific configuration should occur. This includes:
  * Specifying the default `ULyraPawnData`.
  * Adding mode-specific `UGameStateComponent`s (like a scoring manager) via `UGameFeatureAction_AddComponents`.
  * Adding mode-specific HUD elements via `UGameFeatureAction_AddWidgets`.
  * Referencing customized or core `ULyraExperienceActionSet`s.
  * Enabling the Game Feature Plugin that contains the mode's specific assets and logic.
* **Action Sets for Reusable, Non-Customizable Logic:** `ULyraExperienceActionSet`s are excellent for bundling sets of actions and feature dependencies that are core to a foundational plugin (like `ShooterBase`) and are generally _not_ meant to be tweaked per individual Experience. These are often internal to the foundational plugin.
* **Customization through Duplication & Overriding (for Action Sets):** If a game mode needs to alter the behavior provided by a core Action Set (e.g., change a default component added by `ShooterBase`), the recommended pattern is to **duplicate that Action Set into the game mode's plugin** and modify the duplicate. The game mode's Experience Definition then references this duplicated, customized Action Set instead of the original. This maintains the integrity of the core plugin's assets while allowing per-mode flexibility. It's a bit redundant but ensures maximum customization without breaking core dependencies.
* **Blueprint-Centric Configuration:** Most of this setup (creating Data Assets, configuring Game Feature Actions within Experience Definitions, creating UI widgets and mode-specific components) is done in Blueprints, minimizing the need for C++ for common game mode variations.

### Scenario: Creating a "Target Practice" Game Mode

Let's walk through setting up a simple "Target Practice" mode as a new Game Feature Plugin.

**Assumptions:**

* Your project has a core plugin like `ShooterBase` providing basic weapon functionality, character setup, and potentially core Action Sets.
* Your project has a core inventory/UI plugin (like base Lyra) providing quick bars, etc.

#### Step 1: Create the "TargetPracticeMode" Game Feature Plugin

1. **Plugins Window:** Edit -> Plugins.
2. **Add New:** Click `+ Add`.
3. **Select Template:** Choose "Game Feature".
4. **Name:** `TargetPracticeMode`.
5.  **Dependencies (in `TargetPracticeMode.uplugin`):**

    * Add dependencies on `ShooterBase` (or your equivalent core shooter plugin) and any other Lyra/Inventory core plugins it needs. This allows `TargetPracticeMode` to reference assets and classes from those plugins.
    * Also add `LyraExampleContent` if you plan to use example assets from it.

    ```json
    // Example .uplugin snippet
    "Plugins": [
        { "Name": "ShooterBase", "Enabled": true },
        { "Name": "LyraGame", "Enabled": true }, // Assuming Lyra's core
        { "Name": "ModularGameplay", "Enabled": true },
        { "Name": "GameplayAbilities", "Enabled": true },
        // ... other necessary core plugins ...
    ]
    ```

#### Step 2: Configure the Game Feature Data Asset

Open the Data Asset created with your plugin (e.g., `Content/TargetPracticeMode/TargetPracticeMode_GameFeatureData.uasset`).

1. **Game Feature Actions:**
   * Click `+` next to `Actions`.
   * Select `GameFeatureAction_AddGameplayCuePath`.
   * **Configure:** In its `Directory Paths To Add`, ensure a path like `/GameplayCues` (relative to this plugin's Content folder) is present if you plan to add custom Gameplay Cues for this mode. Add any other directories within this plugin where cues might reside.

_(**Blueprint Screenshot Idea:** Show the `TargetPracticeMode_GameFeatureData` asset with the "Add Gameplay Cue Path" action configured.)_

#### Step 3: Create Game Mode Specific Assets (Blueprints)

Create these assets within your `TargetPracticeMode` plugin's Content folder.

1. **`B_GSC_TargetPracticeScore` (`UGameStateComponent`):**
   * Create a Blueprint class inheriting from `UGameStateComponent`.
   * Add logic to track and replicate the score.
   * Include functions to `IncrementScore` (callable from targets) and potentially manage target spawning or game timers.
2. **`BP_PracticeTarget` (`AActor`):**
   * Create an Actor Blueprint for shootable targets.
   * Add a mesh and collision.
   * On hit/destruction, it should communicate with `B_GSC_TargetPracticeScore` to increment the score (e.g., get GameState -> find component -> call function, or send a gameplay message).
3. **`WBP_TargetPracticeScore` (`UUserWidget`):**
   * Create a Widget Blueprint for displaying the score.
   * In its graph, get the local `ALyraGameState`, find the `B_GSC_TargetPracticeScore` component, and bind to a delegate on the component (or use Gameplay Messages) to receive score updates and refresh its display.
4. **`PawnData_TargetPractice` (`ULyraPawnData`):**
   * Create a `ULyraPawnData` asset.
   * **Pawn Class:** Typically your standard character (e.g., `ShooterCharacter` from `ShooterBase`).
   * **Ability Sets:** Grant abilities for movement and ensure the player starts with or can acquire the practice rifle. You might subclass a default `PawnData` from `ShooterBase` and just change the starting weapon or abilities.
   * **Input Config / Camera Mode:** Set as appropriate for target practice.

_(**Blueprint Screenshot Idea:** Briefly show the structure of `B_GSC_TargetPracticeScore` and `PawnData_TargetPractice`.)_

#### Step 4: Duplicate and Customize Core Action Sets (If Needed)

This is a key step for tailoring core functionality provided by plugins like `ShooterBase`.

1. **Locate Core Action Sets:** Find the core `ULyraExperienceActionSet` assets in `ShooterBase` (e.g., `LAS_ShooterBase_SharedInput`, `LAS_ShooterBase_StandardComponents`, `LAS_ShooterBase_StandardHUD`).
2. **Duplicate:** Duplicate these Action Sets _into your `TargetPracticeMode` plugin's content folder_.
3. **Rename:** Rename them appropriately (e.g., `LAS_TargetPractice_SharedInput`, `LAS_TargetPractice_StandardComponents`, `LAS_TargetPractice_StandardHUD`).
4. **Customize (If Necessary):** Open these duplicated Action Sets. Now you can safely:
   * **Remove unwanted actions:** If Target Practice doesn't need certain components or HUD elements added by the standard `ShooterBase` setup, remove those actions from _your copied versions_.
   * **Modify action parameters:** Change settings on the actions within _your copies_.
   * **Add new actions:** Add actions specific to Target Practice that should always run alongside these core setups.
   * **For this tutorial, we'll assume minimal changes are needed to these core sets for simplicity, but this is where you'd tailor them.**

_(**Note:** This duplication ensures that your `TargetPracticeMode` can evolve its core component setup independently of other game modes that might also use the original `ShooterBase` action sets. It provides maximum flexibility at the cost of some asset redundancy.)_

#### Step 5: Create the Experience Definition

This asset ties everything together for your "Target Practice" mode.

1. **Create Asset:** In your `TargetPracticeMode` plugin (e.g., in a folder like `Content/TargetPracticeMode/Experiences/`), create a `ULyraExperienceDefinition` named `B_Experience_TargetPractice`.
2. **Configure Properties:**
   * **`Game Features To Enable`:** Add `"TargetPracticeMode"` (the name of your plugin). This ensures this plugin and its content are active. _You might also need to list `ShooterBase` or other core plugins here if they aren't enabled globally or by a root experience._
   * **`Default Pawn Data`:** Assign your `PawnData_TargetPractice` asset.
   * **`Action Sets`:** Add references to your _duplicated and potentially customized_ Action Sets:
     * `LAS_TargetPractice_SharedInput`
     * `LAS_TargetPractice_StandardComponents`
     * `LAS_TargetPractice_StandardHUD`
   * **`Actions` (Experience-Specific):**
     * Click `+` to add a new action. Select `GameFeatureAction_AddComponents` from the dropdown.
       * **Component List \[0]:**
         * `Actor Class`: `ALyraGameState`
         * `Component Class`: `B_GSC_TargetPracticeScore`
         * `bClientComponent`: `true`
         * `bServerComponent`: `true`
     * Click `+` again. Select `GameFeatureAction_AddWidgets`.
       * **Layout (Optional):** If you have a mode-specific full-screen layout, configure it here.
       * **Widgets \[0]:**
         * `Widget Class`: `WBP_TargetPracticeScore`
         * `Slot ID`: A Gameplay Tag identifying where this widget should be placed in your HUD layout (e.g., `HUD.Slot.ModeStatus`). This slot tag must be recognized by your HUD system (likely defined in one of the HUD layouts added by the Action Sets).

_(**Blueprint Screenshot Idea:** Show the `B_Experience_TargetPractice` asset's Details panel, highlighting the Game Features to Enable, Default Pawn Data, referenced Action Sets, and the specific AddComponents/AddWidgets actions.)_

#### Step 6: Configure Map & User-Facing Experience

1. **Create/Open Map:** Create or open the map you want to use for Target Practice.
2. **World Settings:**
   * Ensure the `World Settings Class` is `ALyraWorldSettings`.
   * Set the `Default Gameplay Experience` to your `B_Experience_TargetPractice` asset.
3. **User-Facing Definition (for Menus):**
   * In your `TargetPracticeMode` plugin (e.g., in `Content/TargetPracticeMode/System/Playlists/`), create a `ULyraUserFacingExperienceDefinition` asset (e.g., `UserFacing_TargetPractice`).
   * **Configure:**
     * `Map ID`: Select the Primary Asset ID of your Target Practice map.
     * `Experience ID`: Select your `B_Experience_TargetPractice` definition.
     * `Tile Title`: "Target Practice"
     * `bShowInFrontEnd`: `true`
     * Fill out other UI details (Subtitle, Description, Icon).

_(**Blueprint Screenshot Idea:** Show the `UserFacing_TargetPractice` asset with key fields populated.)_

#### Step 7: Configure Plugin Asset Scanning

The Game Feature system needs to know where to find your new Primary Assets (Experiences, Action Sets, User Facing Definitions, Maps).

1. **Open Game Feature Data Asset:** Open `TargetPracticeMode_GameFeatureData.uasset` from your plugin's root.
2. **Asset Manager Section:** Find the `Asset Manager` section.
3. **`Primary Asset Types To Scan`:** Click `+` to add entries for each type of primary asset your plugin defines:
   * **Entry for Maps:**
     * `Primary Asset Type`: `Map`
     * `Asset Base Class`: `World`
     * `Directories`: Add the path(s) within your plugin's Content folder where your Target Practice map(s) are located (e.g., `/Game/TargetPracticeMode/Maps`).
   * **Entry for Experience Definitions:**
     * `Primary Asset Type`: `LyraExperienceDefinition`
     * `Asset Base Class`: `LyraExperienceDefinition`
     * `Directories`: Add `/Game/TargetPracticeMode/Experiences`.
   * **Entry for Experience Action Sets:**
     * `Primary Asset Type`: `LyraExperienceActionSet`
     * `Asset Base Class`: `LyraExperienceActionSet`
     * `Directories`: Add the path where you stored your duplicated/customized Action Sets (e.g., `/Game/TargetPracticeMode/ActionSets`).
   * **Entry for User Facing Experiences:**
     * `Primary Asset Type`: `LyraUserFacingExperienceDefinition`
     * `Asset Base Class`: `LyraUserFacingExperienceDefinition`
     * `Directories`: Add `/Game/TargetPracticeMode/System/Playlists`.

_(**Blueprint Screenshot Idea:** Show the `TargetPracticeMode_GameFeatureData` asset's Asset Manager configuration with the scan paths set up.)_

#### Step 8: Testing

1. **Activate Feature:** Ensure your "TargetPracticeMode" Game Feature plugin is active (via the "Game Features" window in Edit -> Plugins, or by selecting it if your project has a frontend for choosing experiences).
2. **Play In Editor:** Launch PIE, either by directly opening your Target Practice map (which should use the World Settings to load the experience) or by selecting "Target Practice" from a main menu (if you've integrated the User Facing Experience).
3. **Verify:** Check that your custom pawn data, HUD elements, and scoring component are all active and functioning as expected.

***

This guide demonstrates the recommended pattern for creating new game modes: encapsulate mode-specific logic and assets in a dedicated Game Feature Plugin, and use the `ULyraExperienceDefinition` as the primary configuration point, referencing customized (duplicated) Action Sets from core plugins and adding mode-unique actions and components. This approach maximizes modularity and data-driven design.
