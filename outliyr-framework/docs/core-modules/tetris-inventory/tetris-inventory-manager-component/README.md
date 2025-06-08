# Tetris Inventory manager Component

The `ULyraTetrisInventoryManagerComponent` is the central component responsible for managing items within a spatial, grid-based inventory. It extends the functionality of the base `ULyraInventoryManagerComponent`, adding the necessary logic to handle grid layouts, item shapes, rotations, and placement within a defined 2D space.

### Overview & Inheritance

* **Inheritance:** This component derives directly from `ULyraInventoryManagerComponent`. This means it inherits all the core features of the base inventory system, including:
  * Basic item storage (`FLyraInventoryList`).
  * Weight and global item count limits (`MaxWeight`, `ItemCountLimit`).
  * Allowed/Disallowed item type filtering.
  * Network replication of items and core properties.
  * Access Rights and Permissions management.
  * Integration with the GAS layer via Gameplay Messages and Abilities.
* **Core Addition: Spatial Awareness:** The key difference is that `ULyraTetrisInventoryManagerComponent` introduces **spatial awareness**. It doesn't just track _what_ items are present, but _where_ they are located within a configurable 2D grid layout, considering their shape and rotation.

### Key Functionalities Added

Building upon the base component, `ULyraTetrisInventoryManagerComponent` adds specific capabilities for grid management:

* **Grid Representation:** Manages the inventory grid structure (`FGridCellInfoList`), mapping grid coordinates to item instances and their states (rotation, root cell).
* **Layout Definition:** Configured via the `InventoryLayout` property (using `FInventoryLayoutCreator` structs) to define complex grid shapes.
* **Spatial Placement:** Implements logic (`FindAvailableSlotsForItem`, `CanPlaceItemInEmptySlot`) to find valid locations where an item's shape (considering its rotation) fits within the grid layout without overlapping other items.
* **Grid-Specific Operations:** Provides functions to add/remove items directly to/from specific grid coordinates (`TryAddItem...ToSlot`, `RemoveItemFromSlot`).
* **Item Movement:** Handles moving items both within the same grid (`MoveItemInternally`) and between different Tetris inventories (`MoveItemExternally`), respecting spatial constraints.
* **Container Nesting:** Supports hierarchical inventories where items with the `InventoryFragment_Container` can contain child `ULyraTetrisInventoryManagerComponent` instances. It manages the propagation of weight/count constraints up the hierarchy.
* **Resizing:** Allows dynamically changing the inventory layout at runtime (`ResizeInventory`) and attempts to refit existing items.

### Relationship to Base Component

It's crucial to understand that the Tetris component **augments, not replaces,** the base functionality:

* **Dual Storage:** It maintains _both_ the base `FLyraInventoryList` (for tracking all item instances present) _and_ the `FGridCellInfoList` (for spatial grid information). These are kept synchronized.
* **Base Limits Still Apply:** The standard `MaxWeight`, `ItemCountLimit`, and item type filtering rules from the base component are still enforced _in addition_ to the spatial constraints of the grid.
* **Base Fragments Needed:** Items intended for the Tetris grid generally still require base fragments like `InventoryFragment_InventoryIcon` (for stacking rules, base weight/count contribution) alongside the `InventoryFragment_Tetris` (for shape).
* **GAS Integration:** Uses the same GAS layer and `UInventoryAbilityFunctionLibrary` as the base system. The key difference is the use of `FInventoryAbilityData_SourceTetrisItem` to specify grid locations in GAS event payloads.

### Structure of this Section

This section dives deep into the `ULyraTetrisInventoryManagerComponent`. The following subpages provide detailed explanations:

1. **Grid Representation (`FGridCellInfoList`):** How the grid state is stored and replicated.
2. **Configuration & Initialization:** Setting up the component's layout, limits, and starting items.
3. **Adding & Removing Items (Grid Logic):** Grid-aware item addition and removal functions.
4. **Spatial Placement & Querying:** Finding space and checking grid locations.
5. **Item Movement (Internal & External):** Moving items within and between grids.
6. **Stacking & Splitting (Grid Context):** Combining and splitting item stacks on the grid.
7. **Container Integration (Parent/Child):** Managing nested inventories and constraint propagation.
8. **Access Rights & Permissions (Tetris Context):** How permissions work with nested inventories.
9. **Resizing the Inventory:** Dynamically changing the grid layout.

By exploring these subpages, you'll gain a comprehensive understanding of how to configure, interact with, and leverage the spatial capabilities of the `ULyraTetrisInventoryManagerComponent`.
