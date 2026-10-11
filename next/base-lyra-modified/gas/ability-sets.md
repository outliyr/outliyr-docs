# Ability Sets

You have a character that needs to shoot, throw grenades, sprint, and have health with a combat damage stat. You could wire all of this up in C++ or Blueprint for each character type. Or you package everything into a single data asset and drop it on. That is what an ability set does.

`ULyraAbilitySet` is a data asset with three arrays: abilities to grant, effects to apply, and attribute sets to register. When applied, it grants everything to the character's ASC. When removed, everything it granted is cleaned up.

***

## What It Contains

An ability set has three sections, each an array of entries you fill out in the editor:

* **Abilities to grant** — gameplay ability classes, each with an input tag for binding to player input and a flag to skip duplicates.
* **Effects to apply** — gameplay effect classes, each with a level.
* **Attribute sets to register** — attribute set classes, each with an optional data table for initialization values.

### Grant Structs

These are the structs that appear in the editor when you configure an ability set.

```cpp
// What shows up in the Abilities array
USTRUCT(BlueprintType)
struct FLyraAbilitySet_GameplayAbility
{
    TSubclassOf<ULyraGameplayAbility> Ability;  // The ability class
    int32 AbilityLevel;                          // Level to grant at (default 1)
    FGameplayTag InputTag;                       // Input binding tag
    bool bSkipDuplicates;                        // Skip if already granted
};

// What shows up in the Effects array
USTRUCT(BlueprintType)
struct FLyraAbilitySet_GameplayEffect
{
    TSubclassOf<UGameplayEffect> GameplayEffect;  // The effect class
    float EffectLevel;                              // Level to apply at (default 1.0)
};

// What shows up in the Attributes array
USTRUCT(BlueprintType)
struct FLyraAbilitySet_AttributeSet
{
    TSubclassOf<UAttributeSet> AttributeSet;       // The attribute set class
    UDataTable* InitializationData;                 // Optional defaults table
};
```

| Struct            | Field                | Purpose                                                                                                                                          |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ability**       | `Ability`            | The gameplay ability class to grant.                                                                                                             |
|                   | `AbilityLevel`       | Level of the granted ability.                                                                                                                    |
|                   | `InputTag`           | Gameplay tag used to bind this ability to a player input action. Filtered to the `InputTag` category.                                            |
|                   | `bSkipDuplicates`    | When true, the ability is not granted if the ASC already has one of the same class. Useful for shared abilities across multiple sets.            |
| **Effect**        | `GameplayEffect`     | The gameplay effect class to apply.                                                                                                              |
|                   | `EffectLevel`        | Level of the applied effect.                                                                                                                     |
| **Attribute Set** | `AttributeSet`       | The attribute set class to register on the ASC.                                                                                                  |
|                   | `InitializationData` | Optional data table that overrides the attribute set's constructor defaults. When provided, attribute values are loaded from this table instead. |

### Granting and Revoking

When an ability set is applied, calling `GiveToAbilitySystem()` walks each of the three arrays and grants everything to the target ASC. The variant `GiveToAbilitySystemWithTag()` does the same but also adds a gameplay tag to every granted ability spec, which is useful for identifying or filtering abilities by their source. All resulting handles are stored in an `FLyraAbilitySet_GrantedHandles` struct. When it is time to remove the set, calling `TakeFromAbilitySystem` on those handles revokes every ability, removes every effect, and unregisters every attribute set that the set originally granted. Nothing else on the ASC is touched.

Both granting and revoking require authority, they only execute on the server.

***

## Where Ability Sets Are Applied

### PawnData (Character Spawns)

Every pawn has a `ULyraPawnData` data asset. It includes an array of ability sets granted when the character initializes. This is how characters get their base abilities, health, and combat stats. A soldier and a medic can share the same pawn class but reference different PawnData assets with different ability sets.

### Equipment/Attachments

When a weapon or gear item is equipped, its equipment definition can grant an ability set. The weapon's fire ability, reload ability, and ammo effect all come from the equipment's ability set. When the item is unequipped, the abilities are revoked. This means swapping weapons automatically swaps the abilities available to the player. The same thing applies to attachments

### Game Feature Plugins

Game features can inject ability sets into specific actors when the feature activates. This lets modular game modes add abilities without modifying base character code. A "jetpack mode" feature could grant a jetpack ability to every character, and removing the feature removes the ability.

***

## Global Ability System

Every player gets a speed buff during the final circle in a BR game. The game enters a double-damage phase. You need these effects on every ASC in the world, including players who spawn after the effect starts.

`ULyraGlobalAbilitySystem` is a world subsystem that handles this. Every `ULyraAbilitySystemComponent` registers itself on initialization and unregisters on teardown. When you apply a global ability or effect, it is immediately granted to all registered ASCs. When a new ASC registers later, it receives everything currently active.

### Global Grants

| Function               | What It Does                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `ApplyAbilityToAll`    | Grants an ability to every registered ASC. Late joiners receive it on registration. |
| `ApplyEffectToAll`     | Applies an effect to every registered ASC. Late joiners receive it on registration. |
| `RemoveAbilityFromAll` | Removes a previously applied global ability from all ASCs.                          |
| `RemoveEffectFromAll`  | Removes a previously applied global effect from all ASCs.                           |

### Team-Scoped Grants

Only one team should get the buff? The global system supports team-scoped grants that filter by team ID. When an ASC registers, it receives both global grants and any team-scoped grants matching its team.

| Function                | What It Does                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ApplyAbilityToTeam`    | Grants an ability only to ASCs on the specified team.                                                                    |
| `ApplyEffectToTeam`     | Applies an effect only to ASCs on the specified team.                                                                    |
| `RemoveAbilityFromTeam` | Removes a team-scoped ability from all ASCs on that team.                                                                |
| `RemoveEffectFromTeam`  | Removes a team-scoped effect from all ASCs on that team.                                                                 |
| `RefreshASCForTeam`     | Strips all team-scoped grants from an ASC and re-applies only those matching its current team. Call after a team change. |

All global ability system functions are server-only (`BlueprintAuthorityOnly`).

***

<details class="gb-toggle">

<summary>Why data assets instead of Blueprint setup?</summary>

Data assets are reusable. The same weapon ability set works on any character that equips the weapon. Changes to the data asset propagate everywhere it is used. Blueprint setup would mean duplicating ability, effect, and attribute configuration per character or weapon Blueprint. With data assets, a designer can adjust the entire combat profile of a weapon class by editing a single asset.

</details>
