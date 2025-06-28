# Inventory Utility Library

This Blueprint Function Library (`UInventoryUtilityLibrary`) provides a collection of static helper functions specifically designed to assist with common tasks related to the spatial aspects of the Tetris Inventory system, such as shape manipulation, coordinate transformations, and UI-related calculations.

### Shape Manipulation & Querying

These functions help analyze and modify the `TArray<F1DBooleanRow>` structures used for item shapes and layouts.

*   **`RotateShape(Shape, Rotation)`:**

    * **Input:** An item shape grid (`TArray<F1DBooleanRow>`), an `EItemRotation`.
    * **Output:** A _new_ shape grid (`TArray<F1DBooleanRow>`) representing the input shape rotated by the specified amount (90, 180, or 270 degrees clockwise). `Rotation_0` returns the original shape.
    * **Use Case:** Calculating the footprint of a rotated item for placement checks or UI previews.

    <img src=".gitbook/assets/image (152).png" alt="" width="227" title="">
*   **`CalculateShapeSize(Shape)`:**

    * **Input:** An item shape grid.
    * **Output:** `FIntPoint` representing the width (X) and height (Y) of the shape's bounding box (the dimensions of the 2D array).
    * **Use Case:** Determining the grid space required to draw the item's UI representation.

    <img src=".gitbook/assets/image (153).png" alt="" width="166" title="">
*   **`CalculateLayoutSize(InventoryLayout)`:**

    * **Input:** An inventory layout definition (`TArray<FInventoryLayoutCreator>`).
    * **Output:** `FIntPoint` representing the width (X) and height (Y) of the minimum bounding rectangle encompassing _all_ accessible cells across _all_ clumps in the layout.
    * **Use Case:** Determining the overall dimensions needed for a UI grid widget displaying this inventory layout.

    <img src=".gitbook/assets/image (154).png" alt="" width="201" title="">
