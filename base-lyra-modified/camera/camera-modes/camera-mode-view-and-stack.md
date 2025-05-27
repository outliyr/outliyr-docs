# Camera Mode View & Stack

While individual `ULyraCameraMode` instances define specific camera behaviors, two key components work together to bring these behaviors into a cohesive final view: the `FLyraCameraModeView` struct and the `ULyraCameraModeStack` class.

### `FLyraCameraModeView` (The View Data)

The `FLyraCameraModeView` is a simple yet crucial `struct` that serves as the standardized output format for any `ULyraCameraMode`.

* **Purpose:** To encapsulate the core visual parameters calculated by a camera mode for a single frame. This data is then used by the `ULyraCameraModeStack` for blending between different active modes.

### **Structure:**

The struct contains the following members:

* **`Location` (FVector):** The desired world-space location of the camera.
* **`Rotation` (FRotator):** The desired world-space orientation (rotation) of the camera.
* **`ControlRotation` (FRotator):** The desired control rotation of the player/controller. This can be different from the `Rotation` of the camera itself (e.g., in true first-person systems where the camera might have procedural animations while the control rotation remains smooth). The base `ULyraCameraMode::UpdateView` sets this to be the same as `View.Rotation`, but derived modes can modify it.
* **`FieldOfView` (float):** The desired horizontal field of view (in degrees) for the camera.

### **Key Functionality:**

* **Initialization:** The default constructor initializes `Location` and `Rotation` to zero vectors/rotators and `FieldOfView` to `LYRA_CAMERA_DEFAULT_FOV`.
* **Blending (`Blend(const FLyraCameraModeView& Other, float OtherWeight)`):**
  * This static member function is the core of how different camera perspectives are combined.
  * It takes another `FLyraCameraModeView` (`Other`) and a `OtherWeight` (ranging from 0.0 to 1.0) as input.
  * If `OtherWeight` is <= 0.0, the current view remains unchanged.
  * If `OtherWeight` is >= 1.0, the current view is completely replaced by `Other`.
  * Otherwise, it performs interpolation:
    * `Location`: Linearly interpolated (`FMath::Lerp`).
    * `Rotation` & `ControlRotation`: Interpolated by calculating the normalized delta rotation and scaling it by `OtherWeight`. This provides a form of spherical linear interpolation (Slerp) suitable for rotators.
    * `FieldOfView`: Linearly interpolated (`FMath::Lerp`).
  * The `ULyraCameraModeStack` uses this function repeatedly to blend up its stack of active modes.

Each `ULyraCameraMode` instance calculates and populates its own `FLyraCameraModeView` member (named `View`) during its `UpdateView` call.

### `ULyraCameraModeStack` (The Manager)

The `ULyraCameraModeStack` is a `UObject` class owned and managed by the `ULyraCameraComponent`. It is the engine that drives the camera mode system.

* **Purpose:**
  * To maintain an ordered collection (a stack) of currently active `ULyraCameraMode` instances.
  * To instantiate, activate, deactivate, and update these camera modes.
  * To calculate the final, blended camera view by combining the outputs (`FLyraCameraModeView`) of all active modes according to their blend weights.

**Internal Data Structures:**

* **`CameraModeInstances` (TArray\<TObjectPtr>):**
  * A list that stores a reference to every `ULyraCameraMode` instance that has been created for this stack. This acts as a pool to prevent re-creating mode instances if the same mode class is pushed multiple times.
* **`CameraModeStack` (TArray\<TObjectPtr>):**
  * The core data structure representing the _currently active and ordered_ stack of camera modes.
  * Index `0` is considered the "top" of the stack – the mode with the highest priority or the one most recently pushed.
  * The mode at the "bottom" of the stack (highest index) always has a blend weight of 1.0, serving as the base view if no other modes are significantly blended in.

### **Key Operations:**

