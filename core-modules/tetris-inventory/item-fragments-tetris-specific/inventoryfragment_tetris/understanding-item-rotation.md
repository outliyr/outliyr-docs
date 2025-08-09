# Understanding Item Rotation

In a Tetris-style inventory, allowing players to rotate items is often crucial for fitting them into available space efficiently. The `InventoryFragment_Tetris` handles the logic for determining which rotations are valid for a given item shape.

### Purpose of Item Rotation

* **Space Optimization:** Allows fitting items into slots that wouldn't accommodate their default orientation.
* **Gameplay Mechanic:** Adds a layer of interaction and problem-solving to inventory management.
* **Flexibility:** Provides multiple ways an item might fit into the grid layout.

### **Why Rotation Matters**

Rotating an item changes its footprint on the grid. A 2x1 vertical domino becomes a 1x2 horizontal one when rotated 90 degrees. The inventory system needs to know:

1. Which rotational states are physically distinct and valid for an item's shape?
2. How does the shape's `TArray<F1DBooleanRow>` data transform when rotated?

### **`EItemRotation` Enum**

Rotational states are defined by the `EItemRotation` enum:

```cpp
// In InventoryDataLibrary.h
UENUM(BlueprintType)
enum class EItemRotation : uint8
{
    Rotation_0   UMETA(DisplayName = "0 Degrees"),
    Rotation_90  UMETA(DisplayName = "90 Degrees"),
    Rotation_180 UMETA(DisplayName = "180 Degrees"),
    Rotation_270 UMETA(DisplayName = "270 Degrees")
};
```

These represent clockwise rotations relative to the default `Rotation_0` state defined by the `Shape` property.

### Determining Allowed Rotations

Not all items benefit from rotation. A 1x1 item or a perfect 2x2 square looks the same regardless of orientation. The system intelligently determines which rotations are meaningful for a given item shape.

* **Responsibility:** The `UInventoryFragment_Tetris` fragment is responsible for calculating and storing the valid rotations for its defined `Shape`.
* **Calculation (`CalculateAllowedRotations`):** When its `Shape` property is changed in the editor (`PostEditChangeProperty`), it internally calls `CalculateAllowedRotations`. This function:
  1. Starts with `Rotation_0` as always allowed.
  2. Programmatically rotates the `Shape` grid by 90, 180, and 270 degrees.
  3. Compares the resulting rotated shape grids to the original and previously added rotated shapes.
  4. Adds `Rotation_90`, `Rotation_180`, or `Rotation_270` to the `AllowedRotations` list _only if_ that rotation produces a unique footprint compared to the previously allowed ones.
* **Caching:** The result is cached in the `AllowedRotations` `TArray<EItemRotation>` property within the fragment instance on the Item Definition's CDO.
* **Read-Only in Details:** The custom property editor displays this array in the "Rotation Debugging" category but makes it read-only, as it's derived data reflecting the `Shape`'s symmetry.
* **Access:** You can get the valid rotations for an item using `UInventoryFragment_Tetris::GetAllowedRotations()`.

> [!info]
> A perfectly square item (like 1x1 or a solid 2x2) might only have `Rotation_0` in its `AllowedRotations` list because rotating it doesn't change its effective footprint. A 2x1 domino will likely have `Rotation_0` and `Rotation_90` (as 180 is the same as 0, and 270 the same as 90). An asymmetric 'L' shape would have all four rotations allowed.

### Runtime Usage

* **Placement Logic:** When `ULyraTetrisInventoryManagerComponent::FindAvailableSlotsForItem` searches for space, it iterates through the item's `AllowedRotations` (obtained from its `InventoryFragment_Tetris`). For each allowed rotation, it checks if the rotated shape can fit starting at potential root cells.
* **Storing Rotation:** When an item is successfully placed in the grid, the `FGridCellInfo` corresponding to its root cell stores the `EItemRotation` that was used for placement.
* **UI Interaction:** UI widgets typically allow the player to cycle through an item's `AllowedRotations` (e.g., by pressing 'R' while dragging) before dropping it. The UI uses utility functions to preview the rotated shape.

### Related Utilities (`UInventoryUtilityLibrary`)

Several functions in `UInventoryUtilityLibrary` are crucial for working with rotations:

* **`RotateShape(Shape, Rotation)`:** Takes an item's base shape grid and an `EItemRotation` value, returning a new grid representing the shape rotated by that amount. Essential for placement checks and UI previews.
* **`AdjustRootSlot(RootSlot, OriginalShape, RotatedShape)`:** Calculates how the effective root position in the inventory grid shifts when an item is rotated. This is important because rotating a non-square shape changes which relative cell aligns with the absolute grid root coordinate.
* **`RotateImageIconWidget(Image, ImageSize, MousePos, Rotation, ClickedCell, GridDimension)`:** A UI-specific helper to apply rotation transformation to a UMG `UImage` widget, pivoting correctly around the clicked cell within the item's visual representation.
* **`GetCellPositionAfterRotation(OriginalCellPosition, OriginalShape, Rotation)`:** Calculates the new relative coordinates of a cell within a shape _after_ the shape is rotated.
* **`GetOriginalCellPosition(RotatedCellPosition, RotatedShape, Rotation)`:** Calculates the original relative coordinates of a cell within a shape _before_ it was rotated.

> [!info]
> Read the [Inventory Utility Library](../../utilities/inventory-utility-library.md) documentation for more details

Item rotation adds significant depth to the Tetris inventory system. By leveraging the `EItemRotation` enum, the automatic calculation of allowed rotations in `InventoryFragment_Tetris`, and the provided utility functions, you can implement intuitive and functional rotation mechanics for item placement.
