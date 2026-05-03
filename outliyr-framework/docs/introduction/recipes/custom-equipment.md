# Custom Equipment

## **What you're building**

A pair of **rocket shoes**, wearable equipment that, when equipped, grants the player a "rocket jump" ability replacing the default jump. Press jump → launch upward, keep your forward momentum.

This is the framework's foundational equipment composition pattern. Almost everything a player can equip, armour, shields, tools, utility items, _and_ weapons, is built on this same shape. The [Custom Weapon Recipe](custom-weapon.md) extends it with gun-specific layers; this recipe teaches the foundation in its smallest, cleanest form.

By the end you'll know:

* The minimum asset graph for any piece of equipment
* When you _don't_ need a subclassed Equipment Instance (most of the time)
* When you _don't_ need a visual actor (also possible)
* When abilities are the right granted thing vs. plain Gameplay Effects

{% hint style="info" %}
This recipe assumes you've completed the [Quick Start Guide](../quick-start-guide.md) and have a [Game Feature Plugin](../../base-lyra-modified/gameframework-and-experience/game-features.md) of your own. Don't author equipment inside core plugins; duplicate into your own plugin so framework updates don't fight your work.
{% endhint %}

***

## **The shape of equipment**

Before the steps, the mental model. Equipment is built from a small graph of assets, each one owns a single concern, and they reference each other to compose into "something the player can equip and use." Reading the graph first makes the step list below feel less like ceremony.

**The item itself.** The data record is an _Item Definition_ (e.g. `ID_RocketShoes`). On its own it's mostly empty, every capability the equipment has comes from _fragments_ added to it. A fragment is a small data class that grants one capability:

* _Equipment_ — links the item to the Equipment Definition. This is what makes the item equippable rather than just inventoriable. **Required.**
* _Inventory Icon_ — name, description, icon, weight, max stack. **Required** for the item to appear in the inventory at all.
* _Pickup_ — world drop / pickup. Optional.

Other fragments exist for consumables, attachments, category sorting, and custom data, see the [Custom Item Recipe](custom-item.md) for the full menu. Rocket shoes use just these three.

**When the player equips it.** The _Equipment Definition_ (e.g. `WID_RocketShoes`) drives what happens on equip: it spawns the equipment's visual actors on the appropriate sockets, grants the abilities listed in its Ability Set, and configures the slot the equipment occupies (and how it behaves there, held vs. holstered). The Equipment Definition also points at an _Equipment Instance_ class, the runtime representation of the equipment while it's on the player. **The default `Equipment Instance` class is fine for most equipment.** You only subclass it when you have logic that runs continuosly and wouldn't fit in abilities.

**What the equipment grants.** The Equipment Definition references one or more _Ability Sets_, bundles of abilities granted to the player while the equipment is equipped. Each entry in an Ability Set pairs an input tag (e.g. `InputTag.Jump`) with an ability. If your equipment is a pure stat buff with no input-driven behaviour, the Ability Set can grant Gameplay Effects directly without any abilities at all.

**What the player sees.** Optional. Equipment doesn't _require_ a visual representation on the player. If yours has one, it's a Blueprint actor (e.g. `B_RocketShoe`) with the mesh and any cosmetic components. The Equipment Definition spawns it on the appropriate socket. Buff items, internal modifiers, and pure-effect items skip this entirely.

The rocket shoes asset graph:

```
ID_RocketShoes (Item Definition)
 ├─ Equipment Fragment ............ → WID_RocketShoes
 ├─ Inventory Icon Fragment ....... icon, weight, max stacks
 └─ Pickup Fragment (optional) .... drop / world pickup behaviour

WID_RocketShoes (Equipment Definition)
 ├─ Equipment Instance Class ...... default Equipment Instance (no subclass)
 ├─ Ability Sets To Grant ......... → AbilitySet_RocketShoes
 │                                       └─ GA_RocketJump bound to InputTag.Jump
 ├─ Slot configuration ............ feet slot, holster-only behaviour
 └─ Actors To Spawn ............... → B_RocketShoe (spawned twice — left foot + right foot socket)
```

***

## Create New Equipment

{% stepper %}
{% step %}
### Ability (`GA_RocketJump`)

Create a new Gameplay Ability. For rocket shoes the logic is small:

* On activate, read the character's current X and Y velocity, override the Z velocity to a high value (rocket shoes use **1200**), and apply that to the character. The player keeps their lateral momentum and is launched upward.
* Use the **`WaitForMovementModeChange`** GAS task to wait for the player to land (movement mode returns to walking). When that fires, `EndAbility`.

This is a self-contained ability, no Gameplay Effects, no cues, no animation montage. Equipment abilities are often this simple, especially when unreal's existing GAS tasks (`WaitForMovementModeChange`, `WaitGameplayEvent`, `PlayMontageAndWait`) cover the timing.

