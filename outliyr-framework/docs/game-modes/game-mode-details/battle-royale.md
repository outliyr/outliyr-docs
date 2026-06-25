# Battle Royale

{% hint style="info" %}
**Plugin:** `Plugins/GameFeatures/BattleRoyale/`\
**Dependencies:** ShooterBase, TetrisInventory, GameplayMaps
{% endhint %}

The largest game mode in the framework. Players load into a lobby, ride a drop plane across the map and deploy from it, scavenge ground loot, and fight inside a play area that shrinks in stages and damages anyone left outside it. The last team standing wins. It pulls together the drop plane, the shrinking safe zone, ground-loot spawners, a full Tetris inventory UI, and lootable death boxes.

***

## How it plays

A match opens in a pre-game lobby that waits for enough players, runs a short countdown, and then begins the live phase. When the round goes live every player is converted to a lightweight plane-rider pawn and attached to a drop plane that flies a spline route across the map. Within a drop window along that route players eject, free-fall, and land where they choose. From the ground they loot weapons, ammo, and consumables out of spawners, manage them in a grid inventory, and fight. Shortly after the plane spawns the safe zone appears and begins shrinking through its configured stages; standing outside the zone applies an escalating damage effect, so the shrinking area forces players together. Eliminated players drop a death box that others can loot. The match ends when only one team remains alive.

***

## Match flow

Two game-state components split the work. `UBR_PreGameComponent` (Blueprint `B_PreGameManager`) owns the lobby: it counts connected players, runs the countdown, and drives the early phases. `B_Scoring_BattleRoyale`, a Blueprint child of the C++ `UShooterScoring_Base`, owns the live match: it spawns the plane, runs the safe zone, tracks who is alive, and declares the winner.

The pre-game component moves the match through three states, each mapped to a game phase:

1. **Waiting for players** runs the warmup phase while the player count is below the threshold.
2. **Countdown** starts once the threshold (or the lobby wait cap) is met. It runs the round-start phase and plays the launch cue.
3. **Ready to start** ends the wait and starts the playing phase.

The scoring component listens for the playing phase. When it begins it spawns the plane, converts every player to a plane rider, waits a short delay, then spawns the safe zone and kicks off the first shrink stage.

<details>

<summary>Verified phase chain</summary>

`B_PreGameManager` and `B_Scoring_BattleRoyale` event flow, read from the Blueprint graphs:

* **Pre-game BeginPlay (authority)** binds `OnPreGameStateChanged` and calls `StartPreGame` on the C++ component. The component watches login/logout, compares the count against `MinPlayersToStart`, and starts the countdown when the threshold is met or `MaxLobbyWaitDuration` expires.
* **PreGameStateChanged** switches on the state: `WaitingForPlayers` starts `Phase_Warmup`, `Countdown` starts `Phase_RoundStart` and fires the `RoundStart.BattleRoyale` cue, `ReadyToStart` starts `Phase_Playing`.
* **Scoring BeginPlay (authority)** waits for the experience, calls `InitializePlayerCount` (which records every team into `AliveTeams` and the player total into `AlivePlayers`, then binds to team-assignment changes), and listens for `ShooterGame.GamePhase.Playing.Neutral`.
* **PlayPhase** calls `SpawnPlane`, `PlayersRidePlane`, waits `SafeZoneSpawnTimer`, then `SpawnSafeZoneActor` and `AdvanceToNextStage`.
* `SpawnPlane` spawns `B_DropPlane` below the map and selects its route. `PlayersRidePlane` swaps every player to the `PlaneRiderHero_BattleRoyale` pawn data, clears their inventory, and resets active players.

</details>

***

## Win conditions

The match is last-team-standing. Each elimination decrements the alive-player count and, when a team has no players left alive, removes that team from the alive-teams list. The moment the alive-teams list drops to a single entry, that team wins and the match ends with the post-game phase. There is no score target and no match clock; the only end condition is one team remaining.

| Winner          | Trigger                                                           |
| --------------- | ----------------------------------------------------------------- |
| Last team alive | The alive-teams list is reduced to one entry after an elimination |

<details>

<summary>Verified win routing</summary>

* `OnEliminationMessage` (override, after the base class handles the kill) decrements `AlivePlayers`, resolves the eliminated player's team, and reads `AlivePlayersInTeam`. If that team now has no more than one alive (i.e. the eliminated player was the last), the team is removed from `AliveTeams`. If `AliveTeams` then has length one, `HandleVictory` is called with the remaining team.
* `HandleVictory` fires the `MatchDecided` cue with the winning team and starts `Phase_PostGame`.
* `AliveTeams` and `AlivePlayers` are replicated so clients can drive the "players remaining" UI.

</details>

***

## Key systems

### Drop plane and deployment

The drop plane carries players in at the start of the live phase. `ADropPlane` flies a normalized 0..1 progress value along a chosen `APlaneSplineRoute`, advancing each server tick at the route's speed and replicating progress to clients with smoothing. A route is an authorable actor placed in the level: it owns the spline, a route id, a travel speed, an optional reverse flag, and two marker components that define the edges of the drop window. While the plane's progress sits between those markers the drop window is open and players are allowed to eject.

