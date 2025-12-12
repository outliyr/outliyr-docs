# Supporting Data Assets

While the core game flow is orchestrated by classes like `ALyraGameMode` and `ALyraGameState`, and modularity is achieved through Experiences and Game Features, several key **Data Assets** provide essential configuration and references used by these systems. These assets allow for data-driven setup and decoupling of specific settings from code.

This section focuses on two important supporting data assets (excluding `ULyraPawnData`, which is covered separately):

1. **World Settings (`ALyraWorldSettings`):** Configuration specific to individual game maps (.umap files), primarily used to define a default gameplay experience for a level.
2. **Asset Manager (`ULyraAssetManager`):** The engine's system for managing game assets, particularly Primary Assets like Experience Definitions. Lyra provides a custom subclass with specific initialization and helper functions.

### Purpose: Configuration and Resource Management

* **Map-Specific Defaults (`ALyraWorldSettings`):** Allows designers to specify which `ULyraExperienceDefinition` should load by default when a particular map is opened by a server, if no other higher-priority Experience is specified (e.g., via URL options or matchmaking).
* **Centralized Asset Loading (`ULyraAssetManager`):** Manages the discovery, loading, and unloading of Primary Data Assets. It ensures that assets referenced by Experiences or other systems are correctly loaded into memory when needed. Lyra's custom manager also handles specific startup tasks and provides convenient access to global game data assets.

### How They Fit In

* **`ALyraWorldSettings`:**
  * Each map (`.umap` file) in your project uses an instance of this class (or a subclass) as its World Settings object (configurable in the World Settings panel in the editor).
  * The `ALyraGameMode` queries the current map's `ALyraWorldSettings` for its `DefaultGameplayExperience` as one of the potential sources when determining which `ULyraExperienceDefinition` to load.
* **`ULyraAssetManager`:**
  * A singleton object for the entire game instance.
  * The `ULyraExperienceManagerComponent` uses it to load `ULyraExperienceDefinition` assets (which are Primary Assets) and their dependencies when an Experience is being activated.
  * Game Feature Actions (like `UGameFeatureAction_AddInputContextMapping` or those loading UI widgets) often use it to load soft-referenced assets (`TSoftObjectPtr`, `TSoftClassPtr`) synchronously or asynchronously.
  * Provides access to globally configured data like `ULyraGameData` and the `DefaultPawnData`.

### Structure of this Section

The following sub-pages will provide details on these supporting assets:

1. **World Settings (`ALyraWorldSettings`):** Detailing its role in setting default map experiences.
2. **Asset Manager (`ULyraAssetManager`):** Explaining its customization for Lyra and its role in asset loading and startup.

***

This overview introduces the supporting Data Assets that play crucial roles in configuring map defaults and managing asset loading within the Experience and Game Feature framework. Understanding their function is important for setting up levels and ensuring game content is correctly loaded and accessed.
