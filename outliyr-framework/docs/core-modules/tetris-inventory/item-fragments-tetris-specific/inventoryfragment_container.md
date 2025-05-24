# InventoryFragment\_Container

This fragment is the key to creating nested inventories. By adding `InventoryFragment_Container` to an item definition, you allow instances of that item (like backpacks, chests, weapon cases) to possess and manage their own internal `ULyraTetrisInventoryManagerComponent`.

### Purpose

* **Nested Inventories:** Enables items to function as containers holding other items.
* **Hierarchical Storage:** Creates parent-child relationships between inventory components.
* **Encapsulated Configuration:** Defines the layout, limits, and starting items specifically for the container's internal inventory.
* **Interaction Gateway:** Handles interactions like moving items _into_ the container.
* **Weight/Count Contribution:** Manages how the container's internal contents contribute to the parent inventory's weight and item count limits.

### Transient Data (`FTransientFragmentData_Container`)

This fragment utilizes struct-based transient data to store the reference to the unique child inventory component created for each container item instance.

```cpp
// Transient payload holding the reference to the child inventory component.
USTRUCT(BlueprintType)
struct FTransientFragmentData_Container : public FTransientFragmentData
{
    GENERATED_BODY()
public:
    // Constructor, etc...

    // --- FTransientFragmentData Overrides ---
    // Called when the container item instance is permanently destroyed.
    virtual void DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance) override;
    // Called when the container item instance is added to a parent inventory.
    virtual void AddedToInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance) override;
    // Called when the container item instance is removed from a parent inventory.
    virtual void RemovedFromInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance) override;
    // --- End Overrides ---

    // Pointer to the actual child Tetris inventory component managed by this container instance.
    UPROPERTY(EditAnywhere, BlueprintReadOnly) // EditAnywhere typically not needed here, just Visible/ReadOnly usually
    TObjectPtr<ULyraTetrisInventoryManagerComponent> ChildInventory;
};
```

* **`ChildInventory`:** The crucial pointer to the dynamically created `ULyraTetrisInventoryManagerComponent` associated _only_ with this specific container item instance.

### Configuration (on `InventoryFragment_Container`)

When adding this fragment to an item definition, you configure the properties of the child inventory it will create:

* **`ContainerName` (FText):** Name for the child inventory (e.g., "Backpack Interior").
* **`InventoryLayout` (`TArray<FInventoryLayoutCreator>`):** **Required.** Defines the grid layout _inside_ this container.
* **`StartingItems` (`TArray<FInventoryStartItemDetails>`):** Items that automatically appear inside the container when it's first created.
* **`MaxWeight` (float):** Weight limit _for the child inventory_.
* **`bIgnoreChildInventoryWeights` (bool):** Does _this child inventory_ ignore the weight of items within _its own_ child containers? (Relevant for containers within containers).
* **`ItemCountLimit` (int32):** Item count limit _for the child inventory_.
* **`bIgnoreChildInventoryItemCounts` (bool):** Does _this child inventory_ ignore the item count of _its own_ child containers?
* **`AllowedItems` / `DisallowedItems` (TSet):** Item type restrictions _for the child inventory_.
* **`SpecificItemCountLimits` (`TArray<FPickupTemplate>`):** Specific item limits _for the child inventory_.
* **`bIgnoreChildInventoryItemLimits` (bool):** Does _this child inventory_ ignore specific limits within _its own_ child containers?

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
