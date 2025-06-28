# Spatial Placement & Querying

A core capability of the `ULyraTetrisInventoryManagerComponent` is its ability to understand and query the spatial arrangement of items within its grid. This involves finding empty space suitable for new items and checking the state of specific grid locations.

### Finding Available Space (`FindAvailableSlotsForItem`)

When you need to add an item but don't have a specific destination slot in mind (e.g., picking up an item from the world), the system needs to find where it can fit.

<!-- tabs:start -->
#### **C++**
```cpp
// Finds potential slots where an item could be placed or stacked.
UFUNCTION(BlueprintCallable, Category=Inventory)
TArray<FInventorySlotFound> FindAvailableSlotsForItem(
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef, // Item type to find space for
    int32 AmountToFind,                               // How many units are needed (influences stack checking)
    bool bSearchStacks,                               // If true, also considers partially filled stacks of the same ItemDef
    const TArray<ULyraInventoryItemInstance*>& IgnoreItems // List of items currently in the grid to ignore during collision checks (useful for drag/drop previews or combining)
);

// Struct returned by FindAvailableSlotsForItem
USTRUCT(BlueprintType)
struct FInventorySlotFound
{
    GENERATED_BODY()

    // The root coordinate (Position within ClumpID) where the item could be placed.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FIntPoint RootIndex;

    // The rotation that allows the item to fit at RootIndex.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EItemRotation SupportedRotation;

    // The ID of the clump where the RootIndex is located.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClumpID;

    /**
     * If placed at RootIndex/Rotation, how many units of the item can this slot accommodate?
     * - If it's an existing stack (bSearchStacks=true), this is the remaining stack space.
     * - If it's an empty slot, this is the item's MaxStackSize.
     */
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 AllowedAmount;

    // Constructors...
};
```


#### **Blueprint**
<img src=".gitbook/assets/image (145).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Input Validation:** Checks if the `ItemDef` is valid and has the required `InventoryFragment_Tetris` and `InventoryFragment_InventoryIcon` fragments. Returns empty if not.
2. **Stack Search (Optional):** If `bSearchStacks` is true and the item is stackable (`MaxStackSize > 1`):
   * Iterates through the existing items in the base `InventoryList`.
   * If an item matches `ItemDef` and has space remaining in its stack (`MaxStackSize - CurrentStackCount > 0`), it calculates the `AmountToAdd` (min of `RemainingAmount` and available space).
   * Adds an `FInventorySlotFound` entry using the item's _current_ grid position and rotation, with `AllowedAmount` set to the calculated `AmountToAdd`.
   * Decrements `RemainingAmount`. If `RemainingAmount` reaches zero, returns the found stack slots.
3. **Empty Slot Search:** If `RemainingAmount` is still greater than zero (or `bSearchStacks` was false):
   * Iterates through every accessible cell (`FGridCellInfo`) in the `InventoryGrid`.
   * Skips cells that are already occupied (i.e., `RootSlot != FIntPoint(-1)`), unless the occupying item is in the `IgnoreItems` list.
   * For each potentially empty root cell (`RootSlot`, `ClumpID`):
     * Iterates through the item's `AllowedRotations` (from `InventoryFragment_Tetris`).
     * For each rotation, calls `CanPlaceItemInEmptySlot` to check if the item's shape fits at this location/rotation without overlapping other (non-ignored) items.
     * If a valid placement is found:
       * Adds an `FInventorySlotFound` entry with the `RootSlot`, `ClumpID`, successful `Rotation`, and `AllowedAmount` set to the item's `MaxStackSize`.
       * Decrements `RemainingAmount` by `MaxStackSize`.
       * **Optimization:** Tracks the cells this placement would occupy (`FindSlotsFromShape`) and avoids re-checking subsequent potential root slots that fall within this occupied area in the current iteration (using the internal `ClaimedSlots` tracking).
       * Breaks the inner rotation loop (moves to the next potential root cell).
     * If `RemainingAmount` reaches zero, returns the accumulated list of found empty slots (and potentially stack slots from step 2).
4. **Return:** Returns the list of found `FInventorySlotFound` entries. This list might contain entries for stacking onto existing items and/or placing into empty slots.

### Checking Specific Placement (`CanPlaceItemInEmptySlot`)

This function is the core collision check used by `FindAvailableSlotsForItem` and also directly when trying to place an item at a specific target location (e.g., during drag-and-drop or `TryAdd...ToSlot`).

