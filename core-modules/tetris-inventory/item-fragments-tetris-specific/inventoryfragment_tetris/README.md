# InventoryFragment_Tetris

The `InventoryFragment_Tetris` is the cornerstone fragment for enabling items to interact spatially within the Tetris Inventory system. Any item definition that needs to occupy grid cells, be rotated, and visually represented within a grid layout _must_ include this fragment.

<img src=".gitbook/assets/image (3) (1).png" alt="" width="563" title="">

**Purpose and Role**

At its core, this fragment defines the two-dimensional **Shape** of an item on the inventory grid. It dictates which cells the item occupies relative to its root position. This shape information is fundamental for:

* **Placement Logic:** Determining if an item fits in available grid space.
* **Collision Detection:** Preventing items from overlapping.
* **Visual Representation:** Drawing the item's footprint in the UI.
* **Rotation Mechanics:** Calculating how the item's footprint changes when rotated.

Without this fragment, an item has no defined spatial presence in the Tetris grid and cannot be placed or manipulated within it.

**Core Concepts**

This fragment introduces two primary concepts, detailed further in the sub-pages:

1. **Item Shape:** The definition of the item's footprint using a 2D boolean array.
2. **Item Rotation:** The allowed rotational states based on the item's shape symmetry and how to work with rotated shapes.

**Configuration Overview**

When adding this fragment to an `ULyraInventoryItemDefinition`, the primary configuration involves:

* **`Shape` (TArray):** The crucial property defining the item's layout.

Note that the `AllowedRotations` property, while visible, is automatically calculated based on the `Shape` and is **read-only** in the editor.

**Runtime Usage Overview**

During gameplay, various systems query this fragment:

* **`ULyraTetrisInventoryManagerComponent`:** Uses the `Shape` and `AllowedRotations` for placement validation, move operations, and checking overlaps.
* **UI Widgets:** May use the `Shape` to render the item's visual representation in the grid and `AllowedRotations` to constrain user rotation input.
* **`GetArea()`:** A simple function returning the number of `true` cells in the `Shape`.
* **`GetAllowedRotations()`:** Returns the pre-calculated array of valid rotations for this item's shape.

**Editor Integration**

To streamline the process of defining item shapes, this fragment features a custom editor Details Panel customization:

* **Shape Preview Grid:** Directly below the `Shape` property array editor, a visual grid preview is rendered, showing the currently defined shape. This provides immediate visual feedback as you edit the `Shape` array data.
* **Read-Only Allowed Rotations:** The `AllowedRotations` property is displayed but marked as non-editable, reinforcing that it's derived data.

It is highly recommended to use the provided **Shape Editor Utility Widget** to visually design shapes and copy the resulting data string for pasting into the `Shape` property, leveraging the editor preview for confirmation. You can find this in the utilities folder of TetrisInventoryPlugin.

**Next Steps**

Dive deeper into the specifics of configuring and using this fragment:

* **Defining the Item Shape:** Learn how the `Shape` property works and best practices for setting it up.
* **Understanding Item Rotation:** Explore how rotation is calculated, validated, and applied.
