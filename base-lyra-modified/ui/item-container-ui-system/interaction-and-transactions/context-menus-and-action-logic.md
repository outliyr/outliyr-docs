# Context Menus & Action Logic

In any robust inventory system, players need to do more than just move items. They need to **Use**, **Equip**, **Drop**, or **Split** them.

Since this system is container-agnostic, we cannot hard-code an "Equip" button into the inventory widget. Instead, we use a dynamic **Action System** that queries the item for its capabilities.

```
Right-click on item:
┌─────────────────────┐
│  Health Potion      │
├─────────────────────┤
│  ► Use              │
│  ► Drop             │
│  ► Split Stack...   │
│  ► Inspect          │
│  ► Destroy          │
└─────────────────────┘
```

The `ActionMenuViewModel` handles:

* Gathering available actions for an item
* Displaying the menu
* Executing selected actions
* Handling quantity input for partial actions

The `LyraItemActionMenuViewModel` acts as the brain for your context menus. It is a **Shared Singleton** (one per player) that you access via the UI Manager.

#### The Item Action Menu Flow

1. **Trigger:** Player Right-Clicks an item (or presses Gamepad Face Button).
2. **Request:** Your widget calls `ActionMenuVM->ShowForItem(...)`.
3. **Discovery:** The system scans the item's fragments to find valid actions.
4. **Display:** The Menu Widget (which binds to the VM) appears with a list of buttons.
5. **Execution:** Player clicks an action -> VM triggers Gameplay Ability.

***

### Step 1: Triggering the Menu

You typically trigger the menu from your **Slot Widget** (the widget representing a single inventory square).

#### In Blueprint (Item Widget)

**Event:** `OnMouseButtonDown`

1. **Check:** Is `EffectingButton` == Right Mouse?
2. **Get Manager:** Get `LyraItemContainerUIManager` from Local Player.
3. **Get VM:** Call `GetActionMenuViewModel`.
4.  **Show:** Call `ShowForItem`.

    * **Item:** The `LyraItemViewModel` this slot represents.
    * **Position:** `GetScreenSpacePosition` from the mouse event.



<details class="gb-toggle">

<summary>Blueprint graph showing utilization of <code>ItemActionMenu</code> in equipment slot</summary>

<img src=".gitbook/assets/image (9).png" alt="" title="Blueprint Graph showing OnMouseButtonDown->CreateItemActionMenu on right click">

<img src=".gitbook/assets/image (10).png" alt="" title="Inform the ActionMenuViewModel that it should create should populate a menu for the item in the slot">

</details>

***

### Step 2: The Menu Widget

You need to create a widget that _is_ the menu. This widget should exist in your `LyraItemContainerLayer` (or be spawned dynamically).

#### Binding Setup

This widget should bind to the `ActionMenuViewModel`.

<table><thead><tr><th width="194">Property</th><th width="176">Type</th><th>Usage</th></tr></thead><tbody><tr><td><code>bIsVisible</code></td><td>Boolean</td><td>Bind to <strong>Visibility</strong> (Visible/Collapsed).</td></tr><tr><td><code>MenuPosition</code></td><td>Vector2D</td><td>Bind to <strong>Slot</strong> (C<strong>anvasSlot) -> SetPosition</strong></td></tr><tr><td><code>Actions</code></td><td>Array</td><td>Bind to a <strong>ListView</strong> or generate child buttons manually.</td></tr></tbody></table>

#### The Action Button

Create a simple button widget for the list.

* **Icon:** Bind to `ActionData.Icon`.
* **Text:** Bind to `ActionData.DisplayName`.
* **On Clicked:** Call `ActionMenuVM->ExecuteAction(ActionData.ActionTag)`.

<img src=".gitbook/assets/image (12).png" alt="" title="ItemActionButton OnClicked Implementation">

***

### Step 3: Defining Actions

Actions are defined on the **Item Definition** itself, using Fragments. This keeps your data clean—an Apple "knows" it can be eaten; the UI doesn't need to check.

#### C++ Interface (`IItemActionProvider`)

If you are creating a custom fragment (e.g., `UFragment_Readable`), implement this interface.

