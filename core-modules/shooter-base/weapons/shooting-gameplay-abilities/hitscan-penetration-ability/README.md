# Hitscan Penetration Ability

Building directly upon the foundation of the standard hitscan ability, `UGameplayAbility_HitScanPenetration` introduces the capability for instant-hit traces to **pass through** certain surfaces, potentially hitting multiple targets or objects along a single line of fire. This adds a significant tactical layer, allowing players to engage enemies through thin cover or collateral targets.

```cpp
// Header: GameplayAbility_HitscanPenetration.h
// Parent: UGameplayAbility_RangedWeapon_Hitscan

UCLASS(MinimalAPI)
class UGameplayAbility_HitScanPenetration : public UGameplayAbility_RangedWeapon_Hitscan
{
    GENERATED_BODY()

protected:
    // Configuration for penetration rules based on surface material
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=Customisation)
    TMap<TObjectPtr<UPhysicalMaterial>, FHitscanMaterialPenetrationInfo> PenetrationSettings;

    // Limit on how many surfaces one shot can penetrate
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=Customisation)
    int32 MaxPenetrations = 1;

    // ... Overrides for DoSingleBulletTrace, DetermineTraceChannel, PerformServerSideValidation, etc. ...
};
```

### Purpose and Key Features

* **Extends Hitscan:** Inherits all the core functionality of `UGameplayAbility_RangedWeapon_Hitscan`, including instant traces, client prediction, and basic server validation structure.
* **Surface Penetration:** Allows traces to continue after hitting a surface, provided the surface's `UPhysicalMaterial` is configured for penetration in the ability's `PenetrationSettings` and the impact angle is within limits.
* **Configurable Rules:** Penetration behavior (maximum angle, potential damage reduction - though applied via separate effects, max penetrations) is defined per physical material.
* **Multi-Hit Detection:** Uses a specific trace channel (`Lyra_TraceChannel_Weapon_Multi`) designed to detect _all_ overlapping actors along the trace path, not just the first blocking hit.
* **Adapted Server Validation:** The server-side validation logic is significantly enhanced to:
  * Perform authoritative multi-hit traces in the rewound world state.
  * Apply server-side penetration rules to determine the valid penetration sequence.
  * Compare the server's calculated sequence against the entire sequence reported by the client, invalidating incorrect client hits.
  * Optimize validation calls by grouping client hits belonging to the same initial bullet trace.

### Execution Flow Differences (Compared to Standard Hitscan)

While the overall activation and client/server interaction flow is similar to standard hitscan, the key differences lie in the tracing and validation steps:

1. **Tracing:** Instead of stopping at the first hit, the initial trace (both client and server) uses a multi-hit channel to gather _all_ overlaps along the path.
2. **Penetration Calculation:** Logic (`HandleHitscanPenetration`, `ShouldHitscanPenetrate`) is applied to the sequence of raw hits to determine the actual path of the penetrating bullet based on material rules and angle checks. This produces a final list of hits, potentially including multiple actors/surfaces.
3. **Target Data:** The `TargetDataHandle` sent by the client may contain _multiple_ `FGameplayAbilityTargetData_SingleTargetHit` entries for a single conceptual "bullet," each representing an impact along the penetration path. The `MyItem` field is used to group these related hits.
4. **Server Validation:** The server performs a multi-hit rewind trace, applies its own penetration calculation (`ValidateHitscanPenetration`), and then compares the entire resulting sequence against the client's reported sequence (`CompareValidatedHitsWithClient`), invalidating individual client hits that don't match the server's authoritative path.

The detailed implementation of these differences is covered in the following sub-pages:

* **Configuration & Penetration Logic:** Explains setting up rules and how the penetration path is calculated.
* **Server-Side Validation Adaptation:** Details the modified validation process for multi-hit results.

This ability allows for more dynamic and engaging firefights where cover isn't always absolute safety.

***
