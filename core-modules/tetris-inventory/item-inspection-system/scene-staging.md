# Scene Staging

You have an isolated pocket level ready. Now the question becomes: how do you build a 3D scene from raw item data? The player's assault rifle has a red dot sight, a vertical grip, and a suppressor, each one a separate inventory item with its own mesh. Something needs to read all that data, spawn the right meshes, attach them to the correct sockets, point a camera at the result, and keep everything centered so rotation feels natural.

That "something" is the `APocketLevelStageManager`.

***

### What the Stage Manager Does

The `APocketLevelStageManager` is an Actor placed inside each pocket level. Think of it as a scene director:

* **Reads item data** from `InventoryFragment_Inspect` and `InventoryFragment_Attachment` to decide what meshes to spawn
* **Recursively builds attachment trees**, if an attachment has its own attachments, it keeps going
* **Controls the camera** via a spring arm, with configurable distance, FOV, and rotation
* **Accepts interaction commands** (rotation deltas, zoom) forwarded from the UI
* **Exposes the capture interface** so external systems can trigger rendering

***

### Component Hierarchy

The Stage Manager's internal structure separates camera control from item positioning:

```
APocketLevelStageManager
│
├── RootSceneComponent
│   │
│   ├── SpringArmComponent
│   │   │   Controls camera distance (TargetArmLength)
│   │   │   Optionally receives rotation input
│   │   │
│   │   └── CameraComponent
│   │       Virtual camera captured by UPocketCapture
│   │       FOV and post-processing live here
│   │
│   └── ActorSpawnPointComponent
│       │   Pivot point for the item mesh
│       │   Receives rotation input when bRotateSpringArm is false
│       │
│       ├── StaticMeshComponent  (activated for static meshes)
│       │
│       └── SkeletalMeshComponent (activated for skeletal meshes)
│
└── PocketCaptureInst (UPocketCapture, created at BeginPlay)
```

This hierarchy lets you independently control the camera's position/distance (via the spring arm) and the item's orientation (via the spawn point), or combine them by rotating the spring arm instead.

***

### Initialization and Staging

The Stage Manager has two initialization paths depending on whether you are setting up a live inspection or capturing an icon snapshot.

{% stepper %}
{% step %}
#### Initialise (Live Inspection)

Called by `UInventoryRepresentationWidget` with a `ULyraInventoryItemInstance`.

* Reads settings from `InventoryFragment_Inspect`: rotation/zoom enabled, axis clamps, default rotation, FOV range
* Calls `InitialiseItemMesh` to spawn the base item and all attachments
* Configures the spring arm (`InspectionTargetArm`) and camera (`InitialFOV`, min/max FOV)
* Applies `DefaultInspectionRotation` from the fragment
* Calls `CenterPivot` to ensure rotation occurs around the visual center
* Sets internal state flags (`bCanRotate`, `bCanZoom`, etc.)

> [!WARNING]
> `Initialise` will fail if the item is missing an `InventoryFragment_Inspect` fragment. Every item that supports inspection must have one configured.
{% endstep %}

{% step %}
#### InitialiseSnapCaptor (Icon Generation)

Called by `UItemIconGeneratorComponent` with an item instance and target image dimensions.

* Calls `InitialiseItemMesh` to spawn the base item and all attachments
* Reads icon-specific settings (`ImageRotation`, `FitToScreenRatio`) from `InventoryFragment_Inspect::InventoryIconImage`
* Applies the `ImageRotation`
* Calls `PositionStageManager` to calculate the optimal camera distance and FOV to frame the item within the target dimensions
* Calls `CenterPivot`
{% endstep %}

{% step %}
#### InitialiseItemMesh (Shared)

Both paths call this to build the visual representation.

* Clears any previously spawned actors via `ClearSpawnedAttachments`
* Reads the mesh from `InventoryFragment_Inspect` and activates either `StaticMeshComponent` or `SkeletalMeshComponent`
* Checks for `InventoryFragment_Attachment` -- if present, resolves the transient runtime fragment and kicks off `InitialiseAttachmentsRecursive`
{% endstep %}
{% endstepper %}

***

### Recursive Attachment Spawning

This is where the system handles complex assemblies like a weapon with a scope that itself has a laser pointer attached.

