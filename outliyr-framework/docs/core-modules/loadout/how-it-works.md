# How It Works

This page walks the runtime from the data a loadout is made of, through how a saved build reaches a spawning player, to how the gunsmith shows live stats. Everything here lives in the `LoadoutRuntime` module of the plugin.

***

## The Data Model

A loadout is a plain struct, `FLoadoutData`, identified by a stable `FGuid` and carrying three lists:

* **Weapons** — Each `FLoadoutWeaponEntry` names the builder slot it occupies, the equipment slot it should be granted into, the weapon's item definition, whether it should be auto-held on spawn, and its attachment tree.
* **Gear** — Each `FLoadoutGearEntry` targets either an equipment slot, the player's inventory, or the ability system. The last of those is how perks work: a gear entry can grant a `ULyraAbilitySet` instead of an item.
* **Display data** — A player-facing name and a flag marking designer presets.

The attachment tree reuses `FAttachmentEntry` from the starting-item system. Each entry names an attachment slot and an attachment item definition, and can carry nested fragment initialization of its own, which is how a scope with its own top-mounted red dot is expressed. Because this is the same struct the starting-item system uses, a weapon described by a loadout is indistinguishable from one authored as starting equipment.

<details>

<summary>The weapon entry, abbreviated</summary>

```cpp
USTRUCT(BlueprintType)
struct FLoadoutWeaponEntry
{
    // Builder slot in the gunsmith, e.g. Lyra.Loadout.Slot.Primary
    FGameplayTag LoadoutSlot;

    // Equipment slot the weapon is granted into, e.g. Lyra.Equipment.Slot.Primary
    FGameplayTag TargetEquipmentSlot;

    // Soft reference so rule sets never force-load content from unmounted plugins
    TSoftClassPtr<ULyraInventoryItemDefinition> WeaponDef;

    bool bAutoHold = false;

    // The same recursive attachment tree the starting-item system uses
    TArray<FAttachmentEntry> Attachments;
};
```

</details>

Two data assets sit on top of the struct:

* **`ULoadoutDefinition`** — A designer preset. It wraps one `FLoadoutData` and derives a deterministic id from its asset path, so a player's selection of a preset survives across sessions. Presets are read-only; opening one in the gunsmith clones it into a new custom loadout.
* **`ULoadoutRuleSet`** — Per-experience policy: the builder slots that exist, the maximum number of custom loadouts, the attachment budget per weapon, an optional weapon allow-list, the preset list, the fallback loadout, and the stat display configuration. Item references are soft, so a rule set can name content from plugins that are not always mounted and simply skip entries that fail to resolve.

***

## From Experience to Spawned Player

Granting is driven by two pieces an opted-in experience adds, plus a world subsystem that connects them.

```
Experience activates
        │
        ├── GameFeatureAction_AddComponents ──► ULoadoutConsumerComponent on the PlayerState
        │
        └── UGameFeatureAction_ConfigureLoadout ──► publishes ULoadoutRuleSet
                                                          │
                                                    ULoadoutSubsystem
                                                    (one per world)
                                                          │
        Pawn possessed ──► consumer resolves selection ──► validates ──► grants
```

**`ULoadoutSubsystem`** is a per-world holder for the active rule set. The configure action writes into it on activation and clears it on deactivation; consumers and the gunsmith read from it whenever they need the rules. Routing the hand-off through a subsystem means the two experience actions can run in any order, and a consumer created after activation still finds the rules waiting for it.

**`ULoadoutConsumerComponent`** binds the PlayerState's pawn-set delegate. When a pawn arrives it waits for the pawn's ability system to initialize, then resolves which loadout to grant, in priority order: a loadout the owning client pushed up, then the player's saved selection read server side, then the component's debug loadout if one is assigned, then the rule set's fallback. Perk ability sets are granted to the persistent PlayerState ability system, so the component tracks their handles and revokes the previous grant before each respawn to stop perks stacking across lives.

**`ULoadoutResolver`** turns the resolved data into live grants, reusing the public APIs the starting-item flow uses. Weapons are created with `CreateItemWithInit`, carrying their attachment tree as an `FAttachmentFragmentInit`, then equipped with `AddItemToSlot` on the pawn's equipment manager. Inventory gear goes through the controller's inventory manager the same way. Nothing about the granted items is special afterwards; they drop, swap, and replicate exactly like any other equipment.

