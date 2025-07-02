# Item Fragments In-Depth

Having covered the core concepts of Items, the Inventory Manager, GAS integration, World Interaction, and Querying, we now return to a deeper dive into the **building blocks of item functionality: the specific `ULyraInventoryItemFragment` types** provided by this asset.

As established in the "Core Concepts" section, Fragments are modular pieces of data and logic attached to `ULyraInventoryItemDefinition`s. They allow you to compose complex item behaviors by simply adding and configuring these fragments in the item definition asset, rather than relying on complex inheritance.

### Purpose of this Section

This section serves as a reference guide for the various concrete `ULyraInventoryItemFragment` classes available in the system. For each significant fragment type, its dedicated sub-page will detail:

* **Purpose:** What specific feature or behavior does this fragment enable?
* **Key Properties:** What static data can be configured on this fragment within the Item Definition asset?
* **Transient Data:** Does it utilize `FTransientFragmentData` or `UTransientRuntimeFragment`? What instance-specific data does that payload store?
* **Core Logic:** How does it interact with the Inventory Manager, Equipment System, GAS, or other systems? Which virtual functions does it typically override?
* **Usage Example:** How and when would you typically add this fragment to an Item Definition?

### Available Fragment Types (Examples)

This asset provides several fragment types to handle common inventory and item functionalities. Here are some examples of fragments:

* **Attachment System (`UInventoryFragment_Attachment`):** Enables items to host other item instances. Involves a complex `UTransientRuntimeFragment_Attachment` for managing attached items.
* **Consume Fragment (`UInventoryFragment_Consume`):** Defines behavior for consumable items by granting and activating the specified Gameplay Ability upon use.
* **Inventory Icon Fragment (`UInventoryFragment_InventoryIcon`):** Crucial for basic inventory interaction. Defines UI appearance (Icon), stacking behavior (`MaxStackSize`), base weight (`Weight`), and grid size (if applicable).
* **Category Fragment (`UInventoryFragment_Category`):** Assigns Gameplay Tags to items for categorization, filtering, and sorting.
* **Pickup Item Fragment (`UInventoryFragment_PickupItem`):** Defines the item's visual representation (mesh, display name) when it exists as a physical object in the world (`ALyraWorldCollectable`).
* **Set Stats Fragment (`UInventoryFragment_SetStats`):** Initializes `StatTags` (like ammo, charges, initial stack count) on an `ULyraInventoryItemInstance` when it's first created.
* **Container Fragment (`UInventoryFragment_Container`):** Allows an item instance to possess its _own_ internal inventory component (`FTransientFragmentData_Container`).
* **Combine Fragment (`UInventoryFragment_Combine`):** Defines rules for combining this item with other specific item types when dropped onto each other.
* _(Others as applicable, e.g., EquippableItem fragment covered in Equipment System docs but relevant here)_

> [!danger]
> Note: The [Container](../../../core-modules/tetris-inventory/item-fragments-tetris-specific/inventoryfragment_container.md) and [Combine](../../../core-modules/tetris-inventory/item-fragments-tetris-specific/inventoryfragment_combine.md) Fragment belong in the Tetris Inventory Plugin and **will not** be covered in this page. For more details on TetrisInventory fragments read this [page](../../../core-modules/tetris-inventory/item-fragments-tetris-specific/).

### Finding the Right Fragment

When designing a new item, consider the features it needs and select the appropriate fragments to add to its Definition:

* Does it need to appear in a grid UI and stack? -> Add `InventoryFragment_InventoryIcon`.
* Can it be equipped as a weapon or armor? -> Add `InventoryFragment_EquippableItem` (Covered in Equipment System).
* Can it be used/consumed? -> Add `InventoryFragment_Consume` and define the ability.
* Can it be dropped in the world? -> Add `InventoryFragment_PickupItem` and configure meshes.
* Does it item have simple data that can be represented as an integer? -> Add `InventoryFragment_SetStats`.
* Can it hold other items inside it? -> Add `InventoryFragment_Container`.
* Can it attach to other items, or have items attach to it? -> Add `InventoryFragment_Attachment`.
* Does it belong to specific categories for sorting? -> Add `InventoryFragment_Category`.
* Can it be crafted by combining with another item? -> Add `InventoryFragment_Combine` to the _target_ item.

You can combine multiple fragments on a single Item Definition to create items with rich, multifaceted behaviors.

### Structure of this Section

Explore the following sub-pages for detailed information on each fragment type:

1. **Attachment System (`UInventoryFragment_Attachment`)**
2. **Consume Fragment (`UInventoryFragment_Consume`)**
3. **Inventory Icon Fragment (`UInventoryFragment_InventoryIcon`)**
4. **Category Fragment (`UInventoryFragment_Category`)**
5. **Pickup Item Fragment (`UInventoryFragment_PickupItem`)**
6. **Set Stats Fragment (`UInventoryFragment_SetStats`)**

***

This overview introduces the final major section focusing on the concrete implementations of `ULyraInventoryItemFragment`. By understanding each fragment's role and configuration, you can effectively leverage the system's modularity to build the diverse items needed for your game.
