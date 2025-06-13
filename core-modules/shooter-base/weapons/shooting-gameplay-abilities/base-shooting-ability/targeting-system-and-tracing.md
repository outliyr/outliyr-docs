# Targeting System & Tracing

A fundamental task of any ranged weapon ability is determining _where_ the weapon is aimed and performing traces (line or sphere) to see what, if anything, is hit. `UGameplayAbility_RangedWeapon` provides helper functions and a framework for handling this targeting process.

### Targeting Sources (`ELyraAbilityTargetingSource`)

To accommodate different aiming styles and perspectives, the ability uses an enum to define the origin and orientation of the targeting trace:

* **CameraTowardsFocus:** Starts trace from the player's camera location, aiming towards the center of the screen (standard FPS aiming).
* **PawnForward:** Starts trace from the pawn's center, aiming directly forward based on the pawn's rotation (less common for player weapons, maybe useful for AI or specific mechanics).
* **PawnTowardsFocus:** Starts trace from the pawn's center, but orients it towards the camera's focal point.
* **WeaponForward:** Starts trace from the weapon's muzzle socket (`MuzzleSocketName`), aiming directly forward based on the pawn's rotation (can feel inaccurate if pawn/weapon aren't aligned with camera).
* **WeaponTowardsFocus:** Starts trace from the weapon's muzzle socket (`MuzzleSocketName`), but orients it towards the camera's focal point. **This is commonly used by ShooterBase abilities** as it balances physical origin (muzzle) with intuitive aiming (camera focus), especially when combined with projectile merge points.
* **Custom:** Intended for cases where the trace origin/direction is determined entirely by custom Blueprint or C++ logic within the ability subclass (use discouraged if a standard mode fits).

### Calculating the Targeting Transform (`GetTargetingTransform`)

This crucial protected function determines the starting location and rotation (as an `FTransform`) for the weapon trace based on the specified `ELyraAbilityTargetingSource`.

* **Signature:** `FTransform GetTargetingTransform(APawn* SourcePawn, ShooterBase_RangeWeaponAbility::ELyraAbilityTargetingSource Source) const`
* **Logic:**
  1. Handles different `Source` types:
     * **Focus-Based Sources (`...TowardsFocus`):** Gets the PlayerController (or AIController), finds the camera/control rotation and location. Calculates a `FocalLoc` some distance (`FocalDistance`) along the aiming direction. It then adjusts the effective `CamLoc` to be closer to the pawn/weapon location while still pointing _through_ the original `FocalLoc`, ensuring the aim direction remains consistent with the player's view. For AI, it might use `BaseEyeHeight`. Returns a transform using the calculated camera location and rotation.
     * **WeaponForward:** Calls `GetWeaponTargetingSourceLocation()` to get the muzzle position and combines it with the Pawn's rotation.
     * **PawnForward / Fallback:** Uses the Pawn's actor location and rotation.
  2. Returns the calculated `FTransform`. The X-axis of this transform represents the aiming direction, and the translation represents the trace start point.

### Source Location Helpers

* **`GetWeaponTargetingSourceLocation()`**:
  * Retrieves the world location of the `MuzzleSocketName` (default: "Muzzle") defined on the ability. It finds the currently equipped weapon instance via the `ULyraEquipmentManagerComponent`, gets its spawned visual actor (assuming the first one is the weapon mesh), and queries the socket location on its `USkeletalMeshComponent`. Falls back to the Pawn's location if components aren't found.
* **`GetPawnTargetSourceLocation()`**:
  * Provides a base location on the pawn, typically `Pawn->GetActorLocation()`. Placeholder comments indicate potential future enhancements to offset this based on stance (crouching, etc.).

### Performing Traces

While `GetTargetingTransform` determines the _start_ and _direction_, these helper functions perform the actual world intersection tests:

* **`WeaponTrace`**:
  * **Signature:** `FHitResult WeaponTrace(const FVector& StartTrace, const FVector& EndTrace, float SweepRadius, bool bIsSimulated, OUT TArray<FHitResult>& OutHitResults) const`
  * **Purpose:** Performs the core trace logic, either a line trace or a sphere sweep.
  * **Logic:**
    1. Sets up `FCollisionQueryParams` (`TraceParams`): enables complex traces (`bTraceComplex`), ignores the owning `AvatarActor`, requests physical material return (`bReturnPhysicalMaterial`).
    2. Calls `AddAdditionalTraceIgnoreActors()` to let subclasses potentially ignore more actors (e.g., ignore other characters on the same team).
    3. Calls `DetermineTraceChannel()` to get the appropriate `ECollisionChannel` (e.g., `ECC_Visibility`, `Lyra_TraceChannel_Weapon`).
    4. Performs either `GetWorld()->SweepMultiByChannel` (if `SweepRadius > 0.0f`) or `GetWorld()->LineTraceMultiByChannel`.
    5. Filters the raw `HitResults` into `OutHitResults`, ensuring only one hit per actor is recorded (important for sweeps/multi-traces to prevent multi-damage from one shot).
    6. Returns the most relevant blocking hit (usually the last one after filtering, or a default hit if nothing was struck).
* **`DoSingleBulletTrace`**:
  * **Signature:** `virtual FHitResult DoSingleBulletTrace(const FVector& StartTrace, const FVector& EndTrace, int32 LocalBulletID, float SweepRadius, bool bIsSimulated, OUT TArray<FHitResult>& OutHits) const`
  * **Purpose:** A wrapper around `WeaponTrace` commonly used by subclasses (like Hitscan) to trace a single bullet's path. It handles the logic of potentially trying a line trace first and falling back to a sweep trace if specified.
  * **Logic (Base Implementation):**
    1. Optionally draws debug lines (`DrawDebugLine`) if CVars are enabled.
    2. Calls `WeaponTrace` with `SweepRadius = 0.0f` (line trace).
    3. Checks if a Pawn was hit (`FindFirstPawnHitResult`).
    4. If no Pawn was hit _and_ the weapon instance has a `SweepRadius > 0.0f`, it performs a _second_ `WeaponTrace` using the sweep radius.
    5. It then includes logic to intelligently decide whether to use the sweep results or stick with the initial line trace results, mainly to prevent sweep hits _behind_ an initial blocking line trace hit from overriding the line trace result.
    6. Returns the final determined primary `FHitResult`.
* **`DetermineTraceChannel`**:
  * **Signature:** `virtual ECollisionChannel DetermineTraceChannel(FCollisionQueryParams& TraceParams, bool bIsSimulated) const`
  * **Purpose:** Allows subclasses to specify the collision channel used for traces.
  * **Base Implementation:** Returns `Lyra_TraceChannel_Weapon` (defined in Lyra).
  * **Override Example:** `UGameplayAbility_HitScanPenetration` overrides this to use `Lyra_TraceChannel_Weapon_Multi` to allow tracing through multiple objects.
* **`AddAdditionalTraceIgnoreActors`**:
  * **Signature:** `virtual void AddAdditionalTraceIgnoreActors(FCollisionQueryParams& TraceParams) const`
  * **Purpose:** A hook for subclasses to add more actors to the ignore list for the trace.
  * **Base Implementation:** Ignores the Avatar actor and any actors directly attached to it.

These functions provide a flexible and robust system for determining where a weapon is aimed and what its shots intersect with in the game world. Subclasses utilize these helpers within their `StartRangedWeaponTargeting` implementation.

***
