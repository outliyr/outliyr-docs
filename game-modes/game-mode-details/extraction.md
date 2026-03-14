# Extraction

**Plugin:** `Plugins/GameFeatures/Extraction/`\
**Dependencies:** ShooterBase, TetrisInventory, GameplayMaps

A high-stakes loot-and-extract mode where players collect items and must reach extraction points to keep their loot.

***

### Content Structure

```
Content/
├── Accolades/
├── Bot/
├── Experiences/
│   └── Solo/
│       └── Phases/
├── Game/
│   ├── Death/
│   ├── Extraction/
│   └── ItemSpawning/
├── GameplayCues/
├── Hero/
├── Items/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
```

***

### Notable Systems

* **Extraction Points** — Dedicated extraction zone logic in `Game/Extraction/`
* **Item Spawning** — Loot distribution system in `Game/ItemSpawning/`
* **Items** — Mode-specific item definitions
* **Experience Phases** — Multi-phase flow with solo variant
* **Death Handling** — Custom death behavior for the extraction format

#### Players can be looted after death

* Allow the character mesh to be overlapped by the interaction trace when dead; this means interactions are only possible when dead.
* Override the death start functions so the player ragdolls and the player's equipment isn't hidden. This also handles setting up the looting inventory.
* Give the dead player a Tetris Inventory Component at the time of death, and a sphere collision so that nearby players can get read-only access (full access is provided by opening the dead player inventory in the `GA_Interaction_OpenTetrisInventory` ability).
* Set up the interaction options to allow opening a player's inventory.
* The `Extraction_Hero` has a custom death ability (not a child of the default Lyra Death ability). This prevents `death_finish` from being called when the ability ends. In extraction there is no concept of "finish dying" because once a player dies they leave the game mode, and the dead pawn is retained (not destroyed) so it can be looted.

***

### C++ Classes

* Minimal — only the runtime module boilerplate (`ExtractionRuntimeModule`).
