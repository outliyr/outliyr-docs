# Item Movement

Moving items is a fundamental interaction in any inventory system. The `ULyraTetrisInventoryManagerComponent` provides specialized functions for moving items spatially, both within the same grid and between different Tetris inventories, ensuring grid rules are respected.

### Moving Items Within the Same Inventory (`MoveItemInternally`)

This function handles the logic when a player drags and drops an item from one slot to another _within the same_ inventory grid.

<!-- tabs:start -->
#### **C++**
```cpp
/**
 * Moves an item from a source slot to a destination slot within the same inventory grid.
 * Handles stacking, combining, or placing in empty slots based on the destination.
 *
 * @param SourceSlot The coordinate of the item's root cell to move FROM.
 * @param SourceClump The clump ID of the source slot.
 * @param DestinationSlot The coordinate of the root cell to move TO.
 * @param DestinationClump The clump ID of the destination slot.
 * @param NewRotation The desired rotation for the item at the destination.
 * @return True if the move (or a resulting combination/stack) was successful, false otherwise.
 */
UFUNCTION(BlueprintCallable, Category=Inventory)
bool MoveItemInternally(
    const FIntPoint& SourceSlot,
    int32 SourceClump,
    const FIntPoint& DestinationSlot,
    int32 DestinationClump,
    EItemRotation NewRotation
);
```


#### **Blueprint**
<img src=".gitbook/assets/image (27).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Get Source Item:** Finds the `SourceCellIndex` and retrieves the `SourceItemInstance` using `GetItemInstanceFromSlot`. Fails if the source slot is empty or invalid.
2. **Get Destination State:** Finds the `DestinationCellIndex`.
3. **Self-Move Check:** If `SourceCellIndex == DestinationCellIndex`, the item is dropped onto itself. Currently, this is treated as a successful "no-op" and returns `true`. (Future logic could allow rotating in place here).
4. **Destination Occupied?** Checks if the `DestinationCellIndex` is occupied (`DestinationCellInfo.RootSlot != FIntPoint(-1)`).
   * **If Occupied:**
     * Gets the `DestinationItemInstance` by finding its root cell.
     * **Self-Interact Check:** If `SourceItemInstance == DestinationItemInstance`, treats it like dropping onto an empty part of its own occupied space. Calls internal helper `CanMoveItem` to check if the shape fits at the new location/rotation (ignoring itself) and performs the move if valid.
     * **Same Item Type:** If `SourceItemInstance->GetItemDef() == DestinationItemInstance->GetItemDef()`, attempts to stack the items using `CombineItemStack`. Returns the result.
     * **Different Item Types:** Attempts to combine the items using `CombineDifferentItems` (which delegates to fragments on the `DestinationItemInstance`). Returns the result.
   * **If Empty:**
     * Calls internal helper `CanMoveItem` to check if the `SourceItemInstance` fits at the `DestinationSlot` with `NewRotation` (ignoring itself).
     * If it fits, `CanMoveItem` internally calls `InventoryGrid.UpdateCellItemInstance` twice: once to clear the source slot (`nullptr`), and once to place the item in the destination slot with the `NewRotation`.
     * Returns `true` if `CanMoveItem` succeeded, `false` otherwise (e.g., no space).

**Internal Helper (`CanMoveItem` - Conceptual):**

* Takes source index, destination index, destination clump/slot, new rotation.
* Uses `CanPlaceItemInEmptySlot` (ignoring the source item) to check if the destination is valid spatially.
* If valid, calls `InventoryGrid.UpdateCellItemInstance(SourceIndex, nullptr)` and `InventoryGrid.UpdateCellItemInstance(DestIndex, ItemToMove, NewRotation)`.
* Returns `true` if placed, `false` otherwise.

### Moving Items Between Inventories (`MoveItemExternally`)

This function handles moving an item from this inventory grid to a slot in a _different_ `ULyraTetrisInventoryManagerComponent`.

