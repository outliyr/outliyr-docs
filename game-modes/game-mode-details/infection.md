# Infection

> [!INFO]
> **Plugin:** `Plugins/GameFeatures/Infection/`\
> **Dependencies:** ShooterBase, GameplayMaps

An asymmetric mode that starts with everyone on the survivor team. After a short grace period the outbreak begins and one random player is turned into the infected. From then on every survivor an infected player kills switches sides and respawns as infected. Survivors win by keeping at least one player alive until the clock runs out; the infected win the instant the last survivor falls.

***

## How it plays

The match opens with all players on the survivor team and combat suppressed during a brief pre-outbreak window. When that window ends the outbreak phase starts, one player is chosen at random and converted into the infected, and the main clock begins. The infected hunt survivors with a melee lunge; a killed survivor is moved to the infected team, has their loadout stripped, and respawns in the infected pawn. The infected ranks therefore grow over the round while the survivor count only shrinks. The round is a single timed push with no rounds to reset.

***

## Match flow

The match is driven by the scoring component `B_Scoring_Infection`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. On the server it advances through a pre-outbreak window, the outbreak, and then a single timed playing phase, repurposing one repeating countdown for both timers.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Round start freeze

Holds players still while the experience finishes loading.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Pre-outbreak

A short grace period on the `Playing.Neutral` phase. The countdown is set to `PreOutbreakTime`. Everyone is still a survivor.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Outbreak

Begins when the pre-outbreak countdown expires and the mode starts its own `Phase_Playing_Outbreak`. One random player is converted to infected and the countdown is reset to `OutbrakeTime` for the main match clock.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Post-game

Starts when a win condition is met.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

<details class="gb-toggle">

<summary>Verified phase and timer logic</summary>

`B_Scoring_Infection` event flow, read from the Blueprint graph:

* **BeginPlay (authority only)** waits for the experience to be ready, then starts `Phase_RoundStart_Freeze` with a callback to `FinishRoundStartFreeze`.
* **FinishRoundStartFreeze** registers a listener for the `ShooterGame.GamePhase.Playing.Neutral` phase and starts `Phase_Playing` (provided by ShooterBase).
* **StartPlaying** sets `CountDownTime` to `PreOutbreakTime`, starts a repeating one-second `CountDown` timer, and calls `ListenForOutbreak`, which registers a listener for the `ShooterGame.GamePhase.Playing.Outbreak` phase.
* **CountDown** decrements `CountDownTime` by one each tick. When it reaches zero it clears the timer, then checks whether the `Playing.Outbreak` phase is active. If the outbreak is already running it calls `HandleVictory(1)` (survivors win on time); otherwise it starts `Phase_Playing_Outbreak`.
* **OutbreakStarts** (gated by a `DoOnce`) runs `TurnFirstPlayerIntoInfected`, sets `CountDownTime` to `OutbrakeTime`, and restarts the one-second countdown for the rest of the match.
* **HandleVictory** activates the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue with the winning team id and starts `Phase_PostGame`.

The freeze, neutral playing, and post-game phases come from ShooterBase. Only `Phase_Playing_Outbreak` is mode-specific and lives under `Experiences/Phases/`; it is a game-phase ability whose only job is to carry the `Playing.Outbreak` tag that the countdown branches on.

</details>

***

## Win conditions

There are two ways the match ends. Survivors win if at least one of them is still alive when the outbreak clock reaches zero. The infected win the moment team 1 (survivors) has no players left alive.

| Winner             | Trigger                                                        |
| ------------------ | -------------------------------------------------------------- |
| Survivors (team 1) | Outbreak countdown reaches zero with the outbreak phase active |
| Infected (team 2)  | Every survivor has been eliminated and converted               |

<details class="gb-toggle">

<summary>Verified win routing</summary>

* **Survivors on time:** when `CountDown` hits zero it checks `IsPhaseActive(Playing.Outbreak)`. Because the outbreak phase is active for the entire main clock, the timeout always resolves to `HandleVictory(1)`.
* **Infected wipeout:** `OnEliminationScored` (the override of the base event, after the base class has recorded the kill) reads `AlivePlayersInTeam(1)` from the Team Subsystem. When that count is zero it calls `HandleVictory(2)`.
* Survivor conversion is not a win check itself; it only shrinks the survivor count that `OnEliminationScored` reads.

</details>

***

## Key systems

### Team assignment

Every player joins on the survivor team. The plugin's `UTeamSetup_Infection`, a C++ child of `ULyraTeamCreationComponent`, overrides server team assignment to return team 1 for every non-spectator player, so the match always begins with a full survivor team and an empty infected team. The infected team is populated entirely by conversion at runtime.

<details class="gb-toggle">

<summary>Verified team setup</summary>

`UTeamSetup_Infection::ServerAssignPlayerTeam_Implementation` returns `1` unconditionally (the header notes spectator-only player states are still stripped of any team association by the base class). The Blueprint wrapper used by the experience is `B_TeamSetup_Infection`. Team 1 is the survivors and team 2 is the infected throughout the mode.

</details>

### Conversion on death

