# Grid Layout

The foundation of any Tetris-style inventory is the grid itself – the defined space where items can be placed. Unlike simple list inventories, the **Grid Layout** defines the specific structure, dimensions, and available cells of a `ULyraTetrisInventoryManagerComponent`. This system uses a flexible approach based on "Clumps" to allow for complex and non-rectangular inventory shapes.

### The Clump Concept

Instead of forcing inventories into a single rectangular grid, this system defines layouts using one or more **Clumps**. Think of each Clump as a distinct section or area within the overall inventory space.

* **Flexibility:** Allows creating L-shapes, U-shapes, inventories with holes, separate equipment-specific areas, or any arbitrary 2D arrangement of accessible cells.
* **Composition:** The final inventory layout is the combination of all defined Clumps.
* **Placement Boundary:** Crucially, each Clump acts as a **separate zone for item placement**. An item, regardless of its shape, **must fit entirely within the boundaries of a single Clump**. Items **cannot** span across multiple Clumps.

### The `FInventoryLayoutCreator` Struct

Each Clump in the inventory layout is defined by an instance of the `FInventoryLayoutCreator` struct.

**Members Explained:**

* **`ClumpX`, `ClumpY` (int32):** These define the **origin (top-left corner)** of this specific Clump relative to the overall inventory's coordinate space (which implicitly starts at 0,0). For example, a `ClumpX` of 5 and `ClumpY` of 0 would place this clump starting 5 cells to the right of the inventory's left edge.
* **`ClumpGrid` (`TArray<F1DBooleanRow>`):** This is the core definition of the clump's shape and accessibility.
  * It's a 2D array of booleans (represented as an array of `F1DBooleanRow` structs).
  * Each element in the `ClumpGrid` corresponds to a potential cell **relative to the Clump's `ClumpX`, `ClumpY` origin.**
  * true: This cell exists and is accessible for item placement within this clump.
  * false: This cell is blocked, non-existent, or purely structural within the clump's bounding rectangle. Items cannot be placed with their root here, nor can their shape occupy this cell.

### Defining the Inventory Layout

The final layout for an inventory is configured on the `ULyraTetrisInventoryManagerComponent` using its `InventoryLayout` property:

This is simply an **array of `FInventoryLayoutCreator` structs**. By adding multiple entries to this array, you define multiple clumps, which combine to form the complete inventory space.

**Example: Creating an L-Shape**

Imagine you want an L-shaped inventory that is 3 cells wide at the top and 3 cells high on the left, like this (X represents accessible cells):

```
X X X
X . .
X . .
```

You could define this using two Clumps:

1. **Top Bar Clump:**
   * `ClumpX: 0`
   * `ClumpY: 0`
   * `ClumpGrid: [[true, true, true]]` (A 1x3 row)
2. **Left Bar Clump:**
   * `ClumpX: 0`
   * `ClumpY: 1` (Starts one row below the top bar)
   * `ClumpGrid: [[true], [true]]` (Two 1x1 rows, forming a 2x1 column)

Visually, these combine to form the L-shape. **However, the critical implication of using two separate Clumps is for item placement:**

* **Placement Constraint:** Because items must fit entirely within a single clump, an L-shaped item that requires cells from both the top bar and the left bar area (e.g., an item needing cells (0,0), (0,1), (1,0)) **could NOT be placed** in this specific two-clump layout. It attempts to span the boundary between Clump 0 and Clump 1.
* **Alternative (Single Clump):** If you need to place items that occupy the corner and parts of both "legs" of the L, you **must** define the entire L-shape within a **single Clump**. For example:
  * **Single L-Shape Clump:**
    * ClumpX: 0
    * ClumpY: 0
    * ClumpGrid: \[\[true, true, true], \[true, false, false], \[true, false, false]] (A 3x3 grid defining the 'L')
  * In this single-clump layout, an L-shaped item could be placed, provided its shape fits within this 3x3 grid definition.

**In essence:** Using multiple clumps is like creating separate, adjacent inventory partitions. It allows complex visual layouts but restricts item placement to within those individual partitions. Use a single, larger Clump definition if you need items to occupy complex shapes that might visually appear to cross between areas you could have defined as separate clumps.

### Configuration in Editor

You configure the `InventoryLayout` directly on your `ULyraTetrisInventoryManagerComponent` (or actors/Blueprints containing it) in the Unreal Editor Details panel:

