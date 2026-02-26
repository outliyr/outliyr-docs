# Tetris Grid Input Handler

You hold the left stick to the right and the cursor glides across the grid, slow at first, then accelerating. You tap the D-pad down once and it moves exactly one cell. You press a bumper and the held item rotates 90 degrees. All of this input processing, digital keys, analog sticks, action buttons, repeat rates, lives in `UTetrisGridInputHandler`.

This handler sits between raw input events and the [Tetris View Model](tetris-view-model.md). It does not render anything or own any state about the grid. It translates "the player pressed Right" into "call `ViewModel->MoveCursor(Right)`" and "the player pressed Confirm" into "call `ViewModel->PickUpItemAtCursor()` or attempt placement."

***

### Architecture

```
Raw Input (from UMG focus / Enhanced Input)
         │
         ▼
UTetrisGridInputHandler
├── HandleNavigationInput(Key)      ──► ViewModel->MoveCursor()
├── HandleAnalogNavigation(Stick)   ──► ViewModel->MoveCursor() (with repeat)
├── HandleActionInput(Key)          ──► ViewModel->PickUp / Rotate / Cancel
├── HandleConfirmAction()           ──► ViewModel->PlaceItem or PickUp
└── HandleKeyUp(Key)                ──► Reset repeat state for that key
         │
         ▼
ULyraTetrisInventoryViewModel (state changes)
         │
         ▼
ULyraTetrisGridClumpWidget (visual callbacks)
```

The handler holds weak references to both the `TetrisViewModel` (for grid operations) and the `InteractionViewModel` (for cross-container actions like opening context menus).

***

### Digital Navigation

D-pad and arrow keys provide single-cell cursor movement with auto-repeat.

#### Key Mapping

The handler uses configurable key arrays for each direction:

| Array       | Default Keys                  | Purpose                    |
| ----------- | ----------------------------- | -------------------------- |
| `UpKeys`    | `Gamepad_DPad_Up`, `Up`       | Move cursor up one cell    |
| `DownKeys`  | `Gamepad_DPad_Down`, `Down`   | Move cursor down one cell  |
| `LeftKeys`  | `Gamepad_DPad_Left`, `Left`   | Move cursor left one cell  |
| `RightKeys` | `Gamepad_DPad_Right`, `Right` | Move cursor right one cell |

#### Auto-Repeat

When a navigation key is held down, the handler implements a two-phase repeat:

```
Key Pressed ──► First move (immediate)
                    │
                    ▼
              InitialRepeatDelay (0.4s default)
                    │
                    ▼
              Repeat at RepeatRate (0.1s default)
              ┌─────────────┐
              │  Move  Move  │  ...continues until key released
              └─────────────┘
```

| Property             | Default | Description                           |
| -------------------- | ------- | ------------------------------------- |
| `InitialRepeatDelay` | `0.4f`  | Seconds before the first repeat fires |
| `RepeatRate`         | `0.1f`  | Seconds between subsequent repeats    |

The initial delay prevents accidental double-moves on a quick tap. The repeat rate controls how fast the cursor scrolls when the key is held. Both are exposed as `UPROPERTY(EditAnywhere)` so you can tune them per-game.

`HandleKeyUp(Key)` resets the repeat timer for that specific key, so releasing and re-pressing restarts the initial delay.

***

### Analog Navigation

The left stick provides fluid cursor movement with deadzone filtering and automatic repeat.

#### How It Works

```cpp
void HandleAnalogNavigation(FVector2D StickValue, float DeltaTime);
```

Each frame, the handler receives the current stick deflection and delta time. The processing pipeline:

{% stepper %}
{% step %}
**Deadzone check**

If the stick magnitude is below `StickDeadzone` (default `0.3f`), no navigation occurs. This prevents drift from a resting stick.
{% endstep %}

{% step %}
**Direction quantization**

The stick vector is quantized into one of four cardinal directions (Up, Down, Left, Right) based on which axis has the larger absolute value.
{% endstep %}

{% step %}
**Repeat timing**

The analog repeat uses the same `InitialRepeatDelay` and `RepeatRate` as digital input. The first movement fires immediately when the stick crosses the deadzone, then repeats after the initial delay.
{% endstep %}

{% step %}
**Cursor move**

If the repeat timer has elapsed, `MoveCursor()` is called on the ViewModel with the quantized direction.
{% endstep %}
{% endstepper %}

> [!INFO]
> The analog stick does not provide variable-speed cursor movement, it uses the same discrete cell-by-cell movement as digital input. The stick's magnitude (beyond the deadzone) does not affect speed. This keeps the cursor aligned to the grid and prevents "between cells" states.

#### Sync on State Change

When the player picks up or drops an item, the held item's position might not match the cursor. `SyncHeldStateWithoutMoving()` realigns the internal analog state without triggering a cursor move:

```cpp
void SyncHeldStateWithoutMoving(FVector2D CurrentStickValue);
```

This prevents a phantom move right after a state transition.

***

### Action Mapping

Actions beyond movement are handled through separate key arrays:

| Array                        | Default Keys                         | Action                               |
| ---------------------------- | ------------------------------------ | ------------------------------------ |
| `ConfirmKeys`                | `Gamepad_FaceButton_Bottom`, `Enter` | Pick up item or place held item      |
| `CancelKeys`                 | `Gamepad_FaceButton_Right`, `Escape` | Cancel placement (return item)       |
| `RotateClockwiseKeys`        | `Gamepad_RightShoulder`, `R`         | Rotate held item clockwise           |
| `RotateCounterClockwiseKeys` | `Gamepad_LeftShoulder`, `Q`          | Rotate held item counter-clockwise   |
| `ActionMenuKeys`             | `Gamepad_FaceButton_Left`, `Tab`     | Open context menu for item at cursor |

