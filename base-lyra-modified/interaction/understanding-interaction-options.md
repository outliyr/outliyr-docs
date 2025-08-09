# Understanding Interaction Options

`FInteractionOption` is the core structure that defines what an interactable can _do_. Each time the system queries an object via `GatherInteractionOptions`, it returns one or more of these, which represent actions the player can take (e.g., "Open", "Pick Up", "Hack Terminal").

This page breaks down how to use `FInteractionOption` effectively and how each property contributes to your interaction's behavior or appearance.

<img src=".gitbook/assets/image (141).png" alt="" width="335" title="">

***

### Choosing the Interaction Behavior

Each `FInteractionOption` must define **how** the interaction is executed. There are two distinct approaches, **you only need one**, not both.

#### Option A: Run Ability on the Player

```cpp
InteractionAbilityToGrant = YourGameplayAbilityClass;
```

**What happens:**

* The ability is granted to the player’s ASC via the overlap scanner
* When the player presses the interact input, the ability is activated on their own ASC
* Logic, effects, and UI run on the player

***

#### Option B: Run Ability on the Interactable

```cpp
TargetAbilitySystem = Interactable->GetAbilitySystemComponent();
TargetInteractionAbilityHandle = AbilitySpecHandleYouStored;
```

**What happens:**

* The player triggers an ability that already exists on the target's ASC
* The system uses `TriggerAbilityFromGameplayEvent` to run the ability on the target
* The logic executes on the interactable object's ASC, not the player

> [!warning]
> If neither of these is set correctly, the interaction will appear but do nothing.

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

***

### 5. Example Use Case (Full Setup)

Here’s an example `FInteractionOption` configured for a lootable chest:

<!-- tabs:start -->
#### **Interaction run on player**
```cpp
FInteractionOption ChestOption;
ChestOption.Text = FText::FromString("Open Chest");
ChestOption.InteractionTime = 2.5f;
ChestOption.InteractionAbilityToGrant = UGA_OpenChest::StaticClass();
// scene component
ChestOption.InteractionWidgetComponent = InteractionWidgetComponent;
```

This will:

* Show “Open Chest”
* Require the player to hold for 2.5 seconds
* Trigger a gameplay ability on the player
* Display the prompt at the same location of the `InteractionWidgetComponent` in the viewport


#### **Interaction run on interactable**
```cpp
FInteractionOption LargeMachineBossOption;
LargeMachineBossOption.Text = FText::FromString("Scramble Systems");
LargeMachineBossOption.InteractionTime = 6.5f;
LargeMachineBossOption.TargetAbilitySystem = GetAbilitySystemComponent();
LargeMachineBossOption.TargetInteractionAbilityHandle = ScrambleInteractionAbilityHandle;
// scene component
LargeMachineBossOption.InteractionWidgetComponent = TerminalInteractionWidgetComponent;
```

This will:

* Show “Scramble Systems”
* Require the player to hold for 6.5 seconds
* Trigger a gameplay ability on the LargeMachineBoss
* Display the prompt at the same location of the `TerminalInteractionWidgetComponent` in the viewport

<!-- tabs:end -->

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
