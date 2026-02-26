# Concept & Setup

This page focuses on configuring the **static** aspects of the attachment system using the `UInventoryFragment_Attachment`. This fragment is added to an `ULyraInventoryItemDefinition` to enable it to either **host attachments** or **be an attachment** itself (or both). The configuration done here dictates the rules, available slots, and the _potential_ behaviors of attachments.

### Adding the Fragment

1. **Open Item Definition:** Open the `ULyraInventoryItemDefinition` asset for the item you want to modify (e.g., `ID_Rifle_Standard`, `ID_Attachment_Scope`).
2. **Add Fragment:** In the Details panel, add `InventoryFragment_Attachment` to the `Fragments` array.

Adding this fragment signals to the system that this item type participates in the attachment system and enables the creation of the necessary `UTransientRuntimeFragment_Attachment` on its instances at runtime.

### Core Configuration Properties

The primary configuration happens within the properties of the added `UInventoryFragment_Attachment` instance:

<img src=".gitbook/assets/Screenshot 2025-05-23 011621.png" alt="" title="">

* **`Compatible Attachments` (TMap<`FAttachmentSlotTagKey`, `FAttachmentSlotDetails`>)**
  * **Purpose:** Defines the slots this item offers to host other attachments and specifies exactly which attachments are allowed in each slot and how they behave when attached.
  * **Structure:**
    * **Key (`FAttachmentSlotTagKey`):**
      * Similar to the equipment system, this is a custom struct designed to hold an `FGameplayTag` for an attachment slot.
      * **`FAttachmentSlotTagKey` filters the Gameplay Tag picker in the Unreal Editor to only show `GameplayTag`s that are children of a predefined parent tag (i.e., `Lyra.Attachment.Slot`).**
      * This ensures all attachment slot tags follow a consistent pattern (like `Lyra.Attachment.Slot.Optic`, `Lyra.Attachment.Slot.Muzzle`), enhancing organization and reducing errors during setup.
    * **Value (`FAttachmentSlotDetails`):** A struct containing another map specific to this slot:
      * `AttachmentDetailsMap` (`TMap<TSubclassOf<ULyraInventoryItemDefinition>, FAttachmentDetails>`):
        * **Key (`TSubclassOf<ULyraInventoryItemDefinition>`):** The specific Item Definition class of an attachment that is allowed in this slot (e.g., `ID_Attachment_RedDot`, `ID_Attachment_Scope4x`).
        * **Value (`FAttachmentDetails`):** A struct defining the exact behavior applied when this specific attachment (ItemDefinition key) is placed into this specific slot (whose tag is held by the `FAttachmentSlotTagKey`) on the host item. (See `FAttachmentDetails` breakdown below).
  * _Example:_ On `ID_Rifle_Standard`, the `CompatibleAttachments` map might have:
    * An entry where `FAttachmentSlotTagKey` holds `Lyra.Attachment.Slot.Optic`. The corresponding `FAttachmentSlotDetails` would then contain:
      * Map Key: `ID_Attachment_RedDot` -> Value: `FAttachmentDetails` for Red Dot behavior.
      * Map Key: `ID_Attachment_Scope4x` -> Value: `FAttachmentDetails` for 4x Scope behavior.
    * Another entry where `FAttachmentSlotTagKey` holds `Lyra.Attachment.Slot.Underbarrel`, with its own compatible item definitions and behaviors.
* **`Default Attachments` (TMap<`FAttachmentSlotTagKey`, `TSubclassOf<ULyraInventoryItemDefinition>`>)**
  * **Purpose:** Allows this item definition to spawn with certain attachments already pre-installed in specific slots.
  * **Structure:**
    * **Key (`FAttachmentSlotTagKey`):**
      * Identical in function to the key in `CompatibleAttachments`. It uses the same struct and editor filtering mechanism, ensuring that default attachments are assigned to correctly defined `Lyra.Attachment.Slot.*` tags.
      * The attachment slot specified here _must_ also be defined as a key in the `CompatibleAttachments` map for this item.
    * **Value (`TSubclassOf<ULyraInventoryItemDefinition>`):** The Item Definition of the attachment that should be pre-installed in this slot. This definition must also be listed as compatible for this slot within the `CompatibleAttachments` map.
  * **Runtime:** When an instance of the host item is created, the `UInventoryFragment_Attachment::CreateNewRuntimeTransientFragment` logic iterates through this map, creates instances of the specified default attachments, and adds them to the runtime fragment's `AttachmentArray`.

### Defining Attachment Behavior: `FAttachmentDetails` & `FAttachmentBehaviour`

The `FAttachmentDetails` struct, found as the value in the `AttachmentDetailsMap`, is where you specify the precise effects of attaching a particular item to a particular slot. It separates behaviors based on whether the **host item** is currently **Held** or **Holstered**.

* **`FAttachmentDetails` Properties:**
  * **`Attachment Icon` (`TObjectPtr<UTexture2D>`)**: (Optional) An icon for the UI to display _for the slot itself_ (e.g., a generic scope silhouette for an optic slot, distinct from the icon of the actual attached scope).
  * **`Holstered Attachment Settings` (`FAttachmentBehaviour`)**: Defines the attachment's effects when the **host item is Holstered**.
  * **`Held Attachment Settings` (`FAttachmentBehaviour`)**: Defines the attachment's effects when the **host item is Actively Held**.
