# InventoryFragment\_CraftRecipe

You have berries in one slot and an empty bottle in another. The player drags the berries onto the bottle and a health potion appears in their inventory. Just drag, drop, and combine, right there in the grid.

`InventoryFragment_CraftRecipe` makes this possible. Attach it to an item definition, configure a recipe map, and the inventory handles the rest, consuming ingredients, validating space, and placing the result, all within the Tetris grid.

***

### What It Does

* **Recipe Definitions** - Map incoming items to combination results with quantity requirements for both ingredients and outputs.
* **Ingredient Consumption** - Deducts the correct stack counts from both items involved, recording every change so client prediction can roll it back.
* **Result Placement** - The server creates the crafted item(s) and places them directly into the grid, respecting spatial constraints.
* **Safe Validation** - Checks that the result can actually be placed before committing, so a full inventory rejects the combine instead of eating the ingredients.

***

### Configuration

<figure><img src="../../../.gitbook/assets/image (10) (1) (1) (1) (1) (1).png" alt="" width="563"><figcaption></figcaption></figure>

The fragment lives on the **target item** - the item that _receives_ the drop. The incoming item (the one being dragged) is looked up as a key in the recipe map.

### The `CombinationList` (TMap)

Each entry in the `CombinationList` pairs an incoming item definition (the key) with an `FItemCombinationDetails` struct (the value):

| Property                            | Description                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| **Target Item Required Quantity**   | How many of _this_ item (the one owning the fragment) are consumed per craft |
| **Incoming Item Required Quantity** | How many of the dragged item are consumed per craft                          |
| **Resulting Item Definition**       | The `ULyraInventoryItemDefinition` to create                                 |
| **Resulting Item Quantity**         | How many of the result to produce per craft                                  |

A single target item can have multiple recipes, one entry per incoming item type.

{% hint style="info" %}
Items never combine with themselves. Dropping an item onto another item of the same definition stacks them instead, so a recipe keyed on the target's own definition will never trigger.
{% endhint %}

***

### Example: Health Potion

> Drop **5 Berries** onto an **Empty Bottle** to produce **1 Health Potion**.

Add `InventoryFragment_CraftRecipe` to `ID_Misc_EmptyBottle`, then configure:

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

### The Combine Interface

The fragment overrides the three combine hooks that every item fragment can implement:

```cpp
virtual bool IsCombineCompatible(const FItemCombineContext& Context) const override;
virtual bool CanCombineItems(const FItemCombineContext& Context, FItemRejectionReason& OutRejection) const override;
virtual bool CombineItems(FItemCombineContext& Context, FItemRejectionReason& OutRejection) override;
```

* **`IsCombineCompatible`** - A type-only check: is the incoming item's definition a key in the `CombinationList`? Useful for UI highlighting before a drop is committed.
* **`CanCombineItems`** - A read-only validation: does a recipe exist, and do both stacks meet their minimum required quantities right now? Fills `OutRejection` with a reason when the answer is no. Neither of these mutates any state.
* **`CombineItems`** - Performs the combination.

The `FItemCombineContext` carries both sides of the operation (source and destination containers, slots, and item instances) along with the prediction key and delta record, so the fragment can mutate either side and stay consistent with the rest of the transaction.

***

### Runtime: The `CombineItems` Workflow

When a player drops one item onto another of a different type, the move transaction packages both sides into an `FItemCombineContext` and calls `TryCombineItems` on the destination container. The container walks the destination item's fragments and the first fragment whose `CombineItems` succeeds wins. For a recipe combine, that is this fragment, and it runs the following steps:

{% stepper %}
{% step %}
#### Check Recipe Compatibility

Looks up the incoming item's definition in the `CombinationList`. If there is no entry for this item type, the combine is rejected with "That can't be combined" - no recipe exists for this pairing.
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

If `AmountToCreate` is 0, the combine is rejected with "Not enough to combine".
{% endstep %}

{% step %}
#### Simulate Consumption

Reduces the stack counts on both ingredients by the amounts needed. The items stay in their slots and nothing is destroyed yet. Each stack change is recorded as a transaction delta, so if this runs as a client prediction that the server later rejects, the whole thing unwinds cleanly.
{% endstep %}

{% step %}
#### Mark Slots That Will Be Freed

Any ingredient whose stack will reach zero goes on an exclusion list. During the placement check, cells occupied by excluded items are treated as available, because those items will be gone by the time the result is placed.
{% endstep %}

{% step %}
#### Validate Space

Searches the destination grid for an available slot per result item, using the exclusion list. This counts how many of the results can actually be placed.
{% endstep %}

{% step %}
#### Finalize or Rollback

* **No space for any result?** Restores the simulated stack counts on both ingredients and rejects with "No room for the result". No items are lost.
* **Space found?** Fully consumed ingredients (stack count reached zero) are removed from their slots, with the removals recorded as deltas for rollback.
{% endstep %}

{% step %}
#### Create and Place (Server Only)

The server creates each result item through the item subsystem and places it into a found slot. On a predicting client the workflow stops after cleanup: the predicted ingredient consumption stands, and the created result items arrive through replication once the server confirms.
{% endstep %}
{% endstepper %}

***

### Why the Exclusion List?

Consider this scenario: you combine two items that each occupy a 2x2 area, producing a single 2x2 result. If the grid is nearly full, there might be no empty 2x2 space available, but removing the consumed ingredients _creates_ that space.

The placement check runs while the ingredients still physically occupy their cells, so it can't just look for empty space. Instead, ingredients that will be fully consumed are excluded from the search, letting the result claim the cells they are about to vacate. Combined with the simulate-then-restore pattern, a combination with no room for any result leaves the inventory exactly as it was.

{% hint style="info" %}
The simulation-then-commit pattern is what prevents the worst-case scenario in any crafting system: consuming the player's ingredients and then failing to deliver the result. If no result can be placed, everything rolls back.
{% endhint %}
