# Customization & Advanced Topics

The indicator system is designed to be extended without touching the core projection or rendering code. This page covers the main extension points and performance considerations.

***

## Passing Custom Data to Widgets

The `DataObject` property on `UIndicatorDescriptor` is a generic `UObject*` slot that your widget can access after casting. Two patterns are common:

### Pattern 1: The Game Entity Itself

Set the actor, that the indicator represents as the `DataObject`. The widget casts it and queries live state directly.

{% stepper %}
{% step %}
**Define an Interface (recommended)**

Create a Blueprint Interface (e.g., `BPI_IndicatorDataSource`) with functions like `GetDisplayName()`, `GetCurrentHealth()`, or `GetInteractionPromptText()`. This keeps your widget decoupled from specific actor classes.
{% endstep %}

{% step %}
**Implement on Your Actor**

The objective actor, enemy pawn, or interactive item implements the interface and returns its live data.
{% endstep %}

{% step %}
**Set the DataObject**

```cpp
IndicatorDescriptor->SetDataObject(MyObjectiveActor);
```
{% endstep %}

{% step %}
**Read from the Widget**

In your widget's `BindIndicator`, get the `DataObject`, check if it implements the interface, and query it:

```cpp
UObject* Data = Descriptor->GetDataObject();
if (Data && Data->GetClass()->ImplementsInterface(UBPI_IndicatorDataSource::StaticClass()))
{
    FText Name = IBPI_IndicatorDataSource::Execute_GetDisplayName(Data);
    NameTextBlock->SetText(Name);
}
```

The widget can also query the `DataObject` on tick for live updates (health bars, status changes).
{% endstep %}
{% endstepper %}

{% tabs %}
{% tab title="Passing the data object" %}
<figure><img src="../../../.gitbook/assets/image (5) (1).png" alt=""><figcaption><p>Example passing the control point actor as an indicator</p></figcaption></figure>
{% endtab %}

{% tab title="Using the data object in widget" %}
<figure><img src="../../../.gitbook/assets/image (6) (1).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

### Pattern 2: A Dedicated Data Payload

Create a custom `UObject` (e.g., `UMyIndicatorPayload`) that holds snapshot data. Populate it when creating the descriptor, set it as the `DataObject`, and cast in the widget. This is simpler when you don't need two-way communication or live updates.

***

## Subclassing `UIndicatorDescriptor`

If the `DataObject` pattern isn't sufficient, for example, you need new functions directly on the descriptor or tightly coupled custom behavior, create a C++ subclass:

1. Inherit from `UIndicatorDescriptor`
2. Add properties and functions
3. Instantiate your subclass instead of the base class when creating indicators
4. Cast in the widget's `BindIndicator` to access the extensions

Use this sparingly, `DataObject` handles most cases without adding new descriptor types.

***

## Custom Projection Modes

The `FIndicatorProjection::Project` method contains a `switch` over `EActorCanvasProjectionMode`. To add a new mode:

1. Add an entry to the `EActorCanvasProjectionMode` enum
2. Add a `case` in `FIndicatorProjection::Project` with your custom math
3. Use the new mode on descriptors

Keep projection logic performant, it runs for every visible indicator every frame. Prefer the simplest mode that meets your needs (`ComponentPoint` is fastest).

***

## Performance Considerations

The system handles widget pooling and efficient Slate rendering automatically, but these factors can still affect performance at scale:

| Factor                          | Impact                                                         | Mitigation                                                                                          |
| ------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Number of active indicators** | Each visible indicator undergoes projection + layout per frame | Add only when needed, remove promptly. Use `bAutoRemoveWhenIndicatorComponentIsNull`.               |
| **Widget complexity**           | Heavy UMG widgets with many elements or tick logic are costly  | Keep indicator widgets simple. Prefer event-driven updates over tick.                               |
| **Projection mode**             | Bounding box modes cost more than `ComponentPoint`             | Use the simplest mode that works                                                                    |
| **Draw order**                  | `bDrawIndicatorWidgetsInOrder = true` breaks Slate batching    | Leave `false` (default) unless you have confirmed Z-fighting issues that priority/depth can't solve |
| **Update frequency**            | Canvas updates every frame by default                          | For extreme indicator counts, the timer interval could be increased, but this is an advanced change |

Widget pooling via `FUserWidgetPool` is automatic, the canvas reuses instances rather than creating and destroying them. No configuration needed.
