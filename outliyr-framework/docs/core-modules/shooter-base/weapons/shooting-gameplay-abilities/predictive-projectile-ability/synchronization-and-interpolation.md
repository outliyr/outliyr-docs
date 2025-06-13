# Synchronization & Interpolation

After the client has predictively spawned a "fake" visual projectile and the server has spawned the "real" authoritative one, the system needs to visually reconcile them on the client to maintain the illusion of responsiveness while ultimately deferring to the server's simulation. This is handled through matching, interpolation, and a final handoff.

### Replication and Tracking

* **Server:** The server spawns the real `AProjectileBase`, adds it along with its `ProjectileID` (derived from the client's prediction key) to the `ServerProjectiles` array (`FProjectileArray`), and marks the item dirty. This `FProjectileArray` is replicated to clients.
* **Client:** The client spawns the fake `AProjectileBase` (immediately or delayed), adds it along with the _same_ `ProjectileID` to its local `ClientProjectiles` array (`TArray<FProjectileInfo>`).

### Detecting the Server Projectile (`FProjectileArray::PostReplicatedAdd`)

The `FProjectileArray` struct uses the `FFastArraySerializer` system. When new items are added to this array on the server and replicated to the client, the `PostReplicatedAdd` function is automatically called on the client for each newly added item.

* **`FProjectileArray::PostReplicatedAdd` Logic:**
  1. Iterates through the indices of newly added items (`AddedIndices`).
  2. Retrieves the `FProjectileInfo` (containing the replicated `AProjectileBase*` pointer and `ProjectileID`) for the newly arrived server projectile.
  3. Calls the owning ability's `HandleReplicatedServerProjectile(ServerProjectileInfo)` function to initiate the synchronization process for that specific projectile.

### Handling Synchronization

Two main functions handle the matching and start the interpolation:

1. **`HandleReplicatedServerProjectile(const FProjectileInfo& ServerProjectileInfo)`**:
   * Called by `FProjectileArray::PostReplicatedAdd` when a _new server projectile_ replicates to the client.
   * Iterates through the client's _local_ `ClientProjectiles` array.
   * Tries to find a `ClientProjectileInfo` with the **same `ProjectileID`** as the incoming `ServerProjectileInfo`.
   * **If a Match is Found:**
     * Retrieves the pointers to the fake `ClientProjectile` and the real `ServerProjectile`.
     * **Handles Server Destruction:** Checks if the `ServerProjectile` pointer is null or pending kill (meaning it was destroyed on the server very quickly, perhaps hitting something near the spawn). If so, it destroys the corresponding `ClientProjectile` and removes it from the `ClientProjectiles` array, then exits.
     * **Initiates Interpolation:** If both projectiles are valid, it hides the newly arrived `ServerProjectile` (`ServerProjectile->SetActorHiddenInGame(true)`), disables collision on it (redundant but safe), and calls `InterpolateProjectile(ClientProjectile, ServerProjectile, ServerProjectileInfo.ProjectileID)` to start the visual handoff.
   * **If No Match Found:** (Should be rare if prediction keys work correctly) No action is taken immediately; the server projectile will just exist and move based on its replicated state.
2. **`SynchronizeDelayedProjectile(const FProjectileInfo& ClientProjectileInfo)`**:
   * Called by `SpawnProjectileDelayed` _after_ the delayed fake client projectile has been spawned.
   * Its purpose is to handle the case where the _server_ projectile might have _already replicated_ to the client while the client was waiting to spawn its delayed fake one.
   * It performs a similar loop as `HandleReplicatedServerProjectile`, iterating through the _replicated_ `ServerProjectiles` array, looking for a match based on `ProjectileID`.
   * If it finds a matching, valid server projectile, it initiates the interpolation by calling `InterpolateProjectile`.

### Interpolation Logic (`InterpolateProjectile`)

This function performs the visual smoothing to transition from the fake client projectile to the authoritative server projectile:

1. **Setup:**
   * Takes the `ClientProjectile`, `ServerProjectile`, and `ProjectileID` as input.
   * Ensures the client projectile's interpolation component is off (`bInterpMovement = false`), as we're manually controlling its position.
   * Gets or creates a `FTimerHandle` associated with the `ProjectileID` from the `InterpolationTimers` map. This prevents multiple interpolation attempts for the same projectile.
   * Stores the client projectile's current location (`StartLocation`).
   * Defines an `InterpolationDuration` (e.g., `0.25f` seconds) - how long the blend takes.
   * Initializes `ElapsedTime` to 0.
2. **Timer Callback (Lambda Function):** Sets up a repeating timer (e.g., every `0.01f` seconds) that executes the following:
   * **Validity Check:** **Crucially**, at the _start_ of each timer tick, it checks if both `ClientProjectile` and `ServerProjectile` are still valid (not null, not pending kill). If the `ServerProjectile` has become invalid (e.g., destroyed on server), it destroys the `ClientProjectile`, clears the timer, removes the client projectile from tracking, and exits the callback. This prevents errors if the real projectile hits something during interpolation.
   * **Update Time:** Increments `ElapsedTime`.
   * **Interpolate Position:** Calculates the interpolation alpha `T = FMath::Clamp(ElapsedTime / InterpolationDuration, 0.0f, 1.0f)`. Uses `FMath::VInterpTo` (or potentially `Lerp`) to smoothly move the `ClientProjectile`'s location towards the `ServerProjectile`'s _current replicated_ location. `VInterpTo` is often preferred here as it provides smoother damping towards the target compared to a simple `Lerp` over time.
   * `ClientProjectile->SetActorLocation(NewLocation)`.
   * **Check for Handoff:** Calculates the distance between the `ClientProjectile` and `ServerProjectile`. If the distance is below a small threshold (e.g., `< 5.0f` units):
     * The interpolation is considered complete.
     * Hide and destroy the `ClientProjectile`.
     * Unhide the `ServerProjectile` (`ServerProjectile->SetActorHiddenInGame(false)`).
     * Clear the interpolation timer using the stored handle and `ProjectileID`.
     * Remove the `ClientProjectile` info from the `ClientProjectiles` tracking array.
     * **Notify Server:** Calls `ServerNotifyProjectileReplicated(ProjectileID)`. This RPC tells the server that the client has successfully synchronized and displayed the authoritative projectile. The server uses this notification to clean up its entry in the `ServerProjectiles` array (see below), saving network bandwidth as the projectile no longer needs its state tracked in that specific replicated list.

### Server Cleanup (`ServerNotifyProjectileReplicated_Implementation`)

* Called on the server when the client RPC arrives.
* Finds the `FProjectileInfo` entry in the server's `ServerProjectiles` array matching the `ProjectileID`.
* Removes that entry from the array.
* Marks the `ServerProjectiles` array dirty (`MarkArrayDirty()`) so the removal replicates back to clients (preventing potential lingering entries).

### Summary of Synchronization

* Server projectile replicates, client detects it (`PostReplicatedAdd`).
* Client finds its matching fake projectile via `ProjectileID`.
* Client hides server projectile, starts timer (`InterpolateProjectile`).
* Timer callback smoothly moves fake client projectile towards the server projectile's replicated position, constantly checking validity.
* When close enough, client destroys fake, unhides server, stops timer.
* Client notifies server via RPC (`ServerNotifyProjectileReplicated`).
* Server removes projectile from its replicated tracking list (`ServerProjectiles`).

This comprehensive synchronization and interpolation process provides the seamless visual experience that makes client-side prediction for projectiles effective.

***
