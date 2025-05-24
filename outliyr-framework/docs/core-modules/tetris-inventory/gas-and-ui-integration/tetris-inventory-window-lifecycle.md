# Tetris Inventory Window Lifecycle

## GAS & UI: (Optional) Tetris Inventory Window Lifecycle

While not strictly mandatory for basic functionality, managing the lifecycle of UI windows associated with Tetris inventories, especially those belonging to container items (`InventoryFragment_Container`), often benefits from integration with the Gameplay Ability System (GAS). This ensures proper server validation and potentially allows for gameplay logic to influence window opening/closing.

### The Challenge

* **Opening Container UI:** When should a player be allowed to open the UI for a backpack they have equipped or a chest in the world? Simply clicking might not be enough; perhaps they need to be stationary, or the container needs to be unlocked.
* **Closing Container UI:** When should a container's UI window automatically close?
  * When the container item is destroyed or removed from the player's inventory/equipment.
  * When the player moves too far away from a world container.
  * When gameplay state changes (e.g., entering combat).

### Potential GAS-Based Solutions

Instead of handling all this logic purely within the UI widgets or Player Controller, GAS provides a structured approach:

**1. Opening Windows via Gameplay Ability:**

* **UI Trigger:** The UI (e.g., right-click menu on container item, interaction prompt for world container) sends a Gameplay Event like `Event.Inventory.RequestOpenContainer`.
* **Payload:** The event payload could be:
  * `FInventoryAbilityData_SourceTetrisItem` (or base `FInventoryAbilityData_SourceItem`) identifying the container item itself.
  * A custom struct containing the `ULyraTetrisInventoryManagerComponent*` of the container to open (obtained client-side via the item's transient fragment) and potentially the `APlayerController*`.
* **Gameplay Ability (`GA_Inventory_OpenContainer`) Activation:**
  * **Server:** Receives the event.
  * **Validation:** Performs necessary checks:
    * Does the player have `FullAccess` to the _parent_ inventory holding the container item (or the container itself if it's a world object)?
    * Does the player have a specific permission like `UseItems` or a custom `OpenContainer` permission?
    * Are gameplay conditions met (e.g., not sprinting, not in combat)? (Uses Gameplay Ability Tags/Tasks).
  * **Action (Server):** If validation passes, sends a client-targeted Gameplay Event or RPC back to the initiating player _confirming_ they can open the window. Could potentially also set access rights/permissions on the child inventory if needed (though usually inherited).
  * **Client:** Receives the confirmation event/RPC and proceeds to create and display the container's UI widget.

**2. Closing Windows via Gameplay Message / Ability:**

* **Server-Initiated Close (`TAG_Lyra_Inventory_Message_DestroyGridWindow`):**
  * As implemented in `ULyraTetrisInventoryManagerComponent::ClientCloseInventoryWindow_Implementation`.
  * **Trigger:** Server logic determines the window needs to close (e.g., container item destroyed via `FTransientFragmentData_Container::DestroyTransientFragment`, player moved away from world container).
  * **Action:** Server calls `ClientCloseInventoryWindow` RPC on the component.
  * **Message:** The RPC broadcasts the `TAG_Lyra_Inventory_Message_DestroyGridWindow` message locally on all clients.
  * **Payload:** `FInventoryAbilityData_DestroyTetrisInventoryWindow` containing the `Inventory` component whose window should close.
  * **UI Handling:** The relevant UI widget listens for this message. If the `Inventory` matches the one it's displaying, it closes itself.
* **Client-Initiated Close (e.g., 'Esc' key, Close Button):**
  * This can often be handled purely client-side within the widget itself (e.g., RemoveFromParent). No server interaction is strictly needed just to close the visual window.

### Supporting Data Structures

The following structs facilitate these GAS interactions:

* **`FInventoryAbilityData_CreateTetrisInventoryWindow`:**
  * _(Note: This seems less like an ability payload and more like data needed client-side AFTER server grants permission to open. The server likely wouldn't create the window directly.)_
  * Could potentially be sent from server to client _after_ validation, providing the necessary info (`NewInventory` component, `InventoryItemOwnerDefinition` for client-side init, `PlayerController`) for the client to construct the correct UI.
* **`FInventoryAbilityData_DestroyTetrisInventoryWindow`:**
  * Used as the payload for the `TAG_Lyra_Inventory_Message_DestroyGridWindow` message.
  * `Inventory`: Identifies the specific `ULyraTetrisInventoryManagerComponent` whose associated window should be closed.
  * `PlayerController`: _Potentially_ used to exclude specific players from the close message (though the current implementation seems to broadcast globally).

### Benefits of GAS Integration

* **Server Authority:** Ensures server validates conditions before allowing a window to be opened.
* **Gameplay Condition Integration:** Easily tie window opening/closing to game state using Gameplay Tags and Ability Tasks.
* **Decoupling:** Server logic dictates _when_ windows must close, rather than relying on the client UI to detect all conditions.
* **Clearer Flow:** Actions related to inventory interaction are handled within Gameplay Abilities, keeping responsibilities focused.

### Implementation Notes

* The provided code includes the `DestroyGridWindow` message and the RPC to trigger it, offering a solid mechanism for server-forced closure.
* Implementing the "Open via Ability" pattern requires creating the corresponding Gameplay Ability (`GA_Inventory_OpenContainer`), defining trigger tags, adding validation logic, and potentially creating a client-targeted event/RPC for confirmation.
* Carefully consider which actions require server authority (opening based on game state, forced closing) versus those that can be client-only (closing via 'Esc').

While not strictly required for displaying items, integrating the opening and server-forced closing of inventory windows (especially for containers) with GAS provides a more robust, secure, and gameplay-integrated solution compared to handling everything purely in the UI or Player Controller.
