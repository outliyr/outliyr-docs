# Tetris Utility Library

An L-shaped item sits at rotation 0. The player rotates it 90 degrees. Now you need the new bounding box, the rotated shape array, the updated icon material, and the transformed cell coordinates, all in one frame. Writing that math from scratch every time would be tedious and error-prone.

`UTetrisUtilityLibrary` is a Blueprint Function Library containing static functions for shape manipulation, coordinate transformations, icon generation, and grid analysis. Every function is `BlueprintCallable`, so you get full access from both C++ and Blueprints.

***

### Types Defined in This Header

Before the function library itself, the header defines two supporting types used by several functions.

#### `EContiguousDirection`

Controls the scan direction for `CountContiguousCellsInRow`.

```cpp
UENUM(BlueprintType)
enum class EContiguousDirection : uint8
{
    FromLeft  UMETA(DisplayName = "From Left"),
    FromRight UMETA(DisplayName = "From Right")
};
```

`FromLeft` starts counting filled cells from column 0 and stops at the first gap. `FromRight` starts from the last column and counts backward.

#### `FTetrisCellBorders`

Describes which sides of a cell should draw a border line. Returned by `GetCellBorders`.

```cpp
USTRUCT(BlueprintType)
struct FTetrisCellBorders
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite)
    bool bTop = false;

    UPROPERTY(BlueprintReadWrite)
    bool bBottom = false;

    UPROPERTY(BlueprintReadWrite)
    bool bLeft = false;

    UPROPERTY(BlueprintReadWrite)
    bool bRight = false;
};
```

A cell only gets a border on sides where there is no adjacent filled cell. This produces clean contiguous outlines around arbitrary Tetris shapes rather than drawing a box around every individual cell.

***

### Shape Manipulation

These functions operate on shapes represented as `TArray<F1DBooleanRow>`, the same format used by `InventoryFragment_Tetris::Shape`.

#### `RotateShape`

```cpp
static TArray<F1DBooleanRow> RotateShape(
    const TArray<F1DBooleanRow>& Shape,
    const EItemRotation& Rotation);
```

Rotates a boolean shape grid to the specified orientation. Pass `Rotation_0` to get the shape back unchanged, `Rotation_90` to rotate clockwise 90 degrees, and so on.

Internally, this calls `RotateShape90Degrees` the appropriate number of times. The returned array is a new shape, the original is not modified.

{% hint style="info" %}
This function handles non-square shapes correctly. An L-shape that is 2 wide and 3 tall becomes 3 wide and 2 tall after a 90-degree rotation. The output dimensions adjust automatically.
{% endhint %}

***

#### `CalculateShapeSize`

```cpp
static FIntPoint CalculateShapeSize(const TArray<F1DBooleanRow>& Shape);
```

Returns the width (X) and height (Y) of the smallest rectangle that contains all filled cells in the shape. Useful for allocating UI space or validating that a rotated shape fits within grid boundaries.

***

#### `CalculateLayoutSize`

```cpp
static FIntPoint CalculateLayoutSize(const TArray<FInventoryLayoutCreator>& InventoryLayout);
```

Returns the total width (X) and height (Y) needed to contain all clumps in an inventory layout, accounting for each clump's origin offset and grid dimensions. Used by the UI to size the grid widget correctly.

***

#### `FindBoundingBox`

```cpp
static FIntRect FindBoundingBox(const TArray<F1DBooleanRow>& Shape);
```

Returns the tight bounding rectangle around all filled cells in the shape as an `FIntRect`. Unlike `CalculateShapeSize` which returns dimensions, this returns the actual min/max coordinates -- useful when you need to know where filled cells start and end within the array, not just how much space they occupy.

***

#### `FindTopLeft` / `FindTopRight` / `FindBottomRight`

```cpp
static FIntPoint FindTopLeft(const TArray<F1DBooleanRow>& Shape);
static FIntPoint FindTopRight(const TArray<F1DBooleanRow>& Shape);
static FIntPoint FindBottomRight(const TArray<F1DBooleanRow>& Shape);
```

Return the coordinates of specific corner cells within a shape. These scan the boolean grid and return the first filled cell found at each corner position.

**Common use case:** Overlaying things ontop of an icon, you want to know where the bottom right cell is so you can place the item count.

***

