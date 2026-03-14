# Domination

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/Domination/`\
**Dependencies:** ShooterBase, GameplayMaps, ControlPointCore
{% endhint %}

## Domination

A territory control mode where teams compete to capture and hold multiple control points simultaneously. Uses shared control point infrastructure from ControlPointCore.

***

#### Content Structure

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

#### Notable Systems

* **Bot AI** — Behavior trees and services for AI-driven point capture behavior
* **ControlPointCore** — Inherits shared capture mechanics, VFX, and UI from the ControlPointCore plugin

#### C++ Classes

Minimal — only the runtime module boilerplate (`DominationRuntimeModule`). Core control point logic lives in ControlPointCore.
