# Loadout

Welcome to the documentation for the **Loadout Plugin**, a dedicated loadout and gunsmith system. Players build custom weapon configurations in a front-end editor, attach scopes, grips, and magazines while watching real stats update live, save their builds, and spawn into opted-in game modes carrying exactly what they authored.

The system is deliberately split in two. The **gunsmith** is a menu-time editor that reads and writes the loadout to player's save. The **consumer** is a small component that opted-in game modes add to the player, which reads the saved selection at spawn and grants it through the same code path as ordinary starting equipment. The two halves never talk to each other directly; the save system is the only hand-off. That separation is what keeps the system game-mode agnostic: a mode that never opts in is completely untouched.

***

### What You Get

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Loadout Plugin                             │
├────────────────────────┬────────────────────────────────────────────┤
│                        │                                            │
│   Loadout Data Model   │   Weapons with recursive attachment trees  │
│   Spawn Granting       │   Same path as starting equipment          │
│   Live Stat Preview    │   Real values from the ability pipeline    │
│   Legality Validation  │   At save time and again at spawn          │
│   Save Integration     │   ULyraSaveSubsystem, backend-swappable    │
│   Gunsmith ViewModels  │   MVVM logic layer, design-free            │
│   Experience Opt-In    │   Rule sets per game mode                  │
│                        │                                            │
└────────────────────────┴────────────────────────────────────────────┘
```

***

### How It Builds on Base Lyra

The plugin adds no new item, equipment, or attachment concepts. A loadout is a description of things the base systems already know how to create, and granting one replays the exact calls the starting-item flow makes.

| Base System                                                                                                                                          | How the Loadout Plugin Uses It                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Items & Fragments](../../base-lyra-modified/items/items-and-fragments/)                                                                             | Loadout entries reference `ULyraInventoryItemDefinition` classes; built weapons are created with `ULyraStartingItemHelpers::CreateItemWithInit`   |
| [Attachment System](../../base-lyra-modified/items/item-fragments-in-depth/attachment-system/)                                                       | Attachment trees reuse `FAttachmentEntry`, legality comes from each weapon's `CompatibleAttachments` map, and default attachments seed new builds |
| [Equipment](../../base-lyra-modified/equipment/)                                                                                                     | Granted weapons are equipped through `ULyraEquipmentManagerComponent::AddItemToSlot`, identical to `StartingEquipment`                            |
| [Equipment Instance Tag Attributes](../../base-lyra-modified/equipment/equipment-instance.md#tag-attributes-flexible-parameters-without-subclassing) | The stat preview reads the same tag attribute container that drives weapons in a match                                                            |
| [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md)                                                                  | Game modes opt in through an experience action that publishes a rule set; the plugin itself is `ExplicitlyLoaded`                                 |

{% hint style="info" %}
You should be familiar with the [Item System](../../base-lyra-modified/items/items-and-fragments/), the [Equipment System](../../base-lyra-modified/equipment/), and [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md) before diving in. This documentation focuses on what the plugin adds and references the base docs for shared concepts.
{% endhint %}

***

### Key Concepts

A quick orientation of the major ideas you'll encounter:

* **Loadout Data** — A loadout is plain data: weapons with attachment trees, gear entries, and perk ability sets, identified by a stable `FGuid`. It never contains live item instances, so it saves, loads, and travels cheaply.
* **Rule Sets** — A `ULoadoutRuleSet` data asset defines what a given experience allows: which builder slots exist, which weapons are legal, how many custom loadouts a player may keep, and which preset is the fallback. Different modes reference different rule sets with no code changes.
* **Two Opt-In Surfaces** — The front-end experience enables the plugin to host the gunsmith for **editing**. Game modes opt in separately for **consumption**. Either works without the other.
* **Editing Is Front-End Only** — Players build and modify loadouts in the menu, never mid-match. In a match, the most a mode offers is switching between already-saved loadouts, applied at the next spawn.
* **Validation, Twice** — A shared validator checks legality when a build is saved and again when it is granted. Saved data is treated as untrusted on the server; anything illegal is stripped before granting.
* **Live Stat Preview** — The gunsmith computes weapon stats by equipping the candidate build on an isolated preview rig and letting the real ability pipeline run. Attachments that modify stats through the normal attachment utility abilities preview correctly with zero extra authoring.

***

### Documentation Structure

| Section                                                                       | What It Covers                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [**How It Works**](how-it-works.md)                                           | The runtime architecture end to end - data model, spawn granting, persistence, validation, and the stat preview rig |
| [**Setup & Integration**](../shooter-base/accolades/setup-and-integration.md) | Opting an experience in, authoring rule sets and presets, content availability, and dedicated server behavior       |
| [**Gunsmith ViewModels**](gunsmith-viewmodels.md)                             | The MVVM layer the gunsmith UI binds to, and how to build a completely custom editor on top of it                   |
