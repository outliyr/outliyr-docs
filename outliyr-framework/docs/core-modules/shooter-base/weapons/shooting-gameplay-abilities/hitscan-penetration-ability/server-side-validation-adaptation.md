# Server-Side Validation Adaptation

Validating hitscan penetration adds complexity compared to standard hitscan. The server not only needs to verify the _first_ hit but also the _entire sequence_ of penetrations reported by the client. It must ensure the client isn't claiming penetrations through materials that shouldn't allow it, exceeding penetration limits, or hitting targets that weren't actually behind penetrable cover in the server's rewound world state.

The `UGameplayAbility_HitScanPenetration` overrides `PerformServerSideValidation` to handle this.

### Overridden `PerformServerSideValidation` Logic

The core validation flow remains similar to the standard hitscan, using the Lag Compensation Manager, but with key adaptations to handle multi-hit results per bullet:

1. **Get Lag Compensation Manager & Prepare:** Same as standard hitscan - get the manager, prepare base trace parameters and ignore actors.
2. **Group Client Hits (Optimization):** This is a crucial difference. Instead of validating each reported hit individually, the server first groups the client's `TargetDataHandle` entries.
   * It uses a `TMap<FVector, TMap<int32, TArray<FGameplayAbilityTargetData_SingleTargetHit*>>> TraceEndMap`.
   * **Outer Key (`FVector`):** The `TraceEnd` vector of the _original_ bullet trace (before any penetrations). Hits from the same initial aiming direction are grouped here.
   * **Inner Key (`int32`):** The `BulletID` (stored in `HitResult.MyItem`). This groups all penetration hits belonging to a _single_ initial bullet trace.
   * **Value (`TArray<...>`):** An array containing all the `FGameplayAbilityTargetData_SingleTargetHit` pointers reported by the client for that specific bullet's penetration path.
   * **Purpose:** This grouping ensures that the server only needs to perform _one_ lag-compensated multi-hit trace (`RewindLineTrace` using `Lyra_TraceChannel_Weapon_Multi`) for each unique initial bullet direction, rather than potentially multiple traces if individual penetration hits were processed separately. It significantly reduces the overhead of lag compensation calls.
   * **Pre-Filtering:** During grouping, it still performs basic sanity checks (`IsLineTracePossible`) and checks if the client hit an actor. Hits failing these checks or hitting nothing significant are skipped or potentially pre-invalidated (`ReplaceHitWith`).
3. **Initiate Rewind Multi-Trace:**
   * Iterates through the grouped `TraceEndMap` and its nested `BulletID` map.
   * For each unique initial bullet trace (defined by `TraceStart` from the first hit in the group and `TraceEnd` from the map key):
     * Retrieves the client's `Timestamp`.
     * Calls `LagCompensationManager->RewindLineTrace(...)` using the **multi-hit channel** (`Lyra_TraceChannel_Weapon`). This performs the authoritative trace in the rewound world state, collecting _all_ overlapping hits along the path, just like the client did locally.
4. **Handle Asynchronous Result (`ResultFuture.Then(...)`):** The callback structure is similar, executing on the game thread after the async trace completes.
   * **Server-Side Penetration Calculation (`ValidateHitscanPenetration`):**
     * Gets the `FRewindLineTraceResult Result` containing the server's authoritative hit sequence (`Result.HitResults`).
     * Calls a helper function `ValidateHitscanPenetration(Result.HitResults, /*out*/ ValidatedHits)`. This helper takes the raw multi-hit results from the server's trace and applies the _server's_ penetration logic (`ShouldHitscanPenetrate`, `MaxPenetrations`) to determine the sequence of hits the server considers valid based on its own rules and the rewound world state. The output `ValidatedHits` contains the server's calculated valid penetration sequence for that bullet.
   * **Compare Server Sequence vs. Client Sequence (`CompareValidatedHitsWithClient`):**
     * Calls another helper function `CompareValidatedHitsWithClient(ValidatedHits, BulletPair.Value)`.
     * `ValidatedHits`: The sequence of hits the server calculated as valid.
     * `BulletPair.Value`: The array of `FGameplayAbilityTargetData_SingleTargetHit*` originally reported by the client _for this specific bullet ID_.
     * **Logic:** This function iterates through _each hit reported by the client_ for this bullet. For each client hit, it checks if a _corresponding_ hit exists in the `ValidatedHits` sequence calculated by the server. The match requires:
       * Same Actor (`ServerHit.GetActor() == ClientHit->GetActor()`).
       * Same Physical Material (`ServerHit.PhysMaterial.Get() == ClientHit->PhysMaterial.Get()`).
       * Similar Impact Point (within a tolerance, e.g., `FVector::DistSquared(...) <= FMath::Square(250.0f)`).
     * **Invalidation:** If a client-reported hit _cannot_ be matched with a corresponding hit in the server's validated sequence, that specific client hit is marked as invalid using `SingleTargetHit->ReplaceHitWith(nullptr, &EmptyHitResult)`.
   * **Track Completion & Final Processing:** Same as standard hitscan - increments the counter, and when all grouped traces are validated, creates the dependent prediction window and calls `ProcessValidatedTargetData`.

### Helper Functions for Validation

* **`ValidateHitscanPenetration(const TArray<FPenetrationHitResult>& InitialHitResults, TArray<FHitResult>& OutHits) const`**:
  * Mirrors the logic of the client-side `HandleHitscanPenetration`.
  * Takes the raw multi-hit results from the server's rewind trace (`InitialHitResults`).
  * Iterates through them, applying the _server's_ `ShouldHitscanPenetrate` logic and respecting the server's `MaxPenetrations` limit.
  * Populates `OutHits` with the sequence of hits the server deems valid according to its rules.
* **`CompareValidatedHitsWithClient(const TArray<FHitResult>& ServerValidatedHits, const TArray<FGameplayAbilityTargetData_SingleTargetHit*>& ClientHits) const`**:
  * Performs the crucial comparison described above, marking individual client hits within the `ClientHits` array as invalid (`bHitReplaced = true`) if they don't have a matching counterpart in the `ServerValidatedHits` sequence.

### Summary of Penetration Validation

* Server groups incoming client hits by original trace path and bullet ID.
* Performs one lag-compensated multi-hit trace per unique initial bullet path.
* Applies server-side penetration logic (`ValidateHitscanPenetration`) to the server's trace results to determine the authoritative penetration sequence.
* Compares the server's valid sequence against the sequence reported by the client (`CompareValidatedHitsWithClient`).
* Invalidates individual client hits within the `TargetDataHandle` if they don't match the server's findings.
* Proceeds to `ProcessValidatedTargetData` with the potentially modified `TargetDataHandle`.

This adapted validation ensures that penetration results are not only checked against the correct historical world state but also adhere strictly to the server's defined penetration rules, preventing exploits related to material properties or penetration limits.

***
