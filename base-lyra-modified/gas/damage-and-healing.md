# Damage and Healing

A shotgun blast hits a shielded enemy. The system captures the weapon's base damage, applies distance falloff from the weapon's curves, multiplies by the hit surface material, routes the result through shields first (absorbing what they can), overflows the remainder into health, and reports the total for a damage popup. This is the damage execution pipeline.

The framework ships two executions that handle this: one for damage and one for healing. Both write to meta attributes on the target's resource sets, never modifying resource values directly. The resource set's `PostGameplayEffectExecute` handles clamping, death, and gameplay cue triggers from there.

***

### Damage Execution

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Capture base damage**

Reads `BaseDamage` from the attacker's [combat set](attribute-sets.md#combat-set-ulyracombatset). The value is snapshotted when the gameplay effect spec is created, not when the execution runs.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Check team rules**

Asks the team subsystem whether the source is allowed to damage the target. Friendly fire, self-damage, and similar rules are resolved here. If damage is not allowed, the multiplier is zero and the execution effectively stops.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Apply distance attenuation**

Measures the distance from the damage origin to the impact point, then asks the [ability source](gameplay-effects.md#the-ability-source-interface) (typically the weapon) for a damage multiplier based on that distance. Weapons define their own falloff curves, so a shotgun drops off steeply while a sniper barely attenuates at range.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Apply surface attenuation**

Asks the ability source for a multiplier based on the physical material that was hit. Headshots, armor plating, and soft tissue each return different values from the weapon's surface attenuation table.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Route through resources**

Distributes damage across the target's [resource attribute sets](attribute-sets.md#the-resource-pattern) in priority order. Shields (priority 100) absorb first. Health (priority 0) takes the remainder. Each resource's meta `Damage` attribute receives its share, and any overflow carries to the next resource in line.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Record total damage**

Writes the full pre-routing damage amount to the target's `TotalDamage` attribute on the combat set. UI popups and scoring systems read this value through gameplay cues.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Report to AI perception**

Sends a damage event to the AI damage sense so bots know they were hit, how much damage was dealt, and where the damage came from.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

The final damage formula:

```
FinalDamage = BaseDamage * DistanceAttenuation * SurfaceAttenuation * TeamMultiplier
```

All factors are clamped so the result is never negative.

***

### Priority-Based Resource Routing

When routing damage, the execution discovers every resource attribute set on the target's ability system component and sorts them by `DamageAbsorptionPriority` (descending). Damage flows through the list, and each resource absorbs what it can before the remainder overflows to the next.

```
Incoming Damage: 80

Shield (priority 100, current: 50)
  -> Absorbs 50, remainder: 30

Health (priority 0, current: 100)
  -> Absorbs 30, remainder: 0

Result: Shield 0, Health 70, TotalDamage 80
```

<details class="gb-toggle">

<summary>Why priority-based routing instead of a fixed shield-then-health order?</summary>

New resource types (like armor or energy shields) slot in automatically based on their priority value. The execution doesn't need to know about them, it discovers all resource sets on the target and routes by priority. Adding a new damage-absorbing resource means creating the resource attribute set and assigning it a priority. Zero changes to the execution code.

| Resource   | Suggested Priority | Absorbs Before |
| ---------- | -----------------: | -------------- |
| Overshield |                200 | Shield, Health |
| Shield     |                100 | Health         |
| Health     |                  0 | --             |

</details>

***

### Resource Targeting

By default, the damage execution routes through **all** resource attribute sets on the target, ordered by priority. You can restrict which resources an execution targets by configuring `TargetResourceSets` on the execution class.

| Configuration   | Behavior                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| Empty (default) | Damage routes through all resource sets on the target, sorted by priority |
| Populated       | Damage only targets the specified sets, still respecting priority order   |

This is how you create damage that bypasses certain resources. For example, zone damage that should ignore shields: create a Blueprint subclass of the damage execution and set `TargetResourceSets` to only include the health set. The zone damage now goes straight to health regardless of what other resource sets exist on the target.

***

### Heal Execution

The heal execution works like damage in reverse. It captures `BaseHeal` from the source's [combat set](attribute-sets.md#combat-set-ulyracombatset), clamps it to zero or above, and applies the result to the target's resource sets as healing.

Unlike damage, the heal execution does **not** do priority-based routing. It applies the full healing amount to every resource set in its `TargetResourceSets` list. Each resource's meta `Healing` attribute receives the value, and the resource set's post-execution logic handles clamping to max.

| Configuration            | Behavior                                                   |
| ------------------------ | ---------------------------------------------------------- |
| `[HealthSet]` (default)  | Heals health only                                          |
| `[ShieldSet]`            | Heals shields only, useful for shield regeneration effects |
| `[HealthSet, ShieldSet]` | Heals both health and shields with the same value          |

Because `TargetResourceSets` is a configurable property, different gameplay effects can point the same execution class at different resources. One GE heals health, another restores shields, another heals both, no subclassing needed.
