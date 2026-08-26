# Custom Weapon

## What you're building

A new gun, end-to-end. First, you'll walk through how the rifle in `Plugins/GameFeatures/ShooterBase/Content/Weapons/Guns/Rifle/` is actually built today, asset by asset. Then you'll take that rifle and turn it into a _sniper / marksman variant_, the most useful meta-lesson for a buyer: most weapon variation is parameter tuning, not new code.

> [!INFO]
> **Guns are equipment.** This recipe builds on the [Custom Equipment Recipe](custom-equipment.md), which teaches the general composition pattern (Item Definition, Equipment Definition, Equipment Instance, Ability Set). If you're new to the framework, read that first, Steps 1–5 below mirror it directly, and Steps 6–11 add the gun-specific layers (Gun Fragment, firing abilities, recoil, audio, reticle).

By the end, you'll know:

* Which assets a weapon is made of and what each one does
* The order to author them in (and why that order matters)
* How to add a new variant by subclassing the pieces you want to change
* The pieces that are easy to forget

> [!INFO]
> This recipe assumes you've completed the [Quick Start Guide](../quick-start-guide.md) and have a [Game Feature Plugin](../installing-and-setup.md) of your own to drop these assets into. Don't author weapons inside `ShooterBase` directly, duplicate them into your own plugin so framework updates don't overwrite your work.

***

## Workflow tip: advanced-copy the rifle folder

A weapon is around eleven assets that point at each other. Authoring each one from scratch leaves room to forget pieces, and missing pieces fail silently in subtle ways (a weapon with no reticle fragment _looks_ like it works, until you realise the crosshair never appears).

The fastest workflow is:

1. In the Content Browser, right-click `Plugins/GameFeatures/ShooterBase/Content/Weapons/Guns/Rifle/` → **Advanced Copy**.
2. Target your own Game Feature Plugin's content folder.
3. Rename the duplicated assets to your weapon's name (e.g. `ID_Rifle` → `ID_Carbine`).
4. Walk through the steps below and swap each piece's settings instead of starting empty.

If you'd rather build from scratch to learn the system, read the steps in order, every step explains _what_ asset to create and _why_, before you touch the editor.

***

## The shape of a weapon

Before the steps, the mental model. A weapon in this framework is built from a small graph of assets, each one owns a single concern, and they reference each other to compose into "something the player can equip and fire." Reading the graph first makes the step list below feel less like ceremony.

**The item itself.** The data record is an _Item Definition_ (e.g. `ID_Rifle`). On its own it's mostly empty, every capability the weapon has comes from _fragments_ added to it. A fragment is a small data class that grants one capability:

* _Gun_ — ammo, magazine size, spare ammo.
* _Equipment_ — links the item to the Equipment Definition. This is what makes the item equippable rather than just inventoriable.
* _Inventory Icon_ — name, description, icon, weight, max stack. **Required** for the weapon to appear in the inventory at all.
* _QuickBarIcon_ — quickbar slot icon, ammo glyph, name shown while equipped. **Required** for the quickbar to render the weapon.
* _ReticleConfig_ — reticle widget + ammo counter widget. Optional but strongly recommended.
* _Pickup_ — world drop / pickup. Optional.

#### **When the player equips it.**&#x20;

The _Equipment Definition_ (e.g. `WID_Rifle`) drives what happens on equip: it spawns the visible weapon actor in the player's hand, grants the abilities listed in its Ability Set, and activates the input bindings tied to those abilities. The Equipment Definition also points at an _Equipment Instance_ class, the runtime representation of the weapon in hand. Guns subclass it through the framework's `Gun Weapon Instance` chain.

#### **What the player sees and hears.**&#x20;

The visible weapon is a _BP Gun Actor_ (e.g. `B_Rifle`), a Blueprint actor with the weapon mesh and the cosmetic components: muzzle flash, shell ejection, tracers, firing audio. It has no gameplay logic. The shooting ability gameplay cues call into this actor when the weapon fires, so every per-weapon cosmetic, visual or audio, lives in one place.

