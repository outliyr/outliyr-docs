# Kill confirmed

**Plugin:** `Plugins/GameFeatures/KillConfirmed/`\
**Dependencies:** ShooterBase, GameplayMaps

A team deathmatch variant where kills only count when a teammate picks up the dog tag dropped by the eliminated player. Enemy tags can be denied by the opposing team.

***

### Content Structure

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

***

### Notable Systems

* **Dog Tags** — Dropped on death, must be collected to confirm or deny kills
* **Bot AI** — Behavior trees, EQS queries with custom contexts, and state trees for AI tag collection
* **Custom Meshes/Textures** — Art assets for dog tag pickups

### C++ Classes

* `KillConfirmTag` — The dog tag actor dropped on death
* `KillConfirmBotTasks` — Custom bot tasks for tag collection behavior
* `KillConfirmWorldEvaluator` — AI world evaluation for tag prioritization
