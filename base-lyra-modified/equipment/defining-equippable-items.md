# Defining Equippable Items

This section explains how you define the _behavior_ and _visuals_ of items when they are equipped by a character. The system uses a data-driven approach, primarily centered around two key assets:

1. **`UInventoryFragment_EquippableItem`**: A small piece added to your _inventory item definition_.
2. **`ULyraEquipmentDefinition`**: A dedicated `UObject` detailing the equipment-specific properties.

Think of it like this: The inventory item knows _what_ it is (a rifle, a helmet), and the `UInventoryFragment_EquippableItem` acts as a signpost saying, "Hey, I'm equippable! Look over _here_ (`ULyraEquipmentDefinition`) for the details on _how_ I work when equipped, including which slots I can go into."

***

### The Bridge: `UInventoryFragment_EquippableItem`

Before the Equipment System can do anything with an inventory item, that item needs to explicitly state that it _can_ be equipped. This is done by adding the `UInventoryFragment_EquippableItem` fragment to the item's `ULyraInventoryItemDefinition`.

<img src=".gitbook/assets/image (86).png" alt="" title="Pistol Item Definition pointing to EquipmentDefinition WID_Pistol ">

**Purpose:**

* **Flags the item as equippable:** Tells the `ULyraEquipmentManagerComponent` that this item type can potentially be processed.
* **Links to the Equipment Definition:** Contains the crucial pointer to the `ULyraEquipmentDefinition` asset that holds all the specific equipment behavior.

**Key Property:**

