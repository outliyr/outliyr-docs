# Debugging

Lag compensation operates across time and threads, making visualization essential for debugging. This page covers the debug tools in depth, including the thread-safe debug service architecture, and documents the system's design constraints.

***

### Debug Settings

All debug features are controlled through `ULyraLagCompensationDebugSettings`, accessible in:

> Project Settings → Lyra Lag Compensation Debug

This class inherits from `UDeveloperSettingsBackedByCVars`, meaning changes update console variables automatically and vice versa.

#### Available Settings

| Property                     | CVar                               | Description                                                                                                          |
| ---------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Disable Lag Compensation** | `lyra.LC.Disable`                  | Turns off the entire system. All rewind traces fall back to live, synchronous traces. Useful for comparison testing. |
| **Draw Poses**               | `lyra.LC.Debug.DrawPoses`          | Continuously draws the rewound pose of all registered actors at simulated latency.                                   |
| **Draw Broadphase**          | `lyra.LC.Debug.DrawBroadphase`     | Visualizes broadphase AABB tests with color-coded results.                                                           |
| **Draw Collisions**          | `lyra.LC.Debug.DrawCollisions`     | Draws rewound collision shapes when a rewind trace detects a hit.                                                    |
| **Draw Hit Only**            | `lyra.LC.Debug.DrawHitOnly`        | When enabled, draws only the shapes that were actually intersected.                                                  |
| **Draw Individual Hits**     | `lyra.LC.Debug.DrawIndividualHits` | Visualizes every intersected sub-shape with miss diagnostics.                                                        |
| **Marker Radius (cm)**       | `lyra.LC.Debug.MarkerRadius`       | Radius of debug spheres drawn for entry/exit points.                                                                 |
| **Simulated Latency (ms)**   | `lyra.LC.Debug.SimLatencyMs`       | How far back in time `DrawPoses` visualizes. Default 250ms.                                                          |
| **Pose Duration Scale**      | `lyra.LC.Debug.PoseDurationScale`  | How long continuous pose markers remain on screen.                                                                   |
| **Hit Duration (s)**         | `lyra.LC.Debug.HitDurationSeconds` | Duration for collision hit visualizations.                                                                           |

***

### The Debug Service

`FLagCompensationDebugService` bridges the worker thread and game thread for safe rendering. Since `DrawDebugBox()` and similar functions are not thread-safe, the debug service uses MPSC (Multiple Producer, Single Consumer) queues to defer all draw commands to the game thread.

#### Architecture

```plaintext
┌─────────────────────────────────────────────────────────────────┐
│                        Worker Thread                            │
│                                                                 │
│   Rewind Trace Processing                                       │
│         │                                                       │
│         ├──► EnqueuePose(FLagDebugPoseCmd)                      │
│         ├──► EnqueueBroadphase(FLagDebugBroadphaseCmd)          │
│         ├──► EnqueueCollision(FLagDebugCollisionCmd)            │
│         └──► EnqueuePerShape(FLagDebugPerShapeCmd)              │
│                        │                                        │
│                        ▼                                        │
│              ┌─────────────────────┐                            │
│              │   MPSC Queues       │                            │
│              │   (Lock-Free)       │                            │
│              └─────────────────────┘                            │
│                        │                                        │
└────────────────────────│────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Game Thread                              │
│                                                                 │
│   Manager::TickComponent()                                      │
│         │                                                       │
│         └──► DebugService.Flush(World)                          │
│                   │                                             │
│                   ├──► Dequeue all PoseCmds → DrawDebugBox      │
│                   ├──► Dequeue all BroadphaseCmds → DrawDebugBox│
│                   ├──► Dequeue all CollisionCmds → DrawSpheres  │
│                   └──► Dequeue all PerShapeCmds → DrawShapes    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Four Queue Types

Each queue handles a different type of debug visualization:

#### 1. FLagDebugPoseCmd: Continuous Pose Drawing

Draws the rewound hitbox pose for an actor at simulated latency.

```plaintext
FLagDebugPoseCmd:
    Shapes: Array<FLagHitboxInfo>    // Expanded shapes to draw
    Color: FColor                    // Green by default
    Duration: float                  // How long to display
```

When generated: Every frame when `DrawPoses` is enabled, for each registered source.

What it shows: Green wireframe hitboxes at their positions 250ms (or configured latency) in the past.

#### 2. FLagDebugBroadphaseCmd: Broadphase Test Visualization

Visualizes the result of broadphase AABB tests.

```plaintext
FLagDebugBroadphaseCmd:
    ActorBounds: FBox              // The windowed AABB tested
    TraceStart: FVector            // Trace origin
    TraceEnd: FVector              // Trace endpoint
    Result: EBroadphaseResult      // PASS, BYPASS, or REJECT
    Label: FString                 // Actor name for identification
    Duration: float
