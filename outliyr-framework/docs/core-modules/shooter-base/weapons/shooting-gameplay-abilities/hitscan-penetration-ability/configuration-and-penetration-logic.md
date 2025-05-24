---
description: >-
  Hitscan Penetration Ability: UGameplayAbility_HitScanPenetration -
  Configuration & Penetration Logic
---

# Configuration & Penetration Logic

The `UGameplayAbility_HitScanPenetration` ability extends the standard hitscan functionality (`UGameplayAbility_RangedWeapon_Hitscan`) by allowing bullets to pass through certain surfaces, potentially hitting targets behind them. This adds tactical depth, enabling players to shoot through thin cover or hit multiple enemies lined up.

```cpp
// Header: GameplayAbility_HitscanPenetration.h
// Parent: UGameplayAbility_RangedWeapon_Hitscan

// Struct defining penetration rules per material
USTRUCT(BlueprintType)
struct FHitscanMaterialPenetrationInfo { /* ... properties ... */ };

UCLASS(MinimalAPI)
class UGameplayAbility_HitScanPenetration : public UGameplayAbility_RangedWeapon_Hitscan
{
    GENERATED_BODY()

public:
    // Constructor

    // Main function to process hits and calculate penetration paths
    UE_API void HandleHitscanPenetration(
        int32 LocalBulletID,
        const TArray<FHitResult>& InitialHitResults,
        TArray<FHitResult>& OutHits // Populated with all hits, including penetrations
        ) const;

    // Determines if a specific hit should allow penetration
    UE_API bool ShouldHitscanPenetrate(const FHitResult& HitResult) const;

    // Overridden to use a trace channel that hits multiple overlapping actors
    UE_API virtual ECollisionChannel DetermineTraceChannel(...) const override;

    // Overridden to incorporate penetration logic into the single bullet trace
    UE_API virtual FHitResult DoSingleBulletTrace(...) const override;

    // ... Server validation override ...

protected:
    // Configurable map linking Physical Materials to penetration rules
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=Customisation)
    TMap<TObjectPtr<UPhysicalMaterial>, FHitscanMaterialPenetrationInfo> PenetrationSettings;

    // Maximum number of surfaces a single bullet can penetrate
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=Customisation)
    int32 MaxPenetrations = 1;

    // ... Internal validation helpers ...
};
```

### Configuration

The penetration behavior is primarily configured through two properties on the ability asset:

1. **`PenetrationSettings` (`TMap<UPhysicalMaterial*, FHitscanMaterialPenetrationInfo>`)**:
   * This map links a `UPhysicalMaterial` asset to a `FHitscanMaterialPenetrationInfo` struct.
   * When a hitscan impacts a surface, the ability checks the `UPhysicalMaterial` of the hit surface. If that material exists as a key in this map, the corresponding `FHitscanMaterialPenetrationInfo` rules are applied.
   * **`FHitscanMaterialPenetrationInfo` Struct Properties:**
     * `MaxPenetrationDepth` (cm): _Currently seems unused in the provided `HandleHitscanPenetration` logic, but intended for limiting penetration based on material thickness._
     * `PenetrationDepthMultiplierRange` (Vector2D): _Currently unused._
     * `DamageChangePercentage`: _Currently unused by the ability itself, but intended for Gameplay Effects applied later to use this info to reduce damage after penetration._
     * `MaxPenetrationAngle` (degrees): The maximum angle between the incoming bullet direction and the surface normal for penetration to be possible. Steeper angles are less likely to penetrate.
     * `MaxExitSpreadAngle` (degrees): _Currently unused, but intended to potentially add random deviation to the bullet's path after exiting the material._
     * `MinRicochetAngle` (degrees): _Currently unused, but intended for adding ricochet chance at glancing angles._
     * `RicochetProbability`: _Currently unused._
   * **Important:** You need to create `UPhysicalMaterial` assets in your project (e.g., `PM_Wood_Light`, `PM_Metal_Thin`, `PM_Concrete_Thick`) and assign them to the collision geometries of your environment meshes or physics assets. Then, populate the `PenetrationSettings` map in your penetration ability asset, linking these materials to specific penetration rules. Materials _not_ in the map will block penetration by default.