<figure><img src="../../.gitbook/assets/image (284).png" alt=""><figcaption></figcaption></figure>

References: [Abilities](../../base-lyra-modified/gas/abilities.md), [Custom Ability Recipe](/broken/pages/652e02ba3c28a2dd5bcd91ae867ff93eb963a9f1) for the deeper ability authoring patterns.
{% endstep %}

{% step %}
### Ability Set (`AbilitySet_RocketShoes`)

Create a new **Lyra Ability Set** asset. Add one entry:

* **Ability**: `GA_RocketJump`
* **Input tag**: `InputTag.Jump`

An Ability Set is just a tag → ability mapping. It says: _when the input action carrying this tag fires, activate this ability._ Pressing the standard jump input fires the Jump Input Action (mapped to `InputTag.Jump` in the framework's input config), and the ability-input pipeline activates `GA_RocketJump`.

Note that the Ability Set itself doesn't decide _when_ it applies to a player, that's the Equipment Definition's job (next step). The Ability Set is purely the tag-to-ability wiring.

<figure><img src="../../.gitbook/assets/image (285).png" alt=""><figcaption></figcaption></figure>

You don't need a custom Input Action or Input Mapping Context for rocket shoes _specifically_ because the Jump Input Action is already in the default Input Mapping Context, pressing jump is reachable from any pawn out of the box. For equipment that needs an input the default IMC doesn't cover (a custom toggle, an alt-fire, a charge), you'd add your own IA + IMC. See [How to extend further.](custom-equipment.md#how-to-extend-further)

Reference: [Ability Sets](../../base-lyra-modified/gas/ability-sets.md).
{% endstep %}

{% step %}
### Equipment Definition (`WID_RocketShoes`)

Create a new **Lyra Equipment Definition**. This is the composition panel, what gets wired up while the equipment is equipped.

Set:

* **Equipment Instance Class** — the default `Equipment Instance`. **No subclass needed.** Rocket shoes have no per-instance runtime state to override; all the behaviour is in the ability.
* **Ability Sets To Grant** — `AbilitySet_RocketShoes` from Step 2.
* **Slot configuration** — feet slot. This equipment can't be held, so there is no need to populate held behvaiours
* **Actors To Spawn** — leave empty for now; you'll wire `B_RocketShoe` in Step 4.

<figure><img src="../../.gitbook/assets/image (287).png" alt=""><figcaption></figcaption></figure>

Reference: [Defining Equippable Items](../../base-lyra-modified/equipment/defining-equippable-items.md).
{% endstep %}

{% step %}
### BP Actor for the visual (`B_RocketShoe`)

_Skip this step entirely if your equipment doesn't need a visible representation on the player._ Equipment doesn't require a visual actor, buff items, internal modifiers, and pure-effect items can omit this step.

For rocket shoes, create a Blueprint Class with a skeletal or static mesh component for the shoe. **Pure visual**, no game logic lives here. The mesh is a single shoe; it'll be spawned twice in Step 5, once per foot.

You _could_ split this into separate left and right models for fidelity. The shipped rocket shoes use one mesh for both feet, fine for most uses, easy to extend later.

Now go back to `WID_RocketShoes` (Step 3) and add `B_RocketShoe` to **Actors To Spawn** _twice_:

* First entry → attached to the left-foot socket on the character
* Second entry → attached to the right-foot socket
{% endstep %}

{% step %}
### Item Definition (`ID_RocketShoes`)

Create a new **Lyra Inventory Item Definition**. Add fragments:

* **Equipment Fragment** → point at `WID_RocketShoes` from Step 3. _Required._
* **Inventory Icon Fragment** → set the inventory icon texture, weight, and max stack. _Required for the item to display in inventory._
* **Pickup Fragment** _(optional)_ → if the item should be droppable.
* _**Tetris Fragment** (optional)_ -> if the item has a particular shape in the tetris invenotry

That's it for the data side. The Item Definition is intentionally thin, the Equipment Definition does the wiring; this asset is the inventory-facing record.

<figure><img src="../../.gitbook/assets/image (289).png" alt=""><figcaption></figcaption></figure>

Reference: [Item Definition](../../base-lyra-modified/items/items-and-fragments/item-definition.md), [Inventory Icon Fragment](../../base-lyra-modified/items/item-fragments-in-depth/inventory-icon-fragment.md).
{% endstep %}

{% step %}
### Verify

1. **Get `ID_RocketShoes` to the player.** Three paths:
   * **Auto-equip on spawn** — add `ID_RocketShoes` to the **Equipment Manager Component's `StartingEquipment`** array. The shoes are equipped immediately when the player spawns.
   * **Auto-add to inventory on spawn** — add `ID_RocketShoes` to the **Inventory Manager Component's `DefaultStartingItems`** array. The shoes appear in the player's inventory from the start; the player equips them manually.
   * **Place it in the world** — drop a **`WorldCollectableSpawner`** into your level and configure its inventory payload to include `ID_RocketShoes`. The spawner instantiates a pickup at runtime; the player walks up and collects it. For a permanent baked pickup, place an `AWorldCollectableBase` subclass (`_Static` or `_Skeletal`) directly.
2. Launch your Experience in PIE.
3. Equip the shoes (auto-equipped from `StartingEquipment`, manually equipped from the inventory, or picked up from the spawner, whichever path you chose).
4. **Confirm:**
   * Both shoe meshes appear on the player's feet (one per foot socket, from Step 4).
   * Pressing jump launches the character upward more than a regular jump
   * **Press jump a second time** to check if it activates again after landing. This is the real test that the ability ended cleanly: an ability that didn't end would block re-activation, and would not longer have super jumps.

If the shoes equip but the jump isn't replaced, the input tag binding in the Ability Set didn't take, confirm `InputTag.Jump` is exact and that the ability is being granted (use `showdebug abilitysystem` from the [Custom Ability Recipe](/broken/pages/652e02ba3c28a2dd5bcd91ae867ff93eb963a9f1#debug-helpers)).
{% endstep %}
{% endstepper %}

***

## What you can skip

This is the smallest equipment graph. Real-world equipment often skips even more:

* **No visual actor.** A buff item, internal modifier, or pure stat tweak doesn't need a `B_*` actor at all. Skip Step 4 entirely.
* **No abilities — just Gameplay Effects.** The Ability Set doesn't require abilities. If your equipment is a pure stat buff (10% damage resistance while worn, +20 max health, etc.), grant a Gameplay Effect through the Ability Set instead of an ability. The GE applies on equip, removes on unequip.
* **No subclassed Equipment Instance.** Default `Equipment Instance` is the right choice for most equipment. Subclass only when you have runtime stats to own (this is what weapons do as their logic involves continous ticking which isn't suitable for abilities).
* **For temporary buffs, use a Consume Item instead.** If the buff should be one-time-use rather than worn, the consume-item pattern fits better. See the [Custom Item Recipe](custom-item.md).

***

## Common pitfalls

* **Equipment Definition not referenced from the Item Definition.** A common silent failure: everything is built correctly, but Step 5's Equipment Fragment never points at `WID_RocketShoes`. The item appears in the inventory but pressing equip does nothing. Open the Item Definition and confirm the Equipment Fragment's reference is set.
* **Forgetting to call `EndAbility` in the granted ability.** Abilities don't auto-end. If `GA_RocketJump` activates but never calls `EndAbility`, the ability stays running, the player launches once and can't trigger jump again, because the ability blocks re-activation. Rocketshoes uses `WaitForMovementModeChange` to fire `EndAbility` on landing; any custom ability you grant through equipment needs an equivalent end condition.
* **Wiring ability and equipment together before either works in isolation.** If you build `GA_RocketJump`, the Ability Set, and the Equipment Definition all at once and nothing fires, the bug could be in any of three layers and you can't tell which. Grant the ability through a Pawn Data's `AbilitySets` first to confirm it activates on jump, then move it into the equipment Ability Set once it works on its own.
* **Subclassing the Equipment Instance with nothing to override.** A pointless subclass adds maintenance burden for no benefit. If your equipment has no runtime stats to vary (no recoil, no spread, no continuous tick logic), use the default `Equipment Instance` directly.
* **Inventory Icon Fragment missing.** The item won't display in the inventory UI without it. This is required, not cosmetic.

***

## How to extend further

Once the rocket shoes pattern lands, three places to take it:

#### **Equipment with custom input**

like **vortex armour** (`Plugins/GameFeatures/TetrisInventory/Content/Demo/Items/VortexArmor/`). Same pattern as rocket shoes, plus its own **Input Action** (`IA_Vortex_Armour`), **Input Mapping Context** (`IMC_VortexArmour`), invisibility **Gameplay Effect** (`GE_VortexInvisibility`), and looping **gameplay cue** (`GCNL_VortexInvisibility`). Read this when you need an equipment ability that the framework doesn't already have an input tag for.

#### **Equipment with attachable upgrades**

Like the **Kinetic Shield** in the same demo folder, which exposes an attachment slot (via the Attachment Fragment) for items like **Power Crystal**. The crystal itself is a normal item; attaching it grants extra abilities to the shield while the slot is occupied.

#### **Equipment with runtime stats**

anything where the per-instance stats vary at runtime (charges remaining, durability, heat level). This is when subclassing the Equipment Instance becomes worthwhile. Guns are the canonical example: see the [Custom Weapon Recipe](custom-weapon.md) for the full pattern.

When you're ready for a different system, head back to [Recipes](./).
