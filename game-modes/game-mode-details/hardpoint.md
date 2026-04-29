# Hardpoint

**Plugin:** `Plugins/GameFeatures/Hardpoint/`\
**Dependencies:** ShooterBase, GameplayMaps, ControlPointCore

A rotating objective mode where teams compete to hold a single control point that moves to a new location on a timer. Uses shared control point infrastructure from `ControlPointCore`.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   └── Service/
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

***

### Notable Systems

* **Bot AI** — Behavior trees and services for AI-driven point capture and rotation behavior
* **ControlPointCore** — Inherits shared capture mechanics, VFX, and UI from the ControlPointCore plugin

### C++ Classes

Minimal — only the runtime module boilerplate (`HardpointRuntimeModule`). Core control point logic lives in ControlPointCore.
