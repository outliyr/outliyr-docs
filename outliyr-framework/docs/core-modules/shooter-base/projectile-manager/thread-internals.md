# Thread Internals

This page is for the curious, developers who want to understand how the simulation thread works internally. You don't need this knowledge to use the system, but it helps when debugging or deciding whether the Projectile Manager fits your use case.

{% hint style="warning" %}
**Modification Warning**: The thread internals are complex and intertwined with the lag compensation system. Modifying this code requires expertise in C++ multithreading, async patterns, and networked physics. If you need custom projectile behavior not supported by the configuration options, consider using [predictive projectile system](../weapons/projectile-system/) instead.
{% endhint %}

***

## Purpose

The `FProjectileThreadRunnable` handles everything that would be too expensive on the main thread:

* **Tracking state** for potentially hundreds of active projectiles
* **Simulation loop** that moves projectiles and applies gravity
* **Collision detection** via lag-compensated traces
* **Penetration/ricochet logic** based on material rules
* **Lifecycle management** (removing expired projectiles)

***

### The Synchronization Pattern

The thread doesn't run freely, it's synchronized with the game tick. The intent is to ensure projectiles advance in lockstep with the game and world state. Below is the interaction represented as a two-step cycle.

{% stepper %}
{% step %}
#### Main Thread (`UProjectileManager::TickComponent`)

* `SendBatchedProjectileImpact()` // Send batched VFX from last tick
* `GameTickEvent->Trigger()` // Wake projectile thread

The main thread triggers the projectile thread once per game tick.
{% endstep %}

{% step %}
#### Projectile Thread (`FProjectileThreadRunnable::Run`)

* while running:
  * `GameTickEvent->Wait()` // Sleep until triggered
  * `ProcessBatchQueue()` // Add new projectiles from main thread
  * `ProcessRemovalQueue()` // Remove finished projectiles
  * `MoveProjectiles()` // Simulate all active projectiles

The thread wakes, processes one cycle, and goes back to sleep.
{% endstep %}
{% endstepper %}

Without synchronization, the simulation could drift ahead of world state, causing impossible-to-debug collision issues.

***

### Communication Patterns

#### Main Thread → Projectile Thread

New projectiles arrive via a thread-safe queue:

```plaintext
Main Thread:
    ProjectileBatch.Enqueue(new_projectile)

Projectile Thread (start of cycle):
    while ProjectileBatch.Dequeue(projectile):
        Projectiles.Add(NextId++, projectile)
```

#### Projectile Thread → Main Thread

Impact notifications use `AsyncTask`:

```plaintext
Projectile Thread (on collision):
    shared_projectile = MakeShared<FTraceProjectile>(projectile)
    shared_hit = MakeShared<FPenetrationHitResult>(hit)

    AsyncTask(ENamedThreads::GameThread, [=]() {
        OnProjectileImpact.Broadcast(shared_projectile, shared_hit)
    })
```

The shared pointers ensure data survives the cross-thread handoff.

#### Lag Compensation Integration

Collision traces are asynchronous:

```plaintext
Projectile Thread:
    projectile.bRewindLineTraceInProgress = true
    future = LagCompManager->RewindLineTrace(start, end, timestamp, ...)

    future.Then([this, id](result) {
        HandleRewindLineTraceCompleted(id, result)
    })

// Later, when future completes:
HandleRewindLineTraceCompleted(id, result):
    projectile = Projectiles[id]
    projectile.bRewindLineTraceInProgress = false
    HandleCollision(projectile, result)
```

While waiting for lag comp, the projectile's movement is paused to prevent race conditions.

***

### Runtime State (`FTraceProjectile`)

Each projectile carries runtime state beyond what was in the spawn message:

| Field                         | Purpose                                             |
| ----------------------------- | --------------------------------------------------- |
| `CurrentLifespan`             | Time elapsed since spawn                            |
| `TotalDistanceTraveled`       | Distance traveled so far                            |
| `SimulatedSecondsSinceFire`   | Total simulated time (for lag comp chaining)        |
| `PendingStepSeconds`          | Accumulated delta time during lag comp wait         |
| `LagCompSegmentsUsedThisTick` | Budget tracking for LC segments per tick            |
| `NumPenetrationsSoFar`        | Materials already penetrated (for damage reduction) |
| `PenetratedActors`            | Actors already hit (prevents double-hits)           |
| `CurrentRicochetCount`        | Bounces so far                                      |
| `bRewindLineTraceInProgress`  | Pause movement while lag comp trace pending         |
| `AccumulatedDeltaTime`        | Time accumulated during lag comp wait               |

### `SimulatedSecondsSinceFire` Explained

