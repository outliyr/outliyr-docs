# Equipment Instance

When a player equips a weapon, something has to exist at runtime to represent that equipped state - to own the spawned actors, to receive held state changes, to act as the source for granted abilities. That something is the `ULyraEquipmentInstance`.

Think of it as the **live runtime object** that exists while gear is equipped. The `ULyraEquipmentDefinition` says "this rifle spawns this actor and grants these abilities" - the Equipment Instance is what actually makes that happen during gameplay.

***

### The Lifecycle

Understanding when Equipment Instances exist clarifies their role:

```
                                    EQUIPMENT INSTANCE LIFETIME
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  Item in Inventory          Item Equipped              Item Unequipped          │
│  ─────────────────          ─────────────              ────────────────         │
│                                                                                 │
│  ┌──────────────┐           ┌────────────────────┐      ┌──────────────┐        │
│  │ No Equipment │ ──Equip─► │ Equipment Instance │ ─►   │ Instance     │        │
│  │ Instance     │           │ EXISTS             │      │ Destroyed    │        │
│  └──────────────┘           └────────────────────┘      └──────────────┘        │
│                                    │                                            │
│                                    ├── Holds SpawnedActors[]                    │
│                                    ├── Receives held state changes              │
│                                    ├── Acts as SourceObject for abilities       │
│                                    └── Stores Tag Attributes                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

| Aspect          | Details                                            |
| --------------- | -------------------------------------------------- |
| **Type**        | `UObject` (not an Actor)                           |
| **Owner**       | The Pawn via Equipment Manager                     |
| **Created**     | When item moves to equipment container             |
| **Destroyed**   | When item leaves equipment container               |
| **Replication** | As a subobject of `ULyraEquipmentManagerComponent` |

The Equipment Instance links back to the inventory item through its `Instigator` property - so abilities can access both runtime equipment state AND persistent item data (like ammo counts).

***

### The Two Actor Arrays Problem

Here's a scenario: Player clicks to equip a weapon. They expect to see it immediately. But network latency means the server takes 100ms to process the request and replicate back.

**Without prediction:** 100ms delay before the weapon appears. Feels sluggish.

**With prediction:** Weapon appears instantly on the client. But now we have a problem - the client spawned a "fake" predicted actor, and soon the "real" replicated actor will arrive from the server.

The Equipment Instance solves this with two separate actor arrays:

#### SpawnedActors - The Truth

```cpp
UPROPERTY(ReplicatedUsing=OnRep_SpawnedActors)
TArray<TObjectPtr<AActor>> SpawnedActors;
```

These are server-authoritative actors that replicate to all clients. They're the "real" equipment visuals that everyone sees.

#### PredictedActors - The Instant Feedback

```cpp
UPROPERTY()
TArray<TObjectPtr<AActor>> PredictedActors;
```

These are local-only actors spawned during prediction. They exist solely to give the owning client immediate visual feedback. They're never replicated and are destroyed once the real actors arrive.

#### The Handoff

{% stepper %}
{% step %}
When the server's replicated actor arrives, the predicted actor is still visible — the player continues to see their local weapon.
{% endstep %}

{% step %}
The replicated actor arrives in a suppressed/hidden state so it doesn't immediately show up and create a visible double.
{% endstep %}

{% step %}
Prediction is confirmed; the predicted (local) actor is destroyed.
{% endstep %}

{% step %}
The replicated (authoritative) actor is revealed and becomes the visible representation.
{% endstep %}
{% endstepper %}

From the player's perspective, the weapon was always there. No visual pop or double-spawn.

{% hint style="info" %}
For the full prediction model including how the Equipment Manager orchestrates this handoff, see [The Overlay Model](../item-container/prediction/the-overlay-model/).
{% endhint %}

***

### Visibility Suppression

During the prediction handoff, there's a brief window where both actors exist - the predicted one (about to be destroyed) and the replicated one (just arrived). Without careful management, players would see duplicate weapons.

```cpp
// Hide actors and prevent OnRep from showing them
void SuppressActorVisibility();

