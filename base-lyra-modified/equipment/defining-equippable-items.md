# Defining Equippable Items

How do you tell the system "this inventory item is a rifle that can be equipped, spawns a weapon mesh in the player's hands, and grants firing abilities"?

The answer involves two assets working together:

* **`UInventoryFragment_EquippableItem`** - Added to your inventory item definition, flagging it as equippable
* **`ULyraEquipmentDefinition`** - The actual blueprint for equipment behavior

This separation exists for a reason: your inventory item knows _what_ it is (a rifle, a helmet), while the Equipment Definition knows _how_ it behaves when equipped. Keeping them separate lets you reuse equipment behaviors across multiple item variants - ten different rifle skins can share one Equipment Definition.

***

### The Fragment: Marking Items as Equippable

The `UInventoryFragment_EquippableItem` fragment is your item's ticket into the equipment system. Without it, the Equipment Manager won't know what to do with your item.

<img src=".gitbook/assets/image (203).png" alt="" title="">

#### **Purpose:**

* **Flags the item as equippable:** Tells the `ULyraEquipmentManagerComponent` that this item type can potentially be processed.
* **Links to the Equipment Definition:** Contains the crucial pointer to the `ULyraEquipmentDefinition` asset that holds all the specific equipment behavior.

#### Adding the Fragment

{% stepper %}
{% step %}
#### Open the item definition

Open your `ULyraInventoryItemDefinition` Blueprint.
{% endstep %}

{% step %}
#### Locate Fragments

Find the `Fragments` array in Details.
{% endstep %}

{% step %}
#### Add the equippable fragment

Add `InventoryFragment_EquippableItem` and assign your Equipment Definition
{% endstep %}
{% endstepper %}

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/LinkEquipmentDefinition.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Link Equipment Definition
{% endfile %}

> [!INFO]
> The `EquipItemToSlot` function checks for this fragment. No fragment = equip fails.

<details class="gb-toggle">

<summary>Action Menu Integration</summary>

This fragment implements `IItemActionProvider` to add equip/unequip actions to the item's context menu.

| Action      | Tag                    | When Shown                          |
| ----------- | ---------------------- | ----------------------------------- |
| **Equip**   | `Ability.Item.Equip`   | Item is in inventory (not equipped) |
| **Unequip** | `Ability.Item.Unequip` | Item is currently equipped          |

**How it decides:** The fragment checks the item's `CurrentSlot` descriptor. If the slot type is `FAbilityData_EquipmentSourceItem` (meaning the item is in an equipment slot), it shows **Unequip**. Otherwise, it shows **Equip**.

**When enabled:** Both actions are enabled when `EquipmentDefinition` is valid.

> [!INFO]
> For the full action menu system, see [Context Menus & Action Logic](../ui/item-container-ui-system/interaction-and-transactions/context-menus-and-action-logic.md).

</details>

***

### The Definition: Equipment Behavior Blueprint

`ULyraEquipmentDefinition` is where you define what actually happens when equipment is equipped. The key insight is the **two-behavior model** that mirrors the [two-level slot system](/broken/pages/c9b23bc52916a98e54f08d446ce79c303ebd42e3):

* **HolsteredBehaviors** - What happens when the item is equipped but NOT held
* **HeldBehaviors** - What happens when the item IS held

<img src=".gitbook/assets/image (204).png" alt="" title="">

#### Why Two Maps?

Consider a rifle:

| State         | What You See            | What Abilities?             |
| ------------- | ----------------------- | --------------------------- |
| **Holstered** | Rifle on player's back  | Maybe passive bonuses       |
| **Held**      | Rifle in player's hands | Fire, reload, aim abilities |

These are completely different visual and mechanical states. Rather than complex state management, the system just asks "which map should I use?" based on held state.

***

### HolsteredBehaviors: Storage Slot → Behavior

```cpp
TMap<FEquipmentSlotTagKey, FLyraEquipmentDetails> HolsteredBehaviors;
```

This map is keyed by **storage slot** - where the item lives on the paperdoll. When equipment is holstered (not held), the system looks up the behavior for its current storage slot.

