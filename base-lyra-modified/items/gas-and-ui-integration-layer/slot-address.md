# Slot Address

When triggering Gameplay Abilities for item related actions, directly passing pointers like `ULyraInventoryItemInstance*` from the client is insecure. To solve this, the system uses **`FAbilityData_SourceItem`** and its derived structs. These act as **safe, abstract "locators"** for items, encapsulating the information needed for the server to find an item authoritatively.

***

These locators are typically wrapped in `FInstancedStruct` when passed through GAS, allowing diverse locator types to be handled generically.

### The Base Struct: `FAbilityData_SourceItem`

* **Abstract Base:** Defines the contract for all item locators.
* **Core Functionality:**
  * `virtual ULyraInventoryItemInstance* GetSourceItem(const EItemContainerAccessRights RequiredAccessRights, const EItemContainerPermissions& RequiredPermission, APlayerController* PlayerController) const`:
    * **The Key Method:** Overridden by derived structs. Runs **on the server/authority**.
    * **Responsibilities:**
      1. Uses its internal data (e.g., component reference, index, tags) to attempt to locate the `ULyraInventoryItemInstance`.
      2. Performs **Access Right and Permission checks** using the provided `PlayerController` and required access/permissions.
      3. Returns a validated `ULyraInventoryItemInstance*` **only if** found AND checks pass; `nullptr` otherwise.
  * `virtual FString GetDebugString() const`: For logging.
  * `virtual bool IsEqual(const FInstancedStruct& Other) const`: To compare if two locators (wrapped in `FInstancedStruct`s) point to the same logical item/slot.

#### Benefits of the `FAbilityData_SourceItem` Approach:

* **Abstraction & Decoupling:** The UI or calling system doesn't need to know the specifics of _where_ an item is (inventory, equipment, attachment). It just creates the appropriate `FAbilityData_SourceItem` derivative and passes it. The server-side ability then polymorphically calls `GetSourceItem`. This means the **UI doesn't care where the item came from or is going to** in terms of concrete types, as long as a locator struct can represent it.
* **Server-Side Authority & Security:** Item resolution and permission/access checks are centralized in the `GetSourceItem` implementations and always occur on the server, preventing client-side exploits. The client sends a "request to find," not a direct item reference.
* **Extensibility:** New item container types or item location schemes can be supported by creating new structs derived from `FAbilityData_SourceItem` without altering existing abilities or UI logic that consumes these locators generically.
* **Simplified UI Logic:** Because all source/destination locations can be represented by this common system (via `FInstancedStruct` holding an `FAbilityData_SourceItem` derivative), UI elements like a **single "move icon" widget** can be used for dragging items from any supported source. The move icon simply needs to store and provide this `FInstancedStruct` payload. This significantly reduces the number of specialized UI widgets needed for different drag-and-drop scenarios.

***

### Derived Locator Structs

These concrete structs implement `FAbilityData_SourceItem` and provide specific ways to locate items:

**`FInventoryAbilityData_SourceItem`**

* **Identifies:** An item within a standard `ULyraInventoryManagerComponent` list.
* **Members:**
  * `InventoryManager` (`TObjectPtr<ULyraInventoryManagerComponent>`): A direct pointer to the inventory component. (Safe because the struct is created server-side or resolved from context).
  * `Index` (`int32`): The index of the item within the `InventoryManager`'s `InventoryList.Entries` array.
* **`GetSourceItem` Logic:** Checks player's `FullAccess` and `RequiredPermission` for `InventoryManager`, then returns `InventoryManager->GetAllItems()[Index]` if valid.

<img src=".gitbook/assets/image (6) (1) (1) (1) (1).png" alt="" width="316" title="Inventory Source Slot">

**`FEquipmentAbilityData_SourceEquipment`**

* **Identifies:** An item currently equipped in a specific slot within a `ULyraEquipmentManagerComponent`.
* **Members:**
  * `EquipmentManager` (`TObjectPtr<ULyraEquipmentManagerComponent>`): Pointer to the equipment manager.
  * `EquipmentSlot` (`FGameplayTag`): The Gameplay Tag identifying the equipment slot.
