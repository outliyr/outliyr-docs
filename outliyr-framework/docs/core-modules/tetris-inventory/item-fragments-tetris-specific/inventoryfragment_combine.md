# InventoryFragment\_Combine

You have berries in one slot and an empty bottle in another. The player drags the berries onto the bottle and a health potion appears in their inventory. Just drag, drop, and combine, right there in the grid.

`InventoryFragment_Combine` makes this possible. Attach it to an item definition, configure a recipe map, and the inventory handles the rest, consuming ingredients, validating space, and placing the result, all within the Tetris grid.



***

### What It Does

* **Recipe Definitions** - Map incoming items to combination results with quantity requirements for both ingredients and outputs.
* **Ingredient Consumption** - Automatically deducts the correct stack counts from both items involved.
* **Result Placement** - Places the crafted item(s) directly into the grid, respecting spatial constraints.
* **Safe Simulation** - Validates that results can actually fit before consuming anything, so players never lose items to a full inventory.

***

### Configuration

The fragment lives on the **target item** - the item that _receives_ the drop. The incoming item (the one being dragged) is looked up as a key in the recipe map.

<figure><img src="../../../.gitbook/assets/image (10) (1).png" alt="" width="563"><figcaption></figcaption></figure>

### The `CombinationList` (TMap)

Each entry in the `CombinationList` pairs an incoming item definition (the key) with an `FItemCombinationDetails` struct (the value):

| Property                            | Description                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| **Target Item Required Quantity**   | How many of _this_ item (the one owning the fragment) are consumed per craft |
| **Incoming Item Required Quantity** | How many of the dragged item are consumed per craft                          |
| **Resulting Item Definition**       | The `ULyraInventoryItemDefinition` to create                                 |
| **Resulting Item Quantity**         | How many of the result to produce per craft                                  |

A single target item can have multiple recipes, one entry per incoming item type.

***

### Example: Health Potion

> Drop **5 Berries** onto an **Empty Bottle** to produce **1 Health Potion**.

Add `InventoryFragment_Combine` to `ID_Misc_EmptyBottle`, then configure:

```
CombinationList
└─ Key: ID_Resource_Berry
   └─ Value (FItemCombinationDetails):
        Target Item Required Quantity .... 1   (1 Empty Bottle)
        Incoming Item Required Quantity .. 5   (5 Berries)
        Resulting Item Definition ........ ID_Potion_Health
        Resulting Item Quantity .......... 1   (1 Health Potion)
```

If the player has 10 berries and 2 empty bottles, the system automatically calculates that it can produce 2 health potions in a single operation.

***

### Runtime: The `CombineItems` Workflow

When a player drops one item onto another, `ULyraTetrisInventoryManagerComponent` calls the target fragment's `CombineItems` override. Here is the full flow:

```cpp
virtual bool CombineItems(
    ULyraInventoryManagerComponent* SourceInventory,
    ULyraInventoryItemInstance* SourceInstance,
    ULyraInventoryManagerComponent* DestinationInventory,
    ULyraInventoryItemInstance* DestinationInstance
) override;
```

{% stepper %}
{% step %}
#### Check Recipe Compatibility

Looks up `SourceInstance->GetItemDef()` in the `CombinationList`. If there is no entry for this item type, returns `false` immediately, - no recipe exists for this pairing.
{% endstep %}

{% step %}
#### Retrieve Recipe Details

Fetches the `FItemCombinationDetails` for the incoming item and validates that the `ResultingItemDefinition` is set.
{% endstep %}

{% step %}
#### Calculate Maximum Yield

Determines how many complete crafts are possible given current stack counts:

```
SourceSets  = SourceStackCount / IncomingItemRequiredQuantity
DestSets    = DestStackCount   / TargetItemRequiredQuantity
MaxSets     = Min(SourceSets, DestSets)
AmountToCreate = MaxSets * ResultingItemQuantity
```

If `AmountToCreate` is 0, returns `false`,  not enough ingredients.
{% endstep %}

{% step %}
#### Validate the Result Item

Confirms that the `ResultingItemDefinition` has both `InventoryFragment_InventoryIcon` and `InventoryFragment_Tetris` (required for grid placement). Returns `false` if either is missing.
{% endstep %}

{% step %}
#### Simulate Consumption

**Temporarily** reduces the stack counts on both `SourceInstance` and `DestinationInstance` by the amounts needed. The items are not destroyed yet, this is a dry run so the placement check has accurate grid state.
{% endstep %}

{% step %}
#### Check Destination Capacity

Calls `DestinationInventory->CanAddItem()` to verify weight limits, item count limits, and other constraints for the result items.
{% endstep %}

{% step %}
#### Phase 1 - Place in Empty Slots

Searches for available slots in the destination grid (empty cells only) and places as many result items as possible via `TryAddItemDefinitionToSlot`. Tracks how many still need placement (`Remaining`).
{% endstep %}

{% step %}
#### Phase 2 - Place in Freed Slots

If items remain unplaced, builds an `IgnoreItems` list from any ingredients whose stacks were reduced to zero. Searches again, this time treating those consumed items' cells as available. Places remaining results in these newly freed slots.
{% endstep %}

{% step %}
#### Finalize or Rollback

* **Nothing placed?** Restores the simulated stack counts on both ingredients and returns `false`. No items are lost.
* **Some or all placed?** Permanently removes fully consumed ingredients (stack count reached 0) via `RemoveItem`. Updates stack counts on partially consumed items and broadcasts the changes. Returns `true`.
{% endstep %}
{% endstepper %}

***

### Why the Two-Phase Approach?

Consider this scenario: you combine two items that each occupy a 2x2 area, producing a single 2x2 result. If the grid is nearly full, there might be no empty 2x2 space available, but removing the consumed ingredients _creates_ that space.

The simulation step ensures ingredients are never consumed unless the result can actually be placed. Phase 1 tries empty slots first (the common case). Phase 2 reclaims space from consumed items when needed. Together, they guarantee that a combination either succeeds cleanly or leaves the inventory untouched.

{% hint style="info" %}
The simulation-then-commit pattern is what prevents the worst-case scenario in any crafting system: consuming the player's ingredients and then failing to deliver the result. If placement fails entirely, everything rolls back.
{% endhint %}
