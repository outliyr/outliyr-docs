# Range Weapon Instance

The `ULyraRangedWeaponInstance` class extends `ULyraWeaponInstance` to provide specialized functionality and state management required for most projectile-based or hit-scan ranged weapons. It introduces mechanics for dynamic accuracy (spread/heat) and detailed damage calculation based on distance and hit location.

### Role and Purpose

* **Ranged Combat Specialization:** Provides the runtime state and logic necessary for weapons that fire projectiles or perform trace-based hits.
* **Accuracy Model:** Implements a dynamic spread system influenced by "heat" generated from firing and potentially modified by player stance (standing, crouching, aiming, jumping).
* **Damage Calculation:** Implements `ILyraAbilitySourceInterface` to allow Gameplay Effects (applied by firing abilities) to query the weapon instance for damage attenuation based on distance and physical material properties.
* **Configuration:** Exposes numerous properties (often curves) to allow detailed designer control over spread, heat, recovery, and damage falloff.

### Inheritance

```
UObject
└─ ULyraEquipmentInstance
   └─ ULyraWeaponInstance
      └─ ULyraRangedWeaponInstance
```

It also implements the `ILyraAbilitySourceInterface`. Remember to set the `Instance Type` in the weapon's `ULyraEquipmentDefinition` to this class (or a Blueprint derived from it) for ranged weapons.

<img src=".gitbook/assets/image (144).png" alt="" title="Example of a Pistol Range Weapon Instance">

### Spread & Heat Mechanics

This is a core feature of the ranged instance, simulating dynamic accuracy changes based on firing rate and player actions.

**Core Concepts:**

* **Heat:** An internal float value (`CurrentHeat`) that increases when the weapon fires (`AddSpread` function) and decreases over time when not firing.
* **Spread Angle:** The maximum angle (in degrees, diametrical) by which a shot can deviate from the aiming direction. This angle (`CurrentSpreadAngle`) is directly determined by the `CurrentHeat` using a lookup curve.
* **Curves:** The relationship between heat, spread, heat generation, and cooldown is defined by `FRuntimeFloatCurve` assets:
  * `HeatToSpreadCurve`: Maps `CurrentHeat` (X-axis) to `CurrentSpreadAngle` (Y-axis). Defines the min/max heat range and corresponding min/max spread angles.
  * `HeatToHeatPerShotCurve`: Maps `CurrentHeat` (X-axis) to the amount of heat added _per shot_ (Y-axis). Allows for effects like faster heat buildup when already hot.
  * `HeatToCoolDownPerSecondCurve`: Maps `CurrentHeat` (X-axis) to the rate at which heat decreases per second (Y-axis) after the `SpreadRecoveryCooldownDelay`. Allows for slower cooldown when overheated.
* **Spread Multipliers:** Several factors dynamically adjust the _effective_ spread angle by multiplying `CurrentSpreadAngle`:
  * `SpreadAngleMultiplier_Aiming`: Applied based on aiming camera state (via `ULyraCameraComponent` blend alpha).
  * `SpreadAngleMultiplier_StandingStill`: Applied when pawn speed is below `StandingStillSpeedThreshold`, feathering out up to `StandingStillSpeedThreshold + StandingStillToMovingSpeedRange`. Uses `TransitionRate_StandingStill` for smooth interpolation.
  * `SpreadAngleMultiplier_Crouching`: Applied when the character is crouching. Uses `TransitionRate_Crouching`.
  * `SpreadAngleMultiplier_JumpingOrFalling`: Applied when the character is airborne. Uses `TransitionRate_JumpingOrFalling`.
  * **Combined Multiplier:** These individual multipliers (`StandingStillMultiplier`, `JumpFallMultiplier`, `CrouchingMultiplier`, and the aiming multiplier) are multiplied together to get the final `CurrentSpreadAngleMultiplier`.
* **First-Shot Accuracy:**
  * `bAllowFirstShotAccuracy` (Configurable): If true, enables the possibility of perfect accuracy.
  * `bHasFirstShotAccuracy` (Runtime): Becomes true only if `bAllowFirstShotAccuracy` is enabled AND the weapon is at minimum heat (`CurrentSpreadAngle` is minimal) AND all player state multipliers (`CurrentSpreadAngleMultiplier`) are also at their minimum values (indicating slowest movement, crouching, aiming, etc.). Firing abilities check this flag.
