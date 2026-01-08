# Consume Action Orchestrator

### The job: make “use” consistent

Once an item has a **Consume Fragment**, it’s marked as usable but what actually triggers the logic when the player clicks “Use”?

That responsibility falls to a pair of cooperating systems:

| Component                                   | Role                                                |
| ------------------------------------------- | --------------------------------------------------- |
| `ULyraGameplayAbility_Consume`              | Receives the request to use an item (e.g. from UI). |
| `UAbilityTask_ActivateConsumeEffectAndWait` | Manages the temporary effect ability lifecycle.     |

These are **not designed to be modified**. Instead, they create a **uniform entry point** for triggering item use so developers only need to implement the effect logic (in `FromConsume`) and wire up the UI once.

***

#### Entry point for UI, input, gameplay events

You don’t need a different ability for each item.

All you need to do is:

* Make sure the item definition has a valid `InventoryFragment_Consume`.
* Set that item's **activation tag** to  `Ability.Inventory.UseItem`.
* Send a gameplay event (via Blueprint or C++) with a reference to the item’s **slot address**.

That’s it. `ULyraGameplayAbility_Consume` takes over from there.

<details>

<summary>Directly calling the ability from UI</summary>



</details>

{% hint style="success" %}
You do not need to call the ability from the UI because the item action menu already supports consuming items, so that is automatically handled. The item action menu under the hood also calls the ability. You can read this page for more info on the [Item action menu](../../../ui/item-container-ui-system/interaction-and-transactions/context-menus-and-action-logic.md).
{% endhint %}

***

### What the orchestrator actually does

The `ULyraGameplayAbility_Consume` ability is lightweight but performs important work under the hood.

When triggered, it:

1. **Resolves** the item instance from the provided slot address.
2. **Checks** that the item has a valid `ConsumeFragment` with:
   * a usable `AbilityToActivate`
   * a sufficient quantity available to consume
3. **Spawns** an internal task to activate the item’s effect ability (`FromConsume` subclass).
4. **Waits** for that task to complete, depending on the selected **Finish Policy**.
5. **Ends** itself automatically, no further logic needed in the orchestrator.

{% hint style="info" %}
The orchestrator ability itself never removes items, applies buffs, plays montages, etc. That’s all handled by the effect ability (the `FromConsume` subclass). The orchestrator is purely for **standardization and flow control**.
{% endhint %}

***

### The hidden conductor: `ActivateConsumeEffectAndWait`

The orchestrator delegates actual ability activation to an **internal Ability Task**. You won’t see it in your Blueprints. it’s used behind the scenes.

Its job:

{% stepper %}
{% step %}
#### **Grant**

Temporarily grants the `FromConsume` ability defined in the fragment.
{% endstep %}

{% step %}
#### **Activate**

Activates the effect ability, passing in the item as the SourceObject.
{% endstep %}

{% step %}
#### **Wait**

Listens for the ability to either:

* Call `ConsumeItem()`
* Or end itself
{% endstep %}

{% step %}
#### **Finish**

Unbinds delegates, clears the ability from the ASC, and reports completion to the orchestrator.
{% endstep %}
{% endstepper %}

***

### Finish Policy: choosing how long to wait

The behavior of both the **task** and the **orchestrator** depends on the **FinishPolicy** enum, which is set inside the `ConsumeFragment`.

| Finish Policy          | What happens                                                                     | When the orchestrator ends            |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------- |
| `EndImmediately`       | Effect ability is spawned and detached instantly.                                | Right after activation.               |
| `WaitForConsumeEffect` | Orchestrator waits for the effect ability to call `ConsumeItem()` (or just end). | After `ConsumeItem()` or ability end. |
| `BlockOtherConsumes`   | Orchestrator fully blocks until the effect ability ends.                         | Only when ability fully ends.         |

***

### Why this structure exists

You might wonder: why not just activate the item’s effect ability directly?

The answer is **control and consistency**:

* You only need one entry-point: `Ability.Inventory.UseItem`
* You can manage blocking behavior without touching Blueprints or C++.
* Developers implement just the **effect**, not the orchestration.
* Complex behavior (stack checks, server prediction, lifetime management) happens internally.

This keeps your ability code clean and decoupled, every item just needs its `FromConsume` logic and a single tag.

{% hint style="info" %}
**Developer-facing Blueprint customization lives entirely in `FromConsume`.**
{% endhint %}

***

When you add a `ConsumeFragment` to an item:

* The **FromConsume** class you point to will perform the logic (heal, throw, buff…).
* The **orchestrator** (`GA_Consume`) activates it, manages blocking, and ends cleanly.
* The **ability task** ensures the ability is granted and cleaned up safely which is especially important in networked games.

The only thing you need to implement is the **effect.** Everything else is handled.

Now that you understand how the consume process is launched and managed, continue to the next section, where you’ll implement the actual gameplay effects when an item is consumed.

***
