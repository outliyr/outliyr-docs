# Lag Compensation Thread

To prevent the computationally intensive tasks of history management and rewind tracing from impacting the main game thread's performance (potentially causing frame rate drops or stuttering), the ShooterBase Lag Compensation system offloads this work to a dedicated background thread. This thread is implemented using the standard Unreal Engine `FRunnable` interface within the `FLagCompensationThreadRunnable` class.

### Role and Purpose

The primary responsibilities of the lag compensation thread are:

1. **Maintaining Hitbox History:** Periodically capture the collision state (location, rotation, shape data) of all tracked `ULagCompensationSource` actors and store these snapshots chronologically.
2. **Processing Rewind Requests:** Dequeue trace requests sent from the game thread, find the relevant historical data, interpolate actor states to the requested timestamp, perform complex trace calculations against those historical states, and return the results.
3. **Thread Safety:** Manage access to shared data (like the list of sources provided by the manager) in a thread-safe manner.

### Creation and Lifecycle

* **Creation:** An instance of `FLagCompensationThreadRunnable` is created by the `ULagCompensationManager` on the server during initialization (typically after the Lyra Experience loads, and only if not in Standalone mode and not disabled by CVar). The manager passes itself and the `UWorld*` pointer for context. A standard `FRunnableThread` is created to execute the runnable's `Run()` method.
* **Synchronization (`GameTickEvent`):** A `FEvent*` (obtained from `FPlatformProcess::GetSynchEventFromPool`) is created and shared between the manager and the thread. The manager triggers this event each tick (`ULagCompensationManager::TickComponent`). The thread's main loop (`Run()`) waits on this event (`GameTickEvent->Wait()`). This ensures the thread's primary work cycle (updating history, processing requests) generally aligns with the game thread's tick, preventing the thread from running uncontrollably or falling too far behind.
* **Shutdown (`Stop`, `Exit`, `EnsureCompletion`):** When the `ULagCompensationManager` is destroyed (`EndPlay`), it calls `Stop()` on the runnable, setting a `bShutdown` flag. The `Run()` loop checks this flag and exits. `Exit()` performs final cleanup within the thread context (like clearing `ActorHistoryData`). The manager then calls `EnsureCompletion()` which triggers the `GameTickEvent` one last time (to wake the thread if waiting) and blocks (`Thread->WaitForCompletion()`) until the thread fully terminates before deleting the runnable and thread objects.

### Key Responsibilities & Data Structures

1. **History Management:**
   * **`ActorHistoryData` (`TMap<ULagCompensationSource*, TDoubleLinkedList<FLagCompensationData>*>`):** The core data structure. Maps each tracked `ULagCompensationSource` component pointer to a pointer to a doubly linked list containing its historical snapshots. Using a linked list allows efficient adding to the head (newest data) and removing from the tail (oldest data). Pointers are used for the list values to manage memory on the heap, potentially allowing for larger history buffers if needed, though careful memory management is required in the destructor (`~FLagCompensationThreadRunnable`).
   * **`FLagCompensationData`:** Represents a single snapshot in time for one actor. Contains:
     * `Timestamp`: The `World->GetTimeSeconds()` when the snapshot was taken.
     * `ActorLocation`, `ActorBounds`: Overall position and bounding box for broad-phase checks.
     * `CollisionProfileName`: Needed for trace filtering.
     * `HitBoxes` (`TArray<FLagHitboxInfo>`): An array holding detailed info for _each_ collision primitive (box, sphere, capsule) associated with the actor's mesh at that timestamp.
   * **`FLagHitboxInfo`:** Contains the specific data for one collision shape within a snapshot:
     * `Location`, `Rotation`: World-space position and orientation of the specific hitbox.
     * `Collision`: The `FCollisionShape` itself (box extents, sphere radius, capsule radius/half-height).
     * `BoneName`: If applicable (skeletal mesh), the name of the bone this shape is attached to.
     * `BodySetupIndex`, `PrimitiveIndex`: Indices needed to map hits back to the original physics asset/static mesh collision setup, primarily used by `FPenetrationHitResult::GetCurrentHitBox`.
     * `bStaticMesh`: Flag indicating the source mesh type.
     * `PhysicalMaterial`: The `UPhysicalMaterial` associated with this specific hitbox.
   * **`UpdateLagCompensationSources()` / `UpdateHistoryData()`:** Functions called each cycle (triggered by `GameTickEvent`) to iterate through tracked sources, capture the current state (`StoreStaticMeshHitBoxInfo`/`StoreSkeletalMeshHitBoxInfo`), create a new `FLagCompensationData` snapshot, add it to the head of the appropriate list in `ActorHistoryData`, and prune the tail if the history exceeds `MaxLatencyInMilliseconds`.
2. **Trace Request Processing:**
   * **`RewindLineTraceRequests` (`TQueue<FRewindLineTraceRequest>`):** A thread-safe queue where the manager places incoming trace requests.
   * **`ProcessRewindLineTraceRequests()`:** Dequeues requests in the thread's main loop.
   * **`RewindTrace()`:** The main function performing the historical trace for a single request. It iterates through `ActorHistoryData`, calls `ShouldRewind` to find and interpolate historical data, performs traces against interpolated hitboxes (`PerformHitBoxTrace` -> `CalculateTraceIntersections`), performs a trace against the current non-tracked world (`PerformNonHitBoxTrace`), sorts the results (`SortCollisionByDistance`), and packages them into `FRewindLineTraceResult`.
   * **Result Fulfillment:** Sets the calculated `FRewindLineTraceResult` into the `TPromise` that was part of the original `FRewindLineTraceRequest`.

### Hitbox Representation (`FLagHitboxInfo`)

Storing detailed `FLagHitboxInfo` for _each_ collision primitive (instead of just the overall actor bounds) is critical for accuracy. It allows the rewind trace to check against the precise shape and position of individual body parts (head, torso, limbs from a physics asset) or specific collision volumes on a static mesh as they existed in the past. This enables accurate headshot detection and avoids hits registering incorrectly due to simple bounding box approximations. The `ConvertCollisionToShape` helper function translates the engine's `FKShapeElem` data into the runtime `FCollisionShape` format used for tracing.

By handling these complex tasks on a separate thread, the `FLagCompensationThreadRunnable` ensures the server can perform accurate, historical hit validation without sacrificing main thread responsiveness.

***
