# Data Model

A loadout is plain data describing things the base item and equipment systems already know how to build. This page covers the structs a loadout is made of, and the four data assets that describe, constrain, and present them.

***

## What a Loadout Is

`FLoadoutData` is the whole thing: an identity, a name, and two lists.

```cpp
USTRUCT(BlueprintType)
struct FLoadoutData
{
    FGuid LoadoutId;                        // Stable identity that distinguishes saved loadouts
    FText DisplayName;                      // Player-facing name
    TArray<FLoadoutWeaponEntry> Weapons;
    TArray<FLoadoutGearEntry> Gear;         // Gear, spare items, and perks
    bool bIsPreset = false;                 // Produced from a designer preset, read-only and cloned on edit

    bool IsValid() const { return LoadoutId.IsValid(); }
};
```

Every field is marked `SaveGame`, which is what carries a loadout into the player's save.

> [!INFO]
> **There is no separate perks array.** A perk is a `FLoadoutGearEntry` whose `Target` is `ELoadoutGearTarget::Perk`. Weapons are the only entries that carry attachments, so they get a list of their own; everything else shares the gear list.

### Weapon entries

Each `FLoadoutWeaponEntry` names where it sits in the builder, where it is granted, what it is, and what is bolted to it.

| Field                 | Type                                          | Meaning                                                                           |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| `LoadoutSlot`         | `FGameplayTag`                                | The builder slot it occupies, an `Lyra.Loadout.Slot` tag                          |
| `TargetEquipmentSlot` | `FGameplayTag`                                | The equipment slot it is granted into, an `Lyra.Equipment.Slot` tag               |
| `WeaponDef`           | `TSoftClassPtr<ULyraInventoryItemDefinition>` | The weapon. Soft, so a loadout never force-loads content from an unmounted plugin |
| `bAutoHold`           | `bool`                                        | When true, the weapon moves into a held slot immediately after being equipped     |
| `Attachments`         | `TArray<FAttachmentEntry>`                    | The attachment tree. Recursive: each entry can carry its own sub-attachments      |
| `ExtraFragmentInit`   | `TArray<FInstancedStruct>`                    | Per-instance fragment init beyond attachments, such as stat tags                  |

`FAttachmentEntry` is not a loadout type. It belongs to the starting-item system, which is the point: a weapon described by a loadout is indistinguishable from one authored as starting equipment. Nesting is expressed by putting an `FAttachmentFragmentInit` inside an entry's own `FragmentInitData`, which is how a scope with its own top-mounted red dot is represented.

<details class="gb-toggle">

<summary>Where the attachment tree comes from</summary>

`FAttachmentEntry` lives in `LyraFragmentInitTypes.h` and carries an `AttachmentSlot` tag, an `AttachmentDef` class, and `FragmentInitData`. Note that `AttachmentDef` is a **hard** class reference, unlike the weapon's soft `WeaponDef`.

At grant time `ULoadoutResolver::BuildWeaponFragmentInit` wraps the array into an `FAttachmentFragmentInit` and appends `ExtraFragmentInit`, then hands the result to `CreateItemWithInit`. Full detail in [Granting a Loadout](granting-loadouts.md).

</details>

### Gear entries

`ELoadoutGearTarget` decides how a gear entry is applied, and therefore which of its fields matter. The editor hides the irrelevant ones.

| `Target`    | Applied by                                          | Fields used                                                             |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `Equipment` | Equipping into an equipment slot without holding it | `ItemDef`, `TargetEquipmentSlot`, `StackCount`, `FragmentInitData`      |
| `Inventory` | Adding to the player's inventory as a spare         | `ItemDef`, `TargetInventorySlotIndex`, `StackCount`, `FragmentInitData` |
| `Perk`      | Granting an ability set to the player               | `Perk`                                                                  |

`TargetInventorySlotIndex` defaults to `INDEX_NONE`, which auto-places. `StackCount` defaults to 1 and is clamped at 1.

***

## The Four Data Assets

### Loadout Definition

`ULoadoutDefinition` is a designer preset: one `FLoadoutData` in a `Default` property, plus `MakePresetData()`, which is the only way to read it out.

`MakePresetData` copies the data, sets `bIsPreset = true`, and, **only when `LoadoutId` is not already set**, derives a deterministic GUID from the asset's path. So a preset's identity is stable across sessions and machines without any authoring, while a designer who wants an explicit id can still author one.

Presets are never mutated at runtime. Opening one in the gunsmith immediately forks it into a new custom loadout with a fresh GUID.

<img src=".gitbook/assets/image (346).png" alt="" title="">

### Rule Set

`ULoadoutRuleSet` is the per-experience policy. Point different modes at different rule sets and you have different loadout rules with no code.

<img src=".gitbook/assets/image (347).png" alt="" title="">

| Field                     | Default | Meaning                                                          |
| ------------------------- | ------- | ---------------------------------------------------------------- |
| `Slots`                   | —       | The builder slots this experience exposes, in display order      |
| `MaxCustomLoadouts`       | 5       | How many custom loadouts a player may save                       |
| `MaxAttachmentsPerWeapon` | 5       | Attachment budget per weapon                                     |
| `AllowedWeapons`          | empty   | Weapons this rule set allows. **Empty means any weapon**         |
| `Presets`                 | —       | Preset loadouts offered under this rule set                      |
| `DefaultLoadout`          | —       | Fallback when the player's selection is missing or fully invalid |
| `StatDisplayConfig`       | —       | Which stats the gunsmith shows, and how                          |