Conversion is driven from the survivor pawn, not the scoring loop. When a survivor finishes dying, the survivor pawn calls `InfectPlayer` on the scoring component. That function moves the player to the infected team, clears their survivor inventory and quickbar, and assigns the infected pawn data so the player respawns as infected. The first infection at the outbreak reuses the same path but additionally transforms the chosen player in place rather than waiting for a death.

<details class="gb-toggle">

<summary>Verified conversion path</summary>

* `B_SurvivorHero` stores the dying player's state in its `Death` override, then on `OnDeathFinished` calls `B_Scoring_Infection::InfectPlayer` with that player state.
* `InfectPlayer(PlayerState, CanTransform?)` resolves the player's controller (handling bot controllers), calls `ClearInfectedInventory` to remove every quickbar slot and empty the inventory, then sets the player's pawn data to `InfectedPawnData` and calls `ChangeTeamForActor` to move them to team 2.
* When `CanTransform?` is true and the player is not already dead, it also spawns the infected pawn at the survivor pawn's transform, possesses it, and destroys the old pawn. Regular death conversions are called with `CanTransform?` left false, so the swap happens through the normal respawn flow into the infected pawn data.
* `TurnFirstPlayerIntoInfected` (called once when the outbreak starts) picks a random entry from the player array and calls `InfectPlayer` with `CanTransform?` set to true, so the first infected is transformed on the spot.

</details>

### Infected melee

The infected fight with a single melee ability rather than weapons. It runs a capsule trace in front of the attacker, plays a hit montage, and on a confirmed enemy hit with clear line of sight applies the infected damage effect. A miss instead drives the attacker forward with a root-motion lunge, giving the infected a gap-closing attack.

<details class="gb-toggle">

<summary>Verified melee logic</summary>

* `GA_Infected_Melee` capsule-traces with the melee radius and half-height, commits, and plays the configured montage. On authority it re-traces, compares teams, and on a different-team hit with an unobstructed line trace applies `GE_Damage_Infected_Melee` to the target's ability system and fires the `GameplayCue.Weapon.Melee.Hit` cue. If the line trace is blocked it applies a root-motion constant force forward scaled by distance instead.
* The ability is granted through `AbilitySet_Infected_Infection` and bound to `IA_Infected_Melee` via `InputData_Infection_AddOns`.

</details>

### Bot AI

Bots play both roles. A decorator checks whether the bot is infected and routes it to the role-appropriate branch, with infected bots running a melee service and task and using EQS to close on the nearest enemy.

<details class="gb-toggle">

<summary>Verified AI assets</summary>

The behavior is built from `BT_Lyra_Shooter_Bot_Infection` and its blackboard, the `BTD_IsPlayerInfected` and `BTD_CloseToEnemy` decorators, the `EQS_MoveAgainstEnemy_Infected` query, the `BTS_Melee` service, the `BTT_Infected_Melee` task, and the `ST_Infected` state tree. Bots are placed by `B_ShooterBotSpawner_Infection`.

</details>

***

## Configuration

The match timers are properties on the `B_Scoring_Infection` component:

| Property           | Default                       | Meaning                                                        |
| ------------------ | ----------------------------- | -------------------------------------------------------------- |
| `PreOutbreakTime`  | 15                            | Grace period in seconds before the outbreak begins             |
| `OutbrakeTime`     | 480                           | Main match clock in seconds after the outbreak (eight minutes) |
| `InfectedPawnData` | `HeroData_Infected_Infection` | Pawn data every converted player respawns into                 |

The mode has no kill-count target; survivor survival versus a full wipe is the only thing the win checks read. The default pawn, ability sets, and which game features load are set in the experience `B_Infection`. Player spawning is governed by `B_SpawningRules_Infection`. The survivor and infected loadouts live in `Hero/Survivor/` and `Hero/Infected/` as separate hero data, ability set, and tag-relationship assets.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Decorator/
│   ├── EQS/
│   ├── Service/
│   ├── StateTree/
│   └── Task/
├── Experiences/
│   └── Phases/
├── Game/
├── Hero/
│   ├── Infected/
│   └── Survivor/
├── Input/
│   ├── Ability/
│   ├── Actions/
│   └── Mapping/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
```

The scoring component, team setup, and spawning rules live under `Game/`. The survivor and infected role setups are split across `Hero/Survivor/` and `Hero/Infected/`. The outbreak phase ability is under `Experiences/Phases/`, the infected melee and leaderboard abilities under `Input/Ability/`, and the bot stack under `Bot/`.

***

## C++ classes

* `UTeamSetup_Infection` — server team assignment for the mode; assigns every joining player to the survivor team (team 1) and leaves the infected team to be filled by conversion.

The conversion, melee, scoring, and phase logic are all Blueprint built on top of ShooterBase's `UShooterScoring_Base`.

***

## Extending

* **Conversion behavior** lives in `InfectPlayer` and `ClearInfectedInventory` on `B_Scoring_Infection`. Change what a converted player keeps, where they respawn, or what pawn they become there rather than in the death ability.
* **The outbreak trigger** is the `Playing.Outbreak` phase. Bind additional logic to that phase, or change how the first infected is chosen, in `TurnFirstPlayerIntoInfected`.
* **Infected attacks** are defined entirely in `GA_Infected_Melee` and `GE_Damage_Infected_Melee`; adjust reach, damage, the lunge force, or add a second infected ability through the infected ability set without touching the scoring component.