```
HolsteredBehaviors:
├── Equipment.Slot.Weapon.Back
│   ├── ActorsToSpawn: [BP_Rifle_OnBack → spine_03_socket]
│   └── AbilitySetsToGrant: []
│
└── Equipment.Slot.Weapon.Hip
    ├── ActorsToSpawn: [BP_Rifle_OnHip → thigh_r_socket]
    └── AbilitySetsToGrant: []
```

Different storage slots can spawn different actors. A rifle on your back looks different than one on your hip.

***

### HeldBehaviors: Held Slot → Behavior

```cpp
TMap<FGameplayTag, FLyraEquipmentDetails> HeldBehaviors;
```

This map is keyed by **held slot** - which hand is holding the item. When equipment is held, the system looks up the behavior for its active held slot.

```
HeldBehaviors:
├── Equipment.Held.Primary
│   ├── ActorsToSpawn: [BP_Rifle_InHand → hand_r]
│   ├── AbilitySetsToGrant: [GAS_RifleAbilities]
│   └── InputConfig: IC_WeaponInputs
│
└── Equipment.Held.Secondary  // For akimbo support
    ├── ActorsToSpawn: [BP_Rifle_LeftHand → hand_l]
    └── AbilitySetsToGrant: [GAS_RifleAbilities]
```

#### The Empty Map Rule

If `HeldBehaviors` is empty, the equipment **cannot be held**. This is how you define passive equipment like armor or backpacks - they exist only in storage slots, never in hands.

```cpp
// Derived from the map, not a separate property
bool CanBeHeld() const { return HeldBehaviors.Num() > 0; }
```

***

### Held Slot Policy: One Hand or Two?

```cpp
UPROPERTY(EditDefaultsOnly)
EHeldSlotPolicy HeldSlotPolicy = EHeldSlotPolicy::OneHanded;
```

This controls how weapons interact with the akimbo system:

| Policy      | Behavior                         | Example                      |
| ----------- | -------------------------------- | ---------------------------- |
| `OneHanded` | Claims only one held slot        | Pistol - can dual wield      |
| `TwoHanded` | Claims ALL held slots atomically | Rifle - blocks other weapons |

A two-handed rifle marks both Primary and Secondary slots as claimed. A one-handed pistol only claims the slot it's in, leaving the other free for a second weapon.

