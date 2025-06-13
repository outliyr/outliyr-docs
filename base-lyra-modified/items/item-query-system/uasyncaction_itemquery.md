# UAsyncAction_ItemQuery

While `ULyraInventoryQuery` provides the core C++ logic for tracking items, the `UAsyncAction_ItemQuery` offers a convenient **Blueprint Async Action node** (`QueryInventoryAsync`) that simplifies the process for use within Blueprints, especially UI Widgets, Actor Components, or Gameplay Abilities.

### Purpose & Functionality

* **Blueprint Integration:** Makes the item query functionality easily accessible from Blueprints without requiring direct C++ interaction.
* **Asynchronous Pattern:** Uses the standard Unreal Engine Async Action pattern with execution pins for ongoing updates and completion/failure.
* **Simplified Setup:** Takes the target inventory and item definitions as simple inputs.
* **Automatic Lifecycle:** Manages the underlying `ULyraInventoryQuery` object's creation and destruction automatically.
* **Convenient Outputs:** Provides delegates that fire when the query updates, including the list of found items and a calculated total stack count across all found items.

### The `QueryInventoryAsync` Node

This is the primary node you'll use in your Blueprints.

<img src=".gitbook/assets/image (66).png" alt="" width="253" title="">

**Node Inputs:**

* `In` (Exec Pin): Standard execution input.
* `World Context Object` (Object Reference): Typically `self` (the current Blueprint object), automatically populated in blueprints. Used for registering the async action with the game instance.
* `Inventory Component` (`ULyraInventoryManagerComponent*`): The specific inventory component instance you want to monitor.
* `Item Definitions` (`TArray<TSubclassOf<ULyraInventoryItemDefinition>>`): An array of the item definition classes you want to track within the specified inventory.

**Node Outputs (Exec Pins & Delegates):**

* `Then` (Exec Pin): Executes immediately after the node is called, allowing the rest of your Blueprint graph to continue. The query starts running in the background.
* `On Updated` (Exec Pin & Delegate): **Fires every time** the list of tracked items or their stack counts change _after_ the initial result.
  * `Items` (`TArray<ULyraInventoryItemInstance*>`): The updated list of item instances matching the query.
  * `Total Count` (`int32`): The sum of the `Lyra.Inventory.Item.Count` StatTag values across all items in the `Items` array.
* `On First Result` (Exec Pin & Delegate): **Fires only once** when the query gets its initial results (immediately after activation if items are already present). Provides the initial state.
  * `Items` (`TArray<ULyraInventoryItemInstance*>`): The initial list of item instances.
  * `Total Count` (`int32`): The initial total stack count.
* `On Failed` (Exec Pin & Delegate): Fires if the async action fails to initialize (e.g., the provided `Inventory Component` was invalid).

**Node Output (Object):**

* `Return Value` (`UAsyncAction_ItemQuery*`): A reference to the Async Action object itself. You can store this and call `Cancel()` on it later if you need to manually stop the query before the owning object is destroyed.

### Example: Monitoring Spare Inventory Ammo for a Weapon HUD

> [!info]
> This example uses the [`InventoryFragment_Gun`](../../../core-modules/shooter-base/weapons/gun-fragment/) which is from the **ShooterBase Plulgin**. The **InventoryQuery** is not dependant on the **ShooterBase plugin**.

Imagine a HUD widget that needs to display the player's total count of specific ammo types available in their inventory that a currently equipped weapon can use. This is different from magazine ammo, which is typically tracked on the weapon instance itself.

**Scenario:** The player has an "Assault Rifle" equipped. This rifle, via its `UInventoryFragment_Gun`, is configured to use "Rifle Ammo" (e.g., `ID_Ammo_Rifle`) and "Armor Piercing Rifle Ammo" (e.g., `ID_Ammo_Rifle_AP`) from the player's inventory. The HUD needs to show the combined total of these two ammo types available in the player's main inventory.

**Conceptual Blueprint Logic (in the HUD Widget):**

<img src=".gitbook/assets/image (69).png" alt="" title="Blueprint graph showing ListenForSpareAmmoChanges event, setting up and using QueryInventoryAsyn">

**Event Graph Breakdown (for the image above):**

1. **`ListenForSpareAmmoChanges` (Custom Event):**
   * This event is triggered when the equipped weapon changes or when the HUD is initialized. It takes the currently equipped `ULyraInventoryItemInstance` (the weapon) as an input.
2. **Sequence Node:**
   * **Then 0 (Cancel Previous Query):**
     * Check if `AmmoQueryAsyncAction` (a widget variable of type `UAsyncAction_ItemQuery`) is valid.
     * If valid, call `Cancel()` on it. This stops any previous ammo query.
   * **Then 1 (Start New Query if Weapon Uses Inventory Ammo):**
     * Check if the input `EquippedWeaponInstance` is valid.