#### `CountContiguousCellsInRow`

```cpp
static int32 CountContiguousCellsInRow(
    const TArray<F1DBooleanRow>& Shape,
    int32 RowIndex,
    EContiguousDirection Direction);
```

Counts how many consecutive filled cells exist in a specific row, starting from one side. With `FromLeft`, it counts from column 0 rightward until it hits an empty cell. With `FromRight`, it counts from the last column leftward.

**Example:** For a row `[true, true, false, true]`, `FromLeft` returns `2` (stops at the gap), and `FromRight` returns `1` (only the last cell before the gap).

***

#### `IsCellFilled`

```cpp
static bool IsCellFilled(
    const TArray<F1DBooleanRow>& Shape,
    FIntPoint CellPosition);
```

Checks whether a specific cell is filled in a shape array. Returns `false` for empty cells and for positions that are out of bounds. This is the safe way to do hit-testing on shaped items -- no bounds checking required on your end.

***

#### `GetCellBorders`

```cpp
static FTetrisCellBorders GetCellBorders(
    const TArray<F1DBooleanRow>& Shape,
    int32 X,
    int32 Y);
```

Determines which sides of a cell need visible borders by checking adjacent cells in the shape. A border is needed on any side where the neighboring cell is empty or out of bounds.

This is the foundation for drawing clean shape outlines in the UI. Instead of drawing a rectangle around every cell, you draw borders only on the edges of the shape -- producing the characteristic Tetris-piece outline.

```
The shape (an L-piece):            GetCellBorders(Shape, X=1, Y=0):

       col 0   col 1
      ┌───────┬───────┐
row 0 │   X   │  [X]  │  ← queried cell
      ├───────┼───────┘
row 1 │   X   │
      └───────┘

Result for the [X] cell:
  Top:    true   (row 0 — no row above)
  Bottom: true   (cell below at (1,1) is empty)
  Left:   false  (cell at (0,0) is filled)
  Right:  true   (last column — no cell to the right)

Applied to the whole shape, borders produce this outline (no internal borders):

  ┌───────────────┐
  │   X       X   │
  │       ┌───────┘
  │   X   │
  └───────┘
```

***

### Coordinate Transformations

When an item rotates, every cell's position within the shape changes. These functions handle the mapping between original and rotated coordinate spaces.

#### `GetCellPositionAfterRotation`

```cpp
static FIntPoint GetCellPositionAfterRotation(
    const FIntPoint& OriginalCellPosition,
    const TArray<F1DBooleanRow>& OriginalShape,
    EItemRotation Rotation);
```

Given a cell position in the **original** (unrotated) shape, returns where that cell ends up after the specified rotation. The `OriginalShape` parameter is needed to calculate the rotation pivot correctly based on the shape's dimensions.

**Use case:** You know a player clicked cell (1, 2) in the original shape definition. The item is currently at `Rotation_90`. This function tells you which cell in the rotated shape corresponds to that original cell.

***

#### `GetOriginalCellPosition`

```cpp
static FIntPoint GetOriginalCellPosition(
    const FIntPoint& RotatedCellPosition,
    const TArray<F1DBooleanRow>& RotatedShape,
    EItemRotation Rotation);
```

The inverse of `GetCellPositionAfterRotation`. Given a cell position in the **rotated** shape, returns the corresponding position in the original (unrotated) shape. The `RotatedShape` parameter is the already-rotated shape array.

**Use case:** The player clicks a cell in the grid where a rotated item is displayed. You need to map that back to the original shape coordinates to look up metadata (like per-cell damage states or attachment points).

***

### Icon and UI Functions

These functions handle the visual side of the inventory, generating masked materials, positioning icons during drag operations, and handling mouse coordinate transformations.

#### `CreateMaskedTexture`

```cpp
static UMaterialInstanceDynamic* CreateMaskedTexture(
    UTexture2D* SourceTexture,
    UMaterialInterface* MaskMaterial,
    const TArray<F1DBooleanRow>& Shape,
    FColor OutlineColor,
    int32 OutlineThickness);
```

Creates a dynamic material instance that masks a source texture to match an item's boolean shape. The result is a texture where only the pixels within the filled cells of the shape are visible, with an optional colored outline around the shape edges.

