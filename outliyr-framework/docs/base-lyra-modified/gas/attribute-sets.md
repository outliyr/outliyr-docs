# Attribute Sets

A character has 100 health and 50 shields. An enemy deals 80 damage. The shields absorb the first 50, and the remaining 30 comes off health. The character is left with 70 health and no shields. But where do these numbers live? How does the system know to hit shields first?

Attribute sets hold the numbers. Each set is a C++ class registered on the Ability System Component that groups related gameplay attributes together. The resource pattern built into the framework defines how those numbers behave, clamping, damage routing, death detection, so that adding new resources requires almost no behavioral code.

***

## What Attributes Are

Attributes are named float values managed by GAS. Health, MaxHealth, Stamina, BaseDamage, each is an attribute, stored as an `FGameplayAttributeData` on an attribute set. Gameplay Effects read from and write to them.

A single ASC can hold multiple attribute sets at once. A character might have a health set, a shield set, and a combat set all active simultaneously, each responsible for a different slice of that character's data.

The framework provides three attribute sets out of the box.

### Health Set (`ULyraHealthSet`)

The health set represents a character's core vitality, the last resource depleted before death.

| Attribute   | Default | Purpose                                                     |
| ----------- | ------- | ----------------------------------------------------------- |
| `Health`    | 100     | Current health. Replicated.                                 |
| `MaxHealth` | 100     | Maximum health cap. Replicated.                             |
| `Damage`    | 0       | Meta attribute, temporary staging area for incoming damage. |
| `Healing`   | 0       | Meta attribute, temporary staging area for incoming heals.  |

`Damage` and `Healing` are **meta attributes**. They never represent persistent state. When a damage effect fires, it writes to the `Damage` meta attribute. The health set then subtracts that value from `Health`, clamps the result to `[0, MaxHealth]`, broadcasts change delegates, and resets `Damage` back to zero. The meta attribute exists only for the duration of that processing step.

When `Health` reaches zero, the set broadcasts an `OnOutOfResource` event. The `ULyraHealthComponent` listens for this and triggers the death flow.

The health set also broadcasts an `FLyraVerbMessage` tagged with `Lyra.Damage.Message` on every damage application. Other systems (damage number popups, hit indicators) listen for this message.

**Cheat support:** `Cheat.GodMode` blocks all incoming damage entirely, the effect is cancelled before it applies. `Cheat.UnlimitedHealth` is softer, it prevents health from dropping below 1, so the character still takes damage but cannot die. Both tags only function in non-shipping builds.

### Shield Set (`ULyraShieldSet`)

The shield set is an ablative layer that absorbs damage before it reaches health.

| Attribute   | Default | Purpose                                                         |
| ----------- | ------- | --------------------------------------------------------------- |
| `Shield`    | 100     | Current shield value. Replicated.                               |
| `MaxShield` | 100     | Maximum shield cap. Replicated.                                 |
| `Damage`    | 0       | Meta attribute, same pattern as the health set.                 |
| `Healing`   | 0       | Meta attribute, used for shield regeneration or repair effects. |

Shields work identically to health, same meta attribute pattern, same clamping, same delegate broadcasting. The only differences are the attribute names and the damage absorption priority.

Shields have a `DamageAbsorptionPriority` of 100 compared to health's 0. When the damage execution routes damage across resource sets, it processes them in descending priority order, shields first, health last. Any damage that overflows past shields carries into health automatically.

**Shield is optional.** If a game mode does not want shields, do not grant the shield attribute set. The damage execution automatically skips resources that are not present on the target. No code changes needed.

**Cheat support:** `Cheat.UnlimitedShield` prevents shields from dropping below 1. `Cheat.GodMode` blocks damage to all resources, including shields.

### Combat Set (`ULyraCombatSet`)

The combat set sits on the **source** side of the damage equation, the character dealing damage, not the one receiving it. It does not inherit from the resource base class because it is not a depletable resource.

| Attribute     | Default | Purpose                                                                                                                         |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `BaseDamage`  | 0       | Raw damage potential. The damage execution reads this as its starting value.                                                    |
| `BaseHeal`    | 0       | Raw healing potential. The heal execution reads this as its starting value.                                                     |
| `TotalDamage` | 0       | Meta attribute set by the damage execution to the total damage dealt. Used for gameplay cues like unified damage number popups. |

