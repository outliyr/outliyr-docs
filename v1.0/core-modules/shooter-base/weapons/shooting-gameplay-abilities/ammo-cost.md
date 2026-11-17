# Ammo Cost

Gameplay Abilities often have associated costs that must be met for activation and are consumed upon successful execution. `ULyraAbilityCost_Ammo` is a specialized `ULyraAbilityCost` subclass designed specifically to handle ammunition consumption for weapons within the ShooterBase system, seamlessly integrating with the `UInventoryFragment_Gun`.

### Purpose

This ability cost provides a unified way to manage ammo expenditure for firing abilities, supporting both:

* **Traditional Ammo:** Where ammo is tracked as simple integer counts using Gameplay Tags (`TAG_Lyra_Weapon_MagazineAmmo`) on the `ULyraInventoryItemInstance`.
* **Inventory-Based Ammo:** Where ammo is consumed directly from the `MagazineAmmo` array (containing `FMagazineAmmoData` structs with specific ammo item types and counts) stored within the `FTransientFragmentData_Gun` transient fragment.

It determines which system to use based on whether the `UInventoryFragment_Gun::InventoryAmmoTypes` set on the associated weapon's item definition is populated or empty.

### How It's Used

You add an instance of `ULyraAbilityCost_Ammo` to the `AbilityCosts` array of your weapon firing Gameplay Abilities (e.g., `GA_Weapon_Fire_Hitscan`, `GA_Weapon_Fire_PredictiveProjectile`).

* **`Quantity`:** Set the `FScalableFloat` value. Typically, this will be `1.0` for most weapons (consuming one round per shot). You could potentially scale it with ability level if needed, though this is less common for basic firing.
* **`FailureTag`:** Assign a Gameplay Tag (e.g., `Ability.Fail.Cost.Ammo`) that will be added to the `OptionalRelevantTags` output parameter in `CheckCost` if the ammo requirement isn't met. Other abilities or systems can listen for this tag to know why an ability failed (e.g., playing an "empty click" sound).

### Logic Breakdown

#### `CheckCost`

This function is called by GAS before activating an ability to see if the cost can be met.

1. **Get Weapon:** Casts the owning `Ability` to `ULyraGameplayAbility_FromEquipment` and gets the associated `ULyraInventoryItemInstance* ItemInstance`.
2. **Check Infinite Ammo:** Checks if the item has the `TAG_Lyra_Weapon_InfiniteMagazineAmmo` stat tag. If so, the cost is always met, returns `true`.
3. **Get Gun Fragment:** Finds the `UInventoryFragment_Gun` on the `ItemInstance`.
4. **Determine Ammo System:** Checks if `GunFragment->InventoryAmmoTypes` is populated.
5. **Inventory Ammo Check:**
   * If `InventoryAmmoTypes` is _not empty_:
     * Calculates the integer `NumStacks` required based on the `Quantity` property.
     * Resolves the `FTransientFragmentData_Gun` transient fragment using `ItemInstance->ResolveTransientFragment<UInventoryFragment_Gun>()`.
     * Iterates through the `MagazineAmmo` array in the transient data.
     * Sums up the total `Count` across all ammo types currently in the magazine.
     * Returns `true` if `TotalCount >= NumStacks`, `false` otherwise.
     * Adds `FailureTag` if the check fails.
6. **Traditional Ammo Check:**
   * If `InventoryAmmoTypes` is _empty_:
     * Calculates the integer `NumStacks` required based on the `Quantity` property.
     * Gets the current magazine ammo count using `ItemInstance->GetStatTagStackCount(TAG_Lyra_Weapon_MagazineAmmo)`.
     * Returns `true` if `StackCount >= NumStacks`, `false` otherwise.
     * Adds `FailureTag` if the check fails.
7. **Failure:** Returns `false` if the item instance or gun fragment couldn't be found.

#### `ApplyCost`

This function is called by GAS _after_ an ability has successfully executed _on the server_ (or locally within a prediction window) to actually consume the resource.

1. **Authority Check:** Ensures the logic only runs on the network authority.
2. **Get Weapon & Check Infinite:** Similar setup as `CheckCost`, returning early if the weapon has infinite magazine ammo.
3. **Get Gun Fragment & Determine System:** Finds the fragment and checks `InventoryAmmoTypes`.
4. **Apply Inventory Ammo Cost:**
   * If `InventoryAmmoTypes` is _not empty_:
     * Gets the `NumStacks` to remove.
     * Resolves the `FTransientFragmentData_Gun`.
     * Iterates through the `MagazineAmmo` array _from the beginning_.
     * For each `FMagazineAmmoData` entry:
       * Calculates the amount to remove from this entry (`AmountToRemove = FMath::Min(AmountRemaining, MagazineAmmo.Count)`).
       * Decrements `MagazineAmmo.Count`.
       * Decrements `AmountRemaining`.
       * **Crucially:** Stores the `AmmoType` of the _first entry ammo was removed from_ into the transient fragment's `LastFiredAmmoTypes` field. This allows other systems or abilities to know what type of ammo was just consumed.
       * If an entry's `Count` reaches zero, it removes that entry from the `MagazineAmmo` array (adjusting the loop index accordingly).
       * Breaks the loop once `AmountRemaining` reaches zero.
5. **Apply Traditional Ammo Cost:**
   * If `InventoryAmmoTypes` is _empty_:
     * Gets the `NumStacks` to remove.
     * Calls `ItemInstance->RemoveStatTagStack(TAG_Lyra_Weapon_MagazineAmmo, NumStacks)` to decrement the ammo count stored in the gameplay tag.

### Key Takeaways

* `ULyraAbilityCost_Ammo` intelligently adapts to both inventory-based and traditional ammo systems configured via `UInventoryFragment_Gun`.
* It handles checking ammo availability before firing.
* It applies the ammo cost authoritatively on the server.
* For inventory ammo, it consumes ammo from the `MagazineAmmo` array stored in the transient fragment and records the `LastFiredAmmoTypes`.
* For traditional ammo, it modifies the `TAG_Lyra_Weapon_MagazineAmmo` stat tag count.
* It correctly handles infinite ammo flags.

This component is essential for making weapon firing abilities correctly interact with the ammunition system defined on the weapon's `UInventoryFragment_Gun`.

***
