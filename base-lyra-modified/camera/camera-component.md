# Camera Component

The `ULyraCameraComponent` is the central orchestrator for the camera system attached to a specific actor, typically the player's Pawn. It extends Unreal Engine's standard `UCameraComponent` and integrates the mode stacking and blending logic.

### Role and Placement

* **Role:** To manage the active camera modes, calculate the final blended camera view based on those modes, and apply that view (location, rotation, FOV) to the underlying camera used for rendering.
* **Placement:** This component should be added to the actor whose perspective the camera needs to follow or be relative to. In most cases, this will be the `ALyraCharacter` Blueprint. It functions as the actual camera actor in the scene whose properties are dynamically updated each frame by the camera mode stack.

<img src=".gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" width="375" title="LyraCameraComponent  placement in ALyraCharacter">

### Key Responsibilities & Features

1. **Manages the Camera Mode Stack:**
   * Owns and initializes a `ULyraCameraModeStack` instance (`CameraModeStack`). This stack is responsible for holding the list of active `ULyraCameraMode` instances and performing the blending calculations.
2. **Determines Base Camera Mode:**
   * Uses the `DetermineCameraModeDelegate` to ask external systems (typically the `ULyraHeroComponent`) which `ULyraCameraMode` class should be the primary, default mode based on the current gameplay state (e.g., third-person view, aiming view).
   * In `UpdateCameraModes`, if the delegate is bound and the stack is active, it executes the delegate and pushes the returned camera mode class onto the stack.
3. **Calculates and Applies Final View (`GetCameraView`):**
   * This is the main update function, overriding the base `UCameraComponent` method.
   * It orchestrates the frame's camera update:
     * Calls `UpdateCameraModes()` to potentially push the delegate-determined mode.
     * Instructs the `CameraModeStack` to update its internal state and calculate the final blended view (`CameraModeStack->EvaluateStack(DeltaTime, CameraModeView)`).
     * Applies any temporary single-frame `FieldOfViewOffset`.
     * Sets its own World Location, Rotation, and FieldOfView based on the blended `CameraModeView` result.
     * Populates the `FMinimalViewInfo` structure required by the engine's camera update pipeline.
4. **Target Actor Tracking:**
   * Maintains a reference to the `TargetActor` (usually the component's owner). Camera modes use this via `GetTargetActor()` to know who they are following or basing calculations on.
   * Can be set explicitly via `SetTargetActor()`.
5. **External Mode Pushing:**
   * Provides `PushCameraMode(TSubclassOf<ULyraCameraMode> CameraModeClass)` to allow external systems (like Gameplay Abilities) to directly push a specific camera mode onto the stack, temporarily overriding or layering on top of the base mode.\
     **Note:** If `DetermineCameraModeDelegate` is bound, it overrides all other camera mode logic, and calling `PushCameraMode` will have no effect.
6. **Field of View Offsets:**
   * Allows for temporary, one-frame adjustments to the FOV via `AddFieldOfViewOffset(float FovOffset)`. This is useful for brief effects like a recoil kick impacting FOV. The offset is cleared after being applied in `GetCameraView`.
7. **Debugging Support:**
   * Implements `DrawDebug(UCanvas* Canvas)` which displays basic component info and delegates further drawing to the `CameraModeStack` and active modes, providing visual debugging information on screen when enabled (`showdebug camera`).
8. **Blend Information Query:**
   * `GetBlendInfo(float& OutWeightOfTopLayer, FGameplayTag& OutTagOfTopLayer)` allows querying the blend weight and type tag of the current top-most _fully blended_ layer in the stack (the last mode with BlendWeight < 1.0, or the bottom mode if all are 1.0).
9. **Camera Mode Change Notifications:**
   * Detects when the effective top camera mode instance changes between frames.
   * Broadcasts a `FLyraCameraModeChangedMessage` via the `UGameplayMessageSubsystem` using the `TAG_Lyra_Camera_Message_CameraModeChanged` tag whenever the top mode changes. Other systems can listen for these messages to react to camera perspective shifts.

### `GetCameraView` Workflow Breakdown

The `GetCameraView` override is where the magic happens each frame:

```cpp
void ULyraCameraComponent::GetCameraView(float DeltaTime, FMinimalViewInfo& DesiredView)
{
    // 1. Ensure the CameraModeStack exists
    check(CameraModeStack);

    // 2. Query the delegate and update the base mode on the stack
    UpdateCameraModes(); // Calls DetermineCameraModeDelegate.Execute() -> CameraModeStack->PushCameraMode()

    // 2.5 Detect if the top mode instance changed since last frame
    ULyraCameraMode* CurrentCameraMode = CameraModeStack->GetTopCameraMode();
    if (CurrentCameraMode != PreviousCameraMode)
    {
        // Broadcast a message about the change
        FLyraCameraModeChangedMessage Message;
        // ... populate message ...
        UGameplayMessageSubsystem::Get(this).BroadcastMessage(TAG_Lyra_Camera_Message_CameraModeChanged, Message);
        PreviousCameraMode = CurrentCameraMode;
    }

    // 3. Evaluate the stack: Updates modes, blends their views
    FLyraCameraModeView CameraModeView;
    CameraModeStack->EvaluateStack(DeltaTime, CameraModeView); // This calculates the blended Location, Rotation, FOV

    // 4. Apply temporary FOV offset
    CameraModeView.FieldOfView += FieldOfViewOffset;
    FieldOfViewOffset = 0.0f; // Clear the offset for next frame

    // 5. Apply the calculated view to this CameraComponent
    SetWorldLocationAndRotation(CameraModeView.Location, CameraModeView.Rotation);
    FieldOfView = CameraModeView.FieldOfView;

    // 6. Populate the engine's DesiredView structure
    DesiredView.Location = CameraModeView.Location;
    DesiredView.Rotation = CameraModeView.Rotation;
    DesiredView.FOV = CameraModeView.FieldOfView;
    // ... copy other standard view properties ...

    // 7. Handle PostProcessing and XR overrides (standard UCameraComponent logic)
    // ...
}
```

### Interaction with `ULyraHeroComponent`

While the `ULyraCameraComponent` manages the stack, it doesn't typically decide the _base_ camera mode itself. This decision is usually delegated:

* The `ULyraHeroComponent` (on player-controlled pawns) implements the logic in its `DetermineCameraMode` function.
* In `ULyraHeroComponent::HandleChangeInitState` (when reaching `DataInitialized`), it binds its `DetermineCameraMode` function to the `ULyraCameraComponent::DetermineCameraModeDelegate`.
* This delegate binding allows the `HeroComponent` to tell the `CameraComponent` whether the player should be in the default third-person mode, an aiming mode, etc., based on player input or ability state.

This delegation keeps the camera management logic separate from the input/gameplay state logic.

