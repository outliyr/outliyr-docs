# Game Mode Details

This section covers each included game mode: how it plays, how a match flows, what its signature systems do, and where to configure and extend it. Every mode is a Game Feature plugin under `Plugins/GameFeatures/`, and they all build on a small set of shared systems described below.

***

## Modes at a glance

| Mode                                        | Teams                        | Objective                                        | Win condition                                                                       |
| ------------------------------------------- | ---------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [Team Deathmatch](team-deathmatch.md)       | Two                          | Eliminate the enemy team                         | First to 75 eliminations, or the lead when the clock ends                           |
| [Free For All](free-for-all.md)             | Solo                         | Eliminate everyone                               | First to 15 eliminations, or the lead when the clock ends                           |
| [Gun Game](gun-game.md)                     | Solo                         | Advance a weapon ladder, one rung per kill       | First to 15 eliminations                                                            |
| [Domination](domination.md)                 | Two                          | Hold the majority of several control points      | First to 125 points                                                                 |
| [Hardpoint](hardpoint.md)                   | Two                          | Hold the single active point as it rotates       | First to 150, or the lead when the clock ends                                       |
| [Headquarters](headquarters.md)             | Two                          | Capture and defend the active headquarters       | First to 150                                                                        |
| [Payload](payload.md)                       | Two                          | Escort the cart to the enemy end                 | Reach the end, or be furthest along when the clock ends                             |
| [Capture The Flag](capture-the-flag.md)     | Two                          | Carry the enemy flag back to your base           | First to 5 captures, or the lead when the clock ends                                |
| [Kill Confirmed](kill-confirmed.md)         | Two                          | Collect dog tags dropped by kills                | First to 50 confirms, or the lead when the clock ends                               |
| [Search And Destroy](search-and-destroy.md) | Two, round-based, no respawn | Plant and detonate, or defend and defuse, a bomb | First to 3 round wins, sides swap each round                                        |
| [Infection](infection.md)                   | Asymmetric                   | Survive, or convert the survivors                | Survivors win if any live to the outbreak timer; infected win by converting all     |
| [Prop Hunt](prop-hunt.md)                   | Asymmetric, round-based      | Hide as props, or hunt them down                 | Props win if one survives the hunt; hunters win by clearing them; first to 3 rounds |
| [Arena](arena.md)                           | Two, round-based             | Buy gear, pick a hero, win the round             | First to 4 round wins, sides swap each round                                        |
| [Battle Royale](battle-royale.md)           | Solo or teams                | Loot up and survive the shrinking zone           | Last player or team standing                                                        |
| [Extraction](extraction.md)                 | Per-player                   | Raid for loot and reach an extraction zone       | Individual: extracting saves your loadout, dying loses the run                      |

***

## Shared systems every mode builds on

Most of a mode's behavior comes from systems it shares with the others, so understanding these once explains the bulk of every mode. The per-mode pages assume this foundation and only document what each mode adds on top.

* **Scoring component.** Each mode's win logic is a Blueprint child of the C++ `UShooterScoring_Base`, a game-state component. The base listens on the server for elimination and assist gameplay messages and records scores as gameplay tag-stack counts: team totals on the Team Subsystem, individual stats on the player state. Subclasses override `OnEliminationScored` and add their own events for the mode's specific rules, then call `HandleVictory` (or a per-round equivalent) to end the match. See [GameState Scoring System](../../core-modules/shooter-base/gamestate-scoring-system/).
* **Game phases.** Match flow is driven by the Game Phase subsystem. The shared phases (round-start freeze, playing, round-end, switch-sides, post-game) live in `ShooterBase`, and a scoring component advances through them and reacts when each begins or ends. Round-based modes loop these phases; continuous modes pass through them once. See [Game Phase System](../../base-lyra-modified/game-phase-system/).
* **Control points.** Domination, Hardpoint, Headquarters, and Payload share the `AControlPoint` actor from `ControlPointCore`, which manages capture progress, contest, ownership, and decay on its own and broadcasts gameplay messages. Its behavior is tuned per placed instance through `FControlPointSettings` (capture time, scoring policy, contest resolution, activation), so the same actor produces a Domination point, a rotating hardpoint, or a moving payload depending on its settings.
* **Loot and pickups.** Battle Royale and Extraction scatter ground loot with `B_ItemZoneSpawner` from `TetrisInventory`, which fills a spline-defined area with rarity-weighted items at match start. Every pickup, whether scattered, hand-placed, or dropped from a death box, is a world collectable collected through a `UPickupInteractionProfile` data asset that grants a `ULyraGameplayAbility_FromPickup`; that ability's routing policy decides whether a collected item is held, stored, or auto-equipped.
* **Bots.** Modes with AI share `ShooterBase's` shooter-bot framework and add mode-specific tasks and evaluators (objective tasks for Search & Destroy, the control-point evaluator for the point modes, role behavior for the asymmetric modes).

***

## Common plugin structure

All game mode plugins follow a consistent directory convention inside their `Content/` folder:

| Folder              | Purpose                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Accolades/`        | Mode-specific accolades and accomplishments                                                                                                           |
| `Experiences/`      | Experience definitions that tie everything together. May contain `Phases/` for multi-phase game flow                                                  |
| `Game/`             | Mode-specific gameplay logic (scoring, death handling, objectives, spectating, etc.)                                                                  |
| `Hero/`             | Character and pawn definitions. Asymmetric modes may have subfolders per role (e.g., `Hunter/`, `Prop/`)                                              |
| `Input/`            | Input configuration, typically with an `Ability/` subfolder for input-bound gameplay abilities. Complex modes also include `Actions/` and `Mappings/` |
| `Maps/`             | Maps designed for this game mode                                                                                                                      |
| `System/Playlists/` | Playlist configurations                                                                                                                               |
| `UserInterface/`    | HUD elements, scoreboards, and mode-specific UI widgets                                                                                               |

Some modes include additional folders depending on their complexity:

| Folder                               | When Present                                                                |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `Bot/`                               | Modes with AI behavior (behavior trees, EQS queries, services, state trees) |
| `Items/`                             | Modes with item/loot systems (Battle Royale, Extraction, Arena)             |
| `GameplayCues/`                      | Modes with custom visual/audio feedback                                     |
| `GameplayEffects/`                   | Modes with custom Gameplay Ability System effects                           |
| `Effects/`                           | Custom materials, particles, or VFX                                         |
| `Camera/`                            | Custom camera configurations                                                |
| `Meshes/`, `Textures/`, `Materials/` | Mode-specific art assets                                                    |

***

## Shared infrastructure

Some game modes share common functionality through infrastructure plugins:

* **ControlPointCore** — Shared control point logic (capture mechanics, control point related bot tasks, VFX) used by Domination, Hardpoint, Headquarters, and Payload
* [**ShooterBase**](../../core-modules/shooter-base/) — The core combat framework that all game modes depend on for weapons, abilities, scoring, spawning, and more
* [**GameplayMaps**](../../core-modules/gameplay-maps/) — Shared map infrastructure and the [Compound Blockout System](../../core-modules/gameplay-maps/compound-blockout-system/) for level design, used by all game modes
* [**TetrisInventory**](../../core-modules/tetris-inventory/) — Spatial grid-based inventory system, and the zone loot spawner, used by Arena, Battle Royale, and Extraction

***

## C++ vs Blueprint

Most game modes are primarily Blueprint-driven, with a minimal C++ runtime module. More complex modes add dedicated C++ classes for systems that benefit from native performance or require engine-level integration (e.g., Arena's economy manager, Battle Royale's drop plane, Search & Destroy's bomb system).
