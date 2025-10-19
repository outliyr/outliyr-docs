# Core Components

This page describes the main components that make up the Lag Compensation system in their actual implementation form.

The Lag Compensation system is composed of three primary classes:

| Component                            | Thread        | Role                                                                                 |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------------ |
| **`ULagCompensationSource`**         | Game Thread   | Records per-frame world-space snapshots for one actor’s hit geometry.                |
| **`ULagCompensationManager`**        | Game Thread   | Central registry of sources, manages threading, and provides async rewind-trace API. |
| **`FLagCompensationThreadRunnable`** | Worker Thread | Owns per-actor history buffers, performs interpolation, and executes rewind traces.  |

All gameplay interaction occurs through the manager; sources only push snapshots, and the worker performs all heavy operations in isolation.

***

### **`ULagCompensationSource` — Actor Snapshot Recorder**

**Header:** `LagCompensationSource.h`\
**Parent:** `UGameFrameworkComponent`

Each actor that should participate in lag compensation must have one `ULagCompensationSource` component attached.\
It identifies what kind of mesh (static or skeletal) the actor uses, constructs a table of collision shapes, and records snapshots each frame.

#### **Responsibilities**

* **Registration and Lifecycle**
  * On `BeginPlay`, the component waits for the **Lyra experience** to load.
  * Once loaded, it:
    * Resolves the relevant `UStaticMeshComponent` or `USkeletalMeshComponent`.
    * Builds the static or skeletal shape definition tables.
    * Finds the `ULagCompensationManager` in the `GameState` and registers with it.
  * On `EndPlay`, it unregisters and cleans up any delegates.
*   **Snapshot Capture**

    * For **static meshes**:
      * Ticks every frame (`TG_PostUpdateWork`) and captures:
        * Current `FBox` bounds.
        * Collision responses.
        * Component-to-world transform.
    * For **skeletal meshes**:
      * Does **not tick**.
      * Instead binds to the skeletal mesh’s `OnBoneTransformsFinalized` delegate, and captures bone world transforms as soon as animation finishes each frame.

    ```cpp
    FLagCompensationSnapshot Snapshot;
    Snapshot.Timestamp = GetWorld()->GetTimeSeconds();
    Snapshot.ActorBounds = SkeletalMeshComp->Bounds.GetBox();
    Snapshot.CollisionResponses = SkeletalMeshComp->GetCollisionResponseToChannels();
    Snapshot.BoneWorld = SkeletalMeshComp->GetBoneTransformsWorldSpace();
    ```
* **Shape Table Construction**
  * **Static shapes** (`BuildStaticShapeTable`):
    * Extracts simple primitives (Box, Sphere, Capsule, Convex) from the static mesh’s `UBodySetup`.
    * Stores per-shape parameters in an array of `FStaticShapeDef`.
  * **Skeletal shapes** (`BuildBoneShapeTable`):
    * Reads shapes from the physics asset.
    * Stores each body’s type, bone name, transform, and convex hull data into `FBoneShapeDef`.
  * These tables are static: they describe the _local-space_ geometry layout.
* **Snapshot Submission**
  *   Each captured snapshot is immediately handed off to the manager:

      ```cpp
      CachedManager->IngestSnapshot_GameThread(this, MoveTemp(Snapshot));
      ```
* **Thread Safety**
  * All snapshot building happens entirely on the **game thread**.
  * The worker thread never touches animation or physics components directly.

***

### **`ULagCompensationManager` — Central Coordinator**

**Header:** `LagCompensationManager.h`\
**Parent:** `UGameStateComponent`

The `ULagCompensationManager` acts as the bridge between gameplay code and the background worker.

#### **Responsibilities**

* **Source Management**
  * Keeps an array of all active `ULagCompensationSource` components.
  *   Uses a `FCriticalSection` lock for thread-safe modification:

      ```cpp
      FScopeLock Lock(&LagCompensationSourcesLock);
      LagCompensationSources.Add(SourceToAdd);
      ```
  * Sources register and unregister themselves automatically.
* **Thread Management**
  * On experience load, the manager creates the `FLagCompensationThreadRunnable` and passes it:
    * The current `UWorld*`
    * A pointer back to the manager
    * A pointer to its internal `FLagCompensationDebugService`
  * The worker immediately spawns its own `FRunnableThread` and creates a synchronization event `GameTickEvent`.
* **Tick Synchronization**
  * Every `TickComponent`:
    * Triggers `GameTickEvent` to wake the worker.
    * Flushes the debug draw service to render any queued hitbox or pose visualizations.
