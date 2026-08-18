# Setup and Integration

The plugin has two independent opt-in surfaces. A **front-end experience** enables it so players can open the gunsmith and edit builds. **Game modes** enable it so players spawn with their selection. Either works without the other: a game with one fixed mode might skip the front end and consume presets only, while a menu-only build can offer the full editor before any mode consumes it.

Because the plugin is `ExplicitlyLoaded`, nothing in it exists at runtime until an experience lists it in `GameFeaturesToEnable`. Modes that never opt in are untouched.

{% hint style="success" %}
Two worked examples ship with the framework. **`B_Gunsmith_Experience`** with `L_GunsmithArmory` and `RS_Gunsmith_Default` is the front-end editor; **`B_TeamDeathmatch_Loadout`** with `RS_TeamDeathmatch` is a mode that consumes loadouts. Copy whichever matches what you are building.
{% endhint %}

## Authoring the Data

Four asset types drive everything, all created in the editor with no code.

{% stepper %}
{% step %}
#### Create perk definitions

Create a `ULoadoutPerkDefinition` per perk with its player-facing name, description, icon, and the `ULyraAbilitySet` it grants. A perk that only changes weapon numbers can point at a Blueprint subclass of `ULoadoutPerkAbility_WeaponStats` and list its stat tags, modifiers, and operations. Skip this step entirely if your game has no perks.
{% endstep %}

{% step %}
#### Create preset loadouts

Create `ULoadoutDefinition` assets for the builds you offer out of the box. Each holds a full `FLoadoutData`: weapons with their target equipment slots and attachment trees, gear, and perks. Presets are read-only at runtime; a player who edits one gets a clone saved as their own.
{% endstep %}

{% step %}
#### Create a stat display config

Create a `ULoadoutStatDisplayConfig` listing the stat tags the panel should show, each with a display name, format, unit suffix, display scale, and higher-is-better flag. These are the same tag attributes your weapon and attachment abilities already write. Weapons that never seed a listed tag simply show nothing for that row.
{% endstep %}

{% step %}
#### Create a rule set

Create a `ULoadoutRuleSet` tying it together: the builder slots this experience exposes with their kinds and allow-lists, the custom loadout cap, the attachment budget, an optional weapon allow-list, your presets, the fallback loadout, and the stat display config.
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Give every rule set a `DefaultLoadout`. It is the fallback for a player with no valid selection, and it is what a fully-illegal loadout falls back to. Without one, a player in that position spawns with nothing.
{% endhint %}

Add `Lyra.Loadout.Slot.*` tags for any builder slots beyond the four the plugin declares. Full field reference in [Data Model & Rule Sets](data-model.md).

## Opting In a Game Mode

An opted-in experience needs three entries, usually bundled into one `ULyraExperienceActionSet` so each mode adds a single reference.

{% stepper %}
{% step %}
#### `GameFeaturesToEnable`

Add `Loadout`, so the plugin's classes exist.
{% endstep %}

{% step %}
#### `GameFeatureAction_AddComponents`

Target `ALyraPlayerState`, component `ULoadoutConsumerComponent`, **client and server both**. The client instance is what submits the player's selection; without it, a dedicated server never learns what they chose.
{% endstep %}

{% step %}
#### `UGameFeatureAction_ConfigureLoadout`

Assign your rule set. The two actions can appear in either order.
{% endstep %}
{% endstepper %}

The mode's pawn matters too. The consumer is designed to be the **only** granter, so use an equipment manager whose `StartingEquipment` array is empty and leave `DefaultStartingItems` empty on the controller's inventory manager. The shipped TDM example does this with a dedicated `B_EquipmentManagerComponent_NoStartingWeapons`.

{% hint style="warning" %}
Do not try to empty `StartingEquipment` from code when the experience loads. The equipment manager grants its starting items during its own initialization, and racing it is fragile. Author the emptiness into the Blueprint defaults in the content browser.
{% endhint %}

Gear entries targeting the inventory need a `ULyraInventoryManagerComponent` on the **player controller**; equipment needs a `ULyraEquipmentManagerComponent` on the **pawn**.

## Enabling the Gunsmith in the Front End

The front-end experience needs the same `GameFeaturesToEnable` entry, a `UGameFeatureAction_ConfigureLoadout` with the rule set the editor should offer, and a `GameFeatureAction_AddWidgets` adding `WBP_GunsmithScreen`. It does **not** need the consumer component, because nothing spawns with loadouts in a menu.

Add a `B_ItemIconGeneratorComponent` to the player controller if you want rendered weapon icons in the browser and slot rows. Everything degrades gracefully to authored icons without it.

### Content availability and preview parity

The gunsmith can only offer weapons whose item definitions are loaded, so the front-end experience must list the content plugins those weapons live in. This has a useful side effect: fragment injection runs per enabled plugin when an experience loads, so listing a mode's plugin in the front-end experience also applies that mode's fragment injectors there. The preview rig then sees the same modified item definitions the mode will use, and stats match exactly.

The one inherent limit: two modes whose injectors modify the same item in conflicting ways cannot both be represented by a single front end at once. The preview is exact for whatever plugin set the front-end experience enables, and the consume-time sanitizer cleans up any legality drift when the player actually spawns.

## Switching Loadouts In a Match

Players author builds in the front end, never mid-match. What a mode **can** offer is a picker listing already-saved loadouts, which re-submits the selection through the consumer component. The new choice applies at the **next spawn**, which makes a death screen or pause menu the natural home for it.

Calling `SubmitLoadoutFromLocalSave` on the consumer component is all a custom picker needs; the browser view model already does this whenever the player selects a different loadout.

## Dedicated Servers

With the default local save backend, a loadout authored in the front end lives on the **client's** disk. The consumer component bridges that gap automatically: on the owning client it reads the local save and submits the selection with one reliable RPC, and the first grant for a remote player briefly waits for that submission rather than racing it. Nothing about this needs setup.

Trust-wise this changes nothing, because a save file on the client's disk is already client-authored data. That is why the server sanitizes at grant time regardless of where a loadout came from. The mechanism, its timing, and the knobs on it are covered in [Granting a Loadout](granting-loadouts.md).

When you move to an online backend, the server can read the player's loadouts itself and the client push stops being the source that wins. See [Extending](extending.md).

## Verifying an Integration

A checklist after wiring a mode:

* [ ] Load the mode's experience with no save present: players spawn holding the rule set's `DefaultLoadout`, and no default kit appears alongside it.
* [ ] Load an experience without the action set: no `ULoadoutConsumerComponent` exists on the PlayerState and the mode's normal kit is intact.
* [ ] Author and save a build in the front end, then enter the mode: the spawned weapon carries the authored attachments.
* [ ] Hand-edit a saved build to include an illegal attachment: the spawn strips it, the rest of the loadout still grants, and `LogLoadout` names what was dropped and why.
* [ ] Run a **dedicated server** with a client: the client spawns with its own selection on the very first life, not the preset.
* [ ] Die and respawn after switching loadouts in the picker: the new selection applies, and perks do not stack across lives.
