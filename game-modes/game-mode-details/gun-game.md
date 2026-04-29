# Gun Game

**Plugin:** `Plugins/GameFeatures/GunGame/`\
**Dependencies:** ShooterBase, GameplayMaps

A progression-based mode where players advance through a sequence of weapons with each kill. The first player to get a kill with every weapon wins.

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

This mode follows the standard folder convention with no additional folders. Weapon progression is driven by the game `GA_AdvanceWeapon` in `Inputs/Ability`.

***

### C++ Classes

Minimal — only the runtime module boilerplate (`GunGameRuntimeModule`).
