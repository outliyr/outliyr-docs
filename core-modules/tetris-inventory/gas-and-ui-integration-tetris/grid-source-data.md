# Grid Source Data

To communicate item locations within the spatial context of a Tetris grid through the Gameplay Ability System (GAS), the plugin introduces a specialized data structure: `FInventoryAbilityData_SourceTetrisItem`. This struct inherits from the base `FAbilityData_SourceItem` and provides the necessary information to precisely identify an item's root position and orientation within a specific `ULyraTetrisInventoryManagerComponent`.

### Purpose

* **Grid Location Identifier:** Acts as a safe, network-transmissible way to specify _where_ an item is located within a Tetris grid (which inventory component, which clump, which coordinate, and its rotation).
* **GAS Payload:** Designed to be wrapped in an `FInstancedStruct` and sent as part of the `FGameplayEventData` payload when triggering inventory-related Gameplay Abilities from the client (UI).
* **Server-Side Resolution:** Contains the logic (`GetSourceItem` override) for the server to use the provided grid information to securely find the actual `ULyraInventoryItemInstance` and perform necessary permission checks before executing an action.

### Struct Definition

**Key Members:**

* **`TetrisInventory`:** A pointer to the specific `ULyraTetrisInventoryManagerComponent` where the item/slot is located.
* **`Position`:** The (X, Y) coordinate of the item's **root cell** within the specified `ClumpID`.
* **`ClumpID`:** The identifier for the specific layout clump containing the `Position`.
* **`Rotation`:** The `EItemRotation` of the item located at this root position.
* **`TagContainer`:** Optional gameplay tags for extra context if needed by specific abilities (less commonly used for basic movement).

### `GetSourceItem` Override Logic

This is the crucial server-side validation function inherited from `FAbilityData_SourceItem`.

**Key Points:**

1. **Permission Delegation:** It calls `TetrisInventory->GetInventoryAccessRight` and `TetrisInventory->HasInventoryPermissions`. As detailed previously, these overridden functions on the Tetris component **delegate the actual check upwards to the root inventory component.** This ensures permissions are evaluated based on the ultimate owner's settings.
2. **Grid Lookup:** If permissions pass, it uses the `TetrisInventory` reference along with the `Position` and `ClumpID` stored in the struct to call `GetItemInstanceFromSlot`, which performs the fast coordinate lookup (`FindUIGridCell`) and returns the `ULyraInventoryItemInstance*` if found at that root slot.
3. **Security:** The client only sends the _location data_; the server performs the lookup and permission checks using its own authoritative state.

### Usage from UI

When a UI interaction involves a Tetris grid slot (e.g., clicking, dropping):

1. **Identify Context:** The UI widget determines:
   * The specific `ULyraTetrisInventoryManagerComponent` being displayed.
   * The `ClumpID` and `Position` (X, Y coordinates) of the interacted cell.
   * The current `Rotation` (often `Rotation_0` unless dealing with an already placed item).
2. **Create Struct:** Create an instance of `FInventoryAbilityData_SourceTetrisItem` in Blueprint (using `Make InventoryAbilityData_SourceTetrisItem`) or C++.
3. **Populate Struct:** Fill the struct members with the identified context information.
4. **Call Function Library:** Pass this struct to the appropriate node in `UInventoryAbilityFunctionLibrary` (e.g., `Call Gameplay Ability From UI (Move Item)` connected to the `Source Slot` or `Destination Slot` wildcard pin).

<img src=".gitbook/assets/image (166).png" alt="" width="563" title="Activate UseItem Menu Button in tetris inventory">

The function library handles wrapping this struct into an `FInstancedStruct` for transmission via the Gameplay Event, ensuring the server-side ability receives the necessary grid location information securely.
