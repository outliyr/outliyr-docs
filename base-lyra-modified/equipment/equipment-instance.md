# Equipment Instance

While the `ULyraEquipmentDefinition` is the _recipe_, the `ULyraEquipmentInstance` is the _cooked dish_ currently being used by the Pawn. It's the actual, live representation of a piece of equipment that has been equipped via the `ULyraEquipmentManagerComponent`.

**Key Characteristics:**

* **Type:** `UObject`. **Crucially, it is&#x20;**_**not**_**&#x20;an Actor.** It doesn't exist independently in the world's actor hierarchy.
* **Ownership:** Each `ULyraEquipmentInstance` is owned by the **Pawn** that has the equipment equipped.
* **Lifetime:** Created by the `ULyraEquipmentManagerComponent` when an item is equipped (either Holstered or Held directly) and typically destroyed when fully unequipped (or when the owning Manager/Pawn is destroyed).
* **Replication:** Replicated as a **subobject** of the `ULyraEquipmentManagerComponent`, ensuring clients have access to its state.

### Role & Responsibilities

The `ULyraEquipmentInstance` primarily serves to:

1. **Represent Runtime State:** Hold data and logic specific to _this particular instance_ of the equipment while it's equipped (e.g., current heat level of _this_ gun, durability of _this_ armor piece).
2. **Receive Lifecycle Events:** Act upon specific events triggered by the `ULyraEquipmentManagerComponent` as the equipment's state changes (Equipped, Unequipped, Holstered, Unholstered).
3. **Manage Spawned Actors:** Keep track of any Actors spawned specifically for this equipment instance (like weapon meshes), although the spawning/destroying logic is usually initiated by the Manager based on the Definition.
4. **Link to Inventory:** Typically holds a reference (`Instigator`) back to the original `ULyraInventoryItemInstance` it represents.
5. **Provide Ability Source Context:** Acts as the `SourceObject` for Gameplay Abilities granted by this equipment.

***

### Lifecycle Events & Callbacks

The `ULyraEquipmentManagerComponent` notifies the `ULyraEquipmentInstance` of state changes by calling specific functions. You can hook into these in C++ or Blueprint to implement custom logic.

* `OnEquipped()` / `K2_OnEquipped()` (Blueprint Event)
  * **Called When:** The item transitions to the **Held** state (actively wielded). This happens during `ULyraEquipmentManagerComponent::HoldItem`.
  * **Use Case:** Initialize logic specific to being held, play equip animations/sounds on associated actors, apply device properties (like controller vibration patterns for a weapon).
* `OnUnequipped()` / `K2_OnUnequipped()` (Blueprint Event)
  * **Called When:** The item transitions _out_ of the **Held** state. This happens during `ULyraEquipmentManagerComponent::UnholdItem`.
  * **Use Case:** Clean up held-state logic, stop equip animations/sounds, remove active device properties.
* `OnHolster()` / `K2_OnHolster()` (Blueprint Event)
  * **Called When:**
    * The item is initially equipped into a slot (via `EquipItemToSlot`/`EquipItemDefToSlot`).
    * The item transitions from Held back to its assigned slot (during `UnholdItem` if it has a valid `SlotTag`).
  * **Use Case:** Initialize logic specific to being holstered (maybe passive effects), ensure the correct holstered visual mesh is active.
* `OnUnHolster()` / `K2_OnUnHolster()` (Blueprint Event)
  * **Called When:**
    * The item is fully unequipped from a slot (via `UnequipItemFromSlot`).
    * The item transitions from Holstered _to_ Held (during `HoldItem`).
  * **Use Case:** Clean up any holstered-specific logic before the item is held or removed entirely.

> [!info]
> The C++ functions (`OnEquipped`, etc.) provide base functionality (like calling item fragment callbacks) and then call the corresponding `K2_` Blueprint events. You should typically override the `K2_` events in Blueprint subclasses or the C++ functions if subclassing in C++. Remember to call `Super::FunctionName()` if overriding the C++ functions to maintain base functionality.

