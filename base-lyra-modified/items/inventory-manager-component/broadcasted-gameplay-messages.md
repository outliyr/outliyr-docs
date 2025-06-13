# Broadcasted Gameplay Messages

The `ULyraInventoryManagerComponent` uses the **Gameplay Message Subsystem** to announce authoritative state changes. UI and other gameplay systems can listen for these messages to react to updates without being directly coupled to the component.

The following messages are broadcast by this component.).

***

*   **`TAG_Lyra_Inventory_Message_StackChanged` (`FLyraInventoryChangeMessage`)**

    * **Broadcast When:** An item is added, removed, or a stack's count changes. Fired from the `FLyraInventoryList` replication callbacks (`PreReplicatedRemove`, `PostReplicatedAdd`, `PostReplicatedChange`).
    * **Payload:**
      * `InventoryOwner`: The `ULyraInventoryManagerComponent*` whose list changed.
      * `Instance`: The `ULyraInventoryItemInstance*` affected.
      * `NewCount`: The final stack count for the `Instance` in its entry.
      * `Delta`: The change in stack count (`NewCount` - OldCount).
    * **Purpose:** The primary message for UI to trigger a general refresh of displayed inventory slots.

    <img src=".gitbook/assets/image (7) (1).png" alt="" width="563" title="">
*   **`TAG_Lyra_Inventory_Message_ItemVisualChange` (`FItemInstanceVisualChangeMessage`)**

    * **Broadcast When:** Something about the item instance has changed that might require a visual refresh, but its core stack count hasn't. Called by `BroadcastItemInstanceVisuallyChanged`.
    * **Payload:** `ItemInstance`.
    * **Purpose:** A generic hint for UI to re-render a specific item slot (e.g., an attachment was added, durability changed, etc.).

    <img src=".gitbook/assets/image (13) (1).png" alt="" width="563" title="">
*   **`TAG_Lyra_Inventory_Message_WeightChanged` (`FLyraInventoryWeightChangeMessage`)**

    * **Broadcast When:** The total weight of the inventory changes. Fired from `OnRep_Weight`.
    * **Payload:** `InventoryComponent`, `NewWeight`.
    * **Purpose:** To update UI elements like a weight bar or text indicator.

    <img src=".gitbook/assets/image (8) (1).png" alt="" width="563" title="">
*   **`TAG_Lyra_Inventory_Message_ItemCountChanged` (`FLyraInventoryItemCountChangeMessage`)**

    * **Broadcast When:** The total item count of the inventory changes. Fired from `OnRep_ItemCount`.
    * **Payload:** `InventoryComponent`, `NewItemCount`.
    * **Purpose:** To update UI indicators showing slots used versus total capacity.

    <img src=".gitbook/assets/image (9) (1).png" alt="" width="563" title="">
*   **`TAG_Lyra_Inventory_Message_Notification` (`FLyraInventoryNotificationMessage`)**

    * **Broadcast When:** The server-side logic needs to send a specific user-facing message to a client (e.g., "Inventory Full"). Called via RPC.
    * **Payload:** `InventoryOwner`, `Message` (`FText`), `MessageIcon`, `MessageColor`.
    * **Purpose:** Displaying direct feedback notifications in the UI.

    <img src=".gitbook/assets/image (12) (1).png" alt="" width="563" title="">
*   **`TAG_Lyra_Inventory_Message_ItemObtained` (`FLyraVerbMessage`)**

    * **Broadcast When:** New items are successfully added to the inventory via `TryAddItem...`. Called via RPC.
    * **Payload:** Standard `FLyraVerbMessage` (carries Instigator, ItemInstance, and Amount).
    * **Purpose:** To trigger special UI feedback like "Item Acquired!" popups.

    <img src=".gitbook/assets/image (10) (1).png" alt="" width="563" title="">
