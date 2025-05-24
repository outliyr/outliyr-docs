---
description: Weapon Instance Enhancements (UGunWeaponInstance)
---

# Gun Weapon Instance

While `ULyraRangedWeaponInstance` provides the base functionality for ranged weapons (like spread calculation, damage falloff, etc.), the `UGunWeaponInstance` class, specific to the ShooterBase plugin, extends this foundation to incorporate features commonly associated with firearms. Its primary and most significant addition is the **Predictive Recoil System**.

This class serves as the recommended base for most conventional guns (rifles, pistols, SMGs, LMGs) within your project if you desire sophisticated, pattern-based recoil.

```cpp
// Header: GunWeaponInstance.h
// Extends: ULyraRangedWeaponInstance

UCLASS(MinimalAPI, BlueprintType)
class UGunWeaponInstance : public ULyraRangedWeaponInstance
{
    // ... Recoil properties and functions ...
};
```

### Predictive Recoil System

Modern shooters often feature intricate recoil patterns that reward player skill and muscle memory. The ShooterBase Predictive Recoil system is designed to deliver this, providing a visually smooth and predictable recoil experience for the player firing the weapon, even under network latency.

#### Concept

The core idea is to:

1. **Define Patterns:** Use curves to define the vertical and horizontal "kick" for each consecutive shot in a burst.
2. **Interpolate Smoothly:** Instead of instantly snapping the camera, smoothly interpolate the camera movement over a short duration corresponding to the weapon's fire rate, making the recoil feel less jarring.
3. **Recover Naturally:** After firing stops, smoothly return the camera towards its original position, but intelligently account for any adjustments the player made _during_ the recoil burst to counteract it.
4. **Client-Focused:** Recoil application primarily happens on the client triggering the shot for maximum responsiveness. The server validates the firing action itself, but the visual recoil is driven client-side based on firing events.

#### Configuration

You configure the recoil behavior primarily through properties on the `UGunWeaponInstance` (or its Blueprint subclasses):

* **`VerticalRecoilCurve` (`FRuntimeFloatCurve`)**:
  * Defines the **vertical** camera rotation applied per shot.
  * **X-axis:** Represents the consecutive shot number in a burst (e.g., X=1 is the first shot, X=5 is the fifth shot). Use whole numbers on the X-axis.
  * **Y-axis:** The amount of vertical rotation (Pitch) in degrees. Positive values kick upwards, negative values downwards.
  * _Example:_ A curve starting at Y=2, increasing to Y=5 by X=10, then leveling off, would mean increasing vertical kick for the first 10 shots.
* **`HorizontalRecoilCurve` (`FRuntimeFloatCurve`)**:
  * Defines the **horizontal** camera rotation applied per shot.
  * **X-axis:** Same as `VerticalRecoilCurve` (consecutive shot number).
  * **Y-axis:** The amount of horizontal rotation (Yaw) in degrees. Positive values kick right, negative values kick left.
  * _Example:_ A curve alternating between Y=1 and Y=-1 could create a side-to-side recoil pattern.
* **`RecoilRecoveryDelay` (`float`)**:
  * The time (in seconds) after the _last shot_ before the recoil recovery process begins. Allows for a brief pause before the weapon settles.
* **`RecoilRecoverVerticalSpeed` (`float`)**:
  * How quickly (in degrees per second) the vertical recoil recovers.
* **`RecoilRecoverHorizontalSpeed` (`float`)**:
  * How quickly (in degrees per second) the horizontal recoil recovers.
* **`RecoilRecoverStepTime` (`float`)**:
  * The time interval (in seconds) for each step of the recovery process (default `0.01`). Determines the smoothness of the recovery interpolation.
* **Attribute Tags:**
  * `TAG_Lyra_RangeWeapon_Gun_Stat_VerticalRecoil`
  * `TAG_Lyra_RangeWeapon_Gun_Stat_HorizontalRecoil`
  * These tags (defined in `LyraEquipmentInstance` and added in `UGunWeaponInstance` constructor) allow base recoil values from curves to be modified by gameplay effects or other attribute modifiers (e.g., attachments reducing recoil). The curves provide the pattern, attributes provide multipliers.

#### Implementation Details

Understanding how the system works internally helps with tuning and debugging:

1. **Triggering Recoil (`AddRecoil`)**:
   * Called by the firing Gameplay Ability (e.g., `UGameplayAbility_RangedWeapon_Hitscan`) after a successful shot.
   * `StopRecoilRecovery()`: Immediately halts any ongoing recovery process.
   * `TrackPlayerRecoilCompensation()`: Records the player's aiming adjustments _before_ applying the new recoil kick (critical for recovery).
   * Calculates `RecoilInterpolationDuration` based on the weapon's `FireRate` (clamped between `Min/MaxRecoilInterpolationDuration`) – determines how long the smooth kick takes.
   * Calls `UpdateRecoil()` to calculate and start the interpolation for the current shot.
2. **Calculating Recoil (`UpdateRecoil`, `CalculateRecoil`)**:
   * Increments `RecoilIntSteps` (the current shot number in the burst).
   * `CalculateRecoil()`: Evaluates `VerticalRecoilCurve` and `HorizontalRecoilCurve` at the current `RecoilIntSteps` to get the base kick values. Applies attribute multipliers (`GetTagAttributeValue`).
   * Sets `DesiredVerticalRecoil` and `DesiredHorizontalRecoil` to the calculated target values for this shot's kick.
   * Resets `PreviousVerticalRecoil`/`PreviousHorizontalRecoil` to 0, resets `RecoilInterpolationTime`.
   * Starts the `RecoilTimer` which calls `UpdateRecoilInterpolation` repeatedly.