> [!DANGER]
> `DefaultLoadout` is not optional in practice. When a loadout sanitizes down to nothing and the rule set names no default, **nothing is granted at all** and the player spawns bare, with only a warning in the log.

### Builder slots

Each entry in `Slots` is an `FLoadoutSlotDefinition`. `ELoadoutSlotKind` decides what the slot holds, which in turn decides what it offers and how its contents are granted.

| Kind        | Holds                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| `Weapon`    | A weapon, equipped into an equipment slot and able to carry attachments |
| `Equipment` | An item equipped without being held, such as a claymore                 |
| `Inventory` | An item carried in the inventory, such as a stack of grenades           |
| `Perk`      | A perk granted to the player                                            |

| Field                 | Applies to        | Meaning                                                               |
| --------------------- | ----------------- | --------------------------------------------------------------------- |
| `LoadoutSlot`         | all               | The builder slot tag                                                  |
| `SlotKind`            | all               | What the slot holds                                                   |
| `TargetEquipmentSlot` | Weapon, Equipment | Where its contents are equipped                                       |
| `bAutoHold`           | Weapon            | Whether the weapon is held on spawn                                   |
| `StackCount`          | all but Perk      | How many the slot carries, for slots holding several such as grenades |
| `AllowedItems`        | all but Perk      | Items offered for this slot                                           |
| `AllowedPerks`        | Perk              | Perks offered for this slot                                           |

> [!WARNING]
> **`AllowedItems` behaves asymmetrically, on purpose.** Leaving it empty on a **weapon** slot falls back to the rule set's `AllowedWeapons`. Leaving it empty on an **equipment, inventory, or perk** slot offers nothing, and every entry saved into that slot is stripped at grant time. A gear slot must list what it accepts.

### Perk Definition

`ULoadoutPerkDefinition` is the perk as the player meets it. An ability set is a way of granting abilities rather than something a player reads, so the presentation lives here and the ability set is one of its fields.

<img src=".gitbook/assets/image (348).png" alt="" title="">

| Field         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `DisplayName` | `FText`                                                                 |
| `Description` | `FText`, multi-line                                                     |
| `Icon`        | `TSoftObjectPtr<UTexture2D>`, soft so a dedicated server never loads it |
| `AbilitySet`  | `TSoftObjectPtr<ULyraAbilitySet>`, what taking the perk grants          |

A perk that modifies weapon stats can use `ULoadoutPerkAbility_WeaponStats`, a Blueprintable ability that applies a list of `StatTag` / `Modifier` / `Operation` entries and reverts them in `EndAbility`. It affects whatever the player has equipped at the moment it activates, and only items that already carry the stat, so a weapon that never seeds it is left alone rather than given it.

> [!INFO]
> `ULoadoutPerkAbility_WeaponStats` applies to the weapons **the loadout granted**. A weapon picked up during the match is not covered.

### Stat Display Config

`ULoadoutStatDisplayConfig` declares which tag attributes the gunsmith's stat panel shows and how each is rendered. Adding a stat to the panel is purely a data change.

<img src=".gitbook/assets/image (349).png" alt="" title="">

| Field               | Default   | Meaning                                                                                      |
| ------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `StatTag`           | —         | The tag attribute on the equipment instance this row reads                                   |
| `DisplayName`       | —         | Player-facing name                                                                           |
| `Format`            | `Raw`     | `Raw`, `Percentage`, or `Bar`                                                                |
| `BarMin` / `BarMax` | 0.0 / 1.0 | Bar range, used when `Format` is `Bar`                                                       |
| `DisplayScale`      | 1.0       | Multiplier applied before display, so a range held in engine units reads in metres at `0.01` |
| `UnitSuffix`        | —         | Appended to the value and its delta, such as `m`                                             |
| `Icon`              | —         | Optional icon beside the stat                                                                |
| `bHigherIsBetter`   | true      | Whether a larger value counts as an improvement                                              |

Weapons that never seed a listed tag contribute nothing for that row; it is skipped rather than shown blank.

## Tags

The plugin declares its own tags in `Config/Tags/LoadoutTags.ini`:

| Tag                                        | Purpose                                  |
| ------------------------------------------ | ---------------------------------------- |
| `Lyra.Loadout.Slot`                        | Parent tag for builder slots             |
| `Lyra.Loadout.Slot.Primary` / `.Secondary` | Weapon slots                             |
| `Lyra.Loadout.Slot.Equipment`              | Equipment / gear slot                    |
| `Lyra.Loadout.Slot.Perk`                   | Perk slot                                |
| `Lyra.Save.Loadouts`                       | Save key for the player's saved loadouts |

Add your own `Lyra.Loadout.Slot.*` tags for any builder slots beyond these four. Equipment slot tags come from the equipment system and attachment slot tags from the attachment system; the loadout plugin only declares its own builder slots.

> [!WARNING]
> Changing a slot's `SlotKind` in a rule set that has already shipped silently invalidates every saved entry for that slot. Players' saves still contain entries of the old kind, and the sanitizer drops them.
