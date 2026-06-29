# Blueprint Viewmodel Cheat Sheet

A task-driven lookup for wiring widgets to the item container ViewModels: find what you want to do, bind or call the listed member. It is intentionally not a full API reference. For how each ViewModel works and how to initialize one, see [Specialized Implementations](../data-layers-view-models/specialized-implementations.md).

## How Binding Works

In the UMG **View Bindings** panel, add a ViewModel of the matching class, then bind your widget properties to its members.

* **Bind** entries are `FieldNotify` properties. They refresh the bound widget automatically when the underlying data changes, with no Tick and no manual refresh.
* **Call** entries are functions you invoke, usually from your widget's input handling.
* **Event** entries are multicast delegates you can bind to in the widget graph.

For tagged or spatial slots, fetch the slot through its accessor each time (`GetOrCreateSlotViewModel`, `GetSlotViewModel`, `GetItemAtPosition`) rather than caching the returned pointer, because the slot ViewModel may be created on demand. The concept behind all of this lives in [Data Layers (View Models)](../data-layers-view-models/).

## Item Entry, Tooltip, or Drag Visual

Bind to `ULyraItemViewModel` for anything that draws a single item.

| Goal                           | Member                       | Kind  | Notes                                                                                                  |
| ------------------------------ | ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| Item name                      | `DisplayName`                | Bind  | `FText`                                                                                                |
| Icon                           | `Icon`                       | Bind  | `Texture2D`                                                                                            |
| Stack count                    | `StackCount`                 | Bind  | current count in this stack                                                                            |
| Max stack size                 | `MaxStackCount`              | Bind  |                                                                                                        |
| Weight                         | `TotalWeight`                | Bind  |                                                                                                        |
| Description                    | `Description`                | Bind  |                                                                                                        |
| Background tint                | `BackgroundColor`            | Bind  | e.g. rarity colour                                                                                     |
| Selected highlight             | `bIsSelected`                | Bind  |                                                                                                        |
| Focus highlight                | `bIsFocused`                 | Bind  | keyboard/gamepad cursor                                                                                |
| Dimmed / predicted             | `bIsGhost`                   | Bind  | in-flight prediction, see [Prediction & Visuals](../data-layers-view-models/prediction-and-visuals.md) |
| Read a stat (ammo, durability) | `GetStatTagValue(Tag)`       | Call  | reads a gameplay tag stack                                                                             |
| React to a stat change         | `OnStatTagChanged`           | Event | refresh a dynamic stat readout                                                                         |
| Mark selected / focused        | `SetSelected` / `SetFocused` | Call  | usually driven by the container, not the widget                                                        |

## Slot Widget (empty and occupied)

Bind to `ULyraSlotViewModelBase` for fixed slots. The slot always exists, so empty slots still render and accept drops.

| Goal                        | Member                       | Kind | Notes                                     |
| --------------------------- | ---------------------------- | ---- | ----------------------------------------- |
| Is the slot filled?         | `bIsOccupied`                | Bind | invert it to drive the empty-state border |
| Empty-slot label            | `SlotDisplayName`            | Bind | e.g. "Helmet"                             |
| Empty-slot placeholder icon | `SlotIcon`                   | Bind | shown when empty                          |
| Slot identity               | `SlotTag`                    | Bind |                                           |
| Item icon                   | `ItemIcon`                   | Bind | null when empty, UMG draws nothing        |
| Item name                   | `ItemDisplayName`            | Bind |                                           |
| Stack count                 | `StackCount`                 | Bind |                                           |
| Max stack size              | `MaxStackCount`              | Bind |                                           |
| Weight                      | `TotalWeight`                | Bind |                                           |
| Description                 | `ItemDescription`            | Bind |                                           |
| Background tint             | `BackgroundColor`            | Bind |                                           |
| Dimmed / predicted          | `bIsGhost`                   | Bind |                                           |
| Focus / selected state      | `bIsFocused` / `bIsSelected` | Bind | works on empty slots too                  |
| The item inside the slot    | `ItemViewModel`              | Bind | null when empty                           |
| Mark focused / selected     | `SetFocused` / `SetSelected` | Call |                                           |

Bind to the slot rather than the item so a slot with no item still draws and can receive a drop. The reasoning is in [The Persistent Slot Pattern](../data-layers-view-models/persistent-slot-pattern.md).

## Container or HUD Readout

Bind to `ULyraContainerViewModel` (and its subclasses) for whole-container display.

| Goal                                 | Member                 | Kind  | Notes                                      |
| ------------------------------------ | ---------------------- | ----- | ------------------------------------------ |
| Container title                      | `ContainerName`        | Bind  |                                            |
| Item list for a ListView or TileView | `Items`                | Bind  | array of `ULyraItemViewModel`              |
| Item count                           | `ItemCount`            | Bind  |                                            |
| Capacity                             | `Capacity`             | Bind  |                                            |
| Current weight                       | `TotalWeight`          | Bind  |                                            |
| Max weight                           | `MaxWeight`            | Bind  | pair with `TotalWeight` for a capacity bar |
| Currently focused item               | `FocusedItem`          | Bind  | drive a details panel                      |
| List changed                         | `OnItemsChanged`       | Event | refresh the list widget                    |
| Focus changed                        | `OnFocusedItemChanged` | Event |                                            |
| Set the focused item                 | `SetFocusedItem`       | Call  |                                            |
| Force a full rebuild                 | `ForceRefresh`         | Call  | rarely needed, the VM refreshes itself     |

## Drag, Drop, and Moves

