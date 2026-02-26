# Data Types

Every grid cell, item shape, and placement operation in the Tetris Inventory passes through a handful of core data structures. You will see these types in function signatures, component properties, and UI logic constantly, understanding them upfront saves you from guessing what a `TArray<F1DBooleanRow>` means the fifth time you encounter one.

This page documents every struct and enum defined in `TetrisInventoryDataLibrary.h`.

***

### `EItemRotation`

The four cardinal orientations an item can have within the grid.

```cpp
UENUM(BlueprintType)
enum class EItemRotation : uint8
{
    Rotation_0   UMETA(DisplayName = "0 Degrees"),
    Rotation_90  UMETA(DisplayName = "90 Degrees"),
    Rotation_180 UMETA(DisplayName = "180 Degrees"),
    Rotation_270 UMETA(DisplayName = "270 Degrees")
};
```

This enum shows up everywhere: the `InventoryFragment_Tetris` uses it to define which rotations an item supports, `FTetrisPlacement` stores the placed rotation, and utility functions like `RotateShape` and `GetCellPositionAfterRotation` accept it as a parameter.

> [!INFO]
> Items don't have to support all four rotations. The Tetris fragment lets you restrict allowed rotations per item definition, a symmetric 2x2 block might only allow `Rotation_0`, while an L-shaped piece allows all four.

***

### `F1DBooleanRow`

A single row within a 2D boolean grid. This struct exists because Unreal's property system cannot directly expose `TArray<TArray<bool>>` as a UPROPERTY, so a row wrapper provides the same capability with full editor and Blueprint support.

```cpp
USTRUCT(BlueprintType)
struct F1DBooleanRow
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<bool> BooleanRow;

    // Operator[], Add, Num, SetNum, Init, IsValidIndex, ==, !=
};
```

**Where you'll see it:**

* **Item shapes -** `InventoryFragment_Tetris::Shape` is a `TArray<F1DBooleanRow>` where `true` means "this cell is occupied."
* **Clump layouts -** `FInventoryLayoutCreator::ClumpGrid` uses the same pattern to define which cells are accessible within a grid section.
* **Utility functions** - Nearly every function in `UTetrisUtilityLibrary` takes a shape as `TArray<F1DBooleanRow>`.

The operator overloads let you treat it like a regular array in C++:

```cpp
// Access a cell directly: Shape[Row][Column]
bool occupied = MyShape[2][3];
```

***

### `F1DIntegerRow`

The integer counterpart to `F1DBooleanRow`. Holds a row of `int32` values, primarily used for internal index mapping.

```cpp
USTRUCT(BlueprintType)
struct F1DIntegerRow
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<int32> IntegerRow;

    // Operator[], Add, Num, SetNum, Init, IsValidIndex
};
```

**Where you'll see it:** Inside `FInventoryClumpIndexMapping`, where it maps 2D grid coordinates to flat array indices.

***

### `FInventoryClumpIndexMapping`

Maps 2D coordinates within a single clump to indices in the flat `FGridCellInfoList::GridCells` array. Each entry at `[Row][Column]` holds the index into the flat cell array, or `-1` for inaccessible cells.

```cpp
USTRUCT(BlueprintType)
struct FInventoryClumpIndexMapping
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<F1DIntegerRow> ClumpGrid;

    // Operator[], Add, Num, SetNum, Init, IsValidIndex
};
```

This struct is managed internally by the inventory grid system. You generally don't create or modify these directly, the grid builds them from your `FInventoryLayoutCreator` definitions. Understanding that they exist helps when debugging grid coordinate lookups.

***

### `FInventoryLayoutCreator`

Defines a single "clump" (section) of an inventory's grid layout. An inventory's full layout is a `TArray<FInventoryLayoutCreator>`, one entry per clump, each positioned at a different origin.

```cpp
USTRUCT(BlueprintType)
struct FInventoryLayoutCreator
{
    GENERATED_BODY()

public:
    // X-coordinate origin of this clump
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClumpX;

    // Y-coordinate origin of this clump
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClumpY;

    // Boolean grid defining accessible cells (relative to ClumpX, ClumpY)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<F1DBooleanRow> ClumpGrid;

    // Operator[], Add, Num, SetNum, Init, IsValidIndex
};
```

