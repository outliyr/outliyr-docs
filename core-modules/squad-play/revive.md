# Revive

A downed player has two roads back into the fight: a teammate holds an interaction over them, or they carry a self-revive and recover alone. Both roads end the same way, a heal lands first and the downed state clears second, so a revived player is never standing at zero health waiting for the next stray bullet to kill them outright.

***

### The Revive Interactable

The interaction scan in this project considers actors that implement the interactable interface, not their components, so a downed pawn cannot present a revive option by itself. The moment a player enters the downed state, the downed component spawns a small interactable actor, `ASquadReviveInteractable`, on top of them, and destroys it the moment the downed state ends for any reason. The actor is nothing more than an interaction volume and a replicated reference to the downed pawn.

The option it offers is teammate-only: an enemy looking at a downed player sees nothing, because finishing them is done with damage, not an interaction. Everything about the option, the prompt text, the hold length, the widget, and the ability it grants, is read from the downed player's own component, so different characters can present different revives without a new interactable class.

<details class="gb-toggle">

<summary>How the option reaches the reviver</summary>

The interactable builds its option from the downed component's revive settings and retargets the interaction event at the downed pawn, so the granted ability knows who it is reviving rather than which helper actor was looked at.

```cpp
// GatherInteractionOptions: only teammates of the downed pawn get an option.
// The option carries ReviveText, ReviveHoldSeconds, ReviveWidgetClass, and
// grants ReviveAbilityToGrant from the downed component.

// CustomizeInteractionEventData: the event's target is swapped to the downed
// pawn, so the revive ability activates against the player, not this actor.
```

The base interaction flow, including how options grant abilities and run holds, is covered in [Understanding Interaction Options](../../base-lyra-modified/interaction/understanding-interaction-options.md).

</details>

***

### Teammate Revive

The interaction system runs the hold; the revive ability only fires once it completes. `USquadGameplayAbility_Revive` activates on the reviving player with the downed pawn as the event target, restores a fraction of that pawn's maximum health, and then clears the downed state. The order is the point: heal first, revive second, so there is no frame where the player is up with an empty pool.

The health a player returns with belongs to the ability, not the downed component. `RevivedHealthPercent` defaults to thirty percent of maximum health, applied through a configurable heal effect that falls back to the project's default `SetByCaller` heal when unset. This split keeps the roles clean: the downed player's component decides how they are revived, the prompt, the hold, the widget, while the reviving ability decides what they come back with.

<details class="gb-toggle">

<summary>Revive ability settings</summary>

| Setting                | What It Controls                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `RevivedHealthPercent` | Fraction of maximum health the revived player returns with                                            |
| `ReviveHealEffect`     | Heal effect carrying a `SetByCaller.Heal` magnitude; falls back to the Lyra game data heal when unset |

The ability also raises `On Revived Target` on the server after a successful revive, with the pawn that was brought back, for mode presentation such as a revive accolade.

</details>

***

### Self-Revive

A self-revive is not a flag on the component; it is a granted ability. `USquadGameplayAbility_SelfRevive` carries the `SquadPlay.Ability.SelfRevive` tag, and the downed component reports that a player can self-revive whenever their ability system holds any granted ability with that tag. That indirection is what makes a self-revive feel like a charge: grant the ability and the player has one, remove it and they do not.

While downed, the player holds the ability's input to start a server-side hold, longer than a teammate revive by default. If the downed state ends first, because a teammate got there or an enemy finished the job, the hold cancels cleanly. Completing it heals the player through the same percent-of-maximum path as a teammate revive, clears the downed state, and then hands control to the `On Self Revive Succeeded` event, which is where a consumable charge removes itself, typically by consuming the granting item so the next knockdown finds no self-revive.

The self-revive also feeds the down-versus-die decision. The squad death ability knocks a player down rather than killing them when a teammate can still act **or** the player can self-revive, which is why the last member of a squad carrying a self-revive gets knocked instead of dying on the spot. That decision is covered in the [Downed System](downed-system.md).

<details class="gb-toggle">

<summary>Self-revive ability settings and hooks</summary>

| Setting                 | What It Controls                                                               |
| ----------------------- | ------------------------------------------------------------------------------ |
| `SelfReviveHoldSeconds` | Seconds the downed player holds before the self-revive completes               |
| `RevivedHealthPercent`  | Fraction of maximum health they come back with                                 |
| `ReviveHealEffect`      | Heal effect for the recovery; falls back to the Lyra game data heal when unset |

Two events carry the presentation: `On Self Revive Started` fires on the server and the owning client with the hold length, for a progress bar, and `On Self Revive Succeeded` fires on the server after completion, which is where a consumable implementation removes the granting item.

</details>

***

### Where The Revive Settings Live

The revive prompt belongs to the player being revived. `ReviveText`, `ReviveHoldSeconds`, `ReviveAbilityToGrant`, and `ReviveWidgetClass` all sit on the downed component, listed in the [Downed System configuration](downed-system.md#downed-component-settings), so a heavy character can be slower to pick up than a light one without any new interactable or ability class. The reviving side only ever contributes the heal.
