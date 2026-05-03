# Welcome

This documentation will guide you through using the **Outliyr Framework** for **Unreal Engine 5**. Whether you're an indie developer, a team building a competitive shooter, or someone looking to extend Lyra with production-ready systems, this framework is designed to help you build faster and scale smarter.

***

## What Is This Framework?

The Outliyr Framework is a **modular multiplayer shooter foundation** built on top of Epic Games’ Lyra Starter Game. It expands Lyra’s systems to provide a complete, extensible shooter base.

This framework includes:

* Advanced inventory systems (grid or Tetris-style)
* Modular weapon and attachment architecture
* Lag compensation, kill cam, immersive spectating
* Prebuilt game modes: Team Deathmatch, Search & Destroy, Extraction, Battle Royale, and more

***

## Why Build on Lyra?

Lyra is Unreal Engine's reference shooter project built by Epic Games using best practices for modular multiplayer development. It includes:

* A robust Gameplay Ability System (GAS)
* Modular Gameplay through Game Feature Plugins and the Experience System
* AAA-level architecture seen in games like Fortnite

However, Lyra is a tech demo, not a full game framework. Outliyr builds on Lyra’s foundation and adds:

* A structured project layout ready for real development
* Fully integrated and extendable game systems
* Modern shooter features commonly required in production

***

## Who Is This Framework For?

* Indie developers building competitive multiplayer shooters
* Small teams or studios who want a solid Unreal-based shooter foundation
* Developers looking to skip reinventing common systems like UI, inventories and weapon logic
* Newcomers to Lyra who need a more practical, usable starting point

***

## Key Benefits

* **Save time** — Focus on building your game, not rewriting boilerplate systems
* **Production-ready** — Fully integrated multiplayer shooter mechanics
* **Modular and extensible** — Add or remove features as needed using Game Feature Plugins
* **Optimized for multiplayer** — Built with replication and performance in mind
* **Accessible architecture** — A hybrid C++/Blueprint design suitable for both programmers and designers

***

## What's in the Framework

A complete inventory of what ships with Outliyr.

### **Core Gameplay Modules**

#### **ShooterBase** — Combat foundation.

* Compositional weapon system with predictive recoil
* Diverse projectile types (hitscan, simulated bullet drop, predictive projectile)
* Lag compensation and aim assist
* Intelligent spawning, flexible scoring
* Spectator system, killcam, accolades

[**See ShooterBase Documentation**](core-modules/shooter-base/)

#### **Tetris Inventory** — Spatial inventory management.

* Grid-based layouts; items have defined shapes and can rotate
* Container items with nested inventories
* 3D item inspection
* Powers both jigsaw-style (Extraction) and grid-style (Battle Royale) variants

[**See Tetris Inventory Documentation**](core-modules/tetris-inventory/)

#### **Gameplay Maps** — Reusable map environments decoupled from gameplay logic.

* Environmental assets (geometry, lighting, landscape) live separate from spawns and objectives
* A single map can be reused across many game modes via level streaming
* Compound Blockout System for fast prototyping with boolean shape operations

[**See Gameplay Maps Documentation**](core-modules/gameplay-maps/)

#### **PSO Warmup** — Boot-time shader precaching that reduces first-play stutter.

* Substantially reduces first-play shader hitches (muzzle flash, hit effects, death animations) by warming PSOs under the loading screen
* Auto-scans `/Game/`, every plugin, and every Game Feature, no manual precache list to maintain
* Signature-based skip on repeat boots when build and hardware are unchanged
* Optional preheat phase covers GPU-simulation Niagara, skinned mesh variants, Nanite / instancing PSOs
* Loading-screen progress bar via delegate hooks

[**See PSO Warmup Documentation**](core-modules/pso-warmup/)

### **Base Lyra (Modified) Systems**

Foundational subsystems extended for production use:

| System                                                     | What it does                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| [Character](base-lyra-modified/character/)                 | Pawns built with components, GAS integration, movement               |
| [Items](base-lyra-modified/items/)                         | Item definitions, instances, fragments, permissions, pickup system   |
| [Inventory](base-lyra-modified/inventory/)                 | Manager component, item queries, view models, and UI                 |
| [Item Container](base-lyra-modified/item-container/)       | Core container interface, transactions, prediction, access rights    |
| [Equipment](base-lyra-modified/equipment/)                 | Equip / unequip flow, granted abilities, runtime instances           |
| [Weapons](base-lyra-modified/weapons/)                     | Weapon instances, range weapon configuration, weapon state, reticles |
| [Save System](base-lyra-modified/save-system/)             | Player-based save flow with extension hooks                          |
| [UI](base-lyra-modified/ui/)                               | Indicator System for HUD markers, Item Container UI System           |
| [Team System](base-lyra-modified/team/)                    | Team definitions, player assignment, team visuals                    |
| [Interaction](base-lyra-modified/interaction/)             | GAS-driven world interaction                                         |
| [Cosmetics](base-lyra-modified/cosmetics/)                 | Dynamic character parts                                              |
| [Game Phase System](base-lyra-modified/game-phase-system/) | Warmup / playing / round-end stages via GAS and tags                 |
| [Camera](base-lyra-modified/camera/)                       | Flexible camera modes with stack-based blending                      |
| [Input](base-lyra-modified/input/)                         | Enhanced Input + Lyra Input Configs driving actions and abilities    |
| [Settings](base-lyra-modified/settings/)                   | Player and machine-specific settings management                      |

### **Prebuilt Game Modes**

Fifteen modes ship ready to play, study, or duplicate: **Arena**, **Battle Royale**, **Capture The Flag**, **Domination**, **Extraction**, **Free For All**, **Gun Game**, **Hardpoint**, **Headquarters**, **Infection**, **Kill Confirmed**, **Payload**, **Prop Hunt**, **Search & Destroy**, **Team Deathmatch**.

Each demonstrates a different combination of the systems above:

* **Battle Royale & Extraction** show different scales of inventory (grid vs. jigsaw)
* **Arena** ships character selection and a buy menu
* **Prop Hunt & Infection** illustrate asymmetric team setups
* **Gun Game** uses Gameplay Events to drive progression
* **Headquarters** demonstrates advanced respawn logic

Each plugin under `Plugins/GameFeatures/` is a complete worked example. Inspect Experience Definitions and Action Sets to see how the pieces compose.

[**See Game Modes**](/broken/pages/KkQgXv3Bdg9vvN7ChRdv)

***

## What You'll Find in This Documentation

* **Quick Start Guide** – Set up the framework and launch your first session
* **Base Lyra Modifications** – Learn how Experiences, Game Features, and modular gameplay work
* **Core Modules** – Detailed guides on inventory, weapons, abilities, UI, and more
* **Game Mode Implementations** – Explore Team Deathmatch, Battle Royale, Extraction, and others
* **Customization Guides** – Best practices for extending or modifying the framework
* **Troubleshooting & FAQ** – Common issues and solutions
* **Community Links** – Join our Discord or contact support

***

## Getting Started

If you're new to the framework, start here:

* Project Architecture – Learn how modular systems interact and load at runtime
* Installation & Setup – Set up the project and understand the structure
* Quick Start Guide – Launch your first gameplay session
* Game Features & Experiences – Understand how gameplay content is dynamically activated
