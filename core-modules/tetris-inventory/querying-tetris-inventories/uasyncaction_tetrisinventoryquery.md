# UAsyncAction_TetrisInventoryQuery

For easy integration with Blueprints (like UI Widgets or Actor Components), the `UAsyncAction_TetrisItemQuery` provides a convenient Blueprint Async Action node (`QueryTetrisInventoryAsync`) that wraps the functionality of the C++ `ULyraTetrisInventoryQuery` for hierarchical inventory tracking.

### Purpose & Functionality

* **Blueprint Accessibility:** Makes hierarchical item querying straightforward from Blueprint graphs.
* **Asynchronous Pattern:** Uses the standard Unreal Engine Async Action pattern (multiple execution pins for different outcomes).
* **Simplified Setup:** Requires only the root inventory component and the list of item definitions to track.
* **Automatic Lifecycle:** Manages the underlying C++ `ULyraTetrisInventoryQuery` object automatically.
* **Grouped Results:** Provides results grouped by the inventory component (root or child) where items were found (`FLyraTetrisInventoryQueryResult`).

### The `QueryTetrisInventoryAsync` Node

This is the primary node for initiating hierarchical queries in Blueprints.

<img src=".gitbook/assets/image (179).png" alt="" width="312" title="">

**Node Inputs:**

* **In (Exec):** Standard execution input.
* **World Context Object:** Typically `Self`. (**Blueprint automatically assigns this**)
* **Inventory Component (`ULyraInventoryManagerComponent*`):** The root inventory component to monitor (can be the base type, but functionally needs to be or contain Tetris inventories for hierarchical tracking).
* **Item Definitions (`TArray<TSubclassOf<ULyraInventoryItemDefinition>>`):** The item types to track across the hierarchy.

**Node Outputs (Exec Pins & Delegates):**

* **Then (Exec):** Executes immediately after the node starts the background query.
* **On Updated (Exec & Delegate Output `Items By Inventory`):** Fires _every time_ the set of tracked items changes anywhere in the hierarchy. The output is an array of `FLyraTetrisInventoryQueryResult`.
* **On First Result (Exec & Delegate Output `Items By Inventory`):** Fires _once_ with the initial state of tracked items across the hierarchy when the query first activates. Output is an array of `FLyraTetrisInventoryQueryResult`.
* **On Failed (Exec):** Fires if initialization fails (e.g., `InventoryComponent` was null).
* **Return Value (Object Ref):** A reference to the `UAsyncAction_TetrisItemQuery` object. Store this if you need to call `Cancel()` manually later.

### Usage Example (In a Crafting UI Widget)

Imagine a crafting UI that needs to display the total count of Wood and Metal available across the player's main inventory and any backpacks they might have.

1. **Event Graph (e.g., On Initialized):**
   * Get Player's Root Inventory: Get the `ULyraTetrisInventoryManagerComponent` from the player state/pawn. Store it (`PlayerRootInventory`).
   * Create Item Def Array: Use `Make Array`, add your `ID_Wood` and `ID_Metal` classes. Store it (`TrackedResourceDefs`).
   * Call Async Node: Add the `Query Tetris Inventory Async` node.
     * Connect `World Context Object` to `Self`.
     * Connect `Inventory Component` to `PlayerRootInventory`.
     * Connect `Item Definitions` to `TrackedResourceDefs`.
   * Store Return Value: Promote the `Return Value` to a variable (`ActiveResourceQuery`) if you might need to cancel it later.
2. **Handle Initial Results:**
   * Drag off `On First Result` -> `Assign / Bind Event`. Create Custom Event `UpdateResourceCounts_Initial`.
   * In `UpdateResourceCounts_Initial`:
     * Take the `Items By Inventory` output array.
     * Use a `For Each Loop` to iterate through the array.
     * Inside the loop, get the `Items` array from the `FLyraTetrisInventoryQueryResult` element.
     * Use another `For Each Loop` on this inner `Items` array.
     * For each `Item Instance`, call `Get Stat Tag Stack Count` with `Lyra.Inventory.Item.Count`.
     * Sum these counts into local variables (e.g., `TotalWood`, `TotalMetal` based on `ItemInstance->GetItemDef()`).
     * After the outer loop, update your UI Text Blocks displaying the total counts.
3. **Handle Updates:**
   * Drag off `On Updated` -> `Assign / Bind Event`. Create Custom Event `UpdateResourceCounts_Changed`.
   * Implement `UpdateResourceCounts_Changed` **identically** to `UpdateResourceCounts_Initial` (reset local counts, loop through results, sum counts, update UI). This ensures the UI always reflects the latest totals whenever any relevant item stack changes anywhere in the hierarchy.
4. **Handle Failure (Optional):** Bind `On Failed` to show an error or default ("0") counts.
5. **Cleanup (e.g., Event Destruct):**
   * Get the `ActiveResourceQuery` variable.
   * Check `Is Valid`.
   * If valid, call `Cancel` on it.

<img src=".gitbook/assets/image (180).png" alt="" title="Simple example counting total resource item in inventory and children inventory">

### How it Works Internally

1. **Node Call:** `QueryTetrisInventoryAsync` static function creates the `UAsyncAction_TetrisItemQuery` instance and a `ULyraTetrisInventoryQuery` instance.
2. **Initialization:** Calls `Initialize` on the C++ `ULyraTetrisInventoryQuery`.
3. **Registration:** Registers the async action with the game instance.
4. **Activation:**
   * Checks if the internal C++ query is valid (broadcasts `OnFailed` if not).
   * Gets the initial results using `TetrisInventoryQuery->GetItemsGroupedByInventory()`.
   * Binds its internal `HandleQueryUpdated` function to the C++ `TetrisInventoryQuery->OnUpdated` delegate.
   * Broadcasts `OnFirstResult` with the initial results.
5. **Updates:**
   * When the C++ `TetrisInventoryQuery` detects a change and fires _its_ `OnUpdated` delegate...
   * The async action's `HandleQueryUpdated` function is called.
   * It simply broadcasts the `OnUpdated` delegate of the _Blueprint node_, passing along the `ItemsByInventory` data it received.
6. **Cleanup:** When `Cancel()` is called or the World Context Object is destroyed, `SetReadyToDestroy` unbinds the delegate and cleans up the internal C++ `ULyraTetrisInventoryQuery` object.

The `UAsyncAction_TetrisItemQuery` node provides an easy and efficient way for Blueprints to monitor items across complex nested inventories without needing manual recursive checks or dealing directly with the C++ query object's lifecycle.