```

When generated: During broadphase culling when `DrawBroadphase` is enabled.

Color coding:

| Color      | Result | Meaning                                                  |
| ---------- | ------ | -------------------------------------------------------- |
| **Green**  | PASS   | Broadphase hit, proceeding to narrow-phase               |
| **Yellow** | BYPASS | Broadphase missed, but bypass conditions allowed through |
| **Red**    | REJECT | Actor excluded from further testing                      |

#### 3. FLagDebugCollisionCmd: Hit Entry/Exit Markers

Marks where a trace entered and exited a hitbox.

```plaintext
FLagDebugCollisionCmd:
    EntryPoint: FVector            // Where trace entered
    EntryNormal: FVector           // Surface normal at entry
    ExitPoint: FVector             // Where trace exited
    ExitNormal: FVector            // Surface normal at exit
    Shapes: Array<FLagHitboxInfo>  // Optional: draw the hit shapes
    DrawShapes: bool               // Whether to visualize shapes
    Duration: float
```

When generated: When a rewind trace produces a valid intersection and `DrawCollisions` is enabled.

Visual elements:

* White sphere at entry point
* Black sphere at exit point
* Green wireframe shapes (if `DrawShapes` enabled)
* Directional arrows showing impact normals

#### 4. FLagDebugPerShapeCmd: Per-Shape Hit Diagnostics

Detailed per-shape visualization including miss analysis.

```plaintext
FLagDebugPerShapeCmd:
    Shape: FLagHitboxInfo          // The shape being visualized
    DidHit: bool                   // Whether this shape was hit
    ClosestPointOnSegment: FVector // For misses: closest point on trace
    ClosestPointOnShape: FVector   // For misses: closest point on shape
    SignedGap: float               // Distance between closest points
    Duration: float
```

When generated: When `DrawIndividualHits` is enabled, for each shape tested.

Color coding:

| Color       | Meaning          |
| ----------- | ---------------- |
| **Cyan**    | Shape was hit    |
| **Magenta** | Shape was missed |

Miss diagnostics: For missed shapes, draws:

* A line from trace to closest point on shape
* The signed gap distance as a label
* Helps identify near-misses and hitbox alignment issues

#### Minimal Overhead

When no debug CVars are active:

* All enqueue operations become no-ops (early return)
* Queues remain empty
* `Flush()` immediately returns
* Zero performance impact even when compiled in

```plaintext
EnqueuePose(cmd):
    if NOT DebugSettings.DrawPoses:
        return  // No-op

    PoseQueue.Enqueue(cmd)
```

***

### Visualization Types

#### Continuous Pose Drawing

Purpose: Confirm that historical reconstruction is accurate, positions, rotations, and bone offsets match real-time mesh movement.

Enable:

```
lyra.LC.Debug.DrawPoses 1
lyra.LC.Debug.SimLatencyMs 250
```

What you see:

* Green wireframe hitboxes for all registered actors
* Positions represent where actors were 250ms ago
* Updates every frame as new history is recorded

Use cases:

* Verify that hitboxes follow animation correctly
* Check that lag compensation source is attached to correct actors
* Visualize how much actors move in typical latency windows

#### Broadphase Visualization

Purpose: Understand why certain actors are included or excluded from collision testing.

Enable:

```
lyra.LC.Debug.DrawBroadphase 1
```

What you see:

* Colored AABBs around each tracked actor
* Trace line from start to end
* Color indicates broadphase result

Use cases:

* Debug "phantom hits" where wrong actor is tested
* Verify bypass logic isn't too permissive
* Optimize broadphase padding

#### Collision Visualization

Purpose: Verify what was hit, when it existed in time, and penetration depth.

Enable:

```
lyra.LC.Debug.DrawCollisions 1
lyra.LC.Debug.DrawHitOnly 1
```

What you see:

* Green hitboxes for the target's rewound pose
* White sphere at trace entry point
* Black sphere at trace exit point
* Directional arrows showing normals

Use cases:

* Confirm hit registration accuracy
* Visualize penetration depth
* Debug "shot through" issues

#### Per-Shape Diagnostics

Purpose: Analyze individual hitbox collisions and near-misses.

Enable:

```
lyra.LC.Debug.DrawIndividualHits 1
```

What you see:

* Cyan shapes that were hit
* Magenta shapes that were missed
* Lines showing closest approach for misses
* Gap distance labels

Use cases:

* Debug per-bone hit accuracy
* Identify hitbox misalignment
* Analyze why specific body parts aren't registering hits

***

### Practical Debugging

#### Visualizing Rewound States

```plaintext
// On server console:
lyra.LC.Debug.DrawPoses 1
lyra.LC.Debug.SimLatencyMs 150

