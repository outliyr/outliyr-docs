# Grid Representation

The core of the `ULyraTetrisInventoryManagerComponent`'s spatial awareness lies in how it represents the state of its grid internally. This is primarily handled by the `FGridCellInfoList` struct, which manages an array of `FGridCellInfo` structs, one for each _accessible_ cell defined in the `InventoryLayout`.

### `FGridCellInfo` Struct

Each individual cell within the accessible parts of the inventory grid is represented by an `FGridCellInfo` struct.

```cpp
/** A single grid cell within the inventory layout */
USTRUCT(BlueprintType)
struct FGridCellInfo : public FFastArraySerializerItem // Inherits for efficient replication
{
    GENERATED_BODY()

    FGridCellInfo() // Default constructor
        : Position(-1), Rotation(EItemRotation::Rotation_0), ItemInstance(nullptr), ClumpID(-1), RootSlot(-1) {}

    // Convenience constructors...

    FString GetDebugString() const; // For logging

    // The X, Y coordinate of this cell within its specific Clump.
    UPROPERTY(BlueprintReadOnly, Category=Inventory)
    FIntPoint Position = FIntPoint(-1);

    // If this cell is the root of an item, this stores the item's rotation. Otherwise, defaults to Rotation_0.
    UPROPERTY(BlueprintReadOnly, Category=Inventory)
    EItemRotation Rotation = EItemRotation::Rotation_0;

    // If this cell is the root of an item, this points to the ULyraInventoryItemInstance. Otherwise, nullptr.
    UPROPERTY(BlueprintReadOnly, Category=Inventory)
    TObjectPtr<ULyraInventoryItemInstance> ItemInstance = nullptr;

    // The ID (index) of the FInventoryLayoutCreator Clump this cell belongs to.
    UPROPERTY(BlueprintReadOnly, Category=Inventory)
    int32 ClumpID = -1;

    /**
     * If this cell is occupied by part of an item (but not the root),
     * this stores the coordinates (Position) of the item's root cell within the same Clump.
     * If this cell is the root cell itself OR is empty, this is FIntPoint(-1).
     * Allows quickly finding the actual item instance occupying this non-root cell.
     */
    UPROPERTY(BlueprintReadOnly, Category=Inventory)
    FIntPoint RootSlot = FIntPoint(-1);

    // Optional tags that can be applied to specific cells for custom logic (e.g., "QuickSlot", "CannotPlaceHeavyItems").
    UPROPERTY(BlueprintReadOnly, Category=Inventory)
    FGameplayTagContainer SlotTags;

private:
    friend FGridCellInfoList;
    friend ULyraTetrisInventoryManagerComponent;
};
```

**Key Members Explained:**

* **`Position`:** The (X, Y) coordinate of _this specific cell_ relative to the top-left corner of its parent `Clump`.
* **`ClumpID`:** The index of the `FInventoryLayoutCreator` clump this cell belongs to in the `InventoryLayout` array. `Position` and `ClumpID` together uniquely identify a cell.
* **`ItemInstance`:** If this cell is the **root** placement location for an item, this pointer references the actual `ULyraInventoryItemInstance`. If the cell is empty or occupied by a non-root part of an item, this is `nullptr`.
* **`Rotation`:** If this cell is the root (`ItemInstance != nullptr`), this stores the `EItemRotation` of the placed item.
* **`RootSlot`:** This is crucial for spatial lookups.
  * If this cell is **empty**, `RootSlot` is `FIntPoint(-1)`.
  * If this cell is the **root** of a placed item, `RootSlot` is `FIntPoint(-1)`.
  * If this cell is occupied by **part of an item but not its root**, `RootSlot` stores the `Position` coordinates of that item's actual root cell within the same `ClumpID`. This allows you to quickly jump from any occupied cell to the `FGridCellInfo` that holds the `ItemInstance` pointer.
* **`SlotTags`:** A container for adding gameplay tags directly to grid cells, allowing for specialized cell behaviors (though usage examples might depend on custom game logic).

### `FGridCellInfoList` Struct

This struct manages the collection of `FGridCellInfo` entries and handles their replication.