***

### Linking Back: The Instigator

* `Instigator` (`TObjectPtr<UObject>`)
  * This property is set by the `ULyraEquipmentManagerComponent` during the equip process.
  * It typically points to the **`ULyraInventoryItemInstance`** that this equipment represents.
  * **Importance:** Allows the equipment instance (and abilities originating from it) to access data stored on the underlying inventory item (like ammo counts, durability stored in item stat tags, or transient fragment data).
* `OnRep_Instigator()` & `OnInstigatorReady` (Delegate)
  * Since the `Instigator` is replicated, `OnRep_Instigator` is called on clients when the reference becomes valid.
  * It broadcasts the `OnInstigatorReady` delegate, which can be useful for client-side logic that needs to wait until the link to the inventory item is established.

***

### Visual Representation: Spawned Actors

* `SpawnEquipmentActors(const TArray<FLyraEquipmentActorToSpawn>& ActorsToSpawn)`
* `DestroyEquipmentActors()`
* `SpawnedActors` (`TArray<TObjectPtr<AActor>>`)

While the `ULyraEquipmentDefinition` _defines_ which actors to spawn for Holstered/Held states, these functions on the `ULyraEquipmentInstance` actually perform the spawning (using `GetWorld()->SpawnActorDeferred`) and attachment logic.

They are typically **called by the `ULyraEquipmentManagerComponent`** at the appropriate times (during state transitions). The `SpawnedActors` array keeps track of the actors created by this instance so they can be properly destroyed later by `DestroyEquipmentActors`. You generally don't need to call these functions directly unless implementing very custom spawning logic within an instance subclass.

***

### Adding Custom Logic & State

#### Subclassing for Behavior

You can extend `ULyraEquipmentInstance` to add specialized behavior:

* **Blueprint Subclassing:** Create a Blueprint class inheriting from `ULyraEquipmentInstance` (or a more specific C++ subclass like `ULyraWeaponInstance`).
  * Implement the `K2_OnEquipped`, `K2_OnUnequipped`, `K2_OnHolster`, `K2_OnUnHolster` events for Blueprint-based logic.
  * Add Blueprint variables and functions specific to this equipment type.
  * Remember to set the `Instance Type` in the corresponding `ULyraEquipmentDefinition` to your Blueprint class.
* **C++ Subclassing:** Create a new C++ class inheriting from `ULyraEquipmentInstance`.
  * Override the virtual functions (`OnEquipped`, etc.) for C++ logic (remember `Super::`).
  * Add custom C++ properties and methods.
  * Again, update the `Instance Type` in the `ULyraEquipmentDefinition`.

### Managing Runtime State: Tag Attributes (`FGameplayTagAttributeContainer`)

A common challenge in equipment systems is managing stats or parameters that are specific to certain equipment _types_ or _abilities_ without cluttering the base class or creating complex inheritance chains. For example:

* A rifle's `GA_ShootBullet` ability needs `MuzzleVelocity`.
* A flamethrower's `GA_SpitFlame` ability needs `FlameWidth` and `FuelConsumptionRate`.
* An attachment might need to modify the base `SpreadExponent` of a weapon.

Putting all these variables directly in `ULyraEquipmentInstance` (or even `ULyraWeaponInstance`) leads to bloat. Creating subclasses for every variation (`ULyraLaserRifleInstance`, `ULyraShotgunInstance`) becomes unwieldy.

**The Solution: Tag Attributes**

The `ULyraEquipmentInstance` contains a replicated `FGameplayTagAttributeContainer` named `Attributes`.

* **What it is:** A container holding **float** values, each associated with a unique **Gameplay Tag**. Think of it as a dictionary mapping `FGameplayTag` -> `float`.
* **Purpose:** To store mutable, instance-specific parameters that are often introduced or modified by the Gameplay Abilities granted by the equipment, or by external systems like attachments.
* **Replication:** Uses `FFastArraySerializer` for efficient network replication.

