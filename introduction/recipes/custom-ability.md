# Custom Ability

## What you're building

Two worked examples teaching the two ability authoring patterns:

1. **Sniper ADS**, the **subclass-and-configure** pattern. Subclass the existing `GA_ADS` ability, set a handful of Class Defaults, and implement the scope view in the weapon's reticle widget. No graph edits to the ability, no overrides, the parent already wires the lifecycle. The textbook case for parameterisable variants where only data changes between siblings.
2. **Stim Injection,** where an ability is created **from-scratch**. Subclass `ULyraGameplayAbility` directly, author the `Activate` graph, apply a buff Gameplay Effect, wire a custom input, and call `EndAbility` when the buff duration expires. The textbook case for genuinely new behaviour no parent ability covers.

Together they cover the two patterns: subclass when only properties vary, build from scratch when the behaviour is new. The Sniper ADS recipe pairs with the sniper variant from the [Custom Weapon Recipe](custom-weapon.md); Stim Injection stands alone as a teaching example for the lifecycle (Activate → work → `EndAbility`) you'll use any time the framework doesn't already have a parent for what you're building.

By the end you'll know:

* When to subclass an existing ability vs. build one from scratch
* How to use a parent ability's Class Defaults properties to vary behaviour without touching its graph (Sniper ADS)
* The full Activate → work → `EndAbility` lifecycle for from-scratch abilities, including cooldowns and duration-based effects (Stim Injection)
* The common pitfalls that break abilities in subtle, multiplayer-only ways

> [!INFO]
> This recipe assumes you've completed the [Quick Start Guide](../quick-start-guide.md), have a [Game Feature Plugin](../installing-and-setup.md) of your own, and have read [Abilities](../../base-lyra-modified/gas/abilities.md) and [Ability Sets](../../base-lyra-modified/gas/ability-sets.md) at a glance.

## First: see what already exists

Before you build _anything_ as a custom ability, check whether the framework already ships something close. Common abilities you might already have a base for:

* **`GA_ADS`** — generic aim-down-sights (the parent for this recipe)
* **`GA_Grenade`** — throw arc, cookable, AoE damage
* **`GA_Melee`** — melee strike
* **`GA_Weapon_Fire_Hitscan` / `_BulletDrop` / `_Projectile`** — firing models for guns
* **`GA_Weapon_Reload_Magazine` / `_Shells`** — magazine and shell-by-shell reloads
* **`GA_Weapon_Inspect`** — weapon inspection animation
* **`GA_Emote`**, **`GA_DropHoldingItem`**, **`GA_QuickbarSlots`** — common input-driven abilities
* **`GA_PlaceObject`**, **`GAB_ShowWidget_WhenInputPressed`**, **`GAB_ShowWidget_WhileInputHeld`** — utility patterns

Once you know what's there, you have three approaches:

1. **Subclass and configure** — when only property values change between your variant and an existing ability. The activation logic and lifecycle are identical; only data differs. The Sniper ADS in this recipe is the textbook case (only camera mode and widget change between weapons), and the same is true for weapon-specific firing or reload variants where the parent already parameterises the differences.
2. **Standalone ability** — when the _behaviour_ itself differs. A new reload mechanism, a new firing model, anything where activation flow or end conditions don't match an existing parent. Don't subclass and try to override; write it as its own thing. Copying an existing ability as a starting template is a fine shortcut when something close enough exists, the copy lives as a standalone ability, not as a subclass.
3. **Build from scratch** — when nothing's even close to copy from.

**The default for genuinely new behaviour is standalone.** Subclassing is the right tool only when the variation is parameterisable.

## The shape of an ability

A Gameplay Ability is a self-contained chunk of "something the pawn can do." At runtime it has a small lifecycle:

1. **Granted** — added to the pawn's Ability System Component, usually through an Ability Set referenced from a Pawn Data or an Equipment Definition.
2. **Activated** — by an input, by a gameplay event, or by another ability. The framework checks ability tags, blocking tags, and trigger conditions before letting the activation through.
3. **Runs** — your code in `Activate` (in C++ or Blueprint). You apply Gameplay Effects, push camera modes, play montages, spawn projectiles, modify state.
4. **Ends** — _you_ are responsible for calling `EndAbility`. The framework cleans up effects/montages tagged as ability-owned.

Abilities are flexible, there are no strict constraints on what you put in C++ vs. Blueprint. The default shooter abilities live in C++ but expose relevant properties to Blueprint while inventory abililties are made entirely with blueprints, so you can subclass either way. Use whichever you're faster in.

