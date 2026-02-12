# cursor alignment

When navigating between windows, users expect the cursor to maintain spatial consistency. If you're on the third row of inventory and press Right into an equipment panel, the cursor should land near that same vertical position, not jump to the top.

This page explains how the **content interface methods** enable cursor alignment across windows.

#### The Alignment Problem

Without alignment, cross-window navigation feels jarring:

```
                         Before (Bad)
                   User presses D-Pad RIGHT
                   ─────────────────────────►

┌───────────────────────┐        ┌───────────────────────┐
│   Source Window       │        │   Target Window       │
│                       │        │                       │
│   [ ] [ ] [ ] [ ]     │        │   [X] [ ] [ ] [ ]     │  ← Jumped to top!
│   [ ] [ ] [ ] [ ]     │        │   [ ] [ ] [ ] [ ]     │
│   [ ] [ ] [X] [ ]     │        │   [ ] [ ] [ ] [ ]     │
│   [ ] [ ] [ ] [ ]     │        │   [ ] [ ] [ ] [ ]     │
│                       │        │                       │
└───────────────────────┘        └───────────────────────┘
```

With alignment, navigation feels natural:

```
                         After (Good)
                   User presses D-Pad RIGHT
                   ─────────────────────────►

┌───────────────────────┐        ┌───────────────────────┐
│   Source Window       │        │   Target Window       │
│                       │        │                       │
│   [ ] [ ] [ ] [ ]     │        │   [ ] [ ] [ ] [ ]     │
│   [ ] [ ] [ ] [ ]     │        │   [ ] [ ] [ ] [ ]     │
│   [ ] [ ] [X] [ ] ────┼────────┼►  [X] [ ] [ ] [ ]     │  ← Same row!
│   [ ] [ ] [ ] [ ]     │        │   [ ] [ ] [ ] [ ]     │
│                       │        │                       │
└───────────────────────┘        └───────────────────────┘
```

### The Interface Methods

Two methods in `ILyraItemContainerWindowContentInterface` enable cursor alignment:

#### `GetCursorScreenPosition`

Called on the **source** window to get the current cursor's screen position:

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Item Container Window|Focus")
bool GetCursorScreenPosition(FVector2D& OutScreenPosition) const;
```

Return value:

* `true` if the content has a meaningful cursor position
* `false` to use the window center as fallback

The position should be in absolute screen coordinates (not local widget space).

#### **`ReceiveNavigationEntry`**

Called on the **target** window when receiving focus from cross-window navigation:

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Item Container Window|Focus")
bool ReceiveNavigationEntry(EUINavigation Direction, float ScreenCoordinate);
```

**Parameters:**

