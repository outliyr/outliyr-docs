# Replication & Prediction

Networking projectiles effectively requires careful handling of replication and prediction to ensure they appear correctly and consistently for all players while minimizing the perceived effects of latency. `AProjectileBase` incorporates several mechanisms to achieve this.

### Replication Setup

By default, `AProjectileBase` is configured for network play:

* **`bReplicates = true`**: The actor itself will replicate from the server to clients.
* **`SetReplicatingMovement(false)`**: Crucially, standard UE Actor movement replication is often _disabled_. This is because `AProjectileBase` relies on more specialized logic:
  * **Client-Side Prediction:** The firing client simulates its own "fake" projectile.
  * **Server Authority:** The server simulates the authoritative projectile.
  * **Synchronization:** Custom logic (within `UGameplayAbility_PredictiveProjectile`) handles reconciling the fake and real projectiles, rather than relying on generic replicated movement which wouldn't account for the fake projectile or the precise timing needed.
  * **Catchup Ticks:** Simulated proxies use `CatchupTick` to manually advance their state based on received data, rather than interpolating based on replicated movement.
* **`NetPriority` / `SetMinNetUpdateFrequency`**: These are set relatively high (`2.0f` and `100.0f` respectively) to encourage the network system to send updates for projectiles more frequently, which is important for fast-moving objects.

### Initial Replication Boost (Reliability for Fast Projectiles)

A common problem with very fast projectiles or those with immediate effects (like explosions) is that they might be spawned, hit something, and be destroyed on the server _before_ the regular replication system gets a chance to send the "spawn" information to clients. This can lead to clients being affected by seemingly invisible projectiles.

To mitigate this, `AProjectileBase` includes an **Initial Replication** system:

* **`InitialReplicationTick` (`FActorTickFunction`)**: A special, high-priority tick function that runs _once_ very early in the actor's lifecycle on the server (`BeginPlay` registers it).
* **`SendInitialReplication()`**: Called by `InitialReplicationTick`. This function manually checks if the projectile meets certain criteria (currently, `Velocity.Size() >= 7500.0f` or radial effects - _implementation might vary_).
* **Forced Replication Packet**: If criteria are met, it iterates through connected clients. For relevant clients, it forces the `UActorChannel` associated with this projectile to replicate immediately, even creating the channel if necessary (`Ch->ReplicateActor()`). This significantly increases the chance that the client receives the spawn information before the projectile is potentially destroyed.
* **`bForceNextRepMovement`**: Set to `true` after the initial forced replication. This flag ensures that even though standard movement replication is off, the _next_ replication update for this actor _will_ include its location/rotation, ensuring the client gets the post-physics position shortly after the initial pre-physics spawn position.

This system prioritizes getting _some_ information about the projectile to the client as early as possible for fast-moving or impactful projectiles.

### Client Catchup (Simulated Proxies)

When a client receives replicated data for a server-authoritative projectile (i.e., it's acting as a `ROLE_SimulatedProxy`), the received position (`ReplicatedMovement.Location`) represents where the projectile _was_ on the server when the packet was sent. Due to latency, the projectile on the server has continued to move since then.

To compensate, `AProjectileBase` performs a "Catchup Tick":

* **`PostNetReceiveLocationAndRotation()`**: This standard UE function is called on a simulated proxy when it receives updated transform data.
* **`CalculatePredictionTime()`**: Calculates how much time the client needs to simulate forward to "catch up" to the server's current state. It uses the owning player's ping (`PlayerState->GetPingInMilliseconds()`, halved as an approximation) and clamps it by `MaxLatency` (a configurable property, often set in the spawning ability).
* **`CatchupTick(float DeltaTime)`**: This function simulates the projectile's movement forward by the calculated `CatchupTickDelta`.
  * If the projectile is still on its **Merge Point curve** (`!bHasMerged`), it advances `CurveElapsedTime` and recalculates the position along the Hermite spline. If the catchup time pushes it past the merge point, it snaps to the merge point and potentially applies remaining time to the `ProjectileMovementComponent`.
  * If the projectile has **already merged** (`bHasMerged`), it simply calls `ProjectileMovement->TickComponent()` with the `CatchupTickDelta` to simulate standard physics movement forward.

This catchup logic ensures that projectiles viewed on client machines appear closer to their actual current position on the server, reducing visual discrepancies caused by latency.

### Velocity and State Handling

* **`InitialSpeed` (`float`, Replicated)**: The initial speed is set during spawning and replicated (`COND_SkipOwner` or `COND_None`) so clients can correctly initialize the projectile's velocity magnitude.
* **`PostNetReceiveVelocity()`**: Called on simulated proxies when velocity updates are received. It directly sets the `ProjectileMovementComponent->Velocity`. While full movement isn't replicated continuously, velocity updates might still occur.
* **Merge Point State (`SpawnPoint`, `MergePoint`, `EndPoint`, `bHasMerged` - Replicated)**: These crucial properties defining the projectile's trajectory path are replicated so that simulated proxies can accurately calculate the Merge Point curve and perform catchup ticks correctly along that path.

### Relevancy

* **`IsNetRelevantFor()`**: Determines if this projectile should be replicated to a specific client. The base implementation currently calls `Super::IsNetRelevantFor`, using standard Unreal Engine relevancy logic.
* **Potential Optimization (`LyraConsoleVariables::DrawSimulatedProjectileOnOwner`)**: The commented-out line `// return !IsOwnedBy(ViewTarget) || LyraConsoleVariables::DrawSimulatedProjectileOnOwner;` suggests a potential optimization where the server _doesn't_ replicate the authoritative projectile to the owning client if that client is already predicting its own fake projectile (unless a debug CVar is enabled). This saves bandwidth but relies on the prediction/synchronization system (`UGameplayAbility_PredictiveProjectile`) working correctly.

By combining these replication strategies, initial replication boosts, and client catchup mechanics, `AProjectileBase` aims to deliver a networked projectile experience that is both reliable and visually consistent across different player connections.

***

**Next Steps:**

* Proceed to the **"`AProjectileBase`: Merge Point Trajectory"** page for a deep dive into the curve-based aiming correction system.
