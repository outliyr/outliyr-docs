# Prop Hunt

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/PropHunt/`\
**Dependencies:** ShooterBase, GameplayMaps
{% endhint %}

A round-based asymmetric hide-and-seek mode. One team plays props, disguising as world objects and scattering across the map; the other team plays hunters who are held in a starting room while the props hide, then released to search and shoot them. Props win a round by surviving the hunt timer; hunters win by eliminating every prop before it expires. Sides switch each round and the first team to the round target wins the match.

***

## How it plays

Each round opens with a hiding window. The props are loose on the map and pick a disguise, while the hunters are frozen inside a sealed starting room, unable to move or deal damage. When the hiding window ends the room opens and the hunt begins: hunters search the level and shoot suspicious objects, and props try to blend in. A prop can change its disguise to any matching object it looks at, lock itself in place to sit perfectly still, and drop decoy copies of its current prop to mislead hunters. If the hunt timer runs out with any prop still alive, the props take the round; if the hunters clear every prop first, the round is theirs. The teams then swap roles and play again.

***

## Match flow

{% stepper %}
{% step %}
### Round start (hiding)

The hide window on the `RoundStart` phase. The countdown is set to `HidingTime`, the hunter team is locked inside the starting room, and leftover decoys from the previous round are cleared.
{% endstep %}

{% step %}
### Playing (hunt)

Begins when the hiding countdown expires and `Phase_Playing` starts. The countdown is reset to `HuntingTime` and the starting room opens to release the hunters.
{% endstep %}

{% step %}
### Round end

Announces the round winner, holds briefly, then runs the side-switch phase.
{% endstep %}

{% step %}
### Round end / switch sides

Swaps the hunter and prop team ids, reassigns each team's pawn data, revives everyone, and loops back to the hiding phase for the next round.
{% endstep %}

{% step %}
### Match end

When a round win pushes a team to the round target, the match ends instead of starting another round.
{% endstep %}
{% endstepper %}

<details>

<summary>Verified phase chain</summary>

`B_Scoring_PropHunt` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, binds the hiding, seeking, and round-end handlers, caches the `B_HunterStartingRoom` actor, and starts `Phase_RoundStart`.
* **HidingStart** (on `RoundStart` becoming active) sets `CountDownTime` to `HidingTime`, runs `ResetGameMode`, starts the one-second `CountDown` timer, and applies `GE_Hunter_Counting` to the hunter team through the Global Ability System.
* **HidingEnd** (when `RoundStart` ends) removes `GE_Hunter_Counting` from the hunter team.
* **CountDown** decrements `CountDownTime`. When it reaches zero it clears the timer, then branches on whether `Playing.Neutral` is active: if it is, the hunt timer just expired, so `HandleRoundVictory(PropTeam)`; otherwise the hiding timer expired, so it starts `Phase_Playing`.
* **StartSeeking** (on `Playing.Neutral` becoming active) sets `CountDownTime` to `HuntingTime`, restarts the countdown, and calls `StartHunting` on the starting room to open it.
* **RoundEnd** fires the `RoundDecided` cue with the round winner, waits `RoundEndTime`, then starts `Phase_RoundEnd_SwitchSides`. **SwitchSides** fires the `RoundDecided.SwitchSides` cue, waits `SwitchingSidesTime`, calls `SwitchTeamSides`, and returns to `Phase_RoundStart`. **CleanupForNextRound** (when the switch phase ends) clears the cue, revives all dead players, and resets active players.
* **ResetGameMode** destroys every tracked decoy, clears the decoy list, and calls `StopHunting` to re-seal the starting room.

The freeze, round-start, playing, round-end, and switch-sides phases all come from ShooterBase; Prop Hunt adds no custom phase asset.

</details>

***

## Win conditions

A round ends one of two ways. The props win if the hunt timer expires with at least one prop alive. The hunters win if they eliminate every prop before the timer runs out. Each routes through `HandleRoundVictory`, which credits the winning team a round, checks the match target, and either ends the match or starts the round-end sequence.

| Winner  | Trigger                                                        |
| ------- | -------------------------------------------------------------- |
| Props   | Hunt countdown reaches zero with at least one prop still alive |
| Hunters | Every prop eliminated before the hunt timer expires            |

<details>

<summary>Verified win routing</summary>

* **Props on time:** when `CountDown` hits zero during `Playing.Neutral` it calls `HandleRoundVictory(PropTeam)`.
* **Hunter wipeout:** `OnEliminationScored` (after the base class records the kill) reads `AlivePlayersInTeam(PropTeam)`; when that count is zero it calls `HandleRoundVictory(HunterTeam)`.
* **Match:** `HandleRoundVictory` clears the countdown, sets the round winner, adds `ShooterGame.Score.RoundsWon` to that team, then `GetTeamScore` compares the team's rounds-won total to `TargetScore`. On reaching it, `HandleVictory` fires the `MatchDecided` cue and starts `Phase_PostGame`; otherwise it starts `Phase_RoundEnd`.

</details>

***

## Key systems

### Hunter starting room and lockout

While the props hide, the hunters are confined and harmless. The starting room is a placed actor with a collision mesh that boxes the hunters in, and the hiding-phase effect on the hunter team blocks their movement and makes them immune to damage. When hiding ends, the effect is removed and the room is opened, releasing the hunters into the level.

<details>

<summary>Verified lockout</summary>

* `GE_Hunter_Counting` is an infinite-duration effect applied to the hunter team during hiding and removed when hiding ends. It grants `Status.BlockInput.Movement` and `Gameplay.DamageImmunity`, so locked hunters cannot move and cannot be hurt.
* `B_HunterStartingRoom` replicates a `HuntingPhase` bool. `StartHunting` and `StopHunting` set it; `OnRep_HuntingPhase` hides the room's text render and disables the wall mesh collision when hunting starts, and restores both when it stops, so the room visibly opens.
* `GA_Hunter_WaitSeek` is a second movement lock on the hunter pawn itself: it ignores move input until the `ShooterGame.GamePhase.Playing.Neutral` phase starts (the hunt phase), then ends and restores input.

</details>

### Disguising

A prop player is a character carrying a static-mesh component that is swapped to look like a world object. Looking at a placeable prop object and disguising copies that object's mesh and materials onto the player, drops the mesh so it sits on the ground, and applies a size tag describing how big the disguise is. Every prop starts the round already disguised as a random object from a starter list.

<details>

<summary>Verified disguise logic</summary>

* World objects are `B_BasePropObject` actors (subclasses such as `B_Prop_TrashCan`, `B_Prop_OilBarrel`, `B_Prop_CardboardBox`) carrying a static mesh, a `PropSize` gameplay tag, and a `bCanTakeDamage` flag.
* `GA_PropDisguise` single-line-traces up to `MaxRange`, filtered to `B_BasePropObject`. On a valid hit it calls `UpdateProp` on the prop hero with the target's mesh and materials, sets the player's prop size, removes any existing prop-size tag, and adds the new one. The size tags are `ShooterGame.PropHunt.LargeProp` / `MediumProp` / `SmallProp` / `TinyProp`.
* `B_PropHero::UpdateProp` sets the static mesh, offsets it down so the mesh rests on the floor relative to the capsule, and applies the copied materials. The current prop, height, and materials are replicated.
* `GA_PropSpawn` runs once at spawn: it picks a random entry from the prop hero's starter list and runs the same `UpdateProp` and size-tag flow, so a fresh prop is never a default character.

</details>

### Locking and decoys

Two prop abilities help a prop sell its disguise. Locking freezes the prop in place and stops it from rotating with the camera so it can sit dead still; activating it again unlocks. Dropping a decoy spawns a static, non-disguised copy of the prop's current object at the player's feet, which hunters may waste shots on. Decoys are tracked so they can be cleaned up at the start of the next round.

<details>

<summary>Verified lock and decoy logic</summary>

* `GA_PropLock` toggles a `Locked?` state. Locking disables input, stops the pawn using controller yaw, applies `GE_LockProp`, and calls `LockPawn`; unlocking restores input, controller yaw, and gravity and removes the effect.
* `GA_PropDecoy` (server authority) spawns a `B_BasePropObject` at the player's transform using the prop hero's current mesh and size, floor-aligned by the same bounds-and-capsule offset as disguising, then registers it with the scoring component through `AddDecoy`. `ResetGameMode` destroys all tracked decoys at the top of each round.

</details>

### Hunter loadout and prop whistle

Hunters are equipped with a rifle to shoot props on sight. To stop a round from being unwinnable, the props are forced to give away their position periodically with an audible whistle.

<details>

<summary>Verified loadout and whistle</summary>

* The hunter rifle is set up under `Game/Items/Rifle/` (`WID_Rifle_PropHunt`, `GA_Weapon_Fire_Rifle_PropHunt`, `GE_Damage_Rifle_PropHunt`, `AbilitySet_ShooterRifle_PropHunt`) and injected via `B_FragmentInjector_Rifle`. The hunter ability set grants the standard movement, ADS, and melee abilities.
* `GA_PropWhistle` is granted to props. On the `ShooterGame.GamePhase.Playing.Neutral` phase (the hunt phase) it loops a delay of `TimeBetweenWhistles` randomized by `VariationTime` and fires the `GameplayCue.PropHunt.Whistle` cue on the owner each cycle.

</details>

***

## Configuration

The round timers and target are properties on the `B_Scoring_PropHunt` component:

| Property             | Default | Meaning                                                |
| -------------------- | ------- | ------------------------------------------------------ |
| `HidingTime`         | 20      | Seconds props have to hide before hunters are released |
| `HuntingTime`        | 120     | Seconds hunters have to find and kill every prop       |
| `TargetScore`        | 3       | Round wins needed to take the match                    |
| `RoundEndTime`       | 5       | Pause after a round is decided                         |
| `SwitchingSidesTime` | 4       | Pause during the side swap                             |
| `HunterTeam`         | 1       | Team id that starts as hunters (swaps each round)      |
| `PropTeam`           | 2       | Team id that starts as props (swaps each round)        |

`SwitchTeamSides` swaps the two team ids and reassigns `HeroData_Hunter_PropHunt` and `HeroData_Prop_PropHunt` to whichever team now holds each role through the team creation component, so the same players alternate sides. The disguise reach (`MaxRange`) and whistle cadence (`TimeBetweenWhistles`, `VariationTime`) are set on `GA_PropDisguise` and `GA_PropWhistle` respectively. The starter prop list is set on `GA_PropSpawn`. The available disguises are the `B_BasePropObject` subclasses placed in the level, under `Game/Props/`.

***

## Content structure

```
Content/
├── Camera/
├── Experiences/
├── Game/
│   ├── Death/
│   ├── Items/
│   │   └── Rifle/
│   └── Props/
├── GameplayCues/
├── Hero/
│   ├── Hunter/
│   └── Prop/
├── Input/
│   ├── Abilities/
│   ├── Actions/
│   └── Mappings/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
```

The scoring component, starting room, and hunter rifle live under `Game/`, with the prop object actors and their meshes under `Game/Props/`. The hunter and prop role setups are split across `Hero/Hunter/` and `Hero/Prop/`. The prop abilities are under `Input/Abilities/` and the prop perspective camera under `Camera/`.

***

## C++ classes

Prop Hunt ships no game-specific C++ beyond the runtime module boilerplate (`PropHuntRuntimeModule`). The scoring loop, team setup, disguise, lock, decoy, whistle, and starting-room logic are all Blueprint built on top of ShooterBase's `UShooterScoring_Base`.

***

## Extending

* **New disguisable objects** are new `B_BasePropObject` subclasses placed in the level; set their mesh, `PropSize` tag, and `bCanTakeDamage`. To make one a possible starting disguise, add it to the starter list on `GA_PropSpawn`.
* **Prop abilities** (disguise, lock, decoy, whistle) are self-contained in their `GA_Prop*` assets and granted through `AbilitySet_Prop_PropHunt`; add a new prop power by granting another ability there rather than editing the scoring component.
* **Round pacing** (hide length, hunt length, round target, the side-switch pauses) is all on `B_Scoring_PropHunt`. The whistle exists to keep the hunt fair; tune its cadence on `GA_PropWhistle` if you change the hunt length.
