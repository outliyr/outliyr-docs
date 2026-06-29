# Customization & Extension

The ShooterBase weapon system, while feature-rich, is designed with flexibility and extensibility in mind. Built upon Lyra's modular framework and GAS, it provides numerous avenues for customization to fit your specific game's needs.

### Creating New Weapon Types

Adding a new weapon generally follows these steps, leveraging the existing systems:

1. **Create Item Definition:** Create a new `ULyraInventoryItemDefinition` (or a subclass) for your weapon in the content browser.
2. **Add Core Fragments:**
   * **`UInventoryFragment_EquippableItem`:** Essential for the item to be handled by the ULyraEquipmentManagerComponent. Configure its `EquipmentDefinition` property.
   * **`UInventoryFragment_Gun`:** **This is required** for the item to be recognized and treated as a firearm by ShooterBase systems (ammo, reload abilities, firing abilities). Configure its properties:
     * `MagazineSize`, `MagazineAmmo` (if not using inventory ammo), `SpareAmmo` (if not using inventory ammo).
     * `bInfiniteMagazineAmmo`, `bInfiniteSpareAmmo` flags.
     * `InventoryAmmoTypes`: Populate this set with compatible `ULyraInventoryItemDefinition` ammo types if your weapon should pull ammo from the player's inventory. Leave empty for traditional integer-based ammo.
   * (Optional) Add other relevant fragments (e.g., for attachments, specific interactions).
3. **Configure Weapon Instance Defaults:**
   * While `UGunWeaponInstance` provides recoil curves, you might want different defaults per weapon. You can either:
     * Create Blueprint subclasses of `UGunWeaponInstance` for specific weapon archetypes (e.g., `WID_GunInstance_Rifle`, `WID_GunInstance_SMG`) and set the recoil curves/parameters there. Reference this BP class as the InstanceType in the `ULyraEquipmentDefinition`.
     * Modify the default `UGunWeaponInstance` values directly if appropriate, but subclassing is generally preferred for better organization.
   * Set the `HeatToSpreadCurve`, `SpreadAngleMultiplier_*`, etc., inherited from `ULyraRangedWeaponInstance`.
4. **Create Equipment Definition:** Create a new `ULyraEquipmentDefinition` (or subclass) referenced by the `UInventoryFragment_EquippableItem`.
   * Set the `InstanceType` to the Equipment Instance you just created (e.g `WID_GunInstance_Rifle`).
   * Configure `EquipmentSlotDetails` for holstered appearance/abilities.
   * Configure `ActiveEquipmentDetails` for held appearance and grant the appropriate **firing Gameplay Ability** (e.g., your `GA_Weapon_Fire_Rifle_Hitscan` asset). Ensure `bCanBeHeld` is true.
5. **Create Firing Gameplay Ability Asset:**
   * Create a Blueprint subclass of the appropriate C++ base (`UGameplayAbility_RangedWeapon_Hitscan`, `_HitScanPenetration`, `_PredictiveProjectile`).
   * Configure ability costs (using `LyraAbilityCost_Ammo` or custom costs), cooldowns, and Gameplay Effects to apply on hit (e.g., `GE_Damage_Bullet_Rifle`).
   * For penetration abilities, configure the `PenetrationSettings` map.
   * For predictive projectiles, configure the `ProjectileClass` to spawn, `MaxLatency`, and `ForwardBias`.
6. **Create Reload Ability Asset (Optional but Recommended):**
   * Create a Blueprint subclass of a reload ability (e.g., `GA_Weapon_Reload_Magazine`).
   * Configure its properties, including montages and potentially the `ReloadStageToMontageSection` map if using staged reloads. Add this ability to the `ActiveEquipmentDetails` of the `ULyraEquipmentDefinition`.
7. **Configure Animations & Visuals:** Set up animation blueprints (using `PickBestAnimLayer`), weapon meshes (spawned via `ActorsToSpawn` in the `ULyraEquipmentDefinition`), particle effects (triggered by abilities), and sound cues.

