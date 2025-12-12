# Lag Compensation Thread

The **`FLagCompensationThreadRunnable`** is the engine that powers the entire lag-compensation system.\
It’s a fully self-contained worker running in its own thread, responsible for maintaining history, performing interpolations, expanding shapes, and executing rewind traces.

***

### **Thread Responsibilities**

<table><thead><tr><th width="244.6666259765625">Task</th><th>Description</th></tr></thead><tbody><tr><td><strong>Drain Snapshots</strong></td><td>Consume queued snapshots from the manager and update per-actor history buffers.</td></tr><tr><td><strong>Maintain History</strong></td><td>Keep a rolling time window of past poses for every registered source.</td></tr><tr><td><strong>Process Rewind Requests</strong></td><td>Dequeue and handle <code>FRewindLineTraceRequest</code>s asynchronously.</td></tr><tr><td><strong>Interpolate Snapshots</strong></td><td>Reconstruct world transforms for a specific timestamp.</td></tr><tr><td><strong>Expand Shapes</strong></td><td>Convert local-space collision shapes into world-space geometry using the interpolated transforms.</td></tr><tr><td><strong>Perform Trace</strong></td><td>Execute sphere-sweep intersection tests against all expanded shapes.</td></tr><tr><td><strong>Return Results</strong></td><td>Package the final hit data into an <code>FRewindLineTraceResult</code> and fulfill the promise.</td></tr><tr><td><strong>Enqueue Debug Commands</strong></td><td>Send pose and collision visualization commands to the game-thread debug service.</td></tr></tbody></table>

***

### **Thread Lifecycle**

#### **Construction**

When the manager initializes:

```cpp
LagCompensationThreadHandler = new FLagCompensationThreadRunnable(World, this, &DebugService);
LagCompensationThreadHandler->Start();
```

* Creates the runnable and its `FRunnableThread`.
* Allocates a synchronization event (`GameTickEvent`), which acts as the heartbeat between the game thread and the worker.

#### **Main Loop (`Run()`)**

```cpp
uint32 FLagCompensationThreadRunnable::Run()
{
    while (!bStopRequested)
    {
        GameTickEvent->Wait();        // Sleep until triggered by the manager
        DrainSnapshots();             // Sync snapshot history
        ProcessRewindLineTraceRequests(); // Handle queued rewind traces
        DebugService->DrainQueues();  // Forward debug commands to manager
    }
    return 0;
}
```

1. **Wait for Signal**\
   The worker sleeps efficiently until the manager triggers `GameTickEvent` each frame.
2. **Drain Snapshots**\
   Moves all queued `FLagCompensationSnapshot`s into `ActorHistoryData`.
3. **Process Requests**\
   Handles all rewind trace requests submitted since the previous tick.
4. **Flush Debug**\
   Packages debug commands for game-thread drawing.

#### **Shutdown**

On manager `EndPlay`:

```cpp
LagCompensationThreadHandler->EnsureCompletion();
delete LagCompensationThreadHandler;
LagCompensationThreadHandler = nullptr;
```

`EnsureCompletion()` sets `bStopRequested = true`, triggers the event to wake the thread, and joins it cleanly.

***

### **Snapshot Draining & History Maintenance**

Each source maintains a linked list of historical data:

```cpp
TMap<ULagCompensationSource*, TDoubleLinkedList<FLagCompensationData>*> ActorHistoryData;
```

When `DrainSnapshots()` runs:

1. Dequeues all pending snapshots from the manager’s queue.
2. Appends them to the front of the corresponding actor’s list.
3. Prunes any snapshots older than the configured `MaxLatencyInMilliseconds`.
4. Deletes the entire list if a source has been destroyed.

This produces a rolling, time-bounded history for every active lag-compensated actor.

***

### **Processing Rewind Trace Requests**

#### **Input**

Each request contains:

```cpp
double Timestamp;
FVector Start, End;
float SphereRadius;
ECollisionChannel Channel;
TArray<AActor*> ActorsToIgnore;
TPromise<FRewindLineTraceResult> Promise;
```

#### **Processing Steps**

1. **Find Snapshots Bracketing Timestamp**
   * For each active source, locate the two snapshots `Older` and `Newer` around the target time.
   * If only one exists, use it directly.
