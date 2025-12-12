# GAS & UI Integration (Tetris)

Integrating the User Interface (UI) with the `ULyraTetrisInventoryManagerComponent` follows the same secure and decoupled pattern established by the base Lyra inventory system, utilizing the Gameplay Ability System (GAS) as the intermediary. Client-side UI actions trigger Gameplay Events, which activate server-side Gameplay Abilities to perform authoritative actions on the inventory component.

**This section focuses on the specific additions and considerations for integrating UI with the&#x20;**_**Tetris**_**&#x20;inventory features.**

### Prerequisite: Understanding Base Integration

It is crucial to understand the fundamental GAS & UI integration workflow established in the base inventory system before proceeding. This includes:

* **The Problem:** Why direct UI-to-server calls are insecure and problematic.
* **The Solution:** How GAS acts as a secure interface using Gameplay Events and Abilities.
* **Key Components:** The role of `UInventoryAbilityFunctionLibrary`, `FAbilityData_SourceItem`, Gameplay Abilities, Event Tags, and Gameplay Messages.
* **Basic Workflow:** The step-by-step process of a UI action triggering a server ability.

**(Please review the** [**Base Lyra GAS & UI Integration Documentation**](../../../base-lyra-modified/items/gas-and-ui-integration-layer/) **for a full explanation of these concepts.)**

### Tetris-Specific Additions

The Tetris system builds upon the base integration layer primarily by introducing:

1. **Grid-Specific Source Data (`FInventoryAbilityData_SourceTetrisItem`):** A new struct derived from `FAbilityData_SourceItem` specifically designed to identify an item's location within a Tetris grid (using Clump ID, Position coordinates, and Rotation) instead of just a list index.
2. **Leveraging Existing Tools:** Demonstrating how the _existing_ `UInventoryAbilityFunctionLibrary` nodes can seamlessly handle the new `FInventoryAbilityData_SourceTetrisItem` struct thanks to their wildcard inputs.
3. **Grid-Specific Gameplay Messages:** New messages broadcast by the `ULyraTetrisInventoryManagerComponent` to inform the UI about changes specific to the grid state (e.g., cell updates, layout resizing).
4. **(Optional) Window Lifecycle Management:** Structs and potential events/abilities for managing the opening/closing of specific inventory windows, potentially tied to container items.

### Core Workflow Remains the Same

The fundamental flow for UI interaction (e.g., moving an item) remains unchanged:

1. **UI Action (Client):** Player drags item from Grid Slot A to Grid Slot B.
2. **Prepare Data (Client):** UI creates **`FInventoryAbilityData_SourceTetrisItem`** structs for both Slot A (source) and Slot B (destination), populating `TetrisInventory`, `ClumpID`, `Position`, and `Rotation`.
3. **Call Function Library (Client):** UI calls `UInventoryAbilityFunctionLibrary::CallGameplayAbilityFromUI (Move Item)`, passing the Player State, the appropriate `EventTag` (e.g., `Ability.Inventory.RequestMoveItem`), and the two `FInventoryAbilityData_SourceTetrisItem` structs connected to the wildcard pins.
4. **GAS Event Sent:** The library packages the data and sends the event to the server.
5. **Ability Activation (Server):** The corresponding server-side Gameplay Ability (e.g., `GA_Inventory_MoveItem`) activates.
6. **Resolve & Validate (Server):** The ability retrieves the `FAbilityData_MoveItem` payload, extracts the source/destination `FInventoryAbilityData_SourceTetrisItem` structs, and calls their `GetSourceItem` methods (passing required permissions). This validation checks the _root_ inventory's permissions and resolves the grid coordinates to actual `ULyraInventoryItemInstance` pointers _on the server_.
7. **Execute Action (Server):** If validation passes, the ability calls the appropriate function on the authoritative `ULyraTetrisInventoryManagerComponent` (e.g., `MoveItemInternally`, `MoveItemExternally`, `CombineItemStack`, `SplitItemStack`).
8. **State Replication:** The `ULyraTetrisInventoryManagerComponent` replicates its updated state (`InventoryGrid`, base `InventoryList`) to clients.
9. **UI Update (Client):** The client UI receives Gameplay Messages (like `TAG_Lyra_Inventory_Message_GridCellChanged`) triggered by the replicated state changes and refreshes its display.

### Structure of this Section

The following subpages detail the Tetris-specific aspects of this integration:

1. **Grid Source Data (`FInventoryAbilityData_SourceTetrisItem`):** Details the struct used to represent grid locations.
2. **Using the Ability Function Library (Tetris Context):** Shows how to use the base library nodes with the new data struct.
3. **Grid-Specific Gameplay Messages:** Lists and explains messages relevant to grid state changes.
4. **(Optional) Tetris Inventory Window Lifecycle:** Discusses structs and potential patterns for managing container UI windows via GAS.

By leveraging the existing GAS framework and simply providing a more specific data structure for grid locations, the Tetris Inventory plugin maintains a secure, decoupled, and consistent approach for UI interactions.