{% hint style="warning" %}
Opted-in experiences should use pawns whose equipment manager has an **empty** `StartingEquipment` array and controllers with empty `DefaultStartingItems`, so the resolver is the only granter. Leaving default kit configured alongside loadouts grants both.
{% endhint %}

***

## Persistence and the Save Hand-Off

Loadouts live in the player's save game, not in any replicated component. **`ULoadoutSaveData`** is the serialization target both halves share: it holds the loadout list and the selected id, implements `ILyraSaveableInterface`, and reads and writes itself through `ULyraSaveSubsystem` under the `Lyra.Save.Loadouts` tag.

The gunsmith writes through it when the player saves a build. The consumer reads through it on the server at spawn. Because both halves only touch the save subsystem's public API, swapping local save files for an online backend is done by subclassing `ULyraSaveSubsystem` and overriding its storage seams, with no change to any loadout code.

**Dedicated servers need one extra step**, because front-end editing writes to the client's disk and a dedicated server cannot read it from there. When the consumer component starts on the owning client, it loads the local save and pushes the selected loadout to the server with a single reliable RPC. The server caches the submission without replicating it and treats it exactly like a locally read save: untrusted until validated. Selecting a different loadout mid-match re-submits through the same path and applies at the next spawn. Once an online backend exists, the server-side read becomes authoritative for dedicated servers as well and the push becomes redundant.

***

## Validation

**`ULoadoutValidator`** is one shared implementation with two entry points, because the two call sites want different failure behavior:

* **`Validate`** runs when the player saves a build in the gunsmith. It checks everything and reports one error per violation, so the UI can tell the player exactly what is wrong and refuse the save.
* **`Sanitize`** runs on the server just before granting. It strips every illegal weapon, attachment, and gear entry in place and grants whatever legal remainder survives, falling back to the rule set's default when nothing does.

Both check the same rules: weapons must pass the rule set's allow-list, builder slots must exist in the rule set, every attachment must be accepted by its host's `CompatibleAttachments` map for that specific slot, no slot may be claimed twice, the per-weapon attachment budget must hold, and the checks recurse through nested sub-attachments. Entries whose soft references fail to resolve are treated as absent rather than as errors, so a loadout authored against a plugin the current experience does not load degrades gracefully instead of failing.

The scope is deliberately **legality only**. There is no ownership or unlock concept in the plugin; if your game needs one, it belongs in a progression system layered on top, with its results expressed through rule sets.

***

## The Stat Preview Rig

Weapon stats in this framework are not variables on a class. As covered in [Equipment Instance](../../base-lyra-modified/equipment/equipment-instance.md), a weapon's effective stats live in the tag attribute container on its equipment instance: the weapon's own abilities seed base values when granted, and attachment abilities such as the [attachment utility abilities](../../base-lyra-modified/items/item-fragments-in-depth/attachment-system/provided-attachment-utility-abilities.md) modify them while attached. The numbers only exist after that pipeline runs.

So the gunsmith does not read stats; it **runs the pipeline**. **`ALoadoutPreviewRig`** is a hidden pawn that owns its own ability system component and its own equipment manager, isolated from every player. To preview a build, the rig:

1. Creates the weapon with its full attachment tree, through the same `CreateItemWithInit` call the resolver uses at spawn.
2. Equips it into a held slot, because held state is what activates the attachment modifier abilities.
3. Waits one tick for the granted abilities to apply their modifications.
4. Reads the requested tag attributes off the equipment instance, unequips, and reports the values.

The payoff is authoring economy: any attachment that modifies stats through a normal granted ability previews correctly, automatically. There is no parallel stat table to maintain and nothing extra for an attachment author to set up, and the preview can never drift from in-match behavior because it is the in-match code path.

Which stats appear, in what order, and how they are formatted comes from **`ULoadoutStatDisplayConfig`**, a data asset referenced by the rule set that maps each stat tag to a display name, a format, an optional icon, and whether higher values are better. Adding a stat to the panel is purely a data change.

{% hint style="info" %}
The rig only ever exists in the front-end world, where the local machine is the authority, so previews are instant and nothing about them replicates. Stats previewed in the front end match a mode exactly when the front-end experience loads the same content plugins; see [Setup & Integration](../shooter-base/accolades/setup-and-integration.md) for the details.
{% endhint %}
