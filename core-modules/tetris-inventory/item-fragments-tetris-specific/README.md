# Item Fragments (Tetris Specific)

Item Fragments are the modular building blocks that define an item's behavior and properties. While the Tetris Inventory system relies heavily on fragments defined in the base Lyra system (like `InventoryFragment_InventoryIcon` and `InventoryFragment_SetStats`), it also introduces new fragments and significantly enhances others to enable its unique spatial and interactive features.

This section focuses on these **Tetris-specific fragments**. It details how they configure items for grid interaction, enable container nesting, facilitate item combining, and provide data for the 3D inspection system.

### Prerequisite: Understanding Base Fragments

Before diving into the specifics below, it's essential to understand the fundamental concepts of the Item Fragment system established in the base Lyra inventory:

* **What Fragments Are:** Reusable UObjects added to Item Definitions to compose functionality.
* **Static vs. Instance Data:** How fragments define static data and can provide templates for instance-specific data.
* **Transient Data:** The mechanisms for storing instance-specific data:
  * `FTransientFragmentData` (Struct-based, lightweight).
  * `UTransientRuntimeFragment` (UObject-based, full features like replication/BP exposure).
* **Core Fragment Functions:** Key virtual functions like `OnInstanceCreated`, `CreateNewTransientFragment`, `GetWeightContribution`, etc.

**Please review the** [**Item Fragments Documentation**](../../../base-lyra-modified/items/items-and-fragments/item-fragments.md) **for a detailed explanation of these core concepts before proceeding.**

### Tetris-Specific Fragments Overview

The following subpages detail the fragments crucial for the Tetris Inventory system:

1. **`InventoryFragment_Tetris`:**
   * **Purpose:** Defines the fundamental spatial footprint (Shape) of an item on the grid. Essential for any item intended to be placed spatially.
2. **`InventoryFragment_Combine`:**
   * **Purpose:** Enables items to define recipes for combining with other specific items when dropped onto each other within the grid.
   * **Functionality:** Stores combination rules (required ingredients, resulting item) and implements the `CombineItems` logic to execute the combination process, including consuming ingredients and attempting to place the result.
3. **`InventoryFragment_Container`:**
   * **Purpose:** Allows an item instance to host its own nested `ULyraTetrisInventoryManagerComponent`. This is the key to creating backpacks, cases, etc.
   * **Functionality:** Defines the child inventory's layout and rules. Creates and manages the child component via `FTransientFragmentData_Container`. Handles moving items _into_ the container and manages the parent-child relationship for constraint propagation.
4. **`InventoryFragment_Inspect`:**
   * **Purpose:** Provides the necessary configuration data (meshes, rotation/zoom limits, FOV) for displaying an item in the 3D Item Inspection system (which uses PocketWorlds).
   * **Functionality:** Holds static and skeletal mesh references, camera control parameters, and settings for generating cached icon snapshots.

By combining these fragments (along with necessary base fragments like `InventoryFragment_InventoryIcon`), you can create items with complex spatial behaviors, nested storage, combination potential, and detailed 3D previews, fully leveraging the capabilities of the Tetris Inventory Plugin. Explore the subpages for detailed configuration and usage information for each fragment.