* **Snapshot Intake**
  *   `IngestSnapshot_GameThread()` queues snapshots for the worker:

      ```cpp
      LagCompensationThreadHandler->EnqueueSnapshot(Source, MoveTemp(Snapshot));
      LagCompensationThreadHandler->GameTickEvent->Trigger();
      ```
* **Public API**
  *   Provides asynchronous rewind tracing:

      ```cpp
      TFuture<FRewindLineTraceResult> RewindLineTrace(
          float LatencyInMs,
          const FVector& Start,
          const FVector& End,
          const FRewindTraceInfo& RewindTraceInfo,
          ECollisionChannel Channel,
          const TArray<AActor*>& ActorsToIgnore);
      ```
  * The manager wraps each trace request in a `TPromise` and enqueues it to the worker thread, returning the `TFuture` immediately.
* **Thread Lifetime**
  * On `EndPlay`, calls `EnsureCompletion()` on the worker and deletes it safely.

***

### **`FLagCompensationThreadRunnable` — Background Worker**

**Header:** `LagCompensationThreadRunnable.h`\
**Implements:** `FRunnable`

This thread owns all historical data and executes rewind traces asynchronously.\
It is **completely isolated** from gameplay and only communicates through queues.

#### **Responsibilities**

1. **Snapshot Storage**
   * Receives incoming `FLagCompensationSnapshot` objects from the manager.
   *   Converts them into lightweight `FLagCompensationData` nodes and pushes them into per-source linked lists:

       ```cpp
       TMap<ULagCompensationSource*, TDoubleLinkedList<FLagCompensationData>*> ActorHistoryData;
       ```
   * Each list represents one actor’s time history, pruned to the configured `MaxLatencyInMilliseconds`.
2. **Request Handling**
   * Receives `FRewindLineTraceRequest` objects via a concurrent queue.
   * Each contains timestamp, trace parameters, and a promise for returning the result.
3. **Rewind Process**
   * For each request:
     * Finds the two nearest snapshots bracketing the requested time.
     * Interpolates transforms and bone poses to produce an exact world-space pose at that timestamp.
     * Expands shapes (`ExpandShapesAtTime`) from stored local-space definitions and interpolated transforms.
     * Performs geometric intersection tests against these expanded shapes.
4. **Collision Testing**
   * Supports all collision primitives:
     * Sphere, Capsule, Box, and Convex hulls.
   * Uses exact Minkowski sum sweeps (sphere vs primitive) with robust handling of start-inside cases.
   * Writes intersection data into `FPenetrationHitResult` structures.
5. **Result Aggregation**
   * Sorts collisions by distance.
   * Appends static world results from `LagTraceUtils::PerformDirectTraceFallback()`.
   * Fulfills the associated `TPromise` to complete the trace.
6. **Debug Visualization (via `FLagCompensationDebugService`)**
   * Builds `FLagDebugPoseCmd` and `FLagDebugCollisionCmd` batches describing poses and collisions.
   * Enqueues them for game-thread rendering instead of drawing directly.
7. **Synchronization & Shutdown**
   * Sleeps until `GameTickEvent` is triggered.
   * Cleans up all lists and returns the sync event to the pool on destruction.

***

#### **History Data Structure**

| Type                       | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `FLagCompensationSnapshot` | Captured per-frame data from sources (game thread).                      |
| `FLagCompensationData`     | Processed, thread-owned historical record used for rewind interpolation. |
| `ActorHistoryData`         | Map of `ULagCompensationSource*` → linked list of past poses.            |

***

#### **Thread Flow Summary**

```
┌───────────────────────────────┐
│ ULagCompensationSource        │
│ (Game Thread)                 │
│ - Captures snapshot           │
│ - Submits to Manager          │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ ULagCompensationManager       │
│ (Game Thread)                 │
│ - Queues snapshot             │
│ - Triggers GameTickEvent      │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ FLagCompensationThreadRunnable│
│ (Worker Thread)               │
│ - Drains snapshot queue       │
│ - Updates history             │
│ - Processes rewind requests   │
│ - Enqueues debug draw data    │
└───────────────────────────────┘
```

***

#### **Design Notes**

* All real game state access (animation, transforms, physics) happens on the **game thread only**.
* The worker thread uses only immutable snapshot data, no UObject access after ingestion.
* The manager and worker communicate exclusively through lock-free queues and one synchronization event.
* Debug rendering is 100% game-thread safe via the deferred command service.

***

***
