# The Item Container Window Manager

While the **UI Manager (`LyraItemContainerWindowManager`)** handles the _logic_ of the UI (Data, Sessions, Permissions), the **Window Manager** handles the _physics_ of the UI.

It is a `GameInstanceSubsystem` that tracks the spatial existence of every item container window on the screen. It doesn't know what is _inside_ the windows, it just sees rectangles.

### Prerequisite Concepts

To understand how this manager routes input, we must first define the anatomy of a window in this system.

* The Window (Shell) & ID
  * The **Window** is the top-level container (the Chrome, Title Bar, Background). Every window is assigned a unique `FGuid` (Window ID) when it opens. The Manager uses this ID to track the window's position on the screen.
* The Panel
  * Windows are not monolithic. They are collections of **Panels**.
  * **Example:** An Inventory Window might have three panels:
    1. The Item Grid (Center).
    2. The Filter Tabs (Top).
    3. The Sort Button (Bottom).
  * A **Panel** is simply a specific, interactive region inside a window that can receive focus. Navigation always happens between _Panels_, even if you are jumping between _Windows_.
*   The Router (`LyraNavigationRouter`)

    * Every Window has exactly one **Router**. The Router acts as the local "Traffic Cop." It knows where every **Panel** is located _inside_ that specific window.

    > **The Hierarchy:**
    >
    > * **Window Manager:** Tracks all **Windows** on the desktop.
    > * **Router:** Tracks all **Panels** inside one Window.

{% hint style="info" %}
We will explore the implementation of Shells, Routers, and Panels in the "Windowing System" and "Navigation" chapters. For now, just understand this hierarchy.
{% endhint %}

***

### Responsibilities

#### The Virtual Desktop

The Canvas Panel in UMG is dumb. It doesn't know that "Window A is to the left of Window B." It just renders pixels.

The Window Manager builds a spatial map of the screen:

```cpp
struct FRegisteredItemContainerWindow
{
    FVector4 GeometryRect; // Left, Top, Right, Bottom
    TWeakObjectPtr<ULyraNavigationRouter> Router;
    double LastFocusedTime;
};
```

Every time a user drags a window, the `LyraItemContainerLayer` reports the new coordinates to this manager. This gives us a "God View" of the UI layout.

#### Z-Ordering (Focus Management)

When you click a window, it should come to the front. In UMG, you have to manually set Z-Order indices.

The Window Manager automates this:

1. **Selection:** When a window is clicked, `SetFocusedWindow(WindowId)` is called.
2. **Sorting:** The manager updates `LastFocusedTime` for that window.
3. **Broadcast:** It fires `OnWindowZOrderChanged`.
4. **Reaction:** The UI Layer receives this event and updates the Canvas Slot Z-Order for _every_ window based on their sorted timestamp.

This ensures a robust "Stacking" behavior identical to Windows or macOS.

#### The Navigation Bridge

The most critical job of the Window Manager is solving the **Gamepad Navigation** problem.

If you are pressing "Right" on a D-Pad inside the Inventory, and the Inventory ends... where does the cursor go?

* In standard UMG, it stops.
* In this system, it jumps to the neighboring window (e.g., the Equipment panel).

Because the Window Manager knows the geometry of _all_ windows, it can perform a **Global Raycast**:

1. **Source:** The geometry of the Inventory Window.
2. **Direction:** Right.
3. **Algorithm:** Find the nearest registered window rectangle in that direction (`FindGeometricNeighborWindow`).
4. **Result:** It returns the `NavigationRouter` of the target window, allowing focus to hop across the gap.

***

### Integration

You generally don't interact with this class directly unless you are building a custom windowing system. The `LyraItemContainerWindowShell` handles registration and updates automatically.

However, if you are building a custom HUD element (like a static hotbar) that you want to participate in cross-window navigation, you can register it manually:

```cpp
// In your custom widget
void UMyHotbar::Construct()
{
    GetWindowManager()->RegisterWindow(MyGuid, MyRouter, this);
}

// Used tick as an example but you should call `UpdateWindowGeometryFromBox` when the widget moves.
// Hotbars aren't typically draggable and they don't move during gameplay, so you would
// only need to call the function once for something like that.
void UMyHotbar::Tick(FGeometry MyGeometry, float InDeltaTime)
{
    // Keep geometry updated so other windows can "find" me
    GetWindowManager()->UpdateWindowGeometryFromBox(MyGuid, MyGeometry.GetRenderBoundingRect());
}
```
