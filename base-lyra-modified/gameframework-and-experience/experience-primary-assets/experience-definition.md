# Experience Definition

The `ULyraExperienceDefinition` is a **Primary Data Asset** that serves as the central blueprint defining the specific rules, content, features, and default configuration for a particular gameplay session or mode. When the game decides to run, for example, "Team Deathmatch" or "Capture the Flag", it loads the corresponding `ULyraExperienceDefinition` asset.

### Role and Purpose

* **Session Blueprint:** Defines the fundamental components and setup required for a specific gameplay experience.
* **Feature Activation:** Specifies which Game Feature plugins must be loaded and activated for this experience to function correctly.
* **Default Player Configuration:** Sets the default `ULyraPawnData` to be used for players spawning within this experience, unless overridden by other means (like player state).
* **Direct Actions:** Can contain a list of `UGameFeatureAction`s to be executed directly as part of this experience's activation, supplementing actions provided by the activated Game Features.
* **Composability:** Can include references to reusable `ULyraExperienceActionSet` assets, allowing common setup steps to be shared across multiple experiences.

### Creation

You create Experience Definitions in the Unreal Editor:

1. **Content Browser:** Navigate to a suitable folder (e.g., `Content/Experiences`).
2. **Right-Click:** Right-click in the empty space.
3. **Miscellaneous:** Select `Data Asset`.
4. **Choose Class:** Search for and select `LyraExperienceDefinition` as the parent class.
5. **Name Asset:** Give it a descriptive name, often prefixed with `B_` or  (e.g., `B_TeamDeathmatch`, `B_CaptureTheFlag`). This name is important as it forms part of the Primary Asset ID used to load the experience.

> [!success]
> Same steps as in the [`LyraPawnData` video](lyrapawndata.md#creation), just search for `LyraExperienceDefinition` instead.&#x20;

### Key Properties

Configure these properties within the Experience Definition asset's Details panel:

<img src=".gitbook/assets/image (112).png" alt="" title="Experience Definition of the Headquarters Game Mode">

1. **`Game Features To Enable` (`TArray<FString>`)**
   * **Purpose:** Lists the names of the Game Feature plugins that _must_ be active for this experience.
   * **Mechanism:** When this experience is loaded by the `ULyraExperienceManagerComponent`, it will iterate through this list and request the `UGameFeaturesSubsystem` to load and activate each named plugin.
   * **Example:** An Experience for Capture the Flag might list `"CTFMode"`, `"StandardWeapons"`, `"ArenaUI"`.
2. **`Default Pawn Data` (`TObjectPtr<const ULyraPawnData>`)**
   * **Purpose:** Specifies the default Pawn configuration (Pawn class, abilities, input, camera, HUD elements) for players spawning in this experience.
   * **Mechanism:** The `ALyraGameMode::GetPawnDataForController` function uses this as a fallback if the player's `ALyraPlayerState` doesn't have specific Pawn Data assigned. The selected `ULyraPawnData` is then used during pawn spawning to configure the character.
   * **Example:** A Team Deathmatch experience might assign `PawnData_StandardSoldier`. A vehicle-focused mode might assign `PawnData_VehicleOperator`.
3. **`Actions` (`TArray<TObjectPtr<UGameFeatureAction>>`, Instanced)**
   * **Purpose:** A list of specific `UGameFeatureAction` instances to execute _directly_ as part of this experience loading.
   * **Mechanism:** The `ULyraExperienceManagerComponent` executes the `OnGameFeatureActivating` logic for each action in this list after the required Game Features have been activated.
   * **Use Case:** For actions tightly coupled to this specific experience that aren't general enough to belong in a reusable Action Set or Game Feature plugin (e.g., setting a very specific console variable rule, adding a unique HUD element only for this exact mode). You add action instances directly here and configure their properties.
4. **`Action Sets` (`TArray<TObjectPtr<ULyraExperienceActionSet>>`)**
   * **Purpose:** Includes references to other `ULyraExperienceActionSet` Data Assets. This promotes reusability.
   * **Mechanism:** When the experience loads, the `ULyraExperienceManagerComponent` treats the `GameFeaturesToEnable` and `Actions` from _all referenced Action Sets_ as if they were part of the main Experience Definition's lists. It effectively merges them together.
   * **Use Case:** Define common setup steps in an Action Set (e.g., `ActionSet_CoreGameplay` which enables the `ShooterCore` feature and adds standard movement abilities) and include this Action Set in multiple different Experience Definitions (`B_Experience_TDM`, `B_Experience_FFA`, etc.).

### How Experiences are Chosen

As detailed in the `ALyraGameMode` documentation, the specific `ULyraExperienceDefinition` to load for a session is determined by a priority order:

1. Matchmaking Assignment (if applicable)
2. URL Options (`?Experience=ExperienceAssetName`)
3. Developer Settings Override (PIE only)
4. Command Line Argument (`-Experience=ExperienceAssetName`)
5. Default Experience set in the `ALyraWorldSettings` of the current map.
6. Dedicated Server login/playlist logic.
7. A hardcoded project default (e.g., `B_LyraDefaultExperience`).

The `ALyraGameMode` finds the highest priority valid ID and passes it to the `ULyraExperienceManagerComponent` to begin loading.

### Validation

The asset includes editor-time validation (`IsDataValid`) to check for common errors, such as:

* Null entries in the `Actions` array.
* Incorrect Blueprint subclassing (You should typically inherit directly from `ULyraExperienceDefinition` in Blueprint, not from another Blueprint subclass of it).

***

The `ULyraExperienceDefinition` is the central configuration asset for defining a specific gameplay session. By carefully configuring its Game Features, Default Pawn Data, direct Actions, and included Action Sets, you can create distinct, modular, and easily manageable game modes and experiences.