// Clear suppression and unhide actors
void ClearActorVisibilitySuppression();
```

When `SuppressActorVisibility()` is called:

* All `SpawnedActors` become invisible
* The suppression flag prevents `OnRep_SpawnedActors` from making them visible
* Only `ClearActorVisibilitySuppression()` can reveal them

This gives the Equipment Manager precise control over when replicated actors become visible, ensuring smooth prediction reconciliation.

***

### Held State Change Notifications

When equipment transitions between held and holstered states, the Equipment Manager calls `NotifyHeldStateChanged` on each affected Equipment Instance. This callback provides complete context about the change, what changed and how.

#### The `FHeldStateChangedEvent` Structure

```cpp
USTRUCT(BlueprintType)
struct FHeldStateChangedEvent
{
    // The type of change that occurred
    EHeldStateChangeType ChangeType;

    // Held slot tags before this change
    FGameplayTagContainer OldHeldSlotTags;

    // Held slot tags after this change
    FGameplayTagContainer NewHeldSlotTags;
};
```

#### Change Types

| Change Type    | Meaning                      | When It Happens             |
| -------------- | ---------------------------- | --------------------------- |
| `BecameHeld`   | Equipment just became held   | Player draws weapon         |
| `BecameUnheld` | Equipment just became unheld | Player holsters weapon      |
| `StillHeld`    | Equipment remains held       | Held slot changed           |
| `NeverHeld`    | Equipment was never held     | Initialization or no change |

#### The Callback

```cpp
virtual void NotifyHeldStateChanged(const FHeldStateChangedEvent& Event);
```

This callback is called by the Equipment Manager, you should never call it directly. The Equipment Manager buffers and sorts notifications to ensure deterministic broadcast order e.g. unheld before held.

#### Implementation Pattern

```cpp
void UMyWeaponInstance::NotifyHeldStateChanged(const FHeldStateChangedEvent& Event)
{
    Super::NotifyHeldStateChanged(Event);

    switch (Event.ChangeType)
    {
    case EHeldStateChangeType::BecameHeld:
        // Weapon just became held - play draw animation, enable abilities
        PlayDrawAnimation();
        InitializeForCombat();
        break;

    case EHeldStateChangeType::BecameUnheld:
        // Weapon just became unheld - stop effects, play holster
        StopFiringEffects();
        PlayHolsterAnimation();
        break;

    case EHeldStateChangeType::StillHeld:
        // Held slot changed but still held - rare, usually no action needed
        break;

    case EHeldStateChangeType::NeverHeld:
        // No held state change - ignore
        break;
    }
}
```

#### Blueprint Implementation

<figure><img src="../../.gitbook/assets/image (211).png" alt=""><figcaption></figcaption></figure>

#### Native Delegate

For C++ listeners that need to respond to held state changes without subclassing:

```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHeldStateChanged, const FHeldStateChangedEvent&, Event);

UPROPERTY(BlueprintAssignable, Category = Equipment)
FOnHeldStateChanged OnHeldStateChanged;
```

#### Two-Handed Weapons

For a two-handed rifle, `NewHeldSlotTags` might contain both `Held.Primary` and `Held.Secondary`. Check the container for specific slots:

```cpp
if (Event.NewHeldSlotTags.HasTag(TAG_Held_Primary))
{
    // Primary hand is holding this weapon
}
```

#### Akimbo Support

The callback tells you exactly which slot this particular instance occupies. For example with dual pistols, each pistol's instance receives only its specific held slot.&#x20;

***

### Tag Attributes: Flexible Parameters Without Subclassing

A common challenge in equipment systems is managing stats or parameters that are specific to certain equipment _types_ or _abilities_ without cluttering the base class or creating complex inheritance chains. For example:

* A rifle's `GA_ShootBullet` ability needs `MuzzleVelocity`.
* A flamethrower's `GA_SpitFlame` ability needs `FlameWidth` and `FuelConsumptionRate`.
* An attachment might need to modify the base `SpreadExponent` of a weapon.

Putting all these variables directly in `ULyraEquipmentInstance` (or even `ULyraWeaponInstance`) leads to bloat. Creating subclasses for every variation (`ULyraLaserRifleInstance`, `ULyraShotgunInstance`) becomes bloated and messy.

#### **The Solution: Tag Attributes**

The `ULyraEquipmentInstance` contains a replicated `FGameplayTagAttributeContainer` named `Attributes`.

* **What it is:** A container holding **float** values, each associated with a unique **Gameplay Tag**. Think of it as a dictionary mapping `FGameplayTag` -> `float`.
* **Purpose:** To store mutable, instance-specific parameters that are often introduced or modified by the Gameplay Abilities granted by the equipment, or by external systems like attachments.
* **Replication:** Uses `FFastArraySerializer` for efficient network replication.

```cpp
// Add a parameter (authority only)
void AddTagAttribute(FGameplayTag Tag, float InitialValue);

