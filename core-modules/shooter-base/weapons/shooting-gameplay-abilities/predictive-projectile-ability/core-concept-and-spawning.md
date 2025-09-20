# Core Concept & Spawning

The core of the predictive system lies in how and when projectiles are spawned on the client and server, aiming to provide immediate feedback while maintaining server authority. This ability overrides the standard projectile spawning flow significantly.

### Triggering the Spawn (`OnTargetDataReadyCallback`)

Unlike the non-predictive projectile ability where the server solely handles spawning in `OnTargetDataReadyCallback`, the predictive ability uses this callback on _both_ client and server primarily to initiate the `SpawnProjectile` function call.

1. **Client (`OnTargetDataReadyCallback`)**:
   * Receives the locally calculated `TargetDataHandle` from `StartRangedWeaponTargeting`.
   * Sends the `TargetDataHandle` and `PredictionKey` to the server via `CallServerSetReplicatedTargetData`.
   * Attempts to commit cost locally (`CommitAbility`).
   * If commit succeeds:
     * Applies local spread (`WeaponData->AddSpread()`).
     * Calls the **`SpawnProjectile`** function locally to create the _fake_ client projectile.
     * Triggers cosmetic Blueprint events (muzzle flash, sound - **note:** tracers are often handled by the projectile actor itself now).
2. **Server (`OnTargetDataReadyCallback`)**:
   * Receives the `TargetDataHandle` from the client.
   * Attempts to commit cost authoritatively (`CommitAbility`).
   * If commit succeeds:
     * Applies server-side spread (`WeaponData->AddSpread()`).
     * Calls the **`SpawnProjectile`** function on the server to create the _real_, authoritative projectile.
     * Triggers server-side Blueprint events/logic (`OnRangedWeaponTargetDataReady`), but this usually _doesn't_ involve spawning the projectile again (that's handled by `SpawnProjectile`).

### The `SpawnProjectile` Function

This is the central function responsible for creating `AProjectileBase` instances, handling both fake client and real server versions, and incorporating the merge point logic.

* **Signature:** `AProjectileBase* SpawnProjectile(TSubclassOf<AProjectileBase> ProjectileClass, const FVector& MuzzleLocation, const FVector& CameraLocation, const FVector& EndTrace, float InitialSpeed)`
  * Note: This function takes raw location/trace data, usually extracted from the `TargetDataHandle` within `OnTargetDataReadyCallback` before being called.
* **Core Logic:**
  1. **Get Role & Prediction Time:** Determines if running on client/server and calculates the `CatchupTime` based on ping (`CalculatePredictionTime`).
  2. **Calculate Projectile ID:** Gets a unique ID for this projectile instance, critically using the current `PredictionKey`: `int32 ProjectileID = GetPredictionKeyAsProjectileID();`. This ID links the fake client projectile and the real server projectile.
  3. **Calculate Merge Point Data:**
     * Calls `UProjectileFunctionLibrary::CalculateMergePoint(CameraLocation, EndTrace, MuzzleLocation, ForwardBias)` to get the `MergePoint`.
     * Calculates the initial direction vector from `MuzzleLocation` towards `MergePoint`.
  4. **Check for Delayed Spawn (Client Only):**
     * If running on the client (`!HasAuthority()`) and the ping exceeds the `MaxLatency` threshold (`CalculatePredictionSleepTime() > 0.f`), it **does not spawn immediately**.
     * Instead, it packages the necessary info (`ProjectileClass`, spawn `Transform`, `InitialSpeed`, `ProjectileID`, `MergePoint`, `EndPoint`) into an `FDelayedProjectileInfo` struct and adds it to the `DelayedProjectiles` array.
     * It starts a timer (`FTimerHandle`) set to fire after `SleepTime`, which will call `SpawnProjectileDelayed(ProjectileID)`.
     * Returns `nullptr` in this case.
  5. **Common Spawn Logic (Internal Lambda `SpawnAndSetupProjectile`)**: Encapsulates the common steps for creating and initializing the projectile:
     * Calculates the spawn `FTransform` (using `MuzzleLocation` and the initial direction towards `MergePoint`).
     * Spawns the actor deferred: `GetWorld()->SpawnActorDeferred<AProjectileBase>(...)`.
     * Sets `InitialSpeed`.
     * Sets fake status: `Projectile->SetIsFakeProjectile(bIsFake)`.
     * Sets merge point data: `Projectile->MergePoint`, `Projectile->EndPoint`, `Projectile->SpawnPoint`.
     * Initializes the curve: `Projectile->InitializeMergePointCurve()`.
     * Finishes spawning: `Projectile->FinishSpawning(Transform)`.
  6. **Client-Side Spawn (If Not Delayed):**
     * Calls `SpawnAndSetupProjectile` with `bIsFake = true`.
     * Disables collision: `ClientProjectile->SetActorEnableCollision(false)`.
     * Adds the new projectile and its `ProjectileID` to the local `ClientProjectiles` tracking array: `ClientProjectiles.Add(FProjectileInfo(ClientProjectile, ProjectileID))`.
     * Returns the `ClientProjectile`.
  7. **Server-Side Spawn:**
     * Calls `SpawnAndSetupProjectile` with `bIsFake = false`.
     * Adds the new projectile and its `ProjectileID` to the replicated `ServerProjectiles` array: `ServerProjectiles.Items.Add(FProjectileInfo(ServerProjectile, ProjectileID))`.
     * If the server needs to simulate latency (`CatchupTime > 0.f`, e.g., for listen server host parity or testing), it calls `ServerProjectile->CatchupTick(CatchupTime)` and updates related properties (`InitialSpeed`, `MaxLatency`).
     * Marks the new entry in the `ServerProjectiles` fast array as dirty to ensure replication: `ServerProjectiles.MarkItemDirty(ServerProjectiles.Items.Last())`.
     * Returns the `ServerProjectile`.

### Delayed Spawning (`SpawnProjectileDelayed`)

* Called by the timer set in `SpawnProjectile` when client latency is high.
* Finds the corresponding `FDelayedProjectileInfo` in the `DelayedProjectiles` array using the `DelayedProjectileID`.
* Spawns the _fake_ client projectile using the stored information (transform, speed, merge point data).
* Disables collision.
* Adds the newly spawned projectile to the `ClientProjectiles` tracking array.
* **Crucially:** Immediately calls `SynchronizeDelayedProjectile()` to attempt matching it with a server projectile that might have _already_ replicated while the client was waiting.
* Removes the info from `DelayedProjectiles`.

### Helper Functions

* **`CalculatePredictionTime()` / `CalculatePredictionSleepTime()`:** Calculate necessary time adjustments based on player ping and the `MaxLatency` threshold.
* **`GetPredictionKeyAsProjectileID()`:** Retrieves the integer representation of the current `FGameplayAbilityActivationInfo::GetActivationPredictionKey().Current`. This provides the vital link between the client's predictive action and the server's authoritative response.

This intricate spawning logic ensures that the client sees a projectile immediately (or after a calculated delay) while the server maintains control over the authoritative simulation, setting the stage for the synchronization process.

***
