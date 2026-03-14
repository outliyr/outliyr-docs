# Tetris Inventory

Welcome to the documentation for the **Tetris Inventory System Plugin**, a powerful extension to the modified base Lyra asset. This plugin transforms the foundational inventory management capabilities into a fully spatial, grid-based system, introducing visually engaging organization and deeper gameplay mechanics often seen in popular extraction shooters and survival games.

You want your players to _feel_ their inventory, not just scroll through a list, but physically rotate a rifle to wedge it next to a medical kit, open a backpack to find ammo buried inside, and combine berries with an empty bottle to brew a health potion. Grid-based inventories turn storage into a spatial puzzle, and this plugin gives you the complete toolkit to build one.

The Tetris Inventory Plugin extends the base Lyra inventory system with spatial grid mechanics: items have **shapes** that occupy multiple cells, **rotation** to fit tight spaces, **nested containers** for backpacks-within-backpacks, and a full **3D inspection system** for examining items up close.

***

### What You Get

```
┌────────────────────────────────────────────────────────────────┐
│                    Tetris Inventory Plugin                     │
├──────────────────────┬─────────────────────────────────────────┤
│                      │                                         │
│   Grid Layouts       │   Multi-cell item shapes                │
│   Item Rotation      │   Shape-aware placement & collision     │
│   Nested Containers  │   Backpacks, cases, ammo crates         │
│   Item Combining     │   Recipe-based crafting on the grid     │
│   3D Inspection      │   PocketWorlds-powered item previews    │
│   Async Icons        │   Dynamic icons reflecting attachments  │
│   Client Prediction  │   Responsive drag-and-drop multiplayer  │
│                      │                                         │
└──────────────────────┴─────────────────────────────────────────┘
```

All of this integrates with the [Item Container](../../base-lyra-modified/item-container/) system for container-agnostic transactions, predictions, and UI, so the same drag-and-drop, context menus, and windowing system that work with slot-based inventories also work with tetris grids.

***

### How It Builds on Base Lyra

The plugin is an **extension**, not a replacement. It inherits from and integrates with the base systems:

| Base System                                                                                                               | Tetris Extension                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ULyraInventoryManagerComponent`](../../base-lyra-modified/inventory/)                                                   | `ULyraTetrisInventoryManagerComponent` adds grid logic on top of the base item list, weight/count limits, and access rights                                           |
| [Item Container Interface](../../base-lyra-modified/item-container/item-container-architecture/the-container-contract.md) | Implements `ILyraItemContainerInterface` for container-agnostic operations with full prediction support                                                               |
| [Item Fragments](../../base-lyra-modified/items/items-and-fragments/item-fragments.md)                                    | Adds `InventoryFragment_Tetris` (shape), `InventoryFragment_Container` (nesting), `InventoryFragment_CraftRecipe` (recipes), `InventoryFragment_Inspect` (3D preview) |
| [Container UI System](../../base-lyra-modified/ui/item-container-ui-system/)                                              | `ULyraTetrisGridClumpWidget` implements the Window Content Interface for grid rendering                                                                               |

> [!INFO]
> You should be familiar with the [Modified Base Lyra Item System](../../base-lyra-modified/items/) and the [Item Container Architecture](../../base-lyra-modified/item-container/) before diving into the tetris-specific features. This documentation focuses on what the plugin adds, referencing the base docs for shared concepts.

***

### Key Concepts

A quick orientation of the major ideas you'll encounter:

* **Grid Layouts** — Inventories are defined by one or more "clumps" (rectangular grid sections) arranged in a coordinate space. A single inventory might be an 8×6 grid, or two separate 4×4 clumps side by side.
* **Item Shapes** — Each item defines a 2D boolean array representing its footprint. A pistol might be 2×1, a rifle 4×2 with an L-shaped cutout. The system validates shapes against available space during placement.
* **Rotation** — Items can be rotated (0°, 90°, 180°, 270°) to fit available space. The system automatically determines which rotations produce unique footprints based on shape symmetry.
* **Nested Containers** — Items with `InventoryFragment_Container` spawn their own child `ULyraTetrisInventoryManagerComponent`. A backpack inside a backpack inside a crate, with constraint propagation up the hierarchy.
* **Client Prediction** — Every grid operation (add, remove, move, rotate) is predicted client-side using GUID-keyed overlays, providing instant feedback while the server authorizes. The same prediction architecture from the Item Container system powers this.

***

### Documentation Structure

| Section                                                                       | What It Covers                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [**Item Fragments (Tetris Specific)**](item-fragments-tetris-specific/)       | The four fragments that give items spatial behavior - shapes, containers, crafting recipes, and 3D inspection       |
| [**Tetris Inventory Manager Component**](tetris-inventory-manager-component/) | The grid-based inventory container - grid system, configuration, item operations, nesting, prediction, and resizing |
| [**Querying Tetris Inventories**](querying-tetris-inventories.md)             | Hierarchical item tracking across nested containers in C++ and Blueprints                                           |
| [**Tetris Utilities**](utilities/)                                            | Helper libraries and data structures for shapes, rotation, and world-space items                                    |
| [**Item Inspection System**](item-inspection-system/)                         | 3D item previews and dynamic icon generation via PocketWorlds                                                       |
| [**Tetris Inventory UI**](tetris-inventory-ui/)                               | The UI layer that renders grids and handles input - ViewModel, grid clump widget, and input handler                 |
