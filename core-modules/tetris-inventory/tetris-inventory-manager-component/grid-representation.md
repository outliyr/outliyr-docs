# Grid Representation

The core of the `ULyraTetrisInventoryManagerComponent`'s spatial awareness lies in how it represents the state of its grid internally. This is primarily handled by the `FGridCellInfoList` struct, which manages an array of `FGridCellInfo` structs, one for each _accessible_ cell defined in the `InventoryLayout`.

### `FGridCellInfo` Struct

Each individual cell within the accessible parts of the inventory grid is represented by an `FGridCellInfo` struct.

**Key Members Explained:**

* **`Position`:** The (X, Y) coordinate of _this specific cell_ relative to the top-left corner of its parent `Clump`.
* **`ClumpID`:** The index of the `FInventoryLayoutCreator` clump this cell belongs to in the `InventoryLayout` array. `Position` and `ClumpID` together uniquely identify a cell.
* **`ItemInstance`:** If this cell is the **root** placement location for an item, this pointer references the actual `ULyraInventoryItemInstance`. If the cell is empty or occupied by a non-root part of an item, this is `nullptr`.
* **`Rotation`:** If this cell is the root (`ItemInstance != nullptr`), this stores the `EItemRotation` of the placed item.
* **`RootSlot`:** This is crucial for spatial lookups.
  * If this cell is **empty**, `RootSlot` is `FIntPoint(-1)`.
  * If this cell is **occupied**, `RootSlot` stores the grid `Position` of the item's **root cell**, even if this cell _is_ the root.
  * This allows any occupied cell to directly identify and access the root cell that holds the actual `ItemInstance` pointer.
* **`SlotTags`:** A container for adding gameplay tags directly to grid cells, allowing for specialized cell behaviors (though usage examples might depend on custom game logic).

### `FGridCellInfoList` Struct

This struct manages the collection of `FGridCellInfo` entries and handles their replication.

**Key Aspects of `FGridCellInfoList`:**

* **Flat Array (`GridCells`):** Stores only the _accessible_ cells. This keeps the array size manageable even for large, sparse layouts.
* **Fast Array Serializer:** Efficiently replicates changes to the `GridCells` array, only sending deltas (added, removed, changed items).
* **Coordinate Lookup (`GridCellIndexMap`):** The `GridCellIndexMap` is crucial for performance. Instead of linearly searching `GridCells` every time you need the info for `ClumpID=1, Position=(5,3)`, you can directly access `GridCellIndexMap[1][3][5]` to get the correct index into `GridCells`. This map is rebuilt on clients when the grid layout changes (`PostReplicatedReceive` checks `HasLayoutChanged`).
* **Updating Cells (`UpdateCellItemInstance`):** This is the primary function for placing or removing an item from a slot. It handles:
  * Setting the `ItemInstance` and `Rotation` on the root cell (`SlotIndex`).
  * Updating the `RootSlot` pointers on all _other_ cells covered by the item's shape (using `UpdateNonRootCells`) to point back to the root cell (or setting them to `-1` if removing the item).
  * Marking modified `FGridCellInfo` entries dirty for replication (`MarkItemDirty`).
  * Broadcasting the `TAG_Lyra_Inventory_Message_GridCellChanged` message.
*   **Gameplay Messages:**

    * `TAG_Lyra_Inventory_Message_GridCellChanged` (**`FGridInventoryChangedMessage`**): Broadcast whenever `UpdateCellItemInstance` or `UpdateNonRootCells` modifies a cell's state. UI listens to this to refresh individual slots or the whole grid. The `FGridInventoryChangedMessage` payload contains the full state of the changed cell.

    <img src=".gitbook/assets/image (17).png" alt="" width="563" title="">

    * `TAG_Lyra_Inventory_Message_InventoryResized` (**`FLyraVerbMessage`**): Broadcast by `PostReplicatedReceive` when `HasLayoutChanged` detects a change, signaling the UI that the entire grid structure needs to be rebuilt.

    <img src=".gitbook/assets/image (16).png" alt="" width="563" title="">

This combination of a replicated flat array (`GridCells`) and a non-replicated, client-rebuilt coordinate lookup map (`GridCellIndexMap`) provides both network efficiency and fast runtime access to the state of each cell in the Tetris inventory grid.
