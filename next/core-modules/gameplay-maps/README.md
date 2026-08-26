# Gameplay Maps

In the pursuit of a highly modular, scalable, and flexible multiplayer shooter, this framework introduces the **Gameplay Maps Plugin**. This plugin serves as a dedicated, isolated repository for all **reusable map environments**. It embodies a core principle of composition over inheritance by separating environment assets from gameplay logic.

**What it is:** The `Gameplay Maps` plugin contains the foundational environmental elements of your levels. These are the "barebones" spaces, the geometry, lighting, landscape, and general aesthetics, that provide the stage for gameplay. Crucially, the plugin itself contains **no game-mode specific code** (with the exception of the `CompoundBlockoutActor`, a design tool for creating environments). It's primarily a container for `.umap` files and their related static assets.

### **Why it's essential for this framework:**

* **Modularity & Reusability:** Directly aligning with the project's architectural philosophy, `Gameplay Maps` allows you to create environmental assets once and reuse them across multiple distinct game modes. A single map environment can serve as a Team Deathmatch arena, a Battle Royale zone, or an Extraction point, without any alterations to the map asset itself.
* **Streamlined Development:** By strictly separating environment design from gameplay logic, level designers can focus purely on creating compelling and performant spaces. This clear division of responsibilities simplifies workflows and reduces potential conflicts.
* **Scalability:** As your game grows, you can easily expand your content by building new `Gameplay Maps` independently. This decoupled approach ensures that adding new environments doesn't require modifying existing game mode logic or vice-versa.
* **Dynamic Loading:** This plugin integrates with your game's level streaming system. Individual `Game Mode` levels (e.g., `L_TDM_Warehouse`) are designed to stream in the appropriate `Gameplay Map` environment, ensuring that only the necessary environmental data is loaded for the current gameplay experience, optimizing performance and load times.

### Structure of a Gameplay Map

A map housed within the `Gameplay Maps` plugin adheres to a strict composition to maintain its reusability and isolation from game mode specifics.

**Contents:** `Gameplay Maps` are built to contain only the universal environmental elements required for a given space. This includes:

* Static Meshes (buildings, props, terrain features)
* Skeletal Meshes (if part of the static environment, e.g., non-interactive machinery)
* Lighting (Directional Lights, Skylights, Point Lights, etc.)
* Post-Processing Volumes
* Collision geometry (if not part of the mesh itself)
* Landscape or other ground surfaces.

**Exclusions:** To ensure a `Gameplay Map` remains truly generic and reusable across any game mode, it **must explicitly exclude** elements that are tied to specific gameplay rules or player interactions. These are managed by your individual `Game Mode` levels:

* **Player Spawns:** Location where players enter the game.
* **Objective Locations:** Points of interest for game modes (e.g., capture points, bomb sites).
* **Item Spawns:** Locations where pickups or loot appear.
* **Game Mode-specific Triggers or Logic:** Any Blueprint scripts or actors that directly manage game state, scoring, or unique mechanics of a particular mode.

This disciplined approach ensures that, for instance, `Map_Warehouse_01` can be used for a Battle Royale game that dynamically spawns loot and player drops, or for a Team Deathmatch game that spawns weapons at fixed locations, all without touching the `Map_Warehouse_01` asset itself.

### Integration with Game Mode Levels

The power of `Gameplay Maps` becomes evident in their seamless integration with your **Game Mode Levels**.

Each `Game Mode` has its own dedicated top-level map (e.g., `L_TDM_Warehouse`, `L_BR_DesertIsland`). These `Game Mode` maps contain all the specific logic, spawns, and objectives relevant to that particular game mode experience.

Instead of duplicating environments, these `Game Mode` maps dynamically **stream in** the desired `Gameplay Map` as a sub-level. This creates a powerful layered approach:

* **Game Mode Level (`L_TDM_Warehouse`):** Orchestrates the gameplay, defines spawns, objectives, and game rules.
* **Gameplay Map (`Map_Warehouse_01`):** Provides the unadorned physical environment, streamed into the Game Mode Level.

This dynamic linking allows for flexibility. A `Team Deathmatch` level might stream `Map_UrbanStreets` and add specific team spawns and weapon caches. Later, you could create a `Control Point` level that streams the _same_ `Map_UrbanStreets` but overlays different objective points and player pathways, effectively creating two distinct gameplay experiences from a single environmental asset.
