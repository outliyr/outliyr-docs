# Reticle Fragment

To provide appropriate aiming feedback to the player, weapons often require different User Interface **reticles** (crosshairs) depending on the weapon type and potentially its current state (hip fire vs. aiming down sights). The `UInventoryFragment_ReticleConfig` provides a simple, data-driven way to associate specific reticle widget classes with a weapon's definition.

### Purpose

* **Link Definition to UI:** Connects a `ULyraInventoryItemDefinition` (representing a weapon) to one or more `ULyraReticleWidgetBase` Blueprint classes.
* **Data-Driven Reticles:** Allows designers to easily assign different reticle UIs to different weapons by modifying the Item Definition asset, without changing UI logic code directly.
* **Support Multiple Reticles:** Enables associating several reticle widgets with a single weapon, allowing UI systems to potentially switch between them based on gameplay state (e.g., a hip-fire reticle vs. an ADS reticle).

### Static Configuration (`UInventoryFragment_ReticleConfig`)

This is a straightforward fragment holding only static configuration data.

1. **Add Fragment:** Add `InventoryFragment_ReticleConfig` to the weapon's `ULyraInventoryItemDefinition` asset in the `Fragments` array.
2. **Key Property:**
   * **`Reticle Widgets` (`TArray<TSubclassOf<ULyraReticleWidgetBase>>`)**: An array where you specify the Blueprint Widget classes (which **must** inherit from `ULyraReticleWidgetBase`) that are associated with this weapon. You can add multiple entries if the weapon supports different reticle states that are handled by distinct widget classes. The order might be relevant depending on how the UI system consuming this data interprets it (e.g., index 0 for hip-fire, index 1 for ADS).

_Example Configuration (`ID_Rifle_Standard`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_ReticleConfig`
    * `Reticle Widgets`:
      * `[0]`: `WBP_Reticle_Crosshair` (A widget blueprint for the standard crosshair)
      * `[1]`: `WBP_Reticle_DotSight` (A widget blueprint for when aiming down sights, perhaps empty if ADS uses weapon optics directly)

_Example Configuration (`ID_Shotgun_Pump`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_ReticleConfig`
    * `Reticle Widgets`:
      * `[0]`: `WBP_Reticle_ShotgunSpread` (A custom widget showing spread pattern)

### Runtime Interaction (UI / Reticle Manager System)

This fragment primarily serves as a data source for a UI system responsible for managing and displaying the player's reticle. The workflow typically looks like this:

1. **Weapon Equip/Hold:** The player equips and holds a weapon. The `ULyraEquipmentManagerComponent` updates its state.
2. **UI Notification:** A UI Manager or the main HUD widget is notified that the player's held weapon has changed (potentially via Gameplay Messages like `TAG_Lyra_Equipment_Message_EquipmentChanged` or by monitoring the Equipment Manager directly if appropriate).
3. **Get Held Weapon Instance:** The UI system gets the currently held `ULyraEquipmentInstance` and verifies it's a weapon (e.g., casts to `ULyraWeaponInstance`).
4.  **Find Reticle Fragment:** It accesses the weapon's `ULyraInventoryItemInstance` (via `WeaponInstance->GetInstigator()`) and then finds the `InventoryFragment_ReticleConfig` on its definition:

    ```cpp
    // Assuming 'HeldWeaponInstance' is the ULyraWeaponInstance*
    ULyraInventoryItemInstance* ItemInstance = Cast<ULyraInventoryItemInstance>(HeldWeaponInstance->GetInstigator());
    const UInventoryFragment_ReticleConfig* ReticleFragment = ItemInstance ? ItemInstance->FindFragmentByClass<UInventoryFragment_ReticleConfig>() : nullptr;
    ```
5. **Instantiate/Switch Reticles:**
   * If `ReticleFragment` is found:
     * The UI system reads the `ReticleWidgets` array.
     * Based on the current game state (e.g., is the player aiming? Is it hip-fire?), it selects the appropriate `TSubclassOf<ULyraReticleWidgetBase>` from the array (e.g., index 0 for hip-fire, index 1 for ADS, or potentially using tags associated with the widgets).
     * It destroys any previously displayed reticle widget.
     * It creates an instance of the selected reticle widget class and adds it to the player's viewport.
   * If `ReticleFragment` is _not_ found, the UI system might display a default reticle or no reticle at all.
6. **Reticle Updates:** The active `ULyraReticleWidgetBase` instance itself would then typically run its own logic to update its appearance based on weapon state (e.g., reading spread from `ULyraRangedWeaponInstance` to adjust crosshair size, reading hit markers from `ULyraWeaponStateComponent` to display hits).

### Importance

* Provides a clear, data-driven link between weapon definitions and their corresponding UI reticles.
* Decouples specific reticle widget choices from the core UI framework code.
* Allows designers to easily assign and change reticles by modifying Data Assets.

***

The `InventoryFragment_ReticleConfig` offers a straightforward method to associate UI reticle widgets with specific weapon definitions. A robust UI or HUD system can then query this fragment on the currently equipped weapon to dynamically display the correct aiming interface for the player.
