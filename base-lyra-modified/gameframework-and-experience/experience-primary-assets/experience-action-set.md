# Experience Action Set

The `ULyraExperienceActionSet` is a **Primary Data Asset** designed to promote **reusability and composition** when defining `ULyraExperienceDefinition`s. It acts as a container for a collection of Game Features to enable and specific Game Feature Actions to execute, allowing you to define common setup steps once and include them in multiple different Experiences.

### Role and Purpose

* **Reusability:** Group common configurations (required features and setup actions) into a single asset that can be referenced by many `ULyraExperienceDefinition`s.
* **Composition:** Build complex Experiences by layering multiple Action Sets together along with the Experience's own specific features and actions.
* **Organization:** Keep Experience Definitions cleaner by moving shared setup logic into separate, focused Action Set assets.

### Creation

Similar to Experience Definitions, you create Action Sets in the Unreal Editor:

1. **Content Browser:** Navigate to a suitable folder (e.g., `Content/Experiences/ActionSets`).
2. **Right-Click:** Right-click in the empty space.
3. **Miscellaneous:** Select `Data Asset`.
4. **Choose Class:** Search for and select `LyraExperienceActionSet` as the parent class.
5. **Name Asset:** Give it a descriptive name, often prefixed with `LAS_` (e.g., `LAS_StandardHUD`, `LAS_StandardComponents`, `LAS_SharedInput`).

> [!success]
> Same steps as in the [`LyraPawnData` video](lyrapawndata.md#creation), just search for `LyraExperienceActionSet` instead.&#x20;

### Key Properties

Configure these properties within the Action Set asset's Details panel:

<img src=".gitbook/assets/image (114).png" alt="" title="LAS_Infection_StandardComponents">

1. **`Actions` (`TArray<TObjectPtr<UGameFeatureAction>>`, Instanced)**
   * **Purpose:** A list of specific `UGameFeatureAction` instances to execute when any Experience _including_ this Action Set is activated.
   * **Mechanism:** When an Experience is loaded, the `ULyraExperienceManagerComponent` collects actions from the Experience _and_ all its referenced Action Sets and executes them.
   * **Use Case:** Defining common setup steps like adding core player abilities (`GameFeatureAction_AddAbilities`), adding standard input bindings (`GameFeatureAction_AddInputBinding`), adding default widgets (`GameFeatureAction_AddWidgets`), or configuring common subsystems relevant to a group of experiences.
2. **`Game Features To Enable` (`TArray<FString>`)**
   * **Purpose:** Lists the names of Game Feature plugins that are required by the actions or logic contained within _this Action Set_.
   * **Mechanism:** When an Experience including this Action Set is loaded, these Game Feature names are added to the total list of features that the `ULyraExperienceManagerComponent` needs to load and activate.
   * **Use Case:** Ensuring that if this Action Set adds, for example, specific weapon abilities, the Game Feature plugin containing those abilities (`ShooterCore`?) is also activated.

### How Action Sets are Used

1. **Create Action Set(s):** Define one or more `ULyraExperienceActionSet` assets containing common configurations.
   * _Example: `ActionSet_CoreGameplay`_ might enable the "ShooterCore" Game Feature and include a `GameFeatureAction_AddAbilities` action that grants basic movement and interaction abilities.
   * _Example: `ActionSet_StandardHUD`_ might include a `GameFeatureAction_AddWidgets` action that adds the default health bar, ammo counter, and minimap widgets.
2. **Create Experience Definition:** Create your `ULyraExperienceDefinition` asset (e.g., `B_Experience_TDM`).
3. **Reference Action Set(s):** In the `B_Experience_TDM` asset, find the `Action Sets` array property.
4. **Add Reference:** Click `+` and select your previously created Action Set assets (e.g., `ActionSet_CoreGameplay`, `ActionSet_StandardHUD`) from the asset picker dropdown.
5. **Add Experience-Specific Config:** Add any additional `Game Features To Enable` or `Actions` directly to the `B_Experience_TDM` asset that are unique to Team Deathmatch and not covered by the included Action Sets.

### Runtime Execution Flow

When `B_Experience_TDM` is loaded by the `ULyraExperienceManagerComponent`:

1. It gathers the `GameFeaturesToEnable` list from `B_Experience_TDM` _and_ from `ActionSet_CoreGameplay` _and_ `ActionSet_StandardHUD`. It activates all unique features found.
2. It gathers the `Actions` list from `B_Experience_TDM` _and_ `ActionSet_CoreGameplay` _and_ `ActionSet_StandardHUD`.
3. It executes the `OnGameFeatureActivating` logic for _all_ gathered actions.

The order of execution between actions defined directly in the Experience and those in Action Sets is not strictly guaranteed by default but generally follows the order they are processed by the manager.

### Validation

Similar to Experience Definitions, Action Sets include editor-time validation (`IsDataValid`) to check for null entries in the `Actions` array.

***

`ULyraExperienceActionSet`s are a powerful tool for organizing and reusing common setup logic across multiple `ULyraExperienceDefinition`s. By grouping related Game Features and Actions into logical sets, you can keep your Experience Definitions focused on what makes them unique, improving maintainability and promoting a compositional approach to defining gameplay sessions.
