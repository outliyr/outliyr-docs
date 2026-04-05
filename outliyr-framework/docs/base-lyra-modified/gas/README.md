# GAS

A player fires their weapon at an enemy. The system needs to check if the weapon ability can activate, calculate damage based on distance and hit surface, subtract from the target's shields first and then health, show a damage number popup, and report the hit to AI perception, all in a single networked frame. The Gameplay Ability System (GAS) orchestrates all of this.

This section covers the framework's GAS layer: the custom classes and patterns built on top of Epic's GAS plugin.

<details>

<summary>New to GAS?</summary>

GAS is Unreal Engine's built-in framework for abilities, effects, attributes, and tags. It provides a replicated attribute system, a gameplay effect pipeline for modifying those attributes, an ability lifecycle with activation/cancellation/costs, and a tag-based state model that decouples systems from each other. If you have not worked with GAS before, start with the [Unreal Engine GAS documentation](https://docs.unrealengine.com/en-US/gameplay-ability-system-for-unreal-engine/) for the official reference, and [Tranek's GAS Documentation](https://github.com/tranek/GASDocumentation) for a community-maintained deep dive with practical examples.

</details>

***

## What This Framework Adds

**ASC ownership patterns.** The framework supports two patterns for where the Ability System Component lives. On simple pawns, the ASC sits on the pawn itself and is destroyed with it. On player-controlled characters, the ASC lives on the player state so that granted abilities, active cooldowns, and tag state survive respawns. Initialization handles both cases transparently.

**Resource attribute pattern.** Health, shield, and any custom resource you add all derive from a shared resource base class. That base class exposes a common interface for "take damage" and "receive healing," so the execution pipelines can target any resource generically. Adding stamina or mana means creating one subclass.

**Data-driven ability packaging.** Abilities, effects, and attribute sets are bundled into a single data asset. Grant the asset, get a handle back; revoke the handle and everything is cleaned up. Pawn data, equipment, and game features all inject GAS content through this same mechanism.

**Configurable damage and heal pipelines.** Damage and heal executions route through resource sets in priority order, shields absorb before health, for example. Which resources participate and in what order is configured per-execution, not hardcoded. Special-case executions can target a single resource directly.

**Custom effect context.** Every gameplay effect carries an extended context with metadata about the source weapon. Executions use this to apply distance falloff and surface-based damage modifiers without the ability needing to know about them.

***

## Sub-Pages

{% hint style="info" %}
Each sub-page focuses on one aspect of the GAS layer. Read them in order for a full picture, or jump to the topic you need.
{% endhint %}

* [ASC Setup](asc-setup.md) — Where the ASC lives and how it gets initialized.
* [Attribute Sets](attribute-sets.md) — Character stats, the resource pattern, and how to add new resources.
* [Gameplay Effects](gameplay-effects.md) — How effects modify attributes and carry source metadata.
* [Abilities](abilities.md) — Activation policies, costs, and ability specializations.
* [Ability Sets](ability-sets.md) — Data-driven packaging of abilities, effects, and attributes.
* [Damage & Healing](damage-and-healing.md) — The full damage and heal execution pipelines.
* [Gameplay Cues](gameplay-cues.md) — Visual and audio feedback from gameplay events.
