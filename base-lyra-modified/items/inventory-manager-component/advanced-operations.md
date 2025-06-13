# Advanced Operations

Beyond the fundamental `TryAddItem...` and `RemoveItem...` functions, the `ULyraInventoryManagerComponent` provides several more advanced operations for querying, consuming, and manipulating inventory contents, often dealing with multiple items or specific criteria.

### Searching & Querying

These functions help you find items or check quantities without necessarily modifying the inventory immediately.

* `FindFirstItemStackByDefinition(TSubclassOf<ULyraInventoryItemDefinition> ItemDef) const`
  * **Action:** Searches the `InventoryList` sequentially and returns the _first_ `ULyraInventoryItemInstance*` found that matches the provided `ItemDef`.
  * **Use Case:** Quickly checking if at least one item of a specific type exists, getting a reference to _an_ instance of that type (useful if instance-specific data isn't critical for the check).
  * **Returns:** The `ULyraInventoryItemInstance*` or `nullptr` if no match is found.

<img src=".gitbook/assets/image (35) (1).png" alt="" width="375" title="">

* `GetTotalItemCountByDefinition(TSubclassOf<ULyraInventoryItemDefinition> ItemDef) const`
  * **Action:** Iterates through the entire `InventoryList` and sums the `StackCount` of all entries whose `Instance` matches the provided `ItemDef`.
  * **Use Case:** Checking the total quantity of a specific item type the inventory holds across potentially multiple stacks (e.g., "How much 5.56mm ammo do I have in total?").
  * **Returns:** The total combined stack count (`int32`).

<img src=".gitbook/assets/image (39).png" alt="" width="371" title="">

> [!info]
> The [Item Query System](../item-query-system/) is preferred for tracking the amount of items are in an inventory. This function is useful for one off checks.

* `SearchForItem(TSubclassOf<ULyraInventoryItemDefinition> ItemDef, int32 Count, TArray<ULyraInventoryItemInstance*>& OutItemInstances)`
  * **Action:** Checks if the inventory contains _at least_ the specified `Count` of the given `ItemDef`, summing across multiple stacks if necessary.
  * **Populates `OutItemInstances`:** If enough items are found, this array will contain references to the `ULyraInventoryItemInstance`s that contribute to meeting the `Count`. **Note:** It adds the _entire instance_ reference even if only part of its stack is needed.
  * **Use Case:** Prerequisite checks for crafting, abilities, or quests ("Do I have at least 10 Iron Ore?").
  * **Returns:** `true` if the total count is met or exceeded, `false` otherwise. `OutItemInstances` is populated on success.

<img src=".gitbook/assets/image (36) (1).png" alt="" width="375" title="">

* `SearchForItems(TArray<FPickupTemplate> RequestedItems, TArray<ULyraInventoryItemInstance*>& OutItemInstances)`
  * **Action:** Checks if the inventory contains sufficient quantities of _multiple different item types_ as specified in the `RequestedItems` array (which contains `ItemDef` and required `StackCount` pairs).
  * **Populates `OutItemInstances`:** Similar to `SearchForItem`, adds the relevant `ULyraInventoryItemInstance` references if _all_ requested items and quantities are found.
  * **Use Case:** Checking complex crafting recipes or quest requirements involving multiple ingredients.
  * **Returns:** `true` if _all_ requirements in `RequestedItems` are met, `false` otherwise. `OutItemInstances` is populated on success.

<img src=".gitbook/assets/image (37).png" alt="" width="372" title="">

* `SearchForCombinationOfItems(const TArray<TSubclassOf<ULyraInventoryItemDefinition>>& PossibleItemDefs, int32 RequiredAmount, TArray<ULyraInventoryItemInstance*>& OutItemInstances)`
  * **Action:** Checks if the inventory contains a total of `RequiredAmount` items, drawing from _any_ of the item types specified in the `PossibleItemDefs` list.
  * **Populates `OutItemInstances`:** Adds references to the instances contributing to the total amount found.
  * **Use Case:** Flexible requirements, like checking for ammo where multiple compatible types exist ("Do I have at least 20 rounds of _any_ pistol ammo?").
  * **Returns:** `true` if the combined total from matching items meets or exceeds `RequiredAmount`, `false` otherwise. `OutItemInstances` is populated on success.

<img src=".gitbook/assets/image (38).png" alt="" width="375" title="">

### Consuming & Removing Sets of Items (Authority Required)

This functions handles removing items based on definitions or criteria, often used after a successful search or for direct consumption.

* `RemoveCombinationOfItems(const TArray<TSubclassOf<ULyraInventoryItemDefinition>>& PossibleItemDefs, int32 RequiredAmount, bool bOnlyRemoveIfAllItemsFound, bool& FoundAllItems, bool bDestroy)`
  * **Action:** Attempts to remove a total of `RequiredAmount` items, consuming items from the `PossibleItemDefs` list until the total is met. Uses `RemoveItem` internally for granular removal.
  * **`bOnlyRemoveIfAllItemsFound`:** If true, first checks if the total `RequiredAmount` _can_ be met by the available items in the list. If not, removes nothing.
  * **`FoundAllItems` (Out Param):** Set to true if the full `RequiredAmount` was successfully removed.
  * **`bDestroy`:** Controls whether removal triggers fragment destruction logic.
  * **Use Case:** Consuming ammo where multiple types are valid, fulfilling generic resource requirements ("Consume 50 Metal Fragments").
  * **Returns:** An array of removed item portions/instances (unless `bDestroy` is true).

<img src=".gitbook/assets/image (40).png" alt="" width="375" title="">

### Other Operations

* `SwapItemInstanceOrder(int32 IndexA, int32 IndexB)`
  * **Action:** Swaps the position of two entries (`FLyraInventoryEntry`) within the internal `InventoryList.Entries` array. Updates the `CurrentSlot` information on the involved `ItemInstance`s to reflect their new indices.
  * **Authority Required.**
  * **Use Case:** Reordering items within a list-based UI representation. Note that this only changes the _order_ in the list, not grid positions in more complex inventory UIs (like Tetris).

***

These advanced operations provide the tools needed for implementing complex inventory interactions like crafting, flexible item consumption, and sophisticated requirement checking, building upon the core storage and fragment systems. Remember to perform checks and removals primarily on the server (authority) for network consistency.