3. **Get Weapon's Inventory Ammo Types:**
   * Call `Find Fragment By Class` on the `EquippedWeaponInstance`, getting the `UInventoryFragment_Gun`.
   * Check if the `GunFragment` is valid.
   * If valid, get the `InventoryAmmoTypes` (a `TSet<TSubclassOf<ULyraInventoryItemDefinition>>`) from the `GunFragment`.
4. **Branch (Check if Weapon Uses Inventory Ammo):**
   * Condition: Get the `LENGTH` of the `InventoryAmmoTypes` set. If `Length > 0`, the weapon uses inventory ammo.
5. **If True (Weapon Uses Inventory Ammo):**
   * **Get Player Inventory:** Get a reference to the local player's main `ULyraInventoryManagerComponent` (e.g., from Player Controller -> Pawn -> Find Component by Class).
   * **Convert Set to Array:** Convert the `InventoryAmmoTypes` set (from the `GunFragment`) into an Array (e.g., using a `TO ARRAY (Set)` node). This array will be the `ItemDefinitions` to query.
   * **Call `QueryInventoryAsync`:**
     * `World Context Object`: `Self` (the HUD widget).
     * `Inventory Component`: The player's main `ULyraInventoryManagerComponent`.
     * `Item Definitions`: The array of ammo types converted from the `GunFragment.InventoryAmmoTypes`.
     * **Store Action:** Set the widget variable `AmmoQueryAsyncAction` to the return value of this node.
   * **Handle `On First Result`:**
     * Connect to a Custom Event (e.g., `UpdateSpareAmmoDisplay`).
     * In `UpdateSpareAmmoDisplay`: Get the `Total Count` output from the event. This `TotalCount` (calculated by `UAsyncAction_ItemQuery::CalculateTotalCount` by summing the `Lyra.Inventory.Item.Count` StatTag of all found ammo instances) represents the total spare ammo of the queried types. Update your HUD Text Block with this count.
   * **Handle `On Updated`:**
     * Connect this to the _same_ `UpdateSpareAmmoDisplay` Custom Event. This ensures the HUD updates whenever the count of any of the watched ammo types changes in the inventory.
   * **Handle `On Failed` (Optional):**
     * Connect to a Custom Event to log an error or display "N/A" if the query fails to start.
6. **If False (Weapon Does Not Use Inventory Ammo or No Valid Weapon):**
   * The HUD might display "Infinite" or hide the spare ammo counter, depending on the weapon's other properties (like `bInfiniteSpareAmmo` from `UInventoryFragment_Gun`).
   * Ensure `AmmoQueryAsyncAction` is cleared or set to null if no query is active.

**Explanation:**

* **`UInventoryFragment_Gun`:** The `InventoryAmmoTypes` property on this fragment defines which `ULyraInventoryItemDefinition`s are considered valid ammo for the weapon when drawing from inventory.
* **`ULyraInventoryQuery`:** This UObject (created and managed by `UAsyncAction_ItemQuery`) does the actual work.
  * It initializes by finding all existing instances of the specified `ItemDefinitions` in the given `InventoryComponent`.
  * It then registers a listener with the `UGameplayMessageSubsystem` for `Lyra.Inventory.Message.StackChanged`.
  * When `HandleInventoryChanged` is triggered, it checks if the changed item is one of the `TrackedItemDefs`. If so, it updates its internal `CachedItems` list and broadcasts its `OnUpdated` delegate.
* **`UAsyncAction_ItemQuery`:** This acts as a Blueprint-friendly wrapper for `ULyraInventoryQuery`.
  * It simplifies the setup and provides convenient `OnFirstResult` and `OnUpdated` delegates.
  * Crucially, its `CalculateTotalCount()` method iterates through the items found by the `ULyraInventoryQuery` and sums their `Lyra.Inventory.Item.Count` stat tag. This gives you the total number of individual ammo rounds, not just the number of ammo stacks.
  * The action automatically handles cancellation when its `WorldContextObject` (the HUD widget) is destroyed, but explicit cancellation via the stored action reference is also good practice if the listening criteria change (e.g., weapon swapped).

This setup ensures that the HUD widget reactively displays the correct total spare ammo count by listening to the inventory system through the asynchronous query, only focusing on the ammo types relevant to the currently equipped weapon in an efficient and elegant manner.

***

The `UAsyncAction_ItemQuery` node provides a powerful yet simple way for Blueprints to reactively monitor inventory contents without needing complex polling logic or direct C++ interaction with the underlying query system. It's the recommended approach for most Blueprint-driven inventory tracking needs, especially in UI.
