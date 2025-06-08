# Querying Tetris Inventories

Often, game systems outside the immediate UI need to efficiently track the presence and quantity of specific item types, even when those items might be hidden inside nested containers (like backpacks within backpacks). Constantly iterating through multiple inventories is inefficient.

The **Tetris Inventory Query** system provides a reactive and performant solution for monitoring specific items across an entire inventory hierarchy, starting from a root component.

### Prerequisite: Understanding Base Query System

This system builds upon the concepts of the base Lyra Item Query system. Familiarity with the following is recommended:

* **The Need for Queries:** Why polling inventories is inefficient.
* **Reactive Approach:** How queries listen for `StackChanged` messages instead of polling.
* **Base Components:** The roles of `ULyraInventoryQuery` (C++) and `UAsyncAction_ItemQuery` (Blueprint Async Node).

**(-> Please review the** [**Base Lyra Item Query System Documentation**](../../../base-lyra-modified/items/item-query-system/) **for details on the standard query system.)**

### The Challenge of Nested Inventories

The standard `ULyraInventoryQuery` only monitors the single `ULyraInventoryManagerComponent` it's initialized with. It has no awareness of inventories potentially nested inside container items within that component.

### The Tetris Solution: Hierarchical Tracking

The Tetris Inventory Query system extends the base concept to recursively track items within child inventories:

* **`ULyraTetrisInventoryQuery` (C++):** The core C++ class that handles the hierarchical tracking logic. It automatically discovers and listens to inventories within container items found in the initially targeted inventory (and their children, recursively).
* **`UAsyncAction_TetrisItemQuery` (Blueprint):** A Blueprint Async Action node providing easy access to the `ULyraTetrisInventoryQuery` functionality from Blueprints, similar to the base async query node but designed for nested tracking.

### Key Features

* **Recursive Monitoring:** Automatically tracks items matching specified definitions in the root inventory _and_ all inventories nested within its container items.
* **Efficient Updates:** Still uses the reactive Gameplay Message system (`StackChanged`) to update its internal cache only when relevant items change in _any_ tracked inventory within the hierarchy.
* **Grouped Results:** Can provide results grouped by the specific inventory component (root or child) where the items were found (`FLyraTetrisInventoryQueryResult`).
* **Blueprint Accessibility:** The `UAsyncAction_TetrisItemQuery` node makes hierarchical querying straightforward in Blueprints.

### Structure of this Section

This section details the components and usage of the hierarchical query system:

1. **`ULyraTetrisInventoryQuery` (C++ Usage):** Explains how to use the core C++ query class for hierarchical tracking.
2. **`UAsyncAction_TetrisItemQuery` (Blueprint Usage):** Details the Blueprint Async Action node for easy integration.

By using the Tetris Inventory Query system, you can efficiently monitor resources, quest items, ammo, or any other tracked item type across a player's entire storage hierarchy without complex manual iteration.
