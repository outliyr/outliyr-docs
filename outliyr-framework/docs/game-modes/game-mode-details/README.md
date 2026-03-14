# Game Mode Details

This section covers each included game mode and its plugin structure.

***

### Common Plugin Structure

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

### Shared Infrastructure

Some game modes share common functionality through infrastructure plugins:

* **ControlPointCore** — Shared control point logic (capture mechanics, control point related bot tasks, VFX) used by Domination, Hardpoint, Headquarters, and Payload
* **ShooterBase** — The core combat framework that all game modes depend on for weapons, abilities, scoring, spawning, and more
* **GameplayMaps** — Shared map infrastructure and the Compound Blockout System for level design, used by all game modes
* **TetrisInventory** — Spatial grid-based inventory system used by Arena, Battle Royale, and Extraction

***

### C++ vs Blueprint

Most game modes are primarily Blueprint-driven, with a minimal C++ runtime module. More complex modes add dedicated C++ classes for systems that benefit from native performance or require engine-level integration (e.g., Arena's economy manager, Battle Royale's drop plane, Search & Destroy's bomb system).
