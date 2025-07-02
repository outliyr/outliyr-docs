# Resizing the Inventory

In some scenarios, you might want to dynamically change the layout of a Tetris inventory at runtime. This could be due to gameplay events, upgrades, or other dynamic factors. The `ULyraTetrisInventoryManagerComponent` provides a mechanism to handle this resizing, including attempting to refit existing items into the new layout.

### The `ResizeInventory` Function

This is the primary function for initiating a layout change.

<!-- tabs:start -->
#### **C++**
```cpp
/**
 * Attempts to resize the inventory grid based on a new layout definition.
 * Tries to refit existing items into the new layout using heuristics.
 *
 * @param NewInventoryLayout The desired new layout structure (array of FInventoryLayoutCreator).
 * @param bForce If true, the resize will proceed even if some items cannot be refit; unplaced items will be removed from the inventory. If false, the resize will be reverted if any item cannot be refit.
 * @param OutUnplacedItems (Output) If bForce is true, this array will be populated with items that could not be refit into the new layout and were subsequently removed.
 * @return True if the resize was successful (either all items fit, or bForce was true), false if the resize was reverted because items couldn't fit and bForce was false.
 */
UFUNCTION(BlueprintCallable, Category = Inventory)
bool ResizeInventory(
    const TArray<FInventoryLayoutCreator>& NewInventoryLayout,
    bool bForce,
    TArray<ULyraInventoryItemInstance*>& OutUnplacedItems
);
```


#### **Blueprints**
<img src=".gitbook/assets/image (151).png" alt="" title="">

<!-- tabs:end -->

**Key Parameters:**

* **`NewInventoryLayout`:** The target layout definition. This must be a valid layout (e.g., not empty).
* **`bForce`:** Controls the behavior when items don't fit:
  * `false`: "Safe Mode". If _any_ existing item cannot be placed into the new layout, the entire operation is cancelled, and the inventory reverts to its original layout and item positions. `OutUnplacedItems` will be empty. Returns `false`.
  * `true`: "Forced Mode". The resize proceeds regardless. Any items that cannot be placed in the new layout are added to `OutUnplacedItems` and then permanently removed from the inventory component (using `RemoveItemInstance`). Returns `true` even if items were removed.
* **`OutUnplacedItems`:** Output parameter populated only if `bForce` is true, containing references to items that were removed because they couldn't be refit.

**Important:** This function should generally be called on the **server (authority)** to ensure consistency. The layout change and item repositioning will then replicate to clients.

### Resizing Workflow

Calling `ResizeInventory` triggers the following sequence:

1. **Layout Change Check:** Calls `InventoryGrid.HasLayoutChanged(NewInventoryLayout)` to see if the new layout is actually different from the current one. If not, returns `true` immediately (no work needed).
2. **Backup State:** Stores the current `InventoryGrid.GridCells`, the current `InventoryLayout`, and the original grid location (`FInventoryAbilityData_SourceTetrisItem`) of each item currently in the inventory. This backup is crucial for potential reversion if `bForce` is false.
3. **Clear & Rebuild Grid:**
   * Calls `InventoryGrid.EmptyGridItems()` to clear all item references from the current grid cells (without destroying the items themselves).
   * Calls `InventoryGrid.PopulateInventoryGrid(NewInventoryLayout)` to rebuild the `GridCells` array and `GridCellIndexMap` based on the _new_ layout structure.
4. **Gather Items:** Collects all `ULyraInventoryItemInstance*` currently held in the base `InventoryList`.
5. **Refit Items (`TryFitItemsWithHeuristics`):** Attempts to place the gathered items back into the newly structured grid:
   * **Sorting:** Sorts the items to be placed, typically by area (largest first), to increase the chances of fitting complex shapes.
   * **Placement Attempt:** Iterates through each item. For each item, it iterates through every possible root cell and every allowed rotation in the _new_ layout, calling `CanPlaceItemInEmptySlot` to find the first valid placement.
   * **Placement:** If a valid spot is found, it calls `InventoryGrid.UpdateCellItemInstance` to place the item in the new grid.
   * **Tracking Unplaced:** If an item cannot be placed after checking all possible locations and rotations, it's added to a temporary `UnplacedItems` list.
6. **Handle Results:**
   * **If `!bForce` and `UnplacedItems.Num() > 0` (Failure in Safe Mode):**
     * The resize failed because not all items could fit.
     * Reverts the grid: Calls `InventoryGrid.EmptyGridItems()`, `InventoryGrid.SetEntries(OldGridCells)`, `InventoryGrid.PopulateGridCellIndexMap(OldInventoryLayout)`.
     * Restores original item positions by updating their `CurrentSlot` data using the backup.
     * Returns `false`.
   * **If `bForce` and `UnplacedItems.Num() > 0` (Forced Resize with Losses):**
     * Populates the output `OutUnplacedItems` with the items that couldn't fit.
     * Calls `RemoveItemInstance` for each item in `OutUnplacedItems` to permanently remove them from the inventory component.
     * Proceeds to commit changes (Step 7).
   * **If `UnplacedItems.Num() == 0` (Success):**
     * All items were successfully refit.
     * Proceeds to commit changes (Step 7).
7. **Commit Changes:**
   * Updates the component's replicated `InventoryLayout` property to `NewInventoryLayout`.
   * Marks the `InventoryGrid` dirty for replication (`InventoryGrid.MarkArrayDirty()`).
   * Broadcasts the `TAG_Lyra_Inventory_Message_InventoryResized` message locally on the server. (Clients will broadcast this message via `PostReplicatedReceive` when the layout change arrives).
   * Returns `true`.

### Heuristics (`TryFitItemsWithHeuristics`)

The success of refitting items depends heavily on the algorithm used. The default implementation (`TryFitItemsWithHeuristics`) uses a simple greedy approach:

1. Sort items largest area to smallest.
2. For each item, iterate through all possible empty root slots and allowed rotations.
3. Place the item in the _first_ valid spot found.

This is a relatively fast heuristic but is **not guaranteed to find a solution even if one exists**. It's possible that placing a large item early prevents smaller items from fitting later, whereas a different placement order might have worked. More complex algorithms (like backtracking or bin packing algorithms) could potentially find better solutions but would be significantly more computationally expensive.

### Use Cases

* **Inventory Upgrades:** A player acquires an upgrade that increases their backpack size. Call `ResizeInventory` with the new, larger layout (`bForce = false` is usually safe here as items should always fit in a larger space).
* **Temporary Effects:** A debuff temporarily shrinks inventory space. Call `ResizeInventory` with the smaller layout. Using `bForce = true` might eject items, or `bForce = false` could prevent the debuff if items don't fit. When the debuff expires, call `ResizeInventory` again with the original layout.
* **Dynamic Containers:** Containers whose size changes based on game state.

The `ResizeInventory` function provides a powerful way to dynamically alter inventory layouts, but careful consideration should be given to the `bForce` parameter and the potential limitations of the item refitting heuristic.
