# Team Deathmatch

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/TeamDeathmatch/`\
**Dependencies:** ShooterBase, GameplayMaps
{% endhint %}

Two teams fight in a shared arena and score a point for every enemy they eliminate. The first team to reach the elimination target wins immediately; if the match clock runs out first, the team with the higher score wins, and an equal score is a draw. This is the simplest mode in the framework and the best starting point for understanding how a game mode plugin fits together.

***

## How it plays

Players spawn onto one of two teams and fight continuously. There are no objectives to capture and no rounds to reset between. A kill against an enemy adds one point to the killing team's total. Friendly fire never scores. The match ends the moment a team hits the target or the clock expires.

***

## Match flow

The match is driven by the scoring component `B_Scoring_TeamDeathmatch`, a Blueprint child of the C++ `UShooterScoring_Base` that lives on the game state. On the server it steps the match through three game phases and watches for either win condition.

The phase sequence is a brief opening freeze, then open play, then the post-game screen:

{% stepper %}
{% step %}
### Round start freeze

Holds players in place while the experience finishes loading.
{% endstep %}

{% step %}
### Playing

Begins once the freeze phase ends, opening combat and starting the match clock.
{% endstep %}

{% step %}
### Post-game

Starts the moment a win condition is met, ending the match.
{% endstep %}
{% endstepper %}

While the Playing phase is active a one-second repeating timer counts the match clock down. Each elimination is checked immediately against the target score. Whichever condition triggers first calls `HandleVictory`, which announces the winning team and starts the post-game phase.

<details>

<summary>Verified phase and win logic</summary>

`B_Scoring_TeamDeathmatch` event flow, read from the Blueprint graph:

* **BeginPlay (authority only)** waits for the experience to be ready, then starts `Phase_RoundStart_Freeze` with a callback to `FinishRoundStartFreeze`.
* **FinishRoundStartFreeze** registers a listener for the `ShooterGame.GamePhase.Playing.Neutral` phase tag and starts `Phase_Playing`.
* **StartPlaying** starts a repeating one-second timer bound to the `CountDown` event.
* **CountDown** decrements `CountDownTime` by one each tick. When it reaches zero it clears the timer, reads both team scores, and calls `HandleVictory` for the higher-scoring team, or `HandleVictory(0)` on a tie.
* **OnEliminationScored** (override of the base event) fires after every cross-team kill. It checks each team's score against the target and calls `HandleVictory` for any team that has reached it.
* **HandleVictory** activates the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue with the winning team id and starts `Phase_PostGame`.

The phase assets (`Phase_RoundStart_Freeze`, `Phase_Playing`, `Phase_PostGame`) are provided by ShooterBase and shared across modes.

</details>

***

## Scoring

Scoring is handled by the base class rather than anything specific to Team Deathmatch, which is why the mode itself needs so little custom logic. On the server `UShooterScoring_Base` listens for the framework's elimination and assist gameplay messages. When an elimination is between players on different teams, it adds one to the killing team's score and records the individual elimination on the killer's player state. Team score is stored as a gameplay tag stack count on the Team Subsystem, so the running total is the count of the `ShooterGame.Score.Eliminations` tag for each team. The Team Deathmatch component reads that count back when it evaluates a win.

<details>

<summary>Where the score lives</summary>

`UShooterScoring_Base::OnEliminationMessage` adds the `ShooterGame.Score.Eliminations` tag stack to the killer's team via the Team Subsystem, and adds the same tag to the killer's player state for the individual total. Friendly-fire eliminations are ignored for scoring. `GetTeamScore` in the Blueprint reads the team's `ShooterGame.Score.Eliminations` stack count and compares it to `TargetScore` to decide a win.

The base class also provides round utilities the simple modes do not use but objective modes do: `ResetAllActivePlayers` sends a reset gameplay event to every living player, and `CleanupWorldActors` destroys leftover pickups and in-flight projectiles.

</details>

***

## Configuration

The two match rules are properties on the `B_Scoring_TeamDeathmatch` component:

| Property        | Default | Meaning                                   |
| --------------- | ------- | ----------------------------------------- |
| `TargetScore`   | 75      | Eliminations a team needs to win outright |
| `CountDownTime` | 720     | Match length in seconds (twelve minutes)  |

The default pawn, abilities, and which game features load are set in the experience `B_TeamDeathmatch`. Player spawning is governed by `B_SpawningRules_TeamDeathmatch`, and `B_BotSpawner_TeamDeathmatch` fills empty slots with AI.

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

This mode follows the standard folder convention with no additional folders. The win logic, spawning rules, bot spawner, and music manager all live under `Game/`; the scoreboard and score widgets under `UserInterface/`; and the leaderboard ability under `Input/Ability/`.

***

## C++ classes

Team Deathmatch ships no game-specific C++ beyond the runtime module boilerplate (`TeamDeathmatchRuntimeModule`). All of its behavior is Blueprint built on top of ShooterBase's `UShooterScoring_Base`.

***

## Extending

* **New win conditions** belong in a child of `UShooterScoring_Base`. Override `OnEliminationScored` for kill-driven rules, or add a timer for clock-driven rules, the way `B_Scoring_TeamDeathmatch` does for its two.
* **Free-for-all scoring** is the same mode with the team comparison removed; see [Free For All](/broken/pages/22f13a6de9de4cc9db345457aff77e6e994ad484) for the per-player variant.
