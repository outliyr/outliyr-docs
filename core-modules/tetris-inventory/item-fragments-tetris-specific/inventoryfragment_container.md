# InventoryFragment_Container

A backpack that holds items. A locked case with its own grid. A pouch inside a rucksack inside a player's main inventory, three layers deep, each with its own layout, weight limits, and item restrictions. That is what `InventoryFragment_Container` enables.

Add this fragment to any item definition and each instance of that item gets its own fully functional `ULyraTetrisInventoryManagerComponent`, a real, independent inventory with its own grid, constraints, and contents. Drag an item onto the container in the grid and it moves inside. Open the container and you see its contents in a separate inventory window.

***

### What It Does

* **Nested Inventories** - Every container item instance owns a dedicated `ULyraTetrisInventoryManagerComponent` with its own grid layout.
* **Hierarchical Storage** - Containers can hold other containers, creating arbitrarily deep parent-child inventory trees.
* **Drag-to-Store** - Drop an item onto a container in the grid and it transfers inside automatically.
* **Weight & Count Propagation** - Configure whether a container's contents contribute to the parent inventory's limits.
* **Item Filtering** - Whitelist or blacklist which item types a container accepts.
* **Self-Reference Protection** - Built-in guards prevent placing a container inside itself or into any of its descendants.

***

### Transient Data: `FTransientFragmentData_Container`

Each container item _instance_ gets its own child inventory at runtime. The reference to that inventory is stored in struct-based transient data:

* **`ChildInventory`** - Pointer to the `ULyraTetrisInventoryManagerComponent` that belongs to this specific container instance.

This transient data is created when the item instance is spawned and destroyed when the item is removed.

> [!INFO]
> The child inventory is resolved at runtime by the parent item's **GUID**, not by a direct pointer. This is because of the item container client prediction system. Using a **GUID** provides a stable identity. GUID-based resolution ensures the parent always finds the correct child inventory even after a reconciliation pass. See [Prediction Architecture](../../../base-lyra-modified/item-container/prediction/prediction-architecture.md) for details on how the prediction system handles this.

***

### Configuration

Add `InventoryFragment_Container` to a `ULyraInventoryItemDefinition` and configure the following properties.

<img src=".gitbook/assets/image (12) (1).png" alt="" width="563" title="">

#### Container Identity and Layout

| Property              | Description                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **`ContainerName`**   | A display name for the container's internal inventory (e.g., `"Backpack Interior"`). Shown in UI titles.            |
| **`InventoryLayout`** | Defines the internal grid using `FInventoryLayoutCreator` entries,  rows, columns, and layout groups. **Required.** |

> [!SUCCESS]
> There is a Blueprint editor Utility tool that makes it easy to visually design inventory layouts instead of manually configuring the 3D array. See [Configuration and Starting Items](../tetris-inventory-manager-component/configuration-and-starting-items.md) for how to use it.

#### Starting Items (Optional)

| Property            | Description                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`StartingItems`** | Array of `FTetrisInventoryStartingItem` defining items that spawn inside the container when it is first created. |

#### Storage Limits

| Property             | Description                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| **`MaxWeight`**      | Maximum total weight the container can hold. Set to `0` to disable weight limits. |
| **`ItemCountLimit`** | Maximum number of item stacks allowed inside. Set to `0` to disable.              |

#### Parent Inventory Contribution

These flags control whether the container's **contents** count toward the **parent** inventory's limits:

| Flag                                  | Effect when `true`                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| **`bIgnoreChildInventoryWeights`**    | Items inside this container do not add to the parent inventory's total weight.            |
| **`bIgnoreChildInventoryItemCounts`** | Items inside this container do not count toward the parent's stack limit.                 |
| **`bIgnoreChildInventoryItemLimits`** | The container does not enforce per-item stack limits from its parent's child inventories. |

#### Item Filtering (Optional)

| Property              | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **`AllowedItems`**    | Whitelist,  only these item definitions can be stored. Leave empty to allow everything.   |
| **`DisallowedItems`** | Blacklist, these item definitions are always rejected, even when `AllowedItems` is empty. |

#### Per-Item Limits (Optional)

| Property                      | Description                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- |
| **`SpecificItemCountLimits`** | Per-item-type stack limits using `FPickupTemplate` entries for granular control. |

> [!WARNING]
> Do not set a limit of 0 for an item in `SpecificItemCountLimits`, use `DisallowedItems` instead to block it outright.

***

### Runtime Logic & Lifecycle

#### Container Creation

When a container item instance is spawned, `CreateNewTransientFragment` fires:

{% stepper %}
{% step %}
#### Access Global Manager

Calls `UGlobalInventoryManager::Get(World)` to retrieve the central inventory manager.
{% endstep %}

{% step %}
#### Create Child Inventory

Creates a new `ULyraTetrisInventoryManagerComponent` via `NewObject`, outered to the `GlobalInventoryManager`'s owner.
{% endstep %}

