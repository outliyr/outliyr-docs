# Payload

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/Payload/`\
**Dependencies:** ShooterBase, GameplayMaps, ControlPointCore
{% endhint %}

A symmetric escort mode. A single payload sits on a spline track between two ends, one belonging to each team. The payload behaves like a capture point: whichever team is standing on it owns it, and the owning team pushes it toward the enemy's end at a fixed speed. A team wins by driving the payload all the way to the enemy end, or by having it closer to the enemy end when the match clock runs out.

***

## How it plays

The payload starts at the centre of the track and does not move until a team captures it by standing on the platform. Once owned, it rolls toward the owning team's target end on its own, carrying the players riding it. The enemy stops it by contesting, and recaptures it by clearing the owners off and standing on it themselves, at which point it reverses and rolls the other way. It is a tug-of-war on rails: the cart only ever moves toward whichever end belongs to its current owner, so ground is won and lost as ownership flips. The platform is a moving base, so players ride it cleanly and their jumps carry its velocity.

***

## Match flow

The mode is driven by `B_Scoring_Payload`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state, together with the `APayloadPoint` actor (`B_PayloadControlPoint`) that owns the track and the movement. On the server the scoring component runs a one-second match clock and listens for the payload reaching an end; the payload actor itself does all the movement and end-detection on its own tick.

1. **Round start freeze** holds players while the experience loads.
2. **Playing** begins on the neutral playing phase. The match clock starts and the scoring component caches the payload actor and starts listening for it to reach an end.
3. **Post-game** starts when the payload reaches either end, or when the match clock expires and a winner is resolved by which side of centre the payload finished on.

<details>

<summary>Verified phase and listener logic</summary>

`B_Scoring_Payload` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience and starts `Phase_RoundStart_Freeze` with a `FinishRoundStartFreeze` callback.
* **FinishRoundStartFreeze** binds `StartPlaying` to the `ShooterGame.GamePhase.Playing.Neutral` phase, starts `Phase_Playing`, finds the `B_PayloadControlPoint` actor and stores it as `Payload`, then starts `ListenForPayloadEnd`.
* **StartPlaying** starts the one-second match-clock timer.
* **CountDown** decrements `CountDownTime` once per second; at zero it reads the payload's normalized progress and calls `HandleVictory` for the appropriate side (see win conditions).
* **ListenForPayloadEnd** listens for `ShooterGame.Payload.Message.ReachedEnd` and calls `HandleVictory` with the team id carried by that message.
* **HandleVictory** fires the `MatchDecided` cue with the winning team, and starts `Phase_PostGame`.

The freeze, playing, and post-game phases come from ShooterBase.

</details>

***

## Win conditions

A team wins immediately by pushing the payload to the enemy end of the track. If the match clock (`CountDownTime`, default 900 seconds) expires first, the winner is decided by where the payload sits: past the midpoint counts for the team whose end it is approaching, before the midpoint counts for the other team, and exactly at the midpoint is a draw. There is no points-race score in this mode; position on the track is the score.

| Winner                  | Trigger                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| Team at the reached end | Payload driven all the way to that team's target end                     |
| Team ahead on the track | Match clock expires with the payload past centre toward their target end |
| Draw                    | Match clock expires with the payload exactly at centre                   |

<details>

<summary>Verified win routing</summary>

* **Reached end:** the payload actor broadcasts `ShooterGame.Payload.Message.ReachedEnd` with the owning team id when it arrives, and `ListenForPayloadEnd` routes that team straight to `HandleVictory`. The payload fires this exactly once per round and then freezes.
* **Clock expiry:** `CountDown` reads `GetNormalizedProgress` (0..1 along the spline). At `0.5` it calls `HandleVictory(0)` (draw); above `0.5` it calls `HandleVictory(GetTeamIdAtEnd)`; below `0.5` it calls `HandleVictory(GetTeamIdAtStart)`.
* The track's two ends are `TeamIdAtStart` (spline distance 0, default team 1) and `TeamIdAtEnd` (the far end, default team 2). The payload starts at `InitialNormalizedDistance` 0.5, the centre.

</details>

***

## Key systems

### The payload actor

`APayloadPoint` is a C++ subclass of the shared `AControlPoint`. It inherits the full capture, contest, ownership, and decay model, and adds a spline path, a movable platform, and ownership-driven motion. The capture itself is the shared control-point mechanic; the movement is what `APayloadPoint` layers on top. The platform replicates its distance along the spline and a signed velocity rather than raw transforms, and clients smooth toward the replicated position.

<details>

<summary>Verified motion model</summary>

* **Direction and speed** come from `ComputeDesiredVelocity`: if the point is inactive, locked, unowned, or its current scoring policy would block scoring, the payload does not move. Otherwise it moves at the fixed `OwnedMoveSpeed` (default 350 cm/s), signed negative when the owner is `TeamIdAtStart` (toward distance 0) and positive when the owner is `TeamIdAtEnd` (toward the far end). Because the velocity is gated on `ShouldScore`, contesting the cart under its scoring policy stalls it.
* **Server motion** (`Server_UpdateMotion`, on the actor's `TG_PrePhysics` tick) integrates distance along the spline, clamps to the spline length, repositions the platform, and fires the one-shot end event when the payload reaches the matching team's end with enough speed (`EndHitTolerance` 2 cm, `MinEndHitSpeed` 10 cm/s).
* **The platform** is a movable primitive with character step-up enabled; `PlacePlatformAtDistance` writes its world transform and computes its frame velocity so the character movement component treats it as a moving base.
* **Networking** replicates `DistanceOnSpline` and `ServerVelocity`; clients snap on the first replication or on large corrections and otherwise extrapolate and lerp toward the server target.
* **`RestartPayload`** resets end state, optionally neutralizes the owner, unlocks and activates the point, and repositions it to a normalized start distance for a fresh round.

</details>

### The track

The spline route is authored as `B_PayloadSplinePath`, and the placed `B_PayloadControlPoint` carries the path, the platform, the two team-end assignments, and the movement tuning. Because the payload derives from the shared control point, it uses the same `FControlPointSettings` for capture timing and contest behavior.

<details>

<summary>Verified track configuration</summary>

* The placed `B_PayloadControlPoint` defaults: `OwnedMoveSpeed` 350, `TeamIdAtStart` 1, `TeamIdAtEnd` 2, `InitialNormalizedDistance` 0.5.
* Its inherited control-point settings: `TimeToFullCaptureSeconds` 6, `ScoringPolicy` `ScoreWhileOwned`, `ContestResolution` `BlockWhenContested`, `TakeoverRule` `UndoRequired`, and `bStartsActive` true. With `ScoreWhileOwned`, an uncontested owner keeps the cart rolling; the contest rules of the shared capture model are what stall it when an enemy is on board.

</details>

### Bot AI

Bots escort and defend the payload through the shared control-point evaluator, with a behavior tree and an Environment Query that finds positions on the moving platform so AI can ride and contest it.

<details>

<summary>Verified AI assets</summary>

`BT_Lyra_Shooter_Bot_Payload` with the `EQS_FindPayloadPlatform` query and its `EQS_Context_PayloadPlatform` context, on top of the shared `ControlPointWorldEvaluator` priority ladder from ControlPointCore.

</details>

***

## Configuration

The match rule on the `B_Scoring_Payload` component is the clock; the movement tuning lives on the payload actor:

| Property                    | Default | Where                   | Meaning                                     |
| --------------------------- | ------- | ----------------------- | ------------------------------------------- |
| `CountDownTime`             | 900     | `B_Scoring_Payload`     | Match clock in seconds                      |
| `OwnedMoveSpeed`            | 350     | `B_PayloadControlPoint` | Payload speed when owned, cm/s              |
| `TeamIdAtStart`             | 1       | `B_PayloadControlPoint` | Team whose end is spline distance 0         |
| `TeamIdAtEnd`               | 2       | `B_PayloadControlPoint` | Team whose end is the far end of the spline |
| `InitialNormalizedDistance` | 0.5     | `B_PayloadControlPoint` | Starting position along the track, 0..1     |

This mode has no `TargetScore`; the win is positional. The experience `B_Payload` sets the pawn, abilities, and loaded game features; spawning is governed by `B_SpawningRules_Payload`, and `B_ShooterBotSpawner_Payload` fills empty slots with AI.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   └── EQS/
│       └── Context/
├── Experiences/
├── Game/
├── Hero/
├── Input/
│   └── Ability/
├── Maps/
├── Materials/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
```

The scoring component, the payload control point, the spline path, spawning rules, bot spawner, and music manager live under `Game/`; the bot behavior tree and EQS query under `Bot/`; the payload and track art under `Materials/` and `Textures/`; and the scoreboard and objective marker under `UserInterface/`.

***

## C++ classes

* `APayloadPoint` — the payload actor. A subclass of the shared `AControlPoint` that adds a spline path, a movable platform, ownership-driven motion, replicated distance and velocity, and a one-shot end-reached message.

The mode ships no other game-specific C++ beyond the runtime module boilerplate (`PayloadRuntimeModule`).

***

## Extending

* **The motion model** is the `ComputeDesiredVelocity` event on `APayloadPoint`, marked as a Blueprint-overridable native event. Override it for variable speed, acceleration, or a checkpoint-based push instead of the default fixed-speed, ownership-signed motion.
* **Speed, ends, and start position** are the `OwnedMoveSpeed`, `TeamIdAtStart`, `TeamIdAtEnd`, and `InitialNormalizedDistance` properties on the placed payload actor; the track shape is the spline on `B_PayloadSplinePath`.
* **Per-round reset** is `RestartPayload`, which repositions and re-arms the payload; call it from a round handler if you build a multi-round variant.
