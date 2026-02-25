# Tetris Inventory Manager Component

You open a backpack and see a grid of cells. A rifle takes up a 1x4 strip, ammo boxes are 2x1, and a medkit fills a 2x2 square. You rotate the medkit 90 degrees and slide it into a gap. How does the system know what fits where, and keep it all in sync across the network?

The Tetris Inventory Manager handles this. `ULyraTetrisInventoryManagerComponent` extends the base `ULyraInventoryManagerComponent` and implements `ILyraItemContainerInterface`, adding spatial awareness to every inventory operation.

***

### What It Inherits

Because it derives from the base Inventory Manager, every Tetris inventory inherits the full set of container features for free:

* Weight limits, item count limits, slot limits
* Allowed/disallowed item type filtering
* Access rights and permission checks
* Network replication of items via FastArray
* GAS integration through Gameplay Messages and Abilities

These limits still apply alongside spatial constraints. An item must pass both the base capacity checks **and** fit within the grid.

### What It Adds

On top of that foundation, the Tetris Inventory Manager introduces:

* **Spatial placement** - items have a shape, a root slot, a clump, and a rotation
* **Clump-based grid layouts** - grids built from independent rectangular sections that support complex shapes
* **Dual-data architecture** - `FTetrisPlacementList` (replicated authority) plus `FGridCellInfoList` (local derived cache), rebuilt from the effective view
* **GUID-keyed client prediction** - drag-and-drop and item placement feel instant; the grid always reflects predicted state on the owning client and authoritative state on everyone else
* **Nested containers** - items can contain child inventories with weight and count propagation up the hierarchy
* **Runtime resizing** - change the grid layout at runtime and automatically refit existing items

***

### Structure of This Section

{% hint style="info" %}
Each subpage focuses on one aspect of the component. Read them in order for a full picture, or jump to the topic you need.
{% endhint %}

{% stepper %}
{% step %}
### The Grid System

[**The Grid System**](the-grid-system.md) - Clumps, `FInventoryLayoutCreator`, and the dual-data architecture that keeps placements and grid cells in sync.
{% endstep %}

{% step %}
### Configuration & Starting Items

[**Configuration & Starting Items**](configuration-and-starting-items.md) - Setting up layouts, limits, and the visual starting items editor.
{% endstep %}

{% step %}
### Working with Items

[**Working with Items**](working-with-items.md) - Adding, removing, moving, stacking, combining, and querying items within the grid.
{% endstep %}

{% step %}
### Nested Containers

[**Nested Containers**](nested-containers.md) - Parent-child inventory hierarchies and constraint propagation.
{% endstep %}

{% step %}
### Client Prediction

[**Client Prediction**](client-prediction.md) - How GUID-keyed prediction keeps the grid responsive during network play.
{% endstep %}

{% step %}
### Resizing the Inventory

[**Resizing the Inventory**](resizing-the-inventory.md) - Changing the layout at runtime and refitting items with heuristics.
{% endstep %}
{% endstepper %}
