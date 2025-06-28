# Limitations & Considerations

While the ShooterBase Lag Compensation system is a powerful tool for achieving accurate hit validation in networked environments, it's important to understand its design limitations and considerations when implementing and debugging your game.

1. **Complexity & Modification Risk:**
   * As stated previously, this system involves multi-threading, historical state management, and complex collision math. Modifying the core internals (`FLagCompensationThreadRunnable`, `ULagCompensationManager`) carries a significant risk of introducing subtle bugs, performance issues, or crashes if not done with extreme care and expertise. **Stick to using the provided interfaces (Source component, Manager functions, Async Action) whenever possible.**
2. **Selective Tracking Only:**
   * The system _only_ tracks and rewinds actors with the `ULagCompensationSource` component. It does not track the entire world state.
   * **Implication:** Collisions requested via `RewindLineTrace` against static world geometry or dynamic actors _without_ the source component will be tested against their **current** position, not their historical position. This is usually acceptable for static geometry but might lead to slight inaccuracies if players are interacting closely with non-tracked dynamic objects. Add the `ULagCompensationSource` to any dynamic actor where historical collision accuracy is critical.
3. **State Rewound = Hitboxes Only:**
   * The system rewinds the **position, rotation, and shape** of collision primitives (hitboxes).
   * It does **not** rewind:
     * Animation state (actors will be traced against their historical hitbox positions, but their current visual animation might not match that pose).
     * Gameplay logic state (e.g., variables, applied Gameplay Effects, health). The validation trace only determines _if_ a geometric collision occurred in the past. Subsequent gameplay logic (like applying damage) uses the actor's _current_ state.
     * Visual effects or sounds.
4. **Performance Considerations:**
   * **Memory:** Storing historical data for many actors over the `MaxLatencyInMilliseconds` duration consumes memory. Very long history times or extremely high numbers of tracked actors could become memory intensive.
   * **CPU (Thread):** While offloaded, the background thread still consumes CPU resources. Complex physics assets (many hitboxes per actor) increase the amount of data captured and processed per tick. A high volume of rewind requests (e.g., very high fire rates from many players simultaneously) increases the tracing workload on the thread. Monitor performance under load.
   * **CPU (Game Thread):** Extracting hitbox data (`StoreStaticMeshHitBoxInfo`, `StoreSkeletalMeshHitBoxInfo`) still involves some work on the game thread before the data is processed by the background thread. Ensure physics assets are reasonably optimized.
5. **Simplified Penetration Logic (During Rewind Trace):**
   * When the lag compensation thread performs a rewind trace and calculates penetration (determining the `ExitPoint`, `ExitNormal`, `PenetrationDepth` within `FPenetrationHitResult`), it assumes a **straight-line path** through the hit object.
   * It does **not** simulate complex penetration physics like:
     * **Ricochets:** The trace path does not bounce off surfaces at glancing angles within the rewind calculation.
     * **Exit Angle Deviation:** The trace exits the object along the same vector it entered. It doesn't simulate random exit angle changes based on material properties (like the `MaxExitSpreadAngle` defined in `FProjectileMaterialPenetrationInfo`, which is intended more for projectile _simulation_ rather than hitscan _validation_).
     * **Velocity/Energy Loss:** The rewind trace only determines geometric intersection. It doesn't calculate energy loss or check if the "bullet" would have had enough remaining force to exit the material based on thickness (it relies only on the `MaxPenetrationAngle` check using data defined elsewhere, like in the calling Ability).
   * **Reasoning:** Simulating these complex physics accurately within the historical rewind context for every trace would be extremely computationally expensive and significantly increase the complexity of the thread logic and historical data required. The current system prioritizes efficient geometric validation of whether a _path_ existed through historically positioned hitboxes. The _consequences_ of penetration (like reduced damage) are handled by the Gameplay Ability after the validated hit sequence is returned.
6. **Supported Shapes:** The internal trace logic (`CalculateTraceIntersections`) and history storage (`ConvertCollisionToShape`) are currently implemented for **Box, Sphere, and Capsule (Sphyl)** collision primitives derived from `FKShapeElem`. Complex convex hulls or triangle mesh collision shapes from physics assets might not be accurately represented or traced against in the historical state. Use standard primitive shapes for actors requiring lag compensation.
7. **Timestamp Accuracy:** The system relies on the `Timestamp` provided (usually by the client) being reasonably accurate. Significant clock drift or manipulation could affect validation accuracy, although GAS and the engine have some mechanisms to mitigate clock issues.

> [!danger]
> Advanced methods—such as full snapshot interpolation—can potentially offer more precise hit detection (especially in high-latency or competitive scenarios), these techniques require significant modifications to Unreal’s networking architecture and can incur higher bandwidth and complexity costs. This implementation represents a practical, well-tested solution that balances accuracy with the design limitations and performance considerations inherent to Unreal Engine. Users seeking state-of-the-art precision may need to explore custom replication systems or experimental solutions beyond the scope of this plugin.

Being aware of these points helps in effectively utilizing the lag compensation system and understanding the boundaries of its simulation when interpreting results or planning extensions.

***
