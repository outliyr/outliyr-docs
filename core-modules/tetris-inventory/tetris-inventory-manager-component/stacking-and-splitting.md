# Stacking & Splitting

While the base inventory system handles the concept of item stacks via StatTags and `MaxStackSize`, the `ULyraTetrisInventoryManagerComponent` provides specific functions to manage stacking and splitting directly within the grid context, often used during drag-and-drop operations.

### Combining Stacks (`CombineItemStack`)

This function attempts to merge two separate stacks of the _same item type_ when one is dropped onto the other within the grid.

<!-- tabs:start -->
#### **C++**
```cpp
/**
 * Attempts to combine two item stacks of the SAME item definition within the grid.
 * Merges SourceInstance's stack count into DestinationInstance up to its MaxStackSize.
 *
 * @param DestinationInstance The item instance being dropped onto (target).
 * @param SourceInstance The item instance being dragged/dropped (source).
 * @return True if any amount was successfully transferred/combined, false otherwise (e.g., different item types, destination full).
 */
UFUNCTION(BlueprintCallable, Category=Inventory)
UPARAM(DisplayName = "SuccessfullyCombined") bool CombineItemStack(
    ULyraInventoryItemInstance* DestinationInstance,
    ULyraInventoryItemInstance* SourceInstance
);
```


#### **Blueprints**
<img src=".gitbook/assets/image (146).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Validation:** Checks if both `DestinationInstance` and `SourceInstance` are valid.
2. **Type Check:** Verifies if `DestinationInstance->GetItemDef() == SourceInstance->GetItemDef()`. If not, returns `false` (cannot combine different items with this function).
3. **Get Max Stack Size:** Retrieves the `MaxStackSize` from the item's `InventoryFragment_InventoryIcon`. Fails if the fragment is missing.
4. **Calculate Transfer Amount:**
   * Gets the current stack counts of both instances (`DestinationStackCount`, `SourceStackCount`) using `GetStatTagStackCount(TAG_Lyra_Inventory_GridItem_Count)`.
   * Calculates the available space in the destination stack: `AvailableSpace = MaxStackSize - DestinationStackCount`.
   * Determines the actual amount to transfer: `AmountToTransfer = FMath::Min(SourceStackCount, AvailableSpace)`.
5. **Check if Transfer Possible:** If `AmountToTransfer <= 0` (destination stack is already full), returns `false`.
6. **Update Destination:** Calls `UpdateItemCount(DestinationInstance, AmountToTransfer, true)` to add the transferred amount to the destination stack.
7. **Update Source:**
   * If `AmountToTransfer < SourceStackCount` (only part of the source was transferred), calls `UpdateItemCount(SourceInstance, AmountToTransfer, false)` to decrease the source stack count.
   * If `AmountToTransfer == SourceStackCount` (the entire source stack was transferred), it finds the source item's grid slot (`GetCurrentSlot`, `FindUIGridCell`) and calls `RemoveItemFromSlot(SourceRootSlotIndex, 0, true)` to completely remove the source item instance from the grid and the inventory list.
8. **Return:** Returns `true` indicating a successful combination/transfer.

**Use Case:** Typically called by `MoveItemInternally` when an item is dropped onto another occupied slot containing the exact same item type.

### Splitting Stacks (`SplitItemStack`)

This function allows taking a portion of an existing item stack and placing it into a new, empty slot within the same inventory grid.

<!-- tabs:start -->
#### **C++**
```cpp
/**
 * Attempts to split a specified amount from an item stack into a new, empty slot in the inventory.
 *
 * @param ItemInstance The item instance stack to split FROM.
 * @param AmountToSplit The number of units to remove and place in a new stack.
 * @return True if the split was successful (found an empty slot and placed the split amount), false otherwise.
 */
UFUNCTION(BlueprintCallable, Category=Inventory)
UPARAM(DisplayName = "SuccessfullySplit") bool SplitItemStack(
    ULyraInventoryItemInstance* ItemInstance,
    int32 AmountToSplit
);
```


#### **Blueprints**
<img src=".gitbook/assets/image (147).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Validation:** Checks if `ItemInstance` is valid and `AmountToSplit` is positive.
2. **Check Split Amount:** Gets the `CurrentStackCount` of `ItemInstance`. If `AmountToSplit >= CurrentStackCount`, returns `false` (cannot split the whole stack or more).
3. **Find Empty Slot:** Calls `FindAvailableSlotsForItem` for the `ItemInstance->GetItemDef()`, requesting space for at least 1 unit (`AmountToFind = 1`) and searching _only_ empty slots (`bSearchStacks = false`).
4. **Check Availability:** If `FindAvailableSlotsForItem` returns an empty array (no suitable empty slots found), returns `false`.
5. **Perform Split:**
   * Calls `RemoveItem(ItemInstance, AmountToSplit, false)` on the original item stack. This decreases the original stack's count and returns a _new temporary `ULyraInventoryItemInstance`_ (`SplitItemInstance`) representing the removed portion, containing `AmountToSplit` units.
   * Gets the details of the first available empty slot found (`AvailableSlot[0]`).
   * Calls `TryAddItemInstanceToSlot` to place the `SplitItemInstance` into the `AvailableSlot` location and rotation.
6. **Return:** Returns `true` if `TryAddItemInstanceToSlot` succeeded in placing the split portion, `false` otherwise (e.g., the slot became occupied between finding and placing, which is unlikely in typical scenarios but possible).

**Use Case:** Often triggered by a specific UI action like Shift+Dragging an item stack, indicating the intent to split off a certain quantity into a new location.

These functions provide targeted control over stack manipulation within the grid, complementing the more general movement functions by handling the specific cases of merging identical items and splitting existing stacks into new grid locations.
