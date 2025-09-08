# InventoryFragment_Inspect

This fragment provides the necessary data and configuration for integrating an item with the 3D **Item Inspection System**, which utilizes the PocketWorlds plugin to render interactive previews. Adding this fragment to an item definition allows players to potentially view that item in a dedicated inspection viewport.

<img src=".gitbook/assets/image (13).png" alt="" width="563" title="">

### Purpose

* **Visual Representation:** Specifies the Static Mesh or Skeletal Mesh used to represent the item in the 3D inspection view.
* **Camera Control:** Defines parameters for how the virtual camera behaves during inspection (FOV limits, zoom capability).
* **Rotation Control:** Configures how the player can rotate the item model (free rotation, axis clamping, reset behavior).
* **Icon Snapshot Config:** Provides settings (`FInspectionImageDetails`) used by the `UItemIconGeneratorComponent` if generating cached 2D icons from the 3D model is desired.

### Configuration (on `InventoryFragment_Inspect`)

To enable 3D inspection for an item, add the `InventoryFragment_Inspect` to its `ULyraInventoryItemDefinition`, then configure the following properties in the Details panel:

1. **Choose a Visual Mesh:**
   * Set either `StaticMesh` or `SkeletalMesh` to define how the item appears in the inspection view.
   * Only one of these should typically be set — whichever represents the item's 3D appearance.
2. **Camera Settings (Zoom):**
   * `bCanZoom`: Enable or disable zooming with the mouse wheel or controller input.
   * `InitialFOV`: Field of View when inspection begins.
   * `MaxZoomInFOV` / `MaxZoomOutFOV`: Set the zoom boundaries (smaller FOV = closer zoom).
3. **Rotation Settings:**
   * `bCanRotate`: Whether the player can rotate the item during inspection.
   * `bRotateSpringArm`: Enables unrestricted rotation using a virtual spring arm.
   * `bResetRotationOnLoseFocus`: Resets item rotation when the player stops interacting.
   * `bClampXRotationAxis` / `bClampYRotationAxis`: Whether to limit rotation on each axis.
   * `RotationXAxisClamp` / `RotationYAxisClamp`: Define min/max angles for clamping.
   * `DefaultInspectionRotation`: Initial rotation applied to the item when inspection begins.
4. **Icon Snapshot Settings (Optional):**\
   Configure how the item is rendered when generating a 2D icon snapshot from the 3D model:
   * `InventoryIconImage.bUseAsInventoryImage`: Whether to use this 3D view for inventory icons.
   * `ImageRotation`: Rotation applied when generating the icon image.
   * `FitToScreenRatio`: Controls how much of the screen the object fills during capture.
   * `bCacheRenderTarget`: Share a cached render target for items of the same definition, or allow unique icons per instance (useful for visual attachments).
5. **Save and Test:**\
   After configuration, trigger an item inspection (e.g., via UI or gameplay ability) to verify that the camera behavior, rotation limits, and mesh visuals function as expected within the inspection viewport.

### Runtime Usage

This fragment primarily acts as a **data container**. Its properties are read by other systems involved in the inspection process:

1. **Initiation:** When the player triggers item inspection (e.g., via UI -> GAS Event).
2. **Pocket Level & Stage Manager:** The inspection system (likely involving `UPocketLevelBridgeSubsystem`) spawns the appropriate pocket level and gets the `APocketLevelStageManager` within it.
3. **Stage Manager Initialization (`APocketLevelStageManager::Initialise`):**
   * The `ULyraInventoryItemInstance` being inspected is passed to the `StageManager`.
   * The `StageManager` finds the `UInventoryFragment_Inspect` on the item instance using `FindFragmentByClass`.
   * It reads the `StaticMesh` or `SkeletalMesh` property and sets the corresponding mesh component in the pocket level.
   * It reads the camera (`bCanZoom`, FOV properties) and rotation (`bCanRotate`, clamp properties, `DefaultInspectionRotation`) settings from the fragment and configures its internal camera (`UCameraComponent`) and rotation logic accordingly.
   * If the item also has an `InventoryFragment_Attachment`, the `StageManager` recursively spawns and attaches visuals for those attachments.
4. **User Interaction (`UInventoryRepresentationWidget`):**
   * The widget displaying the inspection view reads properties like `bCanZoom` and `bCanRotate` from the fragment (via the stage manager or item instance) to enable/disable input handling.
   * When the user rotates (drags mouse) or zooms (mouse wheel), the widget relays these inputs to the `APocketLevelStageManager`, which uses the clamp/limit values configured in the fragment to constrain the movement.
5. **Icon Generation (`UItemIconGeneratorComponent` - Optional):**
   * If using the generator component, it reads the `InventoryIconImage` struct from the fragment.
   * If `bUseAsInventoryImage` is true, it uses `ImageRotation` and `FitToScreenRatio` when calling `APocketLevelStageManager::InitialiseSnapCaptor` to position the item correctly for the snapshot.
   * It uses `bCacheRenderTarget` to decide whether to cache the generated icon based on the item definition class or if each instance needs a unique icon.

In essence, `InventoryFragment_Inspect` acts as the configuration hub for how an item should appear and behave within the 3D inspection environment provided by the PocketWorlds integration.
