# Resizing The Inventory

A player buys a backpack upgrade and their 6x4 inventory becomes 8x6. Items need to rearrange to fit the new layout, and if they don't all fit, you need to decide what happens.

The `ULyraTetrisInventoryManagerComponent` provides a `ResizeInventory` function that handles the entire workflow: swapping the grid layout, attempting to refit every existing item, and giving you control over what happens when things don't fit.

***

### The `ResizeInventory` Function

{% tabs %}
{% tab title="C++" %}
```cpp
/**
 * Attempts to resize the inventory grid based on a new layout definition.
 * Tries to refit existing items into the new layout using heuristics.
 *
 * @param NewInventoryLayout The desired new layout structure (array of FInventoryLayoutCreator).
 * @param bForce If true, the resize proceeds even if some items cannot be refit;
 *               unplaced items will be removed. If false, the resize reverts entirely.
 * @param OutUnplacedItems (Output) If bForce is true, populated with items that
 *                         could not fit and were removed.
 * @return True if the resize was successful, false if reverted.
 */
UFUNCTION(BlueprintCallable, Category = Inventory)
bool ResizeInventory(
    const TArray<FInventoryLayoutCreator>& NewInventoryLayout,
    bool bForce,
    TArray<ULyraInventoryItemInstance*>& OutUnplacedItems
);
```
{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (240).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

***

### Parameters

| Parameter              | Type                                  | Description                                                     |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------- |
| **NewInventoryLayout** | `TArray<FInventoryLayoutCreator>`     | The target layout definition. Must be a valid, non-empty layout |
| **bForce**             | `bool`                                | Controls behavior when items don't fit (see below)              |
| **OutUnplacedItems**   | `TArray<ULyraInventoryItemInstance*>` | Output -- populated with removed items when `bForce` is true    |

{% hint style="warning" %}
**The `bForce` parameter decides how failures are handled:**

* **`bForce = false` ("Safe Mode"):** If _any_ existing item cannot be placed into the new layout, the **entire operation is cancelled**. The inventory reverts to its original layout and item positions. Returns `false`. `OutUnplacedItems` will be empty.
* **`bForce = true` ("Forced Mode"):** The resize proceeds regardless. Any items that cannot fit are added to `OutUnplacedItems` and **permanently removed** from the inventory (via `RemoveItemInstance`). Returns `true` even if items were ejected.

Choose carefully. Safe mode is ideal for upgrades where items should always fit. Forced mode is useful for debuffs or shrink effects where you want the resize to happen no matter what, but you'll need to handle the ejected items (drop them on the ground, send to mail, etc.).
{% endhint %}

{% hint style="info" %}
This function should be called on the **server (authority)**, this function **does not support prediction**. The layout change and item repositioning replicate to clients automatically.
{% endhint %}

***

### Resizing Workflow

Here is what happens internally when you call `ResizeInventory`:

{% stepper %}
{% step %}
**Check if layout actually changed**

Calls `InventoryGrid.HasLayoutChanged(NewInventoryLayout)` to compare the new layout against the current one. If they're identical, returns `true` immediately, no work needed.
{% endstep %}

{% step %}
**Backup current state**

Stores the current `InventoryGrid.GridCells`, the current `InventoryLayout`, and the original grid location (`FInventoryAbilityData_SourceTetrisItem`) of each item. This backup is crucial, if `bForce` is false and items don't fit, the system needs to revert everything cleanly.
{% endstep %}

{% step %}
**Clear and rebuild the grid**

1. Calls `InventoryGrid.EmptyGridItems()` to clear all item references from grid cells (without destroying the items themselves)
2. Calls `InventoryGrid.PopulateInventoryGrid(NewInventoryLayout)` to rebuild `GridCells` and `GridCellIndexMap` based on the new layout structure

At this point, the grid has the new shape but is completely empty.
{% endstep %}

{% step %}
**Gather existing items**

Collects all `ULyraInventoryItemInstance*` currently held in the base `InventoryList`. These are the items that need to be placed back into the new grid.
{% endstep %}

{% step %}
**Refit items with heuristics**

The `TryFitItemsWithHeuristics` function attempts to place every gathered item back into the new grid:

1. **Sort** items by area (largest first) to maximize packing efficiency
2. **Iterate** through each item, trying every possible root cell and every allowed rotation in the new layout
3. **Place** the item in the first valid spot found (via `CanPlaceItemInEmptySlot`)
4. **Track** any items that cannot be placed after exhausting all positions and rotations
{% endstep %}

{% step %}
**Handle the results**

Three possible outcomes:

**All items fit** - proceed to commit (next step).

**Items didn't fit + `bForce = false`** (Safe Mode failure):

* Reverts the grid: `EmptyGridItems()`, restores old `GridCells`, rebuilds `GridCellIndexMap` with the old layout
* Restores original item positions from the backup
* Returns `false`

**Items didn't fit + `bForce = true`** (Forced Mode):

* Populates `OutUnplacedItems` with items that couldn't fit
* Calls `RemoveItemInstance` for each unplaced item, permanently removing them
* Proceeds to commit
{% endstep %}

{% step %}
**Commit changes**

1. Updates the component's replicated `InventoryLayout` property to `NewInventoryLayout`
2. Marks `InventoryGrid` dirty for replication (`InventoryGrid.MarkArrayDirty()`)
3. Broadcasts `TAG_Lyra_Inventory_Message_InventoryResized` locally on the server
4. Clients broadcast this message via `PostReplicatedReceive` when the layout change arrives
5. Returns `true`
{% endstep %}
{% endstepper %}

***

### About the Heuristic

The `TryFitItemsWithHeuristics` function uses a greedy algorithm:

```
Sort items largest-area-first
For each item:
    For each possible root cell in the new grid:
        For each allowed rotation:
            If CanPlaceItemInEmptySlot -> place it, move to next item
    If no valid placement found -> add to UnplacedItems
```

{% hint style="warning" %}
**This heuristic is fast but not optimal.** It is _not_ guaranteed to find a solution even if one exists. Placing a large item early can block smaller items that would have fit with a different arrangement. Think of it like packing a suitcase, if you put the big jacket in first, the shoes might not fit, even though there's technically enough space if you rearrange.

For most gameplay scenarios (especially upgrades to larger grids), this works well. If you need deterministic success for critical operations, consider using `bForce = false` and handling the failure case gracefully.
{% endhint %}

***
