# Cursor Alignment

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

#### `ReceiveNavigationEntry`

Called on the **target** window when receiving focus from cross-window navigation:

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "Item Container Window|Focus")
void ReceiveNavigationEntry(FIntPoint Direction, float ScreenCoordinate);
```

Parameters:

* `Direction`: Vector showing where navigation came from:
  * `(1, 0)` = Came from the left (user pressed Right)
  * `(-1, 0)` = Came from the right (user pressed Left)
  * `(0, 1)` = Came from above (user pressed Down)
  * `(0, -1)` = Came from below (user pressed Up)
* `ScreenCoordinate`: The perpendicular screen coordinate to align with:
  * For horizontal navigation (Left/Right): Y screen coordinate
  * For vertical navigation (Up/Down): X screen coordinate

### Implementation Examples

#### List/Tile View (Simple)

For list and tile views, you might not need full cursor alignment, the first or last item is usually acceptable:

```cpp
// In ULyraInventoryListPanel
bool ULyraInventoryListPanel::GetCursorScreenPosition_Implementation(
    FVector2D& OutScreenPosition) const
{
    // Lists don't have precise cursor positions
    // Return false to use window center
    return false;
}

void ULyraInventoryListPanel::ReceiveNavigationEntry_Implementation(
    FIntPoint Direction, float ScreenCoordinate)
{
    // Default behavior: focus first item
    // Could be enhanced to find nearest item to ScreenCoordinate
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
    OutScreenPosition.X = AbsPos.X + ((CursorPos.X + 0.5f) / Dims.X) * AbsSize.X;
    OutScreenPosition.Y = AbsPos.Y + ((CursorPos.Y + 0.5f) / Dims.Y) * AbsSize.Y;

    return true;
}

void ULyraTetrisGridClumpWidget::ReceiveNavigationEntry_Implementation(
    FIntPoint Direction, float ScreenCoordinate)
{
    // Calculate entry position from direction and screen coordinate
    FIntPoint EntryPosition = CalculateEntryPosition(Direction, ScreenCoordinate);

    // Validate and set cursor
    if (!IsGridSlotValid(EntryPosition.X, EntryPosition.Y))
    {
        EntryPosition = FindNearestValidEntryCell(Direction);
    }

    TetrisViewModel->SetCursorPosition(EntryPosition, GetEffectiveClumpID());
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

### Blueprint Implementation

Use the stepper below to implement these interface methods in Blueprint.

{% stepper %}
{% step %}
#### `GetCursorScreenPosition`

1. Get your widget's absolute position and size using `GetCachedGeometry`.
2. Calculate the cursor cell's center in screen space.
3. Return `true` and set `OutScreenPosition`.
{% endstep %}

{% step %}
#### `ReceiveNavigationEntry`

1. Use the `Direction` to determine which edge you're entering from.
2. Use `ScreenCoordinate` to calculate the best entry position.
3. Set your cursor/selection to that position.
{% endstep %}
{% endstepper %}

### Default Behavior

If a content widget doesn't implement these methods, the system provides sensible defaults:

* `GetCursorScreenPosition`: Returns `false`, causing the Layer to use the window's center point.
* `ReceiveNavigationEntry`: Does nothing, so focus simply goes to whatever `GetFocusableContent()` returns.

This means basic content widgets work automatically, you only need to implement these methods for precise cursor alignment.

### Best Practices

{% hint style="info" %}
* Always use absolute screen coordinates for `GetCursorScreenPosition`. The Layer works in screen space, not local widget space.
* Handle invalid positions gracefully in `ReceiveNavigationEntry`. The calculated position might not be valid (e.g., a hole in a tetris grid).
* Consider the direction when selecting entry position. Entering from the left should focus something on the left edge; entering from the top should focus something at the top.
* Test with different window positions. Drag windows around and verify that cursor alignment still works correctly.
{% endhint %}
