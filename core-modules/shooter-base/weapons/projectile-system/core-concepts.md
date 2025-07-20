# Core Concepts

`ProjectileBase` is the fundamental actor class for all simulated projectiles originating from weapons within the ShooterBase system. It serves as a networked container for movement logic, prediction state, and the advanced trajectory features like the Merge Point system.

### Purpose and Design

`AProjectileBase` is designed to be:

* **Networked:** It supports replication (`bReplicates = true`) and includes logic specifically for handling client-side prediction and synchronization.
* **Movement Driven:** It relies heavily on the standard Unreal Engine `UProjectileMovementComponent` for its physics simulation (velocity, gravity, bouncing, etc.) _after_ the initial Merge Point curve phase.
* **Predictive:** It understands the difference between a purely visual client-side projectile ("fake") and the server-authoritative one, enabling latency hiding techniques.
* **Trajectory Aware:** It incorporates the Merge Point system logic to provide visually intuitive aiming.
* **Extensible:** Designed as an abstract base class (`Abstract`), you are expected to create Blueprint or C++ subclasses to define specific projectile behaviors (e.g., what happens on impact, visual effects, specific movement modifiers).

### Core Components

* **`ProjectileMovement` (`UProjectileMovementComponent*`)**:
  * This is the standard UE component responsible for simulating the projectile's movement through the world using physics (velocity, acceleration, gravity, collision response, bouncing, etc.).
  * `AProjectileBase` manages this component, particularly disabling its tick during the initial Merge Point curve traversal and re-enabling it afterward.
  * You configure properties like `InitialSpeed`, `MaxSpeed`, `bShouldBounce`, `ProjectileGravityScale`, etc., directly on this component within your `AProjectileBase` subclasses.

### Authority vs. Fake Projectiles

A key concept in `AProjectileBase` is distinguishing between the server's "real" projectile and the client's "fake" one used for prediction:

* **`IsFakeProjectile()` (`bool`)**:
  * Returns `true` if this instance is the visual-only projectile spawned immediately on the firing client for prediction purposes.
  * Fake projectiles typically have collision disabled (`SetActorEnableCollision(false)`) to avoid interfering with the authoritative server projectile.
  * Their movement is eventually synchronized with the server projectile.
* **`ProjectileHasAuthority()` (`bool`)**:
  * Returns `true` if this instance is the authoritative projectile, spawned and controlled by the server.
  * This is the projectile that performs actual collision checks, applies damage (usually via an `OnHit` event or similar logic in subclasses), and whose state is replicated to clients.
  * Internally, this checks `HasAuthority() && !bIsFakeProjectile`.

This distinction is crucial for the client-side prediction system detailed in later pages and in the `UGameplayAbility_PredictiveProjectile` documentation.

### Basic Lifecycle

* **`BeginPlay()`**:
  * Initializes the projectile's velocity based on the `InitialSpeed` set during spawning.
  * If the projectile needs to follow the Merge Point curve (`!bHasMerged`), it disables the `ProjectileMovementComponent`'s tick initially.
  * Sets up and performs the initial client catchup logic if running as a simulated proxy.
  * Registers the `InitialReplicationTick` if necessary on the server.
* **`TickActor()` / `Tick()`**:
  * `TickActor` handles the special `InitialReplicationTick` for forcing early replication.
  * The regular `Tick()` function is primarily responsible for driving the projectile along the Hermite spline curve during the Merge Point phase (`if (!bHasMerged)`). It calculates the position on the curve based on `CurveElapsedTime` and updates the actor's location until the merge point is reached.

### Extending `AProjectileBase`

You will typically create Blueprint subclasses of `AProjectileBase` to:

1. **Configure `ProjectileMovementComponent`:** Set speeds, gravity, bounce properties, homing behavior, etc.
2. **Define Impact Logic:** Override `OnComponentHit` (for the `ProjectileMovementComponent`) or add other collision components to define what happens when the projectile hits something (e.g., apply damage, spawn explosion effects, destroy self). Remember to check `ProjectileHasAuthority()` before applying damage or gameplay-altering effects.
3. **Add Visuals:** Assign static or skeletal meshes, particle systems (like trails), and sound effects.
4. **Implement Custom Logic:** Add any unique behaviors specific to your projectile type.

***
