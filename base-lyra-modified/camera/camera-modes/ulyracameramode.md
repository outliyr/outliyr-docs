# ULyraCameraMode

`ULyraCameraMode` is the abstract foundation upon which all specific camera behaviors are built. It provides the essential properties, functions, and integration points required to work within the `ULyraCameraModeStack` managed by the `ULyraCameraComponent`.

* **Inheritance:** `UObject` -> `ULyraCameraMode`
* **Abstract Class:** You cannot use `ULyraCameraMode` directly; you must create a derived class (either in C++ or Blueprint, although the base is marked `NotBlueprintable` suggesting C++ derivation is expected for core logic) and implement the necessary logic.

### **Purpose:**

To provide a standardized framework for defining a camera's desired perspective (location, rotation, FOV) and its blending characteristics when transitioning between different camera modes.

### **Key Properties (Configurable in Derived Classes):**

* **`FieldOfView` (float):**
  * The default horizontal field of view (in degrees) this camera mode aims for.
  * Can be overridden during the `UpdateView` calculation if needed (e.g., dynamic FOV based on speed).
  * _Default Value:_ `LYRA_CAMERA_DEFAULT_FOV` (typically 80.0f).
* **`ViewPitchMin` / `ViewPitchMax` (float):**
  * Define the minimum and maximum allowed pitch angles (in degrees) for the camera's rotation.
  * Clamping is typically applied within the `UpdateView` function of derived classes.
  * _Default Values:_ `LYRA_CAMERA_DEFAULT_PITCH_MIN` / `MAX` (typically -89.0f / +89.0f).
* **`BlendTime` (float):**
  * The duration (in seconds) it takes for this mode to blend in fully (reach a `BlendWeight` of 1.0) when pushed onto the stack.
  * A value of 0.0 indicates an instantaneous transition (snaps instantly to full weight).
* **`BlendFunction` (`ELyraCameraModeBlendFunction`):**
  * Determines the interpolation curve used during the `BlendTime`. Options include:
    * `Linear`: Simple linear interpolation.
    * `EaseIn`: Accelerates quickly, decelerates smoothly towards the end.
    * `EaseOut`: Accelerates smoothly, stops abruptly.
    * `EaseInOut`: Smooth acceleration and deceleration (S-curve).
* **`BlendExponent` (float):**
  * Controls the "sharpness" or intensity of the curve for the `EaseIn`, `EaseOut`, and `EaseInOut` blend functions. Higher values create more pronounced easing.
* **`CameraTypeTag` (`FGameplayTag`):**
  * A _generic_ tag representing the category of this camera mode (e.g., `Camera.Type.ThirdPerson`, `Camera.Type.AimDownSights`, `Camera.Type.FirstPerson`).
  * Allows gameplay systems to query the general state (e.g., "Is _any_ aiming camera active?") without needing to know the specific class. Accessed via `ULyraCameraComponent::GetBlendInfo`.
* **`CameraTagToAddToPlayer` (`FGameplayTag`):**
  * A _specific_ tag that is added as a Loose Gameplay Tag directly to the target actor's Ability System Component when this camera mode becomes active (`OnActivation`) and removed when it becomes inactive (`OnDeactivation`).
  * Useful for systems like Animation Blueprints that need to know the exact camera perspective (e.g., `Camera.View.FirstPerson` to enable specific animations).

### **Core Functions (To Understand and Override):**

* **`UpdateCameraMode(float DeltaTime)`:**
  * Called every frame by the `ULyraCameraModeStack` for active modes.
  * Orchestrates the mode's per-frame update: Calls `UpdateView(DeltaTime)` and `UpdateBlending(DeltaTime)`.
* **`UpdateView(float DeltaTime)`:**
  * **This is the primary function to override in derived classes.**
  * Responsible for calculating the desired camera `Location`, `Rotation`, `ControlRotation`, and `FieldOfView` for this frame based on the target actor, player input, and any other relevant game state.
  * The results should be stored in the `View` member (type `FLyraCameraModeView`).
  * The base implementation sets the view directly to the pivot location/rotation and uses the default `FieldOfView`, so derived classes _must_ override this to provide specific behavior.
* **`GetPivotLocation() const` / `GetPivotRotation() const`:**
  * Virtual functions that provide the base location and rotation around which the camera calculations should occur.
  * The base implementation smartly retrieves the location/rotation from the `TargetActor`, accounting for pawn view location and character capsule height adjustments (including crouching).
  * Derived classes can override these if they need a different reference point (e.g., a socket on the character mesh, an offset based on velocity).
* **`UpdateBlending(float DeltaTime)`:**
  * Called every frame to update the mode's blend progress.
  * Increments the internal linear `BlendAlpha` based on `DeltaTime` and `BlendTime`.
  * Calculates the final `BlendWeight` based on `BlendAlpha`, `BlendFunction`, and `BlendExponent`. This `BlendWeight` is what the stack uses for interpolation.
* **`SetBlendWeight(float Weight)`:**
  * Allows the `BlendWeight` to be set directly (e.g., by the stack during initialization). It calculates the corresponding `BlendAlpha` needed to achieve that weight given the blend function.
* **`OnActivation()` / `OnDeactivation()`:**
  * Virtual functions called by the stack when the mode becomes active or inactive.
  * Base implementation handles adding/removing the `CameraTagToAddToPlayer` Gameplay Tag.
  * Derived classes can override these to perform specific setup or cleanup tasks when the mode starts or stops being relevant (e.g., initializing interpolation variables, cleaning up timers).

### **Helper Functions:**

* `GetLyraCameraComponent() const`: Returns the owning `ULyraCameraComponent`.
* `GetTargetActor() const`: Returns the actor the camera is focused on (obtained from the `ULyraCameraComponent`).
* `GetWorld() const`: Standard `UObject` function to get the world context.

### **Internal State:**

* **`View` (`FLyraCameraModeView`):** Stores the calculated view parameters for the current frame.
* **`BlendAlpha` (float):** Internal linear blend progress (0-1).
* **`BlendWeight` (float):** Final calculated blend weight used by the stack (0-1).

By inheriting from `ULyraCameraMode` and overriding functions like `UpdateView`, developers can create diverse and complex camera behaviors that integrate seamlessly into the stack-based blending system.

