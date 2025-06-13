# InventoryFragment_Combine

This fragment allows you to define rules for combining the item it's attached to (the "target" item) with other specific items (the "incoming" item) when the incoming item is dropped onto the target item within a Tetris inventory grid. It facilitates crafting or transformation interactions directly within the inventory interface.

<img src=".gitbook/assets/image (10).png" alt="" width="563" title="">

### Purpose

* **Item Combination Recipes:** Define specific pairings of items that can be combined.
* **Ingredient Consumption:** Specify the required quantities of both the target and incoming items needed for a successful combination.
* **Result Definition:** Define the new item(s) created as a result of the combination.
* **Grid Interaction:** Integrates with the `ULyraTetrisInventoryManagerComponent` to handle the consumption of ingredients and the placement of the resulting item(s) within the grid, respecting spatial constraints.

### Configuration (`CombinationList`)

To define item combination rules, you'll configure the `CombinationList` property inside the `InventoryFragment_Combine`, which is added to the item that will **receive** the drop (the _target item_).

1. **Add the Fragment to the Target Item:**\
   Attach `InventoryFragment_Combine` to the `ULyraInventoryItemDefinition` of the item that acts as the base or container in the combination (i.e., the item another item will be dropped onto).
2. **Access the Combination List:**\
   In the Details panel, expand the `CombinationList` property to view or add combinations.
3. **Add a New Combination Entry:**\
   Click the **+** button to add a new entry to the `TMap`.
4. **Set the Incoming Item (Key):**\
   For the **Key**, select the `ULyraInventoryItemDefinition` of the item that will be dropped onto this one — this is the _incoming ingredient_.
5. **Define the Combination Details (Value):**\
   Fill out the `FItemCombinationDetails` for this item pairing:
   * **Target Item Required Quantity**: Number of units of the target item (the one owning the fragment) needed per combination.
   * **Incoming Item Required Quantity**: Number of units of the incoming item needed per combination.
   * **Resulting Item Definition**: The `ULyraInventoryItemDefinition` of the item to create when this combination occurs.
   * **Resulting Item Quantity**: How many units of the resulting item are produced from the combination.
6. **Repeat for Additional Combinations:**\
   Add additional entries to support other incoming items that can combine with this target item.

**Example:** Making a Health Potion (`ID_Potion_Health`) by dropping 5 Berries (`ID_Resource_Berry`) onto an Empty Bottle (`ID_Misc_EmptyBottle`).

* Add `InventoryFragment_Combine` to `ID_Misc_EmptyBottle`.
*   Configure `CombinationList`:

    * Add Entry:
      * Key: `ID_Resource_Berry`
      * Value (`FItemCombinationDetails`):
        * `Target Item Required Quantity`: 1 (Need 1 Empty Bottle)
        * `Incoming Item Required Quantity`: 5 (Need 5 Berries)
        * `Resulting Item Definition`: `ID_Potion_Health`
        * `Resulting Item Quantity`: 1 (Produces 1 Health Potion)

    <img src=".gitbook/assets/image (11).png" alt="" width="563" title="Example making a health potion">

### Runtime Logic (`CombineItems` Override)

The fragment's core logic resides in its override of the `ULyraInventoryItemFragment::CombineItems` virtual function. This function is called by `ULyraTetrisInventoryManagerComponent::MoveItemInternally` or `MoveItemExternally` when an item (`SourceInstance`) is dropped onto another item (`DestinationInstance`, which owns this fragment).

```cpp
virtual bool CombineItems(
    ULyraInventoryManagerComponent* SourceInventory,   // Inventory holding the incoming item
    ULyraInventoryItemInstance* SourceInstance,       // The incoming item instance
    ULyraInventoryManagerComponent* DestinationInventory, // Inventory holding the target item (this fragment's owner)
    ULyraInventoryItemInstance* DestinationInstance  // The target item instance (owner of this fragment)
) override;
```

**Workflow:**

1. **Check Compatibility:** Checks if the `SourceInstance->GetItemDef()` exists as a Key in the `CombinationList`. If not, returns `false` (no recipe defined for this pair).
2. **Get Details:** Retrieves the corresponding `FItemCombinationDetails` for the incoming item type. Validates the `ResultingItemDefinition`.
3. **Calculate Potential Yield:** Determines the maximum number of `ResultingItemQuantity` sets that _could_ be created based on the current stack counts of `SourceInstance` and `DestinationInstance` and the `RequiredQuantities`.
   * `SourceSets = SourceStackCount / IncomingItemRequiredQuantity`
   * `DestSets = DestinationStackCount / TargetItemRequiredQuantity`
   * `MaxSets = Min(SourceSets, DestSets)`
   * `AmountToCreate = MaxSets * ResultingItemQuantity`
   * If `AmountToCreate` is 0, returns `false` (not enough ingredients).
4. **Validate Resulting Item:** Ensures the `ResultingItemDefinition` has the necessary `InventoryFragment_InventoryIcon` and `InventoryFragment_Tetris` fragments (required for placement). Returns `false` if not.
5. **Simulate Consumption:** **Temporarily** reduces the stack counts on _both_ `SourceInstance` and `DestinationInstance` (using `UpdateItemCount`) by the amounts needed to create `AmountToCreate`. This doesn't destroy the items yet, just simulates their use for the placement check.
6. **Check Destination Space:** Calls `DestinationInventory->CanAddItem(AmountToCreate, ResultingItemDefinition)` to check if the _destination_ inventory (where the target item resides) can hold the resulting items (checking weight, count limits, etc.).
7. **Placement Attempt 1 (No Ignore):** If `CanAddItem` allows some amount (`AmountAllowed > 0`):
   * Calls `DestinationGridInventory->FindAvailableSlotsForItem` (searching _only_ empty slots) for the `ResultingItemDefinition`.
   * Attempts to place the `AmountAllowed` resulting items into these found slots using `TryAddItemDefinitionToSlot`. Keeps track of how many items still need placing (`Remaining`).
8. **Placement Attempt 2 (Ignore Consumed):** If `Remaining > 0` (not all results fit in initially empty slots):
   * Creates an `IgnoreItems` list. If the `SourceInstance` or `DestinationInstance` stack count was reduced to 0 during simulation, adds them to `IgnoreItems`.
   * Calls `DestinationGridInventory->FindAvailableSlotsForItem` again, but this time passes the `IgnoreItems` list. This allows placing the results in the grid cells _now vacated_ by the fully consumed ingredients.
   * Attempts to place the `Remaining` items using `TryAddItemDefinitionToSlot` in these newly found slots. Updates `Remaining`.
9. **Cleanup & Finalize:**
   * If `Remaining == AmountAllowed` (meaning _no_ resulting items could be placed at all, even after ignoring consumed items):
     * Calls `RestoreSimulatedItems` to add the temporarily reduced stack counts back to `SourceInstance` and `DestinationInstance`.
     * Returns `false`.
   * Otherwise (some items were placed):
     * Calls `CleanupOriginalItems`: Permanently removes the `SourceInstance` and/or `DestinationInstance` using `RemoveItem` if their stack counts are now 0 after the actual consumption (calculated based on how many results were successfully placed). If stacks remain, broadcasts their updated count.
     * Returns `true` (combination occurred, at least partially).

**Important:** The simulation step is key. It prevents consuming ingredients unless the resulting item can actually be placed in the destination inventory, avoiding item loss if space is insufficient. The two-phase placement attempt ensures efficient use of space potentially freed up by the consumed ingredients.