**How it's Used:**

1.  **Initialization:** Abilities granted by the equipment (via `ULyraAbilitySet` in the `ULyraEquipmentDefinition`) can add their relevant parameters to the container when the ability is granted, using `AddTagAttribute(FGameplayTag Tag, float InitialValue)`.

    * Example: `GA_ReloadMagazine`'s `OnGranted` logic might call `EquipmentInstance->AddTagAttribute(TAG_Gun_Stat_ReloadSpeed, PlayRate)`.

    <img src=".gitbook/assets/image (94).png" alt="" width="563" title="Add the reload speed stat to the equipment instance on ability added">
2. **Modification:** Other systems can modify these values:
   * A passive ability could temporarily boost a stat using `ModifyTagAttribute` and then use `ReverseTagAttributeModification` when the effect expires.
   * Look at the [attachment utility ability documentation](../items/item-fragments-in-depth/attachment-system/provided-attachment-utility-abilities.md) for more indepth examples of modifications
3.  **Querying:** Abilities or other systems can read the current value using `GetTagAttributeValue(FGameplayTag Tag)` or check for existence using `HasTagAttribute(FGameplayTag Tag)`.

    * Example: `GA_ShootBullet` would call `EquipmentInstance->GetTagAttributeValue(TAG_Weapon_Stat_MuzzleVelocity)` to get the potentially modified velocity just before firing.

    <img src=".gitbook/assets/image (96).png" alt="" width="563" title="Using the tag attribute reload speed to modify montage play back rate">
4.  **Cleanup:** When an ability is removed (e.g., when the item is unheld or unequipped), its `OnRemoved` logic should ideally call `RemoveTagAttribute(FGameplayTag Tag)` to clean up the parameters it introduced.

    <img src=".gitbook/assets/image (95).png" alt="" width="563" title="Remove the reload speed stat from the equipment instance on ability remove">

**Example Tags:**

* `Weapon.Stat.MuzzleVelocity`
* `Weapon.Stat.SpreadExponent`
* `Weapon.Stat.RateOfFire`
* `Armor.Stat.DamageResistance.Physical`
* `Gadget.Stat.EffectRadius`

**Tag Attributes vs. Item Stat Tags (`FGameplayTagStackContainer`)**

It's vital to distinguish between the two state containers:

| Feature              | `Attributes` (on `ULyraEquipmentInstance`)                     | `StatTags` (on `ULyraInventoryItemInstance`)                    |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| **Data Type Stored** | `float`                                                        | `int32` (Stack Count)                                           |
| **Lifetime**         | Tied to the **Equipment Instance** (while equipped/held)       | Tied to the **Inventory Item Instance** (persists in inventory) |
| **Primary Use Case** | Mutable parameters for abilities, temporary mods (attachments) | Persistent counts (ammo, charges), durability, flags            |
| **Replication**      | Via `FGameplayTagAttributeContainer` (Fast Array)              | Via `FGameplayTagStackContainer` (Fast Array)                   |
| **Accessed Via**     | `ULyraEquipmentInstance*`                                      | `ULyraInventoryItemInstance*` (often via `Instigator`)          |
| **Example**          | `Weapon.Stat.SpreadExponent = 1.5f`                            | `Inventory.Ammo.Rifle = 30` (stacks)                            |

**Use `Attributes` on the Equipment Instance for:** Values directly related to _how the equipment functions while active_, especially those introduced or modified by abilities or temporary attachments.**Use `StatTags` on the Inventory Item Instance for:** Values intrinsic to the _item itself_ that need to persist even when it's not equipped (like how much ammo is left in the magazine).

***

### Integrating with Gameplay Abilities (GAS)

#### Ability Source Object

