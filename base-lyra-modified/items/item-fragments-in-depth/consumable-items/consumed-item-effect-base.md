# Consumed Item Effect Base

All the previous pages were about plumbing.\
**This page is about creativity**, the Gameplay Ability that defines _what actually happens_ when the player uses an item.

`ULyraGameplayAbility_FromConsume` is a lightweight C++ base-class that you subclass\
(in Blueprint or C++) for every distinct effect:

| Item                | Typical subclass name    |
| ------------------- | ------------------------ |
| Bandage             | `GA_Consume_BandageHeal` |
| Frag grenade        | `GA_Consume_ThrowFrag`   |
| Energy drink        | `GA_Consume_EnergyDrink` |
| Portable launch pad | `GA_Consume_LaunchPad`   |

The UI event, the orchestrator, the wait-task, FinishPolicy all funnel control _into_ your subclass.\
From here on, you decide the rules.

***

### What this class does and doesn’t do

✔ Provides hooks to:

* Access the item being consumed
* Validate custom conditions
* Trigger and finalize the item’s cost

❌ Does **not**:

* Start itself (that’s the orchestrator)
* Apply cost automatically. You **must** handle that via `OnConsumeItem`

***

### Life-cycle at a glance

```
ActivateAbility
 ├─ [Optional] Validate game state
 ├─ Trigger gameplay logic (GE, actor spawn, animation, etc.)
 ├─ When ready: call ConsumeItem()
 │     └─ This fires OnConsumeItem(Item, Quantity) → your override
 └─ When effect is done: call EndAbility()
```

**Calling `ConsumeItem()` is your signal** to deduct cost and tell the task “I’m done if you were waiting for me.” if the `FinishPolicy` is `WaitForConsumeEffect`

**Calling `EndAbility()`** is always required to unblock the orchestrator if `FinishPolicy` is set to `BlockOtherConsumes`.

***

### The Three Responsibilities

**1. Implement the gameplay effect**

This happens inside `ActivateAbility`. You define what the item does.

```
e.g.
- ApplyGameplayEffectToOwner
- Play montage
- Delay or WaitTask
```

You are free to run whatever logic you want.

**2. Call `ConsumeItem()` when the cost should apply**

When you’re confident the use should “go through,” you **must** call:

```cpp
ConsumeItem();
```

What this does:

* Retrieves the item and amount from the fragment
* Calls your Blueprint-implementable `OnConsumeItem(Item, Quantity)`
* Broadcasts the internal delegate (unblocks the AbilityTask if needed)

**3. Override `OnConsumeItem()` to implement cost logic**

This is the only required override in Blueprint.

This function is automatically called when `ConsumeItem()` runs.

<img src=".gitbook/assets/image (49).png" alt="" title="Override example of OnConsumeItem">

You own this function. **Nothing is done automatically** unless you do it here.

> [!success]
> #### Tip: Use a Function Library for Reuse
> 
> If you're using the same logic across multiple consumables (like removing items from inventory), you don’t need to duplicate Blueprint graphs everywhere.
> 
> > You can simplify your `OnConsumeItem` implementations by using a centralized Blueprint Function Library.
> 
> The TetrisInventory plugin includes one such helper:\
> &#xNAN;**`ConsumeItemFromInventory`** from **`BFL_ConsumeFragment`**.
> 
> This function:
> 
> * Takes an `ULyraInventoryItemInstance` and a quantity
> * Automatically resolves the item’s location
> * Removes the items from the respective inventory
> 
> 💬 **Why use it?**\
> It reduces boilerplate, avoids mistakes, and makes your effect Blueprints cleaner.
> 
> _Optional:_ You can add your own Blueprint Function Library functions for custom logic, such as playing sound cues, triggering effects, or combining multiple checks before removal.

**4. Call `EndAbility()` to finish**

Every “FromConsume” ability must end itself when its effect is done.\
This lets the task/consume system clean up and allows new consumables to be triggered.

<div class="collapse">
<p class="collapse-title">Example Blueprint Ability Resize Inventory</p>
<div class="collapse-content">

```
Event ActivateAbility
 → Get the inventory the item resides in
 → Authority Checks
 → Resize Inventory
 → If successful -> ConsumeItem()
 → EndAbility()
```

<img src=".gitbook/assets/image (52).png" alt="" title="Get the inventory the item resides in">

<img src=".gitbook/assets/image (53).png" alt="" title="Authority Checks">

<img src=".gitbook/assets/image (54).png" alt="" title="Resize the inventory on the serverConsume the ability if sucessfulEnd Ability">

<img src=".gitbook/assets/image (55).png" alt="" title="Overriden OnConsumeItem: This actually consumes the item using the blueprint function library">

</div>
</div>

***

#### Common Use Cases

| Use Case          | What to do                                                    | Finish Policy          |
| ----------------- | ------------------------------------------------------------- | ---------------------- |
| Instant Heal      | Apply GE → `ConsumeItem()` → `EndAbility()`                   | `EndImmediately`       |
| Thrown Grenade    | Play montage → spawn actor → `ConsumeItem()` → `EndAbility()` | `WaitForConsumeEffect` |
| Long Channel Buff | Delay → GE → `ConsumeItem()` → `EndAbility()`                 | `BlockOtherConsumes`   |

***

### Advanced Notes

* `GetConsumableItemInstance()` gives you access to the source item. Useful for checking metadata, stats, or other fragments.
* `CanConsumeItem(Item)` runs before your logic. Override this if you want to cancel the ability before it starts (e.g., medkit while full health).
* Cost logic (e.g., removing the item or reducing stack) **must** go in `OnConsumeItem()`. The system won’t do this for you automatically.

***

### When Things Go Wrong (Debug Guide)

| Symptom                  | Likely Cause                                               |
| ------------------------ | ---------------------------------------------------------- |
| No item was removed      | You didn’t override or call logic inside `OnConsumeItem()` |
| Ability stuck forever    | `EndAbility()` never called                                |
| Ability skipped entirely | `CanConsumeItem()` returned false                          |

***

By subclassing `ULyraGameplayAbility_FromConsume`, you’re defining the entire experience of using a consumable item.

All you need to do is:

1. Define the gameplay effect in `ActivateAbility`.
2. Call `ConsumeItem()` when it should take effect.
3. Handle actual cost logic in `OnConsumeItem`.
4. Finish cleanly with `EndAbility()`.

With that, your consumables are fully powered, network-aware, and compatible with the rest of the system.
