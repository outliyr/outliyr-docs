# Practical Usage & How-To Guides

This page walks through the hands-on side of the indicator system, setting up your HUD, creating indicator types, and common configurations for real gameplay scenarios.

***

## Prerequisite: Adding the Indicator Layer to Your HUD

Before any indicators can appear, your HUD needs a `UIndicatorLayer` widget. This layer hosts the `SActorCanvas` that handles all rendering.

{% stepper %}
{% step %}
**Add the Widget**

Open your primary HUD UMG Blueprint. Search the palette for `Indicator Layer` and drag it onto the canvas.
{% endstep %}

{% step %}
**Size It to Fill the Screen**

Anchor the layer to all sides (fill) within a `Canvas Panel`. Indicators are projected onto the full viewport, so the layer needs to cover the entire screen. If you constrain it to a smaller area, indicators outside those bounds will be clipped.
{% endstep %}

{% step %}
**(Optional) Customize the Arrow**

Select the `IndicatorLayer` and change its `ArrowBrush` property in the Details panel to match your game's art style. This brush is used for the screen-edge arrow when indicators are clamped.
{% endstep %}
{% endstepper %}

{% tabs %}
{% tab title="Adding indicator layer" %}
<figure><img src="../../../.gitbook/assets/image (3) (1).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Customize the arrow property" %}
<figure><img src="../../../.gitbook/assets/image (7) (1).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

***

## Creating a New Indicator Type

Let's create a "Quest Marker" indicator from scratch.

{% stepper %}
{% step %}
**Design the UMG Widget**

Create a new `UserWidget` Blueprint (e.g., `W_QuestIndicator`). In Class Settings, add `IndicatorWidgetInterface` to the Interfaces list. Design your visuals, an icon image, a name text block, a distance label, etc.

Then implement the four interface events:

**`BindIndicator`** — called when the widget is paired with a descriptor. Store the descriptor reference and initialize your visuals from it (or from its `DataObject`).

**`UnbindIndicator`** — clear any stored references.

**`OnIndicatorClamped`** — receives `bIsClamped`. Change appearance when the indicator is pushed to the screen edge (e.g., hide detail text, show a directional chevron).

**`OnIndicatorDisplayModeChanged`** — receives `IsScreenLocked`. Adjust visuals when switching between 3D world-tracking and 2D screen-locked mode (e.g., hide distance text when screen-locked).

{% tabs %}
{% tab title="Bind Indicator" %}
<figure><img src="../../../.gitbook/assets/image (29) (1).png" alt="" width="563"><figcaption><p>Example of <code>WBP_QuestIndicator</code> bind indicator</p></figcaption></figure>


{% endtab %}

{% tab title="On Indicator Clamped" %}
<figure><img src="../../../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" width="563"><figcaption><p>Example of changing widget apperance based on clamping</p></figcaption></figure>
{% endtab %}

{% tab title="On Indicator Display Mode Changed" %}
<figure><img src="../../../.gitbook/assets/image (3) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption><p>Domination objective marker handling display mode changes</p></figcaption></figure>
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Spawn and Register the Indicator**

Wherever your game logic decides an indicator should appear (quest activation, enemy spawn, objective created), create a descriptor and register it:

{% tabs %}
{% tab title="Blueprint" %}
<figure><img src="../../../.gitbook/assets/image (8) (1).png" alt=""><figcaption><p>Example creating an indicator for a kill confirmed dog tag</p></figcaption></figure>
{% endtab %}

