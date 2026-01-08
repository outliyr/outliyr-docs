# Utilities

The Tetris Inventory Plugin provides several utility libraries and data structures to assist with common tasks related to grid manipulation, shape calculations, UI interactions, and data management specific to the spatial inventory system.

This section serves as a reference for these helper elements.

### Purpose

These utilities aim to:

* **Simplify Complex Tasks:** Provide pre-built functions for operations like shape rotation, coordinate lookups, and masked texture generation.
* **Encapsulate Logic:** Keep common calculations and data structures organized and reusable.
* **Improve Readability:** Offer clear, named functions for operations instead of scattering complex math throughout various Blueprints or C++ classes.
* **Standardize Data:** Define common data structures used across different parts of the Tetris system (e.g., for representing shapes, layouts, found slots).

### Overview of Utilities

The following subpages provide details on the specific utilities included in this plugin:

1. **Data Types (`InventoryDataLibrary`):**
   * Defines fundamental enums and helper structs used throughout the Tetris system. This includes `EItemRotation`, structures for representing boolean/integer rows (`F1DBooleanRow`, `F1DIntegerRow`), the inventory layout definition (`FInventoryLayoutCreator`), and data carriers like `FFoundCells`.
2. **Inventory Utility Library (`UInventoryUtilityLibrary`):**
   * A Blueprint Function Library containing static functions primarily focused on **shape manipulation, coordinate transformations, and UI-related calculations** for the Tetris grid.
   * Includes functions for rotating shapes, calculating shape/layout dimensions, generating masked icons, handling mouse interactions relative to grid cells, and converting coordinate systems during rotation.
3. **Item Utility Library (`UItemUtilityLibrary`):**
   * A Blueprint Function Library containing more general item-related utilities that might be used alongside the inventory system, though not strictly limited to it.
   * Currently includes functions like `GetRandomPointsInSplineArea` for finding spawn locations within an area, which could be useful for procedural item spawning near containers or in defined loot zones.

By familiarizing yourself with these utilities, you can often save development time and implement Tetris inventory features more efficiently and robustly. Refer to the specific subpages for detailed descriptions and usage examples of the functions and data structures provided.
