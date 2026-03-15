# Headquarters

**Plugin:** `Plugins/GameFeatures/Headquarters/`\
**Dependencies:** ShooterBase, GameplayMaps, ControlPointCore

A hybrid objective mode where teams compete to capture a headquarters location. The capturing team must then defend it while the opposing team tries to destroy it. Features unique respawn rules. Uses shared control point infrastructure from `ControlPointCore`.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Decorator/
│   └── Service/
├── Experiences/
│   └── Phase/
├── Game/
├── GameplayCues/
├── Hero/
├── Input/
│   └── Ability/
├── Maps/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
```

***

### Notable Systems

* **Advanced Respawn Logic** — Custom respawn rules based on HQ capture state
* **Bot AI** — Behavior trees with custom decorators and services for HQ-specific behavior
* **ControlPointCore** — Inherits shared capture mechanics, VFX, and UI from the ControlPointCore plugin
* **Experience Phases** — Gameplay abilities that manage game mode state transitions and rule changes. Example: after a control point is captured, the game enters a defence phase where the capturing team cannot respawn while the opposing team attempts to neutralize the point within a timed window.

### C++ Classes

Minimal — only the runtime module boilerplate (`HeadquartersRuntimeModule`). Core control point logic lives in ControlPointCore.