This is how inventory icons get their distinctive shaped appearance -- a full rectangular texture is masked to show only the cells the item occupies.

***

#### `CreateSolidColorMaskedMaterial`

```cpp
static UMaterialInstanceDynamic* CreateSolidColorMaskedMaterial(
    UMaterialInterface* MaskMaterial,
    const TArray<F1DBooleanRow>& Shape,
    FLinearColor FillColor,
    FColor OutlineColor,
    int32 OutlineThickness,
    int32 TextureSize = 64);
```

Similar to `CreateMaskedTexture`, but uses a solid color instead of a source texture. Produces a shaped, colored background with an optional outline, useful for item backgrounds, rarity-colored underlays, or selection highlights.

The `TextureSize` parameter controls the resolution of the generated mask texture. The default of 64 is sufficient for most UI use cases and keeps generation fast. Increase it only if you need higher-fidelity outlines at large display sizes.

{% hint style="info" %}
Both masked material functions generate their mask textures at runtime using `GenerateMaskTexture` (a private helper). The mask is a procedurally created `UTexture2D` based on the item's shape -- no artist-authored mask textures needed.
{% endhint %}

***

#### `RotateImageIconWidget`

```cpp
static void RotateImageIconWidget(
    UImage* Image,
    FVector2D ImageSize,
    FVector2D MousePos,
    EItemRotation Rotation,
    FIntPoint ClickedCell,
    FIntPoint GridDimension);
```

Applies the correct translation and rotation render transform to a `UImage` widget so that the item icon rotates around the cursor as an anchor point. During a drag operation, this keeps the icon visually rotating around the cell the player originally clicked, rather than rotating around the image center (which would cause it to "jump" on screen).

**Parameters explained:**

* `Image` - The UMG Image widget displaying the item icon.
* `ImageSize` - The widget's pixel dimensions.
* `MousePos` - Current mouse position relative to the grid.
* `Rotation` - The desired rotation to apply.
* `ClickedCell` - Which cell in the item's shape the player originally clicked.
* `GridDimension` - Cell size in pixels (width, height).

***

#### `GetRelativeMousePositionInCell`

```cpp
static FVector2D GetRelativeMousePositionInCell(
    const FVector2D& MousePos,
    float CellWidth,
    float CellHeight);
```

Converts an absolute mouse position to a position relative to the cell the mouse is over. Returns a value in the range `[0, CellWidth)` x `[0, CellHeight)`. Useful for determining where within a cell the player clicked, for example, to decide which half of a cell a drag should snap to.

***

#### `GetOriginalMousePosition`

```cpp
static FVector2D GetOriginalMousePosition(
    const FVector2D& MousePos,
    float CellWidth,
    float CellHeight,
    EItemRotation Rotation);
```

Transforms a mouse position from rotated coordinate space back to the original (unrotated) coordinate space. When the player is dragging a rotated item, the mouse position needs to be un-rotated to correctly calculate which cell in the original shape the cursor is over.

***

### Clipboard Utilities

Developer-facing helpers for copying shape and layout data to the system clipboard as formatted text.

#### `CopyShapeToClipboard`

```cpp
static void CopyShapeToClipboard(const TArray<F1DBooleanRow>& Shape);
```

Copies a boolean shape grid to the clipboard as a text representation. Useful during development for quickly grabbing shape data from the editor to paste into documentation, bug reports, or test code.

***

#### `CopyInventoryLayoutToClipboard`

```cpp
static void CopyInventoryLayoutToClipboard(const TArray<FInventoryLayoutCreator>& Clumps);
```

Copies a full inventory layout (all clumps with their origins and grids) to the clipboard as formatted text. Handy for sharing layout configurations between team members or archiving layout designs.

***

<details>

<summary>Private helpers (not callable from Blueprints)</summary>

The library also contains a few private functions used internally by the public API:

| Function               | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `ConvertShapeToString` | Turns a boolean shape into a text string for clipboard operations          |
| `RotateShape90Degrees` | Single 90-degree clockwise rotation (called repeatedly by `RotateShape`)   |
| `GenerateMaskTexture`  | Creates a procedural `UTexture2D` from a shape for use in masked materials |

These are implementation details. If you need shape-to-string conversion in your own code, call `CopyShapeToClipboard` and read from the clipboard, or implement your own conversion using the public shape data.

</details>
