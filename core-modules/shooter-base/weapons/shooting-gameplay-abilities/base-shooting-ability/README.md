# Base Shooting Ability

The `UGameplayAbility_RangedWeapon` class is a fundamental abstract base class within the ShooterBase plugin. It serves as the common ancestor for all Gameplay Abilities designed to initiate firing actions for ranged weapons. By inheriting from `ULyraGameplayAbility_FromEquipment`, it's intrinsically linked to an equipped weapon instance and provides a structured framework for shared ranged weapon logic.

### Purpose and Design

The primary goal of `UGameplayAbility_RangedWeapon` is to centralize common functionalities required by various ranged weapon firing mechanisms (hitscan, projectile, etc.). This avoids code duplication in more specialized ability subclasses and provides a consistent interface.

Its key design aspects include:

* **Abstraction:** As an `Abstract` class, it cannot be used directly. It must be subclassed to implement specific firing behaviors.
* **Weapon Association:** Provides a typed getter (`GetWeaponInstance()`) for easy access to the `ULyraRangedWeaponInstance` associated with the ability.
* **Standard Activation Flow:** Implements the basic GAS activation lifecycle (`CanActivateAbility`, `ActivateAbility`, `EndAbility`), including critical setup like binding the `OnTargetDataReadyCallback` and cleanup.
* **Targeting Framework:** Offers a suite of helper functions (`GetTargetingTransform`, `WeaponTrace`, `DoSingleBulletTrace`) to determine aiming direction and perform world traces.
* **Spread Application:** Includes a utility (`VRandConeNormalDistribution`) for applying weapon spread to trace directions.
* **Hook for Firing Logic:** Defines `StartRangedWeaponTargeting()` as the main virtual function that subclasses override to initiate their unique tracing and target data generation process.
* **Target Data Handling:** Sets up the callback mechanism (`OnTargetDataReadyCallback`) where processed target data (either locally generated or server-validated) is received and acted upon by subclasses.

### Key Functionality Areas

The functionality provided by this base class can be broken down into several key areas, which are detailed in the following sub-pages:

1. **Core Logic & Activation:** Covers the fundamental ability lifecycle, validation, and callback setup.
2. **Targeting System & Tracing:** Details how the ability determines trace origins, directions, and performs world intersection tests.
3. **Spread Calculation:** Explains how weapon spread (from `ULyraRangedWeaponInstance`) is applied to the aiming vector.
4. **Target Data Handling:** Describes how trace results are packaged and managed within the GAS framework using `FGameplayAbilityTargetDataHandle`.

By providing these foundational elements, `UGameplayAbility_RangedWeapon` allows its children (like `UGameplayAbility_RangedWeapon_Hitscan` or `UGameplayAbility_RangedWeapon_Projectile`) to focus on their specific mechanics, such as server-side validation for hitscan or projectile spawning.

***