// Observe: Green outlines represent actor poses 150ms in the past
// Compare: Visual position vs drawn pose shows prediction offset
```

#### Troubleshooting Missed Hits

Follow these steppers for common scenarios.

{% stepper %}
{% step %}
#### Shots visually hit but don't register

*   Enable pose drawing to verify rewound position:

    ```
    lyra.LC.Debug.DrawPoses 1
    ```
* Check if target has `ULagCompensationSource`:
  * Component must be attached to the actor
  * Skeletal mesh must have a physics asset
* Verify collision channel:
  * Check `CollisionResponses` in snapshot
  * Ensure weapon trace channel matches
*   Enable broadphase to check filtering:

    ```
    lyra.LC.Debug.DrawBroadphase 1
    ```

    * Red = rejected by broadphase (check AABB bounds)
    * Yellow = bypassed (check bypass conditions)
{% endstep %}

{% step %}
#### Shots register on wrong body part

*   Enable per-shape visualization:

    ```
    lyra.LC.Debug.DrawIndividualHits 1
    ```
* Check physics asset body assignments:
  * Verify bone names match
  * Check shape coverage
* Look for overlapping hitboxes:
  * Closest entry wins
  * May need physics asset adjustment
{% endstep %}

{% step %}
#### Excessive position correction

*   Reduce simulated latency:

    ```
    lyra.LC.Debug.SimLatencyMs 100
    ```
* Check client-reported timestamps:
  * `ServerTime - (Ping/2)` should be accurate
  * Extreme latency may exceed history buffer
{% endstep %}
{% endstepper %}

***

### System Limitations

#### Selective Tracking Only

The system only tracks and rewinds actors with `ULagCompensationSource`. It does not track the entire world state.

Implication: Collisions against static world geometry or dynamic actors without the source component are tested against their current position, not their historical position.

When this matters:

* Moving platforms without lag compensation
* Vehicles without the component
* Destructible objects that move

Solution: Add `ULagCompensationSource` to any dynamic actor where historical collision accuracy is critical.

#### Collision Only, Not Animation State

The system rewinds the position, rotation, and shape of collision primitives. It does not rewind:

* Animation state (blend weights, montage positions)
* Gameplay logic state (health, applied effects)
* Visual effects or sounds

Implication: The rewound hitbox position may differ slightly from the visual animation the shooter saw, especially for fast-moving limbs.

Mitigation: Hitboxes are captured from finalized bone transforms, so the positions are frame-accurate to what was rendered.

#### Simplified Penetration Logic

The lag compensation thread calculates entry and exit points assuming a straight-line path through the hit object. It does not simulate:

* Ricochets — Trace path does not bounce
* Exit angle deviation — Exits along same vector as entry
* Energy loss — No velocity reduction calculation

Rationale: Complex physics simulation within historical rewind would be prohibitively expensive. The current system prioritizes efficient geometric validation.

Post-validation: Damage reduction and ricochet logic are handled by the gameplay ability after validated hit results return.

#### Supported Shapes

| Shape               | Support Level               |
| ------------------- | --------------------------- |
| **Sphere**          | Full support                |
| **Box**             | Full support                |
| **Capsule (Sphyl)** | Full support                |
| **Convex**          | Supported with OBB fallback |
| **Triangle mesh**   | Not supported               |

Recommendation: Use simple primitives (spheres, capsules, boxes) for actors participating in lag compensation. Avoid complex collision meshes.

#### Performance Considerations

Memory:

* Scales with: `HistoryLength × ActorCount × BonesPerActor`
* 500ms at 60 FPS = \~30 snapshots per actor
* 32 players × 60 bones × 30 snapshots × 48 bytes ≈ 2.7 MB

CPU (Worker Thread):

* Broadphase culling keeps narrow-phase work bounded
* Complex physics assets increase per-actor overhead
* High fire rates from many players increase queue depth

CPU (Game Thread):

* Snapshot capture is lightweight (transform copies)
* Debug drawing can be expensive if many visualizations active

#### Timestamp Accuracy

The system relies on the timestamp provided (usually by the client) being reasonably accurate. Issues can arise from:

* Clock drift — Server and client time diverge
* Manipulation — Tampered timestamps for advantage
* Extreme latency — Timestamp outside history buffer

Mitigation: GAS and the engine have mechanisms to validate and clamp timestamps. The `MaxLatencyInMilliseconds` setting (default 500ms) caps how far back the system will rewind.

***

### Animation Accuracy

ShooterBase captures bone transforms directly from the finalized animation pose each frame, after all graph evaluations are complete. This means historical hitboxes reflect the exact animation state at that moment, including:

* Skeletal animation playback
* Blend spaces and state machines
* Aim offsets and additive layers
* IK adjustments

What this means in practice: Rewound poses align visually with the original animation to within a single frame of error, more than sufficient for both gameplay accuracy and visual debugging.

Comparison to full rollback: Advanced systems that re-simulate animation or physics states can offer marginally higher precision, but require deep engine integration and high data throughput. ShooterBase focuses on a balanced, production-ready solution that achieves sub-frame positional accuracy within Unreal's standard architecture.

***
