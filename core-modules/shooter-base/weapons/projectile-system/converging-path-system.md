# Converging Path System

The player's aim originates from the camera, but projectiles spawn at the weapon muzzle. This parallax causes aiming errors when compensating for bullet drop or leading targets. The Converging Path System eliminates this by mathematically solving a trajectory that starts at the muzzle and joins the camera's aim line.

***

### The Parallax Problem

The player's aim and the weapon's firing position are physically separate, creating a parallax effect between their respective trajectories.

* **The True Path (Player Intent):** This is the ballistic arc that starts at the camera and lands exactly where the player is aiming, perfectly accounting for their compensation for gravity, bullet drop, and target leading. This is the "correct" shot.
* **The Muzzle Path (Physical Reality):** A projectile fired from the weapon's muzzle towards the same distant aim point will follow a slightly different, offset arc.

While negligible at extreme ranges, this parallax causes significant aiming errors in common gameplay scenarios:

* **Bullet Drop Compensation:** When a player aims above a target to account for drop, their crosshair is on the background. A naive projectile from the muzzle would follow a different arc towards that background point, missing the intended foreground target.
* **Leading Moving Targets:** When a player leads a target, their crosshair is on empty space. The parallax would cause a muzzle-fired projectile's arc to deviate from the player's intended intercept course.
* **Shooting Around Cover:** The parallax is also highly noticeable at close range, causing projectiles to hit cover that the player's camera view was clear of.

The Converging Path System is designed to eliminate this parallax error entirely.

***

### Two-Phase Trajectory

The system creates a two-part journey for the projectile that guarantees it ends up on the player's intended path.

{% stepper %}
{% step %}
#### Bridge Path

For a short, defined duration (`PathJoinTime`), the projectile follows a custom, constant-acceleration curve. This curve is mathematically solved to start at the weapon's muzzle and end by perfectly matching the position and velocity of the True Path at the end of the duration.
{% endstep %}

{% step %}
#### True Path

After the Bridge Path is complete, the projectile's movement is handed over to the standard `UProjectileMovementComponent`. Because its position and velocity now perfectly match the True Path, it continues along this ideal trajectory for the rest of its flight as if it had been fired from the camera all along.
{% endstep %}
{% endstepper %}

This ensures the projectile visually comes from the gun but functionally travels exactly where the player is aiming.

***

### Mathematical Implementation

The system uses constant-acceleration kinematic equations.

#### Core Equation

Position at time `t`:

```
P(t) = P₀ + V₀t + ½at²
```

Where:

* `P₀` = Initial position (muzzle location)
* `V₀` = Initial velocity (calculated)
* `a` = Constant acceleration (calculated)
* `t` = Time in bridge phase

#### Solving for Launch Parameters

Given:

* Muzzle location (`P_muzzle`)
* Join point on True Path (`P_join`) at time `PathJoinTime`
* Required velocity at join point (`V_join`)

The ability solves for initial velocity and acceleration:

```cpp
// Join point: where True Path will be at t = PathJoinTime
P_join = CameraLocation + (V_camera * PathJoinTime) + (0.5f * Gravity * PathJoinTime²)
V_join = V_camera + (Gravity * PathJoinTime)

// Displacement from muzzle to join point
Displacement = P_join - P_muzzle

// Solve kinematic equation for initial velocity:
// Displacement = (V_initial + V_final) / 2 * time
// V_initial = (2 * Displacement / time) - V_final
V_initial = (2 * Displacement / PathJoinTime) - V_join

// Acceleration during bridge
Acceleration = (V_join - V_initial) / PathJoinTime
```

#### `SetStateFromTimeInBridge()`

`AProjectileBase` uses this function to calculate position at any time during the bridge:

```cpp
void AProjectileBase::SetStateFromTimeInBridge(float Time)
{
    // P(t) = P₀ + V₀t + ½at²
    FVector Position = InitialPosition +
                       InitialBridgeVelocity * Time +
                       0.5f * BridgeAcceleration * Time * Time;

    SetActorLocation(Position);
}
```

***

### Implementation Flow

{% stepper %}
{% step %}
#### Phase 1: Calculation (At Spawn)

* `UGameplayAbility_PredictiveProjectile::CalculateProjectileLaunchParams()` performs calculations
* Determines True Path state at `t = PathJoinTime` (the Join Point)
* Solves kinematics for initial velocity and acceleration
* Stores results in `FProjectileInitState` struct (replicated)
{% endstep %}

{% step %}
#### Phase 2: Bridge (Manual Movement)

