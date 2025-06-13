# InventoryFragment_Container

This fragment is the key to creating nested inventories. By adding `InventoryFragment_Container` to an item definition, you allow instances of that item (like backpacks, chests, weapon cases) to possess and manage their own internal `ULyraTetrisInventoryManagerComponent`.

<img src=".gitbook/assets/image (12).png" alt="" width="563" title="">

### Purpose

* **Nested Inventories:** Enables items to function as containers holding other items.
* **Hierarchical Storage:** Creates parent-child relationships between inventory components.
* **Encapsulated Configuration:** Defines the layout, limits, and starting items specifically for the container's internal inventory.
* **Interaction Gateway:** Handles interactions like moving items _into_ the container.
* **Weight/Count Contribution:** Manages how the container's internal contents contribute to the parent inventory's weight and item count limits.

### Transient Data (`FTransientFragmentData_Container`)

This fragment utilizes struct-based transient data to store the reference to the unique child inventory component created for each container item instance.

* **`ChildInventory`:** The crucial pointer to the dynamically created `ULyraTetrisInventoryManagerComponent` associated _only_ with this specific container item instance.

### How to Configure

To turn an item into a functioning container (e.g., backpack, crate, pouch), add the `InventoryFragment_Container` to its `ULyraInventoryItemDefinition` and configure the following properties:

**1. Set Container Identity and Layout**

* **`ContainerName`**:\
  A user-facing label for the container's internal inventory (e.g., `"Backpack Interior"`). Appears in UI titles.
*   **`InventoryLayout`** (Required):\
    Defines the internal grid layout of the container. Use one or more `FInventoryLayoutCreator` entries to configure rows, columns, and layout groups.

    > This must be set; a container without layout will not function correctly.

