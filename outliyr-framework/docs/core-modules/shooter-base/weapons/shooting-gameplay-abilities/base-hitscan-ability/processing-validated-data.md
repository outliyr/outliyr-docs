# Processing Validated Data

After the server has performed the necessary lag-compensated validation (or if running in a non-networked/listen server context where validation isn't needed against a remote client), the final step is to process the results, apply gameplay consequences, and confirm the outcome with the client. This happens within the `ProcessValidatedTargetData` function.

### Entry Point (`ProcessValidatedTargetData`)

This function is called:

1. **After Server Validation:** At the end of `PerformServerSideValidation`, once all asynchronous rewind traces have completed and the `TargetDataHandle` potentially contains invalidated/corrected hits (marked via `bHitReplaced`). This call occurs within a new `FScopedPredictionWindow` linked to the original client action via the `ValidationKey`.
2. **Directly (Listen Server/Standalone):** In `OnTargetDataReadyCallback` on the server if `!CurrentActorInfo->IsLocallyControlled()` is false (meaning it's the server itself or a listen-server host), bypassing the lag compensation validation steps entirely as the initial trace is already authoritative.

### Processing Logic

1. **Filter Valid Hits:**
   * Creates a new, empty `FGameplayAbilityTargetDataHandle NewTargetDataHandle`.
   * Iterates through the input `TargetDataHandle`.
   * For each `FGameplayAbilityTargetData_SingleTargetHit`:
     * Checks the `bHitReplaced` flag.
     * If `bHitReplaced` is `false` (meaning the server validated this hit or it didn't need validation), it creates a _copy_ of the target data entry and adds it to `NewTargetDataHandle`.
     * If `bHitReplaced` is `true`, it means the server invalidated this specific hit during validation, so it's _skipped_ and not added to `NewTargetDataHandle`.
   * The result is that `NewTargetDataHandle` (aliased as `ProcessedTargetDataHandle` for clarity) contains only the hits the server considers legitimate.
2. **Confirm Hit Markers:**
   * Gets the `AController` and its `ULyraWeaponStateComponent`.
   * Builds a `TArray<uint8> HitReplaces` containing the indices of the hits that were _invalidated_ (where `bHitReplaced` was true in the original `TargetDataHandle`).
   * Calls `WeaponStateComponent->ClientConfirmTargetData(TargetDataHandle.UniqueId, true, HitReplaces)`. This RPC is sent back to the _originating client_.
     * `UniqueId`: Matches the ID sent with the original `AddUnconfirmedServerSideHitMarkers` call.
     * `bSuccess = true`: Indicates the overall targeting action was processed (even if some hits were invalidated).
     * `HitReplaces`: Tells the client _which_ of its unconfirmed hit markers were actually invalid according to the server. The client's `ULyraWeaponStateComponent` uses this list to filter its `UnconfirmedServerSideHitMarkers` array, ensuring only the server-confirmed hits contribute to the final `LastWeaponDamageScreenLocations` used for displaying persistent hit markers or calculating hit zones.
3. **Commit Authoritative Costs & Cooldowns:**
   * Calls `CommitAbility(CurrentSpecHandle, CurrentActorInfo, CurrentActivationInfo)`. This authoritatively applies the ability's cost (e.g., ammo) and cooldowns on the server.
   * Because this happens _within the prediction window_ established after validation, GAS automatically handles reconciliation. If the client predictively committed the cost but the server now fails the commit (e.g., server realizes ammo count is lower than client thought), GAS can help roll back the client's prediction.
4. **Apply Gameplay Effects (Damage, etc.):**
   * If `CommitAbility` succeeds on the server:
     * **Apply Spread:** Calls `WeaponData->AddSpread()` on the server's instance of the weapon. While less critical than the client's immediate spread update, this ensures the server's weapon state remains consistent if needed for other logic.
     * **Trigger Blueprint Event:** Calls `OnRangedWeaponTargetDataReady(ProcessedTargetDataHandle)`. This is the **server's** opportunity to react to the validated hits. This Blueprint event is typically where:
       * Gameplay Effects containing damage calculations are applied to the hit actors found in the `ProcessedTargetDataHandle`.
       * Other gameplay logic triggered by a successful hit occurs (e.g., applying status effects, notifying subsystems).
       * Server-side cosmetic events might be triggered if needed (though most cosmetics are handled client-side).
5. **Handle Commit Failure:**
   * If `CommitAbility` fails on the server, it logs a warning and calls `K2_EndAbility()` to terminate the ability on the server side.

### Summary of Server Processing

* Server receives validated (or directly authoritative) `TargetDataHandle`.
* Filters out any hits marked as invalid (`bHitReplaced`).
* Sends confirmation (`ClientConfirmTargetData`) back to the client, indicating which specific hits were validated.
* Authoritatively commits ability costs and cooldowns.
* If commit succeeds, applies server-side spread and triggers `OnRangedWeaponTargetDataReady` for applying damage/effects using the _validated_ hit data.

This final step ensures that gameplay consequences (damage, cost) are applied authoritatively based on server-verified information, while also providing feedback to the client to correct its predicted state regarding hit markers.

***
