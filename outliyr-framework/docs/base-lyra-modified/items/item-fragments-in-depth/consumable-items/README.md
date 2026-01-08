# Consumable Items

This section details the system for creating items that players can "use" or "consume" to trigger specific gameplay-affecting actions, such as drinking a potion, eating food, throwing a grenade, or activating a special device. This functionality is primarily enabled by the `UInventoryFragment_Consume` and works in conjunction with specialized Gameplay Abilities.

### What counts as a “consumable”?

* **Instant** buffs (food, stat potions)
* **Channelled** actions (med-kits, shield drinks)
* **Throwables / placeables** (grenades, traps)

All of them follow the same recipe: **data flag → generic trigger → specific effect**.

### Purpose: Triggering Effects from Items

Every item feels different, yet designers expect a **single UI button** (“Use”) to handle them all.\
The **Consume Fragment** turns that expectation into a **data-driven pipeline**:

1. **Flag** an item definition as “usable”.
2. **Link** it to a Gameplay Ability that does the real work.
3. **Choose** how long, if at all, the player is blocked from using the next item.

The core goal is to provide a standardized and flexible way to:

* **Designate Items as Usable:** Mark specific item types as consumable or activatable.
* **Link Item to Effect:** Associate an item type with a specific Gameplay Ability that defines the _actual consequence_ of using the item (e.g., healing, applying a buff, etc).
* **Define Cost:** Specify how much of the item (e.g., stack count, charges) should be consumed _if_ the usage is successful.
* **Conditional Consumption:** Allow the specific effect ability to determine if the use was "successful" in a gameplay sense (e.g., health potion doesn't work if health is full), preventing unnecessary cost application.
* **Integrate with GAS:** Leverage the Gameplay Ability System for activation, permission checking, networking, and executing the effects.
* **Decouple Logic:** Separate the generic "use item" request (often from UI) from the specific item's effect and cost application logic.

### What You Need to Know

To make a consumable item, you only need to understand two things:

| Component               | What It Does                                        | Your Task                                          |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------- |
| **Consume Fragment**    | Marks an item as usable and configures its behavior | Add to item definition, set properties             |
| **FromConsume Ability** | Defines what happens when the item is used          | Create a Blueprint subclass with your effect logic |

That's it. Everything else (orchestration, networking, cleanup) is handled automatically.

***

### Quick Start

{% stepper %}
{% step %}
#### Make the Item Consumable

Add a **Consume Fragment** to your item definition.

{% stepper %}
{% step %}
#### Open your item definition

Open your item definition asset (e.g., `ID_HealthPotion`).
{% endstep %}

{% step %}
#### Add the fragment

In the Fragments array, click **+** and select `InventoryFragment_Consume`.
{% endstep %}

{% step %}
#### Set the properties

* **Ability To Activate**: Your FromConsume ability class
* **Amount To Consume**: How many to remove per use (usually 1)
* **Finish Policy**: When the player can use another item
{% endstep %}
{% endstepper %}
{% endstep %}

{% step %}
#### Implement the Effect

Create a Blueprint that inherits from `ULyraGameplayAbility_FromConsume`.

Example pseudocode/flow:

```
Event ActivateAbility
  → Do your effect (apply GE, play montage, spawn actor, etc.)
  → Call ConsumeItem() when the cost should be paid
  → Call EndAbility() when done
```

Example - Instant Heal:

```
ActivateAbility → Apply Heal Effect → ConsumeItem() → EndAbility()
```

Example - Channeled Med-Kit:

```
ActivateAbility → Play Montage → Wait → Apply Heal → ConsumeItem() → EndAbility()
```
{% endstep %}
{% endstepper %}

<details>

<summary>Blueprint example of a Consumable Ability (<code>GA_Consume_DirtyWater</code>)</summary>

<figure><img src="../../../../.gitbook/assets/image (202).png" alt=""><figcaption></figcaption></figure>

</details>

***

### What Happens When You Call `ConsumeItem()`

When your ability calls `ConsumeItem()`:

1. Stack Decremented - Item count reduced by `AmountToConsume`
2. Auto-Removal - If stack reaches 0, item is automatically removed from inventory
3. Effects Triggered - `PlayConsumeEffects()` fires for VFX/sounds
4. Server Confirmation - Transaction sent to server for validation
5. Result Callback - `OnConsumeSucceeded` or `OnConsumeFailed` fires

{% hint style="info" %}
The item transaction uses client prediction for responsive gameplay. For details on how this works, see [Client Prediction](../../../item-container/prediction/).
{% endhint %}

***

### Finish Policy Options

The **Finish Policy** controls when the player can use another consumable:

| Policy                 | Behavior                                | Use Case                   |
| ---------------------- | --------------------------------------- | -------------------------- |
| `EndImmediately`       | Player can immediately use another item | Instant buffs, quick items |
| `WaitForConsumeEffect` | Blocked until `ConsumeItem()` is called | Items with brief delay     |
| `BlockOtherConsumes`   | Blocked until ability fully ends        | Channeled items, montages  |

***

## Subpages

* [**Consume Fragment**](consume-fragment.md) - Step 1: Configuring items to be consumable
* [**FromConsume Ability**](from-consume-ability.md) - Step 2: Implementing the effect logic
* [**How It Works**](consume-action-orchestrator.md) - Optional: Internal architecture for curious developers