{% step %}
#### Initialize the Component

Calls `InitialiseTetrisInventoryComponent` on the new inventory, passing all configuration from this fragment (layout, limits, starting items, allowed items, etc.).
{% endstep %}

{% step %}
#### Link Back to Fragment

Sets `NewInventoryManager->InventoryContainer` to point back to this fragment, so the child inventory knows its configuration source.
{% endstep %}

{% step %}
#### Register with Global Manager

Calls `AddNewInventory` on the `GlobalInventoryManager` to register the child for GUID-based resolution and network replication.
{% endstep %}

{% step %}
#### Store in Transient Data

Creates `FTransientFragmentData_Container` with the `ChildInventory` pointer and writes it into the item instance's `FInstancedStruct`.
{% endstep %}
{% endstepper %}

***

### Moving Items Into the Container (`CombineItems`)

When a player drags an item onto a item with a container fragment in the grid:

1. Resolves the `FTransientFragmentData_Container` for the destination container instance.
2. Gets the `ChildInventory` pointer from the transient data.
3. Validates that the source inventory is not the child inventory itself (prevents circular internal moves).
4. Calls `ChildInventory->CanAddItem`, checks weight, count, type restrictions, and any parent-level constraints.
5. Calls `ChildInventory->FindAvailableSlotsForItem` to locate space inside the container's grid.
6. Calls `SourceInventory->MoveItemExternally` to transfer the item from its current inventory into the child inventory.
7. Returns `true` on success.

***

### Self-Addition Prevention (`CanAddItemToInventory`)

When a container item is about to be placed into an inventory, this override runs two checks:

1. **Direct self-reference** - Is the target inventory this container's own `ChildInventory`? If yes, deny.
2. **Descendant check** - Is the target inventory a descendant of this container's `ChildInventory`? Uses `DestinationInventory->IsInParentInventory(MyChildInventory)` to walk up the chain. If yes, deny.

This prevents paradoxes like placing a backpack inside a pouch that is already inside that backpack.

***

### Weight & Count Contribution

When the parent inventory calculates its totals, it asks each container fragment for contributions:

* **`GetWeightContribution`** - Returns `ChildInventory->GetInventoryWeight()` unless `bIgnoreChildInventoryWeights` is `true` on the parent, in which case it returns 0.
* **`GetItemCountContribution`** - Returns `ChildInventory->GetInventoryItemCount()` unless `bIgnoreChildInventoryItemCounts` is `true` on the parent, in which case it returns 0.

***

### GUID-Based Resolution & Prediction Reconciliation

In a networked game, prediction reconciliation can destroy and recreate inventory components. A raw pointer to a child inventory would become dangling after reconciliation.

Instead, the system resolves child inventories by the parent item's GUID through the `GlobalInventoryManager`. When a component is recreated during reconciliation:

1. The new component is registered with the same GUID.
2. Any parent looking up its child inventory resolves the GUID and gets the new, valid component.
3. `TransferPredictionOverlaysFrom()` is called to migrate pending prediction state from the old component to the new one, so in-flight predictions are not lost.

This architecture means containers work seamlessly with the [Reconcilation](../../../base-lyra-modified/item-container/prediction/reconciliation/) system, no special handling required from gameplay code.

***

### Lifecycle Cleanup

<div class="gb-stack">
<details class="gb-toggle">

<summary><strong>DestroyTransientFragment</strong></summary>

When a container item is destroyed, this override tells the `GlobalInventoryManager` to destroy the associated `ChildInventory` component. It also broadcasts `ClientCloseInventoryWindow` to force-close any UI windows that were displaying the child inventory's contents.

</details>
<details class="gb-toggle">

<summary><strong>AddedToInventory</strong></summary>

When the container item is placed into a parent inventory, this sets `ChildInventory->ParentInventory` to the new parent. It also cascades the `AddedToInventory` call to every item inside the child inventory, so they can update their own state.

</details>
<details class="gb-toggle">

<summary><strong>RemovedFromInventory</strong></summary>

When the container item is removed from an inventory, this clears `ChildInventory->ParentInventory` (if removed from its current parent). It cascades the `RemovedFromInventory` call to all items inside the child inventory.

</details>
</div>

***

## Architecture Overview

```
Player Inventory (ULyraTetrisInventoryManagerComponent)
│
├── Sword
├── Shield
└── Backpack (has InventoryFragment_Container)
    │
    └── Child Inventory (ULyraTetrisInventoryManagerComponent)
        │   resolved by Backpack's GUID
        │
        ├── Bandages
        ├── Ammo
        └── Pouch (has InventoryFragment_Container)
            │
            └── Child Inventory (ULyraTetrisInventoryManagerComponent)
                │   resolved by Pouch's GUID
                │
                ├── Gold Coins
                └── Key
```

Each container item owns an independent inventory component. The parent-child chain can nest arbitrarily deep, and the GUID-based resolution ensures stability across network prediction cycles.
