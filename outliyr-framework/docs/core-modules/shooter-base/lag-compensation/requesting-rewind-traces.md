# Requesting Rewind Traces

The Rewind Trace API is the main gameplay-facing interface to the Lag Compensation System.\
It allows the server to **query where a trace would have intersected actors in the past**, accounting for player latency.

You can call this API during **hit validation**, **server-side shot correction**, or **retroactive projectile simulation**.\
Internally, the system rewinds tracked actors to the requested moment, reconstructs their hit geometry, and performs a normal Unreal-style trace against that historical scene.

***

### Architecture Philosophy

Traditional lag-compensation approaches often store pre-expanded hitboxes for every frame or maintain per-player physics proxies.\
ShooterBase instead exposes a **single unified trace interface** that works across all actor types (skeletal or static) while remaining thread-safe and asynchronous.

This design follows three key goals:

| Goal                       | Explanation                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Server Authority**       | All rewind traces execute only on the server. Clients never perform or predict rewinds.                                     |
| **Asynchronous Execution** | Rewind traces are processed on the background worker to avoid blocking gameplay.                                            |
| **Ease of Use**            | Gameplay code and Blueprints can trigger traces with one function or node — results are returned via `TFuture` or delegate. |

***

### C++ API — `ULagCompensationManager::RewindLineTrace`

The manager exposes two overloads: one using **absolute timestamp** and one using **relative latency**.

```cpp
// Rewind to an absolute timestamp
TFuture<FRewindLineTraceResult> RewindLineTrace(
    double Timestamp,
    const FVector& Start,
    const FVector& End,
    const FRewindTraceInfo& TraceInfo,
    ECollisionChannel TraceChannel,
    const TArray<AActor*>& ActorsToIgnore);

// Rewind using latency in milliseconds
TFuture<FRewindLineTraceResult> RewindLineTrace(
    float LatencyMs,
    const FVector& Start,
    const FVector& End,
    const FRewindTraceInfo& TraceInfo,
    ECollisionChannel TraceChannel,
    const TArray<AActor*>& ActorsToIgnore);
```

#### **Parameters**

| Parameter                 | Description                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Timestamp / LatencyMs** | When to rewind. Use a precise client timestamp if available; otherwise provide known latency. |
| **Start / End**           | World-space trace endpoints (usually from the client-reported shot).                          |
| **TraceInfo**             | `FRewindTraceInfo` describing shape, radius, and orientation.                                 |
| **TraceChannel**          | Unreal collision channel to evaluate (e.g., `ECC_GameTraceChannel2`).                         |
| **ActorsToIgnore**        | Optional array of actors excluded from the historical and world trace phases.                 |

#### **Return**

`TFuture<FRewindLineTraceResult>` — the trace runs asynchronously.\
Attach a continuation with `.Then()` or poll its readiness.

***

#### **Example (C++ Usage)**

```cpp
ULagCompensationManager* LagComp = GetWorld()->GetGameState()->FindComponentByClass<ULagCompensationManager>();
if (!LagComp) return;

FRewindTraceInfo TraceInfo;
TraceInfo.TraceType   = ERewindTraceType::Sphere;
TraceInfo.SphereRadius = 6.0f;

double ClientTimestamp = TargetData.Timestamp;
FVector Start = TargetData.TraceStart;
FVector End   = TargetData.TraceEnd;

TFuture<FRewindLineTraceResult> Future = LagComp->RewindLineTrace(
    ClientTimestamp, Start, End, TraceInfo,
    Lyra_TraceChannel_Weapon, ActorsToIgnore);

Future.Then([this](TFuture<FRewindLineTraceResult> InFuture)
{
    FRewindLineTraceResult Result = MoveTemp(InFuture).Get();

    AsyncTask(ENamedThreads::GameThread, [this, Result]()
    {
        if (Result.HitResults.Num() > 0)
        {
            const FPenetrationHitResult& Hit = Result.HitResults[0];
            ApplyDamageOrEffect(Hit);
        }
    });
});
```

***

### Blueprint API — `Rewind Line Trace (Async)`

To expose the same functionality to Blueprints, the system provides an asynchronous action node:

<figure><img src="../../../.gitbook/assets/image.png" alt="" width="361"><figcaption></figcaption></figure>

#### **Inputs**

* `Latency` — how far back to rewind (seconds).
* `Trace Start`, `Trace End` — world-space endpoints.
* `Trace Rotation` — optional orientation for future shape types.
* `Trace Shape` — `Line` or `Sphere`.
* `Sphere Radius` — only relevant for sphere traces.
* `Trace Channel` — collision channel.
* `Actors To Ignore` — optional list.

#### **Outputs**

| Pin                     | Description                            |
| ----------------------- | -------------------------------------- |
| **On Trace Completed**  | Fired when the async trace finishes.   |
| **Return Value (bool)** | `true` if a blocking hit was found.    |
| **Out Hit Results**     | Array of all hits, sorted by distance. |

#### **Blueprint Example**

<figure><img src="../../../.gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

_Under the hood_, the node simply wraps the C++ call.\
`Activate()` triggers the manager’s `RewindLineTrace`, waits for its `TFuture`, then broadcasts `OnTraceCompleted` back on the game thread.

***

### Result Structures

When a rewind trace request is completed by the lag compensation thread, it returns the results packaged within specific data structures. Understanding these structures is crucial for correctly interpreting and utilizing the outcome of the historical trace.

#### **`FRewindLineTraceResult`**

```cpp
USTRUCT(BlueprintType)
struct FRewindLineTraceResult
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FPenetrationHitResult> HitResults;
};
```

**`HitResults` (`TArray<FPenetrationHitResult>`):** This is the core data. It's an array containing zero or more `FPenetrationHitResult` structs.

* **Ordering:** The hits in this array are sorted based on their distance from the `TraceStart` point, with the closest hit appearing first (index 0).
* **Content:** It includes hits detected against:
  * Interpolated historical hitboxes of `ULagCompensationSource` actors.
  * Current collision geometry of non-compensated actors encountered during the trace.
* **Empty Array:** If the trace didn't hit anything relevant (respecting the trace channel and ignored actors), this array will be empty.

***

#### **`FPenetrationHitResult`**

An enhanced version of `FHitResult` with extra data to describe how a trace entered and exited a historical hitbox.

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

***

### Summary

* Use `ULagCompensationManager::RewindLineTrace` (C++) or **Rewind Line Trace (Async)** (Blueprint) to query past world states.
* The result returns asynchronously via `TFuture` or `OnTraceCompleted`.
* Use `FPenetrationHitResult::GetMappedHitResult()` when spawning effects in the present world.
* All logic should execute on the **server**, the system never rewinds client-side data.

With this API, gameplay systems can authoritatively verify any client-reported trace while preserving responsiveness and visual correctness.

***

***
