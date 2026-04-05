# Abilities

A player pulls the trigger. A character jumps. A consumable heals the user. Every one of these is a gameplay ability, a self-contained action that the ability system manages from activation to completion. The framework provides a base ability class with built-in support for activation policies, cost systems, and camera control.

***

## Activation Policies

How an ability starts determines how it feels. A shotgun fires once per trigger pull. A shield ability stays active while the button is held. A passive health regen activates automatically when granted.

| Policy           | Behavior                            | Example                 |
| ---------------- | ----------------------------------- | ----------------------- |
| OnInputTriggered | Activates once per input press      | Weapon fire, dodge roll |
| WhileInputActive | Activates on press, ends on release | Shield, sprint          |
| OnSpawn          | Activates immediately when granted  | Passive buffs, auras    |

***

## Activation Groups

Some abilities can run simultaneously. Others are mutually exclusive. A character can sprint while their passive regen runs, but they can only use one aim mode at a time.

| Group                  | Behavior                                                | Example                      |
| ---------------------- | ------------------------------------------------------- | ---------------------------- |
| Independent            | Runs alongside anything                                 | Passives, movement abilities |
| Exclusive\_Replaceable | Only one at a time, new ones replace the active ability | ADS vs hip-fire              |
| Exclusive\_Blocking    | Only one at a time, blocks new activations              | Channel abilities            |

***

## Costs

Abilities can have costs beyond what GAS provides by default. The base ability class exposes an `AdditionalCosts` array where each ability can carry multiple cost objects. All costs are checked before activation and consumed on commit.

| Cost             | What it consumes                                                                        |
| ---------------- | --------------------------------------------------------------------------------------- |
| Item Tag Stack   | Deducts from a tag stack on the associated item (e.g., ammo from the weapon's magazine) |
| Inventory Item   | Consumes a quantity of a specific item definition from the player's inventory           |
| Player Tag Stack | Deducts from a tag stack on the player state (e.g., charges, currency)                  |

Each cost can optionally be flagged to only apply on a successful hit rather than on activation.

<details>

<summary>Why a separate cost system instead of using Gameplay Effects?</summary>

GAS's built-in cost is a single Gameplay Effect applied on commit. That works for simple attribute deductions (spend 10 mana), but falls apart when the cost isn't an attribute, consuming ammo from a weapon's tag stack, or removing a physical item from an inventory. The framework's cost system is object-based: each cost is an instanced object with its own `CheckCost` and `ApplyCost` logic, so it can talk to any system (inventory, tag stacks, attributes) without forcing everything through a Gameplay Effect.

</details>

***

## Ability Specializations

The base ability handles activation, costs, and camera integration. Specialized subclasses add context for specific sources, a weapon ability knows about its weapon, an equipment ability knows about its equipment instance.

| Specialization                        | Context it adds                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ULyraGameplayAbility_FromEquipment`  | Access to the equipment instance and the inventory item that granted it                               |
| `ULyraGameplayAbility_FromAttachment` | Access to the attachment item, the parent item it's plugged into, and the parent's equipment instance |
| `ULyraGameplayAbility_FromConsume`    | Runs the actual consumable effect (healing, buffs); owns timing and the consume logic                 |
| `ULyraGameplayAbility_FromPickup`     | Client-predicted item pickup with configurable routing (quick bar, inventory, smart routing)          |
| `ULyraGamePhaseAbility`               | Tied to the game phase lifecycle; activating it cancels sibling phases                                |

***

## Camera Integration

Any ability can temporarily override the camera mode. An ADS ability pushes a tighter camera view on activation and it is automatically restored when the ability ends. This is a single property on the ability, no manual cleanup is needed.

<figure><img src="../../.gitbook/assets/image (256).png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../.gitbook/assets/image (257).png" alt=""><figcaption></figcaption></figure>
