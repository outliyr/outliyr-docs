# Extending the Lyra Interaction System

The Lyra Interaction System is built to be modular and opt-in. Once you're comfortable using `FInteractionOption`, creating interactables, and customizing UI prompts, you may want to go further, adding new interaction types, altering the behavior pipeline, or integrating other systems.

This page outlines key extension points and examples of how to push the system further without breaking its modularity.

***

### Adding New Interaction Types

Instead of returning a single `FInteractionOption` from `GatherInteractionOptions`, an actor can return **multiple distinct options**, each representing a different type of interaction.

#### Examples:

* A chest that offers both "Open" and "Inspect"
* A terminal with "Hack", "Upload", and "Download"
* An NPC that supports "Talk" and "Trade"

You can use gameplay tags or gameplay state to conditionally enable/disable certain options.

***

### Conditional Logic in `GatherInteractionOptions`

You can dynamically generate interaction options based on:

* Player inventory
* Player team or faction
* Time of day or world state
* Actor-specific flags (e.g., "isLocked", "hasPower")

```cpp
if (bIsLocked)
{
    // Return "Unlock" instead of "Open"
}
```

You can also omit returning any options if the actor shouldn’t be interactable at that moment.

***

### Customizing the Event Payload

To modify what happens during the interaction, or redirect it to another actor, override:

```cpp
void CustomizeInteractionEventData(const FGameplayTag& EventTag, FGameplayEventData& InOutEventData)
```

#### Use cases:

* Forward interaction from a switch to a door
* Add metadata like key ID or terminal ID
* Override the target for a more complex chain reaction

This is your hook to customize GAS behavior at runtime.

***

### Creating Specialized Interaction Widgets

You can create unique UMG widgets for different interaction types or categories. These widgets:

* Still receive `UInteractionDataObject`
* Still use `IIndicatorWidgetInterface`
* Can display specialized visuals, icons, or tooltips

#### Example:

* A different UI for NPCs vs. loot
* Widgets that show durability or fuel levels
* Contextual button prompts based on platform or input device

> [!success]
> Use gameplay tags on the interaction option or actor to select different widget classes dynamically.

***

### Integrating With Other Systems

Because interactions use GAS and gameplay events, they integrate well with:

* **Inventory systems** (e.g., picking up items)
* **Objectives** (e.g., interacting with a quest item)
* **Crafting systems** (e.g., workbenches)
* **Dialogue systems** (e.g., NPC conversation starters)

You can build your own `UGameplayAbility` subclasses that encapsulate the specific logic you need and trigger them via `FInteractionOption`.

***

### Creating Interaction Menus

In cases where multiple interactions are possible, you can present the options in a **custom menu**. To support this, implement the `IInteractionInstigator` interface on your pawn or controller:

```cpp
FInteractionOption ChooseBestInteractionOption(const FInteractionQuery& Query, const TArray<FInteractionOption>& Options);
```

This allows you to:

* Open a UI and let the player choose
* Select the most contextually relevant option
* Filter based on custom rules

> [!info]
> This approach is ideal for multi-purpose terminals, NPCs, or densely interactive areas.

***

### Using Gameplay Tags

If your interaction options need to react to gameplay state or other temporary data, consider attaching gameplay tags to:

* The player’s ASC
* The interactable’s ASC
* The `FGameplayEventData` payload

This allows your GAS abilities to branch and react cleanly to context (e.g., “`Player.HasHackingToo`l” or “`Interaction.RequiresClearanceLevel.2`”).

***

### Replacing the Core Ability

The system uses `ULyraGameplayAbility_Interact` by default to:

* Track nearby interactables
* Display UI prompts
* Trigger the selected interaction

You can subclass it to:

* Use a different detection method
* Override how options are prioritized
* Integrate with your own interaction menus or radial selectors
* Change how cooldowns or input handling works

Just assign your custom ability in the player's granted abilities or inventory item.

***

### Summary: Extension Entry Points

| Extension                 | How                                      |
| ------------------------- | ---------------------------------------- |
| Add new interaction types | Return multiple `FInteractionOption`s    |
| Change prompt behavior    | Customize the widget class               |
| Redirect the logic        | Override `CustomizeInteractionEventData` |
| Add interaction menus     | Implement `IInteractionInstigator`       |
| Build custom logic        | Create new GAS abilities                 |
| Integrate systems         | Use gameplay events and payloads         |
