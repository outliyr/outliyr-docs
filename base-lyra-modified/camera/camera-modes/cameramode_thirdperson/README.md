# CameraMode_ThirdPerson

> [!warning]
> **This page explains the inner workings of the C++ implementation of `CameraMode_ThirdPerson`.** While some variables are exposed and accessible in the corresponding Blueprint class, not all functionality is visible. The Blueprint is designed to abstract away the internal details, allowing you to focus on high-level customization when subclassing.

This class provides a concrete implementation of a third-person camera mode, inheriting from `ULyraCameraMode`. It serves as a robust starting point for games requiring a camera that follows the player character, dynamically adjusts its position based on view pitch, handles vertical changes like crouching, and incorporates sophisticated logic to prevent clipping into the environment.

* **Inheritance:** `UObject` -> `ULyraCameraMode` -> `ULyraCameraMode_ThirdPerson`
* **Key Features:**
  * Pitch-based camera offset using curves.
  * Smooth handling of character crouching.
  * Advanced penetration avoidance system using feeler rays.
  * Configurable blending and collision parameters.

### Basic Setup

This section describes how the camera positions itself relative to the target actor, assuming no obstructions.

**1. Calculating the Base View (`UpdateView` Override)**

The core logic happens within the overridden `UpdateView` function each frame:

* **Target & Pivot:** It first determines the target actor (usually the Pawn) and calculates a smoothed pivot location (`CurrentPivotLocation`) and rotation (`CurrentPivotRotation`). Smoothing (using `FMath::VInterpTo` and `FMath::RInterpTo`) helps reduce camera jitter if the target's movement is not perfectly smooth, although it uses the raw target rotation if a controller is present.
* **Crouch Adjustment:** It calls internal functions (`UpdateForTarget`, `UpdateCrouchOffset`) to calculate and smoothly apply a vertical offset (`CurrentCrouchOffset`) if the target character is crouching. This offset is added to the pivot location.
* **Pitch Clamping:** The final pivot rotation's pitch is clamped within the `ViewPitchMin` and `ViewPitchMax` limits defined in the camera mode's properties.
* **Offset Application:** The primary positioning is done using offset curves. Based on the `bUseRuntimeFloatCurves` flag:
  * If `false` (default), it evaluates the assigned `TargetOffsetCurve` (a `UCurveVector` asset) using the final clamped pitch as the input time. This curve provides an X, Y, and Z offset in local space relative to the pivot.
  * If `true`, it evaluates the three `FRuntimeFloatCurve` members (`TargetOffsetX`, `TargetOffsetY`, `TargetOffsetZ`) using the pitch.
  * This calculated local offset vector is rotated by the final pivot rotation and added to the adjusted pivot location (PivotLocation + CurrentCrouchOffset) to get the initial desired camera location.
* **Setting the View:** The calculated pivot rotation (after pitch clamping) and the initial desired location are assigned to the `View.Rotation` and `View.Location` members of the `FLyraCameraModeView` struct. The `View.ControlRotation` is also set to the pivot rotation, and `View.FieldOfView` is set from the mode's property.
* **Penetration Check:** _After_ calculating this initial desired position, it calls `UpdatePreventPenetration(DeltaTime)` which may further adjust `View.Location` based on collision checks (detailed in the next section).

**2. Handling Crouching**

To prevent the camera from clipping into the ground or staying too high when the character crouches, the mode applies a vertical offset:

* **`UpdateForTarget`:** Checks if the target actor is a crouched `ACharacter`. If so, it calculates the difference between the character's default eye height and crouched eye height.
* **`SetTargetCrouchOffset`:** Stores this calculated vertical offset (or ZeroVector if not crouching) as the target and resets the blend interpolation (`CrouchOffsetBlendPct` to 0).
* **`UpdateCrouchOffset`:** Smoothly interpolates the `CurrentCrouchOffset` towards the `TargetCrouchOffset` over time, using `FMath::InterpEaseInOut` and the configurable `CrouchOffsetBlendMultiplier`. This interpolated offset is then used in `UpdateView`.

**3. Determining Pivot Rotation (`GetPivotRotation` Override)**

To handle different control scenarios appropriately:

