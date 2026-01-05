# The Window Content Interface

The **Window Shell** handles the frame (the chrome), but your widget (the Inventory Grid, the Skill Tree, or the Loot List) handles the actual game logic.

To bridge the gap between the generic Shell and your specific Widget, we use a "Handshake" mechanism called the **`ILyraItemContainerWindowContentInterface`**.

***

### Why an Interface?

If you simply spawned a widget and added it to the Shell, the widget wouldn't know which inventory to look at or how to handle gamepad navigation.

We use an interface because:

1. **Decoupling:** The Shell doesn't need to know if it's holding an Inventory or a Talent Tree. It just knows it's holding "Content."
2. **Order of Operations:** UMG's built-in Construct event happens too early. At construction time, widgets often don't have their data yet. The interface provides a specific **Initialization Callback**.
3. **Navigation Support:** The interface enables cross-window controller/keyboard navigation by letting content report its cursor position and receive navigation entries.

***

### The Interface

```cpp
class ILyraItemContainerWindowContentInterface
{
public:
    // Initialization
    void SetContainerSource(const FInstancedStruct& Source);

    // Focus Management
    UWidget* GetFocusableContent() const;

    // Cross-Window Navigation
    bool GetCursorScreenPosition(FVector2D& OutScreenPosition) const;
    void ReceiveNavigationEntry(FIntPoint Direction, float ScreenCoordinate);
};
```

***

### Method Details

#### 1. `SetContainerSource`

This is your "Construct" event. The source context passed into the `FItemWindowSpec`'s `SourceDesc` is delivered here.

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable)
void SetContainerSource(const FInstancedStruct& Source);
```

**Purpose:** Receive your data source and acquire your ViewModel.

**Standard Implementation:**

{% stepper %}
{% step %}
Call `GetOwningWindowShell()` → `AcquireViewModelLease(Source)`
{% endstep %}

{% step %}
Take the returned ViewModel and bind your widget content to it
{% endstep %}
{% endstepper %}

{% hint style="success" %}
**Why use the Lease API?** By using `AcquireViewModelLease` through the Shell instead of calling the UI Manager directly, your ViewModel is automatically cleaned up when the window closes. No manual cleanup code required.
{% endhint %}

#### 2. `GetFocusableContent`

Returns the widget that should receive focus when this window becomes focused.

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable)
UWidget* GetFocusableContent() const;
```

**Purpose:** Tell the Shell which widget should get keyboard/controller focus.

**Return Values:**

* Return your primary interactive widget (ListView, Grid, etc.)
* Return `nullptr` to use Unreal's default focus behavior (first focusable child)

**Examples:**

| Content Type    | Return Value                       |
| --------------- | ---------------------------------- |
| List Panel      | The `ListView` widget              |
| Tetris Grid     | The `GridClump` widget             |
| Equipment Panel | The first slot widget or container |

#### 3. `GetCursorScreenPosition`

Reports the current cursor/selection position in screen space.

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable)
bool GetCursorScreenPosition(FVector2D& OutScreenPosition) const;
```

**Purpose:** Enable cursor alignment during cross-window navigation. When the user navigates from Window A to Window B, the Layer uses this position to find a geometrically appropriate target.

**Return Values:**

* Return `true` and set `OutScreenPosition` to the absolute screen position of your current selection
* Return `false` to use the window center as a fallback

**Example Implementation:**

```cpp
bool UMyContentWidget::GetCursorScreenPosition_Implementation(FVector2D& OutScreenPosition) const
{
    if (UWidget* SelectedSlot = GetCurrentlySelectedSlot())
    {
        FGeometry Geom = SelectedSlot->GetCachedGeometry();
        OutScreenPosition = Geom.GetAbsolutePositionAtCoordinates(FVector2D(0.5f, 0.5f));
        return true;
    }
    return false;
}
```

#### 4. `ReceiveNavigationEntry`

Called when this content receives focus from cross-window navigation.

```cpp
UFUNCTION(BlueprintNativeEvent, BlueprintCallable)
void ReceiveNavigationEntry(FIntPoint Direction, float ScreenCoordinate);
```

**Purpose:** Position your cursor/selection to align with where navigation came from. This creates a smooth "handoff" between windows, if the user was selecting an item at Y=300 in Window A and navigates right to Window B, Window B should select something near Y=300 on its left edge.

**Visual Example**

```
                    User presses D-Pad RIGHT
                    ─────────────────────────►

┌─────────────────────┐          ┌─────────────────────┐
│   Window A          │          │   Window B          │
│                     │          │                     │
│   [ ] [ ] [ ]       │          │   [ ] [ ] [ ]       │
│   [ ] [X] [ ] ──────┼──────────┼►  [?] [ ] [ ]       │
│   [ ] [ ] [ ]       │          │   [ ] [ ] [ ]       │
│                     │          │                     │
│   Cursor at Y=300   │          │   Select near Y=300 │
└─────────────────────┘          └─────────────────────┘

