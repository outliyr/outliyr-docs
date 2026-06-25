# Capture The Flag

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/CaptureTheFlag/`\
**Dependencies:** ShooterBase, GameplayMaps
{% endhint %}

Two teams each guard a flag at their own base and try to carry the enemy's flag back to score. A flag is picked up by walking into it, carried until the carrier scores or dies, and dropped where the carrier falls. The first team to reach the capture target wins; if the clock runs out first the higher score wins, and a tie is a draw.

***

## How it plays

Each team has a base with a flag standing on it. To score, a player runs into the enemy flag to pick it up, carries it home, and brings it into contact with their own base. Carriers drop the flag on death, leaving it on the ground for anyone to grab. An enemy who touches a dropped friendly flag recovers it. The match is continuous with no rounds.

***

## Match flow

{% stepper %}
{% step %}
### Round start freeze

Round start freeze holds players still while the experience loads, and the component gathers all `B_FlagBase` actors.
{% endstep %}

{% step %}
### Playing

Playing opens combat, starts the match clock, and begins listening for flag captures and recoveries.
{% endstep %}

{% step %}
### Post-game

Post-game starts when a team reaches the capture target or the clock expires.
{% endstep %}
{% endstepper %}

Captures and recoveries arrive as gameplay messages rather than being polled. A capture credits the scoring team and immediately checks the win; a recovery credits the recovering player without ending the match.

<details>

<summary>Verified phase and listener logic</summary>

`B_Scoring_CaptureTheFlag` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, starts `Phase_RoundStart_Freeze` with a `FinishRoundStartFreeze` callback, and stores every `B_FlagBase` actor into `FlagBases`.
* **FinishRoundStartFreeze** listens for `ShooterGame.GamePhase.Playing.Neutral` and starts `Phase_Playing`.
* **StartPlaying** starts the one-second `CountDown` timer and calls `ListenForFlagCapture` and `ListenForFlagRecovery`.
* **ListenForFlagCapture** subscribes to `ShooterGame.Flag.Message.Captured`. On each message it adds `ShooterGame.Score.Flag.Capture` to the capturing player state and their team, then calls `GetTeamScore` and, if the team has reached the target, `HandleVictory`.
* **ListenForFlagRecovery** subscribes to `ShooterGame.Flag.Message.Recovered`. On each message it adds `ShooterGame.Score.Flag.Recovered` to the recovering player and their team. Recovery does not check the win.
* **CountDown** decrements `CountDownTime`; at zero it reads both team capture scores and calls `HandleVictory` for the higher team, or `HandleVictory(0)` on a tie.
* **EndPlay** cancels both message listeners.

The freeze, playing, and post-game phases come from ShooterBase.

</details>

***

## Win conditions

A team wins by reaching the capture target, or by leading on captures when the clock runs out. Recoveries are scored for the leaderboard but never decide the match.

| Winner          | Trigger                                              |
| --------------- | ---------------------------------------------------- |
| First to target | A team's capture count reaches `TargetScore`         |
| Higher at time  | Clock reaches zero; the team with more captures wins |
| Draw            | Clock reaches zero with capture counts equal         |

<details>

<summary>Verified scoring</summary>

`GetTeamScore` reads the team's `ShooterGame.Score.Flag.Capture` tag-stack count on the Team Subsystem and reports a win when it equals `TargetScore`. The clock path compares team 1's and team 2's capture counts directly. `HandleVictory` fires the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue and starts `Phase_PostGame`.

</details>

***

## Key systems

### The flag

The flag is a carried objective built on the C++ `AFlag` (Blueprint `B_Flag`). It tracks its carrier, the carrier's player state, its owning team, and a replicated taken flag, and computes a state of Idle, Taken, or Dropped from those. A player walking into the flag's collision picks it up and attaches it to a socket on the character. The flag binds to the carrier's ability system and drops itself when the carrier's death tag changes, so a kill spills the flag onto the ground. Returning a flag to its own base from the Dropped state resets it to Idle on the base. Every state change broadcasts an `FFlagStateMessage` that the bot AI listens to.

<details>

<summary>Flag actor</summary>

`AFlag` exposes `Initialise`, `DropFlag`, `ResetFlag`, and `AttachFlagToPlayer`, with replicated `Carrier`, `CarrierPlayerState`, `Team`, and `bFlagTaken`. `CalculateFlagState` derives the `EFlagState` (Idle, Taken, Dropped). Pickup runs through `OnSphereCollisionBeginOverlap`; `BindToCarrierASC` and `OnCarrierDeathTagChanged` handle the drop on carrier death. The flag references the `AFlagBase` it came from.

</details>

### The flag base

The base is the C++ `AFlagBase` (Blueprint `B_FlagBase`). It holds its team's flag, the socket flags attach to on carriers, and the point values awarded for capture and recovery. Its sphere overlap is what detects a flag arriving home, and it owns the methods that award capture and recovery points and reset its own flag. A base can be configured to allow scoring even when its own flag is not currently home.

<details>

<summary>Flag base actor and tunables</summary>

`AFlagBase` exposes `ResetFlag`, `AwardPointsForCapturingFlag`, and `AwardPointsForRecoveringFlag`, which broadcast `FFlagCapturedMessage` and `FFlagRecoveredMessage`. Per-base properties:

| Property                         | Default | Meaning                                                        |
| -------------------------------- | ------- | -------------------------------------------------------------- |
| `PointsAwardedForCapturingFlag`  | 100     | Individual points to the enemy who captures this flag          |
| `PointsAwardedForRecoveringFlag` | 100     | Individual points to the ally who recovers this flag           |
| `TeamPointsAwarded`              | 1       | Team capture points awarded when this flag is captured         |
| `bAllowPointsIfFlagNotInBase`    | false   | Whether captures still score when this base's own flag is away |
| `AttachSocket`                   | (none)  | Character socket the flag attaches to when carried             |

`FlagClass` and `Team` configure which flag the base spawns and which side it belongs to.

</details>

### Bot AI

Bots understand the flag situation rather than just fighting. A StateTree evaluator keeps a cached snapshot of every flag and base in the level and publishes a single best goal for the bot each refresh, so an AI team will steal, escort its carrier, intercept an enemy carrier, or recover a dropped flag. It reacts to flag state messages between refreshes instead of scanning actors every tick.

<details>

<summary>AI assets</summary>

`FCTFWorldEvaluator` (displayed as "Eval: Capture The Flag World State") maintains the snapshot table and selects one `ECTFGoal` from Idle, Intercept, Recover, Steal, ReturnHome, or EscortCarrier. Tunables on its instance data bias the choice: `InterceptNearTheirBaseBonus`, `EscortGateChance`, `EscortNearbyFlagRadius`, `MaxChaseDistanceSq`, `SuppressNearBaseRadius`, and `SoftRefreshIntervalSeconds`. The behavior runs through `BT_Lyra_Shooter_Bot_CaptureTheFlag`, the state trees `ST_CaptureTheFlag` and `ST_CTFShooter`, and the `BTS_FindFlagObjective` service.

</details>

***

## Configuration

The match rules are properties on the `B_Scoring_CaptureTheFlag` component; the point values are per flag base:

| Property                         | Where                      | Default | Meaning                                    |
| -------------------------------- | -------------------------- | ------- | ------------------------------------------ |
| `TargetScore`                    | `B_Scoring_CaptureTheFlag` | 5       | Captures a team needs to win               |
| `CountDownTime`                  | `B_Scoring_CaptureTheFlag` | 720     | Match length in seconds (twelve minutes)   |
| `TeamPointsAwarded`              | `B_FlagBase`               | 1       | Team score per capture of that base's flag |
| `PointsAwardedForCapturingFlag`  | `B_FlagBase`               | 100     | Individual capture points                  |
| `PointsAwardedForRecoveringFlag` | `B_FlagBase`               | 100     | Individual recovery points                 |

Flag bases are placed in the level as `B_FlagBase` actors and the scoring component finds them all at startup. Per-team spawning is governed by `B_TeamSpawningRules_CaptureTheFlag`.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Services/
│   └── StateTree/
├── Experiences/
├── Game/
├── Hero/
├── Input/
│   └── Ability/
├── Maps/
├── Meshes/
├── System/
│   └── Playlists/
├── Texture/
└── UserInterface/
```

The scoring component and the flag and flag-base Blueprints live under `Game/`; the bot behavior trees, services, and state trees under `Bot/`; and the flag and base art under `Meshes/` and `Texture/`.

***

## C++ classes

* `AFlag` — the carried flag, with pickup, attach, drop on carrier death, and replicated carry state.
* `AFlagBase` — the base that holds a team's flag, detects a flag arriving home, and awards capture and recovery points.
* `FCTFWorldEvaluator` — the StateTree evaluator that snapshots every flag and base and publishes the bot's current goal.

***

## Extending

* **Scoring rules** such as awarding bonus points for capturing while your own flag is out are toggled with `bAllowPointsIfFlagNotInBase` on each base, and the point values are per-base properties rather than scoring-component constants.
* **New carrier rules** (a speed penalty while carrying, or a forced drop after a timer) belong on `AFlag`, which already owns the carrier binding and the drop path through the carrier's ability system.
* **New bot goals** are added to the `ECTFGoal` set and the evaluator's goal selection, which is the single place each bot's objective is decided.