{% tab title="C++" %}
```cpp
// Get the player's indicator manager
ULyraIndicatorManagerComponent* Manager =
    ULyraIndicatorManagerComponent::GetComponent(PlayerController);

// Create and configure the descriptor
UIndicatorDescriptor* Descriptor = NewObject<UIndicatorDescriptor>(Manager);
Descriptor->SetSceneComponent(QuestActor->GetRootComponent());
Descriptor->SetIndicatorClass(W_QuestIndicator::StaticClass());
Descriptor->SetProjectionMode(EActorCanvasProjectionMode::ComponentPoint);
Descriptor->SetClampToScreen(true);
Descriptor->SetShowClampToScreenArrow(true);
Descriptor->SetAutoRemoveWhenIndicatorComponentIsNull(true);

// Optional: attach custom data for the widget to read
Descriptor->SetDataObject(QuestDataObject);

// Register it
Manager->AddIndicator(Descriptor);
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
**Remove When No Longer Needed**

When the indicator should disappear:

```cpp
Descriptor->UnregisterIndicator();
```

If `bAutoRemoveWhenIndicatorComponentIsNull` was set to `true`, the indicator removes itself automatically when the target component or actor is destroyed.
{% endstep %}
{% endstepper %}

***

## Common Configurations

### Off-Screen Enemy Indicator

Track an enemy with screen-edge clamping and a directional arrow. The widget changes appearance when clamped (e.g., switches to a threat chevron).

| Setting         | Value                                      |
| --------------- | ------------------------------------------ |
| Target          | Enemy's capsule component or a head socket |
| Projection Mode | `ComponentPoint`                           |
| Clamp to Screen | `true`                                     |
| Show Arrow      | `true`                                     |
| Widget Logic    | `OnIndicatorClamped` swaps icon/color      |

### Temporary Ping

A world-space ping that fades after a few seconds.

| Setting         | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| Target          | Scene component at the ping world location                      |
| Projection Mode | `ComponentPoint`                                                |
| Clamp to Screen | `true`                                                          |
| Lifetime        | Use a timer to call `UnregisterIndicator()` after a few seconds |

To make it screen-locked instead (e.g., from a minimap click), call `SetScreenLockedPosition()` with normalized screen coords, then `SwitchTo2DMode()`.

### Socket-Attached Indicator

Track a specific bone/socket on a skeletal mesh (e.g., a nameplate above a character's head).

| Setting         | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Target          | The `SkeletalMeshComponent`                               |
| Socket Name     | `"headSocket"`                                            |
| Projection Mode | `ComponentPoint` (uses the socket location automatically) |

### Dynamic Objective (3D ↔ 2D Switching)

An objective marker that tracks a world location normally, but snaps to a fixed HUD position when the player enters the capture zone.

{% stepper %}
{% step %}
#### **Initial Setup**

Create the indicator targeting the control point actor with `ComponentPoint` projection, clamping enabled. The widget shows capture progress, faction icon, and distance.
{% endstep %}

{% step %}
#### **Player Enters Zone**

When the overlap triggers:

```cpp
Descriptor->SetScreenLockedPosition(FVector2D(0.5f, 0.1f)); // top-center
Descriptor->SwitchTo2DMode();
```

The widget receives `OnIndicatorDisplayModeChanged(true)` and can enlarge itself, show detailed capture progress, and hide the distance text.
{% endstep %}

{% step %}
#### **Player Exits Zone**

```cpp
Descriptor->SwitchTo3DMode();
```

The original projection mode is restored. The widget receives `OnIndicatorDisplayModeChanged(false)` and reverts to its compact world-tracking appearance.
{% endstep %}
{% endstepper %}

***

## Debugging Indicators

#### **Unreal's Widget Reflector:**

Access via `Shift+F1` then click the arrow icon, or from the main menu: Tools -> Debug -> Widget Reflector.

Hover over your indicators on screen to see their UMG widget hierarchy, properties, and the underlying Slate structure (`SActorCanvas`, `SBox` for the UMG host, etc.). This is invaluable for checking alignment, visibility, and widget properties.

#### **Visual Log / Gameplay Debugger:**

You can extend the Gameplay Debugger or use the Visual Logger to draw debug information related to indicators:

* Draw a sphere at the `SceneComponent`'s location.
* If using bounding box projection, draw the actual bounding box being used.
* Draw a line from the camera to the projected screen point.

#### **Print Strings / Breakpoints:**

In `UIndicatorDescriptor` functions (like `SwitchTo2DMode`), `SActorCanvas::UpdateCanvas` / `OnArrangeChildren`, or your UMG widget's interface events, add print strings or breakpoints to trace the flow of execution and inspect variable values.

Check the screen coordinates being calculated in `FIndicatorProjection::Project` or `SActorCanvas::UpdateCanvas`.

#### **Check `SActorCanvas` Children:**

In the debugger, inspect the `CanvasChildren` array within `SActorCanvas` to see if your indicator's slot is present and its properties (`ScreenPosition`, `bIsIndicatorVisible`, etc.) are as expected.

#### **Verify `ULyraIndicatorManagerComponent`:**

Ensure the manager component is valid on your controller and that your `UIndicatorDescriptor` is present in its `Indicators` array after calling `AddIndicator`.

***

