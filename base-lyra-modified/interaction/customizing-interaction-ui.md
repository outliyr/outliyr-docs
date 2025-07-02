# Customizing Interaction UI

The interaction system supports powerful and flexible UI prompts for showing interaction options to the player. These UI prompts, whether the default or custom, are **spawned dynamically** based on the data provided by each interaction option.

This page walks through how the interaction prompt widgets are created, what data they receive, and how you can create your own custom widget for unique visual styles or logic.

***

### How Prompt Widgets Are Spawned

Every interaction option returned by an interactable can define its own UI via:

```cpp
InteractionWidgetClass = MyCustomWidget;
```

If no custom widget is provided, the system will use a **default interaction prompt**, which already supports:

* Input icon (keyboard/controller)
* Title and subtext display
* Hold progress (for delayed interactions)

This widget appears at a 3D world location (typically above the object or a specified component) and follows the camera using screen projection.

***

### The Role of `ULyraIndicatorManagerComponent`

The UI prompts are not spawned directly by the interaction system. Instead, they are managed by a shared component:\
&#xNAN;**`ULyraIndicatorManagerComponent`**.

This system handles:

* Converting world-space positions into UI overlays
* Managing when prompts are shown or removed
* Handling other types of indicators (like objectives or pings)

> [!info]
> For a deeper understanding of how this overlay system works, refer to the dedicated page:\
> [**Lyra Indicator System**](../ui/lyra-indicator-system/)\
> &#xNAN;_(I recommend reading that page before attempting to customize the interaction prompt widgets, then returning here.)_

***

### Data Passed to the Widget

Each interaction prompt receives a data object:

```cpp
UInteractionDataObject
```

This object contains:

| Property            | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `InteractableActor` | The actor that the player is interacting with                  |
| `InteractionOption` | The full `FInteractionOption` struct defining this interaction |

This data is assigned to the indicator using `SetDataObject`, and the widget is expected to implement:

```cpp
IIndicatorWidgetInterface
```

This interface allows the widget to **bind and extract information** from the provided data object.

<img src=".gitbook/assets/image (143).png" alt="" title="Blueprint of a widget implementing IIndicatorWidgetInterface and extracting information from InteractionDataObject">

***

### Where the Prompt Appears

The prompt is positioned in 3D space based on:

```cpp
InteractionWidgetComponent
```

If this is set in the `FInteractionOption`, the UI will anchor to that specific component. If not, it defaults to the root component of the interactable actor.

This allows for precise control, for example:

* Attach to a button on a panel
* Attach to a loot crate lid
* Attach to a specific point on an NPC

***

### Summary

* Each interaction option can define its own prompt widget, or fall back to a powerful default.
* The widget is managed by the [**Lyra Indicator System**](../ui/lyra-indicator-system/), which handles screen projection.
* The widget receives a `UInteractionDataObject`, containing the interactable and its `FInteractionOption`.
* The widget must implement `IIndicatorWidgetInterface` to bind this data.
* Prompts are positioned using either a specific component or the actor root.
