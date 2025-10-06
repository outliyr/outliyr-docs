# Game Feature Actions

**Game Feature Actions** are the primary mechanism by which a Game Feature Plugin injects logic and integrates itself into the running game during its activation and deactivation lifecycle. They are UObject classes, typically defined within a Game Feature Plugin, that perform specific setup or teardown tasks.

<img src=".gitbook/assets/image (117).png" alt="" title="List of the available gameplay actions">

### Concept: Actions Triggered by State Changes

* **Purpose:** To execute specific code or apply configurations when a Game Feature is loaded, activated, deactivated, or unloaded.
* **Definition:** Actions are defined as assets (usually Blueprint classes inheriting from a `UGameFeatureAction` base, like `UGameFeatureAction_WorldActionBase` or specific action types) or added directly as instanced objects within `ULyraExperienceDefinition` or `ULyraExperienceActionSet` assets. Some actions might also be automatically discovered and run based on entries in the `.uplugin` file, though Lyra often uses explicit definition in Experiences/ActionSets.
* **Execution Context:** Actions are executed by the `ULyraExperienceManagerComponent` during the Experience loading/unloading process. They receive a context object (`FGameFeatureActivatingContext` or `FGameFeatureDeactivatingContext`) which provides information about the transition, including potentially restricting the action to specific world contexts.

### Lifecycle Hooks

`UGameFeatureAction` provides several virtual functions that are called at different points in the Game Feature lifecycle:

* `OnGameFeatureRegistering()`: Called when the plugin is registered with the subsystem. Often used for early, process-wide setup (like adding input mapping contexts to the settings registry).
* `OnGameFeatureLoading()`: Called when the plugin begins loading assets.
* `OnGameFeatureActivating(FGameFeatureActivatingContext& Context)`: **The primary setup hook.** Called when the plugin (and thus the Experience requiring it) is fully loaded and activating. This is where most actions perform their main logic, like adding abilities, widgets, or input bindings to the appropriate actors/subsystems within the world specified by the `Context`.
* `OnGameFeatureDeactivating(FGameFeatureDeactivatingContext& Context)`: **The primary teardown hook.** Called when the plugin (and Experience) is deactivating. Actions should reverse any changes made during activation (e.g., remove abilities, widgets, input bindings).
* `OnGameFeatureUnregistering()`: Called when the plugin is unregistered. Used for final process-wide cleanup (like unregistering input mapping contexts).

### `UGameFeatureAction_WorldActionBase`

Because many actions need to interact with specific game worlds (e.g., finding Player Controllers, Pawns, or specific subsystems), a common base class `UGameFeatureAction_WorldActionBase` is provided.

* **Purpose:** Simplifies actions that need to operate within one or more specific `UWorld` contexts.
* **Mechanism:**
  * Overrides `OnGameFeatureActivating` to register a listener for the `FWorldDelegates::OnStartGameInstance` delegate.
  * Also iterates through already existing `FWorldContext`s.
  * When a relevant Game Instance starts (or for existing ones), it calls the pure virtual function `AddToWorld(const FWorldContext& WorldContext, const FGameFeatureStateChangeContext& ChangeContext)`.
  * Overrides `OnGameFeatureDeactivating` to clean up the listener.
* **Usage:** Derived classes implement `AddToWorld` to contain their world-specific setup logic, which will then be automatically executed for each relevant world context the Game Feature is activated within. Many of the specific action types (like AddWidgets, AddAbilities) inherit from this base class.

### Common Action Types (Detailed on Sub-Pages)

This asset utilizes several specific Game Feature Action types to perform common setup tasks. Each will be detailed on its own sub-page or section:

1. **\[Engine Code]** [**Add Component**](add-components.md) **(`GameFeatureAction_AddComponents`) :** Adds components to specified actors only on the client or server.
2. [**Add Abilities**](add-abilities.md) **(`UGameFeatureAction_AddAbilities`):** Grants Gameplay Abilities, Ability Sets, and Attribute Sets to specified Actor classes (typically Pawns or Player States).
3. [**Add Input Binding**](add-input-binding.md) **(`UGameFeatureAction_AddInputBinding`):** Adds `ULyraInputConfig` assets (mapping input tags to gameplay ability tags) to Pawns.
4. [**Add Input Mapping Context**](add-input-mapping-context.md) **(`UGameFeatureAction_AddInputContextMapping`):** Adds Enhanced Input `UInputMappingContext` assets to local players.
5. [**Add Widgets**](add-widgets.md) **(`UGameFeatureAction_AddWidgets`):** Adds UI layouts and widgets to the player's HUD using the Common UI and UI Extension subsystems.
6. [**Add Gameplay Cue Path**](add-gameplay-cue-path.md) **(`UGameFeatureAction_AddGameplayCuePath`):** Registers directory paths with the Gameplay Cue Manager to allow discovery of Gameplay Cue Notifies.
7. [**Splitscreen Config**](splitscreen-config.md) **(`UGameFeatureAction_SplitscreenConfig`):** A simple example action demonstrating how to modify world or viewport settings.

***

Game Feature Actions are the executable components within Game Feature Plugins, triggered by the Experience loading lifecycle managed by `ULyraExperienceManagerComponent`. They provide the crucial link for modularly adding specific functionality, like abilities, input, and UI to the game world based on the currently active Experience. The following pages detail the specific actions commonly used in this asset.
