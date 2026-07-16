# setup and integration

The plugin has two independent opt-in surfaces. The **front-end experience** enables it so players can open the gunsmith and edit loadouts. **Game modes** enable it so players spawn with their selection. You can adopt either without the other: a game with one fixed mode might skip the front end and only consume presets, while a menu-only build can offer the full editor before any mode consumes it.

Because the plugin is `ExplicitlyLoaded`, nothing in it exists at runtime until an experience lists it in `GameFeaturesToEnable`. Modes that never opt in are untouched.

***

## Authoring the Data

Three data assets drive everything, all created in the editor with no code:

{% stepper %}
{% step %}
#### Create preset loadouts

Create `ULoadoutDefinition` assets for the builds you want to offer out of the box. Each one holds a full `FLoadoutData`: weapons with their target equipment slots, attachment trees, gear, and perks. Presets are read-only at runtime; a player who edits one gets a clone saved as their own custom loadout.
{% endstep %}

{% step %}
#### Create a stat display config

Create a `ULoadoutStatDisplayConfig` and list the stat tags the gunsmith's stat panel should show, with a display name, format, and higher-is-better flag per tag. These are the same tag attributes your weapon and attachment abilities already write, for example `Weapon.Stat.SpreadExponent`. Weapons that never seed a listed tag simply show nothing for that row.
{% endstep %}

{% step %}
#### Create a rule set

Create a `ULoadoutRuleSet` tying it together: the builder slots this experience exposes, the maximum custom loadouts per player, the attachment budget per weapon, an optional weapon allow-list, your presets, the fallback loadout for players with no valid selection, and the stat display config. Different experiences can reference different rule sets, which is how one game offers different loadout rules per mode with no code.
{% endstep %}
{% endstepper %}

***

## Opting In a Game Mode

An opted-in experience needs three entries, which you will usually bundle into one `ULyraExperienceActionSet` so each mode adds a single reference:

1. **`GameFeaturesToEnable`** — add `Loadout`, so the plugin's classes exist.
2. **`GameFeatureAction_AddComponents`** — target `ALyraPlayerState`, component `ULoadoutConsumerComponent`, server and client. The client presence is what powers the loadout submission from the owning client.
3. **`UGameFeatureAction_ConfigureLoadout`** — assign your rule set. This publishes it to the world's `ULoadoutSubsystem` on activation, where the consumer and the gunsmith read it. The two actions can appear in any order.

The mode's pawn matters too. The consumer is designed to be the **only** granter, so ensure the `EquipmentManagerComponent` in the experience has an empty `StartingEquipment` array, and leave `DefaultStartingItems` empty on the controller's inventory manager.

{% hint style="warning" %}
Do not try to empty `StartingEquipment` from code when the experience loads. The equipment manager grants its starting items during its own initialization flow, and racing it is fragile. Author the emptiness into defaults i.e the blueprint assets in the content browser.
{% endhint %}

***

## Enabling the Gunsmith in the Front End

The front-end experience needs the same `GameFeaturesToEnable` entry and a `UGameFeatureAction_ConfigureLoadout` with the rule set the editor should offer. It does **not** need the consumer component, because nothing spawns with loadouts in a menu.

Editing is front-end only by design. Players never modify a build mid-match; in a match, the most a mode offers is a widget listing saved loadouts that re-submits the selection for the next spawn. This keeps every gunsmith operation local to the menu world, where the machine is its own authority, which is what makes editing, validation, and stat previews instant and RPC-free.

### Content availability and preview parity

The gunsmith can only offer weapons whose item definitions are loaded, so the front-end experience must list the content plugins those weapons live in, exactly as it must for the definitions to exist at all. This has a useful side effect: fragment injection runs per enabled plugin when an experience loads, so listing a mode's plugin in the front-end experience also applies that mode's fragment injectors in the front end. The preview rig then sees the same modified item definitions the mode will use, and stats match exactly.

The one inherent limit: two modes whose injectors modify the same item in conflicting ways cannot both be represented by a single front end at once. The preview is exact for whatever plugin set the front-end experience enables, and the consume-time sanitizer cleans up any legality drift when the player actually spawns.

***

## Dedicated Servers

With the default local save backend, a loadout authored in the front end exists on the **client's** disk. The consumer component bridges that gap automatically: when it starts on the owning client, it reads the local save and submits the selected loadout to the server with one reliable RPC. The server caches it, re-validates it before every grant, and uses it in preference to its own save read. Nothing about this needs setup; it is the default behavior whenever the consumer exists on a client.

Trust-wise this changes nothing. A save file on the client's disk is already client-authored data, which is why the server sanitizes at grant time regardless of where the loadout came from. Validation is legality only, so there is nothing an edited save can claim that the sanitizer will not strip.

When you move to an online backend by subclassing `ULyraSaveSubsystem` and overriding its storage seams, the server's own read of the player's save becomes authoritative on dedicated servers too, and the client push is simply no longer the source that wins.

***

## Verifying an Integration

A quick checklist after wiring a mode:

* Load the mode's experience: players spawn holding the rule set's fallback loadout when they have no save, and no default kit appears alongside it.
* Load an experience without the action set: no `ULoadoutConsumerComponent` exists on the PlayerState and the mode's normal kit is intact.
* Author and save a build in the front end, then enter the mode: the spawned weapon carries the authored attachments.
* Hand-edit a saved build to include an illegal attachment: the spawn strips it and the rest of the loadout still grants.
