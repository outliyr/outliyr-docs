# Infection

**Plugin:** `Plugins/GameFeatures/Infection/`\
**Dependencies:** ShooterBase, GameplayMaps

An asymmetric mode where a small team of infected players tries to convert all survivors. Killed survivors join the infected team.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Decorator/
│   ├── EQS/
│   ├── Service/
│   ├── StateTree/
│   └── Task/
├── Experiences/
│   └── Phases/
├── Game/
├── Hero/
│   ├── Infected/
│   └── Survivor/
├── Input/
│   ├── Ability/
│   ├── Actions/
│   └── Mapping/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
```

***

### Notable Systems

* **Asymmetric Teams** — Separate hero setups for Infected and Survivor roles in `Hero/`
* **Team Setup** — Custom team assignment logic for the infection mechanic
* **Bot AI** — Extensive AI with behavior trees, decorators, EQS, services, state trees, and custom tasks for role-specific behavior
* **Experience Phases** — Gameplay abilities that manage game mode state transitions and rule changes. Example: the first infection.

### C++ Classes

* `TeamSetup_Infection` — Custom team assignment and conversion logic