> [!success]
> There is a Blueprint editor Utility Widget that can be used to easily create an inventory layout. This is the preferred way rather than trying to visualise the layout in your head and translating that to a 3D array. [Read this page](../tetris-inventory-manager-component/grid-layout.md#best-practice-using-the-layout-editor-utility-widget) to see how it works

**2. Prepopulate the Container (Optional)**

* **`StartingItems`**:\
  An array of `FInventoryStartItemDetails` defining which items should spawn inside the container when it's first created.

**3. Set Storage Rules**

* **`MaxWeight`**:\
  Total weight capacity of this container. Set to `0` to disable weight limits.
* **`ItemCountLimit`**:\
  Maximum number of item stacks allowed. Set to `0` to disable count limits.

**4. Control Child Inventory Contribution**

These options determine how this container's **contents** affect its **parent inventory** (the one this container is stored in).

* **`bIgnoreChildInventoryWeights`**:\
  If `true`, items inside this container won’t add to the parent inventory’s total weight.
* **`bIgnoreChildInventoryItemCounts`**:\
  If `true`, items inside this container won’t count toward the parent’s item stack limit.
* **`bIgnoreChildInventoryItemLimits`**:\
  If `true`, the container will not enforce specific per-item stack limits on its child containers.

**5. Restrict Allowed Items (Optional)**

Use these to define what _can_ or _cannot_ go inside the container:

* **`AllowedItems`**:\
  Only these item definitions are allowed. If non-empty, acts as a whitelist.
* **`DisallowedItems`**:\
  These item definitions are blocked. Acts as a blacklist (useful even when `AllowedItems` is empty).

**6. Set Per-Item Limits (Optional)**

*   **`SpecificItemCountLimits`**:\
    Define item-specific stack limits for contents. Use `FPickupTemplate` entries for granular control.

    > 💡 Don't set an item to 0 here — use `DisallowedItems` instead.

**7. Test Container Interactions**

After configuring:

* Try dragging an item onto the container to confirm it accepts and stores the item.
* Ensure constraints like weight, allowed items, and layout are respected.
* Verify items cannot be placed into themselves or recursive loops (e.g., a backpack inside itself).

***

### Runtime Logic & Lifecycle

* **Creation (`CreateNewTransientFragment` Override):**
  1. Called when a container item instance is created.
  2. Uses `UGlobalInventoryManager::Get(World)` to access the central manager.
  3. Creates a **new instance** of `ULyraTetrisInventoryManagerComponent` using `NewObject`, typically outered to the `GlobalInventoryManager`'s owner.
  4. Calls `NewInventoryManager->InitialiseTetrisInventoryComponent`, passing all the configuration properties defined on _this fragment_.
  5. Sets the `NewInventoryManager->InventoryContainer` pointer back to this fragment instance (useful for the child to know its origin config).
  6. Registers the new inventory with the `GlobalInventoryManager` (`AddNewInventory`).
  7. Creates the `FTransientFragmentData_Container` struct, storing the pointer to the `NewInventoryManager` in its `ChildInventory` member.
  8. Initializes the output `FInstancedStruct` with this transient data.
* **Moving Items Into Container (`CombineItems` Override):**
  1. Called when another item (`SourceInstance`) is dropped onto the container item (`DestinationInstance`).
  2. Resolves the `FTransientFragmentData_Container` for the `DestinationInstance`.
  3. Gets the `ChildInventory` pointer from the transient data.
  4. Checks that the `SourceInventory` is not the `ChildInventory` itself (preventing internal moves via combine).
  5. Calls `ChildInventory->CanAddItem` to check if the `SourceInstance` can fit (considering weight, count, type, _and potential parent constraints of the ChildInventory itself_).
  6. If allowed, calls `ChildInventory->FindAvailableSlotsForItem` to find space _inside the container_.
  7. If space is found, calls `SourceInventory->MoveItemExternally` to transfer the item _from_ the source inventory _into_ the `ChildInventory` at the found available slot.
  8. Returns `true` if items were successfully moved into the container.
* **Preventing Self-Addition (`CanAddItemToInventory` Override):**
  1. Called when _this container item_ is about to be added to another inventory (`Inventory`).
  2. Checks if the target `Inventory` is the same as this item's _own_ `ChildInventory` (retrieved via `ResolveTransientFragment`). If so, denies addition (`AllowedAmount = 0`).
  3. Checks if the target `Inventory` is a _descendant_ of this item's `ChildInventory` (using `DestinationInventory->IsInParentInventory(MyChildInventory)`). If so, denies addition. Prevents placing a backpack inside a pouch that's already inside that same backpack.
* **Weight/Count Contribution (`GetWeightContribution`, `GetItemCountContribution` Overrides):**
  1. Called by the _parent_ inventory when calculating its total weight/count.
  2. Checks the parent's `bIgnoreChildInventoryWeights` / `bIgnoreChildInventoryItemCounts` flags. If `true`, returns 0 contribution for the child's contents.
  3. If `false`, resolves the `FTransientFragmentData_Container`, gets the `ChildInventory`, and returns the child's current `GetInventoryWeight()` or `GetInventoryItemCount()`.
* **Lifecycle Management (Transient Data Overrides):**
  * `DestroyTransientFragment`: When the container item instance is destroyed, this tells the `GlobalInventoryManager` to destroy the associated `ChildInventory` component, ensuring cleanup. It also broadcasts a message (`ClientCloseInventoryWindow`) to force-close any UI windows looking at the child inventory.
  * `AddedToInventory`: When the container item is added to a parent, this sets the `ChildInventory->ParentInventory` pointer to the new parent. It also cascades the `AddedToInventory` call to items _inside_ the child inventory.
  * `RemovedFromInventory`: When the container item is removed, this potentially clears the `ChildInventory->ParentInventory` pointer (if removed from its current parent). It cascades the `RemovedFromInventory` call to items inside.

The `InventoryFragment_Container` is the linchpin for nested inventories, bridging the item instance with its own dedicated inventory component and managing the crucial interactions and lifecycle events between parent and child inventories.
