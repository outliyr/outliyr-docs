# Core Firing Flow

This ability orchestrates the process of firing a server-authoritative projectile. The client determines the initial trajectory, while the server handles the actual spawning of the projectile actor.

### Client-Side Actions (`StartRangedWeaponTargeting`, `TraceBulletsInCartridge`, `OnTargetDataReadyCallback`)

1. **Initiation (`StartRangedWeaponTargeting`)**:
   * Similar to the hitscan ability, this function is called upon activation on the client.
   * It sets up the prediction window and calls `PerformLocalTargeting`.
   * `PerformLocalTargeting` determines the initial aiming transform (`WeaponTowardsFocus` is common) and calls `TraceBulletsInCartridge`.
2. **Trajectory Calculation (`TraceBulletsInCartridge`)**:
   * This function's primary goal here is _not_ necessarily to find the first blocking hit, but rather to determine the **intended final endpoint** of the projectile's path, incorporating spread.
   * It iterates per `BulletsPerCartridge`.
   * Calculates spread using `VRandConeNormalDistribution`.
   * Calculates the randomized `BulletDir`.
   * Calculates the `EndTrace` vector based on the start, randomized direction, and max weapon range.
   * **Crucially:** It performs a trace (`DoSingleBulletTrace`) mainly to find the impact point, even if it's just the end of the trace line in empty space. While it _can_ detect hits along the way, the key output needed for projectile spawning is the final intended destination (`Impact.Location` or `Impact.ImpactPoint`, which might be the `EndTrace` if nothing was hit).
   * It adds _one_ `FHitResult` per bullet to the `OutHits` array. This hit result primarily serves to communicate the calculated start (`TraceStart`) and intended end (`Location`/`ImpactPoint`) of the trajectory for that bullet to the server.
3. **Data Packaging (`StartRangedWeaponTargeting` continues)**:
   * Packages the `FHitResult`(s) from `TraceBulletsInCartridge` into the `FGameplayAbilityTargetDataHandle TargetData`. Each `FLyraGameplayAbilityTargetData_SingleTargetHit` effectively contains the calculated launch vector information (start and end points) for one projectile to be spawned.
   * Includes the client `Timestamp`.
   * Calls `OnTargetDataReadyCallback(TargetData, FGameplayTag())`.
4. **Local Processing & Server Call (`OnTargetDataReadyCallback` - Client)**:
   * Sends the `TargetDataHandle` and `PredictionKey` to the server via `CallServerSetReplicatedTargetData`.
   * Attempts to commit ability cost locally (`CommitAbility`).
   * If commit succeeds:
     * Applies local spread increase (`WeaponData->AddSpread()`).
     * Triggers the `OnRangedWeaponTargetDataReady` Blueprint event. This is used for **client-side cosmetics only**:
       * Muzzle flash, firing sound.
       * Spawning a **tracer effect** (visual only, non-colliding particle system) that travels from the muzzle towards the `ImpactPoint` recorded in the `TargetDataHandle`. This gives the player immediate visual feedback on their shot's direction.
   * **Important:** The client _does not_ spawn an `AProjectileBase` actor here.

### Server-Side Actions (`OnTargetDataReadyCallback` - Server)

1. **Receive Data:** The server's `OnTargetDataReadyCallback` is triggered when the RPC arrives from the client.
2. **Commit Authoritative Cost:** The server attempts `CommitAbility` to deduct ammo, etc.
3. **Process Target Data & Spawn Projectile:** If the commit succeeds:
   * The server iterates through the `FLyraGameplayAbilityTargetData_SingleTargetHit` entries in the received `TargetDataHandle`.
   * For each entry:
     * It extracts the `TraceStart` and final `Location`/`ImpactPoint` (the calculated endpoint).
     * It determines the initial velocity direction (`EndPoint - StartPoint`).
     * It **spawns the actual projectile actor** (the specific `AProjectileBase` subclass defined for this weapon/ability). This spawning logic typically resides within the server's `OnRangedWeaponTargetDataReady` Blueprint event or a C++ function called from it. The spawn transform uses the `TraceStart` (or muzzle location) and the calculated initial velocity direction. The projectile's `InitialSpeed` is retrieved from the weapon instance.
     * The newly spawned `AProjectileBase` actor is server-authoritative and will replicate to clients.
   * Applies server-side spread (`WeaponData->AddSpread()`).
   * May trigger other server-side logic in `OnRangedWeaponTargetDataReady`.

### Outcome

The firing client gets immediate cosmetic feedback (muzzle flash, sound, tracer) aligned with their calculated shot trajectory (including spread). After a delay corresponding to network latency, the actual, server-spawned projectile actor appears on the client (and other clients) via replication and performs its simulation, collision, and effect logic authoritatively. There is no attempt to synchronize a client-spawned projectile with the server one in this ability.

***
