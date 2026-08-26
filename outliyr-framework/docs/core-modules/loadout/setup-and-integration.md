# Setup and Integration

The plugin has two independent opt-in surfaces. A **front-end experience** enables it so players can open the gunsmith and edit builds. **Game modes** enable it so players spawn with their selection. Either works without the other: a game with one fixed mode might skip the front end and consume presets only, while a menu-only build can offer the full editor before any mode consumes it.

Because the plugin is `ExplicitlyLoaded`, none of its actions run until an experience lists it in `GameFeaturesToEnable`. Modes that never opt in are untouched.

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

There are two ways to reach the editor, and they differ in more than presentation.

The **armory route** is what `DA_Gunsmith` ships: a user-facing experience pairing `B_Gunsmith_Experience` with its own map, `L_GunsmithArmory`. Selecting it from the experience list hosts a session and travels, so the editor arrives on a purpose-built bench with its own lighting and a full screen to itself. The cost is a loading screen on the way in, and no route back to the menu that is not another travel.

The **in-menu route** hosts the same screen inside the front-end experience. A button injected into the main menu opens it, and back closes it, with no travel in either direction. That is the shape most shooters use.

What is not available is a third option: an experience cannot be exchanged while a world is running, because the experience manager loads one per world and unloads it only when that world ends. Hosting the widget in the world that is already open is the mechanism rather than a workaround.

Neither route needs the consumer component, because nothing spawns with loadouts in a menu.

#### The In-Menu Route

Everything the front end needs travels in one action set, `LAS_Gunsmith_FrontEnd`, so opting in is a single field.

{% stepper %}
{% step %}
**Add the action set**

Open your front-end experience, `B_LyraFrontEnd_Experience` in the shipped project, and add `LAS_Gunsmith_FrontEnd` to its `ActionSets`. (You might need to make `LyraCore` dependent on `GunSmith` so `LAS_Gunsmith_FrontEnd`  appears in the dropdown).

The action set enables the `Loadout` and `ShooterBase` plugins, publishes `RS_Gunsmith_Default` as the active rule set, injects the gunsmith button into the main menu, and adds the icon generator component to the player controller. Nothing else in the front end changes, and the action set is the only reference your project holds into the plugin.
{% endstep %}

{% step %}
**Retire the armory tile**

`DA_Gunsmith` still appears in the experience list, which leaves players two routes to the same editor with different ways out of it. Set `bShowInFrontEnd` to false on it unless offering both is deliberate.
{% endstep %}

{% step %}
**Verify**

Open and close the gunsmith ten times, then look for `LoadoutPreviewRig` actors far below the level. There should be at most one. A climbing count means the editing session is not being ended when the screen closes.
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
The preview rig spawns into whatever world hosts the screen, well below the level, and equips real weapons whose cosmetic actors spawn alongside it. `L_LyraFrontEnd` has nothing at that depth. A custom front-end map with geometry or a volume reaching down there will notice.
{% endhint %}

#### Using a Different Rule Set

The rule set is a per-experience decision. A front end offering something other than `RS_Gunsmith_Default` duplicates `LAS_Gunsmith_FrontEnd` into its own content, repoints the `UGameFeatureAction_ConfigureLoadout` inside the copy, and adds that to `ActionSets` in place of the original.

#### Building Your Own Menu Entry

A front end that is not `W_LyraFrontEnd` supplies its own hole for the button. Host a `UUIExtensionPointWidget` tagged `HUD.Slot.MainMenu` wherever entries belong, and the shipped action set fills it without knowing anything about your menu. This is the same mechanism `HUD.Slot.GameMenu` uses for the pause menu.

Closing is the part worth stating, because it needs less than people expect. Tick `Is Back Handler` on your screen and write nothing else. A back press then deactivates the widget, which pops it off the layer, because deactivating is what `UCommonActivatableWidget` already does when it handles a back action. `W_ExperienceSelectionScreen` is the shipped example: the flag is set and there is no back graph anywhere in it.

Subclassing `WBP_GunsmithScreen` is the one case that needs more. It implements `BP_OnHandleBackAction` to open the game menu, which is what the armory wants, since nothing sits beneath the screen there and leaving is a travel. A child inherits that, so a child hosted in a menu overrides `BP_OnHandleBackAction` and returns **false**, which hands the press back to the default behaviour and pops the screen. `WBP_GunsmithScreen_InMenu` already does this.

#### Content Availability and Preview Parity

The plugins ship registered rather than dormant, so their content is mounted and their modules loaded from startup, and a weapon's item definition resolves whether or not an experience names its plugin. What listing a plugin in `GameFeaturesToEnable` does is run that plugin's actions and its fragment injectors.

Injectors are the reason to list a mode's plugin in a front-end experience. Fragment injection runs per enabled plugin when an experience loads, so listing a mode's plugin there applies that mode's injectors to the menu as well. The preview rig then sees the same modified item definitions the mode will use, and stats match exactly.

{% hint style="warning" %}
A plugin's actions apply wherever it is enabled, the main menu included, so read its GameFeatureData `Actions` array before listing it in a front-end experience. ShooterBase is safe: a gameplay cue path, a data registry, a client-only game state component that never ticks, and one ability set granted to the player state and never activated. An action that adds widgets, registers input mapping contexts, or swaps the pawn or HUD class is not, because all three take effect over your menu.
{% endhint %}

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
* [ ] Open and close the in-menu gunsmith ten times: the number of `LoadoutPreviewRig` actors below the level does not climb.
