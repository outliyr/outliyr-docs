# Defining Item Shape

The spatial presence of an item in the Tetris inventory grid is determined entirely by its `Shape` property within the `InventoryFragment_Tetris`. Understanding how to define this shape is crucial.

### **The `Shape` Property Structure**

**Shape (`TArray<F1DBooleanRow>`):** This is the most critical property. It defines the item's footprint.

* **Structure:**
  * **`TArray<>` (Outer Array):** Represents the **rows** of the item's shape grid. The number of elements in this outer array determines the height of the shape's bounding box.
  * **`F1DBooleanRow`:** A simple struct containing a nested `TArray<bool>` named `BooleanRow`.
  * **`BooleanRow` (Inner Array):** Represents the **columns** within a specific row. The number of elements in this inner array determines the width of that specific row.
* **Meaning:**
  * `true`: Represents a part of the item occupying that cell relative to the item's placement root.
  * `false`: Represents empty space within the rectangular bounds defined by the array dimensions. These cells are not part of the item's shape.
* **Root/Pivot:** While not explicitly defined, the system generally calculates placement based on a specified `RootSlot` coordinate in the inventory grid. The Shape grid is then overlaid relative to that root. The top-left true value in the Shape array often serves as a conceptual reference point.

```cpp
// In InventoryDataLibrary.h
USTRUCT(BlueprintType)
struct F1DBooleanRow
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<bool> BooleanRow;
    // ... helper operators/functions ...
};

// In InventoryFragment_Tetris.h
UCLASS(MinimalAPI)
class UInventoryFragment_Tetris : public ULyraInventoryItemFragment
{
    // ...
public:
    // The shape of the item where each element if true is a valid slot
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Item)
    TArray<F1DBooleanRow> Shape;
    // ...
};
```

* **`true` value:** Indicates that the grid cell at this `[Row][Column]` position is **occupied** by the item.
* **`false` value:** Indicates that the grid cell is **empty**.

**Important Considerations:**

* **Rectangular Array Requirement:** Runtime systems consuming this fragment **strictly require the `Shape` array to be rectangular** (all rows must have the same number of columns). Non-rectangular shapes or shapes with unnecessary empty outer rows/columns **will cause errors or incorrect behavior** in inventory placement, rotation calculations, or other game logic.
* **Manual Normalization Button:** Use the **"Normalize Shape (Pad Rows)"** button, located directly below the `Shape` property editor, to prepare the shape for runtime use.
  * **Action:** Clicking this button analyzes the `Shape`, finds the minimum bounding box required to contain all `true` cells, and **reconstructs the `Shape` array to fit this box exactly.**
  * **Result:** This removes any completely empty rows or columns from the outside edges and ensures the final `Shape` is a tightly cropped, rectangular grid representing the item's actual footprint. Any internal empty spaces (`false` values) within the bounding box are preserved.
  * **Empty Shape Handling:** If the original `Shape` contains no true cells at all, clicking the button sets it to a default 1x1 `[true]` shape.
* **Workflow:** Edit the `Shape` array freely. You might temporarily have extra empty rows/columns or jagged edges. **Before compiling the containing asset or testing the item in-game, click the "Normalize Shape (Pad Rows)" button** to clean up the data and ensure it's in the required rectangular format. Forgetting this step will likely lead to runtime issues.
* **Automatic Rotation Calculation:** The fragment automatically recalculates `AllowedRotations` whenever the Shape is modified in the editor (`PostEditChangeProperty`).

### **Visualizing Shapes: Examples**

<details>

<summary>2x1 Vertical Domino</summary>

**Visual**:

```
 X
 X
```

`Shape` Data:

* `Shape` (Outer TArray - 2 elements for 2 rows)
  * `[0]` (F1DBooleanRow - Row 0)
    * `BooleanRow` (Inner TArray - 1 element for 1 column)
      * `[0]` = `true`
  * `[1]` (F1DBooleanRow - Row 1)
    * `BooleanRow` (Inner TArray - 1 element for 1 column)
      * `[0]` = `true`

</details>

