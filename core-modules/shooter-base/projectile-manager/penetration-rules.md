# Penetration Rules

The Projectile Manager system supports projectile penetration, allowing bullets simulated by the thread to pass through certain materials. This behavior is highly configurable based on the physical properties assigned to surfaces in your world.

### Linking Materials to Rules

The core of the configuration lies in associating specific `UPhysicalMaterial` assets with a set of penetration rules defined in the `FProjectileMaterialPenetrationInfo` struct.

1. **Create Physical Materials:** In your Content Browser, create `UPhysicalMaterial` assets for the different surface types in your game that might allow penetration (e.g., `PM_Wood_Thin`, `PM_SheetMetal`, `PM_Glass`, `PM_Drywall`). You will also need physical materials for surfaces that _block_ projectiles, but these don't need specific penetration rules defined.
2. **Assign Physical Materials:** Apply these `UPhysicalMaterial` assets to the appropriate materials used on your Static Mesh and Skeletal Mesh assets, or directly onto the collision shapes within Physics Assets or Static Mesh collision settings. When a trace hits a surface, the engine reports the assigned `UPhysicalMaterial`.
3. **Define Rules (`FProjectileMaterialPenetrationInfo`):** For each `UPhysicalMaterial` that _should_ allow penetration under certain conditions, you need to define its behavior using the fields within the `FProjectileMaterialPenetrationInfo` struct.
4. **Construct the Map:** When spawning a projectile using the `FNewTraceProjectileMessage`, you must populate the `MaterialPenetrationMap` (`TMap<TObjectPtr<UPhysicalMaterial>, FProjectileMaterialPenetrationInfo>`) field. The keys of this map are the `UPhysicalMaterial` assets that allow penetration, and the values are the corresponding `FProjectileMaterialPenetrationInfo` structs containing their specific rules. This map is typically constructed within the Gameplay Ability that sends the spawn message, potentially reading data from the weapon definition or the ability asset itself.

```cpp
// Defined in ProjectileManager.h (or similar header)
USTRUCT(BlueprintType)
struct FProjectileMaterialPenetrationInfo
{
    GENERATED_BODY()

    // Maximum depth projectile can pass through (cm). Currently informational for the thread,
    // but could be used in extended penetration logic.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ForceUnits="cm"))
    float MaxPenetrationDepth = 20;

    // (Currently unused by core thread logic) Range for randomizing penetration depth.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FVector2D PenetrationDepthMultiplierRange = FVector2D(0.9f, 1.1f);

    // Factor by which velocity is multiplied after penetrating (0.0=stops, 1.0=no change).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float VelocityChangePercentage = 0.75f;

    // Factor applied to damage for hits AFTER penetrating this material (0.0=no damage, 1.0=full damage).
    // Applied cumulatively in UProjectileManager::HandleProjectileImpact.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float DamageChangePercentage = 0.75f;

    // Maximum angle (degrees) between projectile direction and surface normal for penetration to occur.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ForceUnits="°"))
    float MaxPenetrationAngle = 25.0f;

    // Projectile speed (m/s) must be >= this value to penetrate this material.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ForceUnits="m/s"))
    float MinimumPenetrationVelocity = 10;

    // (Currently unused) Max angle (degrees) for random exit direction deviation.
    UPROPERTY(EditAnywhere, BlueprintReadWrite,  meta=(ForceUnits="°"))
    float MaxExitSpreadAngle = 10.0f;

    // (Currently unused) Minimum impact angle (degrees) for potential ricochet.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(ForceUnits="°"))
    float MinRicochetAngle = 60.0f;

    // (Currently unused) Probability (0.0-1.0) of ricochet if angle is >= MinRicochetAngle.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float RicochetProbability = 0.5f;

    // (Currently unused) Factor by which velocity is multiplied after a ricochet.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float RicochetVelocityPercentage = 0.75f;
};
```

### Key Configurable Properties & Their Effects:

* **`MaxPenetrationAngle`:** This is a primary factor. If the impact angle is too steep (greater than this value), the projectile will stop, regardless of other factors. Lower values mean only near-perpendicular hits penetrate.
* **`MinimumPenetrationVelocity`:** Prevents slow-moving projectiles (that might have lost speed due to gravity or previous penetrations) from passing through tougher materials. Speed is checked in meters per second.
* **`VelocityChangePercentage`:** Directly affects the projectile's speed _after_ successfully penetrating. A value of `0.75` means the projectile retains 75% of its speed. This impacts subsequent range and penetration capability.
* **`DamageChangePercentage`:** This factor doesn't affect the simulation thread directly but is used by the `UProjectileManager::HandleProjectileImpact` function _after_ a penetrating hit is reported. It cumulatively reduces the damage applied by the `HitEffect` for subsequent hits. A value of `0.75` means subsequent hits deal 75% of the damage they would have otherwise dealt (compounded for multiple penetrations).
* **`MaxPenetrations` (in `FNewTraceProjectileMessage`):** While not part of `FProjectileMaterialPenetrationInfo`, this value passed during the spawn request provides an overall limit on how many surfaces _any_ material type can be penetrated by a single projectile during its lifetime.

**Important Note on Unused Properties:** Several properties related to depth, randomized depth, ricochet, and exit spread exist in the `FProjectileMaterialPenetrationInfo` struct but are not currently used in the core `ShouldProjectilePenetrate` or velocity update logic within the provided `FProjectileThreadRunnable` code. They represent potential areas for future expansion or customization if more complex penetration physics are desired. Currently, penetration primarily checks angle and minimum velocity, and applies a fixed velocity percentage reduction.

### Example Configuration Scenario:

1. Create `PM_Wood_Thin` and `PM_Metal_Sheet` physical materials.
2. In your Firing Gameplay Ability (e.g., `GA_Fire_Rifle_ProjectileManaged`), create the `MaterialPenetrationMap`:
   * Key: `PM_Wood_Thin` -> Value: `FProjectileMaterialPenetrationInfo` { MaxAngle=45, MinVelocity=5, VelocityChange=0.8, DamageChange=0.8 }
   * Key: `PM_SheetMetal` -> Value: `FProjectileMaterialPenetrationInfo` { MaxAngle=20, MinVelocity=50, VelocityChange=0.5, DamageChange=0.6 }
3. Set `MaxPenetrations` in the `FNewTraceProjectileMessage` to `1`.
4. Assign `PM_Wood_Thin` to wooden fences, `PM_Metal_Sheet` to metal containers in the level. Assign a default blocking physical material to concrete walls.

**Outcome:**

* Rifle bullets hitting wood fences at less than 45 degrees and > 5 m/s will penetrate, losing 20% velocity and dealing 80% damage to targets hit _after_ the fence. They will stop on the next surface hit (due to `MaxPenetrations=1`).
* Bullets hitting metal containers only penetrate if the angle is < 20 degrees and speed > 50 m/s, losing 50% velocity and dealing 60% damage afterward.
* Bullets hitting concrete walls will stop immediately.

By carefully defining physical materials and their corresponding penetration rules in the map provided during spawning, you gain fine-grained control over how projectiles interact with the environment.

***
