# Working With Items

A player drags ammo from the ground into their backpack. The system needs to validate the item fits, check its shape against available cells, handle rotation, and do it all with prediction so it feels instant. Another player opens a container and drops a grenade onto an existing stack. the system merges them up to the max stack size. A third player tries to place a rifle where a pistol already sits, the system checks fragments and routes to the appropriate combine logic.

All of these operations flow through the same unified interface. This page covers how items enter, move within, and get queried from the Tetris Inventory.

***

### The Container Interface

The Tetris Inventory implements `ILyraItemContainerInterface`, the same interface used by the standard inventory, equipment and attachment system. External systems never call grid-specific functions directly, they go through the container interface, and the Tetris component handles the spatial logic internally.

| Method                      | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `AddItemToSlot()`           | Place an item at a specific grid position with rotation        |
| `RemoveItemFromSlot()`      | Remove an item from a grid position                            |
| `MoveItemBetweenSlots()`    | Move an item within this grid (optimized single-update path)   |
| `FindAvailableSlot()`       | Find the first position where an item's shape fits             |
| `CanAcceptItem()`           | Validate whether an item can be placed without modifying state |
| `GetItemInSlot()`           | Query which item occupies a specific grid position             |
| `ForEachItem()`             | Iterate all items with prediction-aware slot descriptors       |
| `GetOccupiedSlotBehavior()` | Determine how to handle placement on an occupied cell          |
| `TryCombineItems()`         | Route item combining to the appropriate fragment logic         |

All mutation methods accept `FPredictionKey` for client-side prediction. The client applies the change locally for instant feedback, while the server validates and confirms (or rejects) the operation.

> [!INFO]
> For how transactions coordinate moves across different container types, see [Item Container Transactions](../../../base-lyra-modified/item-container/transactions/).

***

### Slot Descriptors

Every container type in the framework has its own slot descriptor, a struct that describes a specific position within that container. For the Tetris inventory, the slot descriptor is `FInventoryAbilityData_SourceTetrisItem`:

```cpp
USTRUCT(BlueprintType)
struct FInventoryAbilityData_SourceTetrisItem : public FAbilityData_InventorySourceItem
{
    // The inventory this slot belongs to
    TObjectPtr<ULyraTetrisInventoryManagerComponent> TetrisInventory;

    // Grid coordinates (root position of the item)
    FIntPoint Position;

    // Which clump section of the grid
    int32 ClumpID = 0;

    // Item rotation at this position
    EItemRotation Rotation = Rotation_0;

    // Additional context tags for slot-specific logic
    FGameplayTagContainer TagContainer;
};
```

This descriptor is used everywhere items are referenced in the grid, transaction payloads, ability data, UI slot info, and `ForEachItem()` callbacks. When you call `ForEachItem()`, each callback receives the item instance along with its `FInventoryAbilityData_SourceTetrisItem` packed into an `FInstancedStruct`.

***

### Shape Fitting

The core of the Tetris inventory: validating that an item's physical shape fits in the grid.

When you place an item, the system runs through a fitting check:

{% stepper %}
{% step %}
**Get Item Shape**

The item's `InventoryFragment_Tetris` defines a 2D boolean grid representing the shape. A 2x3 rifle, an L-shaped tool, a single-cell grenade, each has a distinct footprint.
{% endstep %}

{% step %}
**Apply Rotation**

The shape is transformed based on the requested `EItemRotation` (0, 90, 180, 270 degrees). A 1x3 horizontal bar rotated 90 degrees becomes a 3x1 vertical bar.
{% endstep %}

{% step %}
**Check Each Cell**

For every `true` cell in the rotated shape, offset from the root position:

* Is the cell within the clump boundaries?
* Is the cell accessible (not disabled by layout)?
* Is the cell unoccupied (or occupied by an ignored item)?

All cells must pass for placement to succeed.
{% endstep %}

{% step %}
**Validate Capacity**

Shape fitting alone is not enough. The system also checks weight limits, item count limits, and item type filtering. An item can fit spatially but still be rejected by capacity rules.
{% endstep %}
{% endstepper %}

```
Placing an L-shaped item at position (1,2) in Clump 0:

Item Shape (Rotation_0):            Grid State (5 cols x 4 rows):

   y+0                               0    1   2   3   4  ← column index
   ┌───┬───┬───┐                    ┌───┬───┬───┬───┬───┐
   │ X │ X │ X │                    │   │   │   │   │   │  Row 0
   ├───┼───┼───┤                    ├───┼───┼───┼───┼───┤
y+1│   │   │ X │                    │   │   │   │   │   │  Row 1
   └───┴───┴───┘                    ├───┼───┼───┼───┼───┤
                                    │   │ ? │ ? │ ? │   │  Row 2   (x=1..3)
                                    ├───┼───┼───┼───┼───┤
                                    │   │   │   │ ? │   │  Row 3   (x=3)
                                    └───┴───┴───┴───┴───┘

Cells to check (occupied by shape when placed at (1,2)):
  (1,2) (2,2) (3,2) (3,3)

? = cells being validated

All empty and accessible
→ Placement succeeds
```

