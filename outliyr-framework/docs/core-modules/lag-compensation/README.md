# Lag Compensation

In any online multiplayer shooter, network latency is an unavoidable reality. The time it takes for information to travel from a client (player) to the server and back means that what a player sees on their screen is always slightly in the past compared to the current state of the game world on the authoritative server.

This creates a significant problem for hit detection, especially with instantaneous actions like hitscan weapons:

* A player might aim perfectly at an opponent on their screen and fire.
* By the time the "fire" command reaches the server, the opponent has already moved according to the server's simulation.
* If the server performs a hit trace based on its _current_ world state, it might register a miss, even though the shot looked perfect on the client's screen.

This discrepancy leads to frustrating gameplay where players feel their shots aren't registering correctly.

***

## The Solution: Lag Compensation

**Lag Compensation** is a server-side technique designed to mitigate this problem. Instead of validating hits against the server's _current_ state, the server **rewinds** the relevant parts of the world (specifically, the positions and orientations of potential targets) back to the point in time when the client perceived the action (e.g., fired the shot). The server then performs the hit detection trace within this temporarily rewound state.

This allows the server to "see" the world closer to how the client saw it, resulting in much more accurate and fair hit validation that aligns better with player perception.

At a high level:

1. The server continuously records a lightweight per-tick **trail** for important actors (called _sources_), along with whatever each source needs to reproduce its pose at any past moment.
2. When a client reports a shot with a timestamp, the server looks up or interpolates each source's historical pose from that time.
3. The server **expands** each actor’s collision shapes as they were in that moment.
4. The requested trace (usually a small sphere sweep) runs through those rewound hitboxes.
5. The results determine whether the client’s shot truly hit, according to the world state that existed in the past.

This approach gives the illusion of _zero-latency_ hit detection, keeping gameplay responsive and fair even under moderate ping.

***

## Broadphase and narrowphase

The rest of these pages lean on two standard collision-detection terms. A rewind trace is resolved in two stages, cheap-then-precise, so the cost stays bounded no matter how many actors are tracked:

* **Broadphase** — a fast first pass that rejects actors the trace could not possibly reach, using each actor's rough bounding box at the rewound time. Most actors are discarded here.
* **Narrowphase** — the precise test, run only on the few actors that survive broadphase: the trace is swept against their actual collision shapes at the rewound pose to find the real hit. Everything the system records exists to serve these two stages: the lightweight trail feeds broadphase, and the pose (stored or reconstructed) feeds narrowphase.

***

## Core Design in This Implementation

Lag Compensation ships as its own standalone `LagCompensation` plugin. It separates into three layers, and telling them apart is the key to both using and extending it. The **system** is fixed:

| Component                            | Role                                                                                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ILagCompensationHitboxSource`**   | The contract a backend implements, and the seam that keeps the system open. A source names its actor, describes its collision shapes, declares a channel, and pushes one lightweight trail entry per tick.                                |
| **`ULagCompensationManager`**        | A singleton-like component on the GameState that owns the system. It keeps the registry of hitbox sources, forwards their trail entries to the worker thread, and exposes the public API (`RewindLineTrace`, etc.) used by gameplay code. |
| **`FLagCompensationThreadRunnable`** | The background worker responsible for the heavy lifting. It maintains per-actor history buffers, expands shapes on demand, performs rewound traces, and fulfills async results, all without blocking the game thread.                     |

Every source declares a **channel** through `ELagCompensationBackend`, its pose-delivery mode. `PosesInTrail` attaches a pose to every trail entry for the worker to interpolate; `PosesOnDemand` leaves the trail bare and reconstructs poses through a provider only when a trace needs them. Either way the worker runs the same broadphase and interpolation.

What implements the contract is a **backend**. Two ship, and an actor carries exactly one:

| Backend                                  | Channel         | What it is                                                                                                                                                                                |
| ---------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ULagCompensationSnapshotSource`**     | `PosesInTrail`  | The **default backend** that ships with the system. Records finalized transforms every tick; for static geometry and any character animated on the server.                                |
| **`UAnimRewindHitboxProviderComponent`** | `PosesOnDemand` | An **add-on backend** from the experimental [Anim Rewind](../anim-rewind/) system. Reconstructs poses by replaying the animation graph; for characters that do not animate on the server. |