3. **Recoil Interpolation (`UpdateRecoilInterpolation`)**:
   * Called repeatedly by the `RecoilTimer`.
   * Calculates the interpolation alpha (`InterpolationAlpha`) based on `RecoilInterpolationTime` and `RecoilInterpolationDuration`.
   * Calculates the `CurrentVerticalRecoil` and `CurrentHorizontalRecoil` using `FMath::Lerp` between `Previous` and `Desired` values.
   * Calculates the _delta_ (change since last tick) for vertical and horizontal recoil.
   * `ApplyRecoilToCamera()`: Applies the calculated _delta_ to the Pawn's Controller rotation.
   * Updates `RecoilRecoverVerticalValue` and `RecoilRecoverHorizontalValue` (the total accumulated offset that needs recovery).
   * Updates `PreviousVerticalRecoil`/`HorizontalRecoil` for the next interpolation step.
   * Stops the timer when `InterpolationAlpha` reaches 1.0.
4. **Applying Recoil (`ApplyRecoilToCamera`)**:
   * Gets the Pawn and its Controller.
   * Adds the provided vertical (Pitch) and horizontal (Yaw) recoil amounts directly to the Controller's Control Rotation.
5. **Recoil Recovery (`WaitForRecoilRecoveryDelay`, `StartRecoilRecovery`, `UpdateRecoilRecovery`)**:
   * The firing ability calls `WaitForRecoilRecoveryDelay` after firing stops.
   * This function starts a timer based on `RecoilRecoveryDelay`.
   * `StartRecoilRecovery()`: Called after the delay. It performs one final `TrackPlayerRecoilCompensation()` check. Crucially, it adjusts `RecoilRecoverVerticalValue` based on `RecoilRecoverVerticalDirection` (player's compensation) to prevent over-recovery. Starts the `RecoilRecoverTimer` which calls `UpdateRecoilRecovery`.
   * `UpdateRecoilRecovery()`: Called repeatedly by the `RecoilRecoverTimer`. Calculates the `RecoilRecoverVerticalStepValue` and `RecoilRecoverHorizontalStepValue` based on recovery speeds and `RecoilRecoverStepTime`. Decrements the `RecoilRecoverVerticalValue` and `RecoilRecoverHorizontalValue`. Applies the _negative_ step values using `ApplyRecoilToCamera` to move the aim back. Stops when accumulated values reach near zero.
6. **Player Compensation Tracking (`TrackPlayerRecoilCompensation`)**:
   * This is key to natural recovery. It compares the current aim pitch (`ControlRotation.Pitch`) with the pitch recorded during the previous track (`RecoilRecoverPitch`).
   * The difference is accumulated in `RecoilRecoverVerticalDirection`. This value represents how much the _player_ has manually pulled down (or moved vertically) during the recoil phase.
   * In `StartRecoilRecovery`, the total vertical offset needing recovery (`RecoilRecoverVerticalValue`) is potentially reduced by the player's compensation amount (`RecoilRecoverVerticalDirection`), ensuring the recovery doesn't fight the player's intentional adjustments.
7. **State Management & Cleanup (`ResetRecoilRecoveryValues`, `StopRecoilRecovery`, `OnUnequipped`)**:
   * `ResetRecoilRecoveryValues()`: Clears all accumulated recoil offsets, compensation tracking, and resets `RecoilIntSteps` when recovery is fully complete.
   * `StopRecoilRecovery()`: Clears the recovery timer if a new shot is fired during recovery.
   * `OnUnequipped()`: Ensures timers are cleared when the weapon is no longer equipped.

#### Network Considerations

* The recoil calculation and application (`ApplyRecoilToCamera`) occur on the **owning client** that fires the weapon. This ensures maximum visual responsiveness.
* The server doesn't need to replicate the exact camera rotation caused by recoil frame-by-frame. It validates the _firing event_ itself (via GAS).
* The state needed to calculate recoil (like `RecoilIntSteps`, which implicitly tracks consecutive shots) is driven by the client's firing actions, which are initiated via Gameplay Abilities that handle server communication and validation.

#### Customization

* **Weapon Feel:** The primary way to customize is by editing the `VerticalRecoilCurve` and `HorizontalRecoilCurve`. Create distinct patterns for different weapon archetypes.
* **Intensity:** Adjust the Y-axis scale of the curves and the `TAG_..._Recoil` attribute modifiers.
* **Recovery Speed:** Tune `RecoilRecoveryDelay`, `RecoilRecoverVerticalSpeed`, and `RecoilRecoverHorizontalSpeed` to control how quickly the weapon settles after firing. Faster recovery might suit SMGs, while slower recovery fits heavier weapons.
* **Smoothness:** The interpolation duration (derived from fire rate) and `RecoilRecoverStepTime` affect smoothness. Lower step times lead to smoother but potentially more performance-intensive recovery.

By understanding and configuring these elements, you can create nuanced and satisfying recoil behaviors for the firearms in your game using the `UGunWeaponInstance`.

***

**Next Steps:**

* The next page should cover the **"Projectile System (`AProjectileBase` & `UProjectileFunctionLibrary`)"**, detailing the base projectile actor and the merge point calculations.
