# Understanding Interaction Options

`FInteractionOption` is the core structure that defines what an interactable can _do_. Each time the system queries an object via `GatherInteractionOptions`, it returns one or more of these, which represent actions the player can take (e.g., "Open", "Pick Up", "Hack Terminal").

This page breaks down how to use `FInteractionOption` effectively and how each property contributes to your interaction's behavior or appearance.

***

### 1. Choosing the Interaction Behavior

Each `FInteractionOption` must define **how** the interaction is executed. There are two distinct approaches — **you only need one**, not both.

#### Option A: Grant Ability to Player

```cpp
InteractionAbilityToGrant = YourGameplayAbilityClass;
```

* This grants the ability to the player’s Ability System when they are near the object.
* The player activates the ability using input (e.g., pressing "E").
* The ability runs on the **player** and can contain logic like opening UI, modifying inventory, or triggering animations.

**When to use:**

* The player is doing the interaction directly (e.g., picking up an item).
* You want the logic to live on the player.

***

#### Option B: Trigger Ability on Target

```cpp
TargetAbilitySystem = DoorActor->GetAbilitySystemComponent();
TargetInteractionAbilityHandle = HandleYouStoredElsewhere;
```

* This triggers an ability that already exists on another actor’s ASC.
* You must provide both the ASC and a valid ability handle.
* The system uses `TriggerAbilityFromGameplayEvent` to activate the ability on the **target**, not the player.

**When to use:**

* You want the interaction to control external logic (e.g., a switch activating a door).
* The logic lives outside the player (in the world).

{% hint style="warning" %}
If neither of these is set correctly, the interaction will appear but do nothing.
{% endhint %}

***

### 2. Interaction Text & Subtext

```cpp
Text = FText::FromString("Open Door");
SubText = FText::FromString("Requires Power");
```

These fields define what the interaction prompt says:

* `Text` appears as the main action ("Pick Up", "Unlock", etc.)
* `SubText` is optional flavor text or context ("Requires Key", "Hold to Interact")

These are displayed in the **default prompt UI**, or can be shown in custom widgets.

> **\[Screenshot Placeholder #1: Default interaction prompt with text + subtext]**

***

### 3. Hold Duration

```cpp
InteractionTime = 1.5f;
```

This sets how long the player must **hold the input** to trigger the interaction.

* `0.0` (default) = Instant interaction.
* `> 0.0` = Hold interaction for this many seconds.

The default prompt UI shows a radial timer when a hold is required.

**Use cases:**

* Looting long items
* Interacting with heavy machinery
* Progress-based interactions

> **\[Screenshot Placeholder #2: In-game hold-to-interact prompt with timer filling]**

***

### 4. UI Widget & Spawn Location

#### a. `InteractionWidgetClass`

```cpp
InteractionWidgetClass = YourCustomWidget;
```

If set, this widget overrides the default prompt UI. This allows you to:

* Use unique visual styles per interaction
* Show different data or layouts
* Handle complex interaction visuals (e.g., item previews, icons, warnings)

If left unset, the system uses a default UI that supports icons, text, subtext, and timers — clean and controller-aware.

***

#### b. `InteractionWidgetComponent`

```cpp
InteractionWidgetComponent = SomeSceneComponent;
```

This determines **where in the world** the widget is attached.

* If set, the prompt will appear at this component’s location.
* If unset, it defaults to the actor’s root component.

This is helpful when the interactable is a small part of a large actor (e.g., a lever on a wall).

> **\[Screenshot Placeholder #3: UI prompt anchored to a specific scene component]**

***

### 5. Example Use Case (Full Setup)

Here’s an example `FInteractionOption` configured for a lootable chest:

```cpp
FInteractionOption ChestOption;
ChestOption.Text = FText::FromString("Open Chest");
ChestOption.SubText = FText::FromString("Hold to Search");
ChestOption.InteractionTime = 2.5f;
ChestOption.InteractionAbilityToGrant = UGA_OpenChest::StaticClass();
ChestOption.InteractionWidgetComponent = ChestLidComponent;
```

This will:

* Show “Hold E to Open Chest”
* Require the player to hold for 2.5 seconds
* Trigger a gameplay ability on the player
* Display the prompt at the chest lid

***

### Summary

| Field                                                   | Purpose                                          |
| ------------------------------------------------------- | ------------------------------------------------ |
| `Text`, `SubText`                                       | What appears in the prompt                       |
| `InteractionTime`                                       | Whether the interaction is instant or hold-based |
| `InteractionAbilityToGrant`                             | Ability granted to the player                    |
| `TargetAbilitySystem`, `TargetInteractionAbilityHandle` | Ability triggered on another actor               |
| `InteractionWidgetClass`                                | Optional custom widget                           |
| `InteractionWidgetComponent`                            | Where to show the prompt in world space          |

***

Next up: Customizing Interaction UI — learn how to replace or extend the interaction prompts with your own widgets and logic.