<details>

<summary><strong>2x2 'L' Shape</strong></summary>

**Visual:**

```
 X .
 X X
```

`Shape` Data:

* `Shape` (Outer TArray - 2 elements for 2 rows)
  * `[0]` (F1DBooleanRow - Row 0)
    * `BooleanRow` (Inner TArray - 2 elements for 2 columns)
      * `[0]` = `true`
      * `[1]` = `false`
  * `[1]` (F1DBooleanRow - Row 1)
    * `BooleanRow` (Inner TArray - 2 elements for 2 columns)
      * `[0]` = `true`
      * `[1]` = `true`

</details>

<details>

<summary>3x3 'T' Shape</summary>

**Visual:**

```
 X X X
   X
   X
```

`Shape` Data:

* `Shape` (Outer TArray - 2 elements for 2 rows)
  * `[0]` (F1DBooleanRow - Row 0)
    * `BooleanRow` (Inner TArray - 3 elements for 3 columns)
      * `[0]` = `true`
      * `[1]` = `true`&#x20;
      * `[2]` = `true`
  * `[1]` (F1DBooleanRow - Row 1)
    * `BooleanRow` (Inner TArray - 3 elements for 3 columns)
      * `[0]` = `false`
      * `[1]` = `true`&#x20;
      * `[2]` = `false`&#x20;
  * `[1]` (F1DBooleanRow - Row 3)
    * `BooleanRow` (Inner TArray - 3 elements for 3 columns)
      * `[0]` = `false`
      * `[1]` = `true`&#x20;
      * `[2]` = `false`&#x20;

</details>

### **Best Practice: Using the Shape Editor Utility Widget**

Manually editing nested `TArray` properties in the Unreal Details panel can be tedious and error-prone. This asset includes a dedicated **Shape Editor Utility Widget** designed to simplify this process.

#### **Recommended Workflow:**

1. **Open the Shape Editor:** Launch the provided Editor Utility Widget.
2. **Define Dimensions:** Add or remove rows and columns using the buttons provided..
3. **Click to Design:** Click on the grid cells in the widget to toggle them between occupied (`true`) and empty (`false`), visually creating your item's shape. **Green** cell will be part of the shape while r**ed** cells will not be part of the shape.
4. **Copy Shape Data:** Once satisfied, use the widget's "Generate Shape" button. This internally calls `UInventoryUtilityLibrary::CopyShapeToClipboard`, which generates a string representation of the `TArray<F1DBooleanRow>` data.
5. **Paste into Fragment:** Navigate to your `ULyraInventoryItemDefinition`, find the `InventoryFragment_Tetris`, and paste the copied string directly into the **`Shape`** property field in the Details panel. Unreal Engine will parse the string and populate the array data.

### **The Editor Preview**

To provide instant feedback, the `InventoryFragment_Tetris` utilizes a custom property editor (`FInventoryFragment_TetrisPropertyCustomization`). When you view the fragment in the Details panel, you will see:

1. The standard `TArray` editor for the `Shape` property.
2. Immediately below it, a non-interactive **visual grid preview** rendering the current `Shape` data. Occupied cells are typically shown in **green**, empty cells in **red**.

This preview updates automatically when you modify the `Shape` data (either manually or by pasting), allowing you to quickly verify the shape without needing the utility widget constantly open.

### **The `GetArea()` Function**

```cpp
UFUNCTION(BlueprintCallable)
int32 GetArea() const;
```

### Related Utilities

* **`UInventoryUtilityLibrary::CalculateShapeSize`:** Returns the width and height (dimensions) of the bounding box of the Shape array.
* **`UInventoryUtilityLibrary::FindTopLeft / FindTopRight / FindBottomRight`:** Helper functions to find the coordinates of key points within the shape grid (relative to the shape's 0,0).
* **`UInventoryFragment_Tetris::GetArea`:** Returns the number of true cells in the shape, representing the grid area the item occupies.

This function iterates through the entire `Shape` array and returns the total count of cells marked as `true`. It provides a simple measure of the item's footprint size in grid cells.