Players ride as `APlaneRiderPawn`, a collision-free pawn attached to the plane's anchor on the server (so attachment replicates smoothly) with a spring-arm camera for free-look. Ejecting detaches the rider and computes a spawn transform and an initial downward-and-forward velocity from the configured eject offsets and speeds, then hands control back to the player's real character for the free-fall.

<details>

<summary>Verified plane behavior</summary>

From `DropPlane.h`, `PlaneSplineRoute.h`, `PlaneRiderPawn.h`, and `DropWindowMarkerComponent.h`:

* `ADropPlane` replicates `SelectedRouteId`, `NormalizedRouteProgress`, and `NormalizedProgressRatePerSecond`. `Server_SelectRouteById` chooses a route from the registry built by `DiscoverRoutesInWorld`, `Server_StartFlight` begins movement, and `Server_SetDropWindowOpen` toggles eject permission. `IsDropWindowOpen` and the `OnDropWindowChanged` dispatcher let UI and audio react.
* `APlaneSplineRoute` defaults to `RouteSpeedCmPerSecond` 2200 and drop-window markers at normalized 0.2 and 0.8. `GetTransformAtNormalizedProgress` resolves the plane's transform, respecting the reverse flag. `UDropWindowMarkerComponent` is an arrow component that snaps to the spline when moved in-editor.
* `APlaneRiderPawn` replicates `CurrentPlane` and the client view rotation. `ComputeEjectSpawn` builds the spawn transform and velocity from `EjectForwardOffset` / `EjectDownOffset` / `EjectForwardSpeed` / `EjectDownSpeed`. `EjectFromPlane` detaches the rider, and `bAutoAlignViewOnAttach` aligns the camera to the plane's travel direction on attach. Eject is driven by `GA_EjectFromPlane`.

</details>

#### Shrinking safe zone

The safe zone is a `B_SafeZone` actor that the scoring component drives through a list of stages. Each stage carries a target radius, a damage gameplay effect, a shrink time, and a waiting time. When a stage initializes, the zone records its current radius and location as the start of an interpolation and its target radius and a random point inside the current zone as the end; after the stage's waiting time elapses the zone shrinks over the shrink time, lerping both radius and center so the play area both contracts and drifts. The scoring component chains stages: each finished stage advances to the next until the list is exhausted.

Damage is driven by overlap. The zone's capsule reports when a player enters or leaves; a player outside the zone has the current stage's damage effect applied and a player who re-enters has it removed. Advancing to a new stage swaps the damage effect on everyone currently outside, so later rings hurt more.

<details>

<summary>Verified safe-zone behavior</summary>

From `B_Scoring_BattleRoyale` and `B_SafeZone`, read from the Blueprint graphs:

* The scoring component ships two stages. Stage one: radius 2000, `GE_Damage_SafeZone_Light`, shrink time 10, waiting time 15. Stage two: radius 1000, `GE_Damage_SafeZone_Medium`, shrink time 5, waiting time 2. `InitialSafeZoneRadius` is 3000 and `SafeZoneSpawnTimer` is 5.
* `SpawnSafeZoneActor` spawns `B_SafeZone`, sets its radius to the initial radius, and records its location as the first target. `AdvanceToNextStage` increments the stage index and, while it is within the stage array, calls `InitializeSafeZoneStage`, which breaks the stage struct and calls the zone's `InitializeStage` with the radius, damage effect, and shrink time, then arms timers for the waiting and shrink durations.
* The zone's `InitializeStage` swaps in the new damage effect via `ReplaceGameplayEffects`, stores the previous radius and location as interpolation starts, sets the new final radius, and picks a random point in the zone as the new center. `StartShrinking` runs `TL_SafeZoneShrink`, and `UpdateZone` lerps radius and actor location by the timeline's progress.
* Overlap: `InTheZone` removes the damage effect from a player who enters; `OutTheZone` applies the current damage effect to a player who leaves and tracks them in a "players outside" set. `ReplaceGameplayEffects` removes the old effect from everyone outside and applies the new one when a stage changes. The light, medium, heavy, and danger damage effects live under `Game/SafeZone/`.

</details>

### Ground loot and death boxes

Loot reaches players two ways. Spawners scatter weapons, ammo, and consumables across the map, and eliminated players leave a death box that holds their inventory for others to take. The mode's items (bandages, shield batteries, ammo types, and weapon variants) are the consumables that fill the map and the boxes.

Ground loot is scattered by the zone spawner from TetrisInventory, `B_ItemZoneSpawner`, which is placed in the Battle Royale map. Each spawner defines an area as a spline (a circle or a rectangle), picks a number of random points spread evenly across that area, and rolls a rarity-weighted item for each point from a spawn config, then drops the rolled item there. This is what makes a placed zone fill with loot at match start rather than hand-placing every pickup. Hand-placed single pickups (`B_ItemCollectableSpawner_BR`) and chests (`B_ItemChestSpawner`) exist for set-piece loot.

