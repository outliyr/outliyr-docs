# Payload

**Plugin:** `Plugins/GameFeatures/Payload/`\
**Dependencies:** ShooterBase, GameplayMaps, ControlPointCore

A symmetric objective mode where one team pushes a payload along a track to their goal while the other team tries to push it to their goal. Uses shared control point infrastructure from `ControlPointCore`.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   └── EQS/
│       └── Context/
├── Experiences/
├── Game/
├── Hero/
├── Input/
│   └── Ability/
├── Maps/
├── Materials/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
```

***

### Notable Systems

* **Payload Point** — The movable payload actor that advances along a path
* **Bot AI** — Behavior trees and EQS queries for AI escort/defense behavior
* **ControlPointCore** — Inherits shared capture/contest mechanics from the ControlPointCore plugin
* **Custom Materials/Textures** — Art assets for the payload and track

### C++ Classes

* `PayloadPoint` — The payload actor with movement and contest logic