```cpp
virtual void GetAvailableActions(const ULyraInventoryItemInstance* Item, TArray<FLyraItemActionData>& OutActions) const override
{
    // Add "Read" action
    FLyraItemActionData Action;
    Action.ActionTag = Tag_Action_Read;
    Action.DisplayName = NSLOCTEXT("MyGame", "Read", "Read");
    OutActions.Add(Action);
}
```

#### Filtering (Container Context)

Sometimes, an action is valid for the _Item_, but invalid for the _Container_ (e.g., you can't "Equip" an item while browsing a Shop).

The Container Interface allows filtering:

* `GetExcludedItemActions()`: Returns tags to hide (e.g., hide `Action.Drop` in a Shop).
* `GetAllowedItemActions()`: If set, _only_ these tags are shown.

This happens automatically in `ActionMenuVM`. You don't need to write UI logic for it.

### The GAS Handshake (Execution)

This is the most important concept for developers to understand: **The UI does not perform gameplay logic.** It is simply a router.

When a player clicks "Use," the UI performs a handshake with the Gameplay Ability System:

1. **Packaging:** The UI creates an FItemActionContext. This struct contains the ActionTag (e.g., Lyra.Item.Action.Use) and the SourceSlot (where the item is).
2. **Dispatch:** It calls UItemContainerFunctionLibrary::CallItemActionAbility.
3. **The Event:** This function sends a **Gameplay Event** to the player's Actor. The **Event Tag** is the ActionTag.

> [!DANGER]
> **Implementation Requirement:**\
> For an action to work, you **must** have a Gameplay Ability in your project that is configured to trigger via that specific Gameplay Tag. The UI "fires the flare," but your Ability must be looking for it to actually perform the action.

#### The Universal Data Shape

Every item action ability receives the same payload in its EventData. You can use the `GetCustomAbilityData` node in your Ability Blueprint to extract the `FItemActionContext`. This tells your ability exactly which item it should act upon.

<img src=".gitbook/assets/image (18).png" alt="" title="Example unpacking the item action context from the gameplay ability">

***

### Step 4: The Quantity Prompt

Some actions, like **Split Stack** or **Drop**, require a second step: asking the user _"How many?"_ The system handles this with a **Quantity Prompt ViewModel**.

This logic is encapsulated in the `LyraQuantityPromptViewModel`. It acts as a shared service for the entire UI.

#### The Item Quantity Flow

1. **Request:** An action (e.g., Split) flags `bRequiresQuantityInput = true`.
2. **Redirect:** Instead of executing immediately, the Action Menu calls `RequestQuantityInput`.
3. **Display:** The Quantity Prompt Widget opens, binding to `MinQuantity`, `MaxQuantity`, and `TargetItem`.
4. **Confirm:** When the user clicks "OK", the Prompt ViewModel fires `OnConfirmed`.
5. **Execute:** The Action Menu catches the event and finally calls `ExecuteActionWithQuantity`, passing the user's chosen number to the server.

#### How it Works

1. In your `GetAvailableActions`, set `bRequiresQuantity = true` on the action struct.
2. When `ExecuteAction` is called, the system detects this flag.
3. Instead of executing immediately, it **intercepts** the call.
4. It opens the **Quantity Prompt ViewModel** (`LyraQuantityPromptViewModel`).

#### The Prompt Widget

You need to create a widget for the prompt (Slider, Text Box, Confirm Button).

* **Bind:** To `QuantityPromptVM`.
* **Visibility:** Bind to `bIsVisible`.
* **Confirm:** Call `QuantityPromptVM->Confirm()`.
* **Cancel:** Call `QuantityPromptVM->Cancel()`.

The system handles the callback logic. When `Confirm()` is called, the original action (e.g., Split) is finally executed with the chosen quantity.

***

### Summary of Responsibilities

| Component            | Responsibility                                      |
| -------------------- | --------------------------------------------------- |
| **Item Fragment**    | Says "I _can_ be Used."                             |
| **Container**        | Says "You _may_ Use things here."                   |
| **ActionMenu VM**    | Collects the list and tracks Menu Visibility state. |
| **Your Widget**      | Draws the buttons and handles clicks.               |
| **Gameplay Ability** | Actually performs the logic (Healing, Equipping).   |
