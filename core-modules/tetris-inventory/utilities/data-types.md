# Data Types

This page documents the core data structures and enumerations defined within the `InventoryDataLibrary` (or equivalent header) that are fundamental to the operation and configuration of the Tetris Inventory system.

### `EItemRotation`

Defines the possible cardinal orientations for an item within the grid.

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

* **Usage:** Used by `InventoryFragment_Tetris` to specify allowed rotations, by `FGridCellInfo` to store the placed rotation, and by placement/utility functions (`RotateShape`, `MoveItemInternally`, etc.) to handle orientation.

### `F1DBooleanRow`

A helper struct used to represent a single row within a 2D boolean grid (primarily for defining item shapes and clump layouts). Necessary because `TArray<TArray<bool>>` is not directly editable as a UPROPERTY.

```cpp
USTRUCT(BlueprintType)
struct F1DBooleanRow
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<bool> BooleanRow;

    // Operator overloads and helper functions ([], Add, Num, SetNum, Init, etc.)
    // ... (See Header for full list) ...
};
```

* **Usage:** Used within `FInventoryLayoutCreator::ClumpGrid` and `InventoryFragment_Tetris::Shape`.

### `F1DIntegerRow`

Similar to `F1DBooleanRow`, but holds a row of integers. Primarily used internally for the `GridCellIndexMap`.

```cpp
USTRUCT(BlueprintType)
struct F1DIntegerRow
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Usually not directly edited
    TArray<int32> IntegerRow;

    // Operator overloads and helper functions...
    // ... (See Header for full list) ...
};
```

* **Usage:** Used within `FInventoryClumpIndexMapping::ClumpGrid`.

### `FInventoryClumpIndexMapping`

Represents the 2D index map for a single inventory clump, mapping coordinates `[RowY][ColX]` to the index within the flat `FGridCellInfoList::GridCells` array.

```cpp
USTRUCT(BlueprintType)
struct FInventoryClumpIndexMapping
{
    GENERATED_BODY()
public:
    // The 2D grid mapping coordinates to GridCells indices (-1 for invalid/inaccessible cells).
    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Usually not directly edited
    TArray<F1DIntegerRow> ClumpGrid;

    // Operator overloads and helper functions...
    // ... (See Header for full list) ...
};
```

* **Usage:** Used internally by `FGridCellInfoList::GridCellIndexMap` for fast coordinate lookups.

### `FInventoryLayoutCreator`

Defines a single "Clump" or section of an inventory's grid layout. An array of these defines the full inventory structure.

```cpp
USTRUCT(BlueprintType)
struct FInventoryLayoutCreator
{
    GENERATED_BODY()
public:
    // X-coordinate origin of this clump.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClumpX;

    // Y-coordinate origin of this clump.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClumpY;

    // The boolean grid defining accessible cells within this clump (relative to ClumpX, ClumpY).
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<F1DBooleanRow> ClumpGrid;

    // Operator overloads and helper functions...
    // ... (See Header for full list) ...
};
```

* **Usage:** Used in `ULyraTetrisInventoryManagerComponent::InventoryLayout` to configure the grid structure. Detailed on the Grid Layout Core Concept page.

### `FFoundCells`

A general-purpose struct, potentially used by UI or other systems to store information about a set of cells related to an item interaction (e.g., the cells an item would occupy during a drag operation). _Note: Review if this struct is actively used in the final implementation or if it was part of earlier development._

```cpp
USTRUCT(BlueprintType)
struct FFoundCells
{
    GENERATED_BODY()

    // List of cell coordinates involved.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FIntPoint> CellPositions;

    // Clump ID these cells belong to.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 CellClumpID = -1;

    // Root cell coordinate for the related item interaction.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FIntPoint RootCell = FIntPoint(0, 0);

    // Rotation involved in the interaction.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EItemRotation CellRotation = EItemRotation::Rotation_0;

    // The item instance involved.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryItemInstance> ItemInstance;

    // Target inventory for the interaction.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryManagerComponent> DestinationInventoryManager;

    // Source inventory for the interaction.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryManagerComponent> SourceInventoryManager;

    // Was the source item inside the inventory? (Potentially for external drags)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    bool SourceItemInsideInventory = true;
};
```

* **Usage:** May be used by UI drag/drop operations or placement previews to bundle relevant contextual information. Check specific UI implementation details.

### `FInventoryStartItemDetails`

Used within `ULyraTetrisInventoryManagerComponent::StartingItems` to define items that should automatically populate the inventory on initialization.

```cpp
USTRUCT(BlueprintType)
struct FInventoryStartItemDetails
{
    GENERATED_BODY()

    // Item definition to add.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef;

    // Quantity to add (respects stacking).
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 AmountToAdd = 0;

    // Target position (ClumpID, (X,Y)). (-1,-1) for auto-placement.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FIntPoint Position = FIntPoint(-1);

    // Target Clump ID. Used if Position is specific.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Clump = 0;

    // Target rotation. Used if Position is specific, or as a suggestion for auto-placement.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EItemRotation ItemRotation = EItemRotation::Rotation_0;
};
```

* **Usage:** Configured on the `ULyraTetrisInventoryManagerComponent` to define its initial contents.

### `FInventorySlotFound`

Returned by `ULyraTetrisInventoryManagerComponent::FindAvailableSlotsForItem` to indicate a potential location where an item can be placed or stacked.

```cpp
USTRUCT(BlueprintType)
struct FInventorySlotFound
{
    GENERATED_BODY()

    // Coordinate of the root slot for placement/stacking.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FIntPoint RootIndex;

    // The rotation that allows the item to fit (if placing in empty slot) or the existing item's rotation (if stacking).
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    EItemRotation SupportedRotation;

    // Clump ID where the RootIndex is located.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 ClumpID;

    // How many units can be added to this slot (remaining stack space or MaxStackSize for empty slots).
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 AllowedAmount;

    // Constructors...
};
```

* **Usage:** Result type for finding available space. Used by `TryAddItemDefinition`/`TryAddItemInstance` logic.

These data structures provide the necessary building blocks and data carriers for defining layouts, item shapes, tracking grid state, and managing inventory initialization and placement operations within the Tetris Inventory system.
