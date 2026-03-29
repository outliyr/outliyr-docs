# Gameplay Effects

A shotgun blast hits a target 30 meters away. The damage execution needs to know which weapon fired, how far the shot traveled, and what surface it hit, headshot or body armor. All of this metadata travels with the gameplay effect through a custom effect context.

### What Gameplay Effects Do

Effects are how GAS modifies attributes. An instant effect applies damage. A duration effect buffs attack speed for 10 seconds. An infinite effect represents a passive stat bonus that lasts until explicitly removed.

The framework doesn't add new effect types, it extends the **metadata** that effects carry. Specifically, it gives every effect the ability to reference the weapon or item that created it, so downstream logic like damage executions can make source-aware decisions.

<details>

<summary>Example of GE that add a gameplay cue to the player</summary>

<figure><img src="../../.gitbook/assets/image (248).png" alt=""><figcaption></figcaption></figure>

</details>

<details>

<summary>Example of GE that causes rifle damage</summary>

<figure><img src="../../.gitbook/assets/image (249).png" alt=""><figcaption></figcaption></figure>

</details>

<details>

<summary>Example of GE that heals player over time</summary>

<figure><img src="../../.gitbook/assets/image (250).png" alt=""><figcaption></figcaption></figure>

</details>

### The Custom Effect Context

Every effect carries a context object with information about who caused it and how. The engine's default context covers the basics, the instigator actor, the effect causer, and an optional hit result. The framework extends this with two additions:

* **Ability source** — a reference to the weapon or item that created the effect. This is the object that implements attenuation behavior. Authority-only; not replicated.
* **Custom ability data** — an arbitrary per-effect data payload. Net-serialized alongside the base context, so it arrives on remote clients intact.

This happens automatically. The framework overrides the global context allocator so every effect in the project uses the extended context. The override is registered in `DefaultGame.ini` and every call through the ability system produces the extended context from that point forward.

### The Ability Source Interface

A sniper rifle deals full damage at close range but falls off at distance. A shotgun ignores distance but deals bonus damage to unarmored surfaces. Each weapon defines its own falloff behavior by implementing the ability source interface.

The interface has two hooks:

| Hook                          | What it returns                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Distance attenuation          | A multiplier based on how far the projectile traveled. A sniper might return 1.0 under 50m and taper to 0.3 at 200m. |
| Physical material attenuation | A multiplier based on the surface material at the hit location, headshot, body armor, flesh, etc.                    |

Both hooks also receive the source and target's gameplay tags, so implementations can factor in active buffs or debuffs when calculating multipliers.

When the damage execution runs, it asks the source weapon for these multipliers and applies them. This means **weapon damage curves are defined on the weapon, not in the execution**, different weapons behave differently without changing the damage pipeline. Any object can act as an ability source (weapon instances, equipment definitions, ability-granted items) as long as it implements the interface.

### How It Flows

{% stepper %}
{% step %}
**Weapon ability creates a gameplay effect**

The ability system allocates the extended context automatically through the global override.
{% endstep %}

{% step %}
**Context includes the weapon as the ability source**

The ability stores a reference to the weapon on the context. This is the link that lets the execution trace back to the source.
{% endstep %}

{% step %}
**Effect is applied to the target**

The damage execution runs as part of the effect application.
{% endstep %}

{% step %}
**Execution extracts the context and reads the weapon source**

The execution downcasts the generic context to the framework's extended type and retrieves the ability source.
{% endstep %}

{% step %}
**Execution asks the weapon for multipliers**

It calls the distance attenuation hook with the travel distance and the physical material attenuation hook with the surface material from the hit result.
{% endstep %}

{% step %}
**Final damage is calculated and applied**

Base damage is multiplied by both attenuation values and written to the target's attributes. Gameplay cues applied by the same effect receive the same context, giving them access to hit location, surface material, and ability source for visual and audio feedback.
{% endstep %}
{% endstepper %}

<details>

<summary>Why not just pass weapon data directly?</summary>

The effect context is GAS's built-in mechanism for carrying metadata through the pipeline. It survives replication, prediction, and deferred execution. Passing weapon data through a side channel, like a direct reference on the execution or a custom event, would break when effects are predicted on the client and later replayed by the server. The context travels with the effect through every stage of its lifecycle, so anything stored on it is guaranteed to be available when the execution finally runs, regardless of timing.

</details>
