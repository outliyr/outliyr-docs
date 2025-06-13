# Making an Actor Interactable

This guide shows you how to turn any actor (or component) into something the player can interact with using the Lyra Interaction System. We’ll cover the minimum setup and point out key areas where you can customize behavior and visuals.

Whether you're building a lootable item, a door, or a console, the process is the same.

***

### Implement the `IInteractableTarget` Interface

First, your actor or component must implement the `IInteractableTarget` interface. This marks it as something the interaction system can detect and query.

#### In Blueprint:

1. Open your actor Blueprint.
2. Go to **Class Settings**.
3. In the **Interfaces** section, add `InteractableTarget`.

<img src=".gitbook/assets/image (133).png" alt="" width="563" title="Add Interface in Blueprint">

***

### Override `GatherInteractionOptions`

This function tells the system what the player can do when they detect your object.

#### In Blueprint:

After adding the interface, you’ll see a new function:

```
GatherInteractionOptions
```

<img src=".gitbook/assets/image (134).png" alt="" width="563" title="GatherInteractionOptions implementation exmple">

***

### Choose the Interaction Behavior

Every `FInteractionOption` needs to define **how the interaction is triggered**, either on the player or on the interactable itself.\
There are two valid ways to configure this:

**Option A: Player Executes the Ability (Most Common)**

* Use this when the interaction logic lives on the **player**, like opening a chest, picking up loot, or triggering UI.
* **Steps:**
  * Create a Gameplay Ability (e.g., `GA_PickupItem`)
  * In your actor, expose a `TSubclassOf<UGameplayAbility>` variable for that ability
  * In `GatherInteractionOptions`, set `InteractionAbilityToGrant` on the option

<!-- tabs:start -->
#### **Blueprint Example**
<img src=".gitbook/assets/image (137).png" alt="" title="">


#### **C++ Example**
```cpp
void AMyCollectableActor::GatherInteractionOptions_Implementation(
    const FInteractionQuery& InteractQuery,
    TArray<FInteractionOption>& OutOptions)
{
    FInteractionOption Option;

    // Set the label that will be shown in the interaction widget
    Option.Text = FText::FromString(TEXT("Pick up Gold Coin"));

    // Reference to the ability this interaction will trigger
    // (assumed to be set in Blueprint defaults)
    Option.InteractionAbilityToGrant = PickupAbility;

    OutOptions.Add(Option);
}
```

<!-- tabs:end -->

* **Why use this:**
  * Ability logic stays on the player
  * No need for an ASC on the interactable
  * Simpler to manage and test

**Option B: Interactable Executes the Ability (Advanced)**

* Use this when the interactable has **its own state, logic, or cooldowns**, and should run the ability itself, not the player.
* **Setup requirements:**
  * The actor must have an **Ability System Component**
  * You must **grant the desired ability** to that ASC (using `GiveAbility`) at runtime or during construction
  * Store the resulting `FGameplayAbilitySpecHandle` for later use

<!-- tabs:start -->
#### **Blueprint Example**
**Grant the ability** to the target actor (e.g., in `BeginPlay` or construction). You must store the resulting `GameplayAbilitySpecHandle`, as it’s required to trigger the ability later.

<img src=".gitbook/assets/image (140).png" alt="" title="Setting the interaction ability spec handle">

**Populate the Interaction Option** by assigning:

* `TargetAbilitySystem` = the target’s ASC
* `TargetInteractionAbilityHandle` = the stored spec handle

Then add the option to `OutOptions`.

<img src=".gitbook/assets/image (139).png" alt="" title="Populate Interaction Option">


#### **C++ Example**
Grant the ability (e.g., `BeginPlay` or setup method)

```cpp
if (HasAuthority() && TerminalAbility)
{
	FGameplayAbilitySpec Spec(TerminalAbility, 1);
	StoredAbilityHandle = AbilitySystem->GiveAbility(Spec);
}
```

Add to `OutOptions` in `GatherInteractionOptions`

```cpp
FInteractionOption Option;
Option.Text = FText::FromString("Activate Console");
Option.TargetAbilitySystem = AbilitySystem;
Option.TargetInteractionAbilityHandle = StoredAbilityHandle;

OutOptions.Add(Option);
```

<!-- tabs:end -->

* **Why use this:**
  * The object owns the cooldowns, timers, and replication
  * Good for shared-world logic (e.g., terminals, generators, puzzle switches)

> [!info]
> If both fields are set (`InteractionAbilityToGrant` **and** `TargetAbilitySystem`/`Handle`), the system uses the **target ability path**.&#x20;

***

### Use the Interaction Widget Class (Optional)

Each `FInteractionOption` supports a custom widget via `InteractionWidgetClass`, but if you leave this blank, the system uses a powerful **default prompt widget**.

#### Features of the default prompt:

* Automatically shows the correct **input icon** (e.g., “E” on keyboard, “X” on controller).
* Supports **holding progress** for interactions that require time.
* Displays **interaction text** and subtext.

You can provide your own widget if you need specialized visuals, but the default covers most use cases elegantly.

***

### Customize Focus & Proximity (Optional)

You can implement these interface functions for cosmetic feedback:

* `SetFocused(bool)` — Called when the player looks at your object.
* `Nearby()` / `NoLongerNearby()` — Called when entering/leaving detection range.

Example use cases:

* Glow when focused
* Show an outline when nearby
* Play a sound or animation

> [!info]
> These functions do **not** affect functionality, they are purely visual.

***

### Summary Checklist

* [ ] Added `IInteractableTarget` to your actor or component
* [ ] Implemented `GatherInteractionOptions`
* [ ] Chose one of:
  * [ ] Set `InteractionAbilityToGrant` to grant ability to the player
  * [ ] **OR** set `TargetAbilitySystem` + `TargetInteractionAbilityHandle` to trigger logic on the object
* [ ] (Optional) Implemented visual feedback (`Nearby`, `SetFocused`, etc.)
* [ ] (Optional) Customized prompt with widget class and/or anchor

***

### What's Next?

Now that your object is interactable, you can:

* Create custom interaction widgets
* Add hold-to-interact behaviors
* Drive gameplay with GAS abilities
* Reuse this pattern across your entire game
