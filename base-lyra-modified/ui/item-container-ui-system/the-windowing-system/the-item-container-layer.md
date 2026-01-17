# The Item Container Layer

The Container Layer is the visual root of the entire windowing system. It is a `CommonActivatableWidget` that you push onto your UI stack (usually as part of your HUD).

The Layer is the Orchestrator: it spawns windows, manages their z-order, handles dragging, and coordinates cross-window navigation.

### Core Responsibilities

{% stepper %}
{% step %}
#### The Spawning Registry (`GetContentWidgetClass`)

When an ability or another window requests a new window via a Gameplay Tag, the Layer acts as a lookup table. It needs to know which Blueprint widget matches that tag.

Implementation:

* In your Blueprint subclass (e.g., `W_ItemContainerLayer`), override `GetContentWidgetClassForWindowType`.
* Input: A Gameplay Tag (e.g., `UI.Window.Inventory.Backpack`).
* Output: A Widget Class (e.g., `W_BackpackContent`).

> [!INFO]
> Design Tip: Using Gameplay Tags for routing allows you to swap your entire UI look-and-feel just by changing the return values in this function, without touching any C++ logic or Ability code.
{% endstep %}

{% step %}
#### Initializing the HUD (`SpawnMandatoryWindows`)

When the Inventory UI is first activated, the screen is empty. The Layer is responsible for the "Boot Sequence."

Immediately after activation, the UI Manager triggers the `SpawnMandatoryWindows` event. Override this in Blueprint to define your "Home" UI layout.

Standard sequence:

{% stepper %}
{% step %}
Define an `FItemWindowSpec`.
{% endstep %}

{% step %}
Set the `WindowType` to `UI.Window.Inventory`.
{% endstep %}

{% step %}
Set `bCanUserClose` to `false` (to keep the main inventory pinned).
{% endstep %}

{% step %}
Call `OpenWindow(Spec)`.
{% endstep %}
{% endstepper %}
{% endstep %}

{% step %}
#### Auto-Placement Logic

When a window opens without a specific position, the Layer calls `CalculateAutoPosition`.

* Default Behavior: Uses a "Cascade" algorithm (shifting each new window slightly down and to the right).
* Override: You can override this in Blueprint to create specialized layouts (e.g., "Always snap loot containers to the left half of the screen").
{% endstep %}

{% step %}
#### The Backdrop (Input Dismissal)

Since the Layer is a root-level widget covering the screen, it acts as a "Catch-All" for mouse clicks.

The system listens for clicks on the "empty space" behind windows. When you click the background, the Layer automatically dismisses active popups (Action Menus, Quantity Prompts), matching standard PC desktop behavior.
{% endstep %}
{% endstepper %}

### Z-Order and Focus Management

The Layer tracks when each window was last focused and uses this to manage z-order.

#### Focus Time Tracking

```cpp
// Each window has a timestamp for when it was last focused
TMap<FGuid, double> WindowFocusTimes;
```

#### Z-Order Updates

When a window is focused (clicked, navigated to, or opened), the Layer:

1. Updates the window's focus timestamp.
2. Recalculates z-order for all windows based on timestamps.
3. Updates the `UCanvasPanelSlot::ZOrder` for each window.

```cpp
void ULyraItemContainerLayer::FocusWindow(FItemWindowHandle WindowHandle)
{
    // Update focus timestamp
    WindowFocusTimes.Add(WindowHandle.WindowId, FPlatformTime::Seconds());

    // Recalculate z-order for all windows
    UpdateAllWindowZOrders();

    // Focus the content
    if (ULyraItemContainerWindowShell* Shell = ActiveWindows.FindRef(WindowHandle.WindowId))
    {
        Shell->RequestContentFocus();
    }
}
```

#### Getting Focused Window

```cpp
FItemWindowHandle ULyraItemContainerLayer::GetFocusedWindow() const;
TArray<FItemWindowHandle> ULyraItemContainerLayer::GetWindowsByFocusOrder() const;
```

***

### Cross-Window Navigation

The Layer intercepts navigation events and coordinates focus transfer between windows.

#### Navigation Interception

The Layer overrides `NativeOnNavigation` to catch escaped navigation:

```cpp
FNavigationReply ULyraItemContainerLayer::NativeOnNavigation(
    const FGeometry& MyGeometry,
    const FNavigationEvent& InNavigationEvent,
    const FNavigationReply& InDefaultReply)
{
    // Check if navigation escaped from focused window
    if (FocusedWindowId.IsValid() &&
        InDefaultReply.GetBoundaryRule() == EUINavigationRule::Escape)
    {
        FVector2D CursorScreenPos = GetFocusedWindowCursorPosition();
        FItemWindowHandle Target = FindWindowInDirection(
            FItemWindowHandle(FocusedWindowId),
            InNavigationEvent.GetNavigationType(),
            CursorScreenPos);

        if (Target.IsValid())
        {
            SetPendingNavigationContext(InNavigationEvent.GetNavigationType(), CursorScreenPos);
            FocusWindow(Target);
            return FNavigationReply::Stop();
        }
    }

    return Super::NativeOnNavigation(...);
}
```

