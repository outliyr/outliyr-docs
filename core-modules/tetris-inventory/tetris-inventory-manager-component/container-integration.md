# Container Integration

A powerful feature of the Tetris Inventory system is the ability for items themselves to act as containers, holding their own nested `ULyraTetrisInventoryManagerComponent`. This allows for creating complex inventory hierarchies, like backpacks containing pouches, or weapon cases holding weapons and magazines. This section details how the system manages these parent-child relationships.

### Enabling Containers (`InventoryFragment_Container`)

An item becomes a container by including the `UInventoryFragment_Container` in its `ULyraInventoryItemDefinition`.

* **Functionality:** This fragment is responsible for:
  * Defining the configuration of the child inventory (layout, limits, starting items, etc.).
  * Triggering the creation of a dedicated `ULyraTetrisInventoryManagerComponent` instance when the container item instance is created.
  * Storing a reference to this child component in its associated `FTransientFragmentData_Container`.
  * Handling interactions like moving items _into_ the container (`CombineItems` override).
  * Managing the lifecycle of the child inventory component.
  * Contributing (or ignoring) the child inventory's weight/item count to the parent inventory based on configuration flags.

**(See the** [**Item Fragments -> `InventoryFragment_Container` page**](../item-fragments-tetris-specific/inventoryfragment_container.md) **for full configuration details.)**

### Parent-Child Relationship

When a container item (with `InventoryFragment_Container`) is placed within another `ULyraTetrisInventoryManagerComponent` (the "parent"), a relationship is established:

* **`ParentInventory` Pointer:** The child `ULyraTetrisInventoryManagerComponent` (stored in the container item's transient data) holds a `UPROPERTY(Replicated) TObjectPtr<ULyraTetrisInventoryManagerComponent> ParentInventory;` pointing to the inventory component it currently resides in.
* **Setting the Pointer:** This pointer is set automatically:
  * When the container item instance is first added to an inventory (`FTransientFragmentData_Container::AddedToInventory`).
  * When the container item instance is moved between inventories (`FTransientFragmentData_Container::RemovedFromInventory` on the old parent, `AddedToInventory` on the new parent).
* **Hierarchy Traversal:** This pointer allows traversing _up_ the inventory hierarchy.

### Hierarchy Traversal Functions

* **`GetParentInventory() const`:** Returns the direct parent inventory component, or `nullptr` if this is a root inventory (e.g., directly on the player state or a world actor).

<img src=".gitbook/assets/image (148).png" alt="" width="375" title="">

* **`GetBaseInventory()`:** Traverses up the `ParentInventory` chain until it finds the topmost `ULyraTetrisInventoryManagerComponent` (the one with no parent). This is useful for identifying the root container (e.g., the player's main inventory).

<img src=".gitbook/assets/image (149).png" alt="" width="375" title="">

* **`IsInParentInventory(ULyraTetrisInventoryManagerComponent* PotentialParentInventory)`:** Checks if the provided `PotentialParentInventory` exists anywhere _above_ this inventory in the hierarchy chain (including itself). Useful for preventing items from being placed inside themselves or their own children.

<img src=".gitbook/assets/image (150).png" alt="" width="375" title="">

### Constraint Propagation (`CanAddItemInParent`)

A crucial aspect of nested containers is ensuring that adding an item to a child inventory doesn't violate the constraints (weight, item count limits) of its parent(s).

* **Trigger:** The `ULyraTetrisInventoryManagerComponent::CanAddItem_Implementation` override calls `CanAddItemInParent` if the component has a valid `ParentInventory`.
* **`CanAddItemInParent` Logic:**
  1. Takes the `AllowedAmount` calculated by the _child's_ `CanAddItem` check.
  2. Checks if adding `AllowedAmount` of the item would violate the _current parent's_ `MaxWeight`, but _only if_ the parent's `bIgnoreChildInventoryWeights` flag is `false`. Reduces `AllowedAmount` if necessary.
  3. Checks if adding `AllowedAmount` would violate the _current parent's_ `ItemCountLimit`, but _only if_ the parent's `bIgnoreChildInventoryItemCounts` flag is `false`. Reduces `AllowedAmount` if necessary.
  4. **Recursion:** If `AllowedAmount` is still positive and the current parent _also_ has a parent (`ParentInventory->ParentInventory`), it recursively calls `CanAddItemInParent` on the grandparent, passing the further reduced `AllowedAmount`.
  5. **Termination:** Recursion stops when `AllowedAmount` becomes 0, the top of the hierarchy is reached (`ParentInventory` is null), or an ignore flag prevents further checking.
* **Result:** The final `AllowedAmount` returned by the initial `CanAddItem` call reflects the minimum allowed quantity considering the constraints of the entire inventory hierarchy leading back to the root.

### Weight & Item Count Propagation (`UpdateItemCount` Override)

When an item is added or removed from a child inventory, the change in weight and item count needs to potentially propagate upwards.

* **Trigger:** The `ULyraTetrisInventoryManagerComponent::UpdateItemCount` override is called whenever an item's count changes within _this_ inventory.
* **Logic:**
  1. Calls `Super::UpdateItemCount` to update the item's StatTag and calculate the `UpdatedItemWeight` and `UpdatedItemCount` change based on the item's fragments _for this inventory level_.
  2. Iterates upwards through the `ParentInventory` chain:
     * For each parent:
       * If `!CurrentParent->bIgnoreChildInventoryWeights`, adds `UpdatedItemWeight` to the parent's `Weight`. Otherwise, sets `UpdatedItemWeight = 0` to stop further weight propagation.
       * If `!CurrentParent->bIgnoreChildInventoryItemCounts`, adds `UpdatedItemCount` to the parent's `ItemCount`. Otherwise, sets `UpdatedItemCount = 0` to stop count propagation.
       * If both `UpdatedItemWeight` and `UpdatedItemCount` become 0, breaks the loop (no more propagation needed).
* **Result:** Ensures that parent inventories accurately reflect the total weight and item count of their contents (including nested items), based on their configuration flags.

### Lifecycle Management

* **Creation:** Child inventories are created when the container item instance is created (via `InventoryFragment_Container::CreateNewTransientFragment`).
* **Destruction:**
  * When the container item instance itself is destroyed (via `ULyraInventoryManagerComponent::DestroyItemInstance`), the `FTransientFragmentData_Container::DestroyTransientFragment` callback is triggered.
  * This callback tells the `UGlobalInventoryManager` to destroy the associated child `ULyraTetrisInventoryManagerComponent`.
  * `ULyraTetrisInventoryManagerComponent::DestroyContainingInventories()` can be called to manually trigger the destruction of all inventories held within items _inside_ this component (cascading downwards). This is less common than the automatic cleanup via item destruction.
* **Moving Containers:** When a container item is moved:
  * `RemovedFromInventory` is called on the transient fragment, clearing the `ParentInventory` link on the child component (relative to the old parent).
  * `AddedToInventory` is called, setting the `ParentInventory` link to the new parent inventory.

The parent-child relationship enabled by `InventoryFragment_Container` allows for sophisticated inventory structures. The system ensures that constraints and state changes propagate correctly through the hierarchy based on configurable rules, maintaining consistency across nested containers.
