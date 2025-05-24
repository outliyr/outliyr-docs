# Scene Staging

The `APocketLevelStageManager` is an Actor specifically designed to reside within a pocket level instance managed by the `UPocketLevelBridgeSubsystem`. It acts as the director for the item rendering scene, responsible for spawning the visuals, positioning the camera, handling interactions, and providing the necessary context for the `UPocketCapture` component to render the scene.

### Role and Purpose

* **Scene Setup:** Dynamically creates the 3D representation of the item being inspected or rendered for an icon.
* **Item Staging:** Reads data from the provided `ULyraInventoryItemInstance` (specifically `InventoryFragment_Inspect` and `InventoryFragment_Attachment`) to determine what meshes to spawn and how to arrange them.
* **Attachment Handling:** Recursively discovers and spawns actors/meshes for items attached to the primary item via [`InventoryFragment_Attachment`](../../../base-lyra-modified/items/item-fragments-in-depth/attachment-system/), ensuring visual fidelity for complex assemblies.
* **Camera Control:** Manages an internal `UCameraComponent` and `USpringArmComponent`, positioning them appropriately to frame the item based on its bounds and configuration from `InventoryFragment_Inspect`.
* **Interaction Gateway:** Receives processed input (rotation, zoom commands) from external sources (like `UInventoryRepresentationWidget`) and applies the corresponding transformations to the camera or the staged item.
* **Rendering Interface:** Provides the associated `UPocketCapture` instance access to the necessary camera view and actors required for rendering the scene to a texture.

### Internal Component Setup

The `APocketLevelStageManager` actor typically contains the following components, organized to facilitate flexible control:

* `RootSceneComponent`: The base root component.
* `SpringArmComponent`: Attached to the Root. Controls camera distance (`TargetArmLength`) and potentially camera rotation if `bRotateSpringArm` is true.
* `CameraComponent`: Attached to the `SpringArmComponent`. This is the virtual camera whose view is captured by `UPocketCapture`. Its Field of View (FOV) and position relative to the spring arm are key for framing.
* `ActorSpawnPointComponent`: Attached to the Root. Acts as a pivot point for the item mesh itself. If `bRotateSpringArm` is false, user rotation input is applied to this component.
* `StaticMeshComponent` / `SkeletalMeshComponent`: Attached to the `ActorSpawnPointComponent`. One of these will be made active to display the primary item's mesh, based on the data in `InventoryFragment_Inspect`.

This hierarchy allows for independent control over the camera's position/distance (via the spring arm) and the item's orientation (via the spawn point or the spring arm).

### Initialization and Staging

The Stage Manager prepares the scene based on the context (live inspection vs. icon snapshot):

1. **`Initialise(ULyraInventoryItemInstance* ItemInstance)`:**
   * Called for **live inspection** (usually by `UInventoryRepresentationWidget`).
   * Reads settings from `InventoryFragment_Inspect` (rotation/zoom enabled, clamps, default rotation, FOV settings). **Fails if the fragment is missing**.
   * Calls `InitialiseItemMesh` to spawn the base item and its attachments.
   * Configures the `SpringArmComponent` (`InspectionTargetArm`) and `CameraComponent` (`InitialFOV`, min/max FOV).
   * Applies the `DefaultInspectionRotation` from the fragment.
   * Calls `CenterPivot` to ensure rotation occurs around the visual center.
   * Sets internal state variables (`bCanRotate`, `bCanZoom`, etc.).
2. **`InitialiseSnapCaptor(ULyraInventoryItemInstance* ItemInstance, float ImageSizeX, float ImageSizeY)`:**
   * Called for **icon generation** (usually by `UItemIconGeneratorComponent`).
   * Calls `InitialiseItemMesh` to spawn the base item and its attachments.
   * Reads specific icon settings (`ImageRotation`, `FitToScreenRatio`) from `InventoryFragment_Inspect::InventoryIconImage`.
   * Applies the `ImageRotation`.
   * Calls `PositionStageManager` to calculate the optimal camera distance and FOV needed to frame the item within the specified `ImageSizeX`, `ImageSizeY` according to the `FitToScreenRatio`.
   * Calls `CenterPivot`.
3. **`InitialiseItemMesh(ULyraInventoryItemInstance* ItemInstance)`:**
   * Clears any previously spawned actors using `ClearSpawnedAttachments`.
   * Determines whether to use `StaticMeshComponent` or `SkeletalMeshComponent` based on the mesh specified in `InventoryFragment_Inspect` and activates the correct one, assigning the mesh asset.
   * Checks if the item has an `InventoryFragment_Attachment`. If so, it resolves the transient fragment (`UTransientRuntimeFragment_Attachment`) and calls `InitialiseAttachmentsRecursive`.
