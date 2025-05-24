# Player Camera Management

While the `ULyraCameraComponent` on the Pawn manages the _how_ of camera positioning through modes and stacks, the `APlayerCameraManager` class sits at a higher level within Unreal Engine's framework, associated directly with the `APlayerController`. It orchestrates the final viewtarget selection and applies post-processing effects. This asset provides a custom `ALyraPlayerCameraManager` and a helper component for UI camera control.

### `ALyraPlayerCameraManager`

This class serves as the project's base class for the Player Camera Manager, inheriting directly from the engine's `APlayerCameraManager`.

* **Inheritance:** `AActor` -> `APlayerCameraManager` -> `ALyraPlayerCameraManager`
* **Purpose:** To act as the central point for camera management associated with a player controller, integrating Lyra-specific debugging and potentially handling transitions or overrides (like the UI camera).

**Key Features & Responsibilities:**

1. **Extends Base Functionality:** Inherits all the standard responsibilities of `APlayerCameraManager`, including managing view target transitions (`SetViewTarget`), applying camera shakes, handling FOV, and applying post-processing effects defined on the camera manager itself.
2. **Default Settings:** Sets project-specific defaults in its constructor:
   * `DefaultFOV = LYRA_CAMERA_DEFAULT_FOV` (e.g., 80.0)
   * `ViewPitchMin = LYRA_CAMERA_DEFAULT_PITCH_MIN` (e.g., -89.0)
   * `ViewPitchMax = LYRA_CAMERA_DEFAULT_PITCH_MAX` (e.g., 89.0)
   * These defaults can be influential if no specific camera mode is active or during certain transitions.
3. **UI Camera Component Integration:**
   * Creates and owns an instance of `ULyraUICameraManagerComponent` named `UICamera`.
   * Provides an accessor `GetUICameraComponent()` to retrieve this component.
4. **View Target Update Logic (`UpdateViewTarget` Override):**
   * Overrides the base `UpdateViewTarget` function.
   * **Prioritizes UI Camera:** Before performing the standard view target update logic, it checks if the `UICamera` component `NeedsToUpdateViewTarget()`. _Currently, this function always returns `false`, meaning the UI Camera component doesn't actively override the view target selection in the provided code._ If it were to return true, it would call `UICamera->UpdateViewTarget` _after_ the base `Super::UpdateViewTarget`, potentially modifying the final `FTViewTarget` (though the provided `ULyraUICameraManagerComponent::UpdateViewTarget` is also empty).
   * If the UI camera doesn't need priority, it simply calls `Super::UpdateViewTarget(OutVT, DeltaTime)` to perform the standard engine logic (which typically involves getting the view information from the possessed Pawn's `ULyraCameraComponent` via `CalcCamera`).
5. **Debugging (`DisplayDebug` Override):**
   * Overrides the `DisplayDebug` function called when `showdebug camera` is active.
   * Adds its own header (`LyraPlayerCameraManager: ...`).
   * Calls the `Super::DisplayDebug` to show standard camera manager info.
   * Crucially, it finds the `ULyraCameraComponent` on the currently controlled Pawn (if any) and calls **`CameraComponent->DrawDebug(Canvas)`**. This allows the detailed debug information from the camera component and its active camera mode stack to be displayed under the camera manager's debug section, providing a complete picture.

### `ULyraUICameraManagerComponent`

This component, owned by `ALyraPlayerCameraManager`, is designed to handle scenarios where the game's UI needs to take temporary control over the camera's view target.

* **Inheritance:** `UActorComponent` -> `ULyraUICameraManagerComponent`
* **Purpose:** To provide a mechanism for UI systems or specific gameplay states (like a spectator mode focusing on a UI element or a specific point) to dictate the camera's focus, overriding the normal Pawn-following behavior.

**Key Features & Responsibilities:**

1. **Initialization:** Standard component initialization. Includes a hook for `AHUD::OnShowDebugInfo` for potential future debugging displays.
2. **View Target Control:**
   * **`SetViewTarget(AActor* InViewTarget, FViewTargetTransitionParams TransitionParams)`:** This is the primary function for the UI system to call. It stores the desired `InViewTarget` and then calls the owning `ALyraPlayerCameraManager::SetViewTarget`, initiating a standard engine view target blend.
   * `GetViewTarget()`: Returns the currently assigned UI view target actor.
   * `IsSettingViewTarget()`: Returns true temporarily while `SetViewTarget` is executing.
3. **Integration with Player Camera Manager:**
   * **`NeedsToUpdateViewTarget()`:** _Intended_ to signal `ALyraPlayerCameraManager` whether this component currently wants to override or modify the view target. **In the provided code, this always returns `false`**, meaning the override logic in `ALyraPlayerCameraManager::UpdateViewTarget` is currently inactive.
   * **`UpdateViewTarget(struct FTViewTarget& OutVT, float DeltaTime)`:** _Intended_ to allow modification of the final `FTViewTarget` structure after the base `APlayerCameraManager` logic runs. **In the provided code, this function is empty.**

**Current State & Potential Use:**

Based _strictly_ on the provided code:

* The `ULyraUICameraManagerComponent` exists and can be assigned a view target via `SetViewTarget`. This _will_ trigger a standard camera manager blend to that target.
* However, the override logic in `ALyraPlayerCameraManager::UpdateViewTarget` that specifically checks and uses the `UICamera` component is effectively dormant because `NeedsToUpdateViewTarget` always returns false.
* This suggests the component might be intended for future use, specific UI frameworks not included here, or relies on modifications in derived classes to fully enable its view target override capabilities during the main update loop. Its primary current function seems to be triggering standard view target blends initiated externally.

**Interaction Summary:**

1. The `APlayerController` owns an `ALyraPlayerCameraManager`.
2. The `ALyraPlayerCameraManager` owns a `ULyraUICameraManagerComponent`.
3. During the camera update (`UpdateViewTarget`), the `ALyraPlayerCameraManager` performs the standard logic, which usually involves querying the possessed Pawn's `ULyraCameraComponent` for its view via `CalcCamera`.
4. External UI systems _can_ call `ULyraUICameraManagerComponent::SetViewTarget` to make the `ALyraPlayerCameraManager` blend to a different actor, but the component doesn't actively take control during the regular `UpdateViewTarget` flow in the provided base implementation.
5. For debugging (`showdebug camera`), `ALyraPlayerCameraManager` ensures that the detailed debug info from the Pawn's `ULyraCameraComponent` is also drawn.

