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

At a high level:

1. The server continuously records lightweight **snapshots** of important actors (called _sources_).
2. When a client reports a shot with a timestamp, the server looks up or interpolates the historical snapshot from that time.
3. The server **expands** each actor’s collision shapes as they were in that moment.
4. The requested trace (usually a small sphere sweep) runs through those rewound hitboxes.
5. The results determine whether the client’s shot truly hit, according to the world state that existed in the past.

This approach gives the illusion of _zero-latency_ hit detection, keeping gameplay responsive and fair even under moderate ping.

#### Core Design in This Implementation

ShooterBase’s lag-compensation framework is built around a clean separation of responsibility between **sources**, the **manager**, and a dedicated **worker thread**.

<table><thead><tr><th width="246">Component</th><th>Role</th></tr></thead><tbody><tr><td><strong><code>ULagCompensationSource</code></strong></td><td>A lightweight component added to any actor that should be tracked historically (player pawns, AI, critical objects). Each source records its own snapshot every tick on the <strong>game thread,</strong> including timestamp, actor bounds, and either bone transforms (skeletal) or component transforms (static).</td></tr><tr><td><strong><code>ULagCompensationManager</code></strong></td><td>A singleton-like component on the GameState that owns the system. It gathers snapshots from all registered sources, feeds them to the worker thread, and exposes the public API (<code>RewindLineTrace</code>, <code>RewindSphereTrace</code>, etc.) used by gameplay code.</td></tr><tr><td><strong><code>FLagCompensationThreadRunnable</code></strong></td><td>The background worker responsible for the heavy lifting. It drains queued snapshots, maintains per-actor history buffers, expands shapes on demand, performs rewound traces, and fulfills async results, all without blocking the game thread.</td></tr></tbody></table>

#### Threading Model

* **Game Thread:**
  * Sources record snapshots (bone transforms, bounds, timestamp).
  * Manager enqueues these snapshots and sends trace requests.
  * Debug draw commands are executed here.
* **Worker Thread:**
  * Maintains historical buffers.
  * Expands shapes (`ExpandSkeletalShapesAtTime`, `ExpandStaticShapesAtTime`).
  * Processes rewind trace requests asynchronously.
  * Returns results through `TFuture<FRewindLineTraceResult>`.

This design keeps all expensive math off the main thread while maintaining deterministic, server-authoritative results.



{% hint style="danger" %}
### <mark style="color:red;">Target Audience & Disclaimer</mark>

**This is an advanced, server-side system.**

* **Primary Interaction:** Most developers will interact with this system indirectly:
  * By using the provided hitscan Gameplay Abilities (`UGameplayAbility_RangedWeapon_Hitscan`, `UGameplayAbility_HitScanPenetration`), which automatically utilize the system for validation.
  * By using the `UAsyncAction_RewindLineTrace` Blueprint node for custom server-side logic requiring historical traces.
  * By adding the `ULagCompensationSource` component to actors that need to be considered for lag-compensated hit detection (typically player Pawns, potentially important AI or physics objects).
  * By using the Projectile Manager, which leverages this system internally for its collision checks.
* **Modification Warning:** Modifying the core `ULagCompensationManager` or `FLagCompensationThreadRunnable` requires a deep understanding of C++, multi-threading, network synchronization, and 3D collision math.&#x20;
* **Casual modification is strongly discouraged** as it can easily lead to performance issues, incorrect hit registration, or instability.
{% endhint %}

### Scope and Limitations

* **What is Rewound:** The system specifically tracks and rewinds the collision shapes (hitboxes) derived from the `UMeshComponent` (Static or Skeletal) of actors that have the `ULagCompensationSource` component attached. It does _not_ rewind the entire actor's state, animation state, or logic.
* **What is NOT Rewound:** General world geometry, non-tracked actors, particle effects, animation states, or gameplay logic variables are _not_ rewound. The system focuses solely on the historical positions of registered hitboxes for accurate trace validation. Standard world traces are still performed against the _current_ state of non-tracked actors.
* **Focus:** The primary goal is accurate hit validation for client actions based on past world states.

The following pages will delve into the specific components, data structures, workflow, and debugging features of this powerful system.

## Documentation Guide

| Page                              | Content                                                |
| --------------------------------- | ------------------------------------------------------ |
| [Architecture](architecture.md)   | Component overview, data flow, threading model         |
| [Rewind Traces](rewind-traces.md) | C++ and Blueprint API, result handling, usage examples |
| [Internals](thread-internals.md)  | History management, shape expansion, collision testing |
| [Debugging](debugging.md)         | Debug tools, CVars, visualization, system limitations  |

***