References: [Abilities](../../base-lyra-modified/gas/abilities.md), [Ability Sets](../../base-lyra-modified/gas/ability-sets.md), [Gameplay Effects](../../base-lyra-modified/gas/gameplay-effects.md), [Gameplay Cues](../../base-lyra-modified/gas/gameplay-cues.md).

## Worked Example #1 — Sniper ADS (subclass and configure)

You have a sniper rifle from the weapon recipe. Aiming with it runs the framework's generic `GA_ADS`, a slight FOV zoom and a walk-speed reduction, no scope view. We're going to give it a proper scope.

Three things to know about how the generic ADS works, because the sniper version plugs into all three:

* **`GA_ADS` is granted at character level, not per weapon.** The hero Ability Set your experience uses grants it to every player, bound to `InputTag.Weapon.ADS`. Your sniper variant is granted per weapon on the _same_ input tag, and declares block and cancel tags so only one of the two runs.
* **The ability handles camera and movement.** On activate it pushes the camera mode from its **Third Person ADS** property, saves the character's walk speed, and multiplies it by **ADS Multiplier**. On end, when the aim input is released, it reverses both.
* **The scope visuals belong to the weapon's reticle widget.** While ADS is active the ability broadcasts a `Gameplay.Message.ADS` gameplay message. Every shipped reticle widget already subscribes to it and routes it into a custom `ADS` event that the standard weapons leave empty. The sniper's reticle implements that event to swap the crosshair for a scope overlay.

The asset graph:

```
GA_ADS_Sniper (Gameplay Ability — subclass of GA_ADS, no graph edits)
 └─ Class Defaults:
      ├─ Third Person ADS ............. → CM_SniperScope
      ├─ ADS Multiplier ............... → optional, walk speed while scoped
      ├─ Block Abilities with Tag ..... → Ability.Type.Action.ADS
      └─ Cancel Abilities with Tag .... → Ability.Type.Action.ADS

CM_SniperScope (Camera Mode — subclass of CM_ThirdPersonADS)

W_Reticle_Sniper (reticle widget — copy of W_Reticle_Rifle)
 └─ implements its ADS event: show scope overlay while aiming

Ability Set used by the sniper's Equipment Definition
 └─ add GA_ADS_Sniper, input tag InputTag.Weapon.ADS

ID_Rifle_Sniper (Item Definition from the weapon recipe)
 └─ ReticleConfig fragment → W_Reticle_Sniper
```

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Subclass `GA_ADS`

Create a new Gameplay Ability blueprint. **Subclass `GA_ADS`** at `Plugins/GameFeatures/ShooterBase/Content/Input/Abilities/GA_ADS`. Name it `GA_ADS_Sniper` and place it in your Game Feature Plugin's content folder.

<img src=".gitbook/assets/image (282).png" alt="" title="">

Subclassing `GA_ADS` gives you all the ADS plumbing for free: the camera-mode push, the walk-speed reduction and restore, the ADS gameplay message the UI reacts to, and end-on-input-release. You don't override anything; your subclass exists only to hold the sniper-specific property values you'll set in Step 3.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Custom camera mode for the scope view

The third-person sniper scope is mostly an illusion: the camera stays roughly where third-person normally puts it, the FOV drops dramatically (the zoom), and the visible "scope", the round black housing, crosshair, mil-dots, windage indicator, is the reticle overlay you'll build in Step 4. The camera mode handles the zoom; the reticle widget handles everything that looks like a scope.

Create a new camera mode asset (subclass `CM_ThirdPersonADS`). Name it `CM_SniperScope`. Configure on the Class Defaults:

* **Field of View** — dramatically reduced (8× scope ≈ 8°, 12× scope ≈ 5°). Lower values give tighter zoom.
* **Blend Time** — short (0.1–0.2s) so raising the scope feels snappy.
* **Blend Function** — `EaseOut` or `EaseInOut` for a smooth settle.
* **Target Offset curves** — optional. The third-person base lets you nudge the offset relative to the character based on view pitch. Most snipers don't need this; the FOV change carries the effect.

<img src=".gitbook/assets/image (290).png" alt="" title="CM_ThirdPersonADS">

Reference: [Camera Modes](../../base-lyra-modified/camera/camera-modes.md).

> [!INFO]
> **First-person scope.** A first-person sniper takes a different path entirely, instead of a UI scope, you align the weapon's scope mesh to the centre of the screen so the player looks _through_ the actual scope. That's a weapon-mesh manipulation, not a camera-mode change, and isn't covered by this recipe.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Configure `GA_ADS_Sniper`'s Class Defaults

Open `GA_ADS_Sniper` and set four things in the Class Defaults panel:

