# Attachment System

One of the most powerful and flexible features of this inventory system is the **Attachment System**. It allows items to be designated as capable of **hosting** other items (attachments) in specific slots and define their slot specific behaviour. This enables complex item customization, such as adding scopes, grips, and magazines to weapons, or socketing gems into armor, all handled through a unified, fragment-based approach.

### Purpose: Modular Item Customization

The core goal is to allow:

* **Defining Attachment Slots:** Specify arbitrary slots on a "host" item using Gameplay Tags (e.g., `Lyra.Attachment.Slot.Scope`, `Lyra.Attachment.Slot.Underbarrel`).
* **Defining Compatibility:** Control which specific attachment items can go into which slots on a particular host item.
* **Define Dynamic Behavior:** Dictate what happens when an attachment is successfully added to a host. This includes:
  * Spawning and attaching visual **Actors** (e.g., a scope mesh appearing on a rifle).
  * Granting **Gameplay Abilities** (e.g., an underbarrel grenade launcher granting a "Fire Grenade" ability).
  * Adding **Input Mappings** or **Input Configs** (e.g., a laser sight adding a keybind to toggle it).
  * Modifying host item **Stats** (e.g., a stock changing recoil, typically via abilities affecting Tag Attributes on the host's Equipment Instance or Stat Tags on its Item Instance).
* **Nested Attachments:** Allow attachments themselves to act as hosts for further attachments, enabling deep and complex customization chains (e.g., a scope with its own rail for a micro red-dot sight).
* **Runtime Modification:** Players can add and remove attachments dynamically during gameplay.

### Core Concepts & Components

The system revolves around the interplay between a static fragment on the definition and a runtime fragment on the instance:

1. **`UInventoryFragment_Attachment` (Static Fragment):**
   * Added to an `ULyraInventoryItemDefinition`. Its presence on an item definition solely makes that item a **HOST** capable of accepting other attachments.
   * **Configuration Hub:** This is where you define:
     * `CompatibleAttachments`: A map specifying the slots the host offers (`FGameplayTag`) and, for each slot, which attachment item definitions (`TSubclassOf<ULyraInventoryItemDefinition>`) are allowed, along with their specific `FAttachmentDetails` (behavior upon attachment).
     * `DefaultAttachments`: A map allowing the host item to spawn with certain attachments pre-installed.
2. **`UTransientRuntimeFragment_Attachment` (Runtime Fragment - UObject):**
   * Automatically created for any `ULyraInventoryItemInstance` whose definition includes the static `UInventoryFragment_Attachment`.
   * **Live Management:** Stores the `AttachmentArray` (a replicated list of currently attached `FAppliedAttachmentEntry` items).
   * **State-Driven Behavior:** Monitors the host item's state (Held/Holstered) and activates/deactivates the visual, ability, and input effects of attached items based on their configured `FAttachmentDetails`.
   * **Handles Nesting & Replication:** Manages the complexities of nested attachments and ensures the state of attached items (including their own runtime fragments) is replicated.
3. **`FAttachmentAbilityData_SourceAttachment` (Source Data Struct):**
   * A specialized locator struct (derived from `FAbilityData_SourceItem`) used by GAS to safely and uniquely identify an item within an attachment slot, even if deeply nested.
4. **`ULyraGameplayAbility_FromAttachment` (Ability Base Class):**
   * The recommended base class for Gameplay Abilities that are _granted by an attachment_. It provides convenient helper functions to access the attachment itself, its parent (host) item, and the root equipment context.
5. **Utility Abilities (e.g., `GA_EquipmentAttributeModifier`, `GA_MagazineStatModifier`):**
   * Pre-built Gameplay Abilities (subclassed from `ULyraGameplayAbility_FromAttachment`) designed to simplify common attachment tasks like modifying host equipment stats (Tag Attributes) or host item stats (Stat Tags like magazine capacity). These are configured and added to `AbilitySetsToGrant` within the `FAttachmentDetails`.

### Attachment Examples

<div class="collapse">
<p class="collapse-title">Simple Visual Attachment (Scope)</p>
<div class="collapse-content">

**Goal:** Attach a scope mesh to a rifle. The scope itself grants no new abilities but provides a visual change.

1. **Define Items & Fragments:**
   * **Host Item (`ID_Rifle_Marksman`):**
     * Has `UInventoryFragment_EquippableItem` (linked to `ED_Rifle_Marksman`).
     * Has `UInventoryFragment_Attachment` with the following in `CompatibleAttachments`:
       * Key: `Lyra.Attachment.Slot.Optic`
       * Value (`FAttachmentSlotDetails`):
         * `AttachmentDetailsMap`:
           * Key: `ID_Attachment_Scope_4x`
           * Value (`FAttachmentDetails`):
             * `AttachmentIcon`: `T_UI_Icon_OpticSlot`
             * `HolsteredAttachmentSettings`:
               * `ActorSpawnInfo`: `ActorToSpawn = BP_Scope_4x_HolsteredVariant`, `AttachSocket = rifle_optic_socket`, `AttachTransform = (Adjusted for holstered view)`
             * `HeldAttachmentSettings`:
               * `ActorSpawnInfo`: `ActorToSpawn = BP_Scope_4x_Attached`, `AttachSocket = rifle_optic_socket`, `AttachTransform = (Identity or fine-tuned for held view)`
   * **Attachment Item (`ID_Attachment_Scope_4x`):**
     * Has `UInventoryFragment_InventoryIcon` (for UI).
     * Has `UInventoryFragment_PickupItem` (to be droppable, specifying `SM_Scope_4x_Pickup` mesh).
     * _(Does NOT need `UInventoryFragment_Attachment` unless it can host further attachments)._
   * **Actor Blueprints:**
     * `BP_Scope_4x_Attached`: Contains the scope mesh intended for when the rifle is held.
     * `BP_Scope_4x_HolsteredVariant`: (Optional) A different mesh or LOD for when the rifle (and scope) are holstered.
2. **Runtime Behavior (Simplified):**
   * Player has `ID_Rifle_Marksman` equipped (instance: `RifleInstance`).
   * Player adds `ID_Attachment_Scope_4x` (instance: `ScopeInstance`) to the `Lyra.Attachment.Slot.Optic` on `RifleInstance` (e.g., via UI drag-drop triggering server-side `AddAttachmentToItemInstance`).
   * The `UTransientRuntimeFragment_Attachment` on `RifleInstance`:
     * Adds an `FAppliedAttachmentEntry` for `ScopeInstance` to its `AttachmentArray`.
     * If `RifleInstance` is currently **Held** (via `bIsEquipped` on its runtime fragment):
       * It reads `HeldAttachmentSettings` from the entry.
       * It calls `SpawnAttachmentActor`, which spawns `BP_Scope_4x_Attached` and attaches it to `RifleInstance`'s held weapon actor at `rifle_optic_socket`.
     * If `RifleInstance` is currently **Holstered** (via `bIsHolstered`):
       * It reads `HolsteredAttachmentSettings` and spawns/attaches `BP_Scope_4x_HolsteredVariant`.
   * When `RifleInstance` transitions between Held and Holstered (e.g., player swaps weapons), the `OnEquipped`/`OnHolster` callbacks on its `UTransientRuntimeFragment_Attachment` trigger deactivation of the old state's actor and activation of the new state's actor for the scope.

**Result:** The scope mesh appears correctly on the rifle, changing its visual based on whether the rifle is held or holstered.

</div>
</div>

<div class="collapse">
<p class="collapse-title">Attachment Granting a Gameplay Ability (Laser Sight Toggle)</p>
<div class="collapse-content">

**Goal:** Attach a laser sight that grants the player an ability to toggle the laser on/off when the host weapon is held.

1. **Define Items & Fragments:**
   * **Host Item (`ID_Pistol_Tactical`):**
     * Has `UInventoryFragment_EquippableItem`.
     * Has `UInventoryFragment_Attachment` with `CompatibleAttachments`:
       * Key: `Lyra.Attachment.Slot.AccessoryRail`
       * Value (`FAttachmentSlotDetails`):
         * `AttachmentDetailsMap`:
           * Key: `ID_Attachment_LaserModule`
           * Value (`FAttachmentDetails`):
             * `HeldAttachmentSettings`:
               * `AbilitySetsToGrant`: `[{AS_LaserToggleAbility}]` (An Ability Set containing `GA_ToggleLaserSight`)
               * `ActorSpawnInfo`: `ActorToSpawn = BP_LaserModule_Attached` (Mesh with a controllable laser beam component)
               * `InputConfig`: (Optional) `InputConfig_LaserToggle` mapping an input action (e.g., `IA_ToggleAccessory`) to `Ability.Weapon.ToggleLaser`.
             * `HolsteredAttachmentSettings`: (Laser actor might be hidden or off, no abilities/input).
   * **Attachment Item (`ID_Attachment_LaserModule`):** Standard Icon/Pickup fragments.
   * **Ability Set (`AS_LaserToggleAbility`):** Contains `GA_ToggleLaserSight`.
   * **Gameplay Ability (`GA_ToggleLaserSight`):**
     * Inherits from `ULyraGameplayAbility_FromAttachment`.
     * In `ActivateAbility`:
       * Uses `GetAssociatedAttachmentItem()` to get the laser module instance.
       * Uses `GetSpawnAttachmentActor()` to get the `BP_LaserModule_Attached` actor instance.
       * Calls a function/event on `BP_LaserModule_Attached` to toggle its laser beam visibility/effect.
       * When ability is removed, turn off the laser beam
   * **Actor Blueprint (`BP_LaserModule_Attached`):** Contains the laser mesh and a `UParticleSystemComponent` or `UNiagaraComponent` for the laser beam, with functions to toggle its visibility.
2. **Runtime Behavior (Simplified):**
   * Player attaches `ID_Attachment_LaserModule` to `ID_Pistol_Tactical`'s accessory rail.
   * Pistol is **Held**:
     * The `UTransientRuntimeFragment_Attachment` on the pistol instance:
       * Spawns `BP_LaserModule_Attached`.
       * Grants `AS_LaserToggleAbility` to the player's ASC (Source Object will be the pistol instance, Dynamic Source Tag will be `Lyra.Attachment.Slot.AccessoryRail`).
       * (If configured) Adds `InputConfig_LaserToggle` to the player's input.
   * Player presses the input mapped in `InputConfig_LaserToggle` (e.g., 'L' key).
   * `GA_ToggleLaserSight` activates. It finds its spawned laser actor and toggles the beam.
   * Pistol is **Holstered**:
     * Abilities and Input Config from the laser module are removed. The `BP_LaserModule_Attached` might be destroyed and replaced by a holstered variant or simply hidden/disabled by its logic.

**Result:** Player gains a new ability (and potentially input) to control the laser sight only when the pistol with the laser attached is actively held.

</div>
</div>

<div class="collapse">
<p class="collapse-title">Nested Attachments &#x26; Stat Modification (Magazine with Baseplate)</p>
<div class="collapse-content">

**Goal:** A rifle magazine (`ID_Attachment_Magazine_30Rnd`) attaches to a rifle. This magazine _itself_ can host a "Magazine Baseplate" attachment (`ID_Attachment_MagBase_Tactical`). The baseplate slightly improves the _rifle's_ reload speed (a Tag Attribute on the rifle's `ULyraEquipmentInstance`), and the magazine itself defines the _rifle's_ magazine capacity (a Stat Tag on the rifle's `ULyraInventoryItemInstance`).

