# Kill confirmed

> [!INFO]
> **Plugin:** `Plugins/GameFeatures/KillConfirmed/`\
> **Dependencies:** ShooterBase, GameplayMaps

A two-team mode where a kill only counts once the dog tag dropped by the eliminated player is collected. The killing team confirms a kill by picking the tag up; the victim's team can deny it by reaching their own tag first. The first team to confirm the target number of kills wins, and if the clock runs out the team with more confirmed kills wins, with a tie a draw.

***

## How it plays

Every elimination drops a dog tag on the body. The tag carries the team of the player who died. Walking over a tag resolves it instantly: if the collector is on the enemy team of the dead player (the killing side) the kill is confirmed and counts toward the win; if the collector is a teammate of the dead player the kill is denied and the enemy gets nothing for it. Tags vanish the moment they are touched, so a confirm and a deny are a race to the body.

***

## Match flow

The flow is driven by the scoring component `B_Scoring_KillConfirmed`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. It runs the standard freeze, play, post-game chain while listening for tags being dropped and tags being collected.

1. **Round start freeze** holds players still while the experience loads.
2. **Playing** opens combat, starts the match clock, and begins listening for new tags and tag collisions.
3. **Post-game** starts when a team reaches the confirm target or the clock expires.

Dropped tags and collected tags both arrive as gameplay messages. The component tracks the live set of tags for the bots and resolves each collection through `HandleDogTagCollision`.

<details class="gb-toggle">

<summary>Verified phase and listener logic</summary>

`B_Scoring_KillConfirmed` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience and starts `Phase_RoundStart_Freeze` with a `FinishRoundStartFreeze` callback.
* **FinishRoundStartFreeze** listens for `ShooterGame.GamePhase.Playing.Neutral` and starts `Phase_Playing`.
* **StartPlaying** starts the one-second `CountDown` timer and calls `ListenForNewDogTags` and `ListenForDogTagCollision`.
* **ListenForNewDogTags** subscribes to `ShooterGame.KillTag.Discover` and adds each newly dropped tag to the tracked `DogTags` list.
* **ListenForDogTagCollision** subscribes to `ShooterGame.KillTag.Captured.Message` and routes each collected tag through `HandleDogTagCollision`.
* **CountDown** decrements `CountDownTime`; at zero it reads both team confirm scores and calls `HandleVictory` for the higher team, or `HandleVictory(0)` on a tie.
* **EndPlay** cancels both listeners.

The freeze, playing, and post-game phases come from ShooterBase.

</details>

***

## Win conditions

A team wins by confirming the target number of kills, or by leading on confirmed kills when the clock expires. Denied tags score a separate stat that never decides the match.

| Winner          | Trigger                                              |
| --------------- | ---------------------------------------------------- |
| First to target | A team's confirmed-kill count reaches `TargetScore`  |
| Higher at time  | Clock reaches zero; the team with more confirms wins |
| Draw            | Clock reaches zero with confirm counts equal         |

<details class="gb-toggle">

<summary>Verified confirm, deny, and scoring</summary>

The dog tag is spawned on death by `B_Hero_KillConfirmed`. Its `SpawnDogTag` function initializes the tag with the dying player's own team id, so the tag's `TeamOwned` is the victim's team.

`HandleDogTagCollision` resolves a collected tag by comparing the collector's team to the tag's `TeamOwned`:

* **Confirm** — collector's team differs from `TeamOwned` (the collector is an enemy of the dead player, that is, the killing side). It adds `ShooterGame.Score.TagCapture.Enemy` to the collector and their team, then checks the win.
* **Deny** — collector's team equals `TeamOwned` (the collector is a teammate of the dead player). It adds `ShooterGame.Score.TagCapture.Ally` to the collector and their team and does not check the win.

`GetTeamScore` reads the team's `ShooterGame.Score.TagCapture.Enemy` count and reports a win at `TargetScore`. Either way the tag is removed from the tracked list and destroyed. `HandleVictory` fires the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue and starts `Phase_PostGame`.

</details>

***

## Key systems

### The dog tag

