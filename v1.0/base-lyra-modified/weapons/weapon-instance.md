# Weapon Instance

The `ULyraWeaponInstance` serves as the **base runtime class** for all weapon equipment within the system. It inherits directly from `ULyraEquipmentInstance`, gaining all the standard equipment functionality (lifecycle events, instigator tracking, attribute container, subobject replication), and adds features specifically relevant to wieldable weapons.

### Role and Purpose

* **Foundation for Weapons:** Provides common functionality expected from most weapon types (melee or ranged).
* **Extends Equipment:** Builds upon the `ULyraEquipmentInstance` base, ensuring weapons integrate seamlessly with the equipment management and GAS granting mechanisms.
* **Animation Control:** Manages selection of appropriate Animation Layers based on the weapon's equipped state and cosmetic tags.
* **Input Device Feedback:** Handles applying and removing platform-specific input device properties (like controller vibration or adaptive triggers) while the weapon is equipped.
* **Interaction Timing:** Tracks when the weapon was last equipped and fired, potentially useful for idle animations or other time-sensitive logic.

### Inheritance

```
UObject
└─ ULyraEquipmentInstance
   └─ ULyraWeaponInstance
      └─ ULyraRangedWeaponInstance (Covered on next page)
```

Because it inherits from `ULyraEquipmentInstance`, you configure which specific `ULyraWeaponInstance` subclass (or this base class itself if sufficient) to spawn using the **`Instance Type`** property within the weapon's corresponding `ULyraEquipmentDefinition` asset.

### Key Added Features

Compared to the base `ULyraEquipmentInstance`, `ULyraWeaponInstance` adds:

1. **Animation Layer Selection:**
   * `EquippedAnimSet` (`FLyraAnimLayerSelectionSet`): A data structure (likely containing mappings of Gameplay Tags to Animation Layer Interface classes) defining animation layers to apply when the weapon is **actively held**.
   * `UneuippedAnimSet` (`FLyraAnimLayerSelectionSet`): Defines animation layers to apply when the weapon is **equipped but not held** (i.e., Holstered, although often weapons might not have specific holstered anim layers distinct from the base locomotion).
   * `PickBestAnimLayer(bool bEquipped, const FGameplayTagContainer& CosmeticTags) const`: A function (callable from animation blueprints or character logic) that evaluates the appropriate `SelectionSet` (`EquippedAnimSet` or `UneuippedAnimSet`) against provided cosmetic tags (e.g., `Weapon.Material.Wood`, `Weapon.Sight.Iron`) to select the best matching `TSubclassOf<UAnimInstance>` (Animation Layer Interface) to apply. This allows weapon animations to vary based on cosmetic choices or states represented by tags.
2. **Input Device Properties:**
   * `ApplicableDeviceProperties` (`TArray<TObjectPtr<UInputDeviceProperty>>`): An array configured in derived Blueprint classes (or C++ defaults). It holds references to `UInputDeviceProperty` assets (like `InputDeviceTriggerFeedbackProperty`, `InputDeviceVibrationProperty`).
   * `ApplyDeviceProperties()`: Called internally during `OnEquipped`. Iterates through `ApplicableDeviceProperties` and activates them on the owning player's input device (using `UInputDeviceSubsystem`) in **looping mode**. This ensures effects like trigger resistance or idle vibrations persist while the weapon is held. Stores handles to the activated properties.
   * `RemoveDeviceProperties()`: Called internally during `OnUnequipped` (and `OnDeathStarted`). Uses the stored handles to deactivate any looping device properties that were applied by this weapon instance.
3. **Interaction Timing:**
   * `TimeLastEquipped` (`double`): Stores the `WorldTimeSeconds` when `OnEquipped` was last called.
   * `TimeLastFired` (`double`): Stores the `WorldTimeSeconds` when `UpdateFiringTime()` was last called.
   * `UpdateFiringTime()`: A simple function meant to be called by the weapon's firing Gameplay Ability upon successful firing execution to update `TimeLastFired`.
   * `GetTimeSinceLastInteractedWith() const`: Calculates and returns the minimum time elapsed since the weapon was either equipped (`TimeLastEquipped`) or fired (`TimeLastFired`). Useful for triggering idle animations or weapon lowering logic after a period of inactivity.
4. **Death Handling:**
   * `OnDeathStarted(AActor* OwningActor)`: A function bound (in the constructor) to the `OnDeathStarted` delegate of the owning Pawn's `ULyraHealthComponent` (if found and player-controlled).
   * **Purpose:** Ensures that if the owning player dies while holding the weapon, any active `ApplicableDeviceProperties` (like looping vibrations) are cleanly removed via `RemoveDeviceProperties()`. Prevents lingering haptic effects after death.
5. **Tick Function:**
   * `Tick(float DeltaSeconds)`: A virtual tick function. While the base implementation is empty, it allows derived classes (like `ULyraRangedWeaponInstance`) to implement per-frame logic. Note that the `ULyraWeaponStateComponent` often drives the call to this `Tick` function for the currently held weapon.

### Overridden Lifecycle Functions

* `OnEquipped()`: Calls `Super::OnEquipped`, updates `TimeLastEquipped`, and calls `ApplyDeviceProperties()`.
* `OnUnequipped()`: Calls `Super::OnUnequipped` and calls `RemoveDeviceProperties()`.

### Customization

* **Blueprint Subclassing:** Create Blueprints derived from `ULyraWeaponInstance` for specific weapon types that don't need complex C++ logic but might require unique configurations of `ApplicableDeviceProperties` or simple Blueprint logic in the `K2_` lifecycle events. Remember to set the `Instance Type` in the `ULyraEquipmentDefinition`.
* **C++ Subclassing:** Create C++ classes derived from `ULyraWeaponInstance` (like `ULyraRangedWeaponInstance`) for weapons requiring more complex state management, custom C++ functions, or specific interfaces.

***

`ULyraWeaponInstance` provides essential weapon-centric extensions to the base equipment instance, handling animations, input device feedback, and basic interaction timing. It serves as the direct parent for more specialized weapon types like `ULyraRangedWeaponInstance`.
