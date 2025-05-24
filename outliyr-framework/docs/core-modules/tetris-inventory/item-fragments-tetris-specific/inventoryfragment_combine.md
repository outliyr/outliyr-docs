# InventoryFragment\_Combine

This fragment allows you to define rules for combining the item it's attached to (the "target" item) with other specific items (the "incoming" item) when the incoming item is dropped onto the target item within a Tetris inventory grid. It facilitates crafting or transformation interactions directly within the inventory interface.

### Purpose

* **Item Combination Recipes:** Define specific pairings of items that can be combined.
* **Ingredient Consumption:** Specify the required quantities of both the target and incoming items needed for a successful combination.
* **Result Definition:** Define the new item(s) created as a result of the combination.
* **Grid Interaction:** Integrates with the `ULyraTetrisInventoryManagerComponent` to handle the consumption of ingredients and the placement of the resulting item(s) within the grid, respecting spatial constraints.

### Configuration (`CombinationList`)

The core configuration happens within the `CombinationList` property of the fragment, added to the target item's `ULyraInventoryItemDefinition`.

```cpp
/**
 * Defines which item types this item can combine with when another item is dropped onto it.
 *
 * Key: Incoming item definition (the item being dropped)
 * Value: Combination rule for creating a new resulting item.
 *
 * Note: Items will NOT combine with themselves — items of the same definition will stack instead.
 */
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=CombinationDetails)
TMap<TSubclassOf<ULyraInventoryItemDefinition>, FItemCombinationDetails> CombinationList;

// --- Details for a specific combination rule ---
USTRUCT(BlueprintType)
struct FItemCombinationDetails
{
    GENERATED_BODY()
public:
    /**
     * The minimum quantity of this item (the one owning the Combine Fragment, i.e. the *target item*)
     * required per combination action.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 TargetItemRequiredQuantity; // e.g., Need 1 Empty Bottle

    /**
     * The minimum quantity of the *incoming* item (the one being dragged/dropped)
     * required per combination action.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 IncomingItemRequiredQuantity; // e.g., Need 5 Berries

    /**
     * The item that will be created as a result of the combination.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSubclassOf<ULyraInventoryItemDefinition> ResultingItemDefinition; // e.g., Creates 1 Health Potion

    /**
     * The number of resulting items created per valid combination action.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ResultingItemQuantity = 0; // e.g., Produces 1 Potion per combination
};
```

**How to Configure:**

1. Add the `InventoryFragment_Combine` to the `ULyraInventoryItemDefinition` of the item that _will be dropped onto_ (the target/base ingredient).
2. Expand the `Combination List` property.
3. Click `+` to add a new element to the TMap.
4. **Key:** In the "Key" dropdown, select the `ULyraInventoryItemDefinition` of the item that will be _dropped onto_ this item (the incoming ingredient).
5. **Value:** Configure the `FItemCombinationDetails` for this specific pairing:
   * `Target Item Required Quantity`: How many units of _this_ item (owning the fragment) are consumed per combination.
   * `Incoming Item Required Quantity`: How many units of the _incoming_ item (selected in the Key) are consumed per combination.
   * `Resulting Item Definition`: Select the `ULyraInventoryItemDefinition` of the item produced by the combination.
   * `Resulting Item Quantity`: How many units of the resulting item are produced.
6. Repeat steps 3-5 for every different item type that can combine with this target item.

**Example:** Making a Health Potion (ID\_Potion\_Health) by dropping 5 Berries (ID\_Resource\_Berry) onto an Empty Bottle (ID\_Misc\_EmptyBottle).

* Add `InventoryFragment_Combine` to `ID_Misc_EmptyBottle`.
* Configure `CombinationList`:
  * Add Entry:
    * Key: `ID_Resource_Berry`
    * Value (`FItemCombinationDetails`):
      * `Target Item Required Quantity`: 1 (Need 1 Empty Bottle)
      * `Incoming Item Required Quantity`: 5 (Need 5 Berries)
      * `Resulting Item Definition`: `ID_Potion_Health`
      * `Resulting Item Quantity`: 1 (Produces 1 Health Potion)

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