<!-- tabs:start -->
#### **C++**
```cpp
/**
 * Moves an item from this inventory to a destination slot in another Tetris inventory.
 * Handles stacking, combining, or placing in empty slots based on the destination.
 *
 * @param SourceSlot The coordinate of the item's root cell in THIS inventory.
 * @param SourceClump The clump ID of the source slot in THIS inventory.
 * @param DestinationSlot The target coordinate in the DestinationInventory.
 * @param DestinationClump The target clump ID in the DestinationInventory.
 * @param NewRotation The desired rotation for the item at the destination.
 * @param DestinationInventory The target Tetris inventory component.
 * @return True if the move (or a resulting combination/stack) was successful, false otherwise.
 */
UFUNCTION(BlueprintCallable, Category=Inventory)
bool MoveItemExternally(
    const FIntPoint& SourceSlot,
    int32 SourceClump,
    const FIntPoint& DestinationSlot,
    int32 DestinationClump,
    EItemRotation NewRotation,
    ULyraTetrisInventoryManagerComponent* DestinationInventory
);
```


#### **Blueprints**
<img src=".gitbook/assets/image (28).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Get Source Item:** Finds the `SourceCellIndex` and retrieves the `SourceItemInstance` from _this_ inventory. Fails if empty/invalid.
2. **Validate Destination:** Checks if `DestinationInventory` is valid and finds the `DestinationCellIndex` within it. Fails if invalid.
3. **Check Destination Occupancy:** Gets the `FoundItemInstance` (if any) occupying the root of the `DestinationCellIndex` in the `DestinationInventory`.
4. **Different Item Type at Destination:** If `FoundItemInstance` exists and is a _different_ type than the `SourceItemInstance`:
   * Attempts to combine using `CombineDifferentItems` (delegating to fragments on `FoundItemInstance`).
   * Returns the result of the combination attempt.
5. **Same Item Type or Empty Destination:**
   * **Check Destination Constraints:** Calls `DestinationInventory->CanAddItem` to verify if the `SourceItemInstance` can fundamentally be added (checking weight, count, type filters, _parent constraints_ of the _destination_). Fails if `AmountAllowed` is 0.
   * **If Stacking (Destination Occupied by Same Type):**
     * Calculates remaining stack space in `FoundItemInstance` (up to `MaxStackSize`).
     * Determines `AmountToTransfer` (min of `AmountAllowed` and remaining stack space). Fails if 0.
     * Calls `UpdateItemCount` on `FoundItemInstance` in the `DestinationInventory` to add the `AmountToTransfer`.
     * Calls `UpdateItemCount` on `SourceItemInstance` in _this_ inventory to remove the `AmountToTransfer` **OR** calls `RemoveItemFromSlot` on the `SourceCellIndex` to completely remove the source item if `AmountToTransfer` equals the source's initial amount.
     * (Optional) Broadcasts "Item Obtained" message on the `DestinationInventory` if it's a different root inventory.
     * Returns `true`.
   * **If Placing in Empty Slot:**
     * Uses `DestinationInventory->CanPlaceItemInEmptySlot` to check if the `SourceItemInstance` fits spatially at the `DestinationSlot` with `NewRotation`. Fails if it doesn't fit.
     * Calls `RemoveItemFromSlot` on the `SourceCellIndex` in _this_ inventory to get the `RemovedItemInstance` (potentially a split portion or the original, ensuring `bDestroy=false`).
     * Calls `DestinationInventory->AddItemInstanceToSlot` to place the `RemovedItemInstance` in the destination grid.
     * (Optional) Broadcasts "Item Obtained" message.
     * Returns `true`.

**Key Differences:**

* **Internal:** Operates entirely within `this` component's grid. Combines/stacks occur directly. Movement uses `UpdateCellItemInstance` on both source and destination within the same `InventoryGrid`.
* **External:** Involves two separate `ULyraTetrisInventoryManagerComponent` instances. Requires checking constraints (`CanAddItem`) on the _destination_ inventory. Transfer involves removing the item instance from the source (`RemoveItemFromSlot`) and adding it to the destination (`AddItemInstanceToSlot` or `UpdateItemCount`). Combination logic still applies based on the destination slot's state.

These movement functions provide the core logic for drag-and-drop interactions within and between Tetris inventories, handling the necessary spatial checks, stacking, and combination attempts. Remember that these should typically be called on the server, triggered via the GAS layer from client UI actions.
