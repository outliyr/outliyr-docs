# Item Fragments (Tetris Specific)

A sword is a 1x3 vertical strip. A health potion is a single 1x1 cell. A backpack is a 2x3 rectangle that _also contains its own grid inside_. A scope can be dropped onto a rifle to combine them into a new weapon.

How does one system express all of these behaviors? **Fragments.**

Each item in the Tetris Inventory is composed from small, self-contained building blocks called Item Fragments. A fragment defines one aspect of an item, its grid shape, its ability to hold other items, its combination recipes, or its 3D inspection data. Stack the right fragments onto an Item Definition and you get exactly the item behavior you need, without touching C++.

***

### Base Fragments vs. Tetris Fragments

The Tetris Inventory builds on the same fragment architecture used across the entire Lyra item system. Fragments like `InventoryFragment_InventoryIcon` (display icon) and `InventoryFragment_SetStats` (stat tags) work identically here, every Tetris item will use these.

{% hint style="info" %}
If you're new to fragments, start with the [Item Fragments Documentation](../../../base-lyra-modified/items/items-and-fragments/) first. It covers what fragments are, static vs. instance data, transient data patterns, and core virtual functions. Everything below assumes you're comfortable with those concepts.
{% endhint %}

This section focuses on the **four fragments unique to the Tetris Inventory plugin**, the ones that give items their spatial, interactive, and visual behaviors on the grid.

***

### Tetris-Specific Fragments at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Item Definition                                  │
│                                                                      │
│   Base Fragments (Lyra)         Tetris-Specific Fragments            │
│   ─────────────────────         ─────────────────────────            │
│   InventoryFragment_Icon        InventoryFragment_Tetris             │
│   InventoryFragment_SetStats    InventoryFragment_Container          │
│   InventoryFragment_Equippable  InventoryFragment_CraftRecipe        │
│   ...                           InventoryFragment_Inspect            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

<table><thead><tr><th width="275">Fragment</th><th>What It Does</th><th>When You Need It</th></tr></thead><tbody><tr><td><a href="inventoryfragment_tetris.md"><code>InventoryFragment_Tetris</code></a></td><td>Defines the 2D grid shape and rotation rules</td><td>Every item that exists on a spatial grid</td></tr><tr><td><a href="inventoryfragment_container.md"><code>InventoryFragment_Container</code></a></td><td>Gives an item its own nested inventory grid</td><td>Backpacks, cases, ammo boxes, any item that holds other items</td></tr><tr><td><a href="inventoryfragment_combine.md"><code>InventoryFragment_CraftRecipe</code></a></td><td>Defines drag-and-drop crafting recipes</td><td>Combining berries + bottle into potions, resource transformations, etc</td></tr><tr><td><a href="inventoryfragment_inspect.md"><code>InventoryFragment_Inspect</code></a></td><td>Provides 3D mesh and camera data for the inspection viewer</td><td>Any item you want players to rotate and examine in 3D</td></tr></tbody></table>

***

### How They Work Together

Most items use `InventoryFragment_Tetris` as their foundation, without it, an item has no spatial presence and can't be placed on a grid. From there, you layer on additional fragments as needed.

A few common compositions:

**Simple consumable** (health potion): `Tetris` (1x1 shape) + base icon/stats fragments.

**Weapon with inspection**: `Tetris` (1x3 shape) + `Inspect` (3D model, camera limits) + base fragments.

**Backpack**: `Tetris` (2x3 shape) + `Container` (nested 6x4 grid inside) + base fragments.

**Craftable ingredient**: `Tetris` (1x1 shape) + `CraftRecipe` (recipe: berries + bottle = health potion) + base fragments.

{% hint style="info" %}
The [Item Container](../../../base-lyra-modified/item-container/) system handles the underlying storage and transaction logic. Fragments configure _how_ items behave within that system, they don't replace it.
{% endhint %}

Explore each fragment's subpage below for configuration details, code examples, and editor workflows.
