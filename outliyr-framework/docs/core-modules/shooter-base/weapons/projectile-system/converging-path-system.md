# Converging Path System

In a realistic shooter, a projectile's flight is a ballistic arc, not a straight line. The core challenge this system solves is the discrepancy between two such arcs: the **True Path** (the intended trajectory from the player's camera) and the **Muzzle Path** (the actual trajectory from the weapon's muzzle).

### The Parallax Problem

The player's aim and the weapon's firing position are physically separate, creating a parallax effect between their respective trajectories.

* **The True Path (Player Intent):** This is the ballistic arc that starts at the camera and lands exactly where the player is aiming, perfectly accounting for their compensation for gravity, bullet drop, and target leading. This is the "correct" shot.
* **The Muzzle Path (Physical Reality):** A projectile fired from the weapon's muzzle towards the same distant aim point will follow a slightly different, offset arc.

While negligible at extreme ranges, this parallax causes significant aiming errors in common gameplay scenarios:

* **Bullet Drop Compensation:** When a player aims above a target to account for drop, their crosshair is on the background. A naive projectile from the muzzle would follow a different arc towards that background point, missing the intended foreground target.
* **Leading Moving Targets:** When a player leads a target, their crosshair is on empty space. The parallax would cause a muzzle-fired projectile's arc to deviate from the player's intended intercept course.
* **Shooting Around Cover:** The parallax is also highly noticeable at close range, causing projectiles to hit cover that the player's camera view was clear of.

The Converging Path System is designed to eliminate this parallax error entirely.

#### The Solution: A Two-Phase Trajectory

The system creates a two-part journey for the projectile that guarantees it ends up on the player's intended path.

1. **The Bridge Path:** For a short, defined duration (`PathJoinTime`), the projectile follows a custom, constant-acceleration curve. This curve is mathematically solved to start at the weapon's muzzle and end by perfectly matching the position and velocity of the True Path at the end of the duration.
2. **The True Path:** After the Bridge Path is complete, the projectile's movement is handed over to the standard `UProjectileMovementComponent`. Because its position and velocity now perfectly match the True Path, it continues along this ideal trajectory for the rest of its flight as if it had been fired from the camera all along.

This ensures the projectile _visually_ comes from the gun but _functionally_ travels exactly where the player is aiming.

### Implementation Details (`AProjectileBase` & `UGameplayAbility_PredictiveProjectile`)

The process is divided into distinct phases:

**Phase 1: Calculation (at spawn)**

* When the projectile is fired, `UGameplayAbility_PredictiveProjectile::CalculateProjectileLaunchParams` performs the initial calculations.
* It first determines the state (position and velocity) of the **True Path** at `t = PathJoinTime`. This state is called the **Join Point**.
* It then solves a kinematic problem: "What initial velocity and constant acceleration are required to travel from the `MuzzleLocation` to the `JoinPoint` in exactly `PathJoinTime`?"
* The results are stored in a replicated `FProjectileInitState` struct (`InitialBridgeVelocity`, `BridgeAcceleration`, `BridgeDuration`).

**Phase 2: The Bridge (Manual Movement)**

* Upon spawning, `AProjectileBase` checks if it has a `BridgeDuration > 0`.
* If so, it **disables its `UProjectileMovementComponent`'s tick**.
* In its own `Actor::Tick`, it manually updates its position and velocity each frame using the constant-acceleration formula: `Position(t) = P₀ + V₀t + ½at²`. This is managed by the `SetStateFromTimeInBridge` function.
* This manual control ensures the projectile follows the pre-calculated bridge curve with perfect precision, avoiding any physics integration errors.

**Phase 3: The Transition (The "Snap")**

* When the actor's internal `TimeInBridge` meets or exceeds `BridgeDuration`, the transition occurs.
* The actor's position and velocity are **snapped** to the final state of the bridge path (which is identical to the Join Point on the True Path).
* The `UProjectileMovementComponent` is **re-enabled and activated**, and its velocity is set to the final bridge velocity.

**Phase 4: The True Path (Standard Movement)**

* With the `UProjectileMovementComponent` now active and its state perfectly synchronized with the True Path, it takes over all subsequent movement.
* The projectile now flies as a standard Unreal projectile, correctly affected by gravity, drag, and collision.

### Application to Visual Effects (VFX)

This system's precision extends to visual effects. The associated Niagara tracer (e.g., `NS_WeaponFire_ProjectileTracer`) uses HLSL scripts that replicate the exact same kinematic formulas. The `FProjectileInitState` parameters are passed to the Niagara System, allowing the visual effect to independently calculate and render the _exact same_ Bridge Path and subsequent True Path, ensuring the VFX tracer never deviates from the physical projectile.

### Benefits

* **Perfect Aiming Correlation:** Guarantees that the projectile's trajectory perfectly matches the ballistic arc originating from the player's camera. "What you aim at is what you hit," regardless of compensation for bullet drop or target lead.
* **Eliminates Parallax Errors:** Solves the aiming parallax between the camera and muzzle, making gameplay consistent and removing frustrating misses when shooting around cover or compensating for projectile travel time.
* **Visually Seamless:** The transition from the Bridge Path to the True Path is mathematically seamless, creating a natural-looking projectile flight that visually originates from the weapon.

This system provides a sophisticated solution for projectile trajectory that enhances both gameplay feel and visual fidelity in networked shooter environments.

***
