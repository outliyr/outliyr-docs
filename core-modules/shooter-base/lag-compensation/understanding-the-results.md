# Understanding The Results

When a rewind trace request is completed by the lag compensation thread, it returns the results packaged within specific data structures. Understanding these structures is crucial for correctly interpreting and utilizing the outcome of the historical trace.

### The Result Container (`FRewindLineTraceResult`)

The top-level structure returned by `ULagCompensationManager::RewindLineTrace` (via the `TFuture`) and provided by the `UAsyncAction_RewindLineTrace` Blueprint node is `FRewindLineTraceResult`.

```cpp
// Defined in LagCompensationManager.h (or similar header)
USTRUCT(BlueprintType)
struct FRewindLineTraceResult
{
    GENERATED_BODY()

    // Contains all the hits found during the trace, ordered by distance
    // from the start point (closest first). This includes hits against
    // both rewound historical hitboxes and current non-compensated actors.
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FPenetrationHitResult> HitResults;
};
```

* **`HitResults` (`TArray<FPenetrationHitResult>`):** This is the core data. It's an array containing zero or more `FPenetrationHitResult` structs.
  * **Ordering:** The hits in this array are sorted based on their distance from the `TraceStart` point, with the closest hit appearing first (index 0).
  * **Content:** It includes hits detected against:
    * Interpolated historical hitboxes of `ULagCompensationSource` actors.
    * Current collision geometry of non-compensated actors encountered during the trace.
  * **Empty Array:** If the trace didn't hit anything relevant (respecting the trace channel and ignored actors), this array will be empty.

### Detailed Hit Information (`FPenetrationHitResult`)

Each entry in the `HitResults` array is an `FPenetrationHitResult` struct. This struct inherits from the standard engine `FHitResult` but adds specific information relevant to penetration and mapping historical hits back to the current world state.

```cpp
// Defined in LagCompensationManager.h (or similar header)
USTRUCT(BlueprintType)
struct FPenetrationHitResult : public FHitResult
{
    GENERATED_BODY()

    // --- Standard FHitResult fields are inherited ---
    // Including: bBlockingHit, Time, Location, ImpactPoint, Normal, ImpactNormal,
    // Component, BoneName, PhysMaterial, Distance, TraceStart, TraceEnd, etc.
    // NOTE: For hits against historical hitboxes, these standard fields
    // represent the state IN THE REWOUND PAST. Location/ImpactPoint are
    // where the hit occurred on the historical hitbox.

    // --- Penetration-Specific Data ---
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FVector ExitPoint; // World-space location where the trace exited the hit primitive.

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FVector ExitNormal; // World-space normal of the surface at the ExitPoint.

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName ExitBoneName; // Bone name associated with the exit surface (if skeletal).

    UPROPERTY(EditAnywhere, BlueprintReadWrite) // Added by system, not configurable
    float PenetrationDepth; // Calculated distance between entry (ImpactPoint) and ExitPoint.

    // --- Hitbox Mapping Data (Internal Use & Advanced Scenarios) ---

    // Helper function to map the historical hit location/normal back to the
    // corresponding position on the actor's CURRENT mesh.
    FPenetrationHitResult GetMappedHitResult() const;

    // Internal indices identifying the specific hitbox shape involved in the hit.
    // Used by GetMappedHitResult to find the current shape.
    int32 EntryBodySetupIndex; // Index within PhysicsAsset->SkeletalBodySetups (Skeletal)
    int32 EntryPrimitiveIndex; // Index within BodySetup->AggGeom (Skeletal) or StaticMesh->BodySetup->AggGeom (Static)
    int32 ExitBodySetupIndex;
    int32 ExitPrimitiveIndex;

    // Flag indicating if this hit was against a historical hitbox and needs mapping
    // via GetMappedHitResult() to get current world equivalent data.
    // If false, the hit was against current world geometry, and standard FHitResult fields are current.
    bool bNeedsMapping = false;
};
```

**Key Fields to Understand:**

* **Standard `FHitResult` Fields:** These behave as expected, providing information about the hit (actor, component, bone, physical material, impact point/normal). **Crucially, if `bNeedsMapping` is true, these coordinates and normals are relative to the actor's position&#x20;**_**at the rewound timestamp**_**.**
* **`ExitPoint`, `ExitNormal`, `ExitBoneName`:** These fields are calculated by the thread's detailed intersection logic. They provide the location and surface normal where the trace _exited_ the specific collision primitive it hit. This is essential for calculating `PenetrationDepth` and potentially for logic involving bullet exit effects or subsequent penetration calculations (though the current Gameplay Ability for penetration doesn't seem to use exit angles directly for subsequent traces).
* **`PenetrationDepth`:** The calculated distance the trace traveled _inside_ the hit primitive.
* **`bNeedsMapping`:** This boolean tells you if the hit occurred against a rewound historical hitbox (`true`) or against the current state of a non-compensated actor/world geometry (`false`).
* **`GetMappedHitResult()`:** **This is important if you need to apply effects (like decals, particle effects) based on the hit.** If `bNeedsMapping` is true, calling this function performs calculations using the stored indices (`EntryBodySetupIndex`, etc.) to find the corresponding collision primitive on the actor's _current_ mesh component. It then transforms the relative impact location and normal from the historical hit onto this current primitive, returning a _new_ `FPenetrationHitResult` where `Location`, `ImpactPoint`, `Normal`, and `ImpactNormal` represent the equivalent position in the **current world state**. This ensures visual effects appear correctly on the character model as it exists _now_, not where it was in the past. If `bNeedsMapping` is false, it simply returns a copy of itself.
* **Mapping Indices (`EntryBodySetupIndex`, etc.):** These internal indices pinpoint which specific collision shape within the Static Mesh's simple collision or the Skeletal Mesh's Physics Asset was involved in the entry and exit points of the hit. They are primarily used internally by `GetMappedHitResult`.

### Typical Usage

1. **Check for Hits:** Examine the `HitResults` array size in the returned `FRewindLineTraceResult`. If empty, it was a miss.
2. **Process Closest Hit:** Access `Result.HitResults[0]` for the first (closest) blocking hit.
3. **Validate (e.g., in Hitscan Ability):** Compare the `Actor` and `PhysMaterial` of `Result.HitResults[0]` against the client's reported hit.
4. **Apply Damage/Gameplay Effects:** Use the standard fields (`Actor`, `Component`, `BoneName`, `PhysMaterial`) from the validated `FPenetrationHitResult` to target gameplay effects. Remember that damage calculations might need to account for penetration if applicable (e.g., using data stored elsewhere based on the `PhysMaterial`).
5. **Apply Visual Effects (Decals, Particles):**
   * Call `ValidatedHit.GetMappedHitResult()` to get a hit result with coordinates mapped to the current world state.
   * Use the `Location`, `ImpactPoint`, and `ImpactNormal` from the **mapped** result to spawn decals or particle effects, ensuring they appear correctly on the current mesh position.

By understanding these result structures, particularly the distinction between historical and mapped coordinates provided by `FPenetrationHitResult`, you can correctly process the outcomes of lag-compensated traces for both gameplay logic and visual feedback.

***
