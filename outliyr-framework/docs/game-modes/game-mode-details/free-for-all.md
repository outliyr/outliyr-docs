# Free for all

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/FreeForAll/`\
**Dependencies:** ShooterBase, GameplayMaps
{% endhint %}

Every player fights for themselves in a shared arena and scores a point for every player they eliminate. The first player to reach the elimination target wins immediately; if the match clock runs out first, the player with the highest score wins. This is Team Deathmatch with the team comparison removed, and the simplest place to see how the framework handles a mode with no shared sides.

***

## How it plays

Players spawn individually with no allies. Every other player is a valid target, and each elimination adds one point to the killer's personal total. There are no objectives and no rounds. The match ends the moment one player hits the target or the clock expires.

***

## Match flow

The match is driven by the scoring component `B_Scoring_FreeForAll`, a Blueprint child of the C++ `UShooterScoring_Base` on the game state. On the server it steps the match through the same three game phases the simple modes share, then watches for either win condition.

The phase sequence is a brief opening freeze, then open play, then the post-game screen:

1. **Round start freeze** holds players in place while the experience finishes loading.
2. **Playing** begins once the freeze ends, opening combat and starting the match clock.
3. **Post-game** starts the moment a win condition is met, ending the match.

While the Playing phase is active a one-second repeating timer counts the match clock down. Each elimination is checked immediately against the target. Whichever condition triggers first calls `HandleVictory`, which announces the winner and starts the post-game phase.

<details>

<summary>Verified phase and win logic</summary>

`B_Scoring_FreeForAll` event flow, read from the Blueprint graph:

* **BeginPlay (authority only)** waits for the experience to be ready, then starts `Phase_RoundStart_Freeze` with a callback to `FinishRoundStartFreeze`.
* **FinishRoundStartFreeze** registers a listener for the `ShooterGame.GamePhase.Playing.Neutral` phase tag and starts `Phase_Playing`.
* **StartPlaying** starts a repeating one-second timer bound to the `CountDown` event.
* **CountDown** decrements `CountDownTime` by one each tick. When it reaches zero it clears the timer and calls `HandleVictory` for the player whose team id is held in `HighestScoreTeamID`.
* **OnEliminationScored** (override of the base event) fires after every elimination between different teams. It loops every team id from 1 to 16, reads each one's score, ends the match for any player that has reached the target, and otherwise tracks the running highest score and its team id.
* **HandleVictory** activates the `GameplayCue.ShooterGame.UserMessage.MatchDecided` cue with the winning team id and starts `Phase_PostGame`.

The phase assets (`Phase_RoundStart_Freeze`, `Phase_Playing`, `Phase_PostGame`) are provided by ShooterBase and shared across modes.

</details>

***

## Win conditions

A player wins by reaching the target score in eliminations, or by holding the highest score when the clock runs out. Both routes call `HandleVictory` with the winning player's team id.

| Winner          | Trigger                                                        |
| --------------- | -------------------------------------------------------------- |
| First to target | Any player's elimination total reaches `TargetScore`           |
| Highest at time | Clock reaches zero; the player with the most eliminations wins |

<details>

<summary>Why this reads as "teams" in the code</summary>

Free For All reuses the team-based scoring machinery by giving every player their own team id. Scores are still stored as the `ShooterGame.Score.Eliminations` tag stack on the Team Subsystem, one count per player. `GetTeamScore` reads a given team id's elimination count and reports a win when it equals `TargetScore`. The elimination loop in `OnEliminationScored` walks team ids 1 through 16 so it covers every solo player. The clock-based path picks the highest score tracked during that loop rather than comparing two fixed teams, which is the only structural difference from Team Deathmatch.

</details>

***

## Key systems

Scoring is handled entirely by the base class. On the server `UShooterScoring_Base` listens for the framework's elimination and assist gameplay messages, adds one to the killer's `ShooterGame.Score.Eliminations` stack, and records the individual elimination on the killer's player state. Because each player is their own team, the per-player total is simply that player's team tag-stack count. The Free For All component reads those counts back when it evaluates a win.

<details>

<summary>Where the score lives</summary>

`UShooterScoring_Base::OnEliminationMessage` adds the `ShooterGame.Score.Eliminations` tag stack to the killer's team via the Team Subsystem and to the killer's player state for the individual total. `GetTeamScore` in the Blueprint reads that stack count for a team id and compares it to `TargetScore`.

</details>

***

## Configuration

The two match rules are properties on the `B_Scoring_FreeForAll` component:

| Property        | Default | Meaning                                     |
| --------------- | ------- | ------------------------------------------- |
| `TargetScore`   | 15      | Eliminations a player needs to win outright |
| `CountDownTime` | 720     | Match length in seconds (twelve minutes)    |

The default pawn, abilities, and which game features load are set in the experience `B_FreeForAll`. Per-player team assignment is handled by `B_TeamSetup_FreeForAll`, and `B_BotSpawner_FreeForAll` fills empty slots with AI.

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

This mode follows the standard folder convention with no additional folders. The win logic, team setup, bot spawner, and music manager live under `Game/`; the scoreboard and score widgets under `UserInterface/`; and the leaderboard ability under `Input/Ability/`.

***

## C++ classes

Free For All ships no game-specific C++ beyond the runtime module boilerplate (`FreeForAllRuntimeModule`). All of its behavior is Blueprint built on top of ShooterBase's `UShooterScoring_Base`.

***

## Extending

* **Score weighting** (for example bonus points for a streak) belongs in a child of `UShooterScoring_Base` that overrides `OnEliminationScored`, since that is where each kill is already evaluated against the target.
* **Team variants** are the same mode with shared team ids instead of one per player; see [Team Deathmatch](team-deathmatch.md) for the two-team comparison.