<details class="gb-toggle">

<summary>How InitialiseAttachmentsRecursive works</summary>

The function walks the attachment tree depth-first:

1. Iterates through the `AttachmentArray` in the provided `UTransientRuntimeFragment_Attachment`
2. For each attached `ItemInstance`, reads the `ActorToSpawn` info from its `FLyraEquipmentActorToSpawn` structure (using Held or Holstered settings based on the fragment's state, typically "Held" for inspection)
3. Spawns the specified attachment actor via `SpawnActor`
4. Tracks the spawned actor in `SpawnedAttachmentActors` for later cleanup
5. Attaches the spawned actor to the Stage Manager actor itself
6. Attaches the spawned actor's root component to the provided `ParentComponent` (either the base item's mesh or another attachment's component) using the socket and transform from `ActorSpawnInfo`
7. If the newly spawned attachment also has an `InventoryFragment_Attachment`, the function calls itself recursively, passing the nested fragment and the new actor's root component as the next `ParentComponent`

```
Assault Rifle (base)
├── Socket: SightMount
│   └── Red Dot Sight
│       └── Socket: LaserRail
│           └── Laser Pointer    ← recursive!
├── Socket: MuzzleAttach
│   └── Suppressor
└── Socket: GripMount
    └── Vertical Grip
```

`ClearSpawnedAttachments()` destroys every actor in the `SpawnedAttachmentActors` array and clears the list. This runs before staging a new item to ensure a clean slate.

</details>

***

### Positioning, Framing, and Centering

Getting the camera to frame any item, from a tiny grenade to a full-length sniper rifle, requires some geometry:

* **`CalculateCombinedBounds()`** - Computes the total bounding box of the main item mesh plus all recursively spawned attachments. This is the foundation for centering and framing.
* **`CenterPivot()`** - Calculates the center of `CombinedBounds` and adjusts the mesh's relative location within the `ActorSpawnPointComponent` so the visual center aligns with the pivot origin. This ensures rotation always orbits around the middle of the item assembly, not an arbitrary offset.
* **`PositionStageManager()`** - Used by `InitialiseSnapCaptor`. Computes the camera FOV needed to make the item fill the target render dimensions according to `FitToScreenRatio`. Takes the object's bounds and camera aspect ratio into account.
* **FOV/Distance helpers** - `FOVToFitObjectInView`, `DistanceToFitObjectInView`, `VfovToHfov`, and others perform the underlying trigonometry.

***

### Interaction Handling

The Stage Manager receives input forwarded from the UI layer and applies it to the scene.

#### Rotation

`ManualRotation(float DeltaX, float DeltaY)`:

* Checks `bCanRotate`
* If `bRotateSpringArm` is true: applies rotation to the `SpringArmComponent` via `AddLocalRotation`
* If `bRotateSpringArm` is false: calculates yaw/pitch from mouse deltas and `RotationSpeed`, applies clamping if `bClampXAxis`/`bClampYAxis` are set, and rotates the `ActorSpawnPointComponent`

#### Zoom

`SetFOV(float Axis)`:

* Checks `bCanZoom`
* Calculates `TargetFOV` from the mouse wheel input, `WheelAxisMultiply`, and `bReverseWheelAxis`
* Clamps between `MinFOV` and `MaxFOV`
* `ChangeFOV` smoothly interpolates the camera's actual FOV toward `TargetFOV` using `FInterpTo`

#### Reset

* `ResetRotation(bool Smooth)` - Returns the spring arm or spawn point rotation to its default state
* `SetMeshRotation(const FRotator& NewRotation)` - Directly sets the mesh rotation, primarily used during initialization

***

### Interface with Capture

```cpp
// Returns the UPocketCapture instance created during BeginPlay
UPocketCapture* GetPocketCapture();
```

External systems, `UInventoryRepresentationWidget` for live previews, `UItemIconGeneratorComponent` for icon snapshots, call this to get the capture object, trigger rendering, and access the resulting render targets.

***

The `APocketLevelStageManager` is the self-contained scene controller within each pocket world. It dynamically builds visual representations from item data, manages the camera, handles interaction, and exposes the capture mechanism, the critical link between inventory data and the final rendered output.