1. **Define Items & Fragments:**
   * **Host Item (`ID_Rifle_Carbine`):**
     * Has `UInventoryFragment_EquippableItem` (links to `ED_Rifle_Carbine`).
       * `ED_Rifle_Carbine`'s `Instance Type` is `ULyraWeaponInstance` (or a subclass). This instance will have the `Weapon.Stat.ReloadSpeedMultiplier` Tag Attribute.
     * Has `UInventoryFragment_SetStats` that _might_ initialize `Weapon.Ammo.MagazineCapacity` to a default (e.g., if no magazine is attached).
     * Has `UInventoryFragment_Attachment` with `CompatibleAttachments`:
       * Key: `Lyra.Attachment.Slot.MagazineWell`
       * Value (`FAttachmentSlotDetails`):
         * `AttachmentDetailsMap`:
           * Key: `ID_Attachment_Magazine_30Rnd`
           * Value (`FAttachmentDetails` for the 30Rnd Magazine):
             * `HeldAttachmentSettings`:
               * `ActorSpawnInfo`: Spawns `BP_Magazine_30Rnd_Attached`.
               * `AbilitySetsToGrant`: `[{AS_Magazine_30Rnd_Effects}]`
             * `HolsteredAttachmentSettings`: (Likely just ActorSpawnInfo).
   * **First-Level Attachment (`ID_Attachment_Magazine_30Rnd`):**
     * Standard Icon/Pickup fragments.
     * **Crucially, also has `UInventoryFragment_Attachment`** with `CompatibleAttachments`:
       * Key: `Lyra.Attachment.Slot.MagazineBaseplate`
       * Value (`FAttachmentSlotDetails`):
         * `AttachmentDetailsMap`:
           * Key: `ID_Attachment_MagBase_Tactical`
           * Value (`FAttachmentDetails` for the Tactical Baseplate _when attached to this magazine_):
             * `HeldAttachmentSettings`:
               * `ActorSpawnInfo`: Spawns `BP_MagBase_Tactical_Attached`.
               * `AbilitySetsToGrant`: `[{AS_MagBaseplate_Tactical_Effects}]`
             * `HolsteredAttachmentSettings`: (Likely just ActorSpawnInfo).
   * **Second-Level Attachment (`ID_Attachment_MagBase_Tactical`):** Standard Icon/Pickup fragments.
