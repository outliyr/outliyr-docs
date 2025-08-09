# Gun Fragment

The `GunFragment` is the essential component for creating firearms in this asset. It is a required **Inventory Fragment** that must be added to any `ULyraInventoryItemDefinition` intended to function as a gun. Without it, the equipment, ability, and inventory systems will not recognize the item as a firearm, and no shooting or reloading logic will work.

<img src=".gitbook/assets/image (3).png" alt="" title="">

### Design Philosophy: A Flexible Foundation

Shooter games handle ammunition in two primary ways:

1. **Traditional System**: Ammo is an abstract counter, like in _Call of Duty_ or _Halo_. You have a number for "ammo in clip" and a number for "total spare ammo."
2. **Inventory-Based System**: Ammunition is a physical item in the player's inventory that must be loaded into the gun, like in _Escape from Tarkov_ or _PUBG_.

This asset is designed to support **both systems out-of-the-box**. The entire behavior of a weapon is determined by a single setting in its `GunFragment`, allowing you to choose the model that best fits your game's design without needing to rewrite core logic.

### How It Works: Static Config vs. Live Data

The system separates a gun's permanent, unchangeable properties from its dynamic, in-game state. This is a core concept in Lyra's inventory design.

* **`UInventoryFragment_Gun` (Static Configuration)**: This is where you define the weapon's fundamental stats in the Unreal Editor. These values are part of the item's _template_ (`ULyraInventoryItemDefinition`) and don't change during gameplay. Examples include maximum magazine size and which ammo model to use.
* **`FTransientFragmentData_Gun` (Live Instance Data)**: This is a lightweight data structure that stores the _runtime state_ for a _single instance_ of a gun. This is what allows two different M4A1s picked up by two different players to have different amounts of ammo loaded. This data is created when a gun instance is spawned and is destroyed with it.

***

### Configuration (`UInventoryFragment_Gun`)

You will configure these properties on the `GunFragment` within your weapon's `Item Definition` asset.

**Core Properties**

These properties are fundamental to any firearm, regardless of the ammo system you choose.

| Property                | Description                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MagazineSize`          | The maximum number of rounds the weapon's magazine can hold. This value is also added as a `GameplayTag` (`Lyra.ShooterGame.Weapon.MagazineSize`) to the item instance for easy access by gameplay abilities.         |
| `bInfiniteMagazineAmmo` | If true, the weapon's magazine is always considered full. Firing will not consume ammo, and reloading is unnecessary. Ideal for special weapons or debug modes.                                                       |
| `bInfiniteSpareAmmo`    | If true, the weapon can be reloaded an infinite number of times. In the Traditional system, it draws from an infinite pool. In the Inventory-Based system, it can reload without needing ammo items in the inventory. |

**Choosing Your Ammo System**

The `InventoryAmmoTypes` property is the critical switch that determines the weapon's behavior.

| Property             | Description                                                                                                                                                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InventoryAmmoTypes` | <p>This set defines which <code>ULyraInventoryItemDefinition</code>s the weapon accepts as ammunition.<br>- <strong>If EMPTY</strong>: The weapon uses the <strong>Traditional Ammo System</strong>.<br>- <strong>If POPULATED</strong>: The weapon uses the <strong>Inventory-Based Ammo System</strong>.</p> |

**Traditional Ammo System Properties**

These properties are **only used if `InventoryAmmoTypes` is empty**.

| Property       | Description                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| `MagazineAmmo` | The number of bullets the weapon has in its magazine when it is first created. |
| `SpareAmmo`    | The total number of spare bullets the weapon starts with.                      |

When a gun using this system is created, these values are used to set the initial stack counts for the `Lyra.ShooterGame.Weapon.MagazineAmmo` and `Lyra.ShooterGame.Weapon.SpareAmmo` Gameplay Tags on the item instance. All firing and reloading logic then interacts with these tags.

***

### Runtime State (`FTransientFragmentData_Gun`)

This transient data holds the live information for a gun instance.

| Property               | Description                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MagazineAmmo`         | An array that tracks the specific ammo types and counts currently loaded in the magazine. **This is only used by the Inventory-Based Ammo System.** |
| `CurrentReloadSection` | A `FName` used to track the progress of a multi-stage reload animation.                                                                             |
| `LastFiredAmmoTypes`   | Tracks the definition of the last ammo type fired. This is used by abilities to trigger ammo-specific effects (e.g., tracers).                      |

***

### Usage Guidelines

1. **Always** add a `GunFragment` to any `Item Definition` that is a firearm.
2. **Decide** on your ammo system:
   * For a simple, abstract ammo system, leave `InventoryAmmoTypes` **empty** and configure `MagazineAmmo` and `SpareAmmo`.
   * For a realistic, inventory-driven system, **populate** `InventoryAmmoTypes` with your ammo `Item Definition` assets.
3. Configure `MagazineSize` and infinite ammo flags to match your weapon's design.
4. To implement more advanced behaviors like mixed-ammo magazines or staged reloads, see the **Advanced Ammo System** documentation.

> [!success]
> Use Gameplay Abilities for all weapon actions (firing, reloading). The `ULyraAbilityCost_Ammo` cost object is already configured to automatically handle both ammo systems, significantly simplifying your implementation.
