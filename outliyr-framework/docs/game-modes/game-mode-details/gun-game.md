# Gun Game

**Plugin:** `Plugins/GameFeatures/GunGame/`\
**Dependencies:** ShooterBase, GameplayMaps

A free-for-all where your weapon changes with every kill. Each player advances along a fixed weapon ladder one step per elimination, so the gun in your hands is a running tally of how many kills you have. The first player to reach the elimination target wins, and if the clock runs out first the highest score takes it.

***

## How it plays

Players spawn solo and start on the first weapon in the ladder. Every elimination swaps the killer to the next weapon and cycles back to the start once the end of the list is reached. The match is scored exactly like Free For All on eliminations; the weapon ladder is a layer on top that gives each kill an escalating feel without changing how the win is decided.

***

## Match flow

The match is driven by the scoring component `B_Scoring_GunGame`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. Its phase and win logic are identical to Free For All: a brief freeze, open play with a counting-down clock, then the post-game screen.

1. **Round start freeze** holds players in place while the experience loads.
2. **Playing** opens combat and starts the match clock.
3. **Post-game** starts when a win condition is met.

While Playing is active a one-second timer counts the clock down, and each elimination is checked against the target. Whichever fires first calls `HandleVictory`.

<details>

<summary>Verified phase and win logic</summary>

`B_Scoring_GunGame` event flow matches `B_Scoring_FreeForAll` exactly, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, then starts `Phase_RoundStart_Freeze` with a callback to `FinishRoundStartFreeze`.
* **FinishRoundStartFreeze** listens for `ShooterGame.GamePhase.Playing.Neutral` and starts `Phase_Playing`.
* **StartPlaying** starts the repeating one-second `CountDown` timer.
* **CountDown** decrements `CountDownTime`; at zero it ends the match for the player held in `HighestScoreTeamID`.
* **OnEliminationScored** loops team ids 1 to 16, ends the match for any player at `TargetScore`, and tracks the running highest score.
* **HandleVictory** fires the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue and starts `Phase_PostGame`.

The freeze, playing, and post-game phase assets come from ShooterBase.

</details>

***

## Win conditions

The win is decided on eliminations, not on finishing the ladder. A player wins by reaching `TargetScore` eliminations, or by holding the highest elimination count when the clock expires.

| Winner          | Trigger                                                        |
| --------------- | -------------------------------------------------------------- |
| First to target | Any player's elimination total reaches `TargetScore`           |
| Highest at time | Clock reaches zero; the player with the most eliminations wins |

With the default `TargetScore` of 15 and a ladder of six weapons, a winning player cycles the full ladder twice and finishes part way through a third pass. Aligning the target to the ladder length, so the win lands on the final weapon, is a configuration change rather than a code change.

***

## Key systems

### The weapon ladder

Weapon progression lives in the gameplay ability `GA_AdvanceWeapon`, not in the scoring component. The ability holds an ordered `GunList` of weapon item definitions and listens for the player's own eliminations. Each kill increments a local elimination count, indexes into the ladder by that count wrapped to the list length, and swaps the active weapon to the indexed definition. Because the index wraps, the ladder loops indefinitely rather than ending.

<details>

<summary>Verified progression logic</summary>

`GA_AdvanceWeapon`, read from the Blueprint graph:

* **On ability added** registers a listener for `Lyra.Elimination.Message`. When the killer is the owning player state (and not a self-elimination) it increments the cached `Eliminations` count and calls `EquipNextItem`.
* **On activate** seeds `Eliminations` from the player state's `ShooterGame.Score.Eliminations` stat tag stack, then calls `EquipNextItem`, so a player who respawns resumes on the correct rung.
* **EquipNextItem** computes `Eliminations % GunList.Length`, takes that entry of `GunList`, removes the current weapon from the active quick-bar slot and equipment manager, then adds the new weapon definition to an available slot and places it in quick-bar slot 0.

The default `GunList` is six weapons in order: `ID_Pistol`, `ID_RocketLauncher`, `ID_Shotgun`, `ID_SMG`, `ID_GrenadeLauncher`, `ID_Rifle`, all from ShooterBase's shared weapon library.

</details>

***

## Configuration

The match rules are properties on the `B_Scoring_GunGame` component, and the ladder is a property on the `GA_AdvanceWeapon` ability:

| Property        | Where               | Default   | Meaning                                              |
| --------------- | ------------------- | --------- | ---------------------------------------------------- |
| `TargetScore`   | `B_Scoring_GunGame` | 15        | Eliminations a player needs to win outright          |
| `CountDownTime` | `B_Scoring_GunGame` | 720       | Match length in seconds (twelve minutes)             |
| `GunList`       | `GA_AdvanceWeapon`  | 6 weapons | Ordered weapon definitions, one rung per elimination |

The default pawn and abilities are set in the experience `B_GunGame`. Per-player team assignment is handled by `B_TeamSetup_GunGame`, the starting quick bar by `B_QuickBarComponent_GunGame`, and AI slots by `B_BotSpawner_GunGame`.

***

## Content structure

```
Content/
├── Accolades/
├── Experiences/
├── Game/
├── Hero/
├── Input/
│   └── Ability/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
```

This mode follows the standard folder convention with no additional folders. Weapon progression is driven by the ability `GA_AdvanceWeapon` in `Input/Ability/`; the scoring component and quick-bar component live under `Game/`.

***

## C++ classes

Gun Game ships no game-specific C++ beyond the runtime module boilerplate (`GunGameRuntimeModule`). The scoring reuses ShooterBase's `UShooterScoring_Base` and the progression is built entirely in the `GA_AdvanceWeapon` ability.

***

## Extending

* **Changing the ladder** is editing `GunList` on `GA_AdvanceWeapon`: reorder it, add weapons, or shorten it.
* **Making the win land on the final weapon.** The default win is on kill count, and with more target kills than weapons the ladder loops, so a player can win mid-ladder. Two ways to tie the win to the ladder: the simplest is to set `TargetScore` to the number of weapons in `GunList`, so reaching the target coincides with clearing the last weapon. For a true gun-game finish, change the win condition to fire on a kill made with the final weapon rather than on a kill count, since `GA_AdvanceWeapon` already knows each player's current rung.
* **Demotion on death** (losing a rung when killed) would be a new listener in `GA_AdvanceWeapon` that decrements the count on the owner's death message before re-equipping, since the ability already owns the index-to-weapon mapping.
