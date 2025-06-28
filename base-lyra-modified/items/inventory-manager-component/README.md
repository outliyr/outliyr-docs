# Inventory Manager Component

The `ULyraInventoryManagerComponent` is the core runtime component responsible for **holding and managing a collection of items** for a specific Actor. This is the primary container where `ULyraInventoryItemInstance`s reside within your game.

Think of it as the character's backpack, a storage chest in the world, or the internal inventory of a container item itself.

***

### Role and Purpose

At its heart, the Inventory Manager Component provides the functionality to:

* **Store Items:** Maintains a networked list (`FLyraInventoryList`) of item instances (`ULyraInventoryItemInstance`) and their associated stack counts (`FLyraInventoryEntry`).
* **Add & Remove Items:** Provides functions to add new items (from definitions or existing instances) and remove/destroy items, handling stacking logic where applicable.
* **Enforce Rules & Limits:** Can be configured with various constraints:
  * Maximum Weight (`MaxWeight`)
  * Maximum total Item Count (`ItemCountLimit`) - (Note: Item count contribution is defined by fragments, typically 1 per stackable "slot" used).
  * Maximum number of distinct item stacks/slots (`LimitItemInstancesStacks`).
  * Allowed/Disallowed Item Types (`AllowedItems`/`DisallowedItems`).
  * Specific limits on the quantity of certain item types (`SpecificItemCountLimits`).
* **Facilitate Item Interactions:** Includes logic for querying items (`FindFirstItemStackByDefinition`, `SearchForItem`, etc.) and combining items (by delegating to the `CombineItems` function on item fragments).
* **Replicate State:** Ensures the inventory contents, item instance subobjects, and access/permission states are synchronized across the network according to defined access rights.
* **Broadcast Changes:** Uses Gameplay Messages to notify other systems (like UI) about changes within the inventory (items added/removed, weight changes, etc.) without requiring direct coupling.

***

### Design Philosophy & Fragments

A key aspect of this component's design is its interaction with the **Item Fragment** system. While the Manager handles the _container_ logic (adding, removing, limits, permissions), much of the item-specific logic resides within the fragments attached to the items themselves:

* **Weight & Item Count:** The Manager calculates total weight and item count by querying the `GetWeightContribution` and `GetItemCountContribution` functions on each item's fragments. This keeps the Manager from needing to know the specific weight rules of every item type.
* **Adding Checks:** The `CanAddItem` logic queries `CanAddItemToInventory` on an item's fragments, allowing fragments to implement custom addition restrictions.
* **Combination:** The `CombineDifferentItems` function delegates the actual combination logic to the `CombineItems` function on the _destination item's_ fragments.

This delegation **reduces bloat** within the `ULyraInventoryManagerComponent` itself. It doesn't need massive switch statements or complex logic to handle every possible item type's specific rules; it focuses on managing the container and relies on the fragments for item-specific behaviors.

***

### Structure of this Section

The following sections within this documentation will detail the different aspects of the `ULyraInventoryManagerComponent`:

* **Core Functionality**: Covers item storage (`FLyraInventoryList`), basic item operations (`Add`, `Remove`, `TryAdd`, `Destroy`), inventory constraints, and fragment interactions for calculations (e.g., weight, stack counts).
* **Replication & Networking**: Explains how inventory changes, item states, and visibility are synchronized between the server and clients, ensuring consistency across gameplay and user interfaces.
* **Advanced Operations**: Discusses more sophisticated functions such as searching for items, consuming item sets, combining stacks, and rearranging inventory contents.

***

This overview introduces the `ULyraInventoryManagerComponent` as the primary item management container, emphasizing its seamless integration with the Item Fragment system. Subsequent sections progressively cover its operational details, replication mechanisms, and advanced functionalities.