1. **Pushing and Managing Modes:**
   * **`PushCameraMode(TSubclassOf<ULyraCameraMode> CameraModeClass)`:**
     * This is the primary method used by `ULyraCameraComponent` (or other systems) to request that a specific camera mode become active.
     * It first retrieves or creates an instance of the `CameraModeClass` using `GetCameraModeInstance`.
     * If this mode is already at the top of the `CameraModeStack`, it does nothing.
     * If the mode exists elsewhere in the stack, it's removed from its current position. The stack calculates its "contribution" (its effective blend weight considering modes above it) before removal. This contribution is used to set the initial blend weight when re-inserting it at the top, allowing for smoother transitions if a mode is re-prioritized.
     * The mode is then inserted at index `0` (top) of the `CameraModeStack`.
     * The mode's blend weight is initialized: if blending is enabled (`BlendTime` > 0) and other modes are present, it uses the calculated existing contribution; otherwise, it's set to 1.0 (instant).
     * If the mode was not previously in the active stack, its `OnActivation()` method is called.
     * Finally, it ensures the mode at the very bottom of the stack always has its blend weight set to 1.0.
2. **Updating the Stack (`UpdateStack(float DeltaTime)`):**
   * Called every frame by `EvaluateStack`.
   * Iterates through each `ULyraCameraMode` in the `CameraModeStack`.
   * Calls `CameraMode->UpdateCameraMode(DeltaTime)` on each. This allows the mode to update its internal logic, calculate its new `FLyraCameraModeView`, and update its `BlendAlpha` and `BlendWeight`.
   * After updating all modes, it checks if any mode (starting from the top) has reached a `BlendWeight` of 1.0. If so, all modes _below_ it in the stack are deemed irrelevant (as they would be completely overwritten). These lower modes are removed from the `CameraModeStack`, and their `OnDeactivation()` method is called. This keeps the stack clean and efficient.
3. **Blending the Stack (`BlendStack(FLyraCameraModeView& OutCameraModeView) const`):**
   * Called every frame by `EvaluateStack` after `UpdateStack`.
   * If the stack is empty, it does nothing.
   * It starts by copying the `FLyraCameraModeView` from the mode at the _bottom_ of the stack (which always has a weight of 1.0) into `OutCameraModeView`.
   * It then iterates _upwards_ from the second-to-bottom mode to the top of the stack.
   * For each mode, it calls `OutCameraModeView.Blend(CurrentMode->GetCameraModeView(), CurrentMode->GetBlendWeight())`. This progressively blends the view of each higher-priority mode onto the accumulated result, weighted by the mode's current `BlendWeight`.
   * The final `OutCameraModeView` contains the fully blended perspective.
4. **Overall Evaluation (`EvaluateStack(float DeltaTime, FLyraCameraModeView& OutCameraModeView)`):**
   * This is the main function called by `ULyraCameraComponent::GetCameraView`.
   * If the stack is not active, it returns `false`.
   * Otherwise, it calls `UpdateStack(DeltaTime)` and then `BlendStack(OutCameraModeView)`, returning `true`.
5. **Activation State (`ActivateStack()`, `DeactivateStack()`, `IsStackActivate()`):**
   * Allows the entire stack processing to be paused and resumed.
   * When activated/deactivated, it calls `OnActivation()`/`OnDeactivation()` on all `ULyraCameraMode` instances currently in the `CameraModeStack`.
6. **Instance Management (`GetCameraModeInstance(TSubclassOf<ULyraCameraMode> CameraModeClass)`):**
   * Helper function to retrieve an existing instance of a given `CameraModeClass` from the `CameraModeInstances` pool or create a new one if it doesn't exist. New instances are created as subobjects of the `ULyraCameraComponent` (the outer of the stack).

### **Interaction Summary:**

* `ULyraCameraComponent` uses its `DetermineCameraModeDelegate` (often bound to `ULyraHeroComponent`) to decide which base mode should be active. It then calls `ULyraCameraModeStack::PushCameraMode` with this mode.
* Abilities or other gameplay systems can also call `ULyraCameraComponent::PushCameraMode` to temporarily add or override camera modes.
* The `ULyraCameraModeStack` then takes over, ensuring each active `ULyraCameraMode` updates itself, calculates its `FLyraCameraModeView`, and updates its blend weight.
* Finally, the stack blends all these views together into a single `FLyraCameraModeView`, which `ULyraCameraComponent` uses to set the final camera properties for rendering.

This separation of concerns – individual modes defining behavior, a view struct defining the data, and a stack defining the management and blending – creates a highly flexible and powerful camera system.