#### Geometric Window Search

`FindWindowInDirection` uses a scoring algorithm to find the best target window:

```cpp
FItemWindowHandle ULyraItemContainerLayer::FindWindowInDirection(
    FItemWindowHandle FromWindow,
    EUINavigation Direction,
    FVector2D CursorScreenPos) const;
```

The algorithm:

1. Filters to windows in the requested direction.
2. Scores each window by distance + perpendicular offset.
3. Returns the window with the lowest score.

See [Geometric Algorithm](../geometric-navigation/geometric-algorithm.md) for details.

#### Pending Navigation Context

When transferring focus, the Layer stores context for cursor alignment:

```cpp
void ULyraItemContainerLayer::SetPendingNavigationContext(
    EUINavigation Direction,
    FVector2D CursorPos);

bool ULyraItemContainerLayer::ConsumePendingNavigationContext(
    EUINavigation& OutDirection,
    FVector2D& OutCursorPos);
```

This allows the target window to position its cursor appropriately based on where navigation came from.

#### Getting Cursor Position

```cpp
FVector2D ULyraItemContainerLayer::GetFocusedWindowCursorPosition() const
{
    if (ULyraItemContainerWindowShell* Shell = ActiveWindows.FindRef(FocusedWindowId))
    {
        FVector2D CursorPos;
        if (Shell->GetContentCursorScreenPosition(CursorPos))
        {
            return CursorPos;
        }
        // Fallback to window center
        return Shell->GetCachedGeometry().GetAbsolutePositionAtCoordinates(FVector2D(0.5f, 0.5f));
    }
    return FVector2D::ZeroVector;
}
```

***

### Window Cycling (Shoulder Buttons)

The Layer handles LB/RB input for cycling between windows:

```cpp
FReply ULyraItemContainerLayer::NativeOnKeyDown(
    const FGeometry& InGeometry,
    const FKeyEvent& InKeyEvent)
{
    if (InKeyEvent.GetKey() == EKeys::Gamepad_LeftShoulder)
    {
        CycleFocusedWindow(false);  // Previous
        return FReply::Handled();
    }
    if (InKeyEvent.GetKey() == EKeys::Gamepad_RightShoulder)
    {
        CycleFocusedWindow(true);   // Next
        return FReply::Handled();
    }
    return Super::NativeOnKeyDown(InGeometry, InKeyEvent);
}

void ULyraItemContainerLayer::CycleFocusedWindow(bool bForward);
```

Windows are cycled in focus order (oldest to newest), with wrapping at the ends.

#### Window Dragging

The Layer handles window drag operations:

```cpp
void ULyraItemContainerLayer::BeginWindowDrag(FItemWindowHandle WindowHandle, FVector2D StartPosition);
void ULyraItemContainerLayer::UpdateWindowDrag(FVector2D CurrentPosition);
void ULyraItemContainerLayer::EndWindowDrag();
```

During dragging:

* The dragged window is brought to front.
* Position is clamped to canvas bounds.
* Coordinates are translated between screen and canvas local space.

### Public API Summary

#### Window Lifecycle

| Method                                | Description                       |
| ------------------------------------- | --------------------------------- |
| `OpenWindow(FItemWindowSpec)`         | Create and display a new window   |
| `CloseWindow(Handle, Reason)`         | Close a specific window           |
| `CloseSession(SessionHandle, Reason)` | Close all windows in a session    |
| `GetWindowShell(Handle)`              | Get the shell widget for a window |
| `GetOpenWindows()`                    | Get all open window handles       |
| `IsWindowOpen(Handle)`                | Check if a window is open         |

#### Focus and Navigation

| Method                         | Description                         |
| ------------------------------ | ----------------------------------- |
| `FocusWindow(Handle)`          | Focus a window and bring to front   |
| `GetFocusedWindow()`           | Get the currently focused window    |
| `GetWindowsByFocusOrder()`     | Get windows sorted by focus time    |
| `CycleFocusedWindow(bForward)` | Cycle to next/previous window       |
| `FindWindowInDirection(...)`   | Find neighbor window for navigation |

#### Drag Operations

| Method                  | Description             |
| ----------------------- | ----------------------- |
| `BeginWindowDrag(...)`  | Start dragging a window |
| `UpdateWindowDrag(...)` | Update drag position    |
| `EndWindowDrag()`       | End the drag operation  |

***

### Setup Checklist

To get the windowing system running:

1. Subclass `ULyraItemContainerLayer` in Blueprint.
2. Bind your `WindowCanvas` (a Canvas Panel) in the widget designer.
3. Implement the Tag-to-Class mapping in `GetContentWidgetClassForWindowType`.
4. Define your default layout in `SpawnMandatoryWindows`.
5. Push the Layer widget onto your UI stack when opening inventory.