1. **Locate:** Select the Actor/Blueprint with the component.
2. **Find Property:** Find the Inventory Layout property under the component's settings.
3. **Add Clumps:** Click the `+` icon next to Inventory Layout to add a new `FInventoryLayoutCreator` element (a Clump).
4. **Configure Clump Origin:** Set the Clump X and Clump Y for the new Clump.
5. **Define Clump Grid:**
   * Expand the Clump Grid property.
   * Click the `+` next to Clump Grid to add a new row (`F1DBooleanRow`).
   * Expand the new row element.
   * Click the `+` next to Boolean Row to add cells (boolean checkboxes) to that row.
   * Check the boxes corresponding to the cells you want to be accessible (true). Leave unchecked for inaccessible cells (false).
   * Repeat steps 5b-5e to define all rows and cells for the Clump.
6. **Repeat:** Repeat steps 3-5 for every Clump needed to create your desired inventory shape.

### **Best Practice: Using the Layout Editor Utility Widget**

Manually editing nested `TArray` properties in the Unreal Details panel can be tedious and error-prone. This asset includes a dedicated **Layout Creator Editor Utility Widget** designed to simplify this process.

<img src=".gitbook/assets/image (14).png" alt="" width="563" title="">

#### **Recommended Workflow:**

1. **Launch the Shape Editor:** Right click utility widget (`EUW_InventoryLayoutCreator`) -> Run Editior Utility Widget
2. **Define Clumps**: Add or remove clumps using the buttons provided. You can drag and drop clumps around to place them however you want in the grid.
3. **Define Clump Dimensions:** Right click on a clump, to select it, then add or remove rows and columns to the clump using the buttons provided.
4. **Click to Design:** Click on the grid cells in the widget to toggle them between occupied (`true`) and empty (`false`), visually creating the clump's shape. **Green** cell will be cells that can be occupied while r**ed** cells will be inaccessible cells.
5. **Copy Shape Data:** Once satisfied, use the widget's "Generate Shape" button. This internally calls `UInventoryUtilityLibrary::CopyInventoryLayoutToClipboard`, which generates a string representation of the inventory layout data.
6. **Paste into Fragment:** Navigate to any asset or component that includes the `InventoryLayout` property — such as an `InventoryFragment_Container` in a `ULyraInventoryItemDefinition`, or directly on a `ULyraTetrisInventoryManagerComponent`.\
   Paste the copied string into the `InventoryLayout` field in the Details panel. Unreal Engine will parse the string and automatically populate the layout data.

> [!info]
> Make sure the window is big enough to fit the editor widget into the screen

<img src=".gitbook/assets/image (15).png" alt="" width="563" title="">

### Runtime Representation (`FGridCellInfoList` & `GridCellIndexMap`)

While `InventoryLayout` defines the configuration, the `ULyraTetrisInventoryManagerComponent` uses this at runtime (specifically in `FGridCellInfoList::PopulateInventoryGrid`) to build its internal representation:

* **`GridCells` (`TArray<FGridCellInfo>`):** A flat list containing an `FGridCellInfo` struct for every single accessible cell defined across all clumps. Each `FGridCellInfo` stores its absolute position, the Clump ID it originated from, its current item instance (if any), rotation, and root slot pointer.
* **`GridCellIndexMap` (`TArray<FInventoryClumpIndexMapping>`):** A crucial **non-replicated** performance optimization. It's essentially a 3D lookup table `[ClumpID][RowIndex][ColIndex]` that directly maps grid coordinates back to the index within the flat `GridCells` array. This allows for very fast `O(1)` lookups when checking specific coordinates, which is vital for placement and interaction logic. Cells marked false in the layout have a value of -1 in this map. Clients rebuild this map locally based on the replicated `InventoryLayout` and `GridCells`.

> [!info]
> See the [**Grid Representation**](grid-representation.md) subpage for more details on the runtime structures.

### Related Utilities

* **`UInventoryUtilityLibrary::CalculateLayoutSize`:** Computes the minimum bounding box (width and height) required to encompass all defined accessible cells across all clumps. Useful for determining UI grid dimensions.
* **`ULyraTetrisInventoryManagerComponent::CanOccupySlot`:** Checks if a specific coordinate (`ClumpID`, `FIntPoint`) corresponds to an accessible cell (i.e., was marked true in the original `InventoryLayout` definition).

By understanding how to define Grid Layouts using Clumps and the `FInventoryLayoutCreator`, you gain precise control over the shape and structure of your spatial inventories.

