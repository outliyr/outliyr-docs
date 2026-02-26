# Tetris Grid Clump

You have a player inventory with a 6x4 main grid and a 2x2 quick-access pouch. The main grid shows items in their spatial layout with a cursor highlight. The pouch renders the same way but smaller, off to the side. When the cursor leaves the bottom of the main grid, it hops into the pouch. Both sections look different in Blueprint, different cell sizes, different highlight colors, but they share the same ViewModel and the same rendering contract.

`ULyraTetrisGridClumpWidget` is the widget that renders a single grid section. Each clump in the layout gets its own instance. The widget reads data from the shared `ULyraTetrisInventoryViewModel`, responds to grid and cursor changes through BlueprintNativeEvent callbacks, and implements `ILyraItemContainerWindowContentInterface` so it can participate in [cross-window navigation](../../../base-lyra-modified/ui/item-container-ui-system/geometric-navigation/cross-window-navigation.md).

***

### How It Connects

```
ULyraTetrisInventoryViewModel (shared across all clumps)
         │
         ├──── SetTetrisViewModel() ────► ULyraTetrisGridClumpWidget (Clump 0)
         │                                      │
         │                                      ├── OnGridRebuild()
         │                                      ├── OnGridRefresh()
         │                                      ├── OnCursorVisualUpdate()
         │                                      ├── OnPlacingModeChanged()
         │                                      └── OnPlacementValidityChanged()
         │
         └──── SetTetrisViewModel() ────► ULyraTetrisGridClumpWidget (Clump 1)
                                                │
                                                └── (same callbacks)
```

All clump widgets share a single ViewModel instance. Each one filters to its assigned `ClumpID`, so callbacks like `OnCursorVisualUpdate` know whether the cursor is in _this_ clump or a different one.

***

### ViewModel Binding

The clump widget receives its ViewModel and clump assignment through two calls:

```cpp
// Assign the ViewModel and clump ID
ClumpWidget->SetTetrisViewModel(TetrisViewModel, ClumpID);

// Query back
ULyraTetrisInventoryViewModel* VM = ClumpWidget->GetTetrisViewModel();
int32 ID = ClumpWidget->GetDisplayedClumpID();
```

`SetTetrisViewModel()` stores the ViewModel reference, sets the displayed clump ID, subscribes to ViewModel delegates, and triggers the initial `OnGridRebuild` so the widget populates immediately.

To tear down cleanly:

```cpp
ClumpWidget->ClearTetrisViewModel();
```

This unsubscribes from all delegates and clears the ViewModel reference. The widget stops receiving updates and can be safely removed from the widget tree.

***

### Grid Queries

The clump widget exposes ViewModel queries scoped to its displayed clump:

| Method                        | Returns                             | Description                                    |
| ----------------------------- | ----------------------------------- | ---------------------------------------------- |
| `GetGridDimensions()`         | `FIntPoint`                         | Width and height of this clump                 |
| `IsGridSlotValid(X, Y)`       | `bool`                              | Whether a cell is within bounds and accessible |
| `GetCursorPosition()`         | `FIntPoint`                         | Current cursor position (from ViewModel)       |
| `GetCursorClumpID()`          | `int32`                             | Which clump the cursor is in                   |
| `IsCursorInDisplayedClump()`  | `bool`                              | Whether the cursor is in _this_ clump          |
| `IsPlacingItem()`             | `bool`                              | Whether the player is holding an item          |
| `GetHeldItem()`               | `ULyraInventoryItemInstance*`       | The currently held item (if placing)           |
| `GetItemAtPosition(Position)` | `ULyraTetrisItemViewModel*`         | Item at a specific cell in this clump          |
| `IsCellOccupied(Position)`    | `bool`                              | Whether a cell has an item                     |
| `IsCellAccessible(Position)`  | `bool`                              | Whether a cell exists and is not blocked       |
| `GetAllItemsInClump()`        | `TArray<ULyraTetrisItemViewModel*>` | All items in this clump                        |

These are convenience wrappers. Internally, they call the ViewModel with the clump's `DisplayedClumpID` pre-filled.

***

### `BlueprintNativeEvent` Callbacks

These are the core of the widget's visual behavior. Each callback has a C++ default implementation that you can override in Blueprint to customize the look and feel.

#### `OnGridRebuild`

```cpp
UFUNCTION(BlueprintNativeEvent)
void OnGridRebuild(FIntPoint NewDimensions);
```

Fires when: The grid layout changes, a new clump count, different dimensions, or a [resizing the inventory](../tetris-inventory-manager-component/resizing-the-inventory.md).

**What to do here**: Destroy and recreate your cell widgets. This is where you build the grid from scratch, create a `UniformGridPanel`, `GridPanel`, populate it with cell widgets matching the new dimensions, and mark blocked cells as inactive or you could create custom grid cell widgets directly based on the layout.

#### `OnGridRefresh`

```cpp
UFUNCTION(BlueprintNativeEvent)
void OnGridRefresh();
```

Fires when: The grid contents change, an item was added, removed, moved, or rotated. The grid dimensions are the same; only the occupancy data changed.

**What to do here**: Walk through your existing cell widgets and set their new position and sizes in the grid, add new items and remove old items. This is lighter than a full rebuild.

> [!INFO]
> You do not need to update direct item properties themselves because the view model and MVVM bindings automatically update the visuals.

#### `OnCursorVisualUpdate`