Neither backend is privileged; both simply implement `ILagCompensationHitboxSource`. A project can add its own on either channel without touching the manager or worker. See [Backends](backends.md).

***

## Threading Model

* **Game Thread:**
  * Sources record their per-tick trail (bounds, timestamp, and, for the snapshot backend, finalized bone transforms).
  * Manager forwards trail entries and sends trace requests.
  * Debug draw commands are executed here.
* **Worker Thread:**
  * Maintains historical buffers.
  * Expands shapes at the rewound pose.
  * Processes rewind trace requests asynchronously, producing on-demand poses through a worker-safe backend where one is provided.
  * Returns results through `TFuture<FRewindLineTraceResult>`.

This design keeps all expensive math off the main thread while maintaining deterministic, server-authoritative results.

{% hint style="danger" %}
### Target Audience & Disclaimer

**This is an advanced, server-side system.**

* **Primary Interaction:** Most developers will interact with this system indirectly:
  * By using the provided hitscan Gameplay Abilities (`UGameplayAbility_RangedWeapon_Hitscan`, `UGameplayAbility_HitScanPenetration`), which automatically utilize the system for validation.
  * By using the `UAsyncAction_RewindLineTrace` Blueprint node for custom server-side logic requiring historical traces.
  * By adding a hitbox source backend to actors that need to be considered for lag-compensated hit detection (typically player Pawns, potentially important AI or physics objects): the default `ULagCompensationSnapshotSource`, the on-demand `UAnimRewindHitboxProviderComponent`, or a backend of their own.
  * By using the Projectile Manager, which leverages this system internally for its collision checks.
* **Modification Warning:** Modifying the core `ULagCompensationManager` or `FLagCompensationThreadRunnable` requires a deep understanding of C++, multi-threading, network synchronization, and 3D collision math.
* **Casual modification is strongly discouraged** as it can easily lead to performance issues, incorrect hit registration, or instability.
{% endhint %}

***

## Scope and Limitations

* **What is Rewound:** The system specifically tracks and rewinds the collision shapes (hitboxes) derived from the `UMeshComponent` (Static or Skeletal) of actors that register a hitbox source. It rolls back where those hitboxes were, not the actor's gameplay state or logic.
* **What is NOT Rewound:** General world geometry, non-tracked actors, particle effects, and gameplay logic variables such as health or applied effects are _not_ rewound. The system focuses solely on the historical positions of registered hitboxes for accurate trace validation. Animation is a special case: the snapshot backend does not rewind it but records the finalized pose each tick, while the on-demand backend does reconstruct animation, purely to place the hitboxes. Standard world traces are still performed against the _current_ state of non-tracked actors.
* **Focus:** The primary goal is accurate hit validation for client actions based on past world states.

The following pages will delve into the specific components, data structures, workflow, and debugging features of this powerful system.

***

## Documentation Guide

| Page                                                                | Content                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Architecture](../shooter-base/projectile-manager/architecture.md)  | Component overview, the backend seam, data flow, threading model |
| [Backends](backends.md)                                             | The two backends, choosing one, and adding your own              |
| [Rewind Traces](rewind-traces.md)                                   | C++ and Blueprint API, result handling, usage examples           |
| [Internals](../shooter-base/projectile-manager/thread-internals.md) | History management, shape expansion, collision testing           |
| [Debugging](debugging.md)                                           | Debug tools, CVars, visualization, system limitations            |

The on-demand backend is documented alongside the system that provides it: see [Anim Rewind](../anim-rewind/).