* **Third Person ADS** → `CM_SniperScope` (from Step 2). The parent pushes this on activate and clears it on end. If your project also runs a first-person viewpoint, set **First Person ADS** to a matching first-person camera mode.
* **ADS Multiplier** → optional. The parent multiplies the character's walk speed by this while aiming and restores it on end. Snipers usually want a lower value than the default 0.5.
* **Block Abilities with Tag** → `Ability.Type.Action.ADS`.
* **Cancel Abilities with Tag** → `Ability.Type.Action.ADS`.

The last two matter. The generic `GA_ADS` is still granted to the character and listens on the same input tag, so pressing aim while the sniper is held asks _both_ abilities to activate. `Ability.Type.Action.ADS` is the tag every ADS ability carries (your subclass inherits it), and the pair of tag settings makes the sniper version win regardless of activation order: cancel ends the generic one if it got in first, block stops it activating afterwards. Skip these and both abilities run at once, each saving and restoring walk speed over the top of the other, and the player comes out of aim stuck at ADS speed.

Save and compile. That's the whole ability.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Scope overlay in the sniper's reticle widget

The scope view is part of the weapon's reticle widget, the same widget that draws the hip-fire crosshair while the weapon is held. Copy `W_Reticle_Rifle` from `Plugins/GameFeatures/ShooterBase/Content/Weapons/Guns/Rifle` into your plugin and name it `W_Reticle_Sniper`.

The copy already does the plumbing: on Construct it listens for the `Gameplay.Message.ADS` gameplay message and routes it into a custom **ADS** event with a boolean `On` parameter, which the rifle leaves empty. Build your scope as a new full-screen layer in the designer, black borders for the scope housing, crosshair and mil-dots in the centre, collapsed by default, then implement the ADS event: when `On` is true, show the scope layer and hide the hip-fire crosshair; when false, reverse it. If you want the ammo counter visible while scoped, layer it inside the scope view too.

