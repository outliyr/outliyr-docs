# Headquarters

> [!INFO]
> **Plugin:** `Plugins/GameFeatures/Headquarters/`\
> **Dependencies:** ShooterBase, GameplayMaps, ControlPointCore

A capture-then-defend mode. One objective spawns at a time. Both teams race to capture it, and once a team owns it that team scores while it holds, but cannot respawn until the defence window ends. The enemy tries to neutralize the headquarters to cut the scoring and force a new one to spawn. The first team to reach the score limit wins.

***

## How it plays

A single headquarters becomes active and is open to capture by either team. The team that captures it starts scoring, and as a deliberate cost their dead players stop respawning for a short window, so a capture commits the owning team to defending with the players they have alive. The other team can respawn freely and pushes to neutralize the point. If they clear the owner off it, the captured headquarters ends, a brief lockout passes, and a fresh one spawns to be fought over again. If the owning team survives the window and keeps the point, they bank score toward the limit.

***

## Match flow

The mode is driven by `B_Scoring_Headquarters`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. On the server it caches the level's control points, runs a one-second scoring tick, and steps a small phase machine that governs whether the headquarters is spawning, locked, open to capture, or captured.

1. **Round start freeze** holds players while the experience loads.
2. **Spawning** picks the next headquarters location and waits briefly before it can be captured.
3. **Locked** activates the point in a locked state for a brief moment so it appears but cannot yet be taken.
4. **Playing (neutral)** unlocks the point. Either team can now capture it.
5. **Captured** begins when a team captures the headquarters. That team scores while holding it and is temporarily barred from respawning.
6. **Back to spawning** happens when the headquarters is neutralized, looping to a new objective.
7. **Post-game** starts when a team reaches `TargetScore`.

<details class="gb-toggle">

<summary>Verified phase machine</summary>

`B_Scoring_Headquarters` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, starts `Phase_RoundStart_Freeze` with a `FinishRoundStartFreeze` callback, and caches every `B_ControlPoint` into `ControlPoints`.
* **FinishRoundStartFreeze** starts the repeating `GrantPoints` scoring timer at `DelayBetweenScoring`, starts the capture and owner-change listeners, and calls `SetupGamePhases`.
* **SetupGamePhases** binds handlers to the custom phase tags `ShooterGame.GamePhase.Playing.Headquarters.Spawning`, `...Headquarters.Locked`, `ShooterGame.GamePhase.Playing.Neutral`, and `...Headquarters.Captured` (plus the end of the captured phase), then starts `Phase_Playing_CP_Spawning`.
* **HandleSpawningPhase** picks the next point (`GetNextControlPoint`), sets the phase countdown to `TimeToSpawnNextControlPoint`, and runs a one-second phase timer.
* **HandleLockedPhase** activates the point in its locked state and waits `TimeToLockControlPoint`.
* **HandleNeutralPhase** unlocks the point so it can be captured and runs the active-duration timer.
* **ControlPointCountdown** drives the phase timer; when it expires it advances to the next phase: spawning → locked → playing → (on capture) captured, looping back to spawning when a captured point is neutralized.
* **HandleCapturedPhase / HandleCapturePhaseEnd** run the captured-phase timer and, when that phase ends, revive the defending team's dead players.

The spawning, locked, and captured phases (`Phase_Playing_CP_Spawning`, `Phase_Playing_CP_Locked`, `Phase_Playing_Captured`) are Headquarters-specific assets under `Experiences/Phase/`; the freeze, neutral playing, and post-game phases come from ShooterBase.

</details>

***

## Win conditions

A team wins by reaching `TargetScore` (default 150) in the `ShooterGame.Score.ControlPoint.Points` team stack, which accrues one point per second while that team owns the active headquarters. There is no match clock; the match ends only when a team reaches the target. A captured headquarters that is neutralized by the enemy stops scoring and is replaced by a new one, so the score race is gated on actually holding objectives, not just capturing them.

<details class="gb-toggle">

<summary>Verified win and capture-transition logic</summary>

* **`GrantPoints`** (the scoring tick) reads the current point's owner; if the owner should score, it adds one `ShooterGame.Score.ControlPoint.Points` team stack and checks `GetTeamScoreCP(OwningTeam)`, which returns true once that team reaches `TargetScore`, routing to `HandleVictory`.
* **`ListenForOwnerChanged`** records the new owner as `CapturedTeam` (unless already in the captured phase) and calls `HandleControlPointOwnerChanged`.
* **`HandleControlPointOwnerChanged`** branches on the new owner: `-1` (neutralized) during the captured phase starts `Phase_Playing_CP_Spawning` to begin a fresh objective; a real team owner starts `Phase_Playing_Captured` and applies the respawn-disabled effect to the capturing team for four seconds before removing it.
* **`HandleVictory`** fires the `MatchDecided` cue with the winning team, starts `Phase_PostGame`, and clears the scoring timer.

</details>

***

## Key systems

### Respawn lockout on capture

The defining mechanic is that capturing the headquarters temporarily disables respawns for the capturing team. The scoring component applies a respawn-disabling gameplay effect to that team when they capture, holds it for the defence window, then removes it. When the captured phase ends, the defending team's dead players are revived in one pass so they re-enter together.

<details class="gb-toggle">

<summary>Verified respawn logic</summary>

