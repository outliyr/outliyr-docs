# GAS & API

Interacting with attachments during gameplay often involves using Gameplay Abilities (GAS) or specific C++ / Blueprint functions designed for the attachment system. This page covers the key tools and concepts for these interactions.

### Identifying Attached Items: `FAttachmentAbilityData_SourceAttachment`

As covered in the "GAS & UI Integration" section, directly passing item instance pointers isn't safe or reliable for triggering abilities. When you need a Gameplay Ability to target or originate from an item specifically located within an attachment slot (potentially nested), you must use the `FAttachmentAbilityData_SourceAttachment` struct.

**Recap:**

* **Purpose:** Acts as a safe locator/identifier for an attached item.
* **Structure:**
  * `RootAttachmentSlot` (`FInstancedStruct`): Identifies the ultimate root item (in an inventory or equipment slot).
  * `ContainerAttachmentPath` (`TArray<FGameplayTag>`): The sequence of slot tags leading from the root item down to the immediate parent/container of the target attachment.
  * `AttachmentSlot` (`FGameplayTag`): The final slot tag on the parent/container that holds the target item instance. (If empty, refers to the container itself).
* **Resolution:** The server-side `GetSourceItem` implementation navigates this path, performing permission checks at the root, to resolve the struct into a validated `ULyraInventoryItemInstance*`.

**Usage:**

* When triggering an ability from UI that targets an attached item (e.g., right-clicking an attached scope), the UI needs to construct the correct `FAttachmentAbilityData_SourceAttachment` struct representing that item's location and pass it via the `UInventoryAbilityFunctionLibrary`.
* Abilities receiving this struct use `GetItemFromAbilitySourceItemStruct` or `GetCustomAbilityData` + `GetSourceItem` to resolve it back to an instance pointer _on the server_.

### Abilities Granted By Attachments: `ULyraGameplayAbility_FromAttachment`

When an attachment grants an ability (defined in the `FAttachmentDetails` -> `FAttachmentBehaviour` -> `AbilitySetsToGrant`), it's highly recommended that the ability class inherits from `ULyraGameplayAbility_FromAttachment`.

**Benefits & Helpers:**

* **Contextual Awareness:** Provides functions to easily determine the context of the ability activation:
  * `GetAssociatedParentAttachmentItem() const`: Returns the `ULyraInventoryItemInstance*` of the item that _hosts_ the attachment granting this ability (this is the `SourceObject` passed during `GiveAbility`).
  * `GetAssociatedAttachmentItem() const`: Determines which _specific_ attachment in the parent's `AttachmentArray` granted this ability by checking the ability spec's dynamic source tags (which include the `AttachmentSlot` tag) and returns the corresponding `ULyraInventoryItemInstance*`.
  * `GetAssociatedEquipmentInstance() const`: Finds the `ULyraEquipmentInstance*` associated with the ultimate root item this attachment chain is connected to (if equipped).
  * `GetAssociatedEquipmentItem() const`: Gets the root `ULyraInventoryItemInstance*` if the chain is equipped.
  * `GetSpawnAttachmentActor() const`: Finds the visual `AActor*` spawned specifically for the attachment that granted this ability.
* **Simplified Logic:** Avoids manual casting and navigation through the `UTransientRuntimeFragment_Attachment` data structures within the ability's logic.

**Example Usage (in `GA_ToggleScopeZoom` derived from `ULyraGameplayAbility_FromAttachment`):**

```cpp
void UGA_ToggleScopeZoom::ActivateAbility(...)
{
    // Get the actual scope item instance that granted this ability
    if (ULyraInventoryItemInstance* ScopeItemInstance = GetAssociatedAttachmentItem())
    {
        // Get the scope's runtime fragment if it has custom zoom state/logic
        if (UMyScopeRuntimeFragment* ScopeFragment = ScopeItemInstance->ResolveTransientFragment<UInventoryFragment_MyScope>()) // Assuming a custom fragment
        {
             ScopeFragment->ToggleZoomLevel();
        }

        // Get the visual actor for the scope
        if (AActor* ScopeActor = GetSpawnAttachmentActor())
        {
             // Apply visual changes to the scope actor based on zoom level...
        }

        // Get the parent weapon instance
        if (ULyraInventoryItemInstance* ParentWeaponItem = GetAssociatedParentAttachmentItem())
        {
            // Maybe interact with the parent weapon...
        }
    }
}
```

### Core API Functions (`UInventoryFragment_Attachment` Statics)

The `UInventoryFragment_Attachment` class provides static Blueprint-callable functions for common attachment operations. These should typically be called **on the server** or wrapped in server RPCs if initiated by client UI/interaction.

* `AddAttachmentToItemInstance(ULyraInventoryItemInstance* AttachmentContainerItemInstance, ULyraInventoryItemInstance* AttachmentItemInstance, const FGameplayTag& AttachmentSlotID)`
  * **Action:** The primary function to attach an existing `AttachmentItemInstance` to the `AttachmentContainerItemInstance` in the specified `AttachmentSlotID`.
  * **Logic:**
    1. Checks validity of inputs.
    2. Calls `CanAttachItem` to verify compatibility and slot availability.
    3. Retrieves the `UTransientRuntimeFragment_Attachment` from the container instance.
    4. Finds the correct `FAttachmentDetails` from the container's static fragment definition.
    5. Constructs an `FAppliedAttachmentEntry`.
    6. Calls `AttachmentTransientData->AddAttachment`.
    7. Calls `BroadcastAttachmentSlotChanged`.
    8. Calls `SetItemCurrentSlot` to update the attached item's location tracker.
  * **Returns:** `true` if successfully attached, `false` otherwise.
