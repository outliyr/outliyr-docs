# Projectile System

While hitscan weapons deal damage instantly along a line, many shooters rely on projectiles – objects that travel through the world over time, affected by gravity and velocity. Implementing projectiles effectively in a networked environment presents unique challenges, primarily related to latency and visual consistency.

The ShooterBase Projectile System provides a robust solution designed to address these challenges, built around two key components (Not to be confused with the [Projectile Manager](../../projectile-manager/) designed for multiple, tiny, fast bullets):

1. **`AProjectileBase`:** An `AActor` class serving as the foundation for all simulated projectiles fired by weapons in ShooterBase. It incorporates logic for:
   * Standard projectile movement (`UProjectileMovementComponent`).
   * **Client-side prediction:** Spawning visual-only projectiles immediately on the firing client to hide latency.
   * **Network synchronization:** Reconciling client-predicted projectiles with server-authoritative ones.
   * **Merge Point Trajectory:** A sophisticated technique to visually blend the projectile's path from the weapon's muzzle location onto the player's true aiming line (camera view), ensuring intuitive aiming, especially at close ranges.
2. **`UProjectileFunctionLibrary`:** A collection of static Blueprint-callable utility functions specifically designed to aid in projectile calculations, most notably for determining the crucial "Merge Point" used in the trajectory blending system.

### Problems Addressed

This system is specifically designed to tackle common issues with networked projectiles:

* **Latency:** In a typical client-server model, there's a delay between the client firing and the server spawning the authoritative projectile. Without prediction, the player perceives a noticeable lag before seeing their projectile appear.
* **Visual Disconnect (Muzzle vs. Camera Aim):** Players aim using a camera centered on the screen, but projectiles often originate from the weapon's muzzle. At close ranges or when near obstacles, this difference can cause projectiles to visibly deviate from the player's crosshair or hit nearby cover unexpectedly.
* **Reliability:** Ensuring fast-moving projectiles replicate reliably and appear consistently for all clients can be tricky.

### Core Concepts

The ShooterBase Projectile System employs several key concepts:

* **Client Prediction:** The firing client immediately spawns a non-colliding, visual-only "fake" projectile (`AProjectileBase` with `bIsFakeProjectile = true`). This provides instant visual feedback.
* **Server Authority:** The server spawns the "real" projectile (`AProjectileBase` with `bIsFakeProjectile = false`) which handles actual collision and damage logic. This projectile is replicated to clients.
* **Synchronization:** When the replicated server projectile arrives on the client, the system matches it with the corresponding fake projectile (using a prediction key as an ID) and smoothly interpolates the fake one to the server one's position before destroying the fake and revealing the real one.
* **Merge Point Trajectory:** Instead of flying straight from the muzzle, the projectile initially follows a smooth curve (a Hermite spline) from the muzzle (`SpawnPoint`) to a calculated `MergePoint` located on the player's true aiming line (derived from camera view). After reaching the `MergePoint`, it proceeds straight towards the final impact point (`EndPoint`) using the standard `UProjectileMovementComponent`. This creates a visually intuitive path that aligns better with player expectation.
* **Initial Replication Boost:** Special logic (`SendInitialReplication`) attempts to force fast-moving projectiles to replicate sooner, reducing the chance of clients being hit by "invisible" projectiles that were destroyed on the server before they could be replicated.

By combining these techniques, the system aims to provide projectile behavior that feels responsive, looks visually correct, and functions reliably in a multiplayer setting.

The following pages will delve into the implementation details of `AProjectileBase` and the utility functions in `UProjectileFunctionLibrary`.

***