// Modify with reversal tracking
FFloatStatModification ModifyTagAttribute(FGameplayTag Tag, float Modifier, EFloatModOp Operation);

// Query current value
float GetTagAttributeValue(FGameplayTag Tag) const;
```

#### Typical Flow

{% stepper %}
{% step %}
#### Initialization

Abilities granted by the equipment (via `ULyraAbilitySet` in the `ULyraEquipmentDefinition`) can add their relevant parameters to the container when the ability is granted.

```cpp
EquipmentInstance->AddTagAttribute(TAG_Weapon_SpreadExponent, 1.0f);
```

<figure><img src="../../.gitbook/assets/image (207).png" alt=""><figcaption></figcaption></figure>
{% endstep %}

{% step %}
#### Modification&#x20;

Other systems can modify these values:

* A passive ability could temporarily boost a stat using `ModifyTagAttribute` and then use `ReverseTagAttributeModification` when the effect expires.
* Look at the [attachment utility ability documentation](../items/item-fragments-in-depth/attachment-system/provided-attachment-utility-abilities.md) for more indepth examples of modifications

```cpp
// Attachment reduces spread by 20%
ModHandle = EquipmentInstance->ModifyTagAttribute(
    TAG_Weapon_SpreadExponent, 0.8f, EFloatModOp::Multiply);
```
{% endstep %}

{% step %}
#### Query&#x20;

Abilities or other systems can read the current value using `GetTagAttributeValue(FGameplayTag Tag)` or check for existence using `HasTagAttribute(FGameplayTag Tag)`.

<figure><img src="../../.gitbook/assets/image (208).png" alt=""><figcaption></figcaption></figure>
{% endstep %}

{% step %}
#### Cleanup

When an ability is removed (e.g., when the item is unheld or unequipped), its `OnRemoved` logic should clean up the parameters it introduced.

```cpp
EquipmentInstance->RemoveTagAttribute(FGameplayTag Tag));
```

<figure><img src="../../.gitbook/assets/image (209).png" alt=""><figcaption></figcaption></figure>
{% endstep %}
{% endstepper %}

#### Tag Attributes vs Item Stat Tags

Both store tagged data, but they serve different purposes:

| Aspect        | Tag Attributes                                                 | Item Stat Tags                                       |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| **Data Type** | `float`                                                        | `int32`                                              |
| **Lives On**  | `ULyraEquipmentInstance`                                       | `ULyraInventoryItemInstance`                         |
| **Lifetime**  | While equipped                                                 | Persists in inventory                                |
| **Use Case**  | Mutable parameters for abilities, temporary mods (attachments) | Persistent counts (ammo, charges), durability, flags |

**Use `Attributes` on the Equipment Instance for:** Values directly related to _how the equipment functions while active_, especially those introduced or modified by abilities or temporary attachments.**Use `StatTags` on the Inventory Item Instance for:** Values intrinsic to the _item itself_ that need to persist even when it's not equipped (like how much ammo is left in the magazine).

***

### Prediction Reconciliation

When the server confirms a prediction, it creates its own authoritative Equipment Instance. The client's predicted instance is about to be destroyed - but it might have local state that matters (UI selections, local visual effects, aim offsets).

```cpp
virtual void ReconcileWithPredictedInstance(ULyraEquipmentInstance* PredictedInstance);
```

Override this to transfer local state before the predicted instance disappears:

```cpp
void UMyWeaponInstance::ReconcileWithPredictedInstance(ULyraEquipmentInstance* PredictedInstance)
{
    Super::ReconcileWithPredictedInstance(PredictedInstance);

    if (UMyWeaponInstance* PredictedWeapon = Cast<UMyWeaponInstance>(PredictedInstance))
    {
        // Preserve the local aim offset the player was tracking
        LocalAimOffset = PredictedWeapon->LocalAimOffset;
    }
}
```

***

### The Instigator Link

Every Equipment Instance maintains a link to its source inventory item:

```cpp
UPROPERTY(ReplicatedUsing=OnRep_Instigator)
TObjectPtr<UObject> Instigator;

