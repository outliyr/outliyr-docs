# Inventory

When a player picks up loot, it needs to go somewhere. When they open their bag, they expect to see items in specific positions. When they drag an item to a new slot, the change should feel instant - no waiting for the server. This is what the Inventory system handles.

Inventory is **storage**. Unlike [Equipment](../equipment/) (which applies behaviors like abilities and spawns actors), inventory just holds items. It implements the unified [Item Container](../item-container/) interface, giving it full support for transactions and client-side prediction.

***

## Slot-Based Storage

The inventory stores items in numbered slots. It's what enables grid-based inventory UIs, drag-and-drop between specific positions, and consistent visual layouts.

* Each slot can hold one item (or stack).
* When you query the inventory, you get items with their slot positions.
* When you move an item, you're changing which slot it occupies.
* Empty slots exist as potential drop targets.

The system supports configurable limits: maximum weight, maximum item count, and maximum occupied slots. You can also filter which item types are allowed, creating specialized containers like ammo pouches or medical bags.

***

## What's In This Section

* The [**Inventory Manager Component**](inventory-manager-component.md) is the core container. It stores items, enforces limits, and provides the prediction-aware view that UI and gameplay code use.
* The [**Item Query System**](item-query-system.md) lets you reactively track specific item types, useful for ammo counters, crafting ingredients, or quest objectives that update as the inventory changes.
* [**ViewModels**](inventory-viewmodels-and-ui/) provide the MVVM layer for building inventory UIs. They handle prediction integration, change notifications, and slot management so your widgets can focus on presentation.
