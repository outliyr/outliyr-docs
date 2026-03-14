# Search And Destroy

**Plugin:** `Plugins/GameFeatures/SearchAndDestroy/`\
**Dependencies:** ShooterBase, GameplayMaps

A round-based elimination mode where one team plants a bomb at designated sites while the other team defends. No respawns within rounds.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Services/
│   ├── StateTree/
│   └── Tasks/
├── Experiences/
│   └── Phase/
├── Game/
│   ├── Death/
│   └── Objectives/
├── GameplayCues/
├── Hero/
├── Input/
│   ├── Ability/
│   └── Actions/
├── Maps/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
```

***

### Notable Systems

* **Bomb System** — Bomb planting, defusing, and detonation logic
* **Bomb Sites** — Designated plant locations with associated spawners
* **Bot AI** — Extensive AI setup with behavior trees, services, state trees, and custom tasks for bomb-related decision making
* **Objectives** — Objective tracking in `Game/Objectives/`
* **Experience Phases** — Round-based phase flow

### C++ Classes

* `Bomb` — The bomb actor with plant/defuse/detonate logic
* `BombSite` — Bomb site actor marking valid plant locations
* `BombSpawner` — Handles bomb spawning at round start
* `SnD_BotTasks` — Custom bot tasks for bomb interactions
* `SnD_WorldEvaluator` — AI world evaluation for attack/defend decisions
