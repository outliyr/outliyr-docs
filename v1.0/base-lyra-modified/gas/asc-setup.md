# Asc Setup

Every ability, effect, and attribute needs a home, the Ability System Component. But where should it live? On the character that might die and respawn? Or on the PlayerState that persists across deaths? The answer depends on what you're building.

***

## Two Patterns for Ownership

### PlayerState Pattern

The ASC lives on `ALyraPlayerState`. Abilities, effects, and attribute state survive respawns because the PlayerState persists. The pawn connects to it during initialization. This is the standard pattern for player-controlled characters.

The PlayerState creates the ASC along with default attribute sets (`ULyraHealthSet` and `ULyraCombatSet`) as subobjects. When a pawn spawns, the pawn extension component detects the PlayerState and links the pawn as the ASC's avatar.

### Self-Contained Pattern

The ASC lives on the character itself (`ALyraCharacterWithAbilities`). Everything dies with the pawn. Simpler setup, used for AI-controlled characters, interactable objects, or anything that doesn't need persistence.

The character creates its own ASC and attribute sets directly. It acts as both owner and avatar, bypassing the pawn extension bridging that the PlayerState pattern requires.

> [!INFO]
> In the shooter game modes, AI are supposed to represent players, meaning they have player states and respawn. These AI follow the PlayerState pattern.

***

## Pattern Comparison

|                      | PlayerState        | Self-Contained                |
| -------------------- | ------------------ | ----------------------------- |
| **Where ASC lives**  | `ALyraPlayerState` | `ALyraCharacterWithAbilities` |
| **Survives respawn** | Yes                | No                            |
| **Typical use**      | Player characters  | AI, interactables             |
| **Avatar actor**     | The pawn           | The character itself          |
| **Attribute sets**   | On the PlayerState | On the character              |

***

## How Initialization Works

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Player joins**

The PlayerState is created with an ASC, attribute sets (health, combat), and replication configured.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Pawn spawns**

The pawn extension component detects the PlayerState and links the pawn as the ASC's avatar.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Components initialize**

The ASC broadcasts that it's ready, and components like the health component bind to their attribute sets.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

For the self-contained pattern, the character handles all of this in a single step, it sets itself as both owner and avatar during component initialization, with no pawn extension bridging needed.

For the full initialization sequence, see [Character Initialization](../character/initialization.md).

***

## Tag Relationship Mapping

You want melee attacks to cancel ranged abilities. You want a stun to block all offensive abilities. Tag relationships let you define these rules in a data asset instead of hardcoding them.

`ULyraAbilityTagRelationshipMapping` is a data asset set on the ASC. It contains an array of rules, each mapping an ability tag to tags it blocks, tags it cancels, and additional activation requirements.

### `FLyraAbilityTagRelationship`

| Field                    | Purpose                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `AbilityTag`             | The ability tag this rule applies to                                         |
| `AbilityTagsToBlock`     | Other abilities with these tags cannot activate while this ability is active |
| `AbilityTagsToCancel`    | Active abilities with these tags are cancelled when this ability activates   |
| `ActivationRequiredTags` | Additional tags required for this ability to activate                        |
| `ActivationBlockedTags`  | Tags that prevent this ability from activating                               |

<details class="gb-toggle">

<summary>Why a data asset instead of per-ability configuration?</summary>

Each ability already has its own block and cancel tags. But those are local to the ability, you'd need to open every ability class to add a new interaction rule. The tag relationship mapping centralizes these rules. Add a single entry saying "stun blocks all offensive abilities" and every offensive ability respects it without modification. This keeps ability classes decoupled while still enforcing game-wide rules.

</details>
