# Base Projectile Ability

This ability handles the firing logic for weapons that launch **projectile actors** (`AProjectileBase` or subclasses) into the world. Unlike hitscan, these projectiles have travel time and are simulated as distinct actors.

Crucially, this specific ability implements a **server-authoritative** approach **without client-side prediction** for the projectile _spawning_ itself. While the client still performs local traces to determine the initial trajectory and trigger cosmetic effects instantly, the actual projectile actor responsible for gameplay collision and effects is spawned only by the server.

### Purpose and Key Features

* **Actor Spawning:** Its primary function (on the server) is to spawn an instance of a projectile actor (like `AProjectileBase`) based on the firing parameters.
* **Travel Time:** Accounts for the fact that projectiles take time to reach their target.
* **Server Authority:** The server is solely responsible for spawning the gameplay-relevant projectile actor.
* **No Prediction (for Spawning):** This version does _not_ implement the fake client projectile spawning found in `UGameplayAbility_PredictiveProjectile`. Players will perceive latency equal to their ping before seeing the actual server-spawned projectile appear and interact with the world.
* **Suitable Use Cases:**
  * Situations where projectile prediction complexity is not desired or needed.
  * Weapons where precise visual synchronization isn't paramount (perhaps very slow projectiles or area-effect weapons where the exact spawn moment is less critical than the impact).
  * As a simpler base or alternative if the predictive system causes issues in specific scenarios.
  * Often used for AI-controlled characters where client-side prediction isn't applicable.

### Execution Flow Summary

1. **Client Activation:** Ability activates on the firing client.
2. **Local Trace & Cosmetics:** The client performs traces (`StartRangedWeaponTargeting` -> `TraceBulletsInCartridge`), applies spread, gathers `FHitResult`s (primarily to determine the initial trajectory/endpoint). It then triggers local cosmetic effects (`OnTargetDataReadyCallback`) like muzzle flash, sound, and potentially tracers aimed towards the calculated impact point. **It does NOT spawn a projectile actor.**
3. **Send Target Data:** The client sends the `TargetDataHandle` (containing the calculated trajectory endpoint and timestamp) and `PredictionKey` to the server.
4. **Server Receives Data:** The server's `OnTargetDataReadyCallback` is triggered.
5. **Server Spawns Projectile:** The server extracts the trajectory information from the `TargetDataHandle`. It **spawns the actual projectile actor** (`AProjectileBase` subclass) using this data. The spawned actor is replicated to clients.
6. **Server Applies Costs:** The server authoritatively commits ability costs (ammo).

The key difference from hitscan is the lack of server-side _validation_ of the hit result itself within the ability (as the projectile actor handles its own collision authoritatively) and the lack of _predictive spawning_ on the client compared to `UGameplayAbility_PredictiveProjectile`.

The specific implementation details are covered in the following sub-page:

* **Core Firing Flow:** Details how the client calculates trajectory and how the server uses that data to spawn the projectile.

***