* `Direction`: The direction the user pressed (using Unreal's `EUINavigation` enum):
  * `EUINavigation::Right` = User pressed Right, entering from left edge
  * `EUINavigation::Left` = User pressed Left, entering from right edge
  * `EUINavigation::Down` = User pressed Down, entering from top edge
  * `EUINavigation::Up` = User pressed Up, entering from bottom edge
* `ScreenCoordinate`: The perpendicular screen coordinate to align with:
  * For horizontal navigation (Left/Right): Y screen coordinate
  * For vertical navigation (Up/Down): X screen coordinate

**Return value:**

* `true` if the content handled navigation and called `SetFocus()` on the appropriate internal widget
* `false` to trigger the [fallback chain](/broken/pages/a8474ba9eb13eaa7231f9be90ea4913bc6e491f2) in `RequestContentFocus`

### Implementation Examples

#### List/Tile View (Simple)

For list and tile views, you might not need full cursor alignment. Return `false` to let the shell handle focus via the fallback chain:

```cpp
// In ULyraInventoryListPanel
bool ULyraInventoryListPanel::GetCursorScreenPosition_Implementation(
    FVector2D& OutScreenPosition) const
{
    // Lists don't have precise cursor positions
    // Return false to use window center
    return false;
}

bool ULyraInventoryListPanel::ReceiveNavigationEntry_Implementation(
    EUINavigation Direction, float ScreenCoordinate)
{
    // Return false to let the shell call GetFocusableContent()->SetFocus()
    // Could be enhanced to find nearest item to ScreenCoordinate
    return false;
}
```

#### Tetris Grid (Complex)

For grid-based UIs, full alignment creates a professional feel:

```cpp
// In ULyraTetrisGridClumpWidget
bool ULyraTetrisGridClumpWidget::GetCursorScreenPosition_Implementation(
    FVector2D& OutScreenPosition) const
{
    const FIntPoint Dims = GetGridDimensions();
    if (Dims.X <= 0 || Dims.Y <= 0) return false;

    const FGeometry& MyGeometry = GetCachedGeometry();
    const FVector2D AbsPos = MyGeometry.GetAbsolutePosition();
    const FVector2D AbsSize = MyGeometry.GetAbsoluteSize();

    const FIntPoint CursorPos = GetCursorPosition();

    // Calculate screen position of cursor cell center
    const float ColFraction = (static_cast<float>(CursorPos.X) + 0.5f)
        / FMath::Max(1, Dims.X);
    const float RowFraction = (static_cast<float>(CursorPos.Y) + 0.5f)
        / FMath::Max(1, Dims.Y);

    OutScreenPosition.X = AbsPos.X + ColFraction * AbsSize.X;
    OutScreenPosition.Y = AbsPos.Y + RowFraction * AbsSize.Y;

    return true;
}

bool ULyraTetrisGridClumpWidget::ReceiveNavigationEntry_Implementation(
    EUINavigation Direction, float ScreenCoordinate)
{
    if (!TetrisViewModel.IsValid())
    {
        return false;
    }

    // Convert EUINavigation to FIntPoint direction vector
    FIntPoint DirVector = FIntPoint::ZeroValue;
    switch (Direction)
    {
    case EUINavigation::Left:  DirVector = FIntPoint(-1, 0); break;
    case EUINavigation::Right: DirVector = FIntPoint(1, 0); break;
    case EUINavigation::Up:    DirVector = FIntPoint(0, -1); break;
    case EUINavigation::Down:  DirVector = FIntPoint(0, 1); break;
    default: return false;
    }

    // Calculate entry position from direction and screen coordinate
    FIntPoint EntryPosition = CalculateEntryPosition(DirVector, ScreenCoordinate);

    // If entry position is invalid (e.g., a hole in the grid), find nearest valid cell
    if (!IsGridSlotValid(EntryPosition.X, EntryPosition.Y))
    {
        EntryPosition = FindNearestValidEntryCell(DirVector, ScreenCoordinate);
    }

    // Set cursor and focus — return true to signal we handled it
    TetrisViewModel->SetCursorPosition(EntryPosition, GetEffectiveClumpID());
    SetFocus();

    return true;
}
```

### Coordinate Translation

The screen coordinate passed to `ReceiveNavigationEntry` must be translated from absolute screen space to local widget coordinates.

For Horizontal Navigation (Left/Right), the Y coordinate is passed. Convert it to a row:

```cpp
// ScreenCoordinate is the Y position
float RelativeY = (ScreenCoordinate - WidgetAbsoluteY) / WidgetHeight;
int32 TargetRow = FMath::Clamp(FMath::FloorToInt(RelativeY * NumRows), 0, NumRows - 1);
```

For Vertical Navigation (Up/Down), the X coordinate is passed. Convert it to a column:

```cpp
// ScreenCoordinate is the X position
float RelativeX = (ScreenCoordinate - WidgetAbsoluteX) / WidgetWidth;
int32 TargetColumn = FMath::Clamp(FMath::FloorToInt(RelativeX * NumColumns), 0, NumColumns - 1);
```

### The Fallback Chain

When `RequestContentFocus` is called on the target shell, it tries multiple strategies to set focus. Understanding this chain helps you decide what your `ReceiveNavigationEntry` should return:

1. **Try `ContentWidget`**: Call `ReceiveNavigationEntry` on the shell's `ContentWidget`. If it returns `true`, done.
2. **Try `GetFocusableContent()`**: If `ContentWidget` did not handle it, and `GetFocusableContent()` returns a **different** widget that implements the interface, try `ReceiveNavigationEntry` on that widget.
3. **Plain `SetFocus()`**: If nothing handled navigation, call `SetFocus()` on whatever `GetFocusableContent()` returns.

This means simple widgets that return `false` (or don't implement the interface at all) still receive focus correctly — they just lose the cursor alignment benefit.

### Blueprint Implementation

{% stepper %}
{% step %}
**`GetCursorScreenPosition`**

1. Get your widget's absolute position and size using `GetCachedGeometry`.
2. Calculate the cursor cell's center in screen space.
3. Return `true` and set `OutScreenPosition`.
{% endstep %}

{% step %}
**`ReceiveNavigationEntry`**

1. Use the `Direction` to determine which edge you're entering from.
2. Use `ScreenCoordinate` to calculate the best entry position.
3. Set your cursor/selection to that position.
4. Call `SetFocus()` on the appropriate widget.
5. Return `true` to indicate you handled focus.
{% endstep %}
{% endstepper %}

### Default Behavior

If a content widget doesn't implement these methods, the system provides sensible defaults:

* `GetCursorScreenPosition`: Returns `false`, causing the Layer to use the window's center point.
* `ReceiveNavigationEntry`: Returns `false`, triggering the fallback chain so `GetFocusableContent()->SetFocus()` is called instead.

This means basic content widgets work automatically — you only need to implement these methods for precise cursor alignment.

### Best Practices

{% hint style="info" %}
* Always use absolute screen coordinates for `GetCursorScreenPosition`. The Layer works in screen space, not local widget space.
* Handle invalid positions gracefully in `ReceiveNavigationEntry`. The calculated position might not be valid (e.g., a hole in a tetris grid). Use a fallback search to find the nearest valid cell.
* Consider the direction when selecting entry position. Entering from the left should focus something on the left edge; entering from the top should focus something at the top.
* Always call `SetFocus()` and return `true` when your content handles navigation entry. Forgetting to call `SetFocus()` while returning `true` leaves keyboard focus in limbo.
* Test with different window positions. Drag windows around and verify that cursor alignment still works correctly.
{% endhint %}