#### Key Functions

| Function                      | Purpose                                                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CanPlaceItemInEmptySlot()`   | Validates a specific item shape at a specific position and rotation. Accepts an `IgnoreItems` array to treat certain occupied cells as empty (used during moves).                                                |
| `FindAvailableSlotsForItem()` | Searches the entire grid for all valid positions. Returns an array of `FInventorySlotFound` with root index, rotation, clump, and allowed stack amount. Supports searching both empty slots and existing stacks. |
| `FindAvailableSlot()`         | Container interface version. Returns the first available position as an `FInstancedStruct` slot descriptor. Used by the transaction system when it doesn't care about specific placement.                        |
| `FindSlotsFromShape()`        | Static utility. Given a root position, shape, and rotation, returns all `FIntPoint` coordinates the item would occupy. Useful for UI highlighting.                                                               |

***

### Grid Queries

Beyond placement, you often need to read the grid state for UI rendering, debug visualization, or gameplay logic.

```cpp
// Get all cells with their current state (item, rotation, root, clump)
TArray<FGridCellInfo> AllCells = TetrisInventory->GetAllGridCells();

// Check a specific cell
bool bOccupied = TetrisInventory->IsCellOccupied(FIntPoint(2, 3), /*ClumpID=*/ 0);
bool bAccessible = TetrisInventory->IsCellAccessible(FIntPoint(2, 3), /*ClumpID=*/ 0);

// Find an item's root position from any cell it occupies
// (a 2x3 item has 6 cells - all map back to the same root)
FIntPoint Root = TetrisInventory->GetRootSlotFromSlot(FIntPoint(3, 4), /*ClumpID=*/ 0);
```

#### The `FGridCellInfo` Structure

Each cell in the grid carries:

| Field          | Type                          | Purpose                                  |
| -------------- | ----------------------------- | ---------------------------------------- |
| `Position`     | `FIntPoint`                   | This cell's coordinates                  |
| `Rotation`     | `EItemRotation`               | Rotation of the item occupying this cell |
| `ItemInstance` | `ULyraInventoryItemInstance*` | The item here (null if empty)            |
| `ClumpID`      | `int32`                       | Which clump this cell belongs to         |
| `RootSlot`     | `FIntPoint`                   | The root position of the occupying item  |
| `SlotTags`     | `FGameplayTagContainer`       | Per-cell tags for custom slot logic      |

> [!INFO]
> `GetAllGridCells()` returns the **effective view**, server state merged with any pending client predictions. Your UI always sees the correct visual state without tracking predictions manually.

***

### Occupied Slot Behavior

What happens when you place an item where something already exists? The Tetris inventory handles this differently from a standard slot-based inventory. Items have complex shapes that cannot be cleanly swapped, so the system routes to specialized behavior instead.

`GetOccupiedSlotBehavior()` determines the action:

| Scenario                                             | Behavior          | What Happens                                                                                                                                                                               |
| ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same item instance (moving within its own footprint) | `SameItem`        | Treated as a repositioning move. The item shifts to its new root position.                                                                                                                 |
| Same item type, stackable, destination not full      | `StackCombine`    | Items stack. Source quantity transfers to destination up to `MaxStackSize`. If the source is fully consumed, it is removed from the grid.                                                  |
| Different item type, fragment supports combining     | `FragmentCombine` | Routes to the existing item's fragment `CombineItems()` method. This handles container insertion (drop item onto backpack), attachment (drop scope onto weapon), and custom combine logic. |
| Different items, no combine support                  | `Reject`          | Operation fails. The item cannot be placed here.                                                                                                                                           |
| Null items                                           | `Reject`          | Safety check. Invalid items are always rejected.                                                                                                                                           |

<details class="gb-toggle">

<summary>How GetOccupiedSlotBehavior Works Internally</summary>

The behavior resolution follows a priority chain:

```cpp
// 1. Self-check: item overlapping its own footprint during a move
if (IncomingItem == ExistingItem)
    return SameItem;

