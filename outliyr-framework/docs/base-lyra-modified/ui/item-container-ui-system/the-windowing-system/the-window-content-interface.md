# The Window Content Interface

The **Window Shell** handles the frame (the chrome), but your widget (the Inventory Grid, the Skill Tree, or the Loot List) handles the actual game logic.

To bridge the gap between the generic Shell and your specific Widget, we use a "Handshake" mechanism called the **`ILyraItemContainerWindowContentInterface`**.

### Why an Interface?

f you simply spawned a widget and added it to the Shell, the widget wouldn't know which inventory to look at or how to handle gamepad navigation.

We use an interface because:

1. **Decoupling:** The Shell doesn't need to know if it's holding an Inventory or a Talent Tree. It just knows it's holding "Content."
2. **Order of Operations:** UMG's built-in Construct event happens too early. At construction time, widgets often don't have their data or their size/geometry yet. The interface provides a specific **Initialization Timeline**.

```cpp
class ILyraItemContainerWindowContentInterface
{
public:
    /** 1. Here is your data. Go get your ViewModel. */
    UFUNCTION(BlueprintNativeEvent)
    void SetContainerSource(const FInstancedStruct& Source);

    /** 2. Here is your router. Register your navigation panels. */
    UFUNCTION(BlueprintNativeEvent)
    void SetWindowRouter(ULyraNavigationRouter* Router);

    /** 3. The window is ready. Calculate your layout geometry. */
    UFUNCTION(BlueprintNativeEvent)
    void FinalizeWindowContent(UWidget* WindowRootWidget);
};
```

### Implementing in Blueprint

Here is the standard pattern for implementing this interface in your Widget.

#### 1. `SetContainerSource`

This is your "Construct" event. The source context passed into the `FItemWindowRequest` `SourceDesc` is what gets passed through here. Pass the necessary information to initialize the widget

* **Action:** Call `GetOwningWindowShell` -> `AcquireViewModelLease`.
* **Binding:** Take the returned ViewModel and bind it use it to populate your widget content.

<figure><img src="../../../../.gitbook/assets/image (22).png" alt=""><figcaption></figcaption></figure>

{% hint style="success" %}
Design tip: Pass the `ContainerSourceBase` FInstanceStruct to the `FItemWindowQuest` .The view model can be made directly from it.
{% endhint %}

#### 2. `SetWindowRouter`

This connects your widget to the **Navigation System**.

* **Logic:** The Shell creates a `ULyraNavigationRouter` (the "Traffic Cop" for focus) and hands it to your widget.
* **Note:** You should store this reference. In the[ **Geometric Navigation**](../geometric-navigation/) section, we will explain how to use this router to define interactive areas. For now, just think of it as the "GPS" for your window.

<figure><img src="../../../../.gitbook/assets/image (21).png" alt=""><figcaption></figcaption></figure>

{% hint style="success" %}
Navigation is explored in more detail in the [Geometric Navigation](../geometric-navigation/) section
{% endhint %}

#### 3. `FinalizeWindowContent`

This is the most important step for complex layouts.

* **The Problem:** In Unreal, a widget doesn't know its own height or width until it has been added to the screen and a "Layout Pass" has occurred.
* **The Solution:** The Shell calls this function after the widget is physically on the canvas.
* **Logic:** This is the safe place to calculate geometry-dependent logic, such as telling the system exactly where your buttons are located in screen space.

<figure><img src="../../../../.gitbook/assets/image (23).png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../../../.gitbook/assets/image (25).png" alt=""><figcaption></figcaption></figure>

{% hint style="success" %}
**Why use the Lease API?**\
By using AcquireViewModelLease inside the Shell instead of calling the UI Manager directly, you ensure that your data is automatically cleaned up when the window closes. You don't have to write a single line of "Cleanup" code in your content widget.
{% endhint %}
