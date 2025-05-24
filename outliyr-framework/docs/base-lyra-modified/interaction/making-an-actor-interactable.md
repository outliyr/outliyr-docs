# Making an Actor Interactable

## Making an Actor Interactable

This guide shows you how to turn any actor (or component) into something the player can interact with using the Lyra Interaction System. We’ll cover the minimum setup and point out key areas where you can customize behavior and visuals.

Whether you're building a lootable item, a door, or a console — the process is the same.

***

### 1. Implement the `IInteractableTarget` Interface

First, your actor or component must implement the `IInteractableTarget` interface. This marks it as something the interaction system can detect and query.

#### In Blueprint:

1. Open your actor Blueprint.
2. Go to **Class Settings**.
3. In the **Interfaces** section, add `InteractableTarget`.

> **\[Screenshot Placeholder #1: Add Interface in Blueprint]**\
> Show the Blueprint Class Settings panel with the interface added.

***

### 2. Override `GatherInteractionOptions`

This function tells the system what the player can do when they detect your object.

#### In Blueprint:

After adding the interface, you’ll see a new function:

```
GatherInteractionOptions
```

You should:

* Add a new `FInteractionOption` to the output array.
* Fill in at least the `Text`, and either:
  * `InteractionAbilityToGrant` (if player triggers the logic), or
  * `TargetAbilitySystem` and `TargetInteractionAbilityHandle` (if target runs the logic)

> **\[Screenshot Placeholder #2: GatherInteractionOptions implementation in BP]**\
> Show a simple setup with a single interaction option returning “Open” with a granted ability.

***

### 3. Use the Default Interaction Widget (Optional, Recommended)

Each `FInteractionOption` supports a custom widget via `InteractionWidgetClass`, but if you leave this blank, the system uses a powerful **default prompt widget**.

#### Features of the default prompt:

* Automatically shows the correct **input icon** (e.g., “E” on keyboard, “X” on controller).
* Supports **holding progress** for interactions that require time.
* Displays **interaction text** and subtext.

You can provide your own widget if you need specialized visuals, but the default covers most use cases elegantly.

> **\[Screenshot Placeholder #3: Default prompt in action in-game]**\
> Show an in-game shot of the default prompt above an object, e.g., “Hold E to Open”.

***

### 4. Customize Focus & Proximity (Optional)

You can implement these interface functions for cosmetic feedback:

* `SetFocused(bool)` — Called when the player looks at your object.
* `Nearby()` / `NoLongerNearby()` — Called when entering/leaving detection range.

Example use cases:

* Glow when focused
* Show an outline when nearby
* Play a sound or animation

> These functions do **not** affect functionality — they are purely visual.

***

### 5. Advanced: Use a Target Ability

If you want the interaction to trigger a specific ability on another object (e.g., a console activating a door), use these properties in your `FInteractionOption`:

* `TargetAbilitySystem` — The ASC that owns the logic.
* `TargetInteractionAbilityHandle` — The ability spec to trigger.

You can use the `CustomizeInteractionEventData` function to redirect the target in the payload, allowing full flexibility.

> Example: The console is the interactable, but it uses `CustomizeInteractionEventData` to redirect the payload to a door actor and trigger the door-opening ability.

***

### Summary Checklist

| Step                                  | Required?                  | Description                           |
| ------------------------------------- | -------------------------- | ------------------------------------- |
| Add `IInteractableTarget`             | Yes                        | Marks actor as interactable           |
| Implement `GatherInteractionOptions`  | Yes                        | Define what the interaction does      |
| Set `Text` and ability options        | Yes                        | Provide UI text and interaction logic |
| Use default prompt                    | Optional (but recommended) | Great-looking and flexible            |
| Add visuals in `SetFocused`, `Nearby` | Optional                   | Cosmetic enhancements                 |
| Use ability redirection               | Advanced                   | For complex world-driven logic        |

***

### What's Next?

Now that your object is interactable, you can:

* Create custom interaction widgets
* Add hold-to-interact behaviors
* Drive gameplay with GAS abilities
* Reuse this pattern across your entire game