### Tuning Existing Systems

* **Recoil:** The most direct way to change weapon feel. Adjust the `VerticalRecoilCurve`, `HorizontalRecoilCurve`, recovery speeds, and delay on the `UGunWeaponInstance` (or its BP subclass). Use the TAG_..._Recoil attributes with Gameplay Effects for temporary recoil modifications (e.g., attachments).
* **Spread:** Modify the various `SpreadAngleMultiplier`_... properties and the `HeatToSpreadCurve` on the `ULyraRangedWeaponInstance` portion of your weapon instance defaults/subclass. Adjust the SpreadExponent for distribution.
* **Damage & Effects:** Modify the Gameplay Effects applied by the firing ability (`OnRangedWeaponTargetDataReady`). Create different damage effects for different ammo types or hit locations (using Gameplay Cue parameters or Effect Context).
* **Penetration:** Add/remove entries in the `PenetrationSettings` map of `UGameplayAbility_HitScanPenetration`. Adjust `MaxPenetrations`. Ensure your environment assets have the correct `UPhysicalMaterial` assigned.
* **Projectile Behavior:** Modify the properties on the `ProjectileMovementComponent` within your `AProjectileBase` subclass (speed, gravity, bounce, homing). Add custom logic to the projectile's OnHit events. Adjust `ForwardBias` on the `UGameplayAbility_PredictiveProjectile` for different merge behaviors.
* **Ammo System (`UInventoryFragment_Gun`):** Switch between integer-based and inventory-based ammo by modifying the `InventoryAmmoTypes` set. Adjust `MagazineSize` and initial ammo counts.
* **Staged Reloads:** Utilize the system described in the [`StagedReloadSupport`](gun-fragment/staged-reload-support.md) by adding `GameplayEvent.ReloadStage` tags to your reload animation montages and mapping them in your reload ability.

### Extending the System

The modular design allows for significant extension:

* **Custom Firing Modes:** Create entirely new subclasses of `UGameplayAbility_RangedWeapon` for unique behaviors like:
  * **Charge Weapons:** Hold input to charge, release to fire (potentially varying projectile speed/damage based on charge). Use ability stages or timers.
  * **Beam Weapons:** Apply continuous damage/effects along a trace. Might require custom targeting actors or continuous trace logic within the ability tick.
  * **Burst Fire:** Use timers or looped ability sections within the firing ability to fire multiple shots per activation.
* **Custom Weapon Instances:** If a weapon requires fundamentally different state or logic than recoil/spread (e.g., complex heat management, charge levels), create a new C++ subclass inheriting from `ULyraRangedWeaponInstance` (or even `ULyraWeaponInstance`) and create a new default reference that as the InstanceType.
* **Custom Projectiles:** Subclass `AProjectileBase` to add unique features like area-of-effect damage on impact, status effect application, splitting projectiles, custom movement patterns (after the merge point), etc.
* **Advanced Ammo Costs:** Subclass `ULyraAbilityCost_Ammo` if you need more complex ammo consumption logic than the default (e.g., consuming different ammo types for alternate fire modes, consuming multiple ammo units per shot).
* **New Inventory Fragments:** Add new fragments to items (including weapons) to introduce entirely new systems (e.g., weapon durability, elemental damage types, modification slots beyond standard attachments). Remember to create corresponding `FTransientFragmentData` structs for per-instance runtime data.

By leveraging the fragment system, Gameplay Abilities, and the provided base classes, you can customize and extend the ShooterBase weapon systems substantially to create the specific mechanics your shooter requires. Remember that adding the `UInventoryFragment_Gun` is the first step in making any item function as a firearm within this framework.

***

**Section Complete:** This concludes the documentation for the core ShooterBase Weapon Systems section. You now have a comprehensive overview covering the instance enhancements, projectile system, GAS ability implementations, supporting components, and customization guidelines.
