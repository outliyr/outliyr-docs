# Advanced Ammo System

This guide is for developers who want to move beyond the traditional ammo model and implement more complex, tactical firearm mechanics. It assumes you have read the main `GunFragment` documentation and understand the core concepts.

Here, we will explore the features unlocked when you use the **Inventory-Based Ammo System**, including mixed-ammo magazines, staged reloads, and how to extend the system for your own unique mechanics.

### Activating the Inventory-Based System

To enable this advanced system, you simply need to populate the `InventoryAmmoTypes` set on your weapon's `GunFragment`. By adding one or more ammo `Item Definition`s to this set, you tell the weapon to stop using abstract ammo counters and instead pull ammunition directly from the player's inventory.

**How it Works:**

* The `MagazineAmmo` and `SpareAmmo` integer properties on the `GunFragment` are **completely ignored**.
* The weapon's current ammunition is stored in the `MagazineAmmo` array, which is part of its `FTransientFragmentData_Gun`. This array tracks the specific `ItemDefinition` and `Count` of each ammo type loaded.
* **Firing**: The `ULyraAbilityCost_Ammo` automatically detects that the inventory system is active. Instead of consuming a `GameplayTag` stack, it removes ammo directly from the `MagazineAmmo` array in the transient fragment.
*   **Reloading**: Your reloading `GameplayAbility` is now responsible for finding compatible ammo items in the player's inventory, removing them, and adding them to the weapon's `MagazineAmmo` array, up to its `MagazineSize`.&#x20;

    * This asset comes with two reload abilities that already handle this, one for magazine reloads and another for shell reloads (e.g loading shotgun shells one by one)

    <img src=".gitbook/assets/image.png" alt="" title="">

***

### Feature: Mixed Ammunition Support

Because the `MagazineAmmo` array stores each entry as a distinct `FMagazineAmmoData` struct, the system natively supports loading multiple types of ammunition into a single magazine.

This allows for mechanics such as:

* Loading a magazine with alternating Armor-Piercing and Tracer rounds.
* Weapons with special firing modes that consume a specific ammo type.
* Visual or statistical effects tied to the type of round fired.

<div class="collapse">
<p class="collapse-title"><strong>Example: Programmatically adding ammo during a reload</strong></p>
<div class="collapse-content">

Your reload ability would contain logic similar to this to add 10 Armor-Piercing rounds to the gun's magazine:

```cpp
// In your reload gameplay ability...
if (auto* GunData = ItemInstance->ResolveTransientFragment<UInventoryFragment_Gun>())
{
    FMagazineAmmoData Slot;
    Slot.AmmoType = ULyraAmmo_AP::StaticClass(); // The Item Definition for AP rounds
    Slot.Count = 10;
    GunData->MagazineAmmo.Add(Slot);
}
```

</div>
</div>

***

#### Feature: Staged Reloads

Modern shooters often feature reloads that can be interrupted and resumed. This system supports that via the `CurrentReloadSection` property in `FTransientFragmentData_Gun`.

**Implementation Guide:**

1. Create a reload `Animation Montage` with named sections (e.g., `Start`, `InsertMag`, `End`).
2. In your reload `GameplayAbility`, as the animation plays, update the `CurrentReloadSection` on the gun's transient fragment to match the current montage section.
3. If the ability is interrupted (e.g., the player sprints), the `CurrentReloadSection` name is preserved.
4. When the reload ability is triggered again, it should first check `CurrentReloadSection`. If it's not `NAME_None`, it can play the montage starting from that specific section instead of from the beginning.

This prevents players from losing all progress on a long reload animation if they have to react to a threat.

***

#### Extending the System

The ammo system is built on modular fragments and Gameplay Abilities, making it highly extensible.

**Custom Ammo Costs**

The default `ULyraAbilityCost_Ammo` handles the most common use case (1 shot = 1 ammo). You can easily subclass it to create new behaviors:

* `ULyraAbilityCost_BurstFire`: A cost that consumes 3 ammo per shot.
* `ULyraAbilityCost_ChargedShot`: A cost that scales the ammo consumed based on charge time.
* `ULyraAbilityCost_MultiType`: A cost for a super-weapon that consumes one of every ammo type in the magazine for a powerful blast.

**Ammo-Specific Effects (`LastFiredAmmoTypes`)**

The `LastFiredAmmoTypes` property is your key to creating dynamic feedback. After `ULyraAbilityCost_Ammo` consumes a round, your firing ability can read this property to decide what to do next.

**Use Case:**

1. A player fires a "Shock Round."
2. The cost logic consumes the shock round and sets `LastFiredAmmoTypes` to `DA_ShockAmmo`.
3. Your firing ability's logic checks this value and, instead of spawning a normal bullet tracer, spawns a lightning bolt particle effect and applies a "Stun" `GameplayEffect` to the target.

> **Note:** `LastFiredAmmoTypes` is not replicated, as it's intended for client-side cosmetic effects or server-side hit processing that happens within the same frame as the shot.

**Summary of Advanced Capabilities**

By leveraging the Inventory-Based Ammo System, you unlock:

* **Realistic Ammo Management**: Players must manage physical ammo items.
* **Tactical Depth**: Mixed ammo and specialized rounds become possible.
* **Smoother Gameplay**: Staged reloads provide a better user experience.
* **Maximum Extensibility**: The entire system is built on `GameplayAbilities` and `Fragments`, making it easy to add new, unique mechanics without modifying the core asset.



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

> Only a **single ammo type is recorded per shot**. For shotguns or other multi-projectile weapons, this still works fine, but multi-ammo-type-per-shot is not natively supported. If needed, extend the system or override the firing ability.

***

### Inventory-Based Ammo

If `InventoryAmmoTypes` is populated, the gun pulls ammunition directly from the player’s inventory using `ULyraInventoryItemDefinition` references. The actual consumption logic during firing is handled by the assigned Gameplay Ability Cost, [`ULyraAbilityCost_Ammo`](../shooting-gameplay-abilities/ammo-cost.md) .

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