2. **Define Abilities & Effects:**
   * **Ability Set (`AS_Magazine_30Rnd_Effects`):**
     * Contains an instance of your **`GA_MagazineStatModifier`** subclass (e.g., `GA_Magazine_Set30RndCapacity`).
       * `GA_Magazine_Set30RndCapacity` Defaults: Configured to set the `Weapon.Ammo.MagazineCapacity` **Stat Tag** on the _host equipment's item instance_ to `30`.
   * **Ability Set (`AS_MagBaseplate_Tactical_Effects`):**
     * Contains an instance of your **`GA_EquipmentAttributeModifier`** subclass (e.g., `GA_MagBaseplate_ReloadBonus`).
       * `GA_MagBaseplate_ReloadBonus` Defaults: Its `FloatStatModification` array is configured with:
         * `Tag`: `Weapon.Stat.ReloadSpeedMultiplier`
         * `ModificationValue`: `0.95` (example for 5% faster)
         * `ModOp`: `Multiply`
3. **Runtime Behavior (Simplified):**
   * Player has `ID_Rifle_Carbine` (`RifleInstance`) equipped and **Held**.
   * **Step A: Magazine Attached**
     * Player attaches `ID_Attachment_Magazine_30Rnd` (`MagInstance`) to `RifleInstance`'s `MagazineWell` slot.
     * The `UTransientRuntimeFragment_Attachment` on `RifleInstance` activates `MagInstance`'s behaviors because the rifle is Held.
     * `AS_Magazine_30Rnd_Effects` is granted.
     * `GA_Magazine_Set30RndCapacity` (subclass of your `GA_MagazineStatModifier`) activates:
       * It uses `GetAssociatedEquipmentItem()` to get `RifleInstance`.
       * It calls `RifleInstance->SetStatTagStack(TAG_Weapon_Ammo_MagazineCapacity, 30)`.
       * (It also handles potential ammo overflow/underflow logic if the capacity changes while ammo is present).
     * The rifle now effectively has a 30-round magazine capacity.
   * **Step B: Baseplate Attached to Magazine**
     * Player attaches `ID_Attachment_MagBase_Tactical` (`BaseplateInstance`) to `MagInstance`'s `MagazineBaseplate` slot.
     * Since `MagInstance` is active (because `RifleInstance` is Held), `MagInstance`'s `UTransientRuntimeFragment_Attachment` activates `BaseplateInstance`'s behaviors.
     * `AS_MagBaseplate_Tactical_Effects` is granted. The `SourceObject` for this grant is `MagInstance`.
     * `GA_MagBaseplate_ReloadBonus` (subclass of your `GA_EquipmentAttributeModifier`) activates:
       * It uses `GetAssociatedEquipmentInstance()` to correctly find the `ULyraEquipmentInstance` of the root `RifleInstance`.
       * It iterates its preconfigured `FloatStatModification` array.
       * It calls `RifleEquipmentInstance->ModifyTagAttribute(Weapon.Stat.ReloadSpeedMultiplier, 0.95, EFloatModOp::Multiply)` and stores the returned `FFloatStatModification` handle internally.
     * The rifle's `ReloadSpeedMultiplier` Tag Attribute is now modified.
   * **Step C: Baseplate Removed**
     * Player removes `BaseplateInstance` from `MagInstance`.
     * `GA_MagBaseplate_ReloadBonus` is removed from the ASC.
     * Its `EndAbility` (or similar cleanup) logic iterates its stored `FFloatStatModification` handles and calls `RifleEquipmentInstance->ReverseTagAttributeModification()` for each, restoring the rifle's reload speed.
   * **Step D: Magazine Removed**
     * Player removes `MagInstance` from `RifleInstance`.
     * `GA_Magazine_Set30RndCapacity` is removed.
     * Its `EndAbility` logic would revert the `Weapon.Ammo.MagazineCapacity` Stat Tag on `RifleInstance` (perhaps to a default value, or another magazine's value if one is swapped in).
     * Since `BaseplateInstance` was attached to `MagInstance`, its effects are also implicitly deactivated and cleaned up because its parent attachment (`MagInstance`) is no longer active in the context of the rifle.

**Result:**

* The rifle's magazine capacity (a Stat Tag on its Item Instance) is directly controlled by the attached magazine's specialized `GA_MagazineStatModifier`.
* An attachment _on the magazine_ (the baseplate) can correctly modify stats (Tag Attributes) on the _root weapon's Equipment Instance_ using the specialized `GA_EquipmentAttributeModifier` and its helper `GetAssociatedEquipmentInstance()`.
* Changes are properly reversed when attachments are removed due to the abilities storing modification handles or performing cleanup in their `RemoveAbility`.

</div>
</div>

These examples demonstrate the versatility of the attachment system: purely visual changes, adding new abilities/inputs, and even creating nested structures that can influence the host item's core stats. The key is careful configuration of the `CompatibleAttachments` map and the `FAttachmentDetails` within the host item's `UInventoryFragment_Attachment`.

### Structure of this Section

Due to its depth, the Attachment System documentation is broken into the following detailed sub-pages:

* **Concepts & Setup:** How to configure `UInventoryFragment_Attachment` (`CompatibleAttachments`, `DefaultAttachments`), define slots with tags, and set up `FAttachmentDetails` behavior.
* **Runtime (`UTransientRuntimeFragment_Attachment`):** Details on how the runtime fragment manages the `AttachmentArray`, applies behaviors based on host state (Held/Holstered), handles nesting, and replicates state.
* **GAS & API:** How to interact with attachments via Gameplay Abilities (`ULyraGameplayAbility_FromAttachment`), the `FAttachmentAbilityData_SourceAttachment` locator struct, the `UAttachmentFunctionLibrary` helpers, and relevant Gameplay Messages.
* &#x20;**Provided Attachment Utility Abilities:** A guide to the pre-built abilities like `GA_EquipmentAttributeModifier` and `GA_MagazineStatModifier`, explaining their purpose, configuration, and how to use them to easily implement common attachment effects.

***

This overview introduces the Attachment System as a powerful, fragment-driven feature for modular item customization. It highlights the key components involved – the static definition fragment, the dynamic runtime fragment, and supporting GAS elements – setting the stage for a deeper look into its configuration and runtime behavior.
