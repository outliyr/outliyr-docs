# Advanced Ammo System

This section explains how to extend the GunFragment system for advanced or custom behaviors, such as staged reloads, mixed ammunition types, and inventory-based ammo consumption.

This system is flexible by design and is driven by gameplay ability logic and transient data. It supports both traditional shooters and inventory-focused titles.

***

### Mixed Ammo Support

The `MagazineAmmo` array in `FTransientFragmentData_Gun` supports multiple ammo types within a single magazine. This enables scenarios like:

* Loading different ammo types into the same weapon (e.g., tracer + armor-piercing)
* Designing weapons that consume specific ammo types for different firing modes
* Visual or mechanical feedback based on ammo type (e.g., colored tracers)

#### Example Usage

```cpp
FMagazineAmmoData Slot;
Slot.AmmoType = ULyraAmmo_AP::StaticClass();  // Armor-piercing
Slot.Count = 10;
GunData.MagazineAmmo.Add(Slot);
```

***

### LastFiredAmmoTypes

This field stores the last ammo type consumed, allowing abilities (e.g., firing, recoil, visual effects) to reference what kind of round was fired.

> Note: Only a **single ammo type is recorded per shot**. For shotguns or other multi-projectile weapons, this still works fine, but multi-ammo-type-per-shot is not natively supported. If needed, extend the system or override the firing ability.

***

### Inventory-Based Ammo

If `InventoryAmmoTypes` is populated, the gun pulls ammunition directly from the player’s inventory using `ULyraInventoryItemDefinition` references. The actual consumption logic during firing is handled by the assigned Gameplay Ability Cost, typically [`ULyraAbilityCost_Ammo`](../shooting-gameplay-abilities/ammo-cost.md) .

.This allows for:

* Realistic ammo tracking across multiple weapons
* Support for loot-based shooters or survival gameplay
* Full control over ammo types, rarity, stack size, effects

#### Tips

* Make sure the ammo items exist in the inventory before reloading or firing.
* Use gameplay abilities or costs (e.g., `LyraAbilityCost_Ammo`) to consume ammo properly.
* Customize `LyraAbilityCost_Ammo` if you want to support complex consumption behavior (e.g., alternating types, burst usage, split loads).

***

### Infinite Ammo Flags

Set the following flags to modify ammo behavior:

| Property                | Effect                                               |
| ----------------------- | ---------------------------------------------------- |
| `bInfiniteMagazineAmmo` | Magazine is always full; reloading is bypassed       |
| `bInfiniteSpareAmmo`    | Weapon can reload endlessly from a virtual ammo pool |

These are useful for:

* Debug/test builds
* Weapons like energy rifles with no reload
* Arcade-style weapon modes

***

### Extending the System

The system is designed to be modular and extensible.

You can:

* Create new inventory fragments for unique weapon behavior
* Override `CreateNewTransientFragment` to add runtime values
* Subclass [`LyraAbilityCost_Ammo`](../shooting-gameplay-abilities/ammo-cost.md) to support multiple ammo types per shot
* Add gameplay effect modifiers based on `LastFiredAmmoTypes`

> Always use the gameplay ability system (GAS) to perform modifications so client/server logic stays consistent.

***

### Summary

The Gun Fragment system supports a highly customizable ammo and reload model, including:

* Inventory-driven and classic ammo styles
* Per-instance runtime data
* Staged reload logic
* Mixed and specialized ammo types
* Fully extendable cost and consumption logic

This makes it suitable for anything from arcade shooters to hardcore tactical simulations.
