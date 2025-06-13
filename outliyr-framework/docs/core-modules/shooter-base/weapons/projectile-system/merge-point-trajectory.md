# Merge Point Trajectory

A significant challenge in first/third-person shooters is reconciling the player's aiming perspective (typically from a camera) with the projectile's actual spawn location (often the weapon's muzzle). When aiming at nearby objects or peeking around cover, a projectile fired straight from the muzzle might hit the cover instantly, even though the player's crosshair is clear. Conversely, if the projectile instantly originated from the camera, it would feel disconnected from the weapon model.

The **Merge Point Trajectory** system in `AProjectileBase` provides an elegant solution to this visual and gameplay disconnect.

### The Problem: Camera vs. Muzzle

* **Player Aim:** Originates from the camera's position, directed towards the center of the screen (crosshair).
* **Projectile Origin:** Physically starts at the weapon's muzzle socket.
* **The Disconnect:** At close ranges, the paths diverge significantly. Firing straight from the muzzle feels inaccurate relative to the crosshair; firing straight from the camera looks physically wrong as the projectile doesn't originate from the gun.

### The Solution: A Smooth Curve to Merge

The Merge Point system guides the projectile along a smooth curve from its actual spawn point (muzzle) to intercept the player's true aiming line at a calculated "Merge Point." After reaching this point, the projectile continues straight towards the final impact point along the original aiming line.

**Key Points:**

* **`SpawnPoint` (`FVector`, Replicated):** The actual world location where the projectile spawns (muzzle socket position at the time of firing).
* **`EndPoint` (`FVector`, Replicated):** The final destination point determined by a trace from the player's camera along their aiming vector (usually clamped to the weapon's max range). This represents the "true" impact point if the projectile traveled perfectly along the camera's line of sight.
* **`MergePoint` (`FVector`, Replicated):** A calculated point that lies _on_ the line segment between the camera's origin and the `EndPoint`. This is the target location the projectile smoothly curves towards from the `SpawnPoint`. Its position is calculated (often using `UProjectileFunctionLibrary::CalculateMergePoint`) to be roughly perpendicular to the muzzle's offset from the camera line, potentially shifted forward slightly (`ForwardBias`).
* **The Curve:** A Hermite spline is used to generate a smooth, curved path between the `SpawnPoint` and the `MergePoint`. This avoids an abrupt direction change.
* **Post-Merge:** Once the projectile reaches (or passes) the `MergePoint`, it transitions to standard `UProjectileMovementComponent` physics, with its velocity set to travel directly towards the `EndPoint`.

### Implementation Details (`AProjectileBase`)

1. **Initialization (`InitializeMergePointCurve`)**:
   * Called during `BeginPlay` (or when spawning delayed projectiles) if the projectile needs to follow the curve (`!bHasMerged` initially).
   * Stores `SpawnPoint`, `MergePoint`, and `EndPoint`.
   * Calculates the start and end _tangents_ for the Hermite spline:
     * `HermiteTangentStart`: Based on the direction from `SpawnPoint` towards `MergePoint`.
     * `HermiteTangentEnd`: Based on the direction from `MergePoint` towards `EndPoint`.
     * The magnitude of these tangents (controlled by `Tension`, often related to the distance `SpawnPoint` -> `MergePoint`) influences the "bulge" or shape of the curve.
   * Calculates the approximate `CurveLength` (distance from `SpawnPoint` to `MergePoint`) and `CurveDuration` (time to traverse the curve based on `InitialSpeed`).
   * Resets `CurveElapsedTime` to 0.
   * Sets `bHasMerged = false`.
   * **Crucially, disables the `ProjectileMovementComponent`'s tick (`SetComponentTickEnabled(false)`)** because the actor's movement will be manually controlled along the curve during this phase.
2. **Curve Traversal (`Tick`)**:
   * If `bHasMerged` is `false`, the `Tick` function executes the curve logic:
   * Calculates the current interpolation factor `t = FMath::Clamp(CurveElapsedTime / CurveDuration, 0.0f, 1.0f)`.
   * Calls the static `HermiteSpline` function using the stored `SpawnPoint` (`P0`), `HermiteTangentStart` (`V0`), `MergePoint` (`P1`), `HermiteTangentEnd` (`V1`), and `t` to get the `NewLocation` on the curve.
   * Updates the actor's position using `SetActorLocation(NewLocation)`.
   * Increments `CurveElapsedTime += DeltaTime`.
3. **Merging (`Tick`, `HasPassedMergePoint`)**:
   * The `Tick` function checks if the merge condition is met: `t >= 1.0f` (reached the end of the calculated curve duration) or `HasPassedMergePoint()`.
   * `HasPassedMergePoint()`: Checks if the vector from the projectile's current location _to_ the `MergePoint` is pointing in the opposite direction to the vector from the `MergePoint` _to_ the `EndPoint`. This handles cases where the projectile might slightly overshoot the exact merge point due to discrete time steps.
   * If the merge condition is met:
     * Sets `bHasMerged = true`.
     * Optionally snaps the actor precisely to the `MergePoint` (`SetActorLocation(MergePoint)`).
     * **Re-enables the `ProjectileMovementComponent`'s tick (`SetComponentTickEnabled(true)`).**
     * Sets the `ProjectileMovementComponent->Velocity` to point directly from the `MergePoint` towards the `EndPoint` with the appropriate `InitialSpeed`.
4. **Post-Merge Movement**:
   * Once `bHasMerged` is `true`, the `Tick` function no longer executes the curve logic.
   * Movement is now entirely handled by the `ProjectileMovementComponent`, simulating physics towards the `EndPoint` (subject to gravity, collision, etc.).
5. **Replication**:
   * `SpawnPoint`, `MergePoint`, `EndPoint`, and `bHasMerged` are replicated properties. This is essential for simulated proxies (clients viewing other players' projectiles) to correctly reconstruct and predict the trajectory, including the curve phase, during their `CatchupTick`.

### Benefits

* **Intuitive Aiming:** Projectiles visually originate near the weapon but quickly align with the player's precise camera aim, making aiming feel accurate and responsive.
* **Reduced Close-Quarters Issues:** Mitigates the problem of projectiles hitting nearby cover that the player's crosshair was clear of.
* **Visual Appeal:** Creates a smoother, more natural-looking projectile path compared to instantly snapping from muzzle to camera line.

This system provides a sophisticated solution for projectile trajectory that enhances both gameplay feel and visual fidelity in networked shooter environments.

***
