# Core Functionality

This section covers the fundamental responsibilities of the `ULyraInventoryManagerComponent`: how it stores items, the primary operations for adding and removing them, how it enforces inventory limits, and its interaction with Item Fragments for core calculations and behavior like stacking.

### Inventory Structure: Array-Based Storage

Fundamentally, this inventory component manages items as an ordered **list or array**.

* **No Spatial Awareness:** Unlike grid-based or "Tetris" inventories, this component does **not** have inherent knowledge of item shapes, sizes, or specific grid coordinates. Items are simply stored in a sequence.
* **List Representation:** The core storage is the `InventoryList` property (an `FLyraInventoryList` struct), which holds an array of `FLyraInventoryEntry` structs. Each entry represents one "slot" or stack in the list.
* **Stacking:** Item stacking (having multiple units of the same item type within a single `FLyraInventoryEntry`) is **controlled by the `UInventoryFragment_InventoryIcon` fragment**. Items _without_ this fragment (or a similar custom fragment defining stacking behavior) will typically occupy one `FLyraInventoryEntry` per `ULyraInventoryItemInstance`, regardless of their `StatTag` count, meaning no stack limits.

### Item Storage: `FLyraInventoryList`

The heart of the inventory is the `InventoryList` property, an instance of the `FLyraInventoryList` struct.

* **Structure:** `FLyraInventoryList` derives from `FFastArraySerializer`, enabling efficient network replication of its contents.
* **Contents:** It holds a `TArray<FLyraInventoryEntry>` named `Entries`.
* **`FLyraInventoryEntry`:** Each entry in the array represents a stack of a particular item instance and contains:
  * `Instance` (`TObjectPtr<ULyraInventoryItemInstance>`): A pointer to the actual item instance UObject.
  * `StackCount` (`int32`): How many of this specific item instance are conceptually in this entry. **Note:** This `StackCount` often mirrors the value stored in the `Instance`'s `StatTags` under the `Lyra.Inventory.Item.Count` tag, but represents the count _within this specific inventory slot/entry_. The `StatTag` on the instance is the ultimate persistent source of truth for the item's quantity. The `UpdateItemCount` function helps keep these synchronized.
  * `LastObservedCount` (`int32`, Not Replicated): Used internally by the `FFastArraySerializer` on clients to correctly calculate deltas for change notifications.

**Replication:** Changes to the `Entries` array (adding, removing, modifying `StackCount` within an entry) are replicated efficiently using Fast Array Serialization. Client-side callbacks (`PreReplicatedRemove`, `PostReplicatedAdd`, `PostReplicatedChange`) handle updating local state and broadcasting gameplay messages (`TAG_Lyra_Inventory_Message_StackChanged`).

***

### The Role of `UInventoryFragment_InventoryIcon`

While many fragments add optional behaviors, `UInventoryFragment_InventoryIcon` plays a crucial role in defining how items behave within this array-based inventory, particularly regarding stacking and basic properties often needed for UI.

* **Enables Stacking:** This fragment contains the `MaxStackSize` property. The `TryAddItemDefinition` and `TryAddItemInstance` logic specifically looks for this fragment to determine if an item can stack and what the limit per stack (`FLyraInventoryEntry`) is. Items _without_ this fragment are typically treated as having no stack limit (one instance per entry but that instance will have no upper count limit).
* **Defines Base Weight:** Contains a `Weight` property. The `GetItemWeightContribution` function for this fragment returns this value, providing the base weight for the item type.
* **Defines Item Count Contribution:** The `GetItemCountContribution` for this fragment returns `1`, signifying that each stack/instance of an item with this fragment contributes one unit towards the inventory's `ItemCountLimit`.
* **UI Data:** Often holds properties like `Icon`, `ItemSize` (even if just 1x1 for list view), etc., used for visual representation.

> **In essence:** For standard stacking behavior and contribution to weight/count limits within the `ULyraInventoryManagerComponent`, items should generally include the `UInventoryFragment_InventoryIcon` in their definition.

***

### Primary Operations (Authority Required)

These functions are the main entry points for modifying inventory contents and should generally be called on the network authority (server). They incorporate checks for limits and stacking rules.