* **`GetSourceItem` Logic:** Checks if the `PlayerController`'s Pawn owns the `EquipmentManager`. Calls `EquipmentManager->GetInstanceFromSlot(EquipmentSlot)`. If an `EquipmentInstance` is found, it returns its `Instigator` (the `ULyraInventoryItemInstance*`).

<img src=".gitbook/assets/image (7) (1) (1) (1).png" alt="" width="375" title="Equiupment Source Slot">

**`FAttachmentAbilityData_SourceAttachment`**

* **Identifies:** An item attached to another item, potentially through multiple nested levels.
* **Members:**
  * `RootAttachmentSlot` (`FInstancedStruct`): The _starting point_ of the attachment chain (could be an `FInventoryAbilityData_SourceItem`, `FEquipmentAbilityData_SourceEquipment`, or another `FAttachmentAbilityData_SourceAttachment`).
  * `ContainerAttachmentPath` (`TArray<FGameplayTag>`): An ordered list of attachment slot tags defining the path from the `RootAttachmentSlot`'s item down to the _container_ item.
  * `AttachmentSlot` (`FGameplayTag`): The _final_ slot tag on the container item that holds the target attached item instance. If empty, refers to the container itself.
* **`GetSourceItem` Logic:** Resolves the `RootAttachmentSlot` to get the starting item instance. Then, it traverses the `ContainerAttachmentPath`, resolving each tag to the next `ULyraInventoryItemInstance` in the attachment chain (typically via an attachment fragment). Finally, it uses the `AttachmentSlot` on the last found container to get the target item. Permission checks are typically based on the root item's container.

<img src=".gitbook/assets/image (8) (1) (1) (1).png" alt="" width="375" title="Attachment Source Slot">

**`FNullSourceSlot`**

* **Identifies:** An invalid or non-specific location.
* **Members:** None.
* **`GetSourceItem` Logic:** Always returns `nullptr`.
* **Use Case:** Represents dropping an item into the world, or an invalid slot in UI interactions.

<img src=".gitbook/assets/image (9) (1) (1) (1).png" alt="" width="181" title="Null Source Slot">

***

### Usage in the Workflow

1. **UI / Client Logic:** When an action occurs (e.g., drag-drop), the client code determines the source and destination locations. It creates instances of the appropriate derived structs (`FInventoryAbilityData_SourceItem`, etc.) filling them with the known contextual information (e.g., the inventory component the UI is displaying, the clicked index).
2. **Function Library Call:** The client calls a function from `UInventoryAbilityFunctionLibrary` (e.g., `CallGameplayAbilityFromUIWithMoveItem`), passing the created source and destination structs.
3. **Packaging:** The function library wraps these structs into an `FInstancedStruct` (or packs them into `FAbilityData_MoveItem` first) and sends them within the `GameplayEventData`'s context handle.
4. **Server-Side Ability:** The Gameplay Ability activated by the event on the server receives the `GameplayEventData`.
5. **Data Retrieval:** The ability uses `UInventoryAbilityFunctionLibrary::GetCustomAbilityData` to extract the `FInstancedStruct` payload (which contains the single source struct or the `FAbilityData_MoveItem` struct).
6. **Resolution & Validation:** The ability calls `UInventoryAbilityFunctionLibrary::GetItemFromAbilitySourceItemStruct` (or directly calls the virtual `GetSourceItem` via the struct pointer in c++) for the source (and destination if applicable) struct(s), passing the necessary `EItemContainerPermissions` required for the action.
7. **Action Execution:** Only if the `GetSourceItem` calls return valid `ULyraInventoryItemInstance` pointers (meaning permissions passed and items were found) does the ability proceed to call the authoritative functions on the `ULyraInventoryManagerComponent` or other relevant systems

***

The `FAbilityData_SourceItem` hierarchy provides the crucial layer of abstraction and security needed for client-initiated inventory actions. By passing these locator structs instead of direct pointers, the server retains full control over validating requests and permissions before modifying authoritative inventory state.
