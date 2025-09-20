# Game Features

This asset leverages Unreal Engine's built-in **Game Features Plugin** system extensively to achieve a highly modular and extensible architecture. Instead of compiling all gameplay logic and content into a monolithic game module, distinct features (like core shooting mechanics, specific game modes, UI elements, or inventory extensions) can be developed and packaged as separate Game Feature Plugins.

The [**Experience System**](../experience-primary-assets/) (covered previously) acts as the primary driver for activating these features, ensuring that only the necessary plugins and their associated content/logic are loaded for a given gameplay session.

### Purpose: Modular Content & Logic Delivery

Integrating with Game Features provides several key advantages:

* **Modularity:** Encapsulate distinct gameplay systems (e.g., CTF rules, Arena shop logic, Vehicle physics, Survival mechanics) into their own self-contained plugins.
* **Decoupling:** Plugins can depend on core systems (like the base Inventory or Equipment systems) but generally don't need direct dependencies on each other. Game Modes can depend on feature plugins without the core plugins needing to know about specific modes.
* **On-Demand Loading:** Only the features required by the currently active `ULyraExperienceDefinition` are loaded into memory, potentially reducing startup times and memory footprint compared to loading everything upfront.
* **Extensibility:** Makes it significantly easier to add new features or modify existing ones by adding or swapping out Game Feature plugins, often without touching the core game code. This is ideal for DLC, mods, or iterative development.
* **Clear Boundaries:** Enforces better code organization by grouping related assets and logic within their respective plugin directories.

### How it Works with Experiences

1. **Declaration:** An `ULyraExperienceDefinition` (and its included `ULyraExperienceActionSet`s) declares a list of required Game Feature plugin names in its `GameFeaturesToEnable` property.
2. **Activation Request:** When the `ULyraExperienceManagerComponent` begins loading an Experience, it gathers this list of required plugin names.
3. **Loading & Activation:** It requests the `UGameFeaturesSubsystem` to load and activate each required plugin. The subsystem handles locating the plugin, mounting its content (making assets inside visible to the engine), and registering it.
4. **Action Execution:** As part of the activation process, the `UGameFeaturesSubsystem` triggers **Game Feature Actions** (`UGameFeatureAction`) defined within the activated plugin's `uplugin` file or associated Asset Manager settings.
5. **Actions Modify State:** These Actions execute their logic, often configuring the game world based on the newly loaded feature (e.g., adding abilities, input mappings, widgets, registering systems). The `ULyraExperienceManagerComponent` ensures these actions run within the correct world context.
6. **Deactivation:** When an Experience is unloaded (or the game ends), the `ULyraExperienceManagerComponent` notifies the `UGameFeaturesSubsystem` to deactivate the associated plugins, triggering their deactivation Actions for cleanup.

### Key Concepts & Components

* **Game Feature Plugin:** A specialized Unreal Engine plugin containing gameplay logic and/or content, managed by the `UGameFeaturesSubsystem`.
* **Game Feature Action (`UGameFeatureAction`):** A class type defined within a Game Feature plugin that executes specific code hooks during the plugin's activation and deactivation lifecycle. This is the primary mechanism for a feature to integrate itself into the running game.
* **`ULyraExperienceManagerComponent`:** Orchestrates the loading and activation of Game Features based on the current Experience.
* **`ULyraGameFeaturePolicy`:** A project-specific class that can override default Game Feature subsystem behaviors (loading modes, observers).
* **`ULyraExperienceManager` (Engine Subsystem):** A simple manager primarily used to handle PIE activation counts for Game Features.

### Structure of this Section

This section explores the integration in detail:

* **Activation Flow (`ULyraExperienceManagerComponent`):** How the component manages loading, activating, and unloading Game Features tied to Experiences.
* **Game Feature Actions (`UGameFeatureAction`):** The concept of actions and detailed explanations of common action types used in this asset (Add Abilities, Add Input, Add Widgets, etc.).
* **Supporting Systems (`ULyraGameFeaturePolicy`, `ULyraExperienceManager`):** Brief details on the policy overrides and PIE management subsystem.

***

Understanding how Experiences drive the activation of modular Game Features via Actions is fundamental to customizing and extending this asset. This system allows for a clean separation of concerns and enables powerful, data-driven control over which gameplay elements are active during any given session.
