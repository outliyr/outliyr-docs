# Supporting Interfaces

To allow different actors and controllers to provide hints or specific data to the camera system without requiring direct coupling or complex casting, interfaces are used. The primary interface defined for camera interactions is `ILyraCameraAssistInterface`.

### `ILyraCameraAssistInterface`

* **Type:** Unreal Engine Interface (`UInterface`). Actors or components can choose to implement this interface.
* **Purpose:** To provide a standardized way for actors (especially the camera's view target or its controller) to communicate specific needs or information back to camera modes, particularly the `ULyraCameraMode_ThirdPerson`'s penetration avoidance logic.

#### **Interface Functions:**

1. **`GetIgnoredActorsForCameraPentration(TArray<const AActor*>& OutActorsAllowPenetration) const`**
   * **Purpose:** Allows an implementing actor (like the possessed Pawn or a vehicle) to provide a list of other actors that the camera's penetration checks should _ignore_.
   * **Use Case:** Essential for third-person cameras. The main camera feeler ray needs to ignore the player pawn itself, otherwise, the camera would always collide with the pawn. If the pawn is inside a vehicle, the vehicle might also need to be ignored.
   * **Implementation:** An actor implementing this interface should add pointers to the actors to be ignored into the `OutActorsAllowPenetration` array.
   * **Caller:** The penetration avoidance logic (like in `ULyraCameraMode_ThirdPerson::PreventCameraPenetration`) _should_ ideally call this on the view target or related actors and add the returned actors to its `FCollisionQueryParams` ignore list. _(Note: The provided `PreventCameraPenetration` code currently only explicitly ignores the `ViewTarget` itself and actors tagged with `IgnoreCameraCollision`. A more complete implementation might query this interface)._
2. **`GetCameraPreventPenetrationTarget() const`**
   * **Purpose:** Allows an implementing actor (usually the main view target) to specify a _different_ actor that should be used as the primary reference for penetration calculations.
   * **Use Case:** Sometimes, the actor being directly controlled or viewed (`GetTargetActor()` result) isn't the most important actor to keep clear of obstructions. For example, if the player is controlling a character who is riding a large mount, the camera might technically be targeting the character, but the penetration logic should really be focused on keeping the _mount_ from being obscured or clipped into by the camera pulling in too close. In this case, the character (implementing the interface) could return the mount actor from this function.
   * **Return Value:** `TOptional<AActor*>`. Returns an optional pointer. If it returns a valid actor pointer, the camera mode should use _that_ actor for its penetration calculations (determining the `SafeLoc`, etc.). If it returns an unset optional (or the interface isn't implemented), the camera mode defaults to using its main `TargetActor`.
   * **Caller:** `ULyraCameraMode_ThirdPerson::UpdatePreventPenetration` calls this on the `TargetActor` (if it implements the interface) to determine the effective actor (`PPActor`) for penetration checks.
3. **`OnCameraPenetratingTarget()`**
   * **Purpose:** This function is _called by_ the camera mode when its penetration logic detects that the camera has been pushed very close to the target due to collisions.
   * **Use Case:** Allows the implementing actor (or its controller) to react when the camera is heavily penetrating its space. The most common reaction is to fade out or hide the target actor's mesh, preventing the player from seeing inside their own character model when the camera is forced up close by a wall.
   * **Implementation:** An actor implementing this would typically trigger logic to hide relevant components (like the Skeletal Mesh) or start a fade-out effect.
   * **Caller:** `ULyraCameraMode_ThirdPerson::UpdatePreventPenetration` calls this on the `TargetControllerAssist`, `TargetActorAssist`, and `PPActorAssist` (if they implement the interface) when the calculated `AimLineToDesiredPosBlockedPct` falls below the `ReportPenetrationPercent` threshold.

#### **How to Use:**

* Identify which actors or controllers need to influence camera behavior (e.g., the player character Blueprint, a vehicle Blueprint, potentially the Player Controller C++ class).
* Add the `ILyraCameraAssistInterface` to the inheritance list of that class (in C++ or via "Class Settings" -> "Interfaces" in Blueprint).
* Implement the required functions (in C++ or by adding the corresponding events in the Blueprint Event Graph).
* The camera modes (specifically `ULyraCameraMode_ThirdPerson` in this case) will automatically check if their target actor or controller implements the interface and call the relevant functions.

***

By implementing `ILyraCameraAssistInterface`, actors can communicate critical information to the camera system in a clean, decoupled way. This ensures flexible and maintainable camera behavior across various gameplay scenarios.

Next, we’ll look at how the `ALyraPlayerCameraManager` ties everything together at a higher level, managing view targets and integrating camera components like UI control.

