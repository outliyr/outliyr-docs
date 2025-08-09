# Spread Calculation

Accuracy is rarely perfect in shooters. Weapon spread introduces a degree of randomness to shot placement, simulating weapon inaccuracy that can vary based on movement, firing rate (heat), aiming state, and more. The `UGameplayAbility_RangedWeapon` interacts with the associated `ULyraRangedWeaponInstance` to apply this spread dynamically during the targeting phase.

### Acquiring Spread Data

The ability itself doesn't store or calculate the _current_ spread values. Instead, it queries the currently equipped `ULyraRangedWeaponInstance` (obtained via `GetWeaponInstance()`) which continuously calculates its state based on various factors:

* **Heat:** Firing shots increases heat, which typically increases spread (defined by `HeatToSpreadCurve` on the weapon instance). Heat cools down over time (`HeatToCoolDownPerSecondCurve`).
* **Movement:** Player speed affects spread (via `SpreadAngleMultiplier_StandingStill`, `StandingStillSpeedThreshold`, etc.).
* **Stance:** Jumping/falling (`SpreadAngleMultiplier_JumpingOrFalling`) and crouching (`SpreadAngleMultiplier_Crouching`) apply multipliers.
* **Aiming:** Being in an aiming camera mode (`SpreadAngleMultiplier_Aiming`) usually reduces spread.
* **First-Shot Accuracy:** Some weapons might have perfect accuracy (`bAllowFirstShotAccuracy`) for the very first shot if conditions are met (low heat, minimal multipliers).

The `ULyraRangedWeaponInstance::Tick()` function constantly updates these values, resulting in:

* **`GetCalculatedSpreadAngle()`:** Returns the current base spread angle (in degrees) based on the weapon's heat level via the `HeatToSpreadCurve`.
* **`GetCalculatedSpreadAngleMultiplier()`:** Returns the combined multiplier based on aiming, movement, stance, etc. Note that this returns `0.0f` if `HasFirstShotAccuracy()` is true.
* **`GetSpreadExponent()`:** Returns a value affecting the _distribution_ of shots within the spread cone. Higher exponents cluster shots more towards the center.

**(Refer to the Lyra documentation or your previous notes on** [**`ULyraRangedWeaponInstance`**](../../../../../base-lyra-modified/weapons/range-weapon-instance.md) **for the full details of how these values are calculated within the weapon instance itself).**

### Applying Spread (`VRandConeNormalDistribution`)

When the ability performs its targeting trace (typically within the `TraceBulletsInCartridge` implementation of a subclass like Hitscan or Projectile), it needs to apply the calculated spread to the base aiming direction. This is done using the `VRandConeNormalDistribution` helper function:

* **Signature:** `FVector VRandConeNormalDistribution(const FVector& Dir, const float ConeHalfAngleRad, const float Exponent) const`
* **Purpose:** Generates a random vector direction within a cone defined by a central direction (`Dir`) and a maximum angle (`ConeHalfAngleRad`), using an exponent (`Exponent`) to control the probability distribution within that cone.
* **Parameters:**
  * `Dir`: The base aiming direction (e.g., the X-axis of the transform from `GetTargetingTransform`).
  * `ConeHalfAngleRad`: The maximum spread angle _from the center line_, converted to radians. Calculated as `FMath::DegreesToRadians(ActualSpreadAngle * 0.5f)`.
  * `Exponent`: The spread exponent obtained from `WeaponData->GetSpreadExponent()`.
* **Logic:**
  1. Checks if `ConeHalfAngleRad` is greater than 0. If not (perfect accuracy), it simply returns the normalized `Dir`.
  2. Calculates two random angles:
     * `AngleFromCenter`: Determines how far _away_ from the center line (`Dir`) the random direction will deviate. This is calculated using `FMath::Pow(FMath::FRand(), Exponent) * ConeHalfAngleDegrees`. The `Exponent` biases this random number:
       * Exponent = 1.0: Uniform distribution within the cone angle.
       * Exponent > 1.0: Shots are more likely to be closer to the center line (tighter cluster).
       * Exponent < 1.0: Shots are more likely to be closer to the edge of the cone.
     * `AngleAround`: Determines the rotation _around_ the center line (`Dir`), chosen uniformly between 0 and 360 degrees (`FMath::FRand() * 360.0f`).
  3. Constructs three Quaternions:
     * `DirQuat`: Represents the base aiming direction.
     * `FromCenterQuat`: Represents the rotation away from the center line by `AngleFromCenter`.
     * `AroundQuat`: Represents the rotation around the center line by `AngleAround`.
  4. Combines these rotations: `FinalDirectionQuat = DirQuat * AroundQuat * FromCenterQuat`. This effectively applies the deviation _around_ the aiming axis first, then rotates _away_ from it.
  5. Normalizes the final quaternion and rotates the forward vector (`FVector::ForwardVector`) by it to get the final, randomized direction vector.
*   **Usage:**

    ```cpp
    // Inside a function like TraceBulletsInCartridge:
    ULyraRangedWeaponInstance* WeaponData = GetWeaponInstance();
    // ... get InputData.AimDir ...

    const float BaseSpreadAngle = WeaponData->GetCalculatedSpreadAngle();
    const float SpreadAngleMultiplier = WeaponData->GetCalculatedSpreadAngleMultiplier();
    const float ActualSpreadAngle = BaseSpreadAngle * SpreadAngleMultiplier;
    const float HalfSpreadAngleInRadians = FMath::DegreesToRadians(ActualSpreadAngle * 0.5f);

    // Get the randomized direction with spread applied
    const FVector BulletDir = VRandConeNormalDistribution(
        InputData.AimDir,
        HalfSpreadAngleInRadians,
        WeaponData->GetSpreadExponent()
        );

    // Calculate the end trace using the randomized BulletDir
    const FVector EndTrace = InputData.StartTrace + (BulletDir * WeaponData->GetMaxDamageRange());

    // Perform the trace using StartTrace and EndTrace...
    ```

By querying the weapon instance for the current spread parameters and applying them using `VRandConeNormalDistribution`, the `UGameplayAbility_RangedWeapon` ensures that shots dynamically reflect the weapon's current accuracy state.

***