> [!INFO]
> For details on how the Equipment Manager handles slot claiming, see [The Akimbo System](/broken/pages/c9b23bc52916a98e54f08d446ce79c303ebd42e3#the-akimbo-system).

***

### `FLyraEquipmentDetails`: What Behaviors Contain

Both maps use the same value type:

```cpp
struct FLyraEquipmentDetails
{
    // Abilities to grant (fire, reload, etc.)
    TArray<TObjectPtr<const ULyraAbilitySet>> AbilitySetsToGrant;

    // Actors to spawn (weapon meshes)
    TArray<FLyraEquipmentActorToSpawn> ActorsToSpawn;

    // Input contexts to add
    TArray<FPawnInputMappingContextAndPriority> InputMappings;

    // Input config for ability bindings
    TObjectPtr<ULyraInputConfig> InputConfig;
};
```

#### Actor Spawn Configuration

```cpp
struct FLyraEquipmentActorToSpawn
{
    TSubclassOf<AActor> ActorToSpawn;  // The weapon BP
    FName AttachSocket;                 // Bone socket name
    FTransform AttachTransform;         // Offset
};
```

Actors spawn attached to the pawn's mesh at the specified socket. Different states can spawn completely different actors - a rifle held in hands vs. slung on back.

> [!SUCCESS]
> When it comes to input mapping and input config, you would rarely use this functionality. For inputs that are generic and can be shared amongst equipment they are better going in the player's pawn data. An example would be weapon firing and reloading, this is generic and would be better served in the hero's input mapping and input config.

***

### Instance Type: Custom Equipment Classes

```cpp
UPROPERTY(EditDefaultsOnly)
TSubclassOf<ULyraEquipmentInstance> InstanceType;
```

Most equipment uses the base `ULyraEquipmentInstance`. Override this when you need tick-based logic or cross-ability state.

| Custom Class                | Purpose                      |
| --------------------------- | ---------------------------- |
| `ULyraRangedWeaponInstance` | Weapon heat, spread recovery |
| `UGunWeaponInstance`        | Recoil tracking              |

> [!INFO]
> See [Equipment Instance](equipment-instance.md) for guidance on when to subclass.

***

### Creating Equipment: Step by Step

{% stepper %}
{% step %}
#### Plan your tags

Decide storage and held slot tags you need.

* Storage Slot (example): `Equipment.Slot.Weapon.Back` — where the item stores on body
* Held Slot (example): `Equipment.Held.Primary` — which hand holds it
{% endstep %}

{% step %}
#### Create the Equipment Definition

Right-click in Content Browser → Blueprint Class → `LyraEquipmentDefinition`\
Name it descriptively: `WID_AssaultRifle`, `WID_Pistol`, `WID_HelmetHeavy`

> [!INFO]
> Weapon Equipment Definition in ShooterBase are prefixed with `WID_`  (Weapon Item Definition), this is what Lyra used so I stuck with it.
{% endstep %}

{% step %}
#### Configure Behaviors

Example configuration for a rifle:

```
Instance Type: BP_RangedWeaponInstance
HeldSlotPolicy: TwoHanded

HolsteredBehaviors:
  Equipment.Slot.Weapon.Back:
    ActorsToSpawn: [BP_Rifle_OnBack → spine_03]
    AbilitySetsToGrant: []

HeldBehaviors:
  Equipment.Held.Primary:
    ActorsToSpawn: [BP_Rifle_InHand → hand_r]
    AbilitySetsToGrant: [GAS_RifleAbilities]
    InputConfig: IC_WeaponInputs
```
{% endstep %}

{% step %}
#### Create the Inventory Item

* Create `ULyraInventoryItemDefinition`
* Add `InventoryFragment_EquippableItem`
* Set `Equipment Definition` to your new definition
{% endstep %}

{% step %}
#### Create Supporting Assets

* Actor Blueprints for each spawn (held mesh, holstered mesh)
* Ability Sets with equipment abilities
* Input Configs if using equipment-specific bindings
{% endstep %}
{% endstepper %}

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/create_equipment_definition.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Create Equipment Definition
{% endfile %}

***

### Equipment Example Configurations

<div class="gb-stack">
<details class="gb-toggle">

<summary>Example: Pistol (Akimbo-Capable)</summary>

**ED_Pistol** - A one-handed weapon that supports dual wielding:

```
Instance Type: BP_RangedWeaponInstance
HeldSlotPolicy: OneHanded

HolsteredBehaviors:
  Equipment.Slot.Weapon.Hip:
    ActorsToSpawn: [BP_Pistol_Holstered → thigh_r]
    AbilitySetsToGrant: []

HeldBehaviors:
  Equipment.Held.Primary:
    ActorsToSpawn: [BP_Pistol_RightHand → hand_r]
    AbilitySetsToGrant: [GAS_PistolAbilities]

  Equipment.Held.Secondary:
    ActorsToSpawn: [BP_Pistol_LeftHand → hand_l]
    AbilitySetsToGrant: [GAS_PistolAbilities]
```

Because `HeldSlotPolicy` is `OneHanded` and both held slots have entries, the player can:

* Hold one pistol in Primary (right hand)
* Hold another pistol in Secondary (left hand)
* Dual wield with both equipped

</details>
<details class="gb-toggle">

<summary>Example: Heavy Helmet (Non-Holdable)</summary>

**ED_HeavyHelmet** - Passive armor that can't be held:

```
Instance Type: ULyraEquipmentInstance (default)

HolsteredBehaviors:
  Equipment.Slot.Armor.Head:
    ActorsToSpawn: [BP_HelmetMesh → head]
    AbilitySetsToGrant: [GAS_HelmetPassives]

HeldBehaviors: {}  // Empty - cannot be held
```

With empty `HeldBehaviors`:

* `CanBeHeld()` returns false
* `HoldItem()` will fail
* The helmet exists only as holstered equipment with passive effects

</details>
</div>