* **Spread Exponent (`SpreadExponent`, also backed by Tag Attribute `TAG_Lyra_RangeWeapon_Stat_SpreadExponent`):** Controls the distribution of shots _within_ the spread cone.
  * `1.0` (Default): Uniform random distribution within the cone.
  * `> 1.0`: Shots cluster more towards the center line.
  * `< 1.0`: Shots cluster more towards the edge of the cone.

**Runtime Logic:**

* **`Tick(float DeltaSeconds)`:** Overridden to:
  * Call `UpdateSpread(DeltaSeconds)`: Handles heat cooldown based on `HeatToCoolDownPerSecondCurve` and `SpreadRecoveryCooldownDelay`. Updates `CurrentSpreadAngle` from `HeatToSpreadCurve`. Returns true if spread is at minimum.
  * Call `UpdateMultipliers(DeltaSeconds)`: Checks pawn movement state (speed, crouching, falling) and camera state (aiming), interpolates the individual multipliers (`StandingStillMultiplier`, etc.), calculates the combined `CurrentSpreadAngleMultiplier`. Returns true if all multipliers are at their minimum beneficial values.
  * Updates `bHasFirstShotAccuracy` based on the results of the above checks and `bAllowFirstShotAccuracy`.
* **`AddSpread()`:** Called by the firing ability after a shot. Increases `CurrentHeat` based on `HeatToHeatPerShotCurve` and immediately updates `CurrentSpreadAngle` based on the new heat.
* **Accessors:** `GetCalculatedSpreadAngle()`, `GetCalculatedSpreadAngleMultiplier()`, `HasFirstShotAccuracy()`, `GetSpreadExponent()` provide the current calculated values for use by firing abilities to determine shot deviation.

### Firing & Damage Configuration

Properties controlling the basic firing output and damage calculation:

* `BulletsPerCartridge` (`int32`): Number of traces/projectiles generated per shot (e.g., 1 for rifles, >1 for shotguns).
* `MaxDamageRange` (`float`, also backed by Tag Attribute `TAG_Lyra_RangeWeapon_Stat_DamageRange`): Maximum distance at which the weapon can deal damage.
* `BulletTraceSweepRadius` (`float`): Radius for trace sweeps (if > 0, uses sphere trace; if 0, uses line trace).

### Damage Calculation (`ILyraAbilitySourceInterface`)

This instance implements `ILyraAbilitySourceInterface` to allow damage-applying Gameplay Effects to query it for damage modifiers.

* `GetDistanceAttenuation(...) const`:
  * Evaluates the `DistanceDamageFalloff` curve (`FRuntimeFloatCurve`) using the provided hit `Distance`.
  * Returns a damage multiplier (typically 1.0 at close range, falling off to lower values or 0 at longer distances). Returns 1.0 if the curve has no data.
* `GetPhysicalMaterialAttenuation(...) const`:
  * Checks the `Tags` property of the hit `UPhysicalMaterial` (requires using `UPhysicalMaterialWithTags`).
  * Compares these tags against the `MaterialDamageMultiplier` map (`TMap<FGameplayTag, float>`).
  * If matching tags are found (e.g., `Gameplay.Zone.Headshot`, `Gameplay.Damage.TypeWeakness.Fire`), it multiplies the corresponding float values from the map together.
  * Returns the combined damage multiplier based on the physical material hit.

**Usage:** A Gameplay Effect used for dealing weapon damage would typically have calculations (like `GameplayEffectExecutionCalculation`) that get the `SourceObje ct` from the Effect Context, cast it to `ILyraAbilitySourceInterface`, call these functions with hit result data, and apply the returned multipliers to the base damage.

***

The `ULyraRangedWeaponInstance` provides a sophisticated foundation for ranged weapons by managing dynamic accuracy through a heat/spread system and offering detailed damage calculation hooks via the `ILyraAbilitySourceInterface`. Its configurable curves and multipliers allow for significant tuning of weapon feel and behavior by designers. Firing abilities will heavily rely on querying the state (spread, multipliers, first-shot accuracy) from this instance before performing traces or spawning projectiles.