However it is spawned, a piece of loot is a world collectable picked up through the framework's shared pickup system, which is worth understanding before adding new loot. The collectable carries a `UPickupInteractionProfile` data asset that lists the interaction options a player sees and triggers (their text, hold time, and the gameplay ability each grants). Those granted abilities are subclasses of `ULyraGameplayAbility_FromPickup`, and the main thing a mode changes on them is the routing policy, which decides where a collected item lands: held in hand, sent to the inventory, or auto-equipped then stored.

<details>

<summary>Verified loot and pickup assets</summary>

* `B_ItemZoneSpawner` (TetrisInventory, `Game/ItemSpawners/`) builds its spline area with `CreateCircularSpline` or `CreateRectangleSpline`, calls `GetRandomPointsInSplineArea` (a utility that triangulates the spline polygon and returns points distributed by triangle area) for `ItemCount` points, and `SelectRandomItems` rolls items from its `SpawnConfig` by weight, where `GetRarity` makes the weight `1 / Rarity` so a higher rarity number is less common. `SpawnItems` then drops each rolled item as a `WorldCollectable` at its point. The Battle Royale map references this spawner.
* `B_ItemCollectableSpawner_BR` is a single-point `AWorldCollectableSpawner` for hand-placed loot; it can bake to a permanent collectable in-editor and optionally respawn its item after a delay.
* Collecting an item runs `GA_Interact_CollectItem_BattleRoyale`, a `ULyraGameplayAbility_FromPickup` whose `DefaultConfig.RoutingPolicy` is `AutoEquipOrStore` (weapons go to a held slot, worn gear to its equipment slot, everything else to the inventory). Its interaction profile is `DA_ItemPickupInteraction_BR`. The four routing policies are `HeldEquipmentOnly`, `InventoryOnly`, `AutoEquipOrStore`, and `Custom`.
* `B_PlayerDeathBox_BR` holds a dead player's loot and is opened with `GA_Interact_OpenPlayerDeathBox` via `DA_DeathBoxPickupInteraction_BR`, under `Game/Death/`.
* The curated tables `DA_CommonWeapon_BattleRoyale`, `DA_CommonItems_BattleRoyale`, and `DA_CommonAmmo_BattleRoyale` live under `Game/ItemSpawners/`. The inventory UI under `UserInterface/ViewModels/` is built with MVVM view models for the death box, loot sections, quick swap, and the inventory grid.

</details>

***

## Configuration

Pre-game lobby rules are properties on `B_PreGameManager` (`UBR_PreGameComponent`):

| Property               | Default | Meaning                                                  |
| ---------------------- | ------- | -------------------------------------------------------- |
| `MinPlayersToStart`    | 20      | Players required before the countdown begins             |
| `CountdownDuration`    | 5       | Countdown seconds once the threshold is met              |
| `MaxLobbyWaitDuration` | 30      | Seconds to wait for players before forcing the countdown |

Safe-zone and timing rules are properties on `B_Scoring_BattleRoyale`:

| Property                | Default  | Meaning                                                        |
| ----------------------- | -------- | -------------------------------------------------------------- |
| `InitialSafeZoneRadius` | 3000     | Starting zone radius before any shrink                         |
| `SafeZoneSpawnTimer`    | 5        | Delay after the plane spawns before the zone appears           |
| `SafeZoneStages`        | 2 stages | Per-stage radius, damage effect, shrink time, and waiting time |

Each route's speed and drop-window edges are set on its `APlaneSplineRoute` actor (default speed 2200 cm/s, window 0.2–0.8). Eject offsets and speeds are set on `B_PlaneRiderPawn`.

***

## Content structure

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

The scoring component and pre-game manager sit under `Game/`; the plane actor, rider pawn, and eject ability under `Game/Plane/`; the safe-zone actor and its damage effects under `Game/SafeZone/`; loot spawners under `Game/ItemSpawners/`; the death box and its interaction under `Game/Death/`; and the MVVM inventory under `UserInterface/ViewModels/`.

***

## C++ classes

* `ADropPlane` — the drop-plane actor; flies a selected spline route, replicates progress, and opens the drop window.
* `APlaneSplineRoute` — an authorable route actor defining the spline, speed, and drop-window markers.
* `APlaneRiderPawn` — the collision-free pawn players ride; attaches to the plane and computes the eject spawn.
* `UDropWindowMarkerComponent` — an arrow component marking a drop-window edge, kept snapped to the spline.
* `UBR_PreGameComponent` — game-state component that counts players, runs the lobby countdown, and fires phase-change delegates.

***

## Extending

* **New drop routes** are placed in the level as `APlaneSplineRoute` actors with unique route ids; the plane discovers them automatically and `Server_SelectRouteById` picks one, so adding map variety needs no code.
* **More safe-zone stages** are added by extending the `SafeZoneStages` array on `B_Scoring_BattleRoyale` with new radius, damage effect, shrink time, and waiting time entries; the stage chain already advances through the whole list.
* **Loot tables** are curated in the `DA_Common*` data assets the spawners read, so changing what drops is a data edit rather than a code change.
* **Lobby start rules** (player threshold, countdown, wait cap) are properties on `UBR_PreGameComponent`, and `SetExpectedPlayerCount` lets matchmaking override the threshold per match.
