# Domination

> [!INFO]
> **Plugin:** `Plugins/GameFeatures/Domination/`\
> **Dependencies:** ShooterBase, GameplayMaps, ControlPointCore

A territory-control mode. Several capture points are live at once, and the team that holds the most of them earns points over time. Every second, the team owning more scoring points than its rival gains one to its match score, and the first team to reach the score limit wins. There is no match clock: the race is purely to the score target.

***

## How it plays

Players spawn into two teams and fight over a fixed set of control points that are all active from the start. Standing on a point captures it for your team; once owned, it keeps scoring for you until the other team takes it back. Because the score tick goes to whichever team currently owns the majority of points, holding two of three (or being the only team with anyone on a point) is what builds a lead. Captures and recaptures also reward the individual players who took the point, which feeds the scoreboard and accolades but does not decide the match.

***

## Match flow

The mode is driven by `B_Scoring_Domination`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. On the server it caches every control point in the level at startup, walks through a short opening freeze into open play, then runs a one-second scoring loop until a team hits the target.

1. **Round start freeze** holds players still while the experience finishes loading.
2. **Playing** begins when the neutral playing phase starts. Every control point is activated and the one-second scoring timer starts.
3. **Post-game** starts the instant a team reaches the score target.

There are no rounds and no side switches. The match ends only when a team reaches `TargetScore`.

<details class="gb-toggle">

<summary>Verified phase and loop logic</summary>

`B_Scoring_Domination` event flow, read from the Blueprint graph:

* **BeginPlay (authority only)** waits for the experience to be ready, starts `Phase_RoundStart_Freeze` with a callback to `FinishRoundStartFreeze`, and stores every `B_ControlPoint` actor in the level into `ControlPoints`.
* **FinishRoundStartFreeze** registers a listener for the `ShooterGame.GamePhase.Playing.Neutral` phase tag (to fire `StartPlaying`), starts the capture and recapture message listeners, and starts `Phase_Playing`.
* **StartPlaying** starts a repeating timer at the `DelayBetweenScoring` interval bound to the `Scoring` event, then calls `Activate` on every control point.
* **Scoring** (the one-second tick) reads `GetMajorityOwnedCP`. If that returns a valid team, it stores it as `LeadingTeam`, adds one `ShooterGame.Score.ControlPoint.Points` stack to that team via the Team Subsystem, then checks `GetTeamScoreCP` for a win.
* **HandleVictory** fires the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue with the winning team id, starts `Phase_PostGame`, and clears the scoring timer.

The freeze, playing, and post-game phases come from ShooterBase and are shared across modes.

</details>

***

## Win conditions

A team wins by reaching `TargetScore` (default 125) in the `ShooterGame.Score.ControlPoint.Points` team tag stack. That stack is fed one point per second by the scoring tick, and only the team currently holding the majority of scoring points receives it, so the lead is built by out-controlling the map rather than by kills. If neither team owns a clear majority on a given tick (a tie in points owned, or none owned), no point is awarded that second.

<details class="gb-toggle">

<summary>Verified win and majority logic</summary>

* **`GetMajorityOwnedCP`** counts, per team, how many control points that team should be scoring on right now. For each point it calls the shared `ShouldScore` (which respects the point's ownership and contest state), tallies the owners into a map, then finds the team with the highest count. If exactly one team holds the maximum it returns that team id; on a tie it returns `-1` and no point is granted that tick.
* **`Scoring`** only adds the `ShooterGame.Score.ControlPoint.Points` team stack when the majority team id is greater than zero.
* **`GetTeamScoreCP(TeamId)`** reads that team's `ShooterGame.Score.ControlPoint.Points` stack count and returns true once it is greater than or equal to `TargetScore`. Reaching it routes to `HandleVictory`.

</details>

***

## Key systems

### Control points

The capture points themselves are the shared `B_ControlPoint` actor from ControlPointCore. Each one manages its own capture progress, contest state, ownership, and decay, and broadcasts gameplay messages when it is captured, contested, recaptured, or changes owner. Domination places several of them in the level, all active from the start, and lets the shared actor handle the moment-to-moment capture mechanic while the scoring component only reads ownership once per second.

<details class="gb-toggle">

<summary>Verified control point wiring</summary>

* The scoring component finds points with `GetAllActorsOfClass` on `B_ControlPoint` and stores them in `ControlPoints`; it never spawns or rotates them.
* The shared `B_ControlPoint` defaults relevant here: `TimeToFullCaptureSeconds` 6, `ScoringPolicy` `ScoreWhileOwned` (a point keeps scoring for its owner even while contested), `ContestResolution` `BlockWhenContested`, `TakeoverRule` `UndoRequired`, and `bStartsActive` true. Per-point values such as the control point id are set on each placed instance in the level.

</details>

### Player credit on capture

Capturing and recapturing a point award the capturing players individually, separate from the team score that decides the match. A fresh capture is worth more than wresting a point back.

<details class="gb-toggle">

<summary>Verified credit values</summary>

* **`ListenForCapture`** listens for `ShooterGame.ControlPoint.Message.Captured`. For each capturing player state it adds one `ShooterGame.Score.ControlPoint.Capture` stack and 100 `ShooterGame.Score.ControlPoint.Points` to that player.
* **`ListenForRecapture`** listens for `ShooterGame.ControlPoint.Message.Recaptured` and awards one `Capture` stack and 50 `Points` per player.

These player stacks are individual scoreboard totals and do not feed the team win check, which reads the separately accumulated team stack.

</details>

### Bot AI

Bots play the objective through the shared control-point evaluator, which ranks defending a threatened point, capturing a neutral one, neutralizing an enemy point, reinforcing, holding, and rotating. Domination adds a behavior tree and a find-control-point service on top.

<details class="gb-toggle">

<summary>Verified AI assets</summary>

`BT_Lyra_Shooter_Bot_Domination` with the `BTS_FindControlPoint_Domination` service drive the bots toward points, on top of the shared `ControlPointWorldEvaluator` priority ladder from ControlPointCore.

</details>

***

## Configuration

The match rules are properties on the `B_Scoring_Domination` component:

| Property              | Default | Meaning                       |
| --------------------- | ------- | ----------------------------- |
| `TargetScore`         | 125     | Score a team needs to win     |
| `DelayBetweenScoring` | 1       | Seconds between scoring ticks |

Per-point capture behavior is configured on each `B_ControlPoint` instance placed in the level, not on the scoring component. The default pawn, abilities, and loaded game features are set in the experience `B_Domination`; spawning is governed by `B_TeamSpawningRules_Domination`, and `B_ShooterBotSpawner_Domination` fills empty slots with AI.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   └── Service/
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

The win and scoring logic, spawning rules, bot spawner, and music manager live under `Game/`; the scoreboard, score widget, and control-point status widget under `UserInterface/`; and the bot behavior tree and service under `Bot/`.

***

## C++ classes

Domination ships no game-specific C++ beyond the runtime module boilerplate (`DominationRuntimeModule`). All of its behavior is Blueprint built on top of ShooterBase's `UShooterScoring_Base` and the shared `AControlPoint` actor from ControlPointCore.

***

## Extending

* **More or fewer points** is a level-editing change: place additional `B_ControlPoint` actors, and the scoring component picks them up automatically at startup through its `GetAllActorsOfClass` scan.
* **A different majority rule** (for example weighting certain points, or requiring a strict two-point lead) lives in `GetMajorityOwnedCP`; the win threshold itself is the `TargetScore` property.
* **Capture and recapture rewards** are the literal values added in `ListenForCapture` and `ListenForRecapture`; change them there without touching the team win logic.