* If the target Pawn has a `Controller`, it returns `APawn::GetViewRotation()` (which usually reflects the controller's aim).
* If the target Pawn _lacks_ a `Controller` (like a simulated proxy), it returns `APawn::GetBaseAimRotation()` for a more stable rotation based on the character's mesh orientation.

**4. Initialization (`OnActivation` Override)**

When this mode becomes active, the `OnActivation` override ensures a smooth start by:

* Calling the base implementation (`Super::OnActivation()`) which handles adding the `CameraTagToAddToPlayer`.
* Initializing the `CurrentPivotLocation` and `CurrentPivotRotation` smoothed values to the target's _current_ pivot values, preventing the interpolation logic from starting with incorrect old values.

### Penetration Avoidance

This is a critical feature for third-person cameras, preventing the camera from clipping into walls and other objects, which can obstruct the player's view.

**1. Concept and Configuration**

* **Goal:** To detect potential obstructions between the character's pivot point (`SafeLoc`, slightly adjusted from the actual pivot) and the desired camera location (`View.Location`) and push the camera forward along the view line just enough to avoid the collision.
* **Enablement:** Controlled by the `bPreventPenetration` boolean.
* **Smoothing:** `PenetrationBlendInTime` and `PenetrationBlendOutTime` control how quickly the camera interpolates towards a newly detected collision point or away from a receding one, preventing jarring snaps.
* **Prediction:** `bDoPredictiveAvoidance` enables using additional "feeler rays" to anticipate collisions if the player were to rotate the camera, pulling the camera in slightly earlier.
* **Pushout:** `CollisionPushOutDistance` adds a small buffer distance away from the actual hit surface.

**2. Feeler Rays (`FLyraPenetrationAvoidanceFeeler`)**

The system uses multiple sphere traces (feelers) to detect collisions:

* The `PenetrationAvoidanceFeelers` array holds configurations for each feeler ray.
* **`FLyraPenetrationAvoidanceFeeler` struct:**
  * `AdjustmentRot`: Defines the rotational offset of this feeler relative to the main camera view line (Pivot to Desired Location). Predictive feelers have non-zero Yaw/Pitch.
  * `WorldWeight` / `PawnWeight`: How strongly hitting static world geometry vs. hitting a Pawn affects the camera push-in distance calculation (allows tuning how much hitting other characters pushes the camera).
  * `Extent`: The radius of the sphere used for the trace. The main feeler (index 0) typically has the largest extent.
  * `TraceInterval`: How many frames to wait between traces for this feeler _if it didn't hit anything_ last time (optimization). A hit resets the interval to 0.
* The default configuration includes a main central feeler (index 0) and several predictive feelers offset horizontally and vertically.

**3. Collision Logic (`UpdatePreventPenetration`, `PreventCameraPenetration`)**

* **`UpdatePreventPenetration`:**
  * Gets the primary penetration target actor (`PPActor`), potentially using `ILyraCameraAssistInterface::GetCameraPreventPenetrationTarget` if implemented on the target, otherwise defaulting to the main `TargetActor`.
  * Calculates a `SafeLoc`: This is a point derived from the `PPActor`'s location, adjusted to be slightly inside its collision volume along the line towards the camera. This serves as a stable starting point for the traces, ensuring they don't start already penetrating the target.
  * Calls `PreventCameraPenetration`.
* **`PreventCameraPenetration`:**
  * Initializes `DistBlockedPctThisFrame` to 1.0 (meaning no blockage).
  * Sets up `FCollisionQueryParams`, ignoring the `ViewTarget` actor and potentially other actors specified via `ILyraCameraAssistInterface`. Actors tagged with `IgnoreCameraCollision` are also ignored dynamically during the loop.
  * Iterates through the active `PenetrationAvoidanceFeelers` (either just the first one if `bDoPredictiveAvoidance` is false, or all of them if true).
  * For each feeler whose `TraceInterval` allows it:
    * Calculates the `RayTarget` based on the `SafeLoc`, the base camera view vector, and the feeler's `AdjustmentRot`.
    * Performs a sphere sweep (`SweepSingleByChannel` using `ECC_Camera`) from `SafeLoc` to `RayTarget` with the feeler's `Extent`.
    * **Hit Processing:**
      * If a hit occurs and the actor isn't ignored (via tag or special `ACameraBlockingVolume` logic):
        * Calculates `NewBlockPct` based on the hit time (`Hit.Time`), adjusted by the feeler's `WorldWeight` or `PawnWeight`.
        * Further refines `NewBlockPct` by considering the actual distance and the `CollisionPushOutDistance`.
        * Updates `DistBlockedPctThisFrame` to the minimum blockage percentage found so far across all feelers.
        * Resets the feeler's `TraceInterval` to 0 so it traces again next frame.
  * **Smoothing Blockage:** Interpolates the final `DistBlockedPct` (used to adjust camera position) based on `DistBlockedPctThisFrame`, the previous frame's `DistBlockedPct`, and the `PenetrationBlendInTime`/`PenetrationBlendOutTime` values. This smooths the camera's movement in/out of collision adjustments.
  * **Applying Blockage:** If the final `DistBlockedPct` is less than 1.0, it moves the camera location (`CameraLoc`, which is `View.Location`) closer to `SafeLoc`: `CameraLoc = SafeLoc + (OriginalCameraLoc - SafeLoc) * DistBlockedPct`.

**4. Penetration Notification:**

* If the final `AimLineToDesiredPosBlockedPct` (calculated primarily from the main feeler ray) is less than the configurable `ReportPenetrationPercent`, the mode iterates through available `ILyraCameraAssistInterface` implementations (on the Controller, Target Actor, and PP Actor) and calls `OnCameraPenetratingTarget()`. This allows systems like character visibility controllers to react when the camera gets too close (e.g., fading out the character mesh).

***

This deep dive into `ULyraCameraMode_ThirdPerson` highlights how it builds on `ULyraCameraMode` to create a responsive and feature-rich third-person camera experience, complete with smooth character tracking and intelligent collision handling.

To support this functionality without tightly coupling to specific actors or controllers, the camera mode leverages interfaces. Next, we’ll explore how the `ILyraCameraAssistInterface` enables dynamic, context-aware behavior, letting actors influence or respond to the camera system without hard dependencies.
