# Camera Modes

The heart of this camera system lies in the concept of **Camera Modes**. Instead of having a single, monolithic camera controller trying to handle every possible scenario (third-person follow, aiming, cinematics, etc.), the system breaks down different camera behaviors into distinct, reusable units called Camera Modes.

### **What is a Camera Mode?**

A Camera Mode, represented by classes inheriting from `ULyraCameraMode`, is essentially a self-contained set of rules and logic that defines:

1. **Perspective Calculation:** How to determine the camera's desired location, rotation, and field of view (FOV) based on a target actor and potentially other game state information.
2. **Blending Behavior:** How this mode should transition in and out when it becomes active or inactive, specifying duration (`BlendTime`) and interpolation style (`BlendFunction`, `BlendExponent`).
3. **Gameplay Identification:** Optionally associates Gameplay Tags (`CameraTypeTag`, `CameraTagToAddToPlayer`) with its activation state, allowing other game systems (like animation or UI) to react to the current camera perspective.

<img src=".gitbook/assets/image (2) (1) (1) (1) (1) (1) (1) (1).png" alt="" title="Camera Mode example of third person aiming">

### **Why Use Camera Modes?**

This approach offers significant advantages:

* **Modularity:** Each camera behavior is isolated in its own class, making the system easier to understand, debug, and maintain.
* **Reusability:** A defined mode (like an aiming mode) can be reused across different weapons or scenarios.
* **Extensibility:** Adding new camera behaviors involves creating a new `ULyraCameraMode` subclass without modifying existing ones.
* **Dynamic Blending:** The system can smoothly interpolate between different modes using a stack-based approach, allowing for seamless transitions (e.g., moving from a wide third-person view to a tight over-the-shoulder aiming view).
* **Layering:** Temporary camera effects (like a brief camera shake or a cinematic override) can be implemented as modes pushed temporarily onto the stack.

### **How are Modes Managed?**

The `ULyraCameraComponent`, which resides on the Pawn, utilizes a `ULyraCameraModeStack`. This stack:

1. Keeps track of which Camera Modes are currently active.
2. Manages the creation and lifecycle of Camera Mode instances.
3. Updates each active mode every frame, allowing them to calculate their desired view and update their blend state.
4. Performs the weighted blending calculation, combining the outputs of all active modes into a single, final camera view.

### **In Summary:**

Camera Modes are the fundamental building blocks defining _how_ the camera behaves. They are managed by the `ULyraCameraModeStack` (within the `ULyraCameraComponent`) which blends their outputs to produce the final view seen by the player.

**Next Steps:**

To fully understand how to work with and create camera modes, we will explore:

* **Base Class: `ULyraCameraMode`:** The detailed properties and functions provided by the base class.
* **Camera Mode View & Stack:** How modes output their data (`FLyraCameraModeView`) and how the stack (`ULyraCameraModeStack`) manages and blends them.
* **Example: `ULyraCameraMode_ThirdPerson`:** A detailed look at a concrete implementation, showcasing how to build upon the base class for specific behaviors like third-person follow and penetration avoidance.

