# Tetris Inventory

Welcome to the documentation for the **Tetris Inventory System Plugin**, a powerful extension to the modified base Lyra asset. This plugin transforms the foundational inventory management capabilities into a fully spatial, grid-based system, introducing visually engaging organization and deeper gameplay mechanics often seen in popular extraction shooters and survival games.

### Purpose

This plugin is designed to provide developers with a robust and flexible system for creating inventories where item **shape**, **rotation**, and **grid placement** are primary mechanics. It moves beyond simple list-based storage to offer:

* Visually organized inventory grids with arbitrary layouts.
* Items with defined multi-cell shapes ("Tetris pieces").
* Functionality for rotating items to fit available space.
* Container items that can hold their own nested Tetris inventories.
* An integrated 3D item inspection system using PocketWorlds.
* A foundation for advanced inventory interactions like spatial crafting or item combining.

### Core Benefits

Integrating the Tetris Inventory System offers several advantages:

* **Enhanced Gameplay:** Introduces spatial puzzle elements to inventory management, making looting and organization more interactive and challenging.
* **Visual Appeal:** Provides a clear, intuitive, and visually satisfying way for players to view and manage their gear.
* **Immersion:** The detailed item inspection system allows players to examine their items closely in 3D.
* **Flexibility:** Built upon the modular fragment system of the enhanced Lyra base, allowing Tetris features to be added selectively to items.
* **Extensibility:** Designed with clear separation, enabling customization and addition of new features.
* **Networking:** Leverages the underlying networked Lyra inventory and GAS framework for multiplayer support.

### Dependencies & Prerequisites

This plugin builds directly upon the **Modified Base Lyra Game Core** provided with this asset package. It relies heavily on the core concepts and systems established there, including:

* The enhanced `ULyraInventoryManagerComponent`.
* The [Item Definition](../../base-lyra-modified/items/items-and-fragments/item-definition.md) (`ULyraInventoryItemDefinition`) and [Item Instance ](../../base-lyra-modified/items/items-and-fragments/item-instance.md)(`ULyraInventoryItemInstance`) system.
* The [Item Fragment](../../base-lyra-modified/items/items-and-fragments/item-fragments.md) system (including Transient Fragments).
* The [Gameplay Ability System (GAS) integration layer](../../base-lyra-modified/items/gas-and-ui-integration-layer/) (`UInventoryAbilityFunctionLibrary`, `FAbilityData_SourceItem`).

**It is highly recommended to have a solid understanding of the concepts within the** [**Modified Base Lyra Item Documentation**](../../base-lyra-modified/items/) **before diving into the Tetris-specific features.** This documentation will assume familiarity with those base systems and will focus primarily on the additions and modifications introduced by the Tetris Inventory Plugin.

### Key Concepts Added

This plugin introduces several new core concepts specific to grid-based inventories:

* **Grid Layouts (`FInventoryLayoutCreator`):** Define the structure and available cells of an inventory container using one or more "clumps" arranged in a coordinate space.
* **Item Shapes (`InventoryFragment_Tetris`):** Define the multi-cell footprint of an item using a 2D boolean array.
* **Item Rotation (`EItemRotation`):** Allow items to be oriented (0, 90, 180, 270 degrees) to fit into the grid.
* **Spatial Placement:** The core mechanic of finding valid empty cells within the grid that can accommodate an item's shape and rotation.
* **Nested Inventories (`InventoryFragment_Container`):** Enable specific items (like backpacks or cases) to contain their own fully functional Tetris inventory grids.
* **Item Combination (`InventoryFragment_Combine`):** A fragment allowing items to define recipes for combining with other specific items when dropped onto each other.
* **Item Inspection (`InventoryFragment_Inspect`, PocketWorlds):** A system utilizing UE's PocketWorlds plugin to render interactive 3D previews of items.

### Relationship to Base Lyra Inventory

The Tetris Inventory Plugin is designed as an **extension**, not a replacement, of the base inventory system. It integrates seamlessly:

* **Inheritance:** The `ULyraTetrisInventoryManagerComponent` inherits from the base `ULyraInventoryManagerComponent`, gaining all its core functionality (item list management, weight/count limits, access rights, permissions) and adding grid-specific logic on top.
* **Fragments:** Introduces new fragments (like `InventoryFragment_Tetris`, `InventoryFragment_Container`) that work alongside existing base fragments (like `InventoryFragment_InventoryIcon`, `InventoryFragment_SetStats`). An item typically needs both base and Tetris fragments to function correctly in this system.
* **GAS Integration:** Leverages the _same_ `UInventoryAbilityFunctionLibrary` and GAS workflow established in the base system. It introduces a new data payload struct (`FInventoryAbilityData_SourceTetrisItem`) derived from `FAbilityData_SourceItem` to represent item locations within the grid context.
* **Core Objects:** Relies on the fundamental `ULyraInventoryItemDefinition` and `ULyraInventoryItemInstance` objects defined in the base system.

### Documentation Structure

This documentation is organized to guide you through the various aspects of the Tetris Inventory System:

* **Item Fragments (Tetris Specific):** Covers the new fragments introduced or enhanced for the Tetris system.
* **Tetris Inventory Manager Component:** Explores the capabilities and configuration of the grid-based inventory container.
* **Utilities:** Documents helper libraries and data structures specific to this plugin.
* **GAS & UI Integration (Tetris Specific):** Explains how UI interacts with the Tetris inventory via GAS.
* **Querying Tetris Inventories:** Describes how to efficiently query items across nested inventories.
* **Item Inspection System:** Details the 3D item preview functionality and its PocketWorlds integration.
* **Getting Started / Examples:** Provides practical guides and examples.

Each major section contains an overview page, followed by detailed subpages covering specific components or concepts. I encourage you to follow the structure sequentially for the best understanding.

Let's begin by exploring the **Item Fragments** specific to the Tetris Inventory system!
