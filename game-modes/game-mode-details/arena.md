# Arena

**Plugin:** `Plugins/GameFeatures/Arena/`\
**Dependencies:** ShooterBase, TetrisInventory, GameplayMaps

A round-based competitive mode featuring character selection and a buy menu economy system. Players choose from distinct heroes and purchase equipment between rounds.

***

### Content Structure

```
Content/
├── Accolades/
├── Effects/
│   └── Material/
├── Experiences/
│   └── Phases/
├── Game/
│   ├── BuyPhase/
│   ├── Death/
│   └── KillCam/
├── GameplayCues/
├── Hero/
│   ├── Hero1/
│   ├── Hero2/
│   └── Hero3/
├── Input/
│   ├── Ability/
│   ├── Action/
│   └── Mapping/
├── Items/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
    ├── BuyMenu/
    └── CharacterSelection/
```

***

### Notable Systems

* **Character Selection** — Players choose from multiple hero variants, each in their own `Hero/` subfolder.
* **Buy Phase / Economy** — Round-based economy with a buy menu UI, managed by `ArenaEconomyManager`.
* **Experience Phases** — Multi-phase game flow (warmup, buy, combat, round end).

### C++ Classes

* `ArenaCharacterSelection` — Character selection logic
* `ArenaEconomyManager` — Buy system and economy management
* `ArenaPawnComponent_PreviewParts` — Character preview in selection screen
* `CharacterSelectionPawn` — Pawn used during character selection
* `InventoryFragment_ArenaShop` — Shop integration with the inventory fragment system
