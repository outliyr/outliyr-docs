# Hardpoint

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/Hardpoint/`\
**Dependencies:** ShooterBase, GameplayMaps, ControlPointCore
{% endhint %}

A single-point hold mode. Exactly one control point (the hardpoint) is active at a time, and it rotates to the next location on a timer. Holding the active point scores one point per second for the owning team. A team wins either by reaching the score limit outright, or by having the higher score when the match clock runs out.

***

## How it plays

Only one point is live at any moment, marked as the hardpoint. The owning team scores while they hold it, so the fight collapses onto that single spot. After a fixed duration the hardpoint rotates to the next point in the level and everyone repositions. Contesting the point with an enemy inside stops the owner from scoring, and while no team cleanly owns the active point the match clock pauses, so a contested hardpoint costs both teams time. Captures and recaptures reward the players who take the point, separate from the team score.

***

## Match flow

{% stepper %}
{% step %}
### Round start freeze

Holds players while the experience loads.
{% endstep %}

{% step %}
### Playing

Begins on the neutral playing phase. The scoring tick, the match clock, and the first hardpoint activation all start here.
{% endstep %}

{% step %}
### Rotation

Deactivates the current hardpoint and activates the next one every `ControlPointActiveDuration` seconds, cycling through the level's points in order.
{% endstep %}

{% step %}
### Post-game

Starts when a team reaches `TargetScore`, or when the match clock expires and a winner is resolved by score.
{% endstep %}
{% endstepper %}

<details>

<summary>Verified phase and timer logic</summary>

`B_Scoring_Hardpoint` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, starts `Phase_RoundStart_Freeze` with a `FinishRoundStartFreeze` callback, and stores every `B_ControlPoint` into `ControlPoints`.
* **FinishRoundStartFreeze** binds `StartPlaying` to the `ShooterGame.GamePhase.Playing.Neutral` phase, starts `Phase_Playing`, and starts the capture, recapture, contest, and owner-change listeners.
* **StartPlaying** starts the repeating `GrantPoints` timer at `DelayBetweenScoring`, starts the match-clock countdown timer, and calls `HandleControlPoints` to activate the first hardpoint.
* **HandleControlPoints / ControlPointCountdown** run the rotation timer (`ControlPointTimer`). When the rotation countdown reaches zero it resets to `ControlPointActiveDuration` and calls `ActivateNextControlPoint`, which deactivates the current point, advances `CurrentControlPointIndex` modulo the point count, and activates the next point.
* **GrantPoints** (the scoring tick) reads the active point's owner. If the owner should score, it adds one `ShooterGame.Score.ControlPoint.Points` team stack and checks `GetTeamScoreCP` for a win.
* **CountDown** (the match clock) decrements `CountDownTime` once per second; at zero it compares the two teams' scores and calls `HandleVictory` for the higher team, or `HandleVictory(0)` on a tie.

</details>

***

## Win conditions

A team wins by reaching `TargetScore` (default 150) in the `ShooterGame.Score.ControlPoint.Points` team stack, which is fed one point per second while that team owns the active hardpoint. If the match clock (`CountDownTime`, default 300 seconds) reaches zero first, the team with the higher score wins, and an equal score is a draw.

The match clock is not a plain countdown: it pauses whenever no team cleanly owns the active point and resumes when a team takes ownership. A point that is neutral or contested therefore freezes the clock rather than burning it, so a stalemate on the hardpoint extends the match instead of running it out.

<details>

<summary>Verified win and clock-pause logic</summary>

* **Score win:** `GrantPoints` calls `GetTeamScoreCP(OwningTeam)`, which returns true once that team's `ShooterGame.Score.ControlPoint.Points` count reaches `TargetScore`; that routes to `HandleVictory(OwningTeam)`.
* **Clock win:** `CountDown` reads `Team1Score` and `Team2Score` (refreshed from `GetTeamScoreCP`), and at zero calls `HandleVictory(0)` on a tie or `HandleVictory` for the higher-scoring team.
* **Clock pause:** the match clock uses a pausable timer. `ListenForContest` and `ListenForOwnerChange` start it (unpause) and stop it (pause). On an owner-change message, an owner team id greater than zero stops the clock; a neutralizing change (`-1`) starts it. A contest message starts it. The effect is that the clock advances only while the active point is genuinely owned and not stalled.
* **HandleVictory** fires the `MatchDecided` cue with the winning team, starts `Phase_PostGame`, and clears the scoring timer.

</details>

***

## Key systems

### The rotating hardpoint

Hardpoint uses the shared `B_ControlPoint` actor but keeps only one active at a time. The scoring component activates the first point, then cycles to the next on a timer, deactivating the old one so it stops scoring and capturing. Order follows the array of points found in the level, wrapping around at the end.

<details>

<summary>Verified rotation wiring</summary>

* Points are found with `GetAllActorsOfClass` on `B_ControlPoint` and stored in `ControlPoints`.
* `ActivateNextControlPoint` deactivates `CurrentControlPoint`, advances `CurrentControlPointIndex` with a modulo against the point count, then activates the point at the new index.
* The shared `B_ControlPoint` default capture time is `TimeToFullCaptureSeconds` 6. Hardpoint's intent is that an enemy inside the active point pauses the owner's scoring (the `StopWhenContested` scoring behavior) and pauses the match clock; the per-point scoring policy is configured on the placed instances in the level.

</details>

### Player credit on capture

Taking the active point credits the capturing players individually, separate from the team score. A fresh capture is worth more than a recapture.

<details>

<summary>Verified credit values</summary>

* **`ListenForCapture`** (on `ShooterGame.ControlPoint.Message.Captured`) adds one `ShooterGame.Score.ControlPoint.Capture` stack and 100 `ShooterGame.Score.ControlPoint.Points` to each capturing player state.
* **`ListenForRecapture`** (on `ShooterGame.ControlPoint.Message.Recaptured`) adds one `Capture` stack and 50 `Points` per player.

These are individual scoreboard totals; the team win check reads the separate team `Points` stack fed by `GrantPoints`.

</details>

### Bot AI

Bots play the single rotating objective through the shared control-point evaluator, supported by a behavior tree and a find-control-point service so an AI team will push to the current hardpoint and rotate with it.

<details>

<summary>Verified AI assets</summary>

`BT_Lyra_Shooter_Bot_Hardpoint` with `BTS_FindControlPoint_Hardpoint`, on top of the shared `ControlPointWorldEvaluator` priority ladder from ControlPointCore.

</details>

***

## Configuration

The match rules are properties on the `B_Scoring_Hardpoint` component:

| Property                     | Default | Meaning                                                    |
| ---------------------------- | ------- | ---------------------------------------------------------- |
| `TargetScore`                | 150     | Score a team needs to win outright                         |
| `CountDownTime`              | 300     | Match clock in seconds (pauses while the point is unowned) |
| `ControlPointActiveDuration` | 60      | Seconds before the hardpoint rotates                       |
| `DelayBetweenScoring`        | 1       | Seconds between scoring ticks                              |

The control points carry no central configuration asset, so Hardpoint's contested-scoring and one-at-a-time rotation are configured on each placed `B_ControlPoint` instance in the level rather than on the scoring component.

<details>

<summary>Key settings on a placed control point</summary>

A `B_ControlPoint` is tuned through its `Settings` (`FControlPointSettings`). The fields that give Hardpoint its feel:

* `CaptureSettings.ScoringPolicy` — set to `StopWhenContested` so the active point stops scoring for its owner while any enemy is inside. This is an override of the shared default, which is `ScoreWhileOwned`, and it is set per placed instance.
* `CaptureSettings.TimeToFullCaptureSeconds` — solo capture time (shared default 6 seconds).
* `CaptureSettings.ContestResolution` — how simultaneous attackers and defenders resolve, either `BlockWhenContested` or `NetAdvantage`.
* `ActivationSettings.bStartsActive` — false, so a point stays inactive until the scoring component rotates the next one in with `Activate`.

Because these live on each instance, a level can mix points with different capture times or rules.

</details>

The experience `B_Hardpoint` sets the pawn, abilities, and loaded game features; spawning is governed by `B_TeamSpawningRules_Hardpoint`, and `B_ShooterBotSpawner_Hardpoint` fills empty slots with AI.

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

The scoring, rotation, and timer logic, spawning rules, bot spawner, and music manager live under `Game/`; the scoreboard, score widget, and control-point status widget under `UserInterface/`; and the bot behavior tree and service under `Bot/`.

***

## C++ classes

Hardpoint ships no game-specific C++ beyond the runtime module boilerplate (`HardpointRuntimeModule`). All of its behavior is Blueprint built on top of ShooterBase's `UShooterScoring_Base` and the shared `AControlPoint` actor from `ControlPointCore`.

***

## Extending

* **Rotation order or timing** lives in `ActivateNextControlPoint` and the `ControlPointActiveDuration` property; changing how the next point is chosen (random, weighted, fixed sequence) is done in that function.
* **Clock behavior** is in the contest and owner-change listeners that pause and resume the match clock; remove the pause to make the clock a plain countdown, or tie it to different point states.
* **Score and capture rewards** are the values in `GrantPoints`, `ListenForCapture`, and `ListenForRecapture`.
