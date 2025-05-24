---
description: 'Item Query System: Overview'
---

# Item Query System

In many gameplay scenarios, systems outside of the core inventory UI need to know about the presence or quantity of specific items within an inventory. For example:

* A weapon system needs to know how much compatible ammo the player is carrying.
* A crafting UI needs to update available recipes based on the player's current resources.
* An objective system might track whether the player has collected specific quest items.
* A HUD element might display the count of a particular consumable.

Constantly polling the `ULyraInventoryManagerComponent` by iterating through its `GetAllItems()` list every frame or every few seconds is inefficient and doesn't react instantly to changes.

The **Item Query System** provides a more efficient, **reactive** solution for tracking specific item types within a given inventory.

### Purpose: Efficient & Reactive Tracking

The core goals of the Item Query system are:

* **Efficiency:** Avoid the performance cost of repeatedly iterating through the entire inventory list just to find specific items.
* **Reactivity:** Automatically notify interested listeners _when_ the status of the tracked items changes (added, removed, stack count modified), rather than requiring constant polling.
* **Simplicity:** Provide easy-to-use C++ and Blueprint interfaces for setting up and listening to these tracked queries.

### Core Concept: Listening for Changes

Instead of active polling, the Item Query system works by:

1. **Defining a Query:** You specify which `ULyraInventoryManagerComponent` to monitor and which `ULyraInventoryItemDefinition`(s) you are interested in tracking.
2. **Initial Scan:** The system performs an initial scan of the target inventory to find all existing instances matching the tracked definitions.
3. **Listening:** It then subscribes to the `TAG_Lyra_Inventory_Message_StackChanged` Gameplay Message broadcast by the target inventory component.
4. **Reactive Updates:** When a `StackChanged` message arrives, the query checks if the changed item instance matches one of the tracked definitions. If it does, the query updates its internal cached list of matching items and broadcasts an "updated" event to its listeners.

### Key Components

* **`ULyraInventoryQuery` (UObject):**
  * The underlying C++ class that performs the tracking logic.
  * It holds the reference to the target inventory, the set of tracked item definitions, and the cached list of matching item instances.
  * It registers itself as a listener for the `StackChanged` message.
  * Exposes delegates (`OnUpdated`, `OnUpdatedWithTrackedDefs`) that fire when the tracked item set changes.
* **`UAsyncAction_ItemQuery` (Async Action Blueprint Node):**
  * A Blueprint-friendly wrapper around `ULyraInventoryQuery`.
  * Provides an easy-to-use async node (`QueryInventoryAsync`) for Blueprints (like Widgets or Actor Components) to start tracking items.
  * Exposes Blueprint event delegates (`OnUpdated`, `OnFirstResult`, `OnFailed`) that are triggered by the underlying query. It also conveniently calculates and provides the total stack count across all found items.

### Benefits

* **Performance:** Significantly more performant than manual polling, especially for large inventories or frequent checks.
* **Real-time Updates:** Ensures systems react immediately to relevant inventory changes.
* **Decoupling:** The system querying the inventory doesn't need intimate knowledge of the inventory's internal list structure beyond setting up the query.

### Structure of this Section

The following sub-pages will provide details on using this system:

1. **`ULyraInventoryQuery` (C++ Usage):** How to create and use the query object directly in C++.
2. **`UAsyncAction_ItemQuery` (Blueprint Usage):** How to use the Blueprint async node for easy integration with widgets and other Blueprint logic.

***

This overview introduces the Item Query system as an efficient, event-driven alternative to polling inventories for specific item information, highlighting its core components and benefits before diving into specific C++ and Blueprint usage examples.
