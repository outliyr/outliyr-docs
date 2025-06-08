# Configuration & Initialization

Setting up a `ULyraTetrisInventoryManagerComponent` involves configuring its specific properties, primarily the grid layout and any starting items, and understanding how it gets initialized.

### Configuration Properties

These properties are typically set in the Details panel of the component or its owning Actor/Blueprint:

* **`InventoryLayout` (`TArray<FInventoryLayoutCreator>`)**:
  * **Crucial:** Defines the grid structure using Clumps. This array **must not be empty** for the Tetris inventory to function correctly.
  * See the [Grid Layout](grid-layout.md) page for details on configuring this.
* **`StartingItems` (`TArray<FInventoryStartItemDetails>`)**:
  * An array defining items that should be automatically added to the inventory when it's initialized (specifically, after the game Experience loads).
  * Each `FInventoryStartItemDetails` struct specifies:
    * `ItemDef`: The `ULyraInventoryItemDefinition` of the item to add.
    * `AmountToAdd`: The quantity to add (respects stacking rules).
    * `Position` (`FIntPoint`): The desired root cell coordinate (`ClumpID`, `(X, Y)`) to place the item. If `(-1, -1)`, the system will attempt to find the next available slot automatically.
    * `Clump` (`int32`): The target Clump ID for placement. Used with `Position`.
    * `ItemRotation`: The desired rotation for the item. If `Position` is `(-1, -1)`, the system may try different allowed rotations to find a fit.
* **`bIgnoreChildInventoryWeights` (bool, Default: true)**:
  * If `true`, when calculating the total weight of _this_ inventory, the weight of items _inside_ child container items (items with `InventoryFragment_Container`) will be ignored. Only the base weight of the container item itself (if any) contributes.
  * If `false`, the weight calculation recursively includes the total weight of child inventories.
* **`bIgnoreChildInventoryItemCounts` (bool, Default: true)**:
  * Similar to weight, if `true`, child container items contribute only '1' (or their fragment-defined contribution) to _this_ inventory's item count limit, regardless of how many items are inside them.
  * If `false`, the count calculation recursively includes the item count of child inventories.
* **`bIgnoreChildInventoryItemLimits` (bool, Default: true)**:
  * Affects the `GetTotalItemCountByDefinitionInChild` check.
  * If `true`, when checking specific item limits (like "max 5 grenades"), items inside child containers are ignored.
  * If `false`, the check recursively includes items inside child containers.
* **(Inherited Properties)**: Remember that properties from the base `ULyraInventoryManagerComponent` also apply:
  * `ContainerName`
  * `MaxWeight`
  * `ItemCountLimit`
  * `AllowedItems`
  * `DisallowedItems`
  * `SpecificItemCountLimits`

### Initialization Flow

1. **Component Added:** The component is added to an Actor (e.g., Player State, World Container Actor).
2. **`BeginPlay` (Server & Client):**
   * Calls `Super::BeginPlay()`.
   * **Server:** If `InventoryLayout` is valid, calls `InventoryGrid.PopulateInventoryGrid(InventoryLayout)` to build the initial `GridCells` array based on the configured layout. Logs an error if `InventoryLayout` is empty.
   * **Client:** If `InventoryLayout` is valid (it should replicate shortly if not already), calls `InventoryGrid.PopulateGridCellIndexMap(InventoryLayout)` to build the coordinate lookup map.
3. **Experience Loaded (`OnExperienceLoaded` - Server Only):**
   * This function is registered to be called _after_ the Lyra Experience has fully loaded (ensuring item definitions, etc., are available).
   * Calls `AddStartingItems()`.
   * Starts a timer (`ReplicatePendingItemsTimer`) to ensure newly created starting item instances are correctly registered for replication (addresses potential timing issues with subobject replication).
   * Sets `bHasInitialised = true`.
4. **`AddStartingItems` (Server Only):**
   * Iterates through the `StartingItems` array.
   * For each entry:
     * Validates the definition and amount.
     * If a specific `Position` is given, calls `TryAddItemDefinitionToSlot`.
     * If `Position` is `(-1, -1)`, calls `TryAddItemDefinition` (the base version, which internally calls the Tetris override) to find the next available slot.
     * Adds any successfully created item instances to `PendingReplicatedItems`.
5. **`ReplicatePendingItems` (Server Only):**
   * Called periodically by the timer until it succeeds.
   * Checks if the component is ready for replication.
   * If ready, calls `AddReplicatedSubObject` for each item in `PendingReplicatedItems`.
   * Clears the pending list and the timer.
6. **Replication:** The server replicates the `InventoryLayout`, `InventoryGrid` (`GridCells`), and other relevant properties to clients according to Access Rights.
7. **Client Replication Handlers (`PostReplicatedReceive`):**
   * When `InventoryGrid` data arrives, `PostReplicatedReceive` is called on the client.
   * It checks `bRequiresIndexMapUpdate` (set by other replication callbacks).
   * If an update is needed, it calls `InventoryGrid.HasLayoutChanged` to compare the newly replicated `InventoryLayout` with the layout used to build the current `GridCellIndexMap`.
   * If the layout _has_ changed:
     * Calls `InventoryGrid.PopulateGridCellIndexMap` to rebuild the lookup map based on the new layout and received `GridCells`.
     * Broadcasts `TAG_Lyra_Inventory_Message_InventoryResized` to notify UI.
   * Resets `bRequiresIndexMapUpdate`.

### Initializing Container Inventories

Inventories created dynamically by the `InventoryFragment_Container` follow a slightly different path:

1. **Fragment Creates Component:** `InventoryFragment_Container::CreateNewTransientFragment` (on server) creates a new `ULyraTetrisInventoryManagerComponent` instance (usually parented to the `UGlobalInventoryManager`).
2. **`InitialiseTetrisInventoryComponent` Called:** The fragment immediately calls `InitialiseTetrisInventoryComponent` on the new component, passing in all the configuration properties defined on the fragment itself (Layout, Limits, Starting Items, etc.).
3. **Server Initialization:** The component runs its `BeginPlay` logic, including `PopulateInventoryGrid`.
4. **`AddStartingItems` (Server):** Since the Experience is likely already loaded, `AddStartingItems` is called directly after population (or potentially via a deferred call if needed, though often the context ensures definitions are ready).
5. **Replication:** The component and its contents replicate like any other inventory component.

Proper configuration of the `InventoryLayout` and understanding the initialization flow, especially regarding starting items and replication, are key to ensuring your Tetris inventories function correctly from the moment they appear in the game.