#### **Pulling the trigger.**&#x20;

The Equipment Definition grants an _Ability Set_, a bundle of abilities active while the weapon is held. For most guns it's two: a _firing ability_ and a _reload ability_. Both are subclasses of existing abilities that come with this framework (hitscan, bullet-drop, or predictive-projectile firing; magazine or shell-by-shell reload), tuned by their properties rather than rewritten in code. The firing ability applies a _Damage Gameplay Effect_ on hit, that's where the weapon's actual damage values live.

#### **On screen.**&#x20;

The reticle widgets, a crosshair and an ammo counter, are referenced from the ReticleConfig fragment on the Item Definition. They're standard UMG widgets that are shown while the weapon is equipped and hides when it isn't.

The assets wire roughly like this:

```
ID_Rifle (Item Definition)
 ├─ Gun Fragment .................. ammo, magazine
 ├─ Equipment Fragment ............ → WID_Rifle
 ├─ Inventory Icon Fragment ....... name, icon, weight, max stacks (required for inventory)
 ├─ QuickBarIcon Fragment ......... quickbar slot icon + ammo glyph (required for quickbar)
 ├─ ReticleConfig Fragment ........ → W_Reticle_Rifle, W_AmmoCounter_Rifle
 └─ Pickup Fragment (optional) .... drop / world pickup behaviour

WID_Rifle (Equipment Definition)
 ├─ Actors To Spawn ............... → B_Rifle (BP Gun Actor — mesh, VFX, audio)
 ├─ Ability Sets To Grant ......... → AbilitySet_ShooterRifle
 │                                       ├─ GA_Weapon_Fire_Rifle ── damage GE: GE_Damage_Rifle
 │                                       │                          (default cues route to B_Rifle)
 │                                       └─ GA_Weapon_Reload_Rifle
 ├─ Input Mappings ................ fire / reload / aim bindings
 └─ Equipment Instance Class ...... → B_GunWeaponInstance_Rifle
                                          (subclass of B_GunWeaponInstanceBase —
                                           recoil curves, spread, falloff curve, animation layer)
```

