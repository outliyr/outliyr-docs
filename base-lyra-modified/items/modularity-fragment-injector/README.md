# Modularity: Fragment Injector

As your project grows, especially when incorporating plugins or Unreal Engine's Game Features, you might encounter a common challenge: how do you add or remove functionality (represented by `ULyraInventoryItemFragment`s) to _existing_ `ULyraInventoryItemDefinition`s without directly modifying those original base assets? Modifying base assets shipped with core systems or other plugins can lead to merge conflicts and maintenance headaches.

The **Fragment Injector** system provides an elegant solution to this problem, allowing you to **dynamically inject new fragments into, or remove existing fragments from, item definitions at runtime**, decoupling feature additions/removals from the base item assets.

<img src=".gitbook/assets/image (71).png" alt="" width="375" title="Example of injecting a battle royale category to a weapon">

### Purpose: Decoupling & Extensibility

The primary goal of the Fragment Injector is to:

* **Enhance Modularity:** Allow separate plugins or game features to add their specific fragments (e.g., a "Decay" fragment from a survival plugin) or remove existing ones (e.g., remove a "FastReload" fragment in a hardcore mode) from items defined elsewhere.
* **Decouple Dependencies:** The base item definition doesn't need any knowledge of the fragments being injected or removed by external features.
* **Avoid Base Asset Modification:** Prevents the need to edit core `ULyraInventoryItemDefinition` assets directly.
* **Enable Optional Features:** Players might enable/disable certain game features, and the injector system ensures the relevant fragments are added or removed accordingly at runtime to tailor item behavior.

### Core Concept: Runtime Injection

The system works based on these principles:

1. **Injection/Removal Definition (`UFragmentInjector`):** You create Data Assets derived from `UFragmentInjector`. Each asset specifies:
   * Which target `ULyraInventoryItemDefinition` class it affects.
   * **Either:**
     * Which `ULyraInventoryItemFragment`(s) should be injected (added or replacing existing ones based on `OverrideIndex`).
   * **Or:**
     * Which `ULyraInventoryItemFragment` class should be _removed_ from the target definition.
2. **Runtime Application (`UFragmentInjectorManager`):** A manager class (`UFragmentInjectorManager`) is responsible for finding these `UFragmentInjector` assets at runtime (e.g., when an experience loads or a game feature is activated/deactivated).
3. **CDO Modification:** The manager _modifies the Class Default Object (CDO)_ of the target `ULyraInventoryItemDefinition` by adding or removing the specified fragments from its `Fragments` array. Since item instances are created based on the CDO, newly created instances will reflect these changes.
4. **Temporary Change:** These modifications to the CDO are **runtime-only**.
5. **Restoration:** The system includes logic (`RestoreOriginalFragments`) to revert the CDO modifications when the game ends or the relevant context is unloaded.

**Analogy:** Imagine a car blueprint (`ULyraInventoryItemDefinition`). A separate "Turbocharger" plugin wants to add a turbo to specific car models without editing the original blueprints. The plugin provides an "Injector Spec" (`UFragmentInjector`) saying "Add Turbocharger Part (`ULyraInventoryItemFragment`) to Blueprint 'SportsCarModel'". At runtime, when the plugin is active, a mechanic (`UFragmentInjectorManager`) temporarily adds the "Turbocharger Part" to the 'SportsCarModel' blueprint's parts list before building any new cars. When the plugin is deactivated, the mechanic removes the temporary addition from the blueprint.

### Key Components

* **`UFragmentInjector` (Data Asset):** Defines _what_ fragments to inject/remove into/from _which_ item definition.
* **`UFragmentInjectorManager` (UObject):** Orchestrates the process of finding and applying `UFragmentInjector` assets at runtime and restoring the original state.

### Benefits

* True decoupling of features from base item definitions.
* Enhanced support for modular game design using Plugins and Game Features.
* Avoids modification of shared or engine-level assets.
* Allows optional features to cleanly add _or remove_ behavior from existing items.

### Structure of this Section

The following pages will detail the components and usage of this system:

* **Concept & Use Case:** Delving deeper into the problem solved and example scenarios.
* **Components (`UFragmentInjector` & `UFragmentInjectorManager`):** Detailed explanation of the Data Asset properties and the Manager's logic.

***

This overview introduces the Fragment Injector as a powerful tool for achieving runtime modularity in your item system, allowing features to dynamically enhance existing items without direct modification of their base definitions.
