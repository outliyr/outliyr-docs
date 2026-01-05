# Z-Order & Focus Management

In a windowed interface, the "Active" window must always be on top. Unreal's UMG Canvas Panel allows manual Z-Order setting, but it doesn't automate the logic of "Stacking."

The Window Manager implements a robust sorting algorithm based on **Recency**.

### The Algorithm: "Last Touched is Topmost"

We don't use arbitrary priority tiers. Instead, we use `LastFocusedTime`.

Every time a window is clicked or navigated to via gamepad, we update its timestamp:

```cpp
void ULyraItemContainerWindowManager::SetFocusedWindow(FGuid WindowId)
{
    if (FRegisteredItemContainerWindow* Window = RegisteredWindows.Find(WindowId))
    {
        // Update timestamp to "Now"
        Window->LastFocusedTime = FPlatformTime::Seconds();
    }
    
    // Trigger a re-sort
    BroadcastZOrderUpdate();
}
```

This simple logic guarantees a predictable stack:

1. Window A (Opened at T=10)
2. Window B (Opened at T=20)
3. Window A (Clicked at T=30) -> **Moves to Top**

### Broadcasting the Update

The Window Manager doesn't manipulate widgets directly. It calculates the desired order and tells the UI Layer what to do.

```cpp
void ULyraItemContainerWindowManager::BroadcastZOrderUpdate()
{
    // 1. Get all window IDs
    TArray<FGuid> SortedKeys;
    RegisteredWindows.GenerateKeyArray(SortedKeys);

    // 2. Sort by Time (Oldest -> Newest)
    SortedKeys.Sort([this](const FGuid& A, const FGuid& B) {
        return RegisteredWindows[A].LastFocusedTime < RegisteredWindows[B].LastFocusedTime;
    });

    // 3. Assign Indices (0 = Bottom, N = Top)
    for (int32 i = 0; i < SortedKeys.Num(); ++i)
    {
        // Tell the Layer: "Window X should be at Z-Order i"
        OnWindowZOrderChanged.Broadcast(SortedKeys[i], i);
    }
}
```

The `LyraItemContainerLayer` listens to this delegate and updates the actual `UCanvasPanelSlot`:

```cpp
void ULyraItemContainerLayer::HandleWindowZOrderChanged(FGuid WindowId, int32 NewZOrder)
{
    if (UCanvasPanelSlot* Slot = WindowSlots.FindRef(WindowId))
    {
        Slot->SetZOrder(NewZOrder);
    }
}
```

### Focus Transfer

Changing visual order is easy. Changing logical focus is harder.

When `SetFocusedWindow` is called, it fires the `OnWindowFocusChanged` delegate. The Layer listens for this but doesn't force widget focus immediately. Why?

**The "Focus Stealing" Problem:** If you are typing in a search bar inside Window A, and Window B pops up (notification), you don't want your keyboard focus ripped away immediately unless explicitly requested.

This system is designed so that `SetFocusedWindow` marks the **Intent**.

* **Mouse Click:** The click itself grants widget focus; `SetFocusedWindow` just handles the visual lift.
* **Gamepad Navigation:** The Navigation Router handles the widget focus transfer; `SetFocusedWindow` follows up to update the visuals.

### Bring to Front

Sometimes you want to raise a window without giving it input focus (e.g., hovering over a window during a drag operation).

We expose `BringWindowToFront(WindowId)`. This updates the timestamp and rebroadcasts the Z-Order **without** changing `FocusedWindowId`. This is crucial for drag-and-drop operations where you want the target window to pop to the front, but you want the _dragged item_ to keep the focus.