Every step in [Build the rifle from scratch](custom-weapon.md#build-the-rifle-from-scratch) creates one of those nodes.

***

## **Live stats on a weapon**

The Custom Equipment Recipe explains the framework's three-place split for equipment state, static configuration on the Equipment Instance subclass, live values in tag attributes, persistent counts in item stat tags. A weapon uses all three. This section is the concrete walk-through on a rifle.

#### **Settings authored on the subclass.**&#x20;

A weapon's Equipment Instance class sits on top of an inheritance chain: `Gun Weapon Instance` → `Ranged Weapon Instance` → `Weapon Instance` → `Equipment Instance`. Each layer already implements something so your rifle doesn't have to:

* `Weapon Instance` — anim-layer selection (which third-person body pose the character uses while holding the weapon), gamepad haptic device properties, equip and fire timing.
* `Ranged Weapon Instance` — the heat-based spread system, per-state spread multipliers (aiming, crouching, jumping), distance damage falloff, per-surface damage modifiers, bullet trace config.
* `Gun Weapon Instance` — recoil (vertical and horizontal recoil curves, recoil recovery).

Your rifle subclass (`B_GunWeaponInstance_Rifle`, authored in Step 2) plugs values into the curves and asset references those layers read, the hold animation, recoil curves, damage falloff curve, equip/unequip montages, and starting values for live stats like base spread. You don't reimplement spread, falloff, or recoil from scratch.

#### **Live values in tag attributes.**&#x20;

Walk through what happens to the rifle's spread as the player picks it up, snaps on a stability attachment, fires, removes the attachment, and unequips:

1. The rifle is equipped → the firing ability writes the starting `SpreadExponent` value (from the subclass default) into the Equipment Instance's tag-attribute list.
2. A stability attachment is added → it modifies `SpreadExponent` by tag (narrows it).
3. The player fires → the firing ability reads the current `SpreadExponent` from the list and computes the shot.
4. The attachment is removed → the modification is reversed; `SpreadExponent` returns to the rifle's base value.
5. The player unequips the rifle → `SpreadExponent` is gone from the list. Next equip starts fresh from the subclass default.

Every system in the scenario reads and writes by tag name. The firing ability doesn't know which attachments are on the rifle; the attachment doesn't know which weapon it's bolted onto. They just touch `SpreadExponent`.

#### **Persistent counts as item stat tags.**&#x20;

Magazine ammo isn't a tag attribute. The Gun Fragment on the Item Definition (Step 1) configures the magazine _size_; the current ammo _count_ is stored as a stat tag on the inventory item, so a half-loaded magazine survives the player swapping to a knife and back. Same for kill counters and any durability counter your game tracks.

You'll meet tag attributes again in Step 2 (the spread starting value you tune) and in Step 4 of the sniper variant.

***

## Build the rifle from scratch

The order matters: an asset can only reference another that already exists. The order below avoids "I need to point at X but X isn't made yet" friction.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Item Definition + Gun Fragment

Create a new **Lyra Inventory Item Definition** asset. Name it for your weapon (e.g. `ID_Rifle`). On the Fragments array, add a **Gun Fragment**.

The Gun Fragment is what makes this item _a gun_ rather than a generic equippable. Set:

* **Magazine ammo** — clip size
* **Spare ammo** (inventory ammo) — what the player carries
* **Ammo type** (if your project uses typed ammo)

Reference: [Gun Fragment](../../core-modules/shooter-base/weapons/gun-fragment/) covers ammo, reload behaviour, and the staged-reload extension.

<img src=".gitbook/assets/image (298).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
### Equipment Instance class

Create a new Blueprint Class. **Subclass `B_GunWeaponInstanceBase`** (lives at `Plugins/GameFeatures/ShooterBase/Content/Weapons/Guns/B_GunWeaponInstanceBase.uasset`). Name it for your weapon (e.g. `B_GunWeaponInstance_Rifle`).

This class represents the weapon at runtime. Its parents stack as: `Equipment Instance` → `Weapon Instance` → `Range Weapon Instance` → `Gun Weapon Instance` → `B_GunWeaponInstanceBase`. Inheriting from the deepest sensible parent matters: subclass too high (e.g. directly from `Equipment Instance`) and you lose recoil, spread, and falloff.

In the Class Defaults you can set:

* **Linked Animation Layer** — the anim BP layer applied to the character while holding this weapon
* **Equip / Unequip montages** — animations played on swap
* **Distance damage falloff curve**
* **Material damage multipliers** (per-surface modifiers). You can add headshot/body multipliers here
* **Recoil and spread parameters** — _or_ author these visually with the [Recoil Editor](../../core-modules/shooter-base/weapons/gun-weapon-instance/recoil-editor-guide.md)

What you're setting in this panel are the static asset references and the designer-authored _defaults_ for the live stats. At runtime, the live values (e.g. `SpreadExponent`, current heat) are pushed into the Equipment Instance's **tag attribute** container, where the firing ability reads them and attachments modify them. So the value you tune here is the starting point; attachments compose on top of it without changes to this class. See [Equipment Instance: Tag Attributes](../../base-lyra-modified/equipment/equipment-instance.md#tag-attributes-flexible-parameters-without-subclassing) for the tag-attribute container API.

Reference: [Range Weapon Instance](../../base-lyra-modified/weapons/range-weapon-instance.md), [Gun Weapon Instance](../../core-modules/shooter-base/weapons/gun-weapon-instance/).

<img src=".gitbook/assets/image (299).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
### Ability Set (fire + reload abilities)

Create a **Lyra Ability Set** asset (e.g. `AbilitySet_ShooterRifle`). It will reference the firing and reload abilities you build in Steps 8 and 9, but you create the asset _now_, empty, so the Equipment Definition in Step 4 has something to point at.

If your weapon needs custom inputs (aim, fire, reload, alt-fire), create an **Input Mapping** asset for it as well; otherwise the Equipment Definition can use the shared shooter inputs.

Reference: [Ability Sets](../../base-lyra-modified/gas/ability-sets.md), [Input](../../base-lyra-modified/input/).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Equipment Definition

Create a new **Lyra Equipment Definition** asset (e.g. `WID_Rifle`). This is the _composition_ panel, the place where everything the player gets _while holding this weapon_ is wired in.

Set:

* **Equipment Instance Class** — point at `B_GunWeaponInstance_Rifle` from Step 2
* **Actors To Spawn** — leave empty for now; you'll add the BP Gun Actor in Step 6
* **Ability Sets To Grant** — point at the empty Ability Set from Step 3
* **Input Mappings** — your custom mapping, or the shared shooter mapping

The Equipment Definition is also where _arbitrary_ behaviours go. Want a dual-wield pistol that grants a left-hand-shoot ability instead of aiming? Add a second weapon actor and a second ability set entry here. Want a melee gravity hammer that grants a custom slam ability? Same pattern, the Equipment Definition is the seam.

Reference: [Defining Equippable Items](../../base-lyra-modified/equipment/defining-equippable-items.md).

<img src=".gitbook/assets/image (300).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
### Wire the Equipment Fragment into the Item Definition

Open `ID_Rifle` from Step 1. Add an **Equipment Fragment** to the Fragments array and point it at `WID_Rifle` from Step 4.

This is the bridge: when this item is equipped, the framework reads the Equipment Fragment to know which Equipment Definition to apply.
<!-- gb-step:end -->

<!-- gb-step:start -->
### BP Gun Actor (visible weapon + VFX)

Create a new Blueprint Class subclassing the framework's gun actor base (e.g. `B_Rifle`). This is the actor players see in the world and on the character, it's purely cosmetic.

Set up:

* **Skeletal mesh** for the weapon body
* Optional: **enable shell eject** + Niagara system + shell mesh
* Optional: **muzzle flash** Niagara system
* Optional: **tracer system** Niagara system
* Optional: **firing audio**, MetaSound or sound asset, configured directly on the actor

No game logic lives here. The framework's generic firing gameplay cues call into this actor for tracer, fire effect, impact, _and_ audio reactions, so every per-weapon cosmetic, visual or audio, lives in one place. This actor just owns the assets and reacts when called.

Now go back to `WID_Rifle` (Step 4) and add `B_Rifle` to **Actors To Spawn** with the appropriate socket.

<img src=".gitbook/assets/image (301).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
### Damage Gameplay Effect

Create a **Gameplay Effect** asset (e.g. `GE_Damage_Rifle`). Configure the damage values and any modifiers (headshot multiplier, surface modifiers, etc.) you want applied on hit. The firing ability in Step 8 will apply this effect on every confirmed shot.

Reference: [Gameplay Effects](../../base-lyra-modified/gas/gameplay-effects.md), [Damage and Healing](../../base-lyra-modified/gas/damage-and-healing.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Subclass a firing ability

Create a new Gameplay Ability by subclassing one of the framework's range firing abilities, depending on the projectile model you want:

* **Hitscan** — instant trace + hit confirmation. Cheap and snappy. Use for most rifles, SMGs, pistols.
* **Bullet drop** — server-simulated bullet with gravity. Use for sniper rifles, marksman weapons.
* **Predictive projectile** — client-spawned projectile reconciled by the server. Use for grenade launchers, rocket launchers, anything where the projectile is visible mid-flight.

Name it for your weapon (e.g. `GA_Weapon_Fire_Rifle`). In the Class Defaults:

* Set the **damage Gameplay Effect** to `GE_Damage_Rifle` from Step 7
* Tune fire rate, spread, range, whatever the parent exposes
* Note the `GameplayCue___` variables, you can optionally override its tag in Step 10

Now open the Ability Set from Step 3 and add this firing ability as a granted ability.

Reference: [Shooting Gameplay Abilities](../../core-modules/shooter-base/weapons/shooting-gameplay-abilities/).

<!-- tabs:start -->
#### **Hitscan**
<img src=".gitbook/assets/image (305).png" alt="" title="">


#### **Bullet Drop**
<img src=".gitbook/assets/image (303).png" alt="" title="">


#### **Projectile**


<!-- tabs:end -->
<!-- gb-step:end -->

<!-- gb-step:start -->
### Subclass a reload ability

Create a new Gameplay Ability subclassing the framework's reload ability (e.g. `GA_Weapon_Reload_Rifle`). Most weapons override only the magazine reload ability `GA_Weapon_Reload_Magazine` to add their custom reload montages. Shotguns and other shell-by-shell weapons subclass a the shell version `GA_Weapon_Reload_Shells`, see [Staged Reload Support](../../core-modules/shooter-base/weapons/gun-fragment/staged-reload-support.md).

Add this reload ability to the Ability Set from Step 3.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Optional: override gameplay cues

By default, all per-weapon cosmetics, tracers, fire effects, impact reactions, and audio, are configured directly on the BP Gun Actor (Step 6). The framework's generic firing gameplay cues call into the actor and let it activate the right reaction. **You don't need to author new gameplay cues for a typical weapon.**

Override only when you want behaviour that isn't expressible as actor-side configuration: dynamic audio that crossfades by ammo type, an impact response that depends on the surface _and_ an attached suppressor, a tracer effect driven by gameplay state. The firing ability exposes three overridable cue tag variables:

* **Fire effects** cue
* **Tracer** cue
* **Impact** cue

To override one, create a new Gameplay Cue Notify, define a new tag, and replace the corresponding tag variable on your firing ability subclass (Step 8). The actor-side defaults still handle the other two cues unless you override them too, you can mix and match.

Reference: [Gameplay Cues](../../base-lyra-modified/gas/gameplay-cues.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Reticle, ammo counter, and the matching fragments

Create two UMG widgets, or copy and rename `W_Reticle_Rifle` and `W_AmmoCounter_Rifle`:

* The **reticle widget** — your crosshair
* The **ammo counter widget** — current / spare ammo display

Then open `ID_Rifle` (Step 1) and add three more fragments:

* **Inventory Icon Fragment** — set the inventory icon texture, name, description, weight, and max stacks. **Required** for the weapon to display in the inventory UI at all.
* **QuickBarIcon Fragment** — set the quickbar slot icon brush, the ammo brush (the ammo-type glyph shown next to the slot), and the display name shown while the weapon is equipped. **Required** for the quickbar to render the weapon correctly.
* **ReticleConfig Fragment** — point at the reticle widget and the ammo counter widget. Optional but strongly recommended.

The two icon fragments serve different surfaces. **Inventory Icon** is what the player sees when browsing the inventory, the full record (name, description, weight). **QuickBarIcon** is what the player sees on the quickbar slot, a smaller icon plus the ammo glyph that tells them at a glance which weapon is in which slot. Without Inventory Icon the weapon won't show up in the inventory at all; without QuickBarIcon the quickbar slot won't render properly when the weapon is bound to it. Without ReticleConfig the weapon still functions (fire, reload, hit things), the player just gets no crosshair and no ammo HUD.

Reference: [Reticle Fragment](../../base-lyra-modified/weapons/reticle-fragment.md), [Inventory Icon Fragment](../../base-lyra-modified/items/item-fragments-in-depth/inventory-icon-fragment.md).
<!-- gb-step:end -->
<!-- gb-stepper:end -->

#### Verify it works

1. Get `ID_Rifle` to the player. Two main paths: add it to the **Equipment Manager Component's `StartingEquipment`** (auto-equipped on spawn), or place a **`WorldCollectableSpawner`** in your level configured with `ID_Rifle` (the player picks it up). The `DefaultStartingItems` array on the Inventory Manager Component is a third option if you want it in the inventory but not auto-equipped.
2. Launch your Experience in PIE.
3. Check: the weapon spawns on the character (Step 6 wired up), fires (Step 8), reloads (Step 9), shows your reticle (Step 11), plays your VFX and audio (Step 6), applies damage (Steps 7–8), and shows the right ammo count (Step 1 → Step 11).

If any of those don't work, the [Common pitfalls](custom-weapon.md#common-pitfalls) section below lists the most likely culprits.

***

## Variant: sniper / marksman rifle

You have a working rifle. Now build a **sniper variant**, a long-range marksman version with reduced fire rate, higher damage per shot, tighter spread, and physical bullet drop instead of instant hitscan. The whole point of this section is to show that you don't write new abilities, projectiles, or VFX for a variant. You **advanced-copy the rifle folder, change a parent class, and tune values**. That's it.

You'll touch around five of the assets you copied. Two changes are pure value-tuning. One is a _reparenting_, a single dropdown swap in the firing ability that switches your weapon from hitscan to bullet drop without touching ability code.

If you want to pair this sniper with a true scope-view aim-down-sights ability, follow the [Custom Ability Recipe](/broken/pages/652e02ba3c28a2dd5bcd91ae867ff93eb963a9f1) after this, its worked example is the matching Sniper ADS ability.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Advanced-copy the rifle folder

Same trick as the workflow tip at the top of this page. Copy `Rifle/` to your Game Feature Plugin and rename:

* `ID_Rifle` → `ID_Rifle_Sniper`
* `WID_Rifle` → `WID_Rifle_Sniper`
* `B_GunWeaponInstance_Rifle` → `B_GunWeaponInstance_Sniper`
* `GA_Weapon_Fire_Rifle` → `GA_Weapon_Fire_Sniper`
* `GE_Damage_Rifle` → `GE_Damage_Sniper`

Re-point references inside the duplicated assets so each renamed asset references its renamed siblings (the duplication preserves links to the original folder; you want them linking to the new folder).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Reparent the firing ability (hitscan → bullet drop)

Open `GA_Weapon_Fire_Sniper`. **Reparent** it: in the Class Settings panel, change the parent class from the hitscan firing ability to the bullet-drop firing ability.

Why: hitscan is right for assault rifles and SMGs at engagement ranges where bullets effectively travel instantly. A sniper is _meant_ to be a long-range, lead-the-target weapon, the player learning to compensate for drop _is_ the gameplay. Reparenting moves the entire firing pipeline (trace logic, replication, latency handling) from one model to the other in a single dropdown change. The framework hides the rest.

Reference: [Bullet Drop](../../core-modules/shooter-base/weapons/shooting-gameplay-abilities/bullet-drop.md), [Hitscan](../../core-modules/shooter-base/weapons/shooting-gameplay-abilities/hitscan.md).

<img src=".gitbook/assets/image (307).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
### `Step 3 — Update the visible weapon (B_SniperRifle)`

The advanced-copy duplicated `B_Rifle` into your folder. After renaming it to `B_SniperRifle` in Step 1, open it, this actor is the sniper's _visual identity_, holding the mesh, muzzle flash, tracer, shell eject, and firing audio. Update each component for sniper feel:

* **Skeletal mesh** — swap to the sniper rifle model.
* **Firing audio** — replace with a heavier, longer-tail sound. Snipers should sound nothing like assault rifles.
* **Muzzle flash** Niagara system — often larger and smokier on snipers. Optional.
* **Tracer system** — sniper rounds often show a visible tracer at long range. Optional.
* **Shell eject** mesh + Niagara — larger-calibre shell. Optional.

`WID_Rifle_Sniper`'s **Actors To Spawn** entry should already point at `B_SniperRifle` (the advanced-copy preserved local references inside the duplicated folder). Confirm it does, if it still points back at `B_Rifle`, you missed re-pointing references in Step 1.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Tune for marksmanship

This step is the bulk of the variant work and it's all property panels. Three assets, no new code:

**`GA_Weapon_Fire_Sniper`** (firing ability):

* Fire rate **down** dramatically (sniper rates, one shot every 1–2 seconds)
* Bullet velocity / drop curves tuned to your engagement ranges

**`GE_Damage_Sniper`** (damage gameplay effect):

* Damage **up**, most snipers one-shot to the chest at full health, or near it
* Headshot multiplier **up**

**`B_GunWeaponInstance_Sniper`** (equipment instance):

* **Spread** tightened, snipers should be near-pinpoint accurate. The value you set here seeds the live `SpreadExponent` tag attribute the firing ability reads at fire time, so any stability attachment (e.g. a heavy barrel) composes on top of the sniper's tighter base
* **Recoil profile** more vertical, larger single kick (use the [Recoil Editor](../../core-modules/shooter-base/weapons/gun-weapon-instance/recoil-editor-guide.md))
* **Distance damage falloff** flattened,snipers shouldn't lose damage at range
* **Linked Animation Layer**,swap to a sniper anim BP if you have one
<!-- gb-step:end -->

<!-- gb-step:start -->
### Update the reticle for a sniper crosshair

Open `ID_Rifle_Sniper` and find its **ReticleConfig Fragment**. Repoint the reticle widget reference at a sniper-style crosshair widget (or duplicate `W_Reticle_Rifle`, redesign it, and reference the new one). Repoint the ammo counter widget too if you want a sniper-specific HUD.

A scope-view ADS ability is _not_ part of this step, that's an ability concern, covered in the [Custom Ability Recipe](/broken/pages/652e02ba3c28a2dd5bcd91ae867ff93eb963a9f1). The reticle change here is just the on-screen crosshair when the weapon is held but not aimed.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Verify

1. Add `ID_Rifle_Sniper` to the Equipment Manager Component's `StartingEquipment` (or place it in the level via a `WorldCollectableSpawner`).
2. Launch your Experience.
3. Confirm: slower fire rate, much higher damage per shot, bullets visibly drop at long range, tighter spread, sniper crosshair displayed.

You added a meaningful weapon variant by changing one parent class and tuning eight or nine values. Most of your weapon roster will be built this way. The from-scratch walkthrough above is the foundation; the variant section is what you'll do every time after.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Common pitfalls

* **Forgetting pieces.** A weapon is around eleven assets. Missing the Reticle Fragment leaves no crosshair. Missing the Equipment Fragment on the Item Definition means the weapon never appears in hand. **Use the advanced-copy workflow** at the top of this page, it's the single most reliable way to avoid this.
* **Subclassing the wrong Equipment Instance class.** Subclass too high (`Equipment Instance` directly) and you lose recoil, spread, and damage falloff. Always subclass `B_GunWeaponInstanceBase` for guns.
* **Damage GE not assigned.** The firing ability has a `damage gameplay effect` variable. If it's empty, shots register but do zero damage. This fails silently, there's no error.
* **Authoring weapons inside ShooterBase.** Always work inside _your own_ Game Feature Plugin. ShooterBase is framework code, your changes will fight future updates.
* **Empty Ability Set.** If Step 3's Ability Set is still empty when you point the Equipment Definition at it, the player gets no fire and no reload abilities when they equip the weapon. Wire the abilities in once Steps 8 and 9 are done.

***

## How to extend further

* **Different firing models** — every variant in [Shooting Gameplay Abilities](../../core-modules/shooter-base/weapons/shooting-gameplay-abilities/) (hitscan, bullet drop, predictive projectile) is a drop-in replacement at Step 8.
* **Recoil authoring** — visual curve editing instead of property tweaking: [Recoil Editor Guide](../../core-modules/shooter-base/weapons/gun-weapon-instance/recoil-editor-guide.md).
* **Attachments** — sights, grips, suppressors, magazines: [Attachment System](../../base-lyra-modified/items/item-fragments-in-depth/attachment-system/).
* **Staged reload (shell-by-shell)** — for shotguns and similar: [Staged Reload Support](../../core-modules/shooter-base/weapons/gun-fragment/staged-reload-support.md).
* **Advanced ammo systems** — typed ammo: [Advanced Ammo System](../../core-modules/shooter-base/weapons/gun-fragment/advanced-ammo-system.md).
* **Customization & extension reference** — the deeper picture: [Weapons Customization & Extension](../../core-modules/shooter-base/weapons/customization-and-extension.md).

When you're ready for a different system, head back to [Recipes](./).
