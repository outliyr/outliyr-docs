# Influence Spawn System

Spawning is a critical part of any shooter, and a poorly designed system can lead to significant player frustration. This system provides an advanced, context-aware approach to selecting player spawn locations in your game worlds.

### Purpose

Traditional spawn systems often pick from available spawn points randomly or based on simple distance checks. This can frequently result in players spawning:

* Directly in front of or too close to enemies.
* In disadvantageous positions immediately after respawning.
* Far away from teammates or relevant objectives.

The **Influence Spawn System** aims to mitigate these issues by intelligently evaluating potential spawn points based on the current dynamic state of the game. Its goal is to provide **safer, more strategic, and less frustrating** spawn experiences for players.

### Core Concept: Influence & Bias Score

The central idea is that various factors within the live game session **"influence"** the desirability of each potential spawn point. Instead of random selection, the system calculates a **"Bias Score"** for every valid `ALyraPlayerStart` actor. This score quantifies how "good" a spawn point is considered at that exact moment.

Factors that influence the score include:

* Proximity to living teammates (positive influence).
* Proximity to dead teammates (negative influence).
* Proximity to enemies (negative influence).
* Whether the spawn point is within an enemy's line of sight (strong negative influence).
* Game mode-specific objectives or states (customizable influence).

The system then chooses the valid spawn point with the **highest calculated Bias Score**.

### Key Benefits

* **Reduced Spawn Camping/Frustration:** Significantly decreases the likelihood of spawning directly into danger or an enemy's line of sight.
* **Improved Player Experience:** Players are more likely to spawn in relatively safe locations, allowing them a moment to re-orient.
* **Tactical Spawning:** Can subtly encourage players to spawn nearer to active teammates or strategically relevant locations (via game mode bias).
* **Extensibility:** Designed with hooks (`CalculateGameModeBias`, `CanSpawnInPlayerStart`) allowing easy customization for specific game mode rules and objectives.
* **Tunable:** Exposed parameters allow developers to adjust the weight of different influence factors.

### Key Component: `UShooterPlayerSpawningManagmentComponent`

The implementation of this system is contained within the `UShooterPlayerSpawningManagmentComponent` class.

* **Inheritance:** It inherits from and extends Epic's `ULyraPlayerSpawningManagerComponent`, ensuring compatibility with the underlying Lyra framework's spawn point management and claiming logic.
* **Role:** This component, when added to your Game Mode, overrides the default spawn selection logic (`OnChoosePlayerStart`) to implement the bias score calculation and selection process.

### High-Level Flow

When a player needs to respawn:

1. The Game Mode requests a spawn location via the active spawning manager component (`UShooterPlayerSpawningManagmentComponent`).
2. The component receives a list of available `ALyraPlayerStart` actors.
3. It iterates through each `ALyraPlayerStart`.
4. For each valid start point (checking occupancy, claims, and custom `CanSpawnInPlayerStart` rules), it calculates the `SpawnBias` score based on teammate/enemy proximity, line of sight, and game mode factors.
5. It keeps track of the `ALyraPlayerStart` with the highest bias score encountered so far.
6. After evaluating all valid starts, it returns the `ALyraPlayerStart` actor that achieved the highest score as the chosen spawn location.

This overview introduces the goals and concepts. Subsequent pages will delve into the specific calculations for each bias factor, how to customize the logic, and how to integrate the component into your game modes.

***
