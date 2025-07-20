# Client-Side Execution

The `UGameplayAbility_RangedWeapon_Hitscan` ability implements the logic for instant, trace-based weapon fire. A significant portion of its work happens immediately on the firing client to ensure responsiveness, even before the server confirms the action.

### Initiating the Shot (`StartRangedWeaponTargeting`)

When the `UGameplayAbility_RangedWeapon_Hitscan` is activated (usually triggered by player input), its `ActivateAbility` calls the overridden `StartRangedWeaponTargeting` function. This function executes the core client-side logic for determining the shot's path and initial results:

1. **Get Context:** Obtains necessary components like the `AvatarActor`, `AbilitySystemComponent` (ASC), `Controller`, and `ULyraWeaponStateComponent`.
2. **Prediction Window:** Creates a `FScopedPredictionWindow`. This is crucial for GAS client-side prediction. It generates a `FPredictionKey` that associates this client action with potential server validation later. Actions performed within this scope (like applying cooldowns or costs locally) can be rolled back by the server if validation fails.
3. **Perform Local Traces:** Calls `PerformLocalTargeting()`. This internal helper function:
   * Gets the owning `APawn`.
   * Determines the targeting transform using `GetTargetingTransform(AvatarPawn, ShooterBase_RangeWeaponAbility::ELyraAbilityTargetingSource::WeaponTowardsFocus)` (common default).
   * Calculates the `AimDir`, `StartTrace`, and `EndAim` based on the transform and weapon range.
   * Packages this into a `FRangedWeaponFiringInput` struct.
   * Calls `TraceBulletsInCartridge(InputData, /*out*/ FoundHits)` to perform the actual traces and get the results.
4. **Package Target Data:** Creates the `FGameplayAbilityTargetDataHandle TargetData` as described in the "Target Data Handling" section of the base ability:
   * Assigns `TargetData.UniqueId` (usually from `WeaponStateComponent`).
   * Iterates through the `FoundHits`.
   * For each hit, creates a `FLyraGameplayAbilityTargetData_SingleTargetHit`, populates `HitResult`, `CartridgeID`, and calculates the client `Timestamp` for lag compensation.
   * Adds the `NewTargetData` to the `TargetData` handle.
5. **Register Unconfirmed Hits:** Calls `WeaponStateComponent->AddUnconfirmedServerSideHitMarkers(TargetData, FoundHits)`. This immediately tells the local `ULyraWeaponStateComponent` about the hits found by the client trace. The component can then use this information to display immediate visual feedback like hit markers on the HUD, _before_ the server confirms the hits. This is key for perceived responsiveness.
6. **Process Locally:** Immediately calls `OnTargetDataReadyCallback(TargetData, FGameplayTag())` to continue processing _on the client_.

### Local Processing (`OnTargetDataReadyCallback` - Client Side)

When `OnTargetDataReadyCallback` is called by `StartRangedWeaponTargeting` _on the firing client_:

1. **Prediction Scope Check:** It typically re-verifies it's within a valid prediction scope.
2. **Prepare for Server:** It identifies that it needs to notify the server: `const bool bShouldNotifyServer = CurrentActorInfo->IsLocallyControlled() && !CurrentActorInfo->IsNetAuthority();`.
3.  **Send Data to Server:** If `bShouldNotifyServer` is true, it sends the locally generated `TargetDataHandle` to the server using the ASC function:

    ```cpp
    MyAbilityComponent->CallServerSetReplicatedTargetData(
        CurrentSpecHandle,
        CurrentActivationInfo.GetActivationPredictionKey(), // The key generated earlier
        LocalTargetDataHandle,                             // The packaged hit results
        ApplicationTag,                                    // Usually empty
        MyAbilityComponent->ScopedPredictionKey            // Re-affirm prediction key
        );
    ```

    This RPC transmits the client's findings (hit results, timestamp) to the server, tagged with the prediction key for correlation.
4. **Apply Local Effects & Costs:** The client _immediately_ attempts to commit the ability cost (e.g., ammo consumption) using `CommitAbility()`. This happens within the prediction window.
   * **If Commit Succeeds:**
     * **Apply Spread:** Calls `WeaponData->AddSpread()`. This updates the weapon's heat and spread state locally based on the shot being fired.
     * **Trigger Blueprint Event:** Calls the Blueprint Implementable Event `OnRangedWeaponTargetDataReady(LocalTargetDataHandle)`. This allows designers to trigger purely cosmetic client-side effects based on the local trace results, such as:
       * Playing muzzle flash particle effects.
       * Playing firing sound effects.
       * Spawning tracer particle effects (using the `HitResult.TraceStart` and `HitResult.ImpactPoint` from the `LocalTargetDataHandle`).
       * Playing impact effects _at the client-predicted hit location_.
   * **If Commit Fails:** (e.g., client realizes it's out of ammo just before committing)
     * Logs a warning.
     * Calls `K2_EndAbility()` to terminate the ability locally. The server will likely reject the action anyway if the cost couldn't be met authoritatively.

### Tracing the Bullets (`TraceBulletsInCartridge`)

This virtual function, overridden in the hitscan ability, performs the specific trace logic:

1. Gets the `ULyraRangedWeaponInstance`.
2. Determines `BulletsPerCartridge` (usually 1 for non-shotguns).
3. Loops for each bullet:
   * Gets current spread angle and multiplier from the weapon instance.
   * Calculates the final `ActualSpreadAngle`.
   * Calculates the `HalfSpreadAngleInRadians`.
   * Calls `VRandConeNormalDistribution` using the `InputData.AimDir`, `HalfSpreadAngleInRadians`, and `WeaponData->GetSpreadExponent()` to get the randomized `BulletDir`.
   * Calculates the final `EndTrace` location based on `InputData.StartTrace`, `BulletDir`, and `WeaponData->GetMaxDamageRange()`.
   * Calls `DoSingleBulletTrace(InputData.StartTrace, EndTrace, ...)` (the base class function) to perform the line/sweep trace using the randomized direction.
   * Appends all impacts found by `DoSingleBulletTrace` into the `OutHits` array.
   * If `DoSingleBulletTrace` returned no blocking hits, it adds a default "miss" hit result pointing to the `EndTrace` location to ensure the `TargetDataHandle` always contains an entry for effects like tracers.

### Summary of Client Actions

* Player fires -> Ability activates.
* `StartRangedWeaponTargeting` runs on the client.
* Performs local trace(s) with current spread applied.
* Packages results (`HitResult`, `Timestamp`) into `TargetDataHandle`.
* Registers hits locally for immediate HUD hit markers (`AddUnconfirmedServerSideHitMarkers`).
* Calls `OnTargetDataReadyCallback`.
* `OnTargetDataReadyCallback` sends `TargetDataHandle` and `PredictionKey` to the server via RPC.
* `OnTargetDataReadyCallback` attempts to commit cost locally.
* If commit succeeds, applies local spread increase and triggers cosmetic Blueprint events (sound, muzzle flash, tracers, predicted impacts).

This entire sequence happens almost instantaneously on the client, providing responsive feedback while the server works in the background to validate the shot.

***
