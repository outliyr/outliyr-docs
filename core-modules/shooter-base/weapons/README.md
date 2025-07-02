# Weapons

This section details the advanced weapon functionalities built upon the core Lyra framework, specifically enhanced within the `ShooterBase` plugin to provide a robust and flexible foundation for your Unreal Engine 5 shooter project.

While Lyra offers a solid starting point for equipment and basic weapon handling, ShooterBase introduces several critical features and refinements essential for creating compelling, modern shooter experiences, particularly in networked environments. Our goal is to provide you with powerful, production-ready tools that handle complex mechanics like predictive recoil, client-predicted projectiles, and validated hit registration, allowing you to focus on crafting unique gameplay.

### Building on a Solid Foundation

This weapon system leverages and extends several core concepts from Lyra, including:

* **Lyra Equipment System:** Weapons are treated as `ULyraEquipmentInstance` objects managed by the `ULyraEquipmentManagerComponent`. We utilize the concepts of Equipment Definitions, Holstered/Held states, and Ability Set granting. (It's assumed you have a basic understanding of these from base Lyra documentation).
* **Gameplay Ability System (GAS):** Firing logic, cooldowns, and weapon effects are primarily implemented as Gameplay Abilities (`ULyraGameplayAbility_FromEquipment` derivatives), promoting a modular and data-driven approach.
* **Weapon State Component:** Lyra's `ULyraWeaponStateComponent` is extended (`UWeaponStateComponent`) to handle specific needs for projectile hit confirmation.

### Key ShooterBase Enhancements

ShooterBase significantly enhances the weapon system with the following core features, which will be detailed in this section:

1. **Predictive Recoil (`UGunWeaponInstance`):** A sophisticated recoil system featuring configurable, curve-based patterns for both vertical and horizontal recoil. It includes smooth interpolation, recovery mechanics, and crucially, accounts for player recoil compensation, providing a responsive and predictable feel even over networks.
2. **Advanced Projectile Handling (`AProjectileBase`):** A base projectile class designed for network play, featuring:
   * **Client-Side Prediction:** Hides latency by spawning fake projectiles locally while synchronizing with server-authoritative ones.
   * **Merge Point Trajectory:** Solves the common visual disconnect between camera aim and muzzle location by smoothly guiding projectiles from the muzzle onto the true camera aim path using a Hermite spline curve.
3. **Robust Hitscan Implementation:**
   * **Server-Side Validation:** Utilizes the integrated Lag Compensation system to perform authoritative hit validation on the server, preventing client-side cheating for hitscan weapons.
   * **Penetration System:** An optional hitscan ability (`UGameplayAbility_HitScanPenetration`) allows bullets to penetrate materials based on configurable physical material properties (depth, angle, damage reduction).
4. **Specialized Firing Abilities (GAS):** Provides clear, well-structured examples of Gameplay Abilities for different firing types:
   * `UGameplayAbility_RangedWeapon_Hitscan`
   * `UGameplayAbility_HitScanPenetration`
   * `UGameplayAbility_RangedWeapon_Projectile`
   * `UGameplayAbility_PredictiveProjectile`

### Core Design Philosophy

The ShooterBase weapon system is built with these principles in mind:

* **Composition over Inheritance:** Weapon functionality is primarily added through distinct GAS abilities, allowing you to mix and match firing modes easily without complex inheritance chains.
* **Network First:** Features like predictive recoil and projectile spawning are designed from the ground up to feel responsive and look correct in multiplayer environments. Hitscan validation ensures fairness.
* **Flexibility and Generality:** While providing advanced features, the system aims to be a generic foundation. It offers powerful tools without rigidly dictating your specific weapon balance or feel. You configure the curves, parameters, and abilities to match your game's needs.
* **Clarity and Extensibility:** Code is structured logically, and key components (like recoil, projectiles, abilities) are separated to make understanding, modification, and extension straightforward.

> [!info]
> **Hint:** If you're new to the concept of composition in game development, check out the video [_"Composition Over Inheritance"_](https://www.youtube.com/watch?v=HNzP1aLAffM). It provides a clear explanation of how this approach applies to Object-Oriented Programming in games.

### What You'll Learn

Throughout this section, you will learn how to:

* Configure and tune the predictive recoil system.
* Understand and utilize the projectile prediction and merge point trajectory system.
* Implement and customize hitscan abilities, including penetration.
* Leverage the provided GAS abilities as a base for your own weapon behaviors.
* Extend the system with new weapon types and firing modes.

We believe these enhancements provide a significant advantage, empowering you to build sophisticated and satisfying weapon mechanics for your shooter project. Let's dive into the specifics!

***