When a character fires a weapon, the damage execution captures `BaseDamage` from the attacker's combat set, applies contextual modifiers (distance falloff, hit zone multipliers, team checks), and writes the result to the target's resource sets. The source never needs to know about the target's defenses, and the target never needs to know about the source's stats. The execution bridges the two.

***

## The Resource Pattern

Health and shield are both "depletable resources." They share the same structure: a current value, a max value, damage and healing meta attributes, clamping between 0 and max, delegate broadcasting on change, and an out-of-resource event when the value hits zero.

The framework captures this shared behavior in an abstract base class, `ULyraResourceAttributeSet`. Health and shield are subclasses that inherit all of this logic. Each subclass only needs to declare its concrete attributes (`Health`/`MaxHealth` or `Shield`/`MaxShield`) and wire them to the base class through virtual accessors. The behavioral code, meta attribute processing, clamping, cheat checks, delegate broadcasting, lives entirely in the base.

This means adding a new resource (mana, stamina, energy) is a matter of subclassing the base and defining attributes. The damage and heal executions automatically discover all resource sets on a target and route through them based on priority.

### Damage Absorption Priority

Each resource set has a `DamageAbsorptionPriority` (int32). The damage execution gathers all resource sets on the target, sorts them by priority descending, and applies damage in that order. Overflow carries to the next set.

| Resource Set     | Priority | Effect                        |
| ---------------- | -------- | ----------------------------- |
| `ULyraShieldSet` | 100      | Absorbs damage first          |
| `ULyraHealthSet` | 0        | Absorbs remaining damage last |

Inserting a new resource layer (overshield at priority 200, armor at priority 50) requires no changes to the execution logic.

***

## Adding a New Resource

Using mana as an example, here is how to add a new depletable resource.

{% stepper %}
{% step %}
#### Create the Attribute Set

Subclass `ULyraResourceAttributeSet` and declare four attributes: the resource, its max, and the damage/healing meta attributes. Override the virtual accessors to wire them to the base class.

```cpp
UCLASS()
class ULyraManaSet : public ULyraResourceAttributeSet
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintReadOnly, ReplicatedUsing=OnRep_Mana)
    FGameplayAttributeData Mana;

    UPROPERTY(BlueprintReadOnly, ReplicatedUsing=OnRep_MaxMana)
    FGameplayAttributeData MaxMana;
};
```

The `Damage` and `Healing` meta attributes follow the same pattern. The virtual accessor overrides map `GetResourceAttribute()` to `GetManaAttribute()`, `GetMaxResourceAttribute()` to `GetMaxManaAttribute()`, and so on.
{% endstep %}

{% step %}
#### Set the Absorption Priority

In the constructor, set `DamageAbsorptionPriority` to control where mana sits in the damage chain. If mana should not absorb combat damage at all, use a negative value. If it should absorb before health but after shields, use a value between 1 and 99.

Also set `CheatUnlimitedTag` to something like `Cheat.UnlimitedMana` for debug support.
{% endstep %}

{% step %}
#### Grant It

Add the new attribute set to a `ULyraAbilitySet` data asset and grant that ability set to the relevant pawns. Characters without it simply will not have mana attributes.
{% endstep %}

{% step %}
#### Create Gameplay Effects

Build Gameplay Effects that interact with the new resource:

* **Mana cost:** A GE that writes to the `Damage` meta attribute, reducing Mana
* **Mana regeneration:** A GE that writes to the `Healing` meta attribute, restoring Mana.&#x20;
* **Mana buffs:** A GE that modifies `MaxMana` directly

Because `ULyraResourceAttributeSet` handles all clamping, delegate broadcasting, and meta attribute processing, the new resource inherits the full suite of behaviors automatically.
{% endstep %}
{% endstepper %}

***

<details>

<summary>Why meta attributes instead of direct modification?</summary>

Meta attributes act as a staging area between the effect and the real attribute. Instead of a Gameplay Effect writing directly to `Health`, it writes to the `Damage` meta attribute. The attribute set then processes that value in `PostGameplayEffectExecute`, subtracting from the real attribute, clamping to valid bounds, checking for death, broadcasting delegates, and optionally sending a verb message for UI feedback. Only then is the meta attribute reset to zero.

This separation gives the attribute set a controlled interception point. Without it, a direct modification to `Health` would bypass all of that logic. The set would not know whether the change came from damage or healing, could not check for immunity or god mode, and would not broadcast the events that other systems depend on. Meta attributes ensure every resource change flows through a single processing path regardless of what caused it.

</details>
