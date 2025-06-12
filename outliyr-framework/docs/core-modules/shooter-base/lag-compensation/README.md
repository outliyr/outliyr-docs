# Lag Compensation

In any online multiplayer shooter, network latency is an unavoidable reality. The time it takes for information to travel from a client (player) to the server and back means that what a player sees on their screen is always slightly in the past compared to the current state of the game world on the authoritative server.

This creates a significant problem for hit detection, especially with instantaneous actions like hitscan weapons:

* A player might aim perfectly at an opponent on their screen and fire.
* By the time the "fire" command reaches the server, the opponent has already moved according to the server's simulation.
* If the server performs a hit trace based on its _current_ world state, it might register a miss, even though the shot looked perfect on the client's screen.

This discrepancy leads to frustrating gameplay where players feel their shots aren't registering correctly.

### The Solution: Lag Compensation

**Lag Compensation** is a server-side technique designed to mitigate this problem. Instead of validating hits against the server's _current_ state, the server **rewinds** the relevant parts of the world (specifically, the positions and orientations of potential targets) back to the point in time when the client perceived the action (e.g., fired the shot). The server then performs the hit detection trace within this temporarily rewound state.

This allows the server to "see" the world closer to how the client saw it, resulting in much more accurate and fair hit validation that aligns better with player perception.

### Core Concepts of this System

The ShooterBase Lag Compensation system implements this using several key ideas:

1. **History Tracking:** The server continuously records the historical positions, rotations, and collision shapes (hitboxes) of specific, designated actors (those with a `ULagCompensationSource` component) over a short period (e.g., the last 500ms).
2. **Rewinding:** When a validation request (like a hitscan trace) arrives from a client with a specific timestamp, the system interpolates between stored history records to reconstruct the state (positions and orientations of hitboxes) of tracked actors at that precise past moment.
3. **Tracing in the Past:** The hit detection trace (line trace, sphere trace) is performed against these reconstructed, historical hitbox positions.
4. **Multi-threading:** To avoid blocking the main game thread with potentially complex history lookups and trace calculations, the core rewinding and tracing logic runs on a dedicated background thread (`FLagCompensationThreadRunnable`). Communication between the game thread and the worker thread is handled asynchronously.

### <mark style="color:red;">Target Audience & Disclaimer</mark>

**This is an advanced, server-side system.**

* **Primary Interaction:** Most developers will interact with this system indirectly:
  * By using the provided hitscan Gameplay Abilities (`UGameplayAbility_RangedWeapon_Hitscan`, `UGameplayAbility_HitScanPenetration`), which automatically utilize the system for validation.
  * By using the `UAsyncAction_RewindLineTrace` Blueprint node for custom server-side logic requiring historical traces.
  * By adding the `ULagCompensationSource` component to actors that need to be considered for lag-compensated hit detection (typically player Pawns, potentially important AI or physics objects).
  * By using the Projectile Manager, which leverages this system internally for its collision checks.
* **Modification Warning:** Modifying the core `ULagCompensationManager` or `FLagCompensationThreadRunnable` requires a deep understanding of C++, multi-threading, network synchronization, and 3D collision math. **Casual modification is strongly discouraged** as it can easily lead to performance issues, incorrect hit registration, or instability.

### Scope and Limitations

* **What is Rewound:** The system specifically tracks and rewinds the collision shapes (hitboxes) derived from the `UMeshComponent` (Static or Skeletal) of actors that have the `ULagCompensationSource` component attached. It does _not_ rewind the entire actor's state, animation state, or logic.
* **What is NOT Rewound:** General world geometry, non-tracked actors, particle effects, animation states, or gameplay logic variables are _not_ rewound. The system focuses solely on the historical positions of registered hitboxes for accurate trace validation. Standard world traces are still performed against the _current_ state of non-tracked actors.
* **Focus:** The primary goal is accurate hit validation for client actions based on past world states.

The following pages will delve into the specific components, data structures, workflow, and debugging features of this powerful system.

***