* On capture, `HandleControlPointOwnerChanged` applies `GE_RespawnDisabled_Headquarters` to the `CapturedTeam` (the team that just captured), waits four seconds, then removes it. The matching `GCNL_RespawnDisabled_Headquarters` cue and `W_RespawnDisabled_Headquarters` widget show the locked-out state to those players.
* When the captured phase ends, `ReviveDeadDefendingPlayers` walks the player array and, for each player on the `CapturedTeam` who is a spectator, has no pawn, or carries the `Status.Death` tag, calls `RespawnDeadPlayer`. That requests a restart through the Lyra game mode and broadcasts the `Ability.Respawn.Completed.Message` so the player comes back.

</details>

### The single objective

Headquarters uses the shared `B_ControlPoint` actor but exposes only one at a time, cycling through the level's points as each headquarters is resolved. Unlike Domination, points do not start active; the phase machine spawns, locks, then unlocks one when it is that point's turn.

<details class="gb-toggle">

<summary>Verified objective wiring</summary>

* Points are found with `GetAllActorsOfClass` on `B_ControlPoint` and stored in `ControlPoints`.
* `GetNextControlPoint` deactivates the current point and advances `CurrentControlPointIndex` modulo the point count. `ActivateControlPoint` activates the chosen point (locked, for `TimeToLockControlPoint`), and `UnlockControlPoint` opens it to capture once the neutral phase begins.
* Headquarters' intent is that an enemy contesting the owned point pauses the owner's scoring (the `StopWhenContested` behavior); the per-point scoring policy is configured on the placed instances in the level.

</details>

### Bot AI

Bots play the single shifting objective through the shared control-point evaluator, with a behavior tree, a find-control-point service, and a decorator that gates objective behavior on whether the point is currently active.

<details class="gb-toggle">

<summary>Verified AI assets</summary>

`BT_Lyra_Shooter_Bot_Headquarters` with `BTS_FindControlPoint_Headquarters` and the `BTD_ControlPointActive` decorator, on top of the shared `ControlPointWorldEvaluator` priority ladder from ControlPointCore.

</details>

***

## Configuration

The match rules are properties on the `B_Scoring_Headquarters` component:

| Property                      | Default | Meaning                                       |
| ----------------------------- | ------- | --------------------------------------------- |
| `TargetScore`                 | 150     | Score a team needs to win                     |
| `ControlPointActiveDuration`  | 60      | Seconds the captured/active window runs       |
| `TimeToSpawnNextControlPoint` | 1       | Seconds in the spawning phase before locking  |
| `TimeToLockControlPoint`      | 1       | Seconds the point stays locked before opening |
| `DelayBetweenScoring`         | 1       | Seconds between scoring ticks                 |

The respawn-lockout duration is the four-second delay in `HandleControlPointOwnerChanged`. The control points carry no central configuration asset, so Headquarters' contested-scoring and one-at-a-time activation are configured on each placed `B_ControlPoint` instance in the level rather than on the scoring component.

<details class="gb-toggle">

<summary>Key settings on a placed control point</summary>

A `B_ControlPoint` is tuned through its `Settings` (`FControlPointSettings`). The fields that give Headquarters its feel:

* `CaptureSettings.ScoringPolicy` — set to `StopWhenContested` so a held headquarters stops scoring while an enemy is inside it. This overrides the shared default of `ScoreWhileOwned`, and is set per placed instance.
* `CaptureSettings.TimeToFullCaptureSeconds` — solo capture time (shared default 6 seconds).
* `ActivationSettings.bStartsActive` — false, so each headquarters stays inactive until the scoring component's spawn-and-lock cycle activates it.

Because these live on each instance, a level can mix headquarters with different capture times or rules.

</details>

The experience `B_Headquarters` sets the pawn, abilities, and loaded game features; spawning is governed by `B_TeamSpawningRules_Headquarters`, and `B_ShooterBotSpawner_Headquarters` fills empty slots with AI.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Decorator/
│   └── Service/
├── Experiences/
│   └── Phase/
├── Game/
├── GameplayCues/
├── Hero/
├── Input/
│   └── Ability/
├── Maps/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
```

The scoring, phase, and respawn logic, the respawn-disabled effect, spawning rules, bot spawner, and music manager live under `Game/`; the custom spawning, locked, and captured phases under `Experiences/Phase/`; the respawn-disabled cue under `GameplayCues/`; and the scoreboard, objective marker, and respawn-disabled widget under `UserInterface/`.

***

## C++ classes

Headquarters ships no game-specific C++ beyond the runtime module boilerplate (`HeadquartersRuntimeModule`). All of its behavior is Blueprint built on top of ShooterBase's `UShooterScoring_Base` and the shared `AControlPoint` actor from ControlPointCore.

***

## Extending

* **The defence window** (how long respawns are disabled) is the four-second delay in `HandleControlPointOwnerChanged`; the score window length is `ControlPointActiveDuration`.
* **The phase sequence** is assembled in `SetupGamePhases` and stepped in `ControlPointCountdown`; adding an intermediate phase (for example a neutralize-grace period) is done by binding another phase handler and routing the countdown through it.
* **Respawn rules** live in `RespawnDeadPlayer` and `ReviveDeadDefendingPlayers`; changing who comes back and when is done there rather than in the phase machine.