4. **`InitialiseAttachmentsRecursive(UTransientRuntimeFragment_Attachment* AttachmentFragment, UPrimitiveComponent* ParentComponent)`:**
   * Iterates through the `AttachmentArray` in the provided transient fragment.
   * For each attached `ItemInstance`, reads the `ActorToSpawn` information from its `FLyraEquipmentActorToSpawn` structure (using Held or Holstered settings based on the fragment's state, though usually 'Held' makes sense for inspection).
   * Spawns the specified attachment actor (`SpawnActor`).
   * Tracks the spawned actor in `SpawnedAttachmentActors` for cleanup.
   * Attaches the spawned actor _to the Stage Manager actor itself_.
   * Attaches the spawned actor's _root component_ to the provided `ParentComponent` (which is either the base item's mesh component or another attachment's component) using the specified socket and transform from `ActorSpawnInfo`.
   * If the newly attached item _also_ has an `InventoryFragment_Attachment`, it recursively calls itself, passing the nested attachment's fragment and the newly spawned actor's root component as the new `ParentComponent`.
5. **`ClearSpawnedAttachments()`:** Iterates through the `SpawnedAttachmentActors` array, destroys each valid actor, and clears the array. Crucial for cleaning up before staging a new item.

### Positioning, Framing, and Centering

* **`CalculateCombinedBounds()`:** Determines the total bounding box encompassing the main item mesh _and_ all recursively spawned attachment actors. This is essential for accurate centering and framing.
* **`CenterPivot()`:** Calculates the center point of the `CombinedBounds`. It then adjusts the _relative location_ of the `StaticMeshComponent` / `SkeletalMeshComponent` _within_ the `ActorSpawnPointComponent` so that the calculated visual center aligns precisely with the `ActorSpawnPointComponent`'s origin. This ensures that when `ActorSpawnPointComponent` is rotated, the entire item assembly rotates around its visual center.
* **`PositionStageManager(..., FitScreenRatio)`:** Used by `InitialiseSnapCaptor`. Calculates the required camera FOV (`FOVForCameraFraming`) needed to make the object fit within the target render dimensions based on the `FitScreenRatio`. It considers the object's bounds and the camera's aspect ratio.
* **FOV/Distance Calculation Helpers:** Includes various helper functions (`FOVToFitObjectInView`, `DistanceToFitObjectInView`, `VfovToHfov`, etc.) to perform the necessary geometric calculations for framing.

### Interaction Handling

The Stage Manager responds to input forwarded from the UI:

* **`ManualRotation(float DeltaX, float DeltaY)`:**
  * Checks `bCanRotate`.
  * If `bRotateSpringArm` is true, applies rotation directly to the `SpringArmComponent` using `AddLocalRotation`.
  * If `bRotateSpringArm` is false, calculates yaw and pitch based on mouse deltas and `RotationSpeed`. Applies clamping if `bClampXAxis`/`bClampYAxis` are enabled, using `XAxisClamp`/`YAxisClamp` values. Adds the calculated rotation to the `ActorSpawnPointComponent` using `AddLocalRotation`.
* **`SetFOV(float Axis)`:**
  * Checks `bCanZoom`.
  * Calculates the desired `TargetFOV` based on the mouse wheel input (`Axis`), `WheelAxisMultiply`, and `bReverseWheelAxis`, clamping it between `MinFOV` and `MaxFOV`.
  * Calls `ChangeFOV` which smoothly interpolates the `CameraComponent`'s actual FOV towards `TargetFOV` using `FInterpTo`.
* **`ResetRotation(bool Smooth)`:** Resets the rotation of either the `SpringArmComponent` or `ActorSpawnPointComponent` (depending on `bRotateSpringArm`) back towards its default state (often zero or `DefaultRotation`).
* **`SetMeshRotation(const FRotator& NewRotation)`:** Directly sets the relative rotation of the mesh component(s), primarily used during initialization steps.

### Interface with Capture

* **`GetPocketCapture()`:** Returns the `UPocketCapture` instance (`PocketCaptureInst`) that was created during the Stage Manager's `BeginPlay`. This allows external systems (like `UInventoryRepresentationWidget` or `UItemIconGeneratorComponent`) to get the capture object needed to trigger rendering and access the render targets.

***

In essence, the `APocketLevelStageManager` acts as the self-contained scene controller within the pocket world. It dynamically builds the visual representation based on item data, manages the camera, handles interaction logic, and exposes the capture mechanism, making it a critical link between the inventory data and the final rendered output.