* **`FAttachmentBehaviour` Properties (for both Holstered and Held settings):**
  * **`Ability Sets To Grant` (`TArray<TObjectPtr<const ULyraAbilitySet>>`)**: An array of `ULyraAbilitySet` assets. When the host item enters the corresponding state (Holstered/Held) with this attachment active, these ability sets are granted to the host item's owner (via the `UTransientRuntimeFragment_Attachment`).
    * _Use Case (Held):_ A scope granting a zoom ability, a grip granting a passive recoil reduction effect (via a Gameplay Effect in the set).
    * _Use Case (Holstered):_ Rocket jump ability from rocket shoes, or a jetpack ability from wearing a jetpack as these equipment typically wouldn't be held just holstered.
  * **`Actor Spawn Info` (`FLyraEquipmentActorToSpawn`)**: Defines a visual actor to spawn and attach to the host item's corresponding spawned actor.
    * `ActorToSpawn` (`TSubclassOf<AActor>`): The Blueprint or C++ Actor class for the attachment's visual mesh (e.g., `BP_ScopeMesh_MainViewModel`).
    * `AttachSocket` (`FName`): The socket name on the _host item's spawned actor_ where this attachment actor should be attached.
    * `AttachTransform` (`FTransform`): The relative transform (offset, rotation, scale) from the `AttachSocket`.
    * **Important:** The root component of the `ActorToSpawn` should ideally be a `UStaticMeshComponent` or `USkeletalMeshComponent` for reliable visual attachment.
  * **`Input Mappings` (`TArray<FPawnInputMappingContextAndPriority>`)**: An array to add specific `UInputMappingContext`s to the player's Enhanced Input subsystem when the attachment is active in this state.
  * **`Input Config` (`TObjectPtr<ULyraInputConfig>`)**: An `ULyraInputConfig` to add to the player's `ULyraHeroComponent` when the attachment is active in this state, mapping input actions to ability tags.

**Key Considerations for Behavior:**

* **Host State Driven:** The effects (actors, abilities, input) defined in `FAttachmentDetails` are applied by the host item's `UTransientRuntimeFragment_Attachment` _based on the host item's current Held/Holstered state_.
* **Relative Transforms:** The `AttachTransform` for `ActorSpawnInfo` is relative to the specified socket on the _host item's spawned actor_. This allows precise positioning of the attachment model on the host model.

### Workflow Example (Configuring an Optic Slot)

1. **Host Item:** `ID_Rifle_AR15` (`UInventoryFragment_Attachment` added).
2. **Attachment Items:**
   * `ID_Attachment_RedDotSight`
   * `ID_Attachment_Scope4x`
3. **Configure `ID_Rifle_AR15`'s Fragment:**
   * In `CompatibleAttachments`, add a new entry:
     * **Key:** `Lyra.Attachment.Slot.Optic`
     * **Value (`FAttachmentSlotDetails`):**
       * `AttachmentDetailsMap`:
         * **Entry 1 Key:** `ID_Attachment_RedDotSight`
         * **Entry 1 Value (`FAttachmentDetails` for Red Dot):**
           * `AttachmentIcon`: `T_UI_Icon_OpticSlotDefault`
           * `HolsteredAttachmentSettings`: `ActorSpawnInfo` -> `BP_RedDot_Attached` (possibly a low-poly or covered version if rifle is holstered)
           * `HeldAttachmentSettings`:
             * `ActorSpawnInfo` -> `BP_RedDot_Attached` (main visual mesh)
             * `AbilitySetsToGrant`: (Optional) `AS_RedDotAimAssist` (if it provides a unique aiming passive)
         * **Entry 2 Key:** `ID_Attachment_Scope4x`
         * **Entry 2 Value (`FAttachmentDetails` for 4x Scope):**
           * `AttachmentIcon`: `T_UI_Icon_OpticSlotDefault`
           * `HolsteredAttachmentSettings`: `ActorSpawnInfo` -> `BP_Scope4x_Attached`
           * `HeldAttachmentSettings`:
             * `ActorSpawnInfo` -> `BP_Scope4x_Attached`
             * `AbilitySetsToGrant`: `AS_Scope4x_ZoomAbility` (contains `GA_ToggleZoom`)
             * `InputConfig`: `InputConfig_ScopeZoomControls` (maps middle mouse to activate `Ability.Scope.ToggleZoom`)
4. **Create Assets:** Ensure `BP_RedDot_Attached`, `BP_Scope4x_Attached`, `AS_RedDotAimAssist`, `AS_Scope4x_ZoomAbility`, and `InputConfig_ScopeZoomControls` are created and configured.

***

By meticulously configuring the `CompatibleAttachments` map (including `FAttachmentDetails` and `FAttachmentBehaviour`) within an item's `UInventoryFragment_Attachment`, designers define the precise rules for which attachments can be used, where they fit, and what visual, ability, and input changes they introduce when connected to a host item in its different states (Held/Holstered). This static setup is then brought to life by the `UTransientRuntimeFragment_Attachment` at runtime.
