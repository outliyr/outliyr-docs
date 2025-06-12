# Projectile Manager

The **Projectile Manager** is a specialized, high-performance system within ShooterBase designed to handle large numbers of fast-moving, trace-based projectiles, typically representing bullets from firearms like assault rifles, SMGs, or miniguns.

Standard Unreal Engine approaches often involve spawning an `AActor` for each projectile. While flexible, this can become a significant performance bottleneck when dealing with:

* **High Fire Rates:** Weapons firing hundreds of rounds per minute quickly lead to a large number of active projectile actors.
* **High Player Counts:** Many players firing simultaneously multiplies the actor count dramatically.
* **Fast Travel Speeds:** Extremely fast actors require very frequent updates and can encounter collision detection issues (tunneling) with standard physics.

The Projectile Manager solves these problems by simulating projectiles as lightweight data structures (`FTraceProjectile`) on a **dedicated background thread**, performing efficient trace-based collision detection that leverages the **Lag Compensation** system for accuracy in networked environments.

### Key Features

* **Multithreaded Simulation:** Offloads the computationally intensive tasks of projectile movement and collision detection to a separate thread (`FProjectileThreadRunnable`), minimizing impact on the main game thread's performance.
* **Efficient Data Structure:** Simulates projectiles as data (`FTraceProjectile`) rather than full actors, significantly reducing overhead.
* **Lag-Compensated Collision:** Integrates directly with the `ULagCompensationManager` to perform collision traces against historically accurate hitbox positions of tracked targets, ensuring fair and accurate hit registration even with latency.
* **Penetration Physics:** Includes logic for projectiles to penetrate materials based on configurable rules (`FProjectileMaterialPenetrationInfo`), allowing bullets to pass through cover.
* **Scalability:** Designed to handle a significantly higher volume of active projectiles compared to spawning individual actors.

### Contrast with Actor-Based Projectiles (`AProjectileBase`)

It's crucial to understand when to use the Projectile Manager versus the standard Actor-based projectile system (`AProjectileBase` used by `UGameplayAbility_PredictiveProjectile` more details [check this page](when-to-use-projectile-manager-vs-actor-projectiles.md)):

* **Use Projectile Manager For:**
  * Typical bullet trajectories (affected by gravity, potentially penetration).
  * Weapons with high fire rates or needing many simultaneous projectiles.
  * Performance-critical scenarios where actor overhead is a concern.
  * When accurate, lag-compensated hit detection for fast projectiles is essential.
* **Use `AProjectileBase` / Actor Projectiles For:**
  * Slower projectiles (grenades, rockets, magic spells).
  * Projectiles requiring complex, unique behaviors beyond simple physics (e.g., homing logic, timed detonation, custom movement patterns).
  * Projectiles needing intricate visual prediction (handled by `UGameplayAbility_PredictiveProjectile`).
  * Situations where the number of active projectiles is relatively low and actor overhead is acceptable.

### Core Interaction Flow (High-Level)

1. **Request:** Game logic (usually a firing Gameplay Ability) sends a message (`FNewTraceProjectileMessage`) via the `UGameplayMessageSubsystem` requesting a projectile spawn.
2. **Management:** The `UProjectileManager` (on the GameState) receives the message.
3. **Thread Handover:** The Manager converts the message into an `FTraceProjectile` data structure and passes it to the background simulation thread (`FProjectileThreadRunnable`).
4. **Simulation (Thread):** The thread adds the projectile to its simulation loop. Each cycle, it updates positions (applying gravity), performs collision checks using lag-compensated traces (`ULagCompensationManager::RewindLineTrace`), and handles penetration logic.
5. **Impact Notification (Thread -> Manager):** When a collision occurs, the thread sends the impact details (`FPenetrationHitResult`) back to the `UProjectileManager` on the main game thread asynchronously.
6. **Impact Handling (Manager - Game Thread):** The `UProjectileManager` receives the impact notification and triggers game logic – applying damage (`UGameplayEffect`), spawning visual/audio effects (via the `AddImpactEffects` Blueprint event), and notifying the shooter via hit markers (`UWeaponStateComponent`).

### <mark style="color:red;">IMPORTANT: Complexity and Modification Warning</mark>

Similar to the Lag Compensation system it relies upon, the Projectile Manager involves **complex multithreading, asynchronous operations, and detailed simulation logic.**

**Modifying the core internals (`UProjectileManager`, `FProjectileThreadRunnable`) is highly advanced and carries significant risk.** It requires expertise in C++, multithreading, physics, and networking.

**Developers are strongly advised to interact with the system via its intended interface:**

* Sending `FNewTraceProjectileMessage` to spawn projectiles.
* Implementing the `AddImpactEffects` Blueprint event in a `UProjectileManager` subclass to handle impact visuals and sounds.
* Configuring penetration rules via `FProjectileMaterialPenetrationInfo`.

Attempting to alter the thread's simulation or collision logic without a full understanding can easily lead to instability, incorrect behavior, or performance degradation.

***
