# Team Deathmatch

**Plugin:** `Plugins/GameFeatures/TeamDeathmatch/`\
**Dependencies:** ShooterBase, GameplayMaps

A straightforward two-team deathmatch mode. This is one of the simplest game modes in the framework and serves as a good reference for how a minimal game mode plugin is structured.

***

### Content Structure

```
Content/
├── Accolades/
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

This mode follows the standard folder convention with no additional folders.

***

### C++ Classes

Minimal — only the runtime module boilerplate (`TeamDeathmatchRuntimeModule`).
