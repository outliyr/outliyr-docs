# Adding & Removing Items

While the `ULyraTetrisInventoryManagerComponent` inherits the base item management functions, its core purpose is managing items spatially. Therefore, it introduces specialized logic and functions for adding and removing items that interact directly with the grid layout.

### Overridden Base Functions

The Tetris component overrides key base functions to incorporate grid checks:

*   **`CanAddItem_Implementation`:**

    * First, calls `Super::CanAddItem_Implementation` to perform all base checks (Weight, Item Count, Allowed/Disallowed types, Base Fragment checks).
    * **Adds:** If the base checks pass and this component has a `ParentInventory`, it calls `CanAddItemInParent` to recursively check if adding the item here would violate constraints in any parent container inventories up the hierarchy (respecting `bIgnoreChild...` flags).
    * **Result:** Returns the final allowed amount considering _both_ base and hierarchical constraints. **Note:** This base check doesn't inherently check for available _grid space_ yet; that's handled by the `TryAdd...` functions.

    <img src=".gitbook/assets/image (169).png" alt="" width="375" title="">
*   **`TryAddItemDefinition_Implementation`:**

    * Calls `CanAddItem` to check limits and permissions.
    * Attempts to stack with existing items first (using `AddToExistingStacks`).
    * **Grid Logic:** If quantity remains, it calls `FindAvailableSlotsForItem` (searching _only_ empty slots, `bSearchStacks=false`) to find suitable empty grid locations.
    * For each found empty slot, it calls `TryAddItemDefinitionToSlot` to place the item (up to its `MaxStackSize`) in that specific grid location.
    * Continues until the amount is fully placed or no more suitable empty slots are found.
    * Returns the amount _not_ added.

    <img src=".gitbook/assets/image (170).png" alt="" width="375" title="">