Use the `ULyraInteractionViewModel` (the shared, per-player interaction state) for drag visuals and item moves. You can access through the `ItemContainerUIManager`. You can find more information in [interaction & transactions](../interaction-and-transactions/).

| Goal                                | Member                   | Kind  | Notes                     |
| ----------------------------------- | ------------------------ | ----- | ------------------------- |
| A drag or move is in progress       | `bIsActiveTransaction`   | Bind  |                           |
| The item being dragged              | `ActiveTransactionItem`  | Bind  |                           |
| Drag visual rotation                | `DragVisualRotation`     | Bind  | degrees, used by tetris   |
| Drag visual offset                  | `DragVisualOffset`       | Bind  |                           |
| Drag visual pivot                   | `DragVisualPivot`        | Bind  | normalized 0..1           |
| A modal is open                     | `bIsModalActive`         | Bind  |                           |
| Begin a drag                        | `BeginInteraction`       | Call  |                           |
| Drop / commit the move              | `CommitInteraction`      | Call  |                           |
| Cancel the drag                     | `CancelInteraction`      | Call  |                           |
| Is this drop target valid?          | `CanPlaceAt`             | Call  | for hover feedback        |
| One-shot move with no drag          | `ExecuteMoveDirect`      | Call  | e.g. shift-click transfer |
| Split a stack                       | `RequestStackSplit`      | Call  | opens the quantity prompt |
| Push a custom drag-visual transform | `SetDragVisualTransform` | Call  |                           |
| Interaction finished                | `OnInteractionCompleted` | Event | success or failure        |

## Equipment and Attachment Slots

These draw fixed, tag-addressed slots. Get the slot ViewModel from its accessor, then bind the slot widget to the returned object using the **Slot Widget** members above, plus the extras below.

| Goal                                  | Member                                                   | Kind | Notes                              |
| ------------------------------------- | -------------------------------------------------------- | ---- | ---------------------------------- |
| Get an equipment slot                 | `ULyraEquipmentViewModel::GetOrCreateSlotViewModel(Tag)` | Call | creates the slot VM on demand      |
| Is an equipment slot filled?          | `IsSlotOccupied(Tag)`                                    | Call |                                    |
| Equipment slot is the active/held one | `ULyraEquipmentSlotViewModel::bIsHeld`                   | Bind | e.g. the drawn weapon              |
| Focus an equipment slot               | `SetFocusedSlot(Tag)`                                    | Call |                                    |
| Get an attachment slot                | `ULyraAttachmentViewModel::GetSlotViewModel(Tag)`        | Call | returns the existing slot VM       |
| All attachment slots                  | `GetAllSlotViewModels()`                                 | Call |                                    |
| Attachment slot parent state          | `ULyraAttachmentSlotViewModel::ParentActiveState`        | Bind | reflects holstered/equipped parent |

Slots exist whether or not they hold an item, so bind empty-slot visuals exactly as you would for a filled one. Setup and the per-system details are in [Specialized Implementations](../data-layers-view-models/specialized-implementations.md).

## Tetris Grid

Bind to `ULyraTetrisInventoryViewModel` for grid inventory widgets.

| Goal                            | Member                                          | Kind | Notes                          |
| ------------------------------- | ----------------------------------------------- | ---- | ------------------------------ |
| Grid width / height             | `GridWidth` / `GridHeight`                      | Bind |                                |
| Number of clumps                | `ClumpCount`                                    | Bind | a clump is one grid section    |
| Layout data                     | `InventoryLayout`                               | Bind | clump placement and sizes      |
| Cursor cell                     | `CursorPosition`                                | Bind |                                |
| Cursor's clump                  | `CursorClumpID`                                 | Bind |                                |
| Cursor is visible               | `bIsCursorActive`                               | Bind |                                |
| Held item rotation              | `HeldItemRotation`                              | Bind | during placement               |
| Item at a cell                  | `GetItemAtPosition(Pos, ClumpID)`               | Call |                                |
| Item under the cursor           | `GetItemAtCursor()`                             | Call |                                |
| Is a cell occupied / accessible | `IsCellOccupied` / `IsCellAccessible`           | Call |                                |
| Clump size                      | `GetClumpDimensions(ClumpID)`                   | Call |                                |
| Move the cursor                 | `MoveCursor(Direction)`                         | Call |                                |
| Jump the cursor                 | `SetCursorPosition(Pos, ClumpID)`               | Call |                                |
| Pick up the item at the cursor  | `PickUpItemAtCursor()`                          | Call | enters placement mode          |
| Rotate the held item            | `RotateHeldItem(bClockwise)`                    | Call |                                |
| Can the held item drop here?    | `CanPlaceAtCursor()`                            | Call |                                |
| What kind of placement is this? | `GetPlacementMode()` / `GetCombineTargetItem()` | Call | move vs stack/fragment combine |

Cross-clump controller navigation helpers (`SetPendingNavigation`, `ConsumePendingNavigation`, `CalculateNavigationEntry`, `GetItemEdgeCell`) are only needed by grid widgets that implement gamepad navigation across multiple clumps.

## Where To Go Deeper

* [Specialized Implementations](../data-layers-view-models/specialized-implementations.md) — what each ViewModel is and how to initialize one.
* [The Persistent Slot Pattern](../data-layers-view-models/persistent-slot-pattern.md) — why empty slots still have a ViewModel.
* [Prediction & Visuals](../data-layers-view-models/prediction-and-visuals.md) — what `bIsGhost` means and how to use it.
* I[nteraction & Transaction](../interaction-and-transactions/) — for drag and drop along with interacting with items