* `TryAddItemDefinition(TSubclassOf<ULyraInventoryItemDefinition> ItemDef, int32 Amount, TArray<ULyraInventoryItemInstance*>& OutStackedItems, TArray<ULyraInventoryItemInstance*>& OutNewItems)`
  * **Action:** The **primary way to add items** when you only have the definition. Attempts to add the specified `Amount` of `ItemDef` to the inventory.
  * **Logic:**
    1. Checks `CanAddItem_Implementation` (which includes limit checks and fragment checks).
    2. Attempts to add to existing stacks of the same `ItemDef` (up to `MaxStackSize` defined in `InventoryFragment_InventoryIcon`). Populates `OutStackedItems`.
    3. If quantity remains, creates new `ULyraInventoryItemInstance`s (via `AddItemDefinition`) and adds them as new `FLyraInventoryEntry` items, respecting `MaxStackSize` per entry. Populates `OutNewItems`.
  * **Use Case:** Picking up world items defined by templates, crafting, granting items.
  * **Returns:** The number of items that _could not_ be added (0 if all were added successfully).

<img src=".gitbook/assets/image (28) (1) (1).png" alt="" width="375" title="">

* `TryAddItemInstance(ULyraInventoryItemInstance* ItemInstance, TArray<ULyraInventoryItemInstance*>& OutStackedItems, TArray<ULyraInventoryItemInstance*>& OutNewItems)`
  * **Action:** The **primary way to add an existing item instance**. Attempts to add the `ItemInstance` (and its current stack count) to the inventory.
  * **Logic:**
    1. Checks `CanAddItem_Implementation`.
    2. Attempts to add the instance's stack count to existing stacks of the same `ItemDef`. If successful, the original `ItemInstance` might be destroyed (if fully merged) or have its stack count reduced. Populates `OutStackedItems`.
    3. If quantity remains on the input `ItemInstance` (or it couldn't stack), attempts to add the `ItemInstance` itself as a new `FLyraInventoryEntry` (via `AddItemInstance`), respecting `MaxStackSize`. Populates `OutNewItems`. **Note:** The system might _split_ the input `ItemInstance` if its stack count exceeds `MaxStackSize`, creating new instances for the overflow (using `CreateTempDuplicateItemInstance`).
  * **Use Case:** Moving items between inventories where the instance should ideally merge or be added directly.
  * **Returns:** The number of items from the original `ItemInstance`'s stack that _could not_ be added. Returns -1 if the input `ItemInstance` was invalid.

<img src=".gitbook/assets/image (30) (1).png" alt="" width="375" title="">

* `RemoveItemInstance(ULyraInventoryItemInstance* ItemInstance)`
  * **Action:** Removes the `FLyraInventoryEntry` associated with the given ItemInstance from the `InventoryList`. Updates total weight and item count. Calls RemovedFromInventory on the item's transient fragments. **Does NOT destroy the `ItemInstance` UObject itself.**
  * **Use Case:** Moving an item out of this inventory to another location (another inventory, the world, equipment slot) where the instance needs to persist.
  * **Returns:** The `ULyraInventoryItemInstance*` that was removed, or nullptr if not found.

<img src=".gitbook/assets/image (31) (1).png" alt="" width="375" title="">

* `DestroyItemInstance(ULyraInventoryItemInstance* ItemInstance)`
  * **Action:** Similar to `RemoveItemInstance`, but additionally calls `DestroyTransientFragment` on the item's transient fragments before removing the entry. This signifies the item is being consumed or permanently deleted. **It still does NOT destroy the UObject immediately** (garbage collection handles that), but it signals final cleanup for fragment data.
  * **Use Case:** Consuming a potion, firing the last bullet from a non-reusable magazine item, deleting items via UI.
  * **Returns:** The `ULyraInventoryItemInstance*` that was processed for destruction, or nullptr if not found.

<img src=".gitbook/assets/image (33) (1).png" alt="" width="375" title="">

* `RemoveItem(ULyraInventoryItemInstance* ItemInstance, int32 Amount, bool bRemoveEntireStack, bool bDestroy = false)`
  * **Action:** More granular removal. Removes a specific Amount from the stack associated with `ItemInstance`.
  * **Logic:**
    * If `bRemoveEntireStack` is true or `Amount is >= the current stack count`, it behaves like `RemoveItemInstance` or `DestroyItemInstance` (based on `bDestroy`).
    * If `Amoun`t is less than the current stack, it reduces the `StackCount` in the `FLyraInventoryEntry` and the item's `Lyra.Inventory.Item.Count` StatTag, updates weight/count, and potentially returns a newly created duplicate instance representing the removed portion (if `bDestroy` is false).
  * **Use Case:** Splitting stacks, consuming partial amounts.
  * **Returns:** A new temporary/duplicate instance representing the removed amount if `bDestroy` is false and only a partial amount was removed. Returns the original instance if the entire stack was removed and bDestroy is false. Returns nullptr if bDestroy is true or the item wasn't found.

<img src=".gitbook/assets/image (32) (1).png" alt="" width="375" title="">

* `EmptyInventory(bool bDestroyItems = true)`
  * **Action:** Removes all entries from the InventoryList. If `bDestroyItems` is true, it calls `DestroyTransientFragment` on all items before clearing; otherwise, it just clears the list (leaving the instances intact for potential transfer). Resets total Weight and ItemCount to 0. Stops subobject replication for removed items.

<img src=".gitbook/assets/image (34) (1).png" alt="" width="375" title="">

> [!danger]
> _(**Do not confuse**_ _`AddItemDefinition` and `AddItemInstance` with the `TryAdd...` functions. The former functions are internal functions that directly add the items to the inventories with any checks. They are called by the `TryAdd...` functions but are generally not the primary external entry points for adding items due to lack of stacking/limit checks)._

***

### Enforcing Rules & Limits

The Manager checks several conditions, primarily within its `CanAddItem_Implementation`, before allowing items to be added:

* **`LimitItemInstancesStacks` (`int32`):** If > 0, limits the maximum number of `FLyraInventoryEntry` items (stacks) allowed in the `InventoryList`. The check allows adding to existing stacks even if the limit is reached.
* **`AllowedItems` (`TSet<TSubclassOf<ULyraInventoryItemDefinition>>`):** If not empty, only items whose definitions are in this set can be added.
* **`DisallowedItems` (`TSet<TSubclassOf<ULyraInventoryItemDefinition>>`):** If not empty, items whose definitions are in this set _cannot_ be added. (Takes precedence over `AllowedItems` if an item is in both).
* **`MaxWeight` (`float`):** If > 0, the total calculated weight of all items (sum of `GetWeightContribution` from fragments \* stack count) cannot exceed this limit. `CanAddItem` calculates if adding the new item(s) would exceed the limit and reduces the allowed amount accordingly.
* **`ItemCountLimit` (`int32`):** If > 0, the total calculated item count (sum of `GetItemCountContribution` from fragments \* stack count) cannot exceed this limit. `CanAddItem` performs a similar check and reduction.
* **Fragment Checks:** `CanAddItem` iterates through the fragments of the item being added and calls their `CanAddItemToInventory` virtual function, allowing fragments to implement custom restrictions (e.g., item requires power, unique item already present).

If `CanAddItem` determines an item cannot be added (or the allowed amount is 0), the `TryAddItemDefinition`/`TryAddItemInstance` functions will fail or add a reduced amount. Notifications can be broadcast to the client via `ClientBroadcastNotification` to explain failures (e.g., "Inventory Full", "Max Weight Reached").

***

### Interaction with Fragments (Weight/Item Count)

The Manager doesn't inherently know the weight or "count contribution" of an item. It relies on the item's fragments:

* **`GetItemWeight(..., ItemInstance)` / `GetItemCount(..., ItemInstance)` (Static Helpers):** These static functions (callable from the Manager or elsewhere) take an item instance (or definition) and iterate through its `Fragments` array (on the definition CDO).
* **`Fragment->GetWeightContribution(...)` / `Fragment->GetItemCountContribution(...)`:** Each fragment provides its contribution.
  * Typically, `InventoryFragment_InventoryIcon` provides the base weight and returns 1 for item count.
  * `InventoryFragment_Container` might sum the weight/count of its internal items (depending on its config flags like `bIgnoreChildInventoryWeights`).
  * `InventoryFragment_Attachment` sums the weight/count of attached items.
  * Most other fragments likely return 0 for both.
* **Summation:** The Manager sums the results from all fragments to get the final weight/count _per single item_. This value is then multiplied by the stack count when calculating the inventory's total weight/item count.
* **Updates:** The Manager calls internal logic (`UpdateItemCount`) whenever items are added or removed to recalculate and update the replicated `Weight` and `ItemCount` properties. `OnRep_Weight` and `OnRep_ItemCount` broadcast gameplay messages (`TAG_Lyra_Inventory_Message_WeightChanged`, `TAG_Lyra_Inventory_Message_ItemCountChanged`) for UI updates.

***

### Replication of Core State

* `InventoryList`: Replicated via Fast Array Serialization.
* `Weight`: Replicated float, uses `OnRep_Weight`.
* `ItemCount`: Replicated int32, uses `OnRep_ItemCount`.
* **Subobjects:** Crucially, the Manager overrides `ReplicateSubobjects` and uses `ReadyForReplication` to ensure all `ULyraInventoryItemInstance` UObjects within the `InventoryList` (and their `RuntimeFragments`) are properly replicated to clients who have the necessary **Access Rights**.

***

You now understand the fundamental mechanics of how the `ULyraInventoryManagerComponent` manages items, including storage, basic operations, limits, and fragment-based calculations. The next section will cover how these inventory changes are replicated and synchronized between server and clients to maintain consistent UI and gameplay across all connected players.