**Example:** A player inventory with a main 8x6 grid and a separate 2x2 "quick slot" section would use two `FInventoryLayoutCreator` entries, one at `(0,0)` with an 8x6 boolean grid, and one at `(9,0)` with a 2x2 grid.

> [!INFO]
> The layout is configured on `ULyraTetrisInventoryManagerComponent::InventoryLayout`. For a deep dive into how clumps compose into a full grid, see the [Grid System](../tetris-inventory-manager-component/the-grid-system.md) page.

***

### `FFoundCells`

A context bundle that groups everything relevant to a cell-based item interaction, the cells involved, the item, both source and destination inventories, and the rotation state.

```cpp
USTRUCT(BlueprintType)
struct FFoundCells
{
    GENERATED_BODY()

    // The grid cells involved in this interaction
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FIntPoint> CellPositions;

    // Which clump these cells belong to
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 CellClumpID = -1;

    // The root cell (top-left anchor) for placement
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FIntPoint RootCell = FIntPoint(0, 0);

    // The rotation state for this interaction
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EItemRotation CellRotation = EItemRotation::Rotation_0;

    // The item instance being interacted with
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryItemInstance> ItemInstance;

    // Where the item is going
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryManagerComponent> DestinationInventoryManager;

    // Where the item is coming from
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryManagerComponent> SourceInventoryManager;

    // Was the source item already inside an inventory? (false for external/world pickups)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool SourceItemInsideInventory = true;
};
```

UI drag-and-drop operations use this struct to pass placement context through the interaction chain. When a player drags an item from one inventory to another, `FFoundCells` bundles the source inventory, destination inventory, target cells, rotation, and item reference into a single package.

***

### `FTetrisInventoryStartingItem`

Defines an item that should populate an inventory when it initializes. Configured on the `ULyraTetrisInventoryManagerComponent::StartingItems` array (and on `InventoryFragment_Container` for container items).

```cpp
USTRUCT(BlueprintType)
struct FTetrisInventoryStartingItem
{
    GENERATED_BODY()

    // The item definition to add
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Item")
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef;

    // Amount to add (obeys stacking rules)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Item", meta = (ClampMin = "1"))
    int32 AmountToAdd = 1;

    // Grid position -- (-1, -1) means auto-place in the next available slot
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Placement")
    FIntPoint Position = FIntPoint(-1);

    // Which clump to place into (auto-selected if Position is (-1, -1))
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Placement")
    int32 Clump = 0;

    // Item rotation in the grid
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Placement")
    EItemRotation ItemRotation = EItemRotation::Rotation_0;

    // Per-instance fragment overrides applied when this item is created
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fragments",
        meta = (BaseStruct = "FLyraFragmentInitBase"))
    TArray<FInstancedStruct> FragmentInitData;
};
```

The `FragmentInitData` array is the key to customization. Each entry is a polymorphic `FInstancedStruct` that overrides a specific fragment's defaults when the item is created. For example, you could add a `FContainerFragmentInit` to give a starting backpack a different grid layout than its definition's default, or a durability init to start a weapon at 50% condition.

> [!INFO]
> Leave `Position` at `(-1, -1)` for auto-placement. The system finds the first available slot that fits the item's shape and rotation. Set an explicit position only when you need deterministic layouts.

<details class="gb-toggle">

<summary>How FragmentInitData works at runtime</summary>

When the inventory processes a starting item, it creates the item instance from `ItemDef` and then iterates through `FragmentInitData`. Each `FInstancedStruct` is checked against registered fragment init types (structs derived from `FLyraFragmentInitBase`). If a match is found, the corresponding fragment on the new item instance receives the override data before the item is placed into the grid.

This means you can configure per-instance differences directly in the editor, no subclassing, no runtime Blueprint logic. The init data travels with the starting item definition and applies automatically.

</details>

***
