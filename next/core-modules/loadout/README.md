# Loadout

Players build weapon configurations in a front-end editor, fit scopes, grips and magazines while watching real stats move, save the result, and spawn into opted-in game modes carrying exactly what they authored.

The system is deliberately split in two. The **gunsmith** is a menu-time editor that reads and writes the player's save. The **consumer** is a small component that opted-in game modes add to the player, which resolves the saved selection at spawn and grants it through the same calls the starting-item flow makes. The two halves never talk to each other directly; the save is the only hand-off. That separation keeps the system mode-agnostic: a mode that never opts in is completely untouched.

***

## Two Plugins, and Which One Holds What

This is the first thing to get straight, because the names suggest the opposite of the truth.

| Plugin       | Modules                          | Contents                                                                                                           |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Loadout**  | `LoadoutRuntime`, `LoadoutTests` | Every C++ class, and **every gunsmith widget** under `/Loadout/UI/`                                                |
| **Gunsmith** | none, content-only               | The shipped example: an experience, an armoury map (basic map), a rule set, a preset loadout, and a playlist entry |

> [!WARNING]
> The gunsmith **widgets live in the Loadout plugin**, not the Gunsmith plugin. Gunsmith is a content-only plugin holding one worked example, and it depends on Loadout and ShooterBase. Enabling Gunsmith without Loadout gives you nothing.

The `Loadout` plugin is `ExplicitlyLoaded`, so nothing in it exists at runtime until an experience lists it in `GameFeaturesToEnable`.

***

## How It Builds on Base Lyra

The plugin adds no new item, equipment, or attachment concepts. A loadout is a description of things the base systems already know how to build, and granting one replays the calls the starting-item flow already makes.

| Base System                                                                                                                                          | How the Loadout Plugin Uses It                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Items & Fragments](../../base-lyra-modified/items/items-and-fragments/)                                                                             | Loadout entries reference `ULyraInventoryItemDefinition` classes; built weapons come from `ULyraStartingItemHelpers::CreateItemWithInit`                        |
| [Attachment System](../../base-lyra-modified/items/item-fragments-in-depth/attachment-system/)                                                       | Attachment trees reuse `FAttachmentEntry`, legality comes from each weapon's `CompatibleAttachments` map, and `DefaultAttachments` seed a freshly picked weapon |
| [Equipment](../../base-lyra-modified/equipment/)                                                                                                     | Granted weapons are equipped through `ULyraEquipmentManagerComponent::AddItemToSlot`, identically to `StartingEquipment`                                        |
| [Equipment Instance Tag Attributes](../../base-lyra-modified/equipment/equipment-instance.md#tag-attributes-flexible-parameters-without-subclassing) | The stat preview reads the same tag attribute container that drives weapons in a match                                                                          |
| [Save System](../../base-lyra-modified/save-system/)                                                                                                 | Loadouts persist through `ULyraSaveSubsystem` under the `Lyra.Save.Loadouts` tag                                                                                |
| [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md)                                                                  | Modes opt in through an experience action that publishes a rule set                                                                                             |

> [!INFO]
> Be comfortable with the [Item System](../../base-lyra-modified/items/), the [Equipment System](../../base-lyra-modified/equipment/), and [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md) before diving in. These pages cover what the plugin adds and defer to the base docs for shared concepts.

***

## Key Concepts

**Loadouts are plain data.** `FLoadoutData` holds weapons with attachment trees, gear entries, and perk references, under a stable `FGuid`. It never contains live item instances, so it saves, loads, and travels over the wire cheaply.

**Rule sets are per-experience policy.** A `ULoadoutRuleSet` decides which builder slots exist, what each slot offers, how many custom loadouts a player may keep, and which preset is the fallback. Different modes point at different rule sets with no code changes.

**Two independent opt-in surfaces.** A front-end experience enables the plugin to host the gunsmith for editing. Game modes opt in separately for granting. Either works without the other.

**Editing is menu-time.** Players author builds in the front end. In a match the most a mode offers is switching between already-saved loadouts, applied at the next spawn.

**Validation happens twice.** The same validator reports errors when the player saves, and silently strips illegal content when the server grants. Saved data is client-authored, so the server never trusts it.

**Stats are measured, not tabulated.** The gunsmith equips the candidate build on an isolated preview rig and lets the real ability pipeline run, so any attachment that modifies stats the normal way previews correctly with no extra authoring.

> [!INFO]
> Scope is **legality only**. There is no ownership or unlock concept anywhere in the plugin. If your game needs one, it belongs in a progression system layered on top, expressing its results through rule sets. See [Extending](extending.md).

***

## Documentation Structure

| Page                                                | What It Covers                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [**Data Model & Rule Sets**](data-model.md)         | The structs a loadout is made of, and the four data assets that describe and constrain them                     |
| [**Granting a Loadout**](granting-loadouts.md)      | How a saved selection reaches a spawning player, including the dedicated-server path and what validation strips |
| [**The Gunsmith**](the-gunsmith.md)                 | The MVVM layer the editor binds to, the stat preview rig, and how to build a completely custom editor           |
| [**Setup & Integration**](setup-and-integration.md) | Authoring the assets, opting a mode in, wiring the front end, and verifying an integration                      |
| [**Extending**](../squad-play/extending.md)         | Sourcing loadouts from a backend, swapping save storage, and adding your own perks                              |
