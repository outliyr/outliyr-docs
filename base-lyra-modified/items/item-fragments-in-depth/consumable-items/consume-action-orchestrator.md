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
* Set that item's **activation tag** to something like `Ability.Inventory.UseItem`.
* Send a gameplay event (via Blueprint or C++) with a reference to the item’s **slot address**.

That’s it. `ULyraGameplayAbility_Consume` takes over from there.

<img src=".gitbook/assets/image (48).png" alt="" title="W_InventoryActionMenu  UseItem function.">

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

> [!info]
> The orchestrator ability itself never removes items, applies buffs, plays montages, etc. That’s all handled by the effect ability (the `FromConsume` subclass). The orchestrator is purely for **standardization and flow control**.

***

### The hidden conductor: ActivateConsumeEffectAndWait

The orchestrator delegates actual ability activation to an **internal Ability Task**. You won’t see it in your Blueprints. it’s used behind the scenes.

Its job:

| Phase        | Task Responsibility                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------- |
| **Grant**    | Temporarily grants the `FromConsume` ability defined in the fragment.                             |
| **Activate** | Activates the effect ability, passing in the item as the SourceObject.                            |
| **Wait**     | <p>Listens for the ability to either:<br>• call <code>ConsumeItem()</code><br>• or end itself</p> |
| **Finish**   | Unbinds delegates, clears the ability from the ASC, and reports completion to the orchestrator.   |

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

> [!info]
> **Developer-facing Blueprint customization lives entirely in `FromConsume`.**

***

When you add a `ConsumeFragment` to an item:

* The **FromConsume** class you point to will perform the logic (heal, throw, buff…).
* The **orchestrator** (`GA_Consume`) activates it, manages blocking, and ends cleanly.
* The **ability task** ensures the ability is granted and cleaned up safely which is especially important in networked games.

The only thing you need to implement is the **effect.** Everything else is handled.

Now that you understand how the consume process is launched and managed, continue to the next section:\
**Consumed Item Effect Logic** – where you’ll implement the actual gameplay logic for using an item.

***
