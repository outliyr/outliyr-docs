# Prop Hunt

**Plugin:** `Plugins/GameFeatures/PropHunt/`\
**Dependencies:** ShooterBase, GameplayMaps

An asymmetric hide-and-seek mode where one team disguises as props (objects in the environment) while the other team hunts them down.

***

### Content Structure

```
Content/
├── Camera/
├── Experiences/
├── Game/
│   ├── Death/
│   ├── Items/
│   │   └── Rifle/
│   └── Props/
├── GameplayCues/
├── Hero/
│   ├── Hunter/
│   └── Prop/
├── Input/
│   ├── Abilities/
│   ├── Actions/
│   └── Mappings/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
```

***

### Notable Systems

* **Asymmetric Teams** — Separate hero setups for Hunter and Prop roles in `Hero/`
* **Prop System** — Prop disguise and transformation logic in `Game/Props/`
* **Custom Camera** — Mode-specific camera for the prop perspective
* **Role-Specific Input** — Separate abilities, actions, and mappings for each role
* **Hunter Items** — Hunter-specific weapon setup in `Game/Items/`

### C++ Classes

Minimal — only the runtime module boilerplate (`PropHuntRuntimeModule`). Prop mechanics are Blueprint-driven.
