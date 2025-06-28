# Provided Attachment Utility Abilities

To streamline common attachment functionalities—specifically modifying stats on the host equipment or its associated item instance—this asset provides pre-built Gameplay Ability base classes. These utility abilities encapsulate the logic for applying and reversing modifications, reducing boilerplate code and providing clear examples for developers.

You typically **subclass** these utility abilities, configure their specific parameters in the subclass defaults, and then add your subclass to an `ULyraAbilitySet`. This Ability Set is then assigned to the `AbilitySetsToGrant` array within the `FAttachmentDetails` -> `FAttachmentBehaviour` of the relevant attachment's configuration (defined on the _host_ item's `UInventoryFragment_Attachment`).

### Core Idea: Data-Driven Modifications via Abilities

Instead of requiring custom C++ or complex Blueprint logic for every stat-modifying attachment, these abilities allow you to define the modifications largely through data:

* **Attachment Configuration:** The `FAttachmentDetails` (on the host's fragment) specifies an `ULyraAbilitySet` to grant when the attachment is active.
* [**Ability Set**](../../../gameframework-and-experience/experience-primary-assets/lyra-ability-sets.md)**:** This set contains instances of your specialized ability subclasses.
* **Ability Subclass:** Your subclass (e.g., `GA_Grip_RecoilReduction` derived from `GA_EquipmentAttributeModifier`) has its default properties set to define _which_ stat to modify and _how_.
* **Runtime:** When the attachment is active, the ability is granted and automatically applies (and later reverses) the configured modifications.

All these utility abilities inherit from `ULyraGameplayAbility_FromAttachment`, giving them easy access to the attachment item, its parent (host) item, and the root equipment context.

### 1. Modifying Equipment Instance Stats (`GA_EquipmentAttributeModifier`)

* **Purpose:** Designed to allow attachments to modify [**Tag Attributes**](../../../equipment/equipment-instance.md#managing-runtime-state-tag-attributes-fgameplaytagattributecontainer) (float values stored in the `FGameplayTagAttributeContainer`) on the **`ULyraEquipmentInstance`** of the _root equipped item_ that the attachment chain is ultimately connected to. Ideal for stats like recoil, spread, sway, damage multipliers, etc., that are part of the active weapon's runtime state.
* **Inheritance:** Subclass of `ULyraGameplayAbility_FromAttachment`.
* **Configuration (in your Subclass Defaults):**
  * **`Float Stat Modifications` (`TArray<FFloatStatModification>`):** This is the key array you configure. Each element defines a single stat modification:
    * `Tag` (`FGameplayTag`): The Gameplay Tag of the attribute on the `ULyraEquipmentInstance` to modify (e.g., `Weapon.Stat.RecoilVertical`, `Weapon.Stat.SpreadADSModifier`).
    * `Modification Value` (`float`): The value to apply (e.g., -0.1, 1.2).
    * `Mod Op` (`EFloatModOp`): The operation (Add, Multiply, Divide).
* **Runtime Logic:**
  * **On Grant (Ability Activation - often `OnSpawn` or when an `Event.Attachment.Activated` is received):**
    1. Uses `GetAssociatedEquipmentInstance()` to find the root `ULyraEquipmentInstance`.
    2. If found, iterates through its configured `FloatStatModifications` array.
    3. For each entry, calls `EquipmentInstance->ModifyTagAttribute(Tag, ModificationValue, ModOp)`.
    4. **Crucially, it stores the `FFloatStatModification` struct returned by `ModifyTagAttribute`** (which contains the `OldValue`) internally within the ability instance.
  * **On Removal (Ability `EndAbility`):**
    1. Uses `GetAssociatedEquipmentInstance()` again.
    2. If found, iterates through its internally stored `FFloatStatModification` handles (from the grant phase).
    3. For each stored handle, calls `EquipmentInstance->ReverseTagAttributeModification(StoredModInfo)`, which uses the `OldValue` to correctly revert the change.
*   **Use Case Example:**

    * An `ID_Attachment_VerticalGrip` is configured (via its entry in the rifle's `CompatibleAttachments`) to grant an `ULyraAbilitySet` containing `GA_Grip_RecoilReduction` (a subclass of `GA_EquipmentAttributeModifier`).
    * `GA_Grip_RecoilReduction` has `FloatStatModifications` configured to: `Tag=Weapon.Stat.RecoilVertical, ModificationValue=0.8, ModOp=Multiply`.
    * When the grip is attached to a held rifle, the ability activates, finds the rifle's `ULyraEquipmentInstance`, and multiplies its `Weapon.Stat.RecoilVertical` attribute by 0.8.
    * When the grip is removed, the ability ends, and the modification is reversed, restoring the original recoil value.

    <img src=".gitbook/assets/image (16) (1).png" alt="" width="563" title="Subclassed GA_EquipmentAttributeModifier modifying equipment tag attributes">

### 2. Modifying Item Instance Magazine Stats (`GA_MagazineStatModifier`)

* **Purpose:** Specifically designed for attachments (typically magazines themselves) to modify **Stat Tags** (integer values in `FGameplayTagStackContainer`) related to ammunition capacity on the **`ULyraInventoryItemInstance`** of the _host equipment item_ (e.g., the rifle itself).
* **Inheritance:** Subclass of `ULyraGameplayAbility_FromAttachment`.
* **Configuration (in your Subclass Defaults):**
  * You would typically configure properties in your subclass defining:
    * The target Stat Tag for magazine capacity (e.g., `Weapon.Ammo.MagazineCapacity`).
    * The new capacity value this magazine provides.
    * (Potentially) A Stat Tag for max capacity if your system distinguishes between current and max.
* **Runtime Logic:**
  * **On Grant (Ability Activation):**
    1. Uses `GetAssociatedEquipmentItem()` to get the `ULyraInventoryItemInstance` of the host weapon.
    2. If found, calls `WeaponItemInstance->SetStatTagStack(MagazineCapacityTag, NewCapacityValue)`.
    3. **Important:** This ability would also need to contain logic to handle ammo adjustments. For example:
       * If current ammo (`Weapon.Ammo.CurrentInMagazine`) exceeds the _new_ capacity, the excess ammo might be moved to reserve (`Weapon.Ammo.Reserve`) or dropped.
       * If the old capacity was smaller, no immediate ammo change might be needed beyond updating the max.
  * **On Removal (Ability `EndAbility`):**
    1. Reverts the magazine capacity Stat Tag on the `WeaponItemInstance`. This is complex:
       * It might revert to a default "no magazine" capacity.
       * If another magazine is immediately swapped in, that magazine's `GA_MagazineStatModifier` would then set the new capacity.
       * Needs to handle ammo again: if the capacity is _reduced_, current ammo might need to be clamped and excess moved/dropped.
*   **Use Case Example:**

    * An `ID_Attachment_ExtendedMagazine` is configured to grant an `ULyraAbilitySet` containing `GA_ExtendedMag_Set50RndCapacity` (a subclass of `GA_MagazineStatModifier`).
    * `GA_ExtendedMag_Set50RndCapacity` is configured to set `Weapon.Ammo.MagazineCapacity` to 50.
    * When attached to a held rifle, the ability activates and changes the rifle's item instance `MagazineCapacity` Stat Tag to 50, adjusting current ammo as needed.
    * When removed, the rifle's capacity reverts (e.g., to a default 20 if no other magazine is present).

    <img src=".gitbook/assets/image (18) (1).png" alt="" title=" Subclassed GA_MagazineStatModifier extending magazine by 40">

### How to Use These Utility Abilities

1. **Create Subclasses:** For each distinct stat modification or magazine type:
   * Create a new Blueprint Gameplay Ability class inheriting from `GA_EquipmentAttributeModifier` or `GA_MagazineStatModifier`.
   * Open the Blueprint and in its Class Defaults, configure the specific `FloatStatModifications` array or the magazine capacity parameters.
2. **Create Ability Sets:** Create `ULyraAbilitySet` assets. Add your newly created ability subclasses to these sets.
   * _Example:_ `AS_Grip_RecoilBonus` contains `GA_Grip_RecoilReduction`.
   * _Example:_ `AS_Magazine_Extended` contains `GA_ExtendedMag_Set50RndCapacity`.
3. **Configure Host Item's Attachment Fragment:**
   * Open the `ULyraInventoryItemDefinition` of the item that will _host_ the attachment (e.g., `ID_Rifle_Standard`).
   * Find its `UInventoryFragment_Attachment`.
   * In the `CompatibleAttachments` map, find/create the entry for the specific attachment slot and the specific attachment item definition.
   * In the `FAttachmentDetails` for that combination, add the appropriate `ULyraAbilitySet` (from step 2) to the `AbilitySetsToGrant` array in the `HeldAttachmentSettings` (and/or `HolsteredAttachmentSettings` if applicable).

Now, when the attachment is connected to the host and the host is in the corresponding state (Held/Holstered), the `UTransientRuntimeFragment_Attachment` will grant the ability set, your utility ability will activate, and it will apply the configured stat modifications. The reversal is handled automatically when the ability is removed (attachment detached or host state changes).

***

These pre-built utility abilities provide a powerful, data-driven, and consistent way to handle common stat modifications introduced by attachments, significantly reducing the amount of custom ability logic developers need to write for these scenarios. By subclassing and configuring them, you can quickly define diverse attachment effects.