Window B receives:
  Direction = (1, 0)        // User pressed RIGHT (came from the left)
  ScreenCoordinate = 300    // The Y position to align with
```

**Understanding the Parameters**

**Direction** tells you which edge of your window the navigation entered from:

<table><thead><tr><th width="108.45452880859375">Direction</th><th width="126.3636474609375">User Pressed</th><th width="129">Entry Edge</th><th>What to Do</th></tr></thead><tbody><tr><td><code>(1, 0)</code></td><td>Right</td><td>Left edge</td><td>Select item on LEFT side of your grid, near the Y coordinate</td></tr><tr><td><code>(-1, 0)</code></td><td>Left</td><td>Right edge</td><td>Select item on RIGHT side of your grid, near the Y coordinate</td></tr><tr><td><code>(0, 1)</code></td><td>Down</td><td>Top edge</td><td>Select item on TOP of your grid, near the X coordinate</td></tr><tr><td><code>(0, -1)</code></td><td>Up</td><td>Bottom edge</td><td>Select item on BOTTOM of your grid, near the X coordinate</td></tr></tbody></table>

**ScreenCoordinate** is the perpendicular screen position to align with:

* For horizontal navigation (Left/Right): This is a **Y screen coordinate**
* For vertical navigation (Up/Down): This is an **X screen coordinate**

**Practical Implementation**

The goal is to find the item in your content that best matches where the user was in the previous window:

```cpp
void UMyGridContent::ReceiveNavigationEntry_Implementation(FIntPoint Direction, float ScreenCoordinate)
{
    if (Direction.X > 0)
    {
        // User pressed RIGHT, entering from LEFT edge
        // Find the item in the leftmost column closest to ScreenCoordinate (Y position)
        SelectItemInColumn(0, ScreenCoordinate);  // Column 0 = leftmost
    }
    else if (Direction.X < 0)
    {
        // User pressed LEFT, entering from RIGHT edge
        // Find the item in the rightmost column closest to ScreenCoordinate
        SelectItemInColumn(NumColumns - 1, ScreenCoordinate);
    }
    else if (Direction.Y > 0)
    {
        // User pressed DOWN, entering from TOP edge
        // Find the item in the top row closest to ScreenCoordinate (X position)
        SelectItemInRow(0, ScreenCoordinate);  // Row 0 = top
    }
    else if (Direction.Y < 0)
    {
        // User pressed UP, entering from BOTTOM edge
        // Find the item in the bottom row closest to ScreenCoordinate
        SelectItemInRow(NumRows - 1, ScreenCoordinate);
    }
}

void UMyGridContent::SelectItemInColumn(int32 Column, float TargetY)
{
    // Find the slot in this column whose Y position is closest to TargetY
    float BestDistance = FLT_MAX;
    int32 BestRow = 0;

    for (int32 Row = 0; Row < NumRows; ++Row)
    {
        UWidget* Slot = GetSlotAt(Row, Column);
        FVector2D SlotCenter = Slot->GetCachedGeometry()
            .GetAbsolutePositionAtCoordinates(FVector2D(0.5f, 0.5f));

        float Distance = FMath::Abs(SlotCenter.Y - TargetY);
        if (Distance < BestDistance)
        {
            BestDistance = Distance;
            BestRow = Row;
        }
    }

    SetSelectedSlot(BestRow, Column);
}
```

**When to Skip Implementation**

If your content doesn't have a grid or meaningful cursor positions, you can leave this as a no-op. The system will still focus your `GetFocusableContent()` widget, it just won't have the smooth spatial alignment.

```cpp
void USimpleListContent::ReceiveNavigationEntry_Implementation(FIntPoint Direction, float ScreenCoordinate)
{
    // No-op: ListView handles its own selection, just let GetFocusableContent handle focus
}
```

***

### Implementation Examples

#### C++ Content Widget

```cpp
UCLASS()
class UMyInventoryContent : public UUserWidget, public ILyraItemContainerWindowContentInterface
{
    GENERATED_BODY()

public:
    // ILyraItemContainerWindowContentInterface
    virtual void SetContainerSource_Implementation(const FInstancedStruct& Source) override;
    virtual UWidget* GetFocusableContent_Implementation() const override;
    virtual bool GetCursorScreenPosition_Implementation(FVector2D& OutScreenPosition) const override;
    virtual void ReceiveNavigationEntry_Implementation(FIntPoint Direction, float ScreenCoordinate) override;

protected:
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UListView> ItemList;

    UPROPERTY()
    TObjectPtr<ULyraInventoryViewModel> ViewModel;
};

