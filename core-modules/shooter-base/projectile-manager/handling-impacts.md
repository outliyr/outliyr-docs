# Handling Impacts

After the Projectile Manager's background thread (`FProjectileThreadRunnable`) simulates a projectile and detects a collision using its lag-compensated trace logic, it needs to communicate this impact back to the main game thread so that actual gameplay consequences (damage, visual effects, sound) can occur.

### Impact Notification Flow

1. **Collision Detected (Thread):** The `FProjectileThreadRunnable::HandleCollision` function determines that a projectile has hit a surface (either stopping or penetrating).
2. **Package Data (Thread):** It gathers the relevant data:
   * A copy of the projectile's state (`FTraceProjectile`) at the time of impact (or just before penetration).
   * The detailed hit information (`FPenetrationHitResult`) calculated by the lag compensation trace.
3. **Create Shared Pointers (Thread):** To safely pass this data across threads, it creates `TSharedPtr` wrappers around copies of the `FTraceProjectile` and `FPenetrationHitResult` data.
4. **Queue Game Thread Task (Thread):** It calls `InformGameThreadOfCollision`, which uses `AsyncTask(ENamedThreads::GameThread, ...)` to queue a task for the main game thread. This task's payload includes the shared pointers to the projectile and hit result data.
5. **Execute Delegate (Game Thread):** The scheduled task executes on the game thread. It calls the `OnProjectileImpact` delegate, which is bound to the `UProjectileManager::HandleProjectileImpact` function during the thread's creation.

### Handling Logic (`UProjectileManager::HandleProjectileImpact`)

This function is the C++ entry point on the `UProjectileManager` component where impact logic is executed on the **main game thread**.

* **Signature:** `void HandleProjectileImpact(TSharedPtr<FTraceProjectile> ProjectilePtr, TSharedPtr<FPenetrationHitResult> HitResultPtr)`
* **Purpose:** To orchestrate the application of damage, visual/audio effects, and other gameplay logic resulting from a projectile impact detected by the simulation thread.
*   **Logic:**

    1. **Validate Data:** Checks if the received `ProjectilePtr` and `HitResultPtr` are valid.
    2. **Dereference Data:** Gets the actual `FTraceProjectile Projectile` and `FHitResult HitResult` data from the shared pointers.
    3.  **Trigger Blueprint Effects (`AddImpactEffects`):**

        * Calls the `BlueprintImplementableEvent` named `AddImpactEffects`, passing the `Projectile` and `HitResult`.
        * **Purpose:** This is the primary way for designers and scripters to add cosmetic impact effects without modifying C++. In your `UProjectileManager` Blueprint subclass, you override this event.
        * **Implementation:** Inside the `AddImpactEffects` event graph, you can:
          * Use the `HitResult` (remembering to potentially call `GetMappedHitResult()` if `bNeedsMapping` is true and you need current world coordinates) to get the location, normal, physical material, hit actor/component.
          * Use the `Projectile.ImpactCueNotify` tag to trigger specific Gameplay Cues (via `Execute Gameplay Cue On Actor`) for different impact types (e.g., `Impact.Bullet.Flesh`, `Impact.Bullet.Metal`, `Impact.Bullet.Concrete`). Gameplay Cues handle spawning particle effects, decals, and playing sounds.
          * Spawn decals directly using `Spawn Decal at Location`.

        <img src=".gitbook/assets/image (2) (1).png" alt="" title="">
    4. **Apply Gameplay Effects (Damage):**
       * Checks if the `HitResult.GetActor()` is valid and has an `UAbilitySystemComponent`.
       * Constructs an `FGameplayEffectContextHandle`, setting the `Instigator` (PlayerState or Controller) and `Causer` (Weapon Actor) from the `Projectile` data. Adds the `HitResult` to the context.
       * **Calculates Damage Reduction:** Iterates through the `Projectile.NumPenetrationsSoFar` array (which tracks the physical materials of surfaces the projectile has already passed through). For each material, it looks up the `DamageChangePercentage` in the `Projectile.MaterialPenetrationMap` and multiplies a `DamageReduction` factor accordingly. This cumulatively reduces damage for subsequent hits after penetration.
       * Creates an `FGameplayEffectSpecHandle` using the `Projectile.HitEffect` (the `TSubclassOf<UGameplayEffect>` passed in the spawn message) and the calculated `DamageReduction` factor (applied as the effect level or via a SetByCaller magnitude).
       * Applies the effect spec to the hit actor's Ability System Component (`AbilitySystemComponent->ApplyGameplayEffectSpecToSelf(*EffectSpecHandle.Data.Get())`). This is typically scheduled for the next tick (`SetTimerForNextTick`) to avoid potential issues within the delegate callback.
    5. **Trigger Hit Markers:**
       * Gets the `InstigatorController` from the `Projectile` data.
       * Finds the `UWeaponStateComponent` on that controller.
       * Calls `WeaponStateComponent->AddConfirmedServerSideHitMarkers(HitResult)`. This sends an RPC to the _original shooter's client_, telling it to display a confirmed hit marker based on the server-authoritative impact.



### Key Takeaways for Users

* **Impact Cosmetics:** Implement the `AddImpactEffects` event in a Blueprint subclass of `UProjectileManager`. Use the provided `HitResult` and `Projectile` data (especially `ImpactCueNotify` tag and `PhysMaterial`) to trigger appropriate Gameplay Cues or spawn effects directly. Remember `GetMappedHitResult()` for accurate current-world placement.
* **Damage Definition:** Define the base damage and other gameplay consequences within a `UGameplayEffect` asset. Assign this effect class to the `HitEffect` field when broadcasting the `FNewTraceProjectileMessage`.
* **Penetration Damage:** The system automatically calculates cumulative damage reduction based on the `DamageChangePercentage` defined in the `FProjectileMaterialPenetrationInfo` for materials passed through. Ensure your damage `GameplayEffect` is set up to potentially receive its magnitude based on the effect level or a SetByCaller value if you want to use the calculated reduction factor directly.
* **Hit Feedback:** Hit markers are automatically handled if the instigator controller has a `UWeaponStateComponent`.

This clear separation ensures that the performance-critical simulation happens on a background thread, while the gameplay-impacting results are applied safely and extensibly on the main game thread.

***