* `Equipment Definition` (`TSubclassOf<ULyraEquipmentDefinition>`): **This is the most important field.** Assign the specific `ULyraEquipmentDefinition` asset (which you'll create next, e.g., `ED_Rifle`) that defines this item's equipped behavior.

**How to Add:**

1. Open the `ULyraInventoryItemDefinition` Blueprint for the item you want to make equippable (e.g., `ID_Rifle`).
2. In the **Details** panel, find the `Fragments` array property.
3. Click the **+** (Add Element) button.
4. In the dropdown for the new fragment element, search for and select `InventoryFragment_EquippableItem`.
5. Expand the newly added fragment.

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/LinkEquipmentDefinition.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Link Equipment Definition
{% endfile %}

> [!info]
> An item definition _must_ have this fragment with a valid `Equipment Definition` assigned for the `ULyraEquipmentManagerComponent::EquipItemToSlot` function (and related functions) to succeed.

***

### The Recipe: `ULyraEquipmentDefinition`

This Data Asset is where you define _everything_ about how an item behaves once it's managed by the `ULyraEquipmentManagerComponent`.

<img src=".gitbook/assets/image (87).png" alt="" title="Pistol EquipmentDefinition WID_Pistol">

**Key Properties Breakdown:**

1. **`Instance Type` (`TSubclassOf<ULyraEquipmentInstance>`)**
   * Specifies the C++ or Blueprint class to be instantiated at runtime when this item is equipped.
   * Defaults to `ULyraEquipmentInstance`.
   * You can create subclasses of `ULyraEquipmentInstance` (e.g., `B_WeaponInstance`, `B_ArmorInstance`) if you need custom Blueprint logic (like handling ammo display) or specific C++ functionality tied to the _runtime instance_ of the equipment. Leave as default if you don't need custom instance logic.
2. **`Equipment Slot Details` (Map: `FEquipmentSlotTagKey` -> `FLyraEquipmentDetails`)**
   * **Purpose:** Defines behavior when the item is **Holstered** in a specific slot. This `TMap` is central to the system's slot flexibility. You are not limited to a predefined set of slots. By adding new `FEquipmentSlotTagKey` entries to this map (which internally represent specific `FGameplayTag`s), you effectively define new potential equipment slots that the `ULyraEquipmentManagerComponent` can manage for _this specific item type_. The manager itself does not impose any restrictions on these tags beyond what is defined here.
   * **The Key (`FEquipmentSlotTagKey`):**
     * This is a custom struct specifically designed to hold an `FGameplayTag` intended for an equipment slot.
     * **Crucially, `FEquipmentSlotTagKey` is configured in C++ to filter the Gameplay Tag picker in the Unreal Editor. When you assign a tag to this key, the editor will only show you `GameplayTag`s that are children of a predefined parent tag (i.e., `Lyra.Equipment.Slot`).**
     * This ensures that all equipment slot tags adhere to a consistent hierarchy (like `Lyra.Equipment.Slot.Weapon.Primary`, `Lyra.Equipment.Slot.Armor.Helmet`), preventing typos and miscategorization. While the runtime system uses the underlying `FGameplayTag`, the struct provides this essential editor-time safety and organization.
   * **The Value (`FLyraEquipmentDetails`):**
     * `Ability Sets To Grant` (`TArray<ULyraAbilitySet*>`): Ability Sets (GAS) to grant _only_ when the item is holstered in this specific slot.
     * `Actors To Spawn` (`TArray<FLyraEquipmentActorToSpawn>`): Actors to spawn and attach _only_ when the item is holstered in this specific slot.
       * `ActorToSpawn` (`TSubclassOf<AActor>`): The Blueprint or C++ Actor class to spawn.
       * `Attach Socket` (`FName`): The socket name on the Pawn's mesh.
       * `Attach Transform` (`FTransform`): Relative offset/rotation/scale.
   * _Example:_ For `ED_Rifle`, you might add an entry where the `FEquipmentSlotTagKey` holds the `Lyra.Equipment.Slot.Weapon.Back` tag. The `FLyraEquipmentDetails` for this entry might specify spawning a `BP_RifleMesh_OnBack` actor attached to a `spine_socket`.
3. **`bCanBeHeld` (`bool`)**
   * A simple flag determining if this piece of equipment can be actively wielded by the player (transitioned to the "Held" state).
   * Set to `true` for items like weapons or tools that the player actively uses.
   * Set to `false` for items like armor, helmets, or passive charms that are only ever "Holstered".
   * The `ULyraEquipmentManagerComponent::HoldItem` function will fail if this is `false`.
4. **`Active Equipment Details` (`FLyraEquipmentDetails`)**
   * **Purpose:** Defines behavior when the item is actively **Held**. This section is ignored if `bCanBeHeld` is `false`.
   * `Ability Sets To Grant`: Ability Sets (GAS) to grant _only when the item is held_. This is where you'd typically grant abilities like `GA_FireWeapon`, `GA_Reload`, `GA_AimDownSights`.
   * `Actors To Spawn`: Actors to spawn and attach _only when the item is held_. This is typically where you'd spawn the main weapon mesh that attaches to the character's hands (e.g., `BP_RifleMesh_InHands` attached to `hand_r_socket`).

**How to Create:**

1. In the Content Browser, right-click -> Blueprint -> BlueprintClass.
2. Choose `LyraEquipmentDefinition` as the parent class.
3. Give it a descriptive name, often prefixed with `ED_` (e.g., `ED_Rifle`, `ED_Helmet`).

> [!info]
> Weapon Equipment Definition in ShooterBase are prefixed with `WID_`  (Weapon Item Definition), this is what Lyra used so I stuck with it.

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/create_equipment_definition.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Create Equipment Definition
{% endfile %}

***

### Workflow: Creating a New Equippable Item

Here's the typical process from start to finish:

1. **Define Gameplay Tags (If Needed):** Ensure you have `FGameplayTag`s defined for any new equipment slots you require (e.g., in `Config/DefaultGameplayTags.ini`). Example: `Equipment.Slot.Gadget.Hip`.
2. **Create Inventory Item Definition (`ULyraInventoryItemDefinition`):**
   * Create your base inventory item (e.g., `ID_Gadget_GrapplingHook`). Set up display name, etc.
3. **Create Equipment Definition (`ULyraEquipmentDefinition`):**
   * Create the Data Asset (e.g., `ED_Gadget_GrapplingHook`).
   * Configure its properties:
     * Decide if it needs a custom `Instance Type`.
     * Add entries to `Equipment Slot Details` for relevant slots (e.g., map `Equipment.Slot.Gadget.Hip` to details specifying a holstered mesh actor `BP_Grapple_Holstered`).
     * Set `bCanBeHeld` (likely `true` for a grappling hook).
     * Configure `Active Equipment Details` (grant `GA_FireGrapple` ability, spawn `BP_Grapple_InHand` actor).
4. **Link Item to Equipment Definition:**
   * Open the `ID_Gadget_GrapplingHook` asset.
   * Add the `InventoryFragment_EquippableItem` fragment.
   * Assign your newly created `ED_Gadget_GrapplingHook` to the `Equipment Definition` property within the fragment.
5. **Create Actors & Ability Sets:** Create the necessary Actor Blueprints (`BP_Grapple_Holstered`, `BP_Grapple_InHand`) and Gameplay Ability Sets (`GAS_GrappleAbilities`) referenced in the `ULyraEquipmentDefinition`.
6. **Test:** Use the `ULyraEquipmentManagerComponent` (e.g., via debug commands or gameplay logic) to equip the `ID_Gadget_GrapplingHook` to the `Equipment.Slot.Gadget.Hip` slot, then try holding it to verify actors spawn correctly and abilities are granted.

***

### Example Configurations

Let's contrast a typical weapon and a piece of armor:

**Example 1: `ED_AssaultRifle`**

* `Instance Type`: `B_WeaponInstance` (Custom BP class to handle ammo display).
* `Equipment Slot Details`:
  * Key: `Lyra.Equipment.Slot.Weapon.Primary` -> Value: Spawn `BP_RifleMesh_Holstered` on `back_socket`, no abilities.
  * Key: `Lyra.Equipment.Slot.Weapon.Secondary` -> Value: Spawn `BP_RifleMesh_Holstered` on `hip_socket`, no abilities.
* `bCanBeHeld`: `true`.
* `Active Equipment Details`:
  * `Ability Sets`: Grant `GAS_RifleFiringAbilities` (containing Shoot, Reload, Aim).
  * `Actors`: Spawn `BP_RifleMesh_InHands` on `hand_r_socket`.

**Example 2: `ED_HeavyHelmet`**

* `Instance Type`: `ULyraEquipmentInstance` (Default, no special instance logic needed).
* `Equipment Slot Details`:
  * Key: `Lyra.Equipment.Slot.Armor.Head` -> Value: Spawn `BP_HelmetMesh` on `head_socket`, Grant `GAS_HelmetPassiveStats` (e.g., containing a passive ability applying damage resistance).
* `bCanBeHeld`: `false`.
* `Active Equipment Details`: (Ignored because `bCanBeHeld` is false).

***

By configuring these assets, you control precisely how items transition from the inventory into functional, visible parts of your character's loadout. The next section will detail the `ULyraEquipmentManagerComponent`, which reads these definitions and brings them to life at runtime.
