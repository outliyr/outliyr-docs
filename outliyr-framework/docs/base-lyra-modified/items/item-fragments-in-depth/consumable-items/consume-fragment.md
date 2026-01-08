# Consume Fragment

The **Consume Fragment** is what turns a regular item into something the player can "use."

When you add this fragment to an item definition, it:

* **Points** to the ability that performs the effect
* **Specifies** how many units to deduct when consumed
* **Controls** whether the player is blocked from using other items

```
ID_HealthPotion
└─ Fragments
   ├─ InventoryFragment_Icon
   ├─ InventoryFragment_SetStats
   └─ InventoryFragment_Consume   ← this makes it usable
```

<figure><img src="../../../../.gitbook/assets/image (47).png" alt=""><figcaption><p>Consumable Fragment</p></figcaption></figure>

#### Adding the fragment step-by-step

1. **Open** the item definition asset (e.g. `ID_HealthPotion`).
2. In the _Fragments_ array press **`+`** ➜ choose **InventoryFragment\_Consume**.
3. Fill the properties (see next section).
4. Press **Compile** then **Save**.
5. That’s it. The UI “Use” button in the Tetris Inventory already knows what to do.

***

### Properties

#### Ability To Activate

The Gameplay Ability that defines what happens when the item is used.

This must be a subclass of `ULyraGameplayAbility_FromConsume`. You'll implement your effect logic (healing, spawning, buffs, etc.) in this ability.

#### Amount To Consume

How many units are removed from the stack when `ConsumeItem()` is called in your ability.

* Set to `1` for most items
* Set higher for items that consume multiple per use

#### Finish Policy

Controls when the player can use another consumable:

| Policy                 | Behavior                                | Example                      |
| ---------------------- | --------------------------------------- | ---------------------------- |
| `EndImmediately`       | No blocking - player can spam items     | Energy drinks, instant buffs |
| `WaitForConsumeEffect` | Blocked until `ConsumeItem()` is called | Items with brief wind-up     |
| `BlockOtherConsumes`   | Blocked until the ability fully ends    | Med-kits, channeled items    |

***

## What Happens at Runtime

When the player uses an item with a Consume Fragment:

1. **UI triggers** the use action (sends `Ability.Inventory.UseItem` event)
2. **Orchestrator** finds the item and reads the Consume Fragment
3. **Your ability** is activated (the `Ability To Activate` you specified)
4. **You call** `ConsumeItem()` when the effect should "cost" the item
5. **System automatically**:
   * Decrements stack by `Amount To Consume`
   * Removes item if stack reaches 0
   * Fires `PlayConsumeEffects()` for VFX/sounds
   * Sends transaction to server for validation
6. **Ability ends** when you call `EndAbility()`

{% hint style="info" %}
You don't need to manually remove items from inventory. Calling `ConsumeItem()` handles everything, including removing the item when the stack is depleted.
{% endhint %}

***

### Examples

<details>

<summary>Med-Kit (Channeled Heal)</summary>

| Property            | Value                   |
| ------------------- | ----------------------- |
| Ability To Activate | `GA_Consume_MedkitHeal` |
| Amount To Consume   | `1`                     |
| Finish Policy       | `BlockOtherConsumes`    |

The ability plays a 3-second animation, applies healing, calls `ConsumeItem()`, then `EndAbility()`.

During those 3 seconds, the player cannot use another consumable.

</details>

<details>

<summary>Energy Drink (Instant Buff)</summary>

| Property            | Value                    |
| ------------------- | ------------------------ |
| Ability To Activate | `GA_Consume_EnergyDrink` |
| Amount To Consume   | `1`                      |
| Finish Policy       | `EndImmediately`         |

The ability applies a stamina buff, calls `ConsumeItem()`, and ends in the same tick.

The player can drink multiple drinks in rapid succession.

</details>

<details>

<summary>Grenade (Throwable)</summary>

| Property            | Value                     |
| ------------------- | ------------------------- |
| Ability To Activate | `GA_Consume_ThrowGrenade` |
| Amount To Consume   | `1`                       |
| Finish Policy       | `WaitForConsumeEffect`    |

The ability plays a throw animation, spawns the grenade actor, calls `ConsumeItem()`, then ends.

The player is briefly blocked until the throw completes.

</details>

### Common Mistakes

<details>

<summary>Pressing Use does nothing</summary>

Cause: Fragment missing or `Ability To Activate` not set

Fix: Add fragment and set the ability class

</details>

<details>

<summary>Item never leaves inventory</summary>

Cause: Ability forgot to call `ConsumeItem()`

Fix: Call `ConsumeItem()` in your ability

</details>

<details>

<summary>Player stuck, can't use items</summary>

Cause: Finish Policy is `BlockOtherConsumes` but ability never ends

Fix: Ensure ability calls `EndAbility()`

</details>

<details>

<summary>Item consumed but no effect</summary>

Cause: Effect logic runs after `EndAbility()`

Fix: Move effect logic before `EndAbility()`

</details>

### Next Step

Now that your item is configured, you need to implement the effect ability. See [FromConsume Ability](/broken/pages/d83b9c81b46f68b42ac9e7e600db42ab1aa04def).
