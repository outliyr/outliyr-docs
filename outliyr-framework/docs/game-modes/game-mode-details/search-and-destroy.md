# Search And Destroy

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/SearchAndDestroy/`\
**Dependencies:** ShooterBase, GameplayMaps
{% endhint %}

A round-based mode with no respawns inside a round. One team attacks and tries to plant a bomb at one of the map's bomb sites; the other team defends and tries to stop them. Attackers win a round by detonating a planted bomb or wiping out the defenders; defenders win by defusing the bomb, running out the clock, or wiping out the attackers. The first team to win the target number of rounds wins the match, and the attack and defense roles swap at the end of every round.

***

## How it plays

Each round starts with a short freeze, then opens with the bomb in the attacking team's hands. Attackers push toward a bomb site and plant; once the bomb is down a defuse timer starts and defenders race to reach it. A dead player stays dead until the round ends, so trades and positioning decide rounds. Between rounds the teams switch sides and everyone is revived for the next round.

***

## Match flow

The round lifecycle is driven by `B_Scoring_SearchAndDestroy`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. On the server it locates the bomb spawner and every bomb site at startup, then advances the match through a chain of game phases, arming a one-second countdown that is repurposed for whichever timer the current phase needs.

A single round moves through these phases:

1. **Round start freeze** holds players still at the top of the round.
2. **Round start** increments the round counter and resets the round (fresh bomb, re-armed sites, cleared pickups).
3. **Playing (neutral)** is the live attack phase. The countdown is set to the plant time. Attackers carry and plant the bomb.
4. **Playing (bomb planted)** begins the instant the bomb is planted. The countdown is reset to the defuse time and the bomb detonates when it hits zero.
5. **Round end** announces the round winner, holds briefly, then enters the side-switch phase.
6. **Round end / switch sides** swaps the attack and defense teams, cleans up the world, and loops back to the freeze for the next round.

When a round win pushes a team to the target round count, the match ends instead of starting another round.

<details>

<summary>Verified phase chain</summary>

`B_Scoring_SearchAndDestroy` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, runs `InitializeGame` (caches the `B_BombSpawner` and all `B_BombSite` actors and binds every phase handler), then starts `Phase_RoundStart_Freeze`.
* When the freeze ends it starts `Phase_RoundStart`. `StartNewRound` clears the timer, increments `CurrentRound`, runs `ResetRound`, and starts `Phase_Playing`.
* `Phase_Playing` resolves to the `ShooterGame.GamePhase.Playing.Neutral` tag; `NeutralPlayingPhase` sets `CountDownTime` to `TimeToPlantBomb` and starts the one-second `CountDown` timer.
* Planting starts the mode's own `Phase_Playing_BombPlanted`; `BombHasPlanted` resets `CountDownTime` to `TimeToDefuseBomb` and restarts the timer.
* `RoundEnd` fires the `RoundDecided` cue with the round winner, deactivates bombs, waits `RoundEndTime`, then starts `Phase_RoundEnd_SwitchSides`. `SwitchSides` fires the `RoundDecided.SwitchSides` cue, calls `SwitchTeamSides` (a straight swap of the offense and defense team ids), waits `SwitchingSidesTime`, cleans up world actors, and returns to the freeze. When that phase ends, `CleanupForNextRound` revives all dead players and resets active players.
* `ResetRound` destroys leftover pickups, destroys the old bomb, spawns a new bomb for the offense team through the bomb spawner, clears the planted site, and re-initializes every bomb site with the new bomb and offense team.

</details>

***

## Round win conditions

A round can end six ways. The attacking (offense) team wins by planting and detonating, or by eliminating every defender. The defending team wins by defusing, by surviving the plant timer with no plant, or by eliminating every attacker before the bomb is down. Each win routes through `HandleRoundVictory`, which credits the winning team a round, checks the match target, and either ends the match or starts the round-end sequence.

| Winner    | Trigger                                               |
| --------- | ----------------------------------------------------- |
| Attackers | Planted bomb's defuse timer reaches zero (detonation) |
| Attackers | All defenders eliminated                              |
| Defenders | Bomb defused during the planted phase                 |
| Defenders | Plant timer reaches zero with no bomb planted         |
| Defenders | All attackers eliminated before a plant               |

<details>

<summary>Verified win routing</summary>

* **Detonation / time:** when `CountDown` reaches zero it checks whether the bomb-planted phase is active. If so and a planted site is valid, `HandleRoundVictory(OffenseTeam)`; otherwise `HandleRoundVictory(DefenseTeam)`.
* **Eliminations:** `OnEliminationScored` (after the base class records the kill) checks alive counts. Zero defenders alive gives the round to the offense; during the neutral phase, zero attackers alive gives it to the defense. It also applies `GE_PlayerDeathNotify` to everyone for four seconds as a kill notification.
* **Plant:** the `PlantBomb` event (valid only during the neutral phase) stores the planted site, adds `ShooterGame.Score.BombPlanted` to the planter and offense team, starts `Phase_Playing_BombPlanted`, and deactivates every other bomb site.
* **Defuse:** the `DefuseBomb` event (valid only during the planted phase) adds `ShooterGame.Score.BombDefused` and calls `HandleRoundVictory(DefenseTeam)`.
* **Match:** `HandleRoundVictory` adds `ShooterGame.Score.RoundsWon` to the winner, then `GetTeamScore` compares that team's rounds-won total to `TargetScore`. On reaching it, `HandleVictory` fires the `MatchDecided` cue and starts `Phase_PostGame`; otherwise it starts `Phase_RoundEnd`.

</details>

***

## Key systems

### The bomb

The bomb is a carried objective. At the start of each round the bomb spawner gives a fresh bomb to the attacking team, and it can be dropped on death and picked up off the ground by another attacker. Planting and defusing are gameplay abilities granted to players, gated by the current phase so a bomb can only be planted while the round is neutral and only defused once it is down.

<details>

<summary>Bomb actors and abilities</summary>

* `ABomb` (Blueprint `B_Bomb`) holds the carrier, the carrier's player state, the offense team id, and whether it is planted, all replicated. It attaches to a socket on the carrier, drops to the world when the carrier dies, and is picked up through a sphere overlap. It broadcasts spawned, dropped, and destroyed messages.
* `ABombSite` (`B_BombSite`) marks a valid plant location and is initialized each round with the active bomb and offense team. Planting at one site deactivates the others.
* `ABombSpawner` (`B_BombSpawner`) spawns and destroys the round's bomb for the offense team.
* `GA_Plant_Bomb` and `GA_Defuse_Bomb` are the player abilities that drive the `PlantBomb` and `DefuseBomb` events on the scoring component.

</details>

### Bot AI

Bots understand the objective rather than just fighting. They evaluate whether to attack or defend and run dedicated plant and defuse tasks, so an AI-filled team will push a site and plant, or rotate to defend and defuse.

<details>

<summary>AI assets</summary>

`USnD_WorldEvaluator` scores the attack/defend situation for the AI. The behavior is split across a behavior tree (`BT_Lyra_Shooter_Bot_SearchAndDestroy`), a state tree (`ST_SearchAndDestroy`), the `BTS_HandleBombSites` service, and the `BTT_PlantBomb` / `BTT_DefuseBomb` tasks, with `USnD_BotTasks` providing the native task logic.

</details>

***

## Configuration

The round rules are properties on the `B_Scoring_SearchAndDestroy` component:

| Property             | Default | Meaning                             |
| -------------------- | ------- | ----------------------------------- |
| `TargetScore`        | 3       | Round wins needed to take the match |
| `TimeToPlantBomb`    | 90      | Seconds attackers have to plant     |
| `TimeToDefuseBomb`   | 45      | Seconds on the bomb after a plant   |
| `RoundEndTime`       | 7       | Pause after a round is decided      |
| `SwitchingSidesTime` | 4       | Pause during the side swap          |

Bomb sites are placed in the level as `B_BombSite` actors and the bomb spawner as a `B_BombSpawner` actor; the component finds them automatically at startup. The custom `Phase_Playing_BombPlanted` lives under `Experiences/Phase/`, while the freeze, round-start, playing, round-end, and post-game phases come from ShooterBase.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Services/
│   ├── StateTree/
│   └── Tasks/
├── Experiences/
│   └── Phase/
├── Game/
│   ├── Death/
│   └── Objectives/
├── GameplayCues/
├── Hero/
├── Input/
│   ├── Ability/
│   └── Actions/
├── Maps/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
```

The round and win logic sits in `Game/`, the bomb actors and plant/defuse abilities in `Game/Objectives/`, and the bomb and bomb-site markers in `UserInterface/`.

***

## C++ classes

* `ABomb` — the carried bomb actor with attach, drop, pickup, and replicated carry/plant state.
* `ABombSite` — a bomb site actor marking a valid plant location, armed and disarmed per round.
* `ABombSpawner` — spawns and destroys the round's bomb for the attacking team.
* `USnD_WorldEvaluator` — scores attack versus defend situations for the AI.
* `USnD_BotTasks` — native bot task logic behind the plant and defuse behaviors.

***

## Extending

* **New round endings** (for example a hostage or a secondary objective) are added by binding another phase handler in `InitializeGame` and routing it through `HandleRoundVictory`, which already centralizes round crediting and the match-win check.
* **Plant and defuse rules** live in `GA_Plant_Bomb` and `GA_Defuse_Bomb`; changing cast times, interrupt conditions, or who can plant is done there rather than in the scoring component.