```cpp
UFUNCTION(BlueprintNativeEvent)
void OnCursorVisualUpdate(FIntPoint NewPosition, bool bIsInThisClump, bool bIsCursorActive);
```

Fires when: The cursor moves to a new cell, enters or leaves this clump, or the cursor's active state changes.

**What to do here**: Highlight the cursor cell, clear the previous highlight. If `bIsInThisClump` is false, clear all cursor visuals in this clump. If `bIsCursorActive` is false, hide the cursor entirely.

> [!INFO]
> This callback fires on _every_ clump widget, not just the one containing the cursor. That is intentional, it allows clumps that _lost_ the cursor to clear their highlight.

#### `OnPlacingModeChanged`

```cpp
UFUNCTION(BlueprintNativeEvent)
void OnPlacingModeChanged(bool bIsPlacing, ULyraInventoryItemInstance* HeldItem);
```

Fires when: The player picks up an item (`bIsPlacing = true`) or drops/cancels placement (`bIsPlacing = false`).

**What to do here**: When placing, start showing a ghost preview of the held item's shape at the cursor position. When not placing, hide the preview.

#### `OnPlacementValidityChanged`

```cpp
UFUNCTION(BlueprintNativeEvent)
void OnPlacementValidityChanged(bool bCanPlace);
```

Fires when: The cursor moves while holding an item and the validity of the current position changes (from valid to invalid or vice versa).

**What to do here**: Tint the ghost preview green (valid) or red (invalid). This fires only when the validity _changes_, not every frame, so it is efficient for visual transitions.

***

### Window Content Interface

`ULyraTetrisGridClumpWidget` implements [`ILyraItemContainerWindowContentInterface`](../../../base-lyra-modified/ui/item-container-ui-system/the-windowing-system/the-window-content-interface.md), connecting the Tetris grid to the shared windowing and navigation system.

#### `GetFocusableContent`

Returns the widget that should receive focus when this window becomes active. Typically returns `this` (the clump widget itself) or a focusable child.

#### `GetCursorScreenPosition`

Reports where the cursor is on screen so the [Geometric Navigation](../../../base-lyra-modified/ui/item-container-ui-system/geometric-navigation/) layer can calculate which window to navigate to when the cursor exits this one.

```cpp
bool GetCursorScreenPosition(FVector2D& OutScreenPosition) const;
```

This converts the current cursor cell's grid position into screen coordinates using the widget's geometry.

#### `ReceiveNavigationEntry`

Called when the cursor enters this clump from another window (not another clump in the same ViewModel, that is handled by the ViewModel's [cross-clump navigation](tetris-view-model.md#cross-clump-navigation)).

```cpp
void ReceiveNavigationEntry(EUINavigation Direction, float ScreenCoordinate);
```

The clump widget uses the incoming direction and screen coordinate to determine which cell the cursor should land on, the cell whose screen position is closest to the source coordinate along the perpendicular axis. It then calls `SetCursorPosition` on the ViewModel.

***

### Implementing a Custom Clump Widget in Blueprint

{% stepper %}
{% step %}
**Create a new Widget Blueprint**

Create a new Widget Blueprint that inherits from `ULyraTetrisGridClumpWidget`. This gives you access to all the BlueprintNativeEvent callbacks and query methods.
{% endstep %}

{% step %}
**Design the cell layout**

In your widget's designer, add a container for cells (a `UniformGridPanel` works well for evenly-sized cells). Add a reference to whatever cell widget class you want to use for individual cells.
{% endstep %}

{% step %}
**Override `OnGridRebuild`**

Clear the grid container and populate it with cell widgets matching `NewDimensions`. For each cell at `(X, Y)`, check `IsGridSlotValid(X, Y)`, if false, mark it as a blocked/inactive cell.

```
Event OnGridRebuild (NewDimensions)
  │
  ├── Clear all children from GridPanel
  │
  └── For X = 0 to NewDimensions.X - 1
      └── For Y = 0 to NewDimensions.Y - 1
          ├── Create Cell Widget
          ├── Add to GridPanel at (X, Y)
          └── If NOT IsGridSlotValid(X, Y)
              └── Set cell as Blocked
```
{% endstep %}

{% step %}
**Override `OnGridRefresh`**

Walk through existing cells and update their positions, add new items, and remove items that no longer exist.
{% endstep %}

{% step %}
**Override `OnCursorVisualUpdate`**

Highlight the cursor cell. If `bIsInThisClump` is false, clear all highlights. Consider showing a multi-cell highlight when the cursor is over a multi-cell item, use `GetItemAtPosition()` to find the item, then query its `GetOccupiedCells()` to highlight all cells it covers.
{% endstep %}

{% step %}
**Override `OnPlacingModeChanged` and `OnPlacementValidityChanged`**

Show a ghost overlay of the held item's shape when placing. Tint it based on validity. Use the held item's `Shape` and `Rotation` from the ViewModel to know which cells to overlay.
{% endstep %}
{% endstepper %}

***

### Internal Structure

The clump widget holds a reference to a `UTetrisGridInputHandler` and manages focus tracking for gamepad input. When the widget receives focus, it activates its input handler; when it loses focus, the handler is deactivated.

```
ULyraTetrisGridClumpWidget
│
├── TetrisViewModel (weak reference)
├── DisplayedClumpID
├── InputHandler (UTetrisGridInputHandler)
└── Focus tracking state
```

The input handler is created internally and does not need to be configured manually. It reads the same ViewModel the clump widget does, translating raw input events into ViewModel operations.
