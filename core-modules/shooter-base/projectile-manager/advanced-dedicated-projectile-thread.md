# Advanced: Dedicated Projectile Thread

This section provides a high-level overview for context. Modifying the thread's internal logic is complex and generally not recommended unless you have significant expertise in C++, multithreading, and physics simulation.

The core simulation of projectiles managed by the `UProjectileManager` does not happen on the main game thread. To handle potentially thousands of projectiles efficiently without impacting frame rate, the work is offloaded to a dedicated background thread implemented by the `FLagCompensationThreadRunnable` class. This thread is distinct from the one used by the [Lag Compensation system](../lag-compensation/).

### Purpose and Role

The simulation thread is responsible for:

1. **Maintaining State:** Keeping track of all active projectiles (`FTraceProjectile` data) managed by the system.
2. **Simulation Loop:** Regularly updating the position and velocity of each active projectile based on time elapsed and basic physics (like gravity).
3. **Collision Detection:** Performing traces along each projectile's movement path for the current frame. **Critically, these traces utilize the Lag Compensation system (`ULagCompensationManager::RewindLineTrace`)** to check against historical hitbox data, ensuring accurate hit detection against moving targets.
4. **Penetration Logic:** Applying the configured penetration rules (`ShouldProjectilePenetrate`) when a collision occurs to determine if the projectile should pass through or stop.
5. **Notification:** Sending impact results back to the `UProjectileManager` on the main game thread for gameplay consequences (damage, effects).
6. **Lifecycle Management:** Removing projectiles that exceed their `MaxLifespan`, `MaxRange`, or stop due to collision/penetration limits.

### Synchronization

* **`GameTickEvent`:** The thread largely synchronizes its main update cycle with the game thread's tick using an `FEvent`. The `UProjectileManager` triggers the event each tick, waking the thread's `Run()` loop if it's waiting. This prevents the simulation from running significantly ahead or behind the game state updates.
* **Queues:** Thread-safe queues (`TQueue`) are used for communication:
  * `ProjectileBatch`: Game thread adds new projectile requests here. Thread dequeues them at the start of its cycle.
  * `ProjectilesToRemove`: Thread adds IDs of projectiles to be removed here. Processed at the start of the cycle.
  * `ProjectileTraceCompleted`: Game thread (via async task from Lag Comp) potentially places completed trace results here for the thread to process collision logic. _(Note: The exact mechanism of returning lag comp results might involve promises/futures directly as well, but queues are often used for thread communication patterns)._
* **AsyncTasks:** For sending impact results _back_ to the game thread (`InformGameThreadOfCollision`), the thread uses `AsyncTask(ENamedThreads::GameThread, ...)` to ensure the `UProjectileManager` delegate (`HandleProjectileImpact`) is called safely on the main thread.

### Internal Representation (`FTraceProjectile` Struct)

While the `FNewTraceProjectileMessage` defines the initial parameters, the thread manages the ongoing state of each projectile using the `FTraceProjectile` struct. This includes runtime variables not present in the initial message:

* **`CurrentLifespan` / `CurrentDistance`:** Track elapsed time and distance traveled.
* **`CurrentPenetrationPower`:** _(Potentially unused/future expansion)_ Could track remaining penetration capability.
* **`NumPenetrationsSoFar` (`TArray<UPhysicalMaterial*>`):** Stores the physical materials of surfaces already successfully penetrated. Used by `HandleProjectileImpact` to calculate cumulative damage reduction.
* **`PenetratedActors` (`TArray<AActor*>`):** Tracks actors already hit and penetrated by this projectile to prevent multiple hits on the same actor during complex penetration scenarios or overlaps.
* **`bRewindLineTraceInProgress`:** A flag used internally to prevent movement updates while an asynchronous lag compensation trace is pending for that projectile.
* **`AccumulatedDeltaTime`:** Stores time elapsed between simulation steps, especially if a lag comp trace caused a delay.

### Key Internal Functions (Conceptual)

* **`Run()`:** The main loop, waiting on `GameTickEvent`, processing queues, and orchestrating the simulation cycle.
* **`MoveProjectiles()` / `MoveProjectileSingleFrame()`:** Updates position/velocity, checks lifespan/range, initiates collision checks.
* **`UpdateVelocity()`:** Applies environmental effects like gravity.
* **`InitiateRewindLineTrace()`:** Makes the async call to the Lag Compensation Manager.
* **`HandleRewindLineTraceCompleted()` / `HandleCollision()`:** Processes the results from lag compensation.
* **`ShouldProjectilePenetrate()`:** Applies the configured material rules to determine if a hit surface can be penetrated.
* **`InformGameThreadOfCollision()`:** Sends impact data back to the `UProjectileManager`.

By running these operations on a separate thread, the Projectile Manager can simulate a large number of fast-moving objects with complex collision and penetration rules without crippling the main game thread responsible for rendering and gameplay logic execution.

***
