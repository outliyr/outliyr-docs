# Battle Royale

**Plugin:** `Plugins/GameFeatures/BattleRoyale/`\
**Dependencies:** ShooterBase, TetrisInventory, GameplayMaps

The largest and most complex game mode in the framework. Features a drop plane, shrinking safe zone, ground loot, and a full inventory UI with MVVM architecture.

***

### Content Structure

```
Content/
├── Accolades/
├── Blueprint/
├── Camera/
├── Experiences/
│   └── Solo/
├── Game/
│   ├── Death/
│   ├── ItemSpawners/
│   ├── Plane/
│   ├── SafeZone/
│   └── Spectator/
├── GameplayCues/
├── GameplayEffects/
├── Hero/
├── Input/
│   ├── Ability/
│   ├── Actions/
│   └── Mappings/
├── Items/
│   ├── Bandage/
│   ├── HeavyAmmo/
│   ├── LightAmmo/
│   ├── ShieldBattery/
│   └── Weapons/
│       ├── Pistol/
│       ├── Rifle/
│       └── Shotgun/
├── Maps/
├── System/
│   └── Playlists/
├── Textures/
└── UserInterface/
    └── ViewModels/
        ├── DeathBox/
        ├── Inventory/
        ├── LootSections/
        ├── QuickSwap/
        ├── QuickSwapLoot/
        └── TextStyles/
```

***

### Notable Systems

* **Drop Plane** — Players deploy from a plane following a spline route across the map
* **Safe Zone** — Shrinking play area with configurable phases
* **Item Spawners** — Ground loot spawning system
* **Items** — Mode-specific consumables (bandages, shield batteries) and ammo types, plus weapon variants
* **Inventory UI (MVVM)** — Full inventory interface built with ViewModels for death boxes, loot sections, quick swap, and inventory management
* **Custom Camera** — Mode-specific camera configurations

### C++ Classes

* `DropPlane` — The drop plane actor
* `DropWindowMarkerComponent` — Marks the valid drop window along the route
* `PlaneRiderPawn` — Pawn used while riding the plane
* `PlaneSplineRoute` — Defines the plane's flight path
