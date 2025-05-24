---
description: 'GAS & UI Integration: UI Updates via Gameplay Messages'
---

# UI Updates via Gameplay Message

While the Gameplay Ability System (GAS) integration handles requests flowing _from_ the UI _to_ the inventory system, **Gameplay Messages** handle communication in the other direction: informing the UI and other interested systems about authoritative changes _within_ the inventory.

This decouples the UI from the Inventory Manager, preventing the need for the UI to constantly poll the inventory for changes or maintain direct references beyond the local player's components.

### The Problem: Keeping UI Synchronized

When the state of an inventory changes on the server (e.g., an item is added, removed, stacked, moved, or its properties change), clients need to be notified so their UI can reflect the correct information. Relying solely on `OnRep` functions within the UI widget itself can lead to complex logic and tight coupling.

### The Solution: Broadcasting State Changes

The `ULyraInventoryManagerComponent` and related systems broadcast specific Gameplay Messages via the `UGameplayMessageSubsystem` whenever a relevant state change occurs _after_ it has been processed authoritatively (either directly on the server or via replication callbacks on the client).

**Key Principles:**

* **Decoupling:** The Inventory Manager broadcasts messages without knowing _who_ is listening. The UI listens without needing a direct function call from the Manager.
* **Event-Driven:** UI updates happen in response to specific event messages, rather than continuous polling.
* **Targeted Listening:** UI widgets typically listen for messages relevant only to the inventory components they are currently displaying (often filtered by the component pointer or an owning Actor).

### Core Inventory Messages

These are the main messages broadcast by `ULyraInventoryManagerComponent` and related classes:

* **`TAG_Lyra_Inventory_Message_StackChanged` (`FLyraInventoryChangeMessage`)**
  * **Broadcast By:** `FLyraInventoryList`'s replication callbacks (`PreReplicatedRemove`, `PostReplicatedAdd`, `PostReplicatedChange`) and functions that modify stack counts directly (`UpdateItemCount`, etc.).
  * **Payload:**
    * `InventoryOwner`: The `ULyraInventoryManagerComponent*` whose list changed.
    * `Instance`: The `ULyraInventoryItemInstance*` affected.
    * `NewCount`: The final stack count for the `Instance` in its entry.
    * `Delta`: The change in stack count (`NewCount` - OldCount).
  * **Purpose:** The primary message indicating that the contents or stack size within the `InventoryList` have changed. This is the most common message UI will listen for to trigger a general refresh of the displayed inventory slots.

<figure><img src="../../../.gitbook/assets/image (57).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_Inventory_Message_WeightChanged` (`FLyraInventoryWeightChangeMessage`)**
  * **Broadcast By:** `ULyraInventoryManagerComponent::OnRep_Weight`.
  * **Payload:**
    * `InventoryComponent`: The inventory whose weight changed.
    * `NewWeight`: The updated total weight.
  * **Purpose:** Notifies listeners about changes to the inventory's total calculated weight. Useful for updating weight display indicators in the UI.

<figure><img src="../../../.gitbook/assets/image (58).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_Inventory_Message_ItemCountChanged` (`FLyraInventoryItemCountChangeMessage`)**
  * **Broadcast By:** `ULyraInventoryManagerComponent::OnRep_ItemCount`.
  * **Payload:**
    * `InventoryComponent`: The inventory whose item count changed.
    * `NewItemCount`: The updated total item count.
  * **Purpose:** Notifies listeners about changes to the inventory's total item count (based on fragment contributions). Useful for UI indicators showing slots used/total.

<figure><img src="../../../.gitbook/assets/image (65).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_ItemPermission_Message_AccessRightChanged` (`FItemAccessRightsChangedMessage`)**
  * **Broadcast By:** `UItemPermissionComponent::BroadcastAccessChanged` (called directly on the server or by replication callbacks for default/specific rights on clients).
  * **Payload:**
    * `Container` (`UObject*`): The container (e.g., `ULyraInventoryManagerComponent`)
    * `PlayerController`: The `APlayerController*` whose access right changed.
    * `AccessRight`: The new `EItemContainerAccessRights`.
  * **Purpose:** Crucial for UI to react to changes in visibility/interactability based on `EItemContainerAccessRights`.

<figure><img src="../../../.gitbook/assets/image (60).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_ItemPermission_Message_PermissionsChanged` (`FItemPermissionsChangedMessage`)**
  * **Broadcast By:** `UItemPermissionComponent::BroadcastPermissionChanged` (called directly on the server or by replication callbacks for default/specific permissions on clients).
  * **Payload:**
    * `Container` (`UObject*`): The container.
    * `PlayerController`: The `APlayerController*` whose permissions changed.
    * `Permissions`: The new `EItemContainerPermissions` bitmask.
  * **Purpose:** Allows UI to enable/disable specific actions based on the player's current `EItemContainerPermissions`&#x20;

<figure><img src="../../../.gitbook/assets/image (61).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_Inventory_Message_Notification` (`FLyraInventoryNotificationMessage`)**
  * **Broadcast By:** `ULyraInventoryManagerComponent::ClientBroadcastNotification_Implementation` (called via server RPC, usually from `CanAddItem` failures).
  * **Payload:** `InventoryOwner`, `Message` (`FText`), `MessageIcon`, `MessageColor`.
  * **Purpose:** Provides a way for the inventory system (specifically server-side logic like add checks) to send user-facing feedback messages (e.g., "Inventory Full", "Max Weight Reached") directly to the client for display in the UI.

<figure><img src="../../../.gitbook/assets/image (62).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_Inventory_Message_ItemObtained` (`FLyraVerbMessage`)**
  * **Broadcast By:** `ULyraInventoryManagerComponent::BroadcastItemObtained_Implementation` (called via server RPC after successfully adding items via `TryAddItemDefinition` or `TryAddItemInstance`).
  * **Payload:** Standard `FLyraVerbMessage` (`Instigator`, `Target`=`ItemInstance`, `Magnitude`=`AmountAdded`).
  * **Purpose:** Specifically signals that new items were successfully added, often used for "Item Acquired" popups or feedback distinct from general inventory changes.

<figure><img src="../../../.gitbook/assets/image (63).png" alt="" width="563"><figcaption></figcaption></figure>

* **`TAG_Lyra_Inventory_Message_ItemVisualChange` (`FItemInstanceVisualChangeMessage`)**
  * **Broadcast By:** `ULyraInventoryManagerComponent::BroadcastItemInstanceVisuallyChanged`. Can be called by other systems (like the Attachment fragment) when an item's appearance needs updating but its core stack count hasn't changed.
  * **Payload:** `ItemInstance`.
  * **Purpose:** A generic hint that something about the item instance has changed that might require a visual refresh in the UI (e.g., an attachment was added/removed, durability changed appearance tiers). UI listening for this should re-render the specific item slot associated with the `ItemInstance`.

<figure><img src="../../../.gitbook/assets/image (64).png" alt="" width="563"><figcaption></figcaption></figure>

***

Using Gameplay Messages provides a clean, decoupled way for the Inventory System to communicate authoritative state changes back to the UI and other interested gameplay systems, enabling reactive and synchronized user experiences without tight dependencies.