// Convenience accessor
ULyraInventoryItemInstance* GetItemInstance() const;
```

This link is essential for abilities that need both:

* **Equipment state** (current spread, heat level) - from the Equipment Instance
* **Persistent item data** (ammo count, attachments) - from the Inventory Item

The `OnInstigatorReady` delegate fires when replication completes on clients.

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

<figure><img src="../../.gitbook/assets/image (97).png" alt="" width="272"><figcaption></figcaption></figure>

* `GetAssociatedItem() const`: A further convenience function that calls `GetAssociatedEquipment()` and then retrieves the `ULyraInventoryItemInstance*` from the equipment's `Instigator` property.

<figure><img src="../../.gitbook/assets/image (98).png" alt="" width="264"><figcaption></figcaption></figure>

**Benefits:**

* **Cleaner Code:** Avoids repetitive casting of the `SourceObject` within your ability logic.
* **Direct Access:** Easily get references to both the runtime equipment state (`ULyraEquipmentInstance`) and the persistent inventory item state (`ULyraInventoryItemInstance`).

**Example Usage (inside an ability derived from `ULyraGameplayAbility_FromEquipment`):**

{% tabs %}
{% tab title="Blueprints" %}
<figure><img src="../../.gitbook/assets/image (99).png" alt=""><figcaption><p>Accessing the item stat tag that belongs to this equipment in <code>GA_Reload_Magazine</code> </p></figcaption></figure>

<figure><img src="../../.gitbook/assets/image (100).png" alt=""><figcaption><p>Accessing the tag stat for the equipment that called this ability in <code>GA_Reload_Magazine</code></p></figcaption></figure>
{% endtab %}

{% tab title="C++" %}
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


{% endtab %}
{% endtabs %}

By using `ULyraGameplayAbility_FromEquipment`, you streamline the process of writing abilities that interact correctly with the specific equipment instance and its corresponding inventory item.

***

### When to Subclass

The base `ULyraEquipmentInstance` handles most needs. Only subclass when you need:

| Need                       | Why Subclass                                                    |
| -------------------------- | --------------------------------------------------------------- |
| **Tick-based logic**       | Heat dissipation, recoil recovery that can't use ability timers |
| **Cross-ability state**    | Data multiple abilities need to share (beyond Tag Attributes)   |
| **Frame-accurate updates** | Spread interpolation, precise timing                            |

**Don't subclass** just to add variables (use Tag Attributes), handle action logic (use abilities), or store temporary state (use `InstancedPerActor` abilities).

#### Examples in the Codebase

| Class                       | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `ULyraRangedWeaponInstance` | Per-frame heat and spread updates                 |
| `UGunWeaponInstance`        | Recoil tracking with frame-accurate interpolation |

#### Creating a Subclass

{% stepper %}
{% step %}
Inherit from `ULyraEquipmentInstance` (C++ or Blueprint).
{% endstep %}

{% step %}
Override `NotifyHeldStateChanged` for state-change logic.
{% endstep %}

{% step %}
Override `ReconcileWithPredictedInstance` to preserve local state.
{% endstep %}

{% step %}
Set `Instance Type` in your `ULyraEquipmentDefinition`.
{% endstep %}
{% endstepper %}

***

## Visual and Audio Feedback

Add polish by responding to held state changes in Blueprint:

```
Event K2_OnHeldStateChanged (HeldSlotTags)
├── Branch: Is HeldSlotTags Empty?
│   ├── True (Holstered):
│   │   ├── Stop firing effects
│   │   └── Play holster sound
│   └── False (Held):
│       ├── Play equip montage
│       └── Spawn attached sound
```

Common use cases:

* Animation montages when weapons are drawn
* Equip/holster sound effects
* Particle effect toggling on spawned actors
* Material parameter changes based on held state

***