// 2. Same type: try stacking
if (IncomingItem->GetItemDef() == ExistingItem->GetItemDef())
{
    int32 CurrentStack = ExistingItem->GetStatTagStackCount(TAG_Item_Count);
    int32 MaxStack = IconFragment->MaxStackSize;

    if (MaxStack > 1 && CurrentStack < MaxStack)
        return StackCombine;
}

// 3. Different types: check fragment combining
for (Fragment : ExistingItemDef->Fragments)
{
    if (Fragment->CanCombineItems(Context))
        return FragmentCombine;
}

// 4. Nothing matched: reject
return Reject;
```

The `SameItem` case is particularly important for multi-cell items. When you drag an L-shaped item one cell to the right, some of its new cells overlap its current position. Rather than rejecting, the system recognizes it as the same item and proceeds with the move.

</details>

***

### Stack Mechanics

Items with the same definition can merge into a single stack when one is dropped onto the other, up to a configurable maximum.

An item is stackable when its `InventoryFragment_InventoryIcon` has a `MaxStackSize` greater than 1. The current count is tracked via a stat tag (`TAG_Lyra_Inventory_Item_Count`) on the item instance.

When you drag a stack of 15 ammo onto an existing stack of 20 (with `MaxStackSize: 50`):

{% stepper %}
{% step %}
**Calculate transfer amount**

Available space in destination: `50 - 20 = 30`. Source has 15. Transfer amount: `min(15, 30) = 15`.
{% endstep %}

{% step %}
**Update destination**

Destination count increases from 20 to 35.
{% endstep %}

{% step %}
**Update source**

Source count decreases from 15 to 0. Since the entire source was consumed, the source item is removed from the grid.
{% endstep %}
{% endstepper %}

#### Partial Stacking

If you drop 50 ammo onto a stack of 80 with `MaxStackSize = 100`:

```
Before:                          After:
┌──────────┐  ┌──────────┐     ┌──────────┐  ┌──────────┐
│ Ammo: 80 │  │ Ammo: 50 │     │ Ammo:100 │  │ Ammo: 30 │
│ (target) │  │ (source) │     │ (full)   │  │(remains) │
└──────────┘  └──────────┘     └──────────┘  └──────────┘
```

Only 20 rounds transfer. The remaining 30 stay in the source stack at its original grid position.

***

### Fragment Combining

When `GetOccupiedSlotBehavior()` returns `FragmentCombine`, the drop isn't a stack merge, it's a fragment-driven interaction. The system calls `TryCombineItems()`, which iterates through the **destination item's fragments** looking for any that can handle the incoming item:

```cpp
for (const ULyraInventoryItemFragment* Fragment : DestItemDef->Fragments)
{
    if (Fragment && Fragment->CanCombineItems(Context))
    {
        if (Fragment->CombineItems(Context))
            return true;  // Fragment handled it
    }
}
```

Any fragment can implement `CanCombineItems()` / `CombineItems()` to opt into this system. The first fragment that accepts the combination handles it. Three built-in fragments use this:

| Fragment                        | What Happens on Combine                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `InventoryFragment_Container`   | Moves the dropped item into the container's nested inventory      |
| `InventoryFragment_Attachment`  | Attaches the dropped item to a compatible slot on the destination |
| `InventoryFragment_CraftRecipe` | Consumes ingredients from both items and produces a new item      |

Each fragment handles its own logic independently, `InventoryFragment_Container` delegates to the child inventory's add path, `InventoryFragment_Attachment` uses the attachment slot system, and `InventoryFragment_CraftRecipe` runs a simulate-then-commit pattern to ensure ingredients are never consumed without space for the result. The system doesn't impose any shared behavior; it just provides the iteration and the `FItemCombineContext`.

***

### Adding Items

When an item enters the Tetris inventory through the container interface:

{% stepper %}
{% step %}
**Resolve Slot Info**

The `FInventoryAbilityData_SourceTetrisItem` is extracted from the `FInstancedStruct`. This gives the target position, clump, and rotation.
{% endstep %}

{% step %}
**Validate Placement**

`CanAcceptItem()` runs the full validation chain: shape fitting, weight limits, item count limits, item type filtering, and parent inventory constraint propagation (for nested containers).
{% endstep %}

{% step %}
**Check Occupied Slots**

If the target position is occupied, `GetOccupiedSlotBehavior()` determines the path. For `StackCombine`, the system merges stacks. For `FragmentCombine`, it routes to fragment logic. For `Reject`, the operation fails.
{% endstep %}

{% step %}
**Create Placement**

A new `FTetrisPlacement` entry is created in the replicated `Placements` FastArray with the item, position, clump, rotation, and prediction stamp.
{% endstep %}

{% step %}
**Grid Rebuilt**

The local grid is rebuilt from the effective view. `OnTetrisInventoryChanged` broadcasts to notify UI.
{% endstep %}
{% endstepper %}

***

### Moving Items

The Tetris inventory provides an optimized path for internal moves via `MoveItemBetweenSlots()`. Rather than removing and re-adding (which would create two replication events and two prediction entries), internal moves update the existing placement entry in-place.

```
Internal Move: Rifle from (0,0) to (2,1)