*   **`FindTopLeft(Shape)` / `FindTopRight(Shape)` / `FindBottomRight(Shape)`:**

    * **Input:** An item shape grid.
    * **Output:** `FIntPoint` representing the coordinates (relative to the shape's 0,0) of the first 'true' cell found when scanning from the top-left, top-right, or bottom-right, respectively. Returns `(0,0)` or `(-1,-1)` if no 'true' cells are found.
    * **Use Case:** Identifying key points within a shape, potentially for alignment or determining relative offsets during rotation.

    <img src=".gitbook/assets/image (155).png" alt="" width="171" title="">

### Rotation & Coordinate Transformation

These functions handle coordinate conversions related to item rotation.

*   **`AdjustRootSlot(RootSlot, OriginalShape, RotatedShape)`:**

    * **Input:** The intended root slot coordinate (`FIntPoint`) in the inventory grid, the item's original shape grid, the item's rotated shape grid.
    * **Output:** An adjusted `FIntPoint` root coordinate.
    * **Use Case:** Crucial for accurate placement. When an item rotates, its internal pivot point (e.g., the top-left 'true' cell) might shift relative to the overall shape grid. This function calculates the offset needed for the absolute `RootSlot` placement coordinate to ensure the rotated item visually aligns correctly in the grid. `ULyraTetrisInventoryManagerComponent::FindSlotsFromShape` uses this internally.

    <img src=".gitbook/assets/image (156).png" alt="" width="235" title="">
*   **`GetCellPositionAfterRotation(OriginalCellPosition, OriginalShape, Rotation)`:**

    * **Input:** A coordinate (`FIntPoint`) relative to the item's shape grid _before_ rotation, the original shape, the `EItemRotation` applied.
    * **Output:** The corresponding coordinate (`FIntPoint`) relative to the item's shape grid _after_ rotation.
    * **Use Case:** Determining where a specific part of an item ends up after rotation, perhaps for UI highlighting or attachment point calculation.

    <img src=".gitbook/assets/image (157).png" alt="" width="314" title="">
*   **`GetOriginalCellPosition(RotatedCellPosition, RotatedShape, Rotation)`:**

    * **Input:** A coordinate relative to the item's shape grid _after_ rotation, the rotated shape, the `EItemRotation` that was applied.
    * **Output:** The original coordinate relative to the item's shape grid _before_ rotation.
    * **Use Case:** Mapping a click on a rotated UI element back to the corresponding cell in the item's base definition shape.

    <img src=".gitbook/assets/image (158).png" alt="" width="320" title="">

### UI & Rendering Utilities

These functions assist with visual aspects, particularly in UMG widgets.

*   **`CreateMaskedTexture(SourceTexture, MaskMaterial, Shape, OutlineColor, OutlineThickness)`:**

    * **Input:** A source `UTexture2D` (e.g., item's diffuse texture), a `UMaterialInterface` designed for masking (expects `SourceTexture` and `MaskTexture` parameters), the item's `Shape` grid, an `OutlineColor`, and `OutlineThickness`.
    * **Output:** A `UMaterialInstanceDynamic` ready to be applied to a UMG `UImage`.
    * **Action:** Generates a temporary black-and-white mask `UTexture2D` based on the `Shape` grid (using `GenerateMaskTexture` internally), creates a dynamic instance of the `MaskMaterial`, and sets the `SourceTexture` and generated `MaskTexture` parameters. It also passes outline parameters if the material supports them.
    * **Use Case:** Creating the effect where an item's icon texture is clipped to its specific Tetris shape within a UMG Image widget. Requires a compatible Material.

    <img src=".gitbook/assets/image (159).png" alt="" width="271" title="">
*   **`RotateImageIconWidget(Image, ImageSize, MousePos, Rotation, ClickedCell, GridDimension)`:**

    * **Input:** The UMG `UImage` widget displaying the item, the image's total size (`FVector2D`), the mouse position _relative to the image widget_, the desired `EItemRotation`, the grid cell coordinate _within the item's shape_ that was clicked (`FIntPoint`), the dimensions of the item's shape grid (`FIntPoint`).
    * **Action:** Calculates the correct `RenderTransformPivot` based on the clicked cell and mouse position within that cell. Applies a `RenderTransform` with the specified rotation angle to the `Image` widget.
    * **Use Case:** Implementing interactive rotation previews in the UI where the item rotates around the point the player clicked.

    <img src=".gitbook/assets/image (160).png" alt="" width="279" title="">
*   **`GetRelativeMousePositionInCell(MousePos, CellWidth, CellHeight)`:**

    * **Input:** Mouse position relative to the top-left of the _entire image widget_, the width and height of a single grid cell within that image.
    * **Output:** `FVector2D` representing the mouse position relative to the top-left corner of the specific cell it's currently over. (Values range from 0 to CellWidth/CellHeight).
    * **Use Case:** Needed as input for `RotateImageIconWidget`'s pivot calculation.

    <img src=".gitbook/assets/image (161).png" alt="" width="244" title="">
*   **`GetOriginalMousePosition(MousePos, CellWidth, CellHeight, Rotation)`:**

    * **Input:** Mouse position relative to the top-left of a _rotated_ cell, the cell dimensions, the rotation applied.
    * **Output:** The calculated mouse position relative to the cell _as if it were not rotated_.
    * **Use Case:** Mapping mouse coordinates from a rotated UI element back to the item's unrotated space, perhaps for hit detection on specific parts of the original item texture.

    <img src=".gitbook/assets/image (162).png" alt="" width="316" title="">

### Clipboard Utilities

* **`CopyShapeToClipboard(Shape)`:** Copies a C++ struct representation of the `Shape` grid to the system clipboard. Useful for transferring shapes between items, copying the shape from the editor utility widget and for debugging.

<img src=".gitbook/assets/image (163).png" alt="" width="236" title="">

* **`CopyInventoryLayoutToClipboard(Clumps)`:** Copies a C++ struct representation of the `InventoryLayout` array to the clipboard. Useful for transferring complex layouts,copying the layout from the editor utility widget and for debugging.

<img src=".gitbook/assets/image (164).png" alt="" width="251" title="">

This library provides essential tools for working with the geometric and visual aspects of the Tetris inventory system, simplifying common calculations and UI interactions related to item shapes and rotations.
