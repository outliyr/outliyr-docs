# Gun Fragment

The `GunFragment` is a required [inventory fragment](../../../../base-lyra-modified/items/items-and-fragments/item-fragments.md) used to identify an item as a firearm in the ShooterBase plugin. Items without this fragment will not be treated as guns by the inventory, gameplay ability, or equipment systems.

This fragment enables the weapon to support both traditional shooter ammo systems (e.g., Call of Duty) and inventory-based ammo systems (e.g., Escape from Tarkov, Apex Legends), making it highly adaptable for a variety of shooter styles.

***

### Requirements

Any item intended to function as a firearm **must** include the `GunFragment`. Without it:

* The item will not be recognized as a gun
* No shooting logic or gun-specific abilities will activate
* Magazine, reload, and ammo systems will not function

***

### Overview

The `UInventoryFragment_Gun` class and its corresponding transient fragment `FTransientFragmentData_Gun` define both static and runtime data for firearm items.

***

### [Transient Fragment](../../../../base-lyra-modified/items/items-and-fragments/transient-data-fragments.md) (instanced data)

Defined in `FTransientFragmentData_Gun`, these values are stored per instance and allow weapons of the same class to behave independently at runtime.

```cpp
USTRUCT(BlueprintType)
struct FTransientFragmentData_Gun : public FTransientFragmentData
```

#### Key Fields

| Property               | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `MagazineAmmo`         | List of ammo types and quantities loaded in the weapon                                |
| `CurrentReloadSection` | Used to track the current reload animation phase                                      |
| `LastFiredAmmoTypes`   | Tracks the ammo type used for the last shot fired (used by abilities, not replicated) |

***

### Configuration (Gun Fragment)

Defined in `UInventoryFragment_Gun`, this is where weapon stats and behavior are configured.

```cpp
UCLASS(MinimalAPI)
class UInventoryFragment_Gun : public ULyraInventoryItemFragment
```

#### Core Properties

| Property                | Description                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MagazineAmmo`          | Starting magazine ammo (ignored if using inventory-based ammo)                                                 |
| `MagazineSize`          | Max capacity of the magazine                                                                                   |
| `SpareAmmo`             | Starting spare ammo (ignored if using inventory-based ammo)                                                    |
| `bInfiniteMagazineAmmo` | If true, the weapon has infinite magazine ammo                                                                 |
| `bInfiniteSpareAmmo`    | If true, the weapon has infinite spare ammo                                                                    |
| `InventoryAmmoTypes`    | If empty, the weapon uses standard ammo counters; if filled, the weapon pulls ammo from the player’s inventory |

> If `InventoryAmmoTypes` is empty, the weapon behaves like a traditional shooter. If it contains one or more ammo item definitions, the weapon will use actual inventory items as ammunition.

***

### Initialization Behavior

#### OnInstanceCreated

When a gun item instance is created, this function:

* Adds stat tags to represent magazine size and ammo amounts
* Applies infinite ammo rules if applicable
* Initializes weapon ammo based on either internal values or linked inventory ammo types

```cpp
void UInventoryFragment_Gun::OnInstanceCreated(ULyraInventoryItemInstance* Instance) const;
```

#### CreateNewTransientFragment

This method initializes the transient fragment data for the weapon.

```cpp
bool UInventoryFragment_Gun::CreateNewTransientFragment(...)
```

* Called when a new instance of the gun is spawned
* Prepares `MagazineAmmo`, reload section, and other runtime variables

***

### Design Goals

* **Modular behavior**: Items are extended with fragments, avoiding deep inheritance trees.
* **Per-instance control**: Transient data ensures that two instances of the same gun class can behave differently.
* **Inventory integration**: Full support for inventory-based ammo systems using the `InventoryAmmoTypes` set.
* **Stat-based customization**: All gameplay-related values (ammo, size, behavior) are represented as stat tags, allowing for flexible expansion or modification via gameplay effects.

***

### Usage Guidelines

* Always attach `GunFragment` to `ULyraItemInstances` meant to function as firearms.
* Choose whether the gun uses `InventoryAmmoTypes` depending on your game’s ammo management style.
* Customize `MagazineSize`, `SpareAmmo`, and other properties to configure per-weapon stats.
* If using inventory-based ammo, make sure your inventory contains compatible ammo item definitions.

{% hint style="success" %}
**Note**: The item query is helpful when tracking the ammo types in the inventory for UI purposes, this is what is currently done.
{% endhint %}