*   **`TryAddItemInstance_Implementation`:**

    * Similar flow to the definition version. Calls `CanAddItem`.
    * Tries stacking first with `AddToExistingStacks`.
    * **Grid Logic:** If the instance (or remaining portion) needs placement, calls `FindAvailableSlotsForItem` for empty slots.
    * For each found empty slot, it calls `TryAddItemInstanceToSlot` to place the instance (potentially splitting it if `AmountAllowed` is less than the instance's current stack count and less than `MaxStackSize`).
    * Returns the amount _not_ added.

    <img src=".gitbook/assets/image (171).png" alt="" width="375" title="">
*   **`RemoveItem`:**

    * Finds the `ItemInstance` in the base `InventoryList`.
    * **Grid Logic:** If the item has an `InventoryFragment_Tetris`, it gets the item's current grid location (`FInventoryAbilityData_SourceTetrisItem` from `GetCurrentSlot`). It then calls `RemoveItemFromSlot` using the grid coordinates to handle the removal from the grid state.
    * If the item doesn't have a Tetris fragment, it falls back to the base `RemoveItemInstance` / `DestroyItemInstance` logic.

    <img src=".gitbook/assets/image (173).png" alt="" width="375" title="">

### Grid-Specific Functions

These functions interact directly with specific grid slots:

*   **`TryAddItemDefinitionToSlot`:**

    * **Purpose:** Attempts to add a _new_ item instance (from a definition) to a _specific_ grid slot (`ClumpID`, `RootSlot`, `Rotation`).
    * **Logic:**
      1. Checks base constraints via `CanAddItem`.
      2. Checks if the target `RootSlot` exists and is accessible.
      3. Checks if the target `RootSlot` is already occupied by a _different_ item type. If so, fails.
      4. Checks if the item's shape (at the given `Rotation`) fits within the grid boundaries starting at `RootSlot` and doesn't overlap any _other_ existing items (using `CanPlaceItemInEmptySlot`).
      5. If the slot is occupied by the _same_ item type: Calculates space remaining in the stack (up to `MaxStackSize`), adds the allowed amount using `UpdateItemCount`.
      6. If the slot is empty and checks pass: Calls `AddItemDefinitionToSlot` to create the new instance and place it in the grid.
    * **Returns:** The amount that could _not_ be added to the slot.

    <img src=".gitbook/assets/image (174).png" alt="" width="375" title="">
*   **`TryAddItemInstanceToSlot`:**

    * **Purpose:** Attempts to add an _existing_ item instance to a _specific_ grid slot.
    * **Logic:** Similar checks as the definition version (base constraints, slot validity, different item type check, shape fitting).
      * If stacking onto the same item type: Calculates available stack space, updates the target item's count (`UpdateItemCount`), and potentially reduces the source `ItemInstance` count or destroys it if fully merged.
      * If placing into an empty slot: Calls `AddItemInstanceToSlot` to place the provided instance in the grid.
    * **Returns:** The amount from the input `ItemInstance` that could _not_ be added.

    <img src=".gitbook/assets/image (175).png" alt="" width="375" title="">
*   **`RemoveItemFromSlot`:**

    * **Purpose:** Removes an item (or part of its stack) from a _specific_ grid slot, identified by the `GridCellIndex` (the index in the flat `GridCells` array).
    * **Logic:**
      1. Gets the `ItemInstance` from the specified `GridCellIndex`. Fails if empty or invalid index.
      2. Handles stack splitting: If `Amount` is less than the current stack and `bRemoveEntireStack` is false, it calls `UpdateItemCount` to decrease the stack and potentially returns a new temporary instance representing the removed portion (if `bDestroy` is false).
      3. Handles full removal: If `bRemoveEntireStack` is true or `Amount` >= stack count:
         * Calls `InventoryGrid.UpdateCellItemInstance(GridCellIndex, nullptr)` to clear the item from the root grid cell (this also updates non-root cells).
         * Calls either `RemoveItemInstance` (if `bDestroy` is false) or `DestroyItemInstance` (if `bDestroy` is true) to handle removal from the base `InventoryList` and perform necessary cleanup/replication.
    * **Returns:** The removed `ItemInstance` (or a temporary split portion) if `bDestroy` is false, otherwise `nullptr`.

    <img src=".gitbook/assets/image (176).png" alt="" width="375" title="">
* **`AddItemDefinitionToSlot` (Internal):**
  * **Purpose:** The raw function to create a new item instance and place it in the grid _without performing checks_. Called by `TryAddItemDefinitionToSlot` after validation.
  * **Action:** Calls `InventoryList.AddEntry` (base logic), then calls `InventoryGrid.UpdateCellItemInstance` to set the grid state, updates weight/count, and handles replication registration.
* **`AddItemInstanceToSlot` (Internal):**
  * **Purpose:** Raw function to place an existing item instance in the grid _without checks_. Called by `TryAddItemInstanceToSlot`.
  * **Action:** Calls `InventoryList.AddEntry`, then `InventoryGrid.UpdateCellItemInstance`, updates weight/count, handles replication.

> [!danger]
> **Do Not Call `AddItemDefinitionToSlot` or `AddItemInstanceToSlot` Directly.**\
> These are **internal functions** that bypass critical validation steps.
> 
> Always use `TryAddItemDefinitionToSlot` or `TryAddItemInstanceToSlot` instead. These wrappers perform essential checks such as:
> 
> * Inventory constraints (`CanAddItem`)
> * Slot validity and accessibility
> * Collision and stacking logic
> 
> The `TryAdd*` functions will only call the corresponding `Add*` functions after all validations pass. Calling the internal methods directly can lead to invalid grid states, item duplication, or desync issues in multiplayer.

### Key Workflow Differences

* **Base Inventory:** Focuses on stacking into existing `FLyraInventoryEntry` items first, then adding new entries to the end of the list if space allows (based on `LimitItemInstancesStacks`).
* **Tetris Inventory:** Also tries stacking first. However, when placing new items, it must find _empty grid cells_ that can accommodate the item's _shape_ and _rotation_, not just an available slot in a list. The `TryAdd...` overrides handle this search using `FindAvailableSlotsForItem`. Adding items directly to specific slots (`TryAdd...ToSlot`) requires passing the target grid coordinates and rotation.

Understanding these grid-specific functions and how they override the base logic is essential for correctly adding, removing, and manipulating items within the spatial constraints of the `ULyraTetrisInventoryManagerComponent`.
