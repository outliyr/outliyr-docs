# Shooting Gameplay Abilities

The heart of the weapon firing logic in both Lyra and the extended ShooterBase system lies within Unreal Engine's **Gameplay Ability System (GAS)**. This powerful framework allows for modular, data-driven implementation of actions, effects, cooldowns, and costs.

In the context of ShooterBase weapons, GAS is used to define _how_ a weapon fires, handles its targeting, applies effects, and interacts with the network prediction and validation systems.

<img src=".gitbook/assets/image (186).png" alt="" title="Base Shooter Gameplay Abilities in ShooterBase">

### Building on Lyra GAS

ShooterBase weapon abilities inherit from Lyra's foundation:

* **`ULyraGameplayAbility`:** The base class for all abilities in Lyra, providing common functionality.
* **`ULyraGameplayAbility_FromEquipment`:** A specialized Lyra ability subclass designed to be granted by and associated with a `ULyraEquipmentInstance`. This is the direct parent for most ShooterBase weapon firing abilities, providing easy access to the owning weapon instance via `GetAssociatedEquipment()`.

### ShooterBase Ability Structure

ShooterBase provides a hierarchy of abstract and concrete ability classes specifically for ranged weapons:

1. **`UGameplayAbility_RangedWeapon` (Abstract Base):**
   * Establishes the common interface and shared logic for all ranged weapon firing abilities in ShooterBase.
   * Handles activating/ending the ability, binding target data callbacks, basic weapon validation (`GetWeaponInstance`), defining targeting sources, performing traces, and calculating spread.
   * Requires subclasses to implement specific logic for _what to do_ with trace results (e.g., deal hitscan damage, spawn projectiles) and how to handle server validation if needed.
2. **Concrete Firing Mode Abilities:** These inherit from `UGameplayAbility_RangedWeapon` (or other intermediate abilities like the hitscan ones) and implement specific firing behaviors:
   * **`UGameplayAbility_RangedWeapon_Hitscan`:** Implements instant, line-trace-based firing with robust server-side validation using lag compensation.
   * **`UGameplayAbility_HitScanPenetration`:** Extends the hitscan ability to allow bullets to penetrate surfaces based on material properties, including adapted server validation.
   * **`UGameplayAbility_RangedWeapon_Projectile`:** Implements firing logic that results in spawning a projectile actor, but _without_ client-side prediction (server authoritative only).
   * **`UGameplayAbility_PredictiveProjectile`:** The most complex ability, implementing projectile firing _with_ client-side prediction, synchronization, and the merge point trajectory system, using `AProjectileBase`.

### Why Use GAS for Firing?

* **Composition/Modularity:** Each firing mode (hitscan, projectile, penetration) is a self-contained ability asset. You can easily assign different abilities to different weapons.
* **Data-Driven:** Many ability properties (cooldowns, costs, targeting types, effects to apply) can be configured directly in Blueprint subclasses of these C++ bases.
* **Network Integration:** GAS has built-in support for client prediction (`FPredictionKey`, `FScopedPredictionWindow`), server validation, and replicating gameplay events and effects, which ShooterBase leverages heavily.
* **Extensibility:** Adding new firing types (e.g., charge weapons, beam weapons) involves creating new GAS ability subclasses without modifying the core weapon instance classes extensively.

> [!info]
> **Hint:** If you're new to the concept of composition in game development, check out the video [_"Composition Over Inheritance"_](https://www.youtube.com/watch?v=HNzP1aLAffM). It provides a clear explanation of how this approach applies to Object-Oriented Programming in games.

### Key Concepts in ShooterBase Weapon Abilities

* **Targeting:** Abilities define how the weapon aims (camera focus, weapon forward) and perform the necessary traces (line or sphere).
* **Spread:** Abilities query the `ULyraRangedWeaponInstance` for current spread values and apply random deviations to trace directions.
* **Target Data (`FGameplayAbilityTargetDataHandle`)**: Trace results (hit locations, actors, physical materials) are packaged into `FGameplayAbilityTargetData` structures. This data is processed locally and potentially sent to the server for validation or effect application. ShooterBase uses `FLyraGameplayAbilityTargetData_SingleTargetHit` which includes extra info like `Timestamp` (for lag compensation) and `CartridgeID`.
* **Callbacks (`OnTargetDataReadyCallback`)**: A central function hook where abilities receive the results of their targeting/tracing phase and decide how to proceed (e.g., apply effects, send data to server, spawn projectiles).
* **Server Validation:** Hitscan abilities implement logic (`PerformServerSideValidation`) using the Lag Compensation Manager to verify client-reported hits against a rewound server world state.
* **Prediction Keys:** Used extensively to associate client actions with server validation and ensure effects are applied correctly only once.

The following pages will explore each of these ability classes in detail, explaining their specific logic, configuration options, and network interactions.

***
