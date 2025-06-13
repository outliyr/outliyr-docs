# Projectile Function Library

The `UProjectileFunctionLibrary` provides a set of static, Blueprint-callable utility functions designed to assist with common calculations related to the ShooterBase projectile system, particularly the Merge Point Trajectory.

### Purpose

This library centralizes reusable calculations needed by the projectile system, making the logic cleaner within the abilities (`UGameplayAbility_PredictiveProjectile`) and potentially reusable elsewhere.

### Key Functions

#### `CalculateMergePoint`

* **Signature:** `static FVector CalculateMergePoint(const FVector& CameraLocation, const FVector& EndTrace, const FVector& MuzzleLocation, float ForwardBias)`
* **Purpose:** This is the primary function used to determine the crucial `MergePoint` for the projectile trajectory system. It finds a point on the player's true aiming line (from `CameraLocation` towards `EndTrace`) that serves as the target for the initial curved path originating from the `MuzzleLocation`.
* **Logic:**
  1. Calculates the direction vector (`TraceDir`) from `CameraLocation` to `EndTrace`.
  2. Finds the projection of the vector (`MuzzleLocation - CameraLocation`) onto `TraceDir`. This determines the parameter `t` representing the closest point on the infinite line defined by `CameraLocation` and `TraceDir` to the `MuzzleLocation`.
  3. Clamps `t` between 0.0 and 1.0 to ensure the point lies on the line _segment_ between `CameraLocation` and `EndTrace`.
  4. Calculates the `BaseMergePoint` on the segment using `CameraLocation + t * TraceDir`.
  5. Applies an optional `ForwardBias` along the normalized `TraceDir`. This pushes the merge point slightly further away from the camera along the aiming line.
* **`ForwardBias` Explanation:**
  * This parameter allows fine-tuning _where_ along the aiming line the projectile merges.
  * A value of `0.0` means the merge point is the closest point on the aiming line segment to the muzzle.
  * Positive values shift the merge point forward. This can be useful:
    * To ensure the curve has enough "room" and doesn't feel too abrupt near the player.
    * To slightly delay the merge for slower projectiles, potentially enhancing the visual arc.
  * The optimal `ForwardBias` often depends on the weapon's characteristics (speed, type) and might require tuning per weapon (this value is typically configured on the `UGameplayAbility_PredictiveProjectile` ability).
* **Usage:** Called within `UGameplayAbility_PredictiveProjectile::SpawnProjectile` before spawning the `AProjectileBase` actor to determine the `MergePoint` property for the new projectile.

#### `CalculateVelocityToMerge` (Less Commonly Used with Hermite)

* **Signature:** `static FVector CalculateVelocityToMerge(const FVector& StartPoint, const FVector& MuzzleLocation, const FVector& MergePoint, float MuzzleVelocity)`
* **Purpose:** Calculates the constant velocity vector required for an object starting at `MuzzleLocation` to reach `MergePoint` in the _exact same amount of time_ it would take an object starting at `StartPoint` (usually `CameraLocation`) to reach `MergePoint` traveling at `MuzzleVelocity`. It ignores gravity for this time calculation.
* **Logic:**
  1. Uses the helper `CalculateTimeIgnoringGravity` to find the time (`TimeToMerge`) needed to travel from `StartPoint` to `MergePoint` at `MuzzleVelocity`.
  2. Calculates the direction vector (`MuzzleToMerge`) and distance from `MuzzleLocation` to `MergePoint`.
  3. Determines the `RequiredSpeed` (`Distance / TimeToMerge`).
  4. Returns the normalized `MuzzleToMerge` direction multiplied by the `RequiredSpeed`.
* **Usage Note:** While present, this function is **not** typically used by the default `AProjectileBase` implementation, which favors the Hermite spline curve for smoother visual results. `CalculateVelocityToMerge` might be useful if you were implementing an alternative trajectory system that required matching travel times with a constant velocity segment from the muzzle to the merge point, perhaps for simpler projectile types without curves.

#### `CalculateTimeIgnoringGravity` (Internal Helper)

* **Signature:** `static float CalculateTimeIgnoringGravity(const FVector& StartPoint, const FVector& EndPoint, float Speed)`
* **Purpose:** A simple helper function used by `CalculateVelocityToMerge`.
* **Logic:** Calculates `Distance / Speed` to find the time taken to travel between two points at a constant speed, ignoring any external forces like gravity.

This library provides essential calculations for the Merge Point system, ensuring projectiles behave intuitively and consistently within the ShooterBase framework.

***