When the `ULyraEquipmentManagerComponent` grants an ability set (defined in the `ULyraEquipmentDefinition`) to the Pawn's ASC, it specifies the **`ULyraEquipmentInstance`** as the `SourceObject` for those granted abilities.

This means that inside a Gameplay Ability activated from this equipment, you can easily access the instance that granted it.

#### Recommended Ability Base Class: `ULyraGameplayAbility_FromEquipment`

When creating Gameplay Abilities specifically intended to be granted by equipment (e.g., `GA_FireWeapon`, `GA_ActivateShield`), it is **highly recommended** to subclass your ability from `ULyraGameplayAbility_FromEquipment` instead of the base `ULyraGameplayAbility`.

**Why?**

`ULyraGameplayAbility_FromEquipment` provides convenient helper functions:

* `GetAssociatedEquipment() const`: Returns the `ULyraEquipmentInstance*` that granted this ability (by retrieving it from the ability spec's `SourceObject`).

<img src=".gitbook/assets/image (97).png" alt="" width="272" title="">

* `GetAssociatedItem() const`: A further convenience function that calls `GetAssociatedEquipment()` and then retrieves the `ULyraInventoryItemInstance*` from the equipment's `Instigator` property.

<img src=".gitbook/assets/image (98).png" alt="" width="264" title="">

**Benefits:**

* **Cleaner Code:** Avoids repetitive casting of the `SourceObject` within your ability logic.
* **Direct Access:** Easily get references to both the runtime equipment state (`ULyraEquipmentInstance`) and the persistent inventory item state (`ULyraInventoryItemInstance`).

**Example Usage (inside an ability derived from `ULyraGameplayAbility_FromEquipment`):**

<!-- tabs:start -->
#### **Blueprints**
<img src=".gitbook/assets/image (99).png" alt="" title="Accessing the item stat tag that belongs to this equipment in GA_Reload_Magazine ">

<img src=".gitbook/assets/image (100).png" alt="" title="Accessing the tag stat for the equipment that called this ability in GA_Reload_Magazine">


#### **C++**
```cpp
void UMyFireWeaponAbility::ActivateAbility(...)
{
    // Get the weapon instance that granted this ability
    if (ULyraWeaponInstance* WeaponInstance = Cast<ULyraWeaponInstance>(GetAssociatedEquipment()))
    {
        // Access weapon instance properties or functions
        float SpreadExponent = WeaponInstance->GetTagAttributeValue(TAG_Weapon_Stat_SpreadExponent);
        WeaponInstance->UpdateFiringTime(); // Example function call

        // Get the associated inventory item instance
        if (ULyraInventoryItemInstance* ItemInstance = GetAssociatedItem())
        {
            // Access inventory item properties (e.g., ammo)
            int32 CurrentAmmo = ItemInstance->GetStatTagStackCount(TAG_Inventory_Ammo_Current);
            if (CurrentAmmo > 0)
            {
                // Perform firing logic...
                ItemInstance->RemoveStatTagStack(TAG_Inventory_Ammo_Current, 1);
            }
        }
    }
}
```



<!-- tabs:end -->

By using `ULyraGameplayAbility_FromEquipment`, you streamline the process of writing abilities that interact correctly with the specific equipment instance and its corresponding inventory item.

***

### Replication Summary

* The `ULyraEquipmentInstance` itself is replicated as a subobject of the owning `ULyraEquipmentManagerComponent`.
* Its `Instigator` property (pointing to the `ULyraInventoryItemInstance`) is replicated.
* Its `Attributes` (`FGameplayTagAttributeContainer`) property is replicated using Fast Array Serialization.
* Any `UPROPERTY(Replicated)` variables you add in C++ subclasses will also be replicated.

***

The `ULyraEquipmentInstance` provides the essential runtime context for equipped items. By understanding its lifecycle, how it holds state (especially via Tag Attributes), its link to inventory via the Instigator, and how to best write abilities for it using `ULyraGameplayAbility_FromEquipment`, you can create complex and dynamic equipment behaviors.