* `AProjectileBase::BeginPlay()` checks if `BridgeDuration > 0`
* Disables `UProjectileMovementComponent` tick
* `Actor::Tick()` manually updates position each frame using kinematic equation
* `SetStateFromTimeInBridge()` calculates and sets position
{% endstep %}

{% step %}
#### Phase 3: Transition

* When `TimeInBridge >= BridgeDuration`, transition occurs
* Position and velocity snap to final bridge state (= Join Point)
* `UProjectileMovementComponent` is re-enabled
* Component velocity set to final bridge velocity
{% endstep %}

{% step %}
#### Phase 4: True Path (Standard Movement)

* `UProjectileMovementComponent` takes over all movement
* Standard gravity, drag, and collision apply
* Projectile travels along the camera's intended arc
{% endstep %}
{% endstepper %}

***

## Utility Functions (`UProjectileFunctionLibrary`)

### `CalculateMergePoint()`

```cpp
static FVector CalculateMergePoint(
    const FVector& CameraLocation,
    const FVector& EndTrace,
    const FVector& MuzzleLocation,
    float ForwardBias
)
```

Finds a point on the aim line (from camera to end trace) that serves as the initial target for trajectory calculations.

Logic:

* Calculate direction from camera to end trace
* Project muzzle position onto this line
* Clamp to segment between camera and end trace
* Apply optional `ForwardBias` along aim direction

ForwardBias:

* `0.0` = Closest point on aim line to muzzle
* Positive values push the merge point further away
* Useful for ensuring the curve has enough room
* Configured per-weapon on the ability

#### `SuggestProjectileVelocity_CustomGravity()`

```cpp
static bool SuggestProjectileVelocity_CustomGravity(
    FVector& OutVelocity,
    const FVector& Start,
    const FVector& End,
    float Speed,
    float GravityZ
)
```

Ballistic targeting solver. Finds the velocity needed to hit a target with given speed and gravity.

Logic:

* Handles zero-gravity case directly
* Solves quadratic equation for launch angle
* Picks lowest-arc solution when multiple exist
* Returns `false` if target out of range (uses max-range 45° fallback)

#### `SuggestConvergingProjectileVelocity()`

```cpp
static bool SuggestConvergingProjectileVelocity(
    FVector& OutMuzzleVelocity,
    const FVector& CameraLocation,
    const FVector& MuzzleLocation,
    const FVector& TargetLocation,
    float ProjectileSpeed,
    float GravityZ,
    float ConvergenceTimeFraction
)
```

Advanced solver combining muzzle and camera trajectories.

Logic:

* Calculate camera's ballistic arc to target
* Find convergence point at `ConvergenceTimeFraction` of flight time
* Solve muzzle trajectory to reach convergence point in same time
* Returns velocity that makes both trajectories meet

#### `PredictBallisticPath()`

```cpp
static FVector PredictBallisticPath(
    const FVector& StartLocation,
    const FVector& Velocity,
    const FVector& Gravity,
    float Time
)
```

Helper function for position prediction:

```cpp
return StartLocation + Velocity * Time + 0.5f * Gravity * Time * Time;
```

***

### Application to Visual Effects (VFX)

This system's precision extends to visual effects. The associated Niagara tracer (e.g., `NS_WeaponFire_ProjectileTracer`) uses HLSL scripts that replicate the exact same kinematic formulas. The `FProjectileInitState` parameters are passed to the Niagara System, allowing the visual effect to independently calculate and render the exact same Bridge Path and subsequent True Path, ensuring the VFX tracer never deviates from the physical projectile.

#### Benefits

* **Perfect Aiming Correlation:** Guarantees that the projectile's trajectory perfectly matches the ballistic arc originating from the player's camera. "What you aim at is what you hit," regardless of compensation for bullet drop or target lead.
* **Eliminates Parallax Errors:** Solves the aiming parallax between the camera and muzzle, making gameplay consistent and removing frustrating misses when shooting around cover or compensating for projectile travel time.
* **Visually Seamless:** The transition from the Bridge Path to the True Path is mathematically seamless, creating a natural-looking projectile flight that visually originates from the weapon.

This system provides a sophisticated solution for projectile trajectory that enhances both gameplay feel and visual fidelity in networked shooter environments.

> [!INFO]
> The niagra projectile tracer VFX is used by the [Projectile Manager](../../projectile-manager/) not the Predictive Projectile System. The predictive projectile system uses actor components not VFX to simulate bullets.

***