void UMyInventoryContent::SetContainerSource_Implementation(const FInstancedStruct& Source)
{
    if (ULyraItemContainerWindowShell* Shell = ULyraItemContainerWindowShell::GetOwningWindowShell(this))
    {
        ViewModel = Cast<ULyraInventoryViewModel>(Shell->AcquireViewModelLease(Source));
        // Bind UI to ViewModel...
    }
}

UWidget* UMyInventoryContent::GetFocusableContent_Implementation() const
{
    return ItemList;
}

bool UMyInventoryContent::GetCursorScreenPosition_Implementation(FVector2D& OutScreenPosition) const
{
    // Return position of currently selected list item
    if (UObject* SelectedItem = ItemList->GetSelectedItem())
    {
        if (UUserWidget* EntryWidget = ItemList->GetEntryWidgetFromItem(SelectedItem))
        {
            OutScreenPosition = EntryWidget->GetCachedGeometry()
                .GetAbsolutePositionAtCoordinates(FVector2D(0.5f, 0.5f));
            return true;
        }
    }
    return false;
}

void UMyInventoryContent::ReceiveNavigationEntry_Implementation(FIntPoint Direction, float ScreenCoordinate)
{
    // Select item nearest to the incoming Y coordinate for horizontal navigation
    if (Direction.X != 0)
    {
        SelectItemNearestToY(ScreenCoordinate);
    }
}
```

#### Blueprint Content Widget

For pure Blueprint widgets, add the interface to your Widget Blueprint:

{% stepper %}
{% step %}
Open your Widget Blueprint
{% endstep %}

{% step %}
Go to **Class Settings**
{% endstep %}

{% step %}
Under **Interfaces**, click **Add** and select `LyraItem Container Window Content Interface`
{% endstep %}

{% step %}
Implement the interface events in your Event Graph
{% endstep %}
{% endstepper %}

Implement each interface event:

* `SetContainerSource` Event:
  * Get Owning Window Shell
  * Call `AcquireViewModelLease` with the Source
  * Bind your UI to the returned `ViewModel`

<figure><img src="../../../../.gitbook/assets/image (195).png" alt=""><figcaption><p>Exampl setting the content interface forr the equipment widget</p></figcaption></figure>

* GetFocusableContent Function:
  * Return a reference to your main interactive widget (`ListView`, Grid, etc.)

<figure><img src="../../../../.gitbook/assets/image (196).png" alt="" width="272"><figcaption></figcaption></figure>

* GetCursorScreenPosition Function:
  * Get your currently selected widget's geometry
  * Call `GetCachedGeometry->LocalToAbsolute(0.5, 0.5)`
  * Return true if you have a selection, false otherwise

<figure><img src="../../../../.gitbook/assets/image (198).png" alt=""><figcaption><p>Pass the last focused equipment slot for better cursor position</p></figcaption></figure>

* ReceiveNavigationEntry Event:
  * Check the Direction to determine which edge navigation came from
  * Select the appropriate slot/item based on `ScreenCoordinate`



***

### Default Behaviors

If you don't implement certain methods, the system provides sensible defaults:

| Method                    | Default Behavior                                         |
| ------------------------- | -------------------------------------------------------- |
| `GetFocusableContent`     | Returns `nullptr` → Unreal focuses first focusable child |
| `GetCursorScreenPosition` | Returns `false` → Layer uses window center               |
| `ReceiveNavigationEntry`  | No-op → Focus goes to `GetFocusableContent` result       |

For simple content widgets that don't need precise cursor alignment, you may only need to implement `SetContainerSource` and `GetFocusableContent`.

***

## When the Shell Calls Each Method

```mermaid
sequenceDiagram
    participant Shell as Window Shell
    participant Content as Your Content Widget
    participant Layer as Item Container Layer

    Note over Shell: Window Opens
    Shell->>Content: SetContainerSource(Source)
    Content->>Content: Acquire ViewModel, Bind UI

    Note over Layer: Window Focused
    Layer->>Shell: RequestContentFocus()
    Shell->>Content: GetFocusableContent()
    Content-->>Shell: ListView widget
    Shell->>Shell: SetFocus(ListView)

    Note over Layer: Cross-Window Navigation
    Layer->>Shell: GetContentCursorScreenPosition()
    Shell->>Content: GetCursorScreenPosition(OutPos)
    Content-->>Shell: true, (500, 300)
    Shell-->>Layer: (500, 300)
    Layer->>Layer: FindWindowInDirection(...)

    Note over Layer: Focus Transferred to New Window
    Layer->>Shell: RequestContentFocus()
    Shell->>Content: ReceiveNavigationEntry(Direction, Coord)
    Content->>Content: Position cursor at edge
```

***
