# Live Inspection UI

A player right-clicks a weapon in their inventory. A panel slides open showing a full 3D model of the weapon,every attachment visible, every detail rendered. They click and drag to rotate it, scroll to zoom in on the engraving, then release. The model smoothly returns to its default pose.

All of that is driven by one widget: `UInventoryRepresentationWidget`.

***

### What the Widget Does

`UInventoryRepresentationWidget` is a specialized UMG User Widget that bridges the gap between the UI layer and the hidden PocketWorlds rendering system. Its responsibilities:

* **Manages a pocket level** - Spawns a private pocket world instance for this specific inspection widget
* **Displays the render target** - Shows the 3D render from `UPocketCapture` inside a UMG Image element
* **Handles player input** - Captures mouse drag, release, and scroll events over the rendered image
* **Forwards interaction** - Relays rotation deltas and FOV changes to the `APocketLevelStageManager`
* **Stays in sync** - Reacts to external item visual changes (e.g., an attachment added while the panel is open) and refreshes the preview

***

### Widget Lifecycle

{% stepper %}
{% step %}
#### NativeConstruct - Spawn the Pocket World

When the widget is created:

* Gets the `UPocketLevelBridgeSubsystem`
* Calls `SpawnPocketLevelWithUniqueID` using the `InventoryPocketLevelDefinition` property, this creates a unique, private pocket world for this widget instance
* Stores the returned `PocketInstanceID`
* Streams the pocket level out initially, then registers a callback for `OnReadyEvent` and streams it back in
* Binds button press/release delegates on `RenderButtonContainer`
{% endstep %}

{% step %}
#### OnInventoryLevelReady - Wire Up the Rendering

Once the pocket level is fully loaded and visible:

* Gets the `APocketLevelStageManager` and `UPocketCapture` from the bridge subsystem
* Gets the dynamic material instance from `RenderImage`
* Sets the `Diffuse` and `AlphaMask` texture parameters on the material, pointing them at the render targets from `UPocketCapture`
* If `InitialiseInspection` was already called with an item, stages it now
* Calls `CaptureFrame()` for the initial render
* Fires the `InitialiseFinished()` Blueprint Native Event
{% endstep %}

{% step %}
#### InitialiseInspection - Set the Item

Called externally (e.g., by a parent inventory UI) to specify which item to display:

* Stores the `ULyraInventoryItemInstance`
* If the Stage Manager is already valid, immediately calls `Initialise(ItemInstance)` to stage the item
* If the level is not ready yet, staging happens later inside `OnInventoryLevelReady`
* Registers a listener for `TAG_Lyra_Inventory_Message_ItemVisualChange` to detect external changes (like attachments being modified while the panel is open)
{% endstep %}

{% step %}
#### User Input - Rotate and Zoom

While the widget is active, it processes player input:

* **Press:** Sets `bIsRotating = true`, captures the initial mouse position
* **Tick:** While rotating, calculates mouse delta, calls `ManualRotation()` on the Stage Manager, and re-captures the frame
* **Scroll:** Calls `SetFOV()` on the Stage Manager and re-captures
* **Release:** Sets `bIsRotating = false`; optionally resets rotation if `bResetRotationOnLoseFocus` is configured
* **Right-click:** Triggers `ResetRotation(true)` for a smooth return to the default pose
{% endstep %}

{% step %}
#### NativeDestruct - Clean Up

When the widget is destroyed:

* Unregisters the item visual change listener
* Removes the `OnReadyEvent` callback
* Calls `DestroyPocketLevelInstance(PocketInstanceID)` on the bridge subsystem to tear down the private pocket world
{% endstep %}
{% endstepper %}

***

### UMG Setup

When creating a Blueprint widget derived from `UInventoryRepresentationWidget`, set up two bound child widgets:

#### RenderImage (UMG Image - Required)

```
Binding:    meta = (BindWidget)
Material:   Set to an instance of CameraRenderMaterial
```

This is the core visual element where the 3D render appears. The `CameraRenderMaterial` should sample two texture parameters:

* **`Diffuse`** - The full-color render target
* **`AlphaMask`** - The transparency mask render target

The widget's code dynamically assigns the correct `UTextureRenderTarget2D` assets to these parameters during `OnInventoryLevelReady`. The UMG Image updates automatically as the render targets change.

#### RenderButtonContainer (UMG Button - Recommended)

```
Binding:      meta = (BindWidget)
Click Method: Mouse Down (set in UMG Editor details)
Style:        Invisible or minimal
```

Place this button visually over the `RenderImage`. Buttons provide more reliable drag capture (press-hold-release) than Image widgets directly. Bind `OnPressed` to `OnRenderButtonPressed` and `OnReleased` to `OnRenderButtonReleased`.

> [!INFO]
> The button does not need to be visually styled -- it just needs to be positioned on top of the render image to intercept mouse events reliably.

***

### Responding to External Visual Changes

If an attachment is added or removed from the item while the inspection panel is open, the widget handles it automatically:

```cpp
// Registered during InitialiseInspection
void OnItemVisualChangeMessage(FGameplayTag Channel,
                                const FItemInstanceVisualChangeMessage& Payload)
{
    // If this message is about our item, re-stage and re-capture
    if (Payload.ItemInstance == ItemInstance)
    {
        PocketLevelStageManager->Initialise(ItemInstance);
        CaptureFrame();
    }
}
```

This uses `UGameplayMessageSubsystem` with the `TAG_Lyra_Inventory_Message_ItemVisualChange` channel, so any system that modifies an item's visual state just needs to broadcast on that channel.

***

### Input Handling Internals

<details class="gb-toggle">

<summary>How mouse input flows through the system</summary>

**Rotation (click-drag):**

1. `OnRenderButtonPressed()` sets `bIsRotating = true` and stores `LastMousePositionX` / `LastMousePositionY`
2. `NativeTick()` runs every frame - if `bIsRotating`, it reads the current mouse position, computes the delta, calls `PocketLevelStageManager->ManualRotation(DeltaX, DeltaY)`, updates the stored position, and calls `CaptureFrame()`
3. `OnRenderButtonReleased()` sets `bIsRotating = false`; if the item's `InventoryFragment_Inspect` has `bResetRotationOnLoseFocus = true`, the rotation resets smoothly

**Zoom (scroll wheel):**

1. `NativeOnMouseWheel()` fires when the player scrolls over the widget
2. If the Stage Manager is valid, calls `PocketLevelStageManager->SetFOV(WheelDelta)` and `CaptureFrame()`

**Reset (right-click):**

1. `OnRenderImageButtonDown()` checks for the right mouse button
2. Calls `PocketLevelStageManager->ResetRotation(true)` for a smooth animated reset
3. Captures a new frame

</details>

***

### Blueprint-Callable Functions

| Function                                         | Description                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `SetManualRotation(const FRotator& NewRotation)` | Set the item's rotation directly from Blueprint                                                 |
| `SetManualFOV(float FOV)`                        | Set the camera FOV directly from Blueprint                                                      |
| `InitialiseFinished()` (BlueprintNativeEvent)    | Override in Blueprint to run logic after the pocket world is ready and the first item is staged |

***

The `UInventoryRepresentationWidget` orchestrates a surprisingly complex pipeline, pocket world spawning, level streaming, material wiring, render target management, input processing, and presents it as a single drag-and-drop widget in your UI. Players just see a smooth, interactive 3D preview.
