# Debugging & Tools

Debugging complex systems like lag compensation can be challenging due to the involvement of historical data, multi-threading, and intricate collision checks. ShooterBase provides several tools, primarily controlled via console variables (CVars) managed through a dedicated settings class, to help visualize the system's behavior and diagnose issues.

### Debug Settings (`ULyraLagCompensationDebugSettings`)

This class, accessible in the Project Settings (usually under "Project" > "Plugins" > "Lyra Lag Compensation Debug" or similar), provides editor access to control the debug CVars. Modifying these settings in the editor changes the underlying CVar values, enabling or disabling various debug visualizations.

* **Header:** `LagCompensationManager.h` (or a dedicated DebugSettings header)
* **Parent:** `UDeveloperSettingsBackedByCVars`
* **Key Properties (linked to CVars):**
  * **`DisableLagCompensation` (`lyra.LagCompensation.DisableLagCompensation`):** (bool) If true, completely disables the lag compensation thread and historical tracking. `RewindLineTrace` calls will perform synchronous, non-rewound traces against the current world state. Useful for isolating issues or comparing behavior.
  * **`DrawRewindRequests` (`lyra.LagCompensation.DrawRewindRequests`):** (bool) _Purpose:_ When a rewind trace is requested, this potentially draws debug shapes representing the state of hitboxes _at the requested historical timestamp_. Useful for verifying that the interpolation logic is correctly reconstructing past states. _(Note: The exact visualization triggered by this might depend on specific debug drawing calls within the `ShouldRewind` or trace functions)._
  * **`DrawDebugHitBox` (`lyra.LagCompensation.DrawDebugHitBox`):** (bool) If true, instructs the lag compensation thread to continuously draw the _current_ collision hitboxes it's tracking for registered sources. This happens periodically based on `DrawHitBoxInterval`. Useful for verifying that the correct hitboxes are being captured from the physics assets/collision settings.
  * **`DrawDebugHitBoxCollision` (`lyra.LagCompensation.DrawDebugHitBoxCollision`):** (bool) When a rewind trace _results in a hit_ against a historical hitbox, this flag enables drawing:
    * The interpolated historical hitboxes of the _entire actor_ that was hit (typically drawn in Green).
    * A sphere representing the calculated entry point (`ImpactPoint`) of the trace (typically White).
    * A sphere representing the calculated exit point (`ExitPoint`) of the trace (typically Black).
    * These shapes persist for `DrawDebugHitBoxCollisionDuration` seconds. This is one of the most useful flags for visualizing _why_ a hit was registered against a past state.
  * **`DrawIndividualHitBoxCollision` (`lyra.LagCompensation.DrawIndividualHitBoxCollision`):** (bool) Similar to `DrawDebugHitBoxCollision`, but _only_ draws the specific historical hitbox primitive(s) that the trace actually intersected with (typically drawn in Blue), rather than the entire actor's hitbox set. Useful for more granular debugging of which body part was hit.
  * **`DrawDebugHitBoxCollisionRadius` (`lyra.LagCompensation.DrawDebugHitBoxCollisionRadius`):** (float, cm) Sets the size of the debug spheres drawn for entry/exit points when `DrawDebugHitBoxCollision` is enabled.
  * **`DrawDebugHitBoxCollisionDuration` (`lyra.LagCompensation.DrawDebugHitBoxCollisionDuration`):** (float, seconds) How long the collision visualization (historical hitboxes, entry/exit points) persists.
  * **`SimulatedLatency` (`lyra.LagCompensation.SimulatedLatency`):** (float, ms) When `DrawDebugHitBox` is enabled, this latency value is used to determine _which_ historical snapshot to draw, allowing you to visualize what the hitboxes looked like X milliseconds in the past according to the stored history, even without an active rewind request. Set to 0 to draw the latest captured state.
  * **`DrawHitBoxDuration` (`lyra.LagCompensation.DrawHitBoxDuration`):** (float, seconds) How long each individual debug shape persists when `DrawDebugHitBox` is active. Typically set low (e.g., slightly longer than `DrawHitBoxInterval`) for continuous drawing.
  * **`DrawHitBoxInterval` (`lyra.LagCompensation.DrawHitBoxInterval`):** (float, seconds) The time between redraws when `DrawDebugHitBox` is active. Controls the frequency of the continuous hitbox visualization.

### How Visualizations Work

* Debug drawing commands (`DrawDebugBox`, `DrawDebugSphere`, `DrawDebugCapsule`) are typically called from within the `FLagCompensationThreadRunnable`.
* Because drawing commands must execute on the Game Thread, the lag compensation thread batches the necessary drawing information (shape type, location, rotation, size, color, duration) into simple structs (`FDebugHitBoxData`).
* It then uses `AsyncTask(ENamedThreads::GameThread, ...)` to send this batch of drawing commands to the Game Thread for execution in the next available frame. This prevents the background thread from directly calling rendering functions.
* The logic for _when_ to draw is controlled by the CVars/DebugSettings (e.g., inside `DrawDebugLagCompensation`, `DrawDebugHitBoxCollision`, `DrawDebugHitBoxesFromData`).

### Using the Debug Tools

1. **Enable Desired Visualizations:** Go to Project Settings and enable the relevant boolean flags (`DrawDebugHitBox`, `DrawDebugHitBoxCollision`, etc.) in the Lyra Lag Compensation Debug section. Adjust durations and radii as needed.
2. **Run the Game (Server Context):** Since lag compensation is server-side, you need to run the game in a context where the server logic executes (Play In Editor with Dedicated Server unchecked, or a packaged server build).
3. **Observe:**
   * **`DrawDebugHitBox`:** Look for continuously drawn wireframe shapes (boxes, spheres, capsules) around actors with the `ULagCompensationSource`. Use `SimulatedLatency` to see historical positions. Verify the shapes match your physics assets/collision setup.
   * **`DrawDebugHitBoxCollision` / `DrawIndividualHitBoxCollision`:** Fire weapons that trigger server-side validation (like hitscan). When a hit is registered against a compensated actor, you should see the green (or blue for individual) historical hitboxes appear momentarily at the rewound position, along with white (entry) and black (exit) spheres indicating the impact points calculated by the system. This helps confirm _what_ was hit and _where_ in the past.
4. **Disable Lag Compensation:** Use `DisableLagCompensation` to compare behavior with and without the system active to isolate problems.

These debugging tools are invaluable for understanding how the lag compensation system is interpreting the world state and validating hits, helping to troubleshoot issues with hit registration or unexpected collisions.

***
