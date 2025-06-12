# Debugging Tools

## Debugging Tools

Similar to the [Lag Compensation system](../lag-compensation/), debugging the high-performance, multithreaded Projectile Manager can benefit greatly from visual aids. ShooterBase provides a dedicated settings class and utilizes console variables (CVars) to help visualize projectile paths and impacts.

### Debug Settings (`ULyraProjectileManagerDebugSettings`)

This class provides editor access (Project Settings > Plugins > "Lyra Projectile Manager Debug" or similar) to control the debug CVars specifically for projectiles managed by this system.

* **Header:** `ProjectileManager.h` (or a dedicated DebugSettings header)
* **Parent:** `UDeveloperSettingsBackedByCVars`
* **Key Properties (linked to CVars):**
  * **`DrawProjectileTraceDuration` (`lyra.TraceProjectile.DrawBulletTraceDuration`):** (float, seconds) If greater than 0, draws debug lines or shapes representing the path segment traced by a projectile during each simulation frame where collision checks occur. Persists for the specified duration. 0 disables.
  * **`DrawProjectileHitDuration` (`lyra.TraceProjectile.DrawBulletHitDuration`):** (float, seconds) If greater than 0, draws debug points or spheres at the location where the simulation thread detects an impact (`FPenetrationHitResult::ImpactPoint`). Persists for the specified duration. 0 disables.
  * **`DrawProjectileHitRadius` (`lyra.TraceProjectile.DrawBulletHitRadius`):** (float, cm) Sets the size of the debug shapes drawn at impact locations when `DrawProjectileHitDuration` is active.

### How Visualizations Work

* **Origin:** The debug drawing commands (`DrawDebugLine`, `DrawDebugCapsule`, `DrawDebugPoint`, `DrawDebugSphere`) related to the Projectile Manager are typically called from within the **`FProjectileThreadRunnable`**.
  * Trace paths are often drawn inside `HandleRewindLineTraceCompleted` to visualize the segment that was just checked for collision.
  * Impact points are drawn when `InformGameThreadOfCollision` prepares to notify the manager (or potentially within `HandleCollision`).
* **Game Thread Execution:** Just like with lag compensation debugging, because drawing must happen on the Game Thread, the projectile thread uses `AsyncTask(ENamedThreads::GameThread, ...)` to queue the actual `DrawDebugX` calls, passing the necessary location, size, color, and duration information.
* **Trace Visualization:**
  * If `DrawProjectileTraceDuration > 0`: When `HandleRewindLineTraceCompleted` runs after a lag compensation trace, it will likely draw the `TraceStart` to `TraceEnd` segment that was just evaluated.
  * If the projectile used a radius (`FTraceProjectile::ProjectileRadius > 0`), it might draw a `DrawDebugCapsule` instead of a line to represent the swept volume.
  * The color might be fixed (e.g., Purple in the provided code snippet) or could potentially change based on whether a hit occurred.
* **Hit Visualization:**
  * If `DrawProjectileHitDuration > 0`: When `HandleCollision` determines a hit, or when `InformGameThreadOfCollision` is called, a `DrawDebugSphere` or `DrawDebugPoint` will likely be queued at the `HitResult.ImpactPoint`, using `DrawProjectileHitRadius` for size and persisting for `DrawProjectileHitDuration`. The color might indicate whether it was a blocking hit or a penetration.

### Using the Debug Tools

1. **Enable Visualizations:** Go to Project Settings > Plugins and enable the desired flags (`DrawProjectileTraceDuration`, `DrawProjectileHitDuration`) in the Projectile Manager Debug section. Adjust duration/radius.
2. **Run the Game (Server Context):** The simulation runs on the server, so observe in PIE (Listen Server/Standalone) or a packaged server instance.
3. **Fire Managed Projectiles:** Use weapons that trigger the `FNewTraceProjectileMessage` system.
4. **Observe:**
   * **Traces:** Look for debug lines/capsules appearing along the projectile paths. This helps verify the trajectory, including effects of gravity calculated by `UpdateVelocity`. The visualization shows the segments checked _against historical data_ by the lag compensation system.
   * **Hits:** Look for debug points/spheres appearing where projectiles impact surfaces. This confirms where the simulation thread registered collisions. Compare this with the visual impact effects triggered by `AddImpactEffects` to ensure they align.

These tools are essential for:

* Verifying projectile trajectories and the effect of gravity.
* Confirming that collision detection is happening where expected.
* Debugging issues where projectiles might seem to pass through objects incorrectly (could be a collision channel setup issue, a lag compensation discrepancy, or a penetration rule issue).
* Visualizing the outcome of the lag-compensated traces performed by the manager.

***