2. **`MaxPenetrations` (`int32`)**:
   * A simple limit on how many surfaces a single bullet trace can pass through. If set to `1`, a bullet can penetrate the first valid surface but will stop on the second. If set to `0`, penetration is effectively disabled (acting like standard hitscan).

### Penetration Logic Flow

The core penetration logic is initiated within the overridden `DoSingleBulletTrace` function and primarily handled by `HandleHitscanPenetration`.

1. **Overridden `DetermineTraceChannel`**:
   * This function is overridden to return `Lyra_TraceChannel_Weapon_Multi`. This custom trace channel (presumably configured in Project Settings -> Collision) should be set up to **overlap** with penetrable objects instead of blocking immediately. This allows the initial trace (`WeaponTrace`) to return _all_ overlapping hits along the bullet's path, not just the first blocking one.
2. **Overridden `DoSingleBulletTrace`**:
   * Performs the initial trace using `WeaponTrace` (which now uses the multi-hit channel) to get `InitialHitResults`. This array contains all actors/components overlapped along the trace path, sorted by distance.
   * If any hits occurred (`InitialHitResults.Num() > 0`), it calls `HandleHitscanPenetration(LocalBulletID, InitialHitResults, OutHits)`.
   * Returns the _last_ hit added to `OutHits` as the primary result (or a default miss hit if `OutHits` remains empty).
3. **`HandleHitscanPenetration`**:
   * **Purpose:** Iterates through the `InitialHitResults` (from the multi-trace) and decides which hits should be included in the final `OutHits` list based on penetration rules.
   * **Logic:**
     1. Iterates through each `HitResult` in `InitialHitResults`.
     2. **Add Hit:** Adds the current `HitResult` to the `OutHits` list.
        * Sets `PenetratedHitResult.MyItem = LocalBulletID` to group all hits from this single bullet trace together.
        * Sets `PenetratedHitResult.Location` to the `ImpactPoint` of the _previous_ hit in `OutHits`. This is a clever use of the `Location` field (often less critical than `ImpactPoint`) to store the entry point for visualization purposes (like drawing tracer segments between penetrations).
     3. **Check Penetration Limit:** If the number of hits added to `OutHits` already equals `MaxPenetrations + 1` (meaning the max number of penetrations has occurred, and this is the hit _after_ the last penetration), the loop breaks.
     4. **Check Penetrability:** Calls `ShouldHitscanPenetrate(HitResult)` for the current hit.
     5. If `ShouldHitscanPenetrate` returns `false`, the loop breaks, as this surface blocks further travel.
4. **`ShouldHitscanPenetrate`**:
   * **Purpose:** Determines if a _single_ hit surface allows the bullet to pass through.
   * **Logic:**
     1. Gets the `UPhysicalMaterial*` from the `HitResult.PhysMaterial`.
     2. Looks up this material in the `PenetrationSettings` map.
     3. **If Material Found:**
        * Calculates the `ImpactAngle` between the incoming trace direction (`HitResult.TraceEnd - HitResult.TraceStart`) and the surface normal (`-HitResult.ImpactNormal`).
        * Compares the `ImpactAngle` to the `MaxPenetrationAngle` defined in the found `FHitscanMaterialPenetrationInfo`.
        * Returns `true` if `ImpactAngle <= MaxPenetrationAngle`, `false` otherwise.
     4. **If Material Not Found:** Returns `false` (surface is not configured for penetration).

### Result

After `DoSingleBulletTrace` completes, the `OutHits` array passed to the ability's main targeting logic (`StartRangedWeaponTargeting` -> `OnTargetDataReadyCallback`) will contain a sequence of hits: the first impact, followed by subsequent impacts after penetrating surfaces, up to the `MaxPenetrations` limit or until a non-penetrable surface is hit. Each `FHitResult` in this array will have its `MyItem` field set to the same `LocalBulletID`, grouping them as part of a single bullet's path.

This allows the subsequent processing steps (server validation, applying effects) to handle multi-hit scenarios correctly.

***

**Next Steps:**

* Proceed to the next sub-page for `UGameplayAbility_HitScanPenetration`: **"Server-Side Validation Adaptation"** to see how validation handles these multi-hit results.