When a bullet ricochets, the lag compensation must continue from where the previous segment ended. `SimulatedSecondsSinceFire` tracks the total simulated time across all segments:

```plaintext
Bullet fires at T=0
    - Flies for 50ms, hits wall at T=50ms
    - Ricochets

Ricochet continuation:
    - SimulatedSecondsSinceFire = 0.05 (50ms)
    - Next LC trace starts at timestamp + 0.05
    - Ensures hitboxes are rewound to correct moment in time
```

Without this, ricocheting bullets would trace against hitbox positions from the wrong time.

***

### The Simulation Loop

Each tick, the thread processes all active projectiles. The logic can be expressed stepwise for clarity.

{% stepper %}
{% step %}
#### Loop iterate for each (id, projectile) in Projectiles

```
Skip if waiting for lag comp result:
    if projectile.bRewindLineTraceInProgress: continue
```
{% endstep %}

{% step %}
#### Expiration check

```
if projectile.CurrentLifespan > projectile.MaxLifespan:
    -RemoveProjectile(id)
    -continue
```
{% endstep %}

{% step %}
### Physics

```
UpdateVelocity(projectile, DeltaTime) // Apply gravity
new_location = projectile.CurrentLocation + projectile.Velocity * DeltaTime
InitiateRewindLineTrace(id, projectile.CurrentLocation, new_location)
```
{% endstep %}
{% endstepper %}

***

### Ricochet Chaining with `ContinueLagCompensatedSegment`

When a bullet ricochets, it must continue its lag-compensated journey from the exact moment it bounced:

```plaintext
HandleCollision(projectile, hit_result):
    // Check ricochet eligibility
    if should_ricochet(hit_result):
        // Calculate new direction
        new_velocity = reflect(projectile.Velocity, hit_result.Normal)
        new_velocity *= material.RicochetVelocityPercentage

        // Update projectile state
        projectile.Velocity = new_velocity
        projectile.CurrentLocation = hit_result.ImpactPoint
        projectile.CurrentRicochetCount++

        // Continue lag compensation from this point
        ContinueLagCompensatedSegment(projectile)
        return

    // Not ricocheting - stop bullet
    NotifyImpact(projectile, hit_result)
    RemoveProjectile(projectile.Id)
```

`ContinueLagCompensatedSegment`:

```plaintext
ContinueLagCompensatedSegment(projectile):
    // Don't exceed per-tick budget
    if projectile.LagCompSegmentsUsedThisTick >= MaxLagCompSegmentsPerTick:
        projectile.PendingStepSeconds = remaining_delta
        return  // Will continue next tick

    projectile.LagCompSegmentsUsedThisTick++

    // Calculate how far bullet should travel this frame
    remaining_delta = PendingStepSeconds + AccumulatedDeltaTime
    new_location = projectile.CurrentLocation + projectile.Velocity * remaining_delta

    // Start next lag comp trace, using SimulatedSecondsSinceFire for timestamp
    effective_timestamp = original_timestamp + SimulatedSecondsSinceFire
    InitiateRewindLineTrace(id, projectile.CurrentLocation, new_location, effective_timestamp)
```

Why budget segments? A bullet could theoretically ricochet many times in a single frame (e.g., bouncing in a corner). Unbounded recursion would hang the thread. `MaxLagCompSegmentsPerTick` limits how many LC segments a single projectile can use per tick.

***

### Why You Shouldn't Modify This

The thread has tight coupling with several systems:

* Lag Compensation System: Traces go through `ULagCompensationManager` which has its own threading model
* GameplayEffect Application: Damage timing assumptions in `HandleProjectileImpact`
* Hit Marker System: `UWeaponStateComponent` expects specific data formats
* Penetration State: The damage reduction calculation relies on specific tracking patterns
* Batched GameplayCue System: Impact batching assumes specific notification patterns

Changing any of these interactions can cause:

* Race conditions and crashes
* Desync between client prediction and server validation
* Incorrect damage calculations
* Memory leaks from unmanaged shared pointers

***

### What To Do Instead

If the Projectile Manager doesn't support your use case:

| Need                                | Solution                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| Custom movement (homing, spiraling) | Use [predictive projectile system](../weapons/projectile-system/) |
| Different collision logic           | Use actor projectiles with custom `UProjectileMovementComponent`  |
| Custom penetration rules            | Configure `FProjectileMaterialPenetrationInfo` fields             |
| Custom VFX handling                 | Create custom GameplayCue Notifies                                |
| Custom damage calculation           | Modify your `UGameplayEffect`, not the manager                    |

The Projectile Manager excels at one thing: simulating large numbers of standard bullets with gravity, penetration, and lag-compensated hit detection. For anything more exotic, actor projectiles provide better extensibility.

***
