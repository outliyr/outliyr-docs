# InventoryFragment_Tetris

Every item needs to know how big it is on the grid. A pistol occupies a 1x2 strip. A helmet fills a 2x2 block. An L-shaped wrench takes up five cells in an asymmetric pattern. Without this information, the inventory system has no idea where an item fits, what it overlaps, or how it looks when rotated.

`InventoryFragment_Tetris` is where all of that lives. It's the foundational fragment for any item that participates in spatial inventory,if an item doesn't have this fragment, it doesn't exist on the grid.

***

### What This Fragment Does

At its core, `InventoryFragment_Tetris` defines two things:

1. **The item's 2D shape** - which cells the item occupies relative to its root position.
2. **The item's allowed rotations** - which rotational states produce a unique footprint (calculated automatically from the shape).

These two properties drive everything downstream:

| Consumer                               | How It Uses Shape & Rotation                                        |
| -------------------------------------- | ------------------------------------------------------------------- |
| `ULyraTetrisInventoryManagerComponent` | Placement validation, overlap checks, move operations               |
| UI grid widgets                        | Drawing the item's footprint on the grid                            |
| Player rotation input                  | Constraining which rotations the player can cycle through           |
| `GetArea()`                            | Returns the number of occupied cells (useful for weight/size rules) |

***

### The Shape Property

**`Shape` (`TArray<F1DBooleanRow>`)** - A 2D boolean grid that defines the item's spatial footprint. Each `true` cell is part of the item; each `false` cell is empty space within the bounding box.

```
Shape (TArray<F1DBooleanRow>)
│
├── [0] F1DBooleanRow ──── BooleanRow: [ true, true  ]   ← Row 0
└── [1] F1DBooleanRow ──── BooleanRow: [ true, false ]   ← Row 1

Visual result:
  X X
  X .
  (an L-shape)
```

* **Outer array** = rows. The number of elements determines the shape's height.
* **Inner array** (`BooleanRow`) = columns within that row. The number of elements determines the shape's width.
* **`true`** = this cell is part of the item's footprint.
* **`false`** = this cell is empty space (a "hole" in the bounding box).

The top-left `true` value in the array serves as the conceptual reference point. When placing items, the system overlays this grid relative to the `RootSlot` coordinate in the inventory.

> [!WARNING]
> **All rows must have the same number of columns.** The runtime systems, placement logic, rotation calculations, overlap checks,strictly require a rectangular array. The interactive editor handles this automatically, but if you modify shape data programmatically, ensure rows are uniform.

***

### The Shape Editor

You design item shapes directly in the Details panel. When you select an `InventoryFragment_Tetris`, the shape property displays as an **interactive grid editor**, no need to edit raw arrays or use external tools.

<img src=".gitbook/assets/image (4).png" alt="" title="">

#### How It Works

* **Click any cell** to toggle it between occupied (**green**) and empty (**red**).
* **+ / - Row buttons** at the top and bottom add or remove rows.
* **+ / - Col buttons** on the left and right add or remove columns.
* Every edit automatically normalizes the shape and recalculates allowed rotations.
* Full **undo/redo** support, every cell toggle and dimension change is a proper editor transaction.

> [!INFO]
> The editor handles all normalization for you. When you toggle cells or resize the grid, the shape data stays rectangular and the rotation list refreshes immediately. You can focus on designing the silhouette without worrying about data integrity.

#### Read-Only Rotation Display

Below the grid editor, the `AllowedRotations` array appears in a "Rotation Debugging" category. This shows which rotations the system calculated as unique for the current shape. It's derived data, you can inspect it but never need to edit it.

***

### Item Rotation

You're staring at a 1x4 rifle that won't fit in the remaining horizontal space. Rotate it 90 degrees and it slides right into a vertical gap. That single rotation is the difference between "inventory full" and "perfect fit."

#### The EItemRotation Enum

All rotation states are expressed through a single enum:

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

These represent **clockwise** rotations relative to the default `Rotation_0` state, the shape exactly as it appears in the editor.

#### Symmetry-Based Filtering

Not every item benefits from all four rotational states. A 2x2 square looks identical at every rotation. A 2x1 domino at 180 degrees is the same as 0 degrees. Offering redundant rotations would confuse players and waste processing time.

The system solves this automatically:

```
1x1 Square         2x1 Domino          L-Shape
┌───┐               ┌───┐              ┌───┬───┐
│ X │               │ X │              │ X │   │
└───┘               │ X │              │ X │ X │
                    └───┘              └───┴───┘
Allowed: [0]        Allowed: [0, 90]   Allowed: [0, 90, 180, 270]

(all rotations      (180 = same as 0,  (every rotation produces
 look the same)      270 = same as 90)  a unique footprint)
```

Whenever you change the shape in the editor, `CalculateAllowedRotations` runs automatically:

{% stepper %}
{% step %}
**Start with the base**

`Rotation_0` is always allowed, every item has at least its default orientation.
{% endstep %}

{% step %}
**Rotate and compare**

The shape grid is programmatically rotated by 90, 180, and 270 degrees.
{% endstep %}

{% step %}
**Filter duplicates**

Each rotated shape is compared against the original and all previously accepted rotations. If a rotation produces the same footprint as one already in the list, it's skipped.
{% endstep %}
{% endstepper %}

#### Runtime Usage

Three systems consume rotation data during gameplay:

| System              | How It Uses Rotation                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Placement logic** | `FindAvailableSlotsForItem` iterates through `AllowedRotations`, checking if the rotated shape fits at each candidate position.   |
| **Grid storage**    | When placed, the `FTetrisPlacement` for the item stores the `EItemRotation` that was used, this persists across replication.      |
| **UI interaction**  | Widgets let the player cycle through `AllowedRotations` (typically by pressing `R` while dragging) and preview the rotated shape. |

***

### Runtime API

| Function                | What It Does                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `GetAllowedRotations()` | Returns the `TArray<EItemRotation>` of unique rotations for this item.                 |
| `GetArea()`             | Returns the count of `true` cells in the shape, how many grid cells the item occupies. |
| `GetShapeDimensions()`  | Returns the width and height of the shape's bounding box.                              |

> [!INFO]
> For shape math at runtime, rotating shapes, calculating bounding boxes, transforming cell coordinates, see the [Tetris Utility Library](../utilities/tetris-utility-library.md). Key functions include `RotateShape`, `GetCellPositionAfterRotation`, `GetOriginalCellPosition`, and `AdjustRootSlot`.