#### Confirm Logic

`HandleConfirmAction()` has context-dependent behavior:

```
HandleConfirmAction()
│
├── If NOT placing an item:
│   └── PickUpItemAtCursor()
│       Item enters placement mode
│
└── If placing an item:
    ├── CanPlaceAtCursor() == true?
    │   └── Execute placement (transaction)
    │
    └── CanPlaceAtCursor() == false?
        └── Do nothing (invalid position)
```

The confirm key never cancels. If you press confirm on an invalid cell while holding an item, nothing happens. Cancellation is always explicit through the cancel key.

#### Rotation

Rotation keys are only active during placement mode. When pressed:

1. The handler calls `ViewModel->RotateHeldItem(bClockwise)`
2. The ViewModel checks if the new rotation is in the item's `AllowedRotations`
3. If allowed, the rotation updates and `OnHeldItemRotationChanged` fires
4. The placement mode is recalculated at the new rotation
5. Clump widgets update the ghost preview

If the item's `AllowedRotations` only contains one entry (e.g., the item cannot rotate), the rotation call is a no-op.

***

### Tick

The handler has a `Tick(DeltaTime)` method called each frame by the owning clump widget. This drives the analog navigation and repeat timers:

```cpp
void Tick(float DeltaTime);
```

During tick:

1. Analog repeat timers are decremented
2. Digital repeat timers are decremented
3. If any timer has elapsed, the corresponding move fires
4. Timers reset to `RepeatRate` after firing

`ResetState()` clears all timers and pending input. This is called when the clump widget loses focus or the ViewModel is cleared.

***

### Customizing Input for Your Game

The handler is `BlueprintType` and `Blueprintable`, so you can subclass it to change behavior. Here are the common customization points:

<div class="gb-stack">
<details class="gb-toggle">

<summary>Changing key bindings</summary>

Override the default key arrays in your subclass or set them at runtime:

```cpp
// In your custom handler subclass constructor or initialization
ConfirmKeys = { EKeys::Gamepad_FaceButton_Bottom, EKeys::SpaceBar };
CancelKeys = { EKeys::Gamepad_FaceButton_Right, EKeys::Escape, EKeys::RightMouseButton };
RotateClockwiseKeys = { EKeys::Gamepad_RightShoulder, EKeys::E };
RotateCounterClockwiseKeys = { EKeys::Gamepad_LeftShoulder, EKeys::Q };
```

These are `TArray<FKey>` properties, so you can also set them in the Blueprint defaults panel or from a settings screen.

</details>
<details class="gb-toggle">

<summary>Adjusting repeat timing</summary>

Tune `InitialRepeatDelay` and `RepeatRate` to match your game's feel:

```cpp
// Faster repeat for a twitchy game
InitialRepeatDelay = 0.25f;
RepeatRate = 0.06f;

// Slower repeat for a methodical game
InitialRepeatDelay = 0.5f;
RepeatRate = 0.15f;
```

Lower values make the cursor feel snappier. Higher values give more control on large grids where overshooting is a problem.

</details>
<details class="gb-toggle">

<summary>Adjusting the analog deadzone</summary>

`StickDeadzone` defaults to `0.3f`. If players report cursor drift (the cursor moves without touching the stick), increase this value. If the stick feels unresponsive, decrease it.

```cpp
// Wider deadzone to prevent drift on worn controllers
StickDeadzone = 0.4f;

// Tighter deadzone for precise controllers
StickDeadzone = 0.2f;
```

> [!INFO]
> This deadzone is independent of the engine's input deadzone settings. It specifically controls when the Tetris grid cursor starts moving, not the raw stick values.

</details>
<details class="gb-toggle">

<summary>Adding custom actions</summary>

Subclass the handler and override `HandleActionInput(Key)` to add game-specific actions:

```cpp
void UMyTetrisInputHandler::HandleActionInput(FKey Key)
{
    // Call parent for default confirm/cancel/rotate handling
    Super::HandleActionInput(Key);

    // Add custom actions
    if (QuickTransferKeys.Contains(Key))
    {
        // Quick-transfer item to another container
        HandleQuickTransfer();
    }
    else if (SplitStackKeys.Contains(Key))
    {
        // Split the stack at cursor
        HandleSplitStack();
    }
}
```

</details>
</div>

***

### Summary

| Concern                          | What Handles It                                         |
| -------------------------------- | ------------------------------------------------------- |
| Digital movement (D-pad, arrows) | `HandleNavigationInput()` with auto-repeat              |
| Analog movement (left stick)     | `HandleAnalogNavigation()` with deadzone and repeat     |
| Confirm/cancel/rotate            | `HandleActionInput()` + `HandleConfirmAction()`         |
| Repeat timing                    | `Tick()` drives timers; `ResetState()` clears them      |
| Customization                    | Subclass, override key arrays, adjust timing properties |

The input handler is deliberately simple, it is a translator, not a decision-maker. All game logic (can this item be placed? should this rotation be allowed?) lives in the [Tetris View Model](tetris-view-model.md). The handler just asks the questions.