The dog tag is the C++ `AKillConfirmTag` (Blueprint `B_KillConfirmTag`). It is spawned at the victim's location on death, initialized with the victim's team, and replicated. When its team replicates it broadcasts a discover message so the scoring component and bots learn it exists. A sphere overlap detects a player reaching it; on the server the tag works out whether the collector is confirming or denying, broadcasts a captured message, and sends a client cue to the collector so they hear the right confirm or deny sound. A guard flag stops the same tag resolving twice, and the tag ignores the dead player it spawned from.

<details class="gb-toggle">

<summary>Dog tag actor</summary>

`AKillConfirmTag` replicates `TeamOwned` and exposes `Initialize(int32 Team)`. `OnRep_TeamOwned` broadcasts `ShooterGame.KillTag.Discover` with an `FKillConfirmedTagDiscovered`. `OnSphereCollisionBeginOverlap` ignores the instigator, sets a one-shot `bCollided` guard, computes `PawnTeamId != TeamOwned` to flag an enemy tag, calls `Client_HandleTagCollision` for the local confirm or deny sound, and broadcasts `ShooterGame.KillTag.Captured.Message` with an `FKillConfirmedTagCaptured`. `CollisionRadius` sets the pickup sphere size.

</details>

### Bot AI

Bots chase tags as a first-class objective. A StateTree evaluator keeps a live set of every tag in the world and publishes the single best tag for the bot to pursue, classifying it as a confirm or a deny so the bot knows whether it is scoring or stopping the enemy from scoring. It reacts to spawn and capture messages so its view stays current without polling.

<details class="gb-toggle">

<summary>AI assets</summary>

`FKillConfirmedEvaluator` (displayed as "Eval: Kill Confirmed Tags") maintains the tag set and writes out the closest in-range tag, its location, and an `EKillConfirmTagType` of None, Confirm, or Deny. Tunables on its instance data are `MaxSearchRadius`, `SoftRefreshInterval`, and `CombatResistanceRadius`. The behavior runs through `BT_Lyra_Shooter_Bot_KillConfirmed`, the state trees `ST_KillConfirmed` and `ST_KillConfirmedShooter`, and the EQS query `EQS_FindDogTags` with its `EQS_Context_DogTags` context.

</details>

***

## Configuration

The match rules are properties on the `B_Scoring_KillConfirmed` component; the tag size is on the dog tag:

| Property          | Where                     | Default | Meaning                                  |
| ----------------- | ------------------------- | ------- | ---------------------------------------- |
| `TargetScore`     | `B_Scoring_KillConfirmed` | 50      | Confirmed kills a team needs to win      |
| `CountDownTime`   | `B_Scoring_KillConfirmed` | 720     | Match length in seconds (twelve minutes) |
| `CollisionRadius` | `B_KillConfirmTag`        | 1       | Pickup sphere radius of the dog tag      |

The dog tag is spawned on death by `B_Hero_KillConfirmed`. Per-player spawning is governed by `B_SpawningRules_KillConfirmed`, and `B_ShooterBotSpawner_KillConfirmed` fills empty slots with AI.

***

## Content structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── EQS/
│   │   └── Context/
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
├── Textures/
└── UserInterface/
```

The scoring component and the dog tag Blueprint live under `Game/`; the death-time tag spawn under `Hero/`; the bot behavior tree, EQS query, and state trees under `Bot/`; and the dog tag art under `Meshes/` and `Textures/`.

***

## C++ classes

* `AKillConfirmTag` — the dropped dog tag, which classifies its collector as a confirm or a deny and broadcasts the result.
* `FKillConfirmedEvaluator` — the StateTree evaluator that tracks every tag and publishes the bot's best confirm or deny target.

***

## Extending

* **Scoring weight** (for example a small reward for denies, or a streak bonus for confirms) belongs in `HandleDogTagCollision`, which is the single place a collected tag is classified and credited.
* **Tag lifetime** such as tags expiring after a few seconds would be added on `AKillConfirmTag`, which already owns the tag's spawn, discover broadcast, and destruction.
* **Collection rules** like a hold-to-confirm cast instead of an instant pickup would replace the tag's overlap resolve, since `OnSphereCollisionBeginOverlap` is where a touch currently becomes a confirm or deny.
