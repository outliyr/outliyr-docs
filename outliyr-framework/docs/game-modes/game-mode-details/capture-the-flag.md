# Capture The Flag

**Plugin:** `Plugins/GameFeatures/CaptureTheFlag/`\
**Dependencies:** ShooterBase, GameplayMaps

A classic objective mode where teams attempt to steal the enemy's flag and return it to their base.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
│   ├── BT/
│   ├── Services/
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
├── Texture/
└── UserInterface/
```

***

### Notable Systems

* **Bot AI** — Behavior trees, services, and state trees for AI flag capture/defense behavior
* **Flag & Flag Base** — Dedicated actors for the flag pickup and base return zones
* **Custom Meshes/Textures** — Mode-specific art assets for flags and bases

### C++ Classes

* `Flag` — The flag actor that can be picked up and carried
* `FlagBase` — The base where flags are returned
* `CTF_WorldEvaluator` — AI world evaluation for bot decision-making