2. **Interpolate Pose**
   * For skeletal actors: interpolate bone transforms and actor root transform.
   * For static actors: interpolate `ComponentToWorld`.
   * Result: `InterpolatedState` representing the source’s pose at that historical moment.
3. **Expand Shapes**
   * Call `ExpandSkeletalShapesAtTime()` or `ExpandStaticShapesAtTime()` to rebuild world-space hitboxes.
   * Each shape expansion applies non-uniform scale and produces an `FLagHitboxInfo`.
4. **Perform Sphere Sweep**
   * Sweep the shot sphere (`Start`→`End`) against each hitbox.
   * Test sphere-vs-primitive intersections for:
     * **Sphere** — simple distance check.
     * **Capsule** — segment-sphere distance test.
     * **Box** — Minkowski sum with clamped projection.
     * **Convex** — Cyrus–Beck clipping against planes.
   * Generate `FPenetrationHitResult`s with entry and exit data.
5. **Merge Static World Hits**
   * Optionally call `LagTraceUtils::PerformDirectTraceFallback()` for normal world geometry collisions.
6. **Aggregate Results**
   * Combine and sort by distance from `Start`.
7. **Fulfill Promise**
   * Package the array of results into an `FRewindLineTraceResult` and complete the promise.

***

### **Shape Expansion Internals**

#### **Boxes**

```cpp
FCollisionShape::MakeBox(LocalExtent * Scale);
```

* Transformed by the interpolated bone/component transform.

#### **Spheres**

```cpp
FCollisionShape::MakeSphere(LocalRadius * ScaleMax);
```

* Scaled uniformly by the maximum axis scale.

#### **Capsules**

```cpp
FCollisionShape::MakeCapsule(Radius, HalfHeight + Radius);
```

* Uses **full half-height** (cylinder + caps) to match Unreal’s convention.
* Axis aligned to **X-axis** in physics, rotated 90° around Y for debug drawing.

#### **Convex**

* If valid plane data exists, uses world-space plane equations.
* Otherwise, approximates as an oriented bounding box.

***

### **Interpolation**

To reconstruct poses at arbitrary times:

```cpp
float Alpha = (TargetTime - Older.Time) / (Newer.Time - Older.Time);
InterpLocation = FMath::Lerp(Older.Location, Newer.Location, Alpha);
InterpRotation = FQuat::Slerp(Older.Rotation, Newer.Rotation, Alpha);
InterpScale    = FMath::Lerp(Older.Scale, Newer.Scale, Alpha);
```

For skeletal meshes, this runs per-bone.\
Interpolated transforms are then used to rebuild hitbox world transforms.

***

### **Broadphase Culling**

Before per-shape intersection tests, the worker performs a quick cull:

* Compute a **swept sphere AABB** from `Start`→`End`.
* Skip any actor whose historical bounds do not intersect that volume.

This keeps per-frame cost low even with many sources.

***

### **Thread Safety Guarantees**

* The worker **never** touches live `UObject` data.
* All geometry and materials are read from immutable asset data (`UPhysicsAsset`, `UBodySetup`).
* Inter-thread communication is via lock-free queues and atomic flags.
* Debug drawing is fully deferred to the game thread through `FLagCompensationDebugService`.

***

### **Shutdown Sequence**

1. Manager calls `EnsureCompletion()` → sets `bStopRequested = true`.
2. Triggers `GameTickEvent` to wake the thread.
3. Worker exits loop and cleans up all lists.
4. Manager deletes the thread object and clears the pointer.

All queues are cleared, and the event is returned to the engine’s event pool.

***

#### **Summary**

| Phase                 | Operation                 | Thread        |
| --------------------- | ------------------------- | ------------- |
| Snapshot Recording    | Sources capture poses     | Game          |
| Snapshot Draining     | Move into history buffers | Worker        |
| Rewind Request        | Enqueued via manager API  | Game          |
| Interpolation & Trace | Expand + sweep shapes     | Worker        |
| Results Returned      | Promise fulfilled         | Worker → Game |
| Debug Draw            | Render poses/collisions   | Game          |

The lag compensation thread is the heart of the system, it turns a stream of lightweight per-frame snapshots into a fully reconstructable history that can be queried in constant time, giving the server the ability to _look back in time_ without stalling gameplay.

***