<!-- tabs:start -->
#### **C++**
```cpp
// Checks if an item's shape can fit at a specific root slot and rotation without overlapping existing items.
UFUNCTION(BlueprintCallable, Category=Inventory)
bool CanPlaceItemInEmptySlot(
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef, // Item type to check
    int32 Clump,                                      // Target clump ID
    const FIntPoint& RootSlot,                         // Target root coordinate within the clump
    const EItemRotation& Rotation,                     // Target rotation
    const TArray<ULyraInventoryItemInstance*>& IgnoreItems // Items to ignore during collision checks
);
// (Implemented internally by FGridCellInfoList::CanPlaceItemInEmptySlot)
```


#### **Blueprints**
<img src=".gitbook/assets/image (19).png" alt="" title="">

<!-- tabs:end -->

**Logic Breakdown:**

1. **Input Validation:** Checks `ItemDef` validity and Tetris fragment presence.
2. **Get Occupied Cells:** Calls `ULyraTetrisInventoryManagerComponent::FindSlotsFromShape` to determine all grid coordinates (`FIntPoint`) the item would occupy if placed at `RootSlot` with the given `Rotation`.
3. **Check Each Cell:** Iterates through the calculated `OccupiedSlots`:
   * For each `Slot` coordinate:
     * Uses `FGridCellInfoList::FindGridCellFromCoords(Clump, Slot)` to get the index of the corresponding `FGridCellInfo` in the flat `GridCells` array.
     * If the index is `-1`, the required cell is outside the defined inventory layout bounds for that clump. Returns `false` (cannot place).
     * Gets the `FGridCellInfo` using the index.
     * Checks if `GridCellInfo.RootSlot != FIntPoint(-1)`. If true, this cell is already occupied by another item.
     * If occupied, finds the root cell of the occupying item (`OccupyingItemRootIndex = FindGridCellFromCoords(Clump, GridCellInfo.RootSlot)`).
     * Checks if the occupying item (`GridCells[OccupyingItemRootIndex].ItemInstance`) is present in the `IgnoreItems` list.
     * If the cell is occupied _and_ the occupying item is _not_ in `IgnoreItems`, returns `false` (collision detected).
4. **Return:** If all occupied cells are checked and found to be either empty or occupied by an ignored item, returns `true` (placement is valid).

### Other Querying Functions

* **`FindSlotsFromShape(RootSlot, Shape, Rotation)` (Static):** Given a root position, a shape grid, and a rotation, calculates and returns the list of all absolute grid coordinates (`FIntPoint`) that the shape would occupy relative to that root. Purely geometric calculation.

<img src=".gitbook/assets/image (20).png" alt="" width="375" title="">

* **`CanOccupySlot(ClumpID, CellCoordinates)`:** Checks if a specific coordinate refers to a valid, accessible cell based _only_ on the original `InventoryLayout` definition (i.e., was it marked `true`?). **Doesn't check if it's currently occupied by an item**.

<img src=".gitbook/assets/image (22).png" alt="" width="375" title="">

* **`FindUIGridCell(ClumpID, CellCoordinates)`:** Performs the coordinate-to-index lookup using the internal `GridCellIndexMap`. Returns the index in the flat `GridCells` array, or `-1` if the coordinate is invalid or inaccessible. Primarily used by UI to map user clicks/hovers to specific cell data.

<img src=".gitbook/assets/image (23).png" alt="" width="375" title="">

* **`GetGridCellInfo(GridCellIndex)`:** Returns the `FGridCellInfo` struct for a given index in the flat `GridCells` array. Used after `FindUIGridCell` to get the actual state (item instance, rotation, root slot) of the cell.

<img src=".gitbook/assets/image (24).png" alt="" width="375" title="">

* **`GetItemInstanceFromSlot(SourceSlot, SourceClump)`:** Convenience function that combines `FindUIGridCell` and `GetGridCellInfo` to directly return the `ULyraInventoryItemInstance*` occupying the root of the specified grid coordinate, or `nullptr` if empty or invalid.

<img src=".gitbook/assets/image (25).png" alt="" width="375" title="">

* **`GetItemInstanceAndRotationFromSlot(SourceSlot, SourceClump, Out SlotRotation)`:** Similar to `GetItemInstanceFromSlot` but also returns the `Rotation` stored in the root cell's `FGridCellInfo`.

<img src=".gitbook/assets/image (26).png" alt="" width="375" title="">

These functions provide the necessary tools to query the spatial state of the inventory, find suitable placement locations, and check the validity of potential item moves based on the grid layout and item shapes.