* `RemoveAttachmentFromItemInstance(ULyraInventoryItemInstance* AttachmentContainerItemInstance, const FGameplayTag& AttachmentSlot)`
  * **Action:** Removes the attachment currently residing in the `AttachmentSlot` of the `AttachmentContainerItemInstance`.
  * **Logic:**
    1. Checks validity.
    2. Retrieves the `UTransientRuntimeFragment_Attachment`.
    3. Calls `AttachmentTransientData->RemoveAttachment(AttachmentSlot)`. This internally handles deactivation and removal from the array.
    4. Broadcasts `BroadcastAttachmentSlotChanged` (with `bRemoved = true`).
    5. Sets the removed item's `CurrentSlot` back to `FNullSourceSlot`.
  * **Returns:** The `ULyraInventoryItemInstance*` that was removed, or `nullptr` if the slot was empty or invalid.
* `CanAttachItem(ULyraInventoryItemInstance* AttachmentContainerItemInstance, ULyraInventoryItemInstance* AttachmentItemInstance, const FGameplayTag& AttachmentSlotID)`
  * **Action:** Checks if `AttachmentItemInstance` is compatible with the `AttachmentSlotID` on `AttachmentContainerItemInstance` and if the slot is currently empty.
  * **Logic:** Reads the `CompatibleAttachments` map on the container's static fragment and checks the container's runtime fragment `AttachmentArray`.
  * **Returns:** `true` if attachment is possible, `false` otherwise.
* `BroadcastAttachmentSlotChanged(ULyraInventoryItemInstance* AttachmentContainerItemInstance, FAppliedAttachmentEntry AttachmentInfo, bool bRemoved)`
  * **Action:** Broadcasts the `TAG_Lyra_Inventory_Message_AttachmentChanged` gameplay message. Called internally by Add/Remove functions but can be called manually if needed.

### Attachment Location Helper Library (`UAttachmentFunctionLibrary`)

This library provides Blueprint utilities specifically for working with the `FAttachmentAbilityData_SourceAttachment` struct and understanding attachment paths, useful in complex ability logic or UI display that needs to handle nested attachments.

* `AreAttachmentSlotsFromSameChain`: Checks if two source slot structs originate from the same root inventory/equipment slot.
* `IsAttachmentSlot`: Checks if an `FInstancedStruct` holds an `FAttachmentAbilityData_SourceAttachment`.
* `IsValidAttachmentPath`: Checks if a path array is not empty.
* `DoesAttachmentPathStartWith`: Checks if one path is a prefix of another.
* `GetAttachmentContainerPathFromSlot`: Extracts the `ContainerAttachmentPath` array from a slot struct.
* `GetRemainingAttachmentPath`: Gets the part of a path _after_ a given prefix.
* `ReplaceAttachmentSlotChain`: Modifies an `FAttachmentAbilityData_SourceAttachment` struct to reparent its chain under a new root slot and path (useful if the parent container itself moves).

### Gameplay Messages

* **`TAG_Lyra_Inventory_Message_AttachmentChanged` (`FAttachmentSlotChangedMessage`)**
  * **Broadcast By:** `UInventoryFragment_Attachment::BroadcastAttachmentSlotChanged` (called by Add/Remove API). Also triggered by `FAppliedAttachmentArray` replication callbacks.
  * **Payload:** `AttachmentContainerItemInstance`, `AttachmentInfo` (`FAppliedAttachmentEntry` - contains SlotTag, ItemInstance, etc.), `bRemoved`.
  * **Purpose:** The primary message for UI or other systems to listen to for changes in attached items on a specific container. UI can use this to refresh attachment slot displays.

<img src=".gitbook/assets/image (4) (1) (1).png" alt="" width="563" title="">

* **`TAG_Lyra_Inventory_Message_ItemVisualChange` (`FItemInstanceVisualChangeMessage`)**
  * **Broadcast By:** Can be broadcast manually (e.g., by `UInventoryFragment_Attachment::CombineItems` after a successful attach) when an item's visual representation should update due to attachment changes, even if its core stack count didn't change.
  * **Payload:** `ItemInstance` (the container item whose visuals changed).
  * **Purpose:** A hint for UI to re-render the container item's slot.

<img src=".gitbook/assets/image (1) (1) (1) (1) (1).png" alt="" width="563" title="">

***

By utilizing the provided base ability class (`ULyraGameplayAbility_FromAttachment`), the static API functions (`Add/RemoveAttachmentToItemInstance`), the specialized locator struct (`FAttachmentAbilityData_SourceAttachment`), and listening to the relevant Gameplay Messages, you can build robust interactions and UI representations for the attachment system. Remember to handle modifications primarily on the server and rely on replication and messages for client updates.
