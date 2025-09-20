# Using the Ability Function Library

A key advantage of the integration design is that the **existing `UInventoryAbilityFunctionLibrary` from the base Lyra system works seamlessly with the Tetris inventory's grid-specific data structures.** You don't need a separate function library for Tetris interactions.

This is achieved through the use of **wildcard struct pins** (`CustomStructureParam`) on the library's core Blueprint nodes.

### Leveraging Wildcard Inputs

The relevant nodes in `UInventoryAbilityFunctionLibrary` that accept item source/destination information are designed with wildcard inputs:

* **`Call Gameplay Ability From UI (Generic)`:** Has one `Instanced Struct` wildcard input.
* **`Call Gameplay Ability From UI (Move Item)`:** Has two wildcard inputs: `Source Slot` and `Destination Slot`.
* **`Get Item From Ability Source Item Struct`:** Has one `Data Struct` wildcard input.

**How it Works:**

1. **Blueprint Connection:** In your UI widget Blueprint, you create an instance of your desired source data struct (which _must_ inherit from `FAbilityData_SourceItem`). For Tetris interactions, this will typically be `FInventoryAbilityData_SourceTetrisItem`.
2. **Direct Connection:** You can directly connect the output pin of your `Make InventoryAbilityData_SourceTetrisItem` node (or a variable holding such a struct) to the wildcard input pin (e.g., `Source Slot`) on the function library node.
3. **Custom Thunk Magic:** When the Blueprint executes, the node's `CustomThunk` C++ implementation:
   * Detects the actual struct type connected (`FInventoryAbilityData_SourceTetrisItem` in this case).
   * Automatically creates an `FInstancedStruct`.
   * Copies the data from your connected struct into the `FInstancedStruct`.
   * Passes this `FInstancedStruct` payload into the GAS event context.
4. **Server Receives InstancedStruct:** The server-side ability receives the `FInstancedStruct` payload.
5. **Resolution:** The ability uses `GetCustomAbilityData` to extract the `FInstancedStruct` and then `GetItemFromAbilitySourceItemStruct` (or directly accesses the pointer via `GetPtr<FAbilityData_SourceItem>`) to call the virtual `GetSourceItem` function. Because `FInventoryAbilityData_SourceTetrisItem` overrides this function, its specific grid-based resolution and permission-checking logic is executed correctly on the server.

### Example: Moving an Item in UI Blueprint

Here's how you would typically wire up a drag-and-drop move operation within a Tetris inventory UI widget:

**Assume you have variables: `MyPlayerStateRef`, `MyTetrisInventoryRef`, `SourceSlotInfo` (`FInventoryAbilityData_SourceTetrisItem`), `DestinationSlotInfo` (`FInventoryAbilityData_SourceTetrisItem`)**

1. **OnDrop Event:** When the player drops the item:
   * Populate `SourceSlotInfo` with the details of where the drag started (Inventory Ref, ClumpID, Position, Rotation).
   * Populate `DestinationSlotInfo` with the details of where the item was dropped (Inventory Ref, ClumpID, Position, Desired Rotation (e.g., from player input)).
2. **Call Move Ability:**
   * Get the `Call Gameplay Ability From UI (Move Item)` node from `Inventory Ability Function Library`.
   * Connect `MyPlayerStateRef` to `Lyra Player State`.
   * Select the appropriate `Event Tag` (e.g., `Ability.Inventory.RequestMoveItem`).
   * Connect `SourceSlotInfo` directly to the `Source Slot` wildcard pin.
   * Connect `DestinationSlotInfo` directly to the `Destination Slot` wildcard pin.
   * Connect the execution pins.

<img src=".gitbook/assets/image (168).png" alt="" width="563" title="Move icon being dropped on tetris inventory cell">

That's it! The base function library node handles the necessary packaging. You don't need separate nodes for handling `FInventoryAbilityData_SourceTetrisItem` versus the base `FInventoryAbilityData_SourceItem` or other derived types like `FEquipmentAbilityData_SourceEquipment`.

This seamless integration simplifies the UI logic significantly, as you only need to prepare the correct source data struct for the context (list index for base inventory, grid coordinates for Tetris inventory, equipment tag for equipment) and use the same library function to send the event.