```cpp
/** List of inventory grid cells */
USTRUCT(BlueprintType)
struct FGridCellInfoList : public FFastArraySerializer // Enables efficient array replication
{
    GENERATED_BODY()

    // Constructor, initialization...

public:
    // --- FFastArraySerializer Contract ---
    // Functions called automatically during replication process
    // (PreReplicatedRemove, PostReplicatedAdd, PostReplicatedChange, PostReplicatedReceive)
    // These handle updating state and internal caches (like GridCellIndexMap) on clients.
    void PreReplicatedRemove(const TArrayView<int32> RemovedIndices, int32 FinalSize);
    void PostReplicatedAdd(const TArrayView<int32> AddedIndices, int32 FinalSize);
    void PostReplicatedChange(const TArrayView<int32> ChangedIndices, int32 FinalSize);
    void PostReplicatedReceive(const FFastArraySerializer::FPostReplicatedReceiveParameters& Parameters);
    bool NetDeltaSerialize(FNetDeltaSerializeInfo& DeltaParms); // Core replication function
    // --- End FFastArraySerializer Contract ---

    // Updates the ItemInstance and Rotation for a specific cell (identified by its index in GridCells).
    // Also updates the RootSlot pointers for all affected non-root cells.
    void UpdateCellItemInstance(int32 SlotIndex, ULyraInventoryItemInstance* ItemInstance, EItemRotation ItemRotation = EItemRotation::Rotation_0);

    // Helper to update RootSlot pointers for non-root cells covered by an item's shape.
    void UpdateNonRootCells(int32 SlotIndex, ULyraInventoryItemInstance* ItemInstance, EItemRotation ItemRotation, bool bRemoveInfluence);

    // Builds the GridCells array based on the InventoryLayout configuration. Called on server initialization.
    void PopulateInventoryGrid(const TArray<FInventoryLayoutCreator>& ClumpLayouts);

    // Rebuilds the GridCellIndexMap based on the current GridCells. Called on clients after replication updates.
    void PopulateGridCellIndexMap(const TArray<FInventoryLayoutCreator>& ClumpLayouts);

    // Gets a copy of all grid cell info structs.
    TArray<FGridCellInfo> GetAllCells() const;

    // Clears item references from all cells, effectively emptying the grid visually.
    void EmptyGridItems();

    // Checks if an item can be placed at a specific root slot, considering occupied cells (ignoring specified items).
    bool CanPlaceItemInEmptySlot(TSubclassOf<ULyraInventoryItemDefinition> ItemDef, int32 Clump, const FIntPoint& RootSlot, const EItemRotation& Rotation, const TArray<ULyraInventoryItemInstance*>& IgnoreItems);

    // Sets the entire grid state (used for restoration, e.g., after failed resize).
    void SetEntries(const TArray<FGridCellInfo>& Entries);

    // Checks if the provided layout differs significantly from the current layout represented by the GridCellIndexMap.
    bool HasLayoutChanged(const TArray<FInventoryLayoutCreator>& NewLayout) const;

private:
    friend ULyraTetrisInventoryManagerComponent;

    // Helper: Checks if a coordinate corresponds to an accessible cell defined in the layout.
    bool IsSlotAccessible(int32 Clump, const FIntPoint& SlotCoords);

    // Helper: Uses GridCellIndexMap to find the index in GridCells for given coordinates. Returns -1 if invalid/inaccessible.
    int32 FindGridCellFromCoords(int32 Clump, const FIntPoint& SlotCoords);

    // Broadcasts a Gameplay Message when a cell's state changes.
    void BroadcastGridInventoryChangedMessage(FGridCellInfo& Entry);
    // Broadcasts a Gameplay Message when the inventory layout changes.
    void BroadcastResizeInventoryMessage();

private:
    // The replicated flat list of all accessible grid cells.
    UPROPERTY()
    TArray<FGridCellInfo> GridCells;

    UPROPERTY(NotReplicated) // Owning component reference
    TObjectPtr<UActorComponent> OwnerComponent;

    /**
     * Non-replicated lookup table: GridCellIndexMap[ClumpID][RowY][ColX] -> Index in GridCells array.
     * Allows O(1) lookup of a cell's index from its coordinates. Inaccessible cells store -1.
     * Rebuilt on clients in PostReplicatedReceive if layout changes.
     */
    UPROPERTY(NotReplicated)
    TArray<FInventoryClumpIndexMapping> GridCellIndexMap;

    // Internal flag used by PostReplicatedReceive to know when to rebuild the index map.
    UPROPERTY(NotReplicated)
    bool bRequiresIndexMapUpdate = true;
};

// Helper struct for the GridCellIndexMap
USTRUCT(BlueprintType) struct F1DIntegerRow { /* TArray<int32> IntegerRow; */ };
USTRUCT(BlueprintType) struct FInventoryClumpIndexMapping { /* TArray<F1DIntegerRow> ClumpGrid; */ };
```

**Key Aspects of `FGridCellInfoList`:**

* **Flat Array (`GridCells`):** Stores only the _accessible_ cells. This keeps the array size manageable even for large, sparse layouts.
* **Fast Array Serializer:** Efficiently replicates changes to the `GridCells` array, only sending deltas (added, removed, changed items).
* **Coordinate Lookup (`GridCellIndexMap`):** The `GridCellIndexMap` is crucial for performance. Instead of linearly searching `GridCells` every time you need the info for `ClumpID=1, Position=(5,3)`, you can directly access `GridCellIndexMap[1][3][5]` to get the correct index into `GridCells`. This map is rebuilt on clients when the grid layout changes (`PostReplicatedReceive` checks `HasLayoutChanged`).
* **Updating Cells (`UpdateCellItemInstance`):** This is the primary function for placing or removing an item from a slot. It handles:
  * Setting the `ItemInstance` and `Rotation` on the root cell (`SlotIndex`).
  * Updating the `RootSlot` pointers on all _other_ cells covered by the item's shape (using `UpdateNonRootCells`) to point back to the root cell (or setting them to `-1` if removing the item).
  * Marking modified `FGridCellInfo` entries dirty for replication (`MarkItemDirty`).
  * Broadcasting the `TAG_Lyra_Inventory_Message_GridCellChanged` message.
* **Gameplay Messages:**
  * `TAG_Lyra_Inventory_Message_GridCellChanged`: Broadcast whenever `UpdateCellItemInstance` or `UpdateNonRootCells` modifies a cell's state. UI listens to this to refresh individual slots or the whole grid. The `FGridInventoryChangedMessage` payload contains the full state of the changed cell.
  * `TAG_Lyra_Inventory_Message_InventoryResized`: Broadcast by `PostReplicatedReceive` when `HasLayoutChanged` detects a change, signaling the UI that the entire grid structure needs to be rebuilt.

This combination of a replicated flat array (`GridCells`) and a non-replicated, client-rebuilt coordinate lookup map (`GridCellIndexMap`) provides both network efficiency and fast runtime access to the state of each cell in the Tetris inventory grid.