Before:                          After:
┌───┬───┬───┬───┐              ┌───┬───┬───┬───┐
│ R │ R │   │   │              │   │   │   │   │
├───┼───┼───┼───┤              ├───┼───┼───┼───┤
│ R │ R │   │   │              │   │   │   │   │
├───┼───┼───┼───┤              ├───┼───┼───┼───┤
│   │   │   │   │              │   │ R │ R │   │
├───┼───┼───┼───┤              ├───┼───┼───┼───┤
│   │   │   │   │              │   │ R │ R │   │
└───┴───┴───┴───┘              └───┴───┴───┴───┘

Single placement update, single replication event
```

For moves between different inventories (e.g., dragging from a backpack to a chest), the transaction system handles the cross-container coordination using Remove from source + Add to destination.

> [!INFO]
> For the full transaction model including cross-container moves, prediction, and rollback, see [Item Container Transactions](../../../base-lyra-modified/item-container/transactions/).

***

### Iterating Items

`ForEachItem()` provides a prediction-aware way to walk all items in the inventory:

```cpp
TetrisInventory->ForEachItem([](ULyraInventoryItemInstance* Item, const FInstancedStruct& SlotInfo) -> bool
{
    // Extract the tetris-specific slot data
    const auto* TetrisSlot = SlotInfo.GetPtr<FInventoryAbilityData_SourceTetrisItem>();
    if (TetrisSlot)
    {
        FIntPoint Position = TetrisSlot->Position;
        int32 Clump = TetrisSlot->ClumpID;
        EItemRotation Rotation = TetrisSlot->Rotation;

        // Use for UI, queries, or game logic...
    }

    return true; // continue iterating (false to stop early)
});
```

This callback uses `GetPlacements()` internally, which returns the **effective view**, server state composited with any pending predictions. On the server, this is the authoritative list. On the owning client, it includes predicted adds, removes, and position changes that the server has not yet confirmed.

> [!INFO]
> For building inventory UI, prefer using [ViewModels](../tetris-inventory-ui/tetris-view-model.md) and subscribing to `OnTetrisInventoryChanged` rather than polling `ForEachItem()`. ViewModels handle prediction complexity and provide change-driven updates.

***

### Common Patterns

#### "Can this pickup fit anywhere?"

Before a pickup system offers an item to the player:

```cpp
FInstancedStruct OutSlot;
bool bHasRoom = TetrisInventory->FindAvailableSlot(
    PickupItemDef,
    PickupItemInstance,
    OutSlot
);

if (bHasRoom)
{
    // OutSlot contains the FInventoryAbilityData_SourceTetrisItem
    // with the first valid position, clump, and rotation
}
```

#### "What's at this grid position?"

For tooltip display or UI hover logic:

```cpp
FInventoryAbilityData_SourceTetrisItem SlotData;
SlotData.TetrisInventory = TetrisInventory;
SlotData.Position = FIntPoint(2, 3);
SlotData.ClumpID = 0;

FInstancedStruct SlotInfo;
SlotInfo.InitializeAs<FInventoryAbilityData_SourceTetrisItem>(SlotData);

ULyraInventoryItemInstance* Item = TetrisInventory->GetItemInSlot(SlotInfo);
```

#### "How many of this item do I have, including nested containers?"

For crafting checks or quest tracking:

```cpp
int32 TotalBandages = TetrisInventory->GetTotalItemCountByDefinitionInChild(BandageDef);
// Searches this inventory AND all child inventories recursively
```

***

### Troubleshooting

> [!INFO]
> **Item placement fails silently?** Enable `LogTetrisInventory` verbose logging. The component logs shape validation failures, capacity limit rejections, and slot resolution errors.

> [!INFO]
> **Item appears to duplicate during drag?** This is likely a prediction timing issue. The effective view briefly shows both the predicted move and the server confirmation. Ensure your UI subscribes to `OnTetrisInventoryChanged` rather than polling, which handles reconciliation automatically.

> [!INFO]
> **`GetItemInSlot` returns null for an occupied cell?** You may be querying a non-root cell. Multi-cell items only return from their root position. Use `GetRootSlotFromSlot()` first to find the root, then query that position.