Finally, open `ID_Rifle_Sniper` (the sniper's Item Definition from the weapon recipe) and point the **ReticleConfig fragment** at `W_Reticle_Sniper`. Reticle widgets are shown while the weapon is held and removed when it's put away, which is why the scope layer starts collapsed and only appears when the ADS message says so.

Reference: [Reticle Fragment](../../base-lyra-modified/weapons/reticle-fragment.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Wire `GA_ADS_Sniper` into the sniper's Ability Set

Open the Ability Set used by the sniper's Equipment Definition (from the [weapon recipe](custom-weapon.md), or your own custom weapon). Add an entry:

* **Ability** → `GA_ADS_Sniper`
* **Input tag** → `InputTag.Weapon.ADS`

Now holding aim with the sniper equipped runs the sniper ability, and the block and cancel tags from Step 3 keep the character-level `GA_ADS` out of the way. Every other weapon keeps the generic ADS, the sniper behaviour travels with the sniper.

References: [Defining Equippable Items](../../base-lyra-modified/equipment/defining-equippable-items.md), [Ability Sets](../../base-lyra-modified/gas/ability-sets.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Verify

1. Equip the sniper variant in PIE.
2. Hold the aim input → camera blends to the scope FOV, the scope overlay appears, walk speed drops.
3. Release → camera blends back, the overlay hides, the hip-fire crosshair returns, and walk speed is back to normal. The walk-speed restore is the canary for the block and cancel tags: if you come out of aim still moving at ADS speed, both ADS abilities ran at once, recheck Step 3.
4. Run `showdebug abilitysystem` and aim: `GA_ADS_Sniper` should go active and the generic `GA_ADS` should stay inactive.
5. Take a long-range shot while scoped, confirm the bullet drop you tuned in the [Weapon Recipe](custom-weapon.md) is visible at range.

If the camera doesn't zoom, the Third Person ADS property from Step 3 may be unset. If the scope overlay never appears, check that the ReticleConfig fragment points at `W_Reticle_Sniper` and that its ADS event toggles the right layers.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

## Worked Example #2 — Stim Injection (from-scratch)

For Sniper ADS the parent did all the work. **Stim Injection is the opposite case**, no existing parent fits "press a button to apply a temporary self-buff," so you author the ability from scratch. Subclass `ULyraGameplayAbility` directly, write the `Activate` graph, apply effects, wire a custom input, and call `EndAbility` when the buff duration ends.

The behaviour: press an input → a 5-second heal-over-time begins on the player → cooldown applies → the ability ends when the buff duration expires. Modeled after COD-style stim shots.

Six steps. Scaffold the ability and supporting assets first; write the activation logic last.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Subclass `ULyraGameplayAbility`

Create a new Gameplay Ability blueprint. **Subclass `ULyraGameplayAbility`**, the framework's base class for abilities with no specialised parent. Name it `GA_StimInjection` and place it in your Game Feature Plugin's content folder.

Configure on Class Defaults:

* **Replication Policy** — `Do Not Replicate`, the ability does not replicate. The ability will run once on the client and then on the server separately.
* **Net Execution Policy** — `Local Predicted` for input-responsive self-buffs like this. The buff effect should feel instant on the local client
* **Ability Tags** — a unique tag identifying this ability (e.g. `Ability.StimInjection`).
* **Activation Owned Tags** — tags applied to the player while the ability is active (e.g. `Status.Buff.StimActive`). Useful if other systems (animation, audio, FX) need to know the player is in the stim state. The framework adds and removes these automatically.
* **Cancel / Block Abilities With Tag** — usually leave empty for a self-buff.

<img src=".gitbook/assets/image (314).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Cooldown Gameplay Effect

Create a new Gameplay Effect (e.g. `GE_Cooldown_StimInjection`). Configure:

* **Duration Policy** — `Has Duration`, with the cooldown length (e.g. 30 seconds).
* **Granted Tags** — add a tag like `Cooldown.Ability.StimInjection`. The `Cooldown.*` namespace is convention, not requirement.

The ability checks for this tag's absence before activating and applies the GE on activation; the framework removes the tag automatically when the duration expires.

Reference: [Gameplay Effects](../../base-lyra-modified/gas/gameplay-effects.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Buff Gameplay Effect

Create the buff effect (e.g. `GE_Heal_Stim`). The primary effect is a heal-over-time on the player's health. Configure:

* **Duration Policy** — `Has Duration`, with the buff length (e.g. 5 seconds).
* **Period** — how often the heal ticks (e.g. 1 second).
* **Modifiers** — apply a healing modifier to the Health attribute on `LyraHealthSet`. Each period, the modifier fires and the player's health goes up by the configured amount. Five seconds at +20 per second restores 100 health total over the duration; tune to taste.

When the duration expires the framework removes the GE automatically, the heal ticks stop and any granted tags clear, with no manual cleanup.

Reference: [Damage and Healing](../../base-lyra-modified/gas/damage-and-healing.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Custom input wiring

Stim Injection needs a new input, the default IMC doesn't ship a stim key. Four small assets, all standard Lyra input plumbing:

* **Input Action** (e.g. `IA_StimInjection`) — defines the input as a digital button press.
* **Input Mapping Context** — add `IA_StimInjection` to your project's existing default IMC, or create a new IMC for your equipment / mode.
* **Input Config** — bind the Input Action to an input tag (e.g. `IA_StimInjection` → `InputTag.Ability.StimInjection`).
* The pairing of `InputTag.Ability.StimInjection` to `GA_StimInjection` happens in the Ability Set in Step 6.

Reference: [Input](../../base-lyra-modified/input/).
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Author the `ActivateAbility` graph

This is the meaty step. In `GA_StimInjection`'s `ActivateAbility` graph:

1. **`CommitAbility`** first. This runs cost / cooldown checks and applies the cooldown GE from Step 2. **If you skip this, the cooldown never applies and the ability can be spammed.**
2. **`ApplyGameplayEffectToOwner`** with `GE_Buff_Stim` from Step 3. The heal-over-time begins ticking on the player.
3. From **`ApplyGameplayEffectToOwner`** → **`EndAbility`**. **This is the moment the ability ends.** Without it, the ability stays active forever, `Status.Buff.StimActive` stays on the player, the buff GE expires normally but the ability instance never gets cleaned up, and reactivation is silently blocked.

The `Status.Buff.StimActive` tag from Activation Owned Tags in Step 1 is automatically applied when `Activate` runs and removed when `EndAbility` is called, no manual tag management needed.



<img src=".gitbook/assets/image (315).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Wire `GA_StimInjection` into the Ability Set

Open the Ability Set the player should receive Stim Injection through. Add a new entry:

* **Ability** → `GA_StimInjection`
* **Input tag** → `InputTag.Ability.StimInjection` (the tag from Step 4)

Where the Ability Set lives depends on whether the ability is character-level or equipment-granted:

* **Character-level** (every player has the stim from spawn), add to the default Ability Set on the Pawn Data your Experience uses.
* **Equipment-level** (only players equipped with a stim-injector item or specific class can use it), create an Ability Set, reference it from an Equipment Definition, give the equipment to players via the Equipment Manager Component's `StartingEquipment` or via a `WorldCollectableSpawner`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Verify

1. Launch your Experience in PIE.
2. Press the stim input. Confirm:
   * `Status.Buff.StimActive` is on the player (use `showdebug abilitysystem`).
3. Press the input again immediately, it should be blocked by `Cooldown.Ability.StimInjection` still being present.
4. Wait for the 30-second cooldown to expire, press again, it should activate cleanly.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

## Common pitfalls

These are the four ways abilities break that you'll see most often. Three of the four work in a single-player PIE session and only manifest in multiplayer, a particularly cruel failure mode.

* **Forgetting to call `EndAbility`.** Abilities don't auto-end. If your custom Activate path forgets to end the ability, the ability stays active forever, blocking tags stay applied, ability cooldowns never start, and the player can't reactivate it.
* **Wrong trigger tag / input tag.** The ability has a tag that the input system uses to find it. If the tag on the ability and the tag in the input mapping don't match _exactly_, the ability is granted but never activates, and there's no error. If your ability isn't firing, this is the first thing to check.
* **Wrong blocking / cancellation tags.** Abilities cancel each other through tag relationships. A misconfigured blocking tag means your ability cancels something it shouldn't (the player can't fire while crouched), or _is_ cancelled by something it shouldn't be (your ADS ends the moment another ability starts). Set blocking tags only for genuine conflicts.
* **Wrong replication policy.** `Local Predicted` for client-responsiveness, `Server Initiated` for server-authority, `Server Only` for server-only logic. Pick the wrong one and the ability works in PIE-as-listen-server but fails in dedicated-server or PIE-as-client.
* **Two abilities on one input tag.** Granting a variant ability on an input tag that a character-level ability already listens on means a single press activates both. For abilities that save and restore state that goes subtly wrong: each activation saves the other's modified value as its "default," and the restore puts back the wrong one. The fix is the block and cancel tag pair from the Sniper ADS example, so only one of the two ever runs. If a value set by an ability sticks around after the ability ends, count how many abilities went active in `showdebug abilitysystem` before debugging the graph.

## Debug helpers

When an ability misbehaves, two console commands get you 80% of the way:

* **`showdebug abilitysystem`** — overlays the player's granted abilities, currently active abilities, applied gameplay effects, and current gameplay tags. If your ability isn't in the granted list, it wasn't granted; if it's granted but never appears in the active list, it's failing to activate (blocking tags, replication, or trigger).
* **`showdebug enhancedinput`** — overlays the active input mappings and which abilities each input is wired to. Use this to confirm your ability tag is reachable from the input you're pressing, and that no higher-priority mapping is shadowing it.

Run both at once in PIE. Together they answer: _is the ability granted, is the input reaching it, is something cancelling it?_

## More ability ideas

If you want to author another ability after these two, here are short sketches for a few that don't ship with the framework. These are genuinely new behaviours, so they go in standalone abilities subclassing `ULyraGameplayAbility` directly. (Copying an existing ability as a starting template is a fine shortcut where one is close enough.)

* **Self-Revive.** For BR / extraction modes. Player goes "down", holds an input for N seconds, recovers. Touches: down-state tag check, channelled-cast pattern (cancellable on damage / movement), cooldown GE, animation montage, optional UI revive bar.
* **Ground Slam.** Less typical for a shooter, but useful as a movement ultimate. Leap up, slam down, AoE damage on impact. Touches: movement override during the leap, AoE damage GE, on-impact cue, cooldown GE.

For both, [Abilities](../../base-lyra-modified/gas/abilities.md) is the reference, and [Gameplay Effects](../../base-lyra-modified/gas/gameplay-effects.md) covers cooldown / damage GE patterns.

## How to extend further

* **Granting through Pawn Data instead of Equipment.** For abilities that should belong to the _character_ (sprint, slide, the scan pulse above), grant them through the Pawn Data's default Ability Set rather than per-weapon. See [Pawn Data](../../base-lyra-modified/gameframework-and-experience/lyrapawndata.md).
* **Triggering on gameplay events.** Abilities can activate from events (kill, hit, damage taken) instead of inputs. Useful for accolade abilities, reactive cues, automatic state changes.
* **Cooldowns and costs.** [Gameplay Effects](../../base-lyra-modified/gas/gameplay-effects.md) is also where you author cooldown and resource-cost effects that the ability checks before activating.
* **Custom ability-system attributes.** If your ability needs to read or modify a stat that doesn't exist yet (charge level, ability charges), see [Attribute Sets](../../base-lyra-modified/gas/attribute-sets.md).

When you're ready for a different system, head back to the [Recipes](file:///).
