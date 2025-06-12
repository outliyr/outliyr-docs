# Core Benefits & Design

The Projectile Manager offers significant advantages for handling bullet-like projectiles compared to traditional actor-based systems, primarily focused on **performance, scalability, and network efficiency**. Understanding these benefits clarifies why this system exists alongside the actor-based `AProjectileBase`.

### 1. No Actor Spawning (Struct-Based Simulation)

* **The Problem:** Spawning an `AActor` for every single bullet fired by an automatic weapon incurs significant overhead. Each actor has associated memory costs, component initialization time, ticking costs (even if minimal), and contributes to the overall actor count, which can impact garbage collection and general engine performance, especially on the server.
* **The Solution:** The Projectile Manager **does not spawn actors** for the projectiles it simulates. Instead, each projectile is represented purely as a data structure (`FTraceProjectile`) within the simulation thread's memory.
* **Benefit:** This drastically reduces the per-projectile cost. The system only needs to manage and update these lightweight structs, allowing it to handle thousands of "in-flight" bullets with far less performance impact than spawning thousands of actors.

### 2. Dedicated Simulation Thread

* **The Problem:** Simulating movement, physics (gravity), and collision checks for hundreds or thousands of objects on the main game thread can consume valuable CPU time, leading to lower frame rates and potential stuttering, especially on the server which also handles player logic and replication.
* **The Solution:** All core simulation logic (moving the structs, applying gravity, initiating collision traces) occurs on the dedicated background thread (`FProjectileThreadRunnable`).
* **Benefit:** Frees up the main game thread to focus on player input, rendering updates, core gameplay logic, and replication management, leading to smoother overall performance.

### 3. Optimized Collision (Trace-Based & Lag Comp)

* **The Problem:** Standard engine physics collision for very fast, small actors can sometimes fail (tunneling). Furthermore, validating these collisions accurately across a network requires lag compensation.
* **The Solution:** The system uses efficient geometric traces (line or sphere sweeps) for collision detection. Crucially, these traces are performed via the `ULagCompensationManager`, ensuring hits are validated against historically accurate target positions.
* **Benefit:** Provides reliable collision detection even for fast projectiles and ensures fair, lag-compensated hit registration essential for competitive shooters.

### 4. No Projectile Replication (Server-Side Simulation)

* **The Problem:** Replicating the position and velocity of hundreds or thousands of fast-moving projectile actors continuously would consume significant network bandwidth, potentially saturating connections and degrading the multiplayer experience for all players.
* **The Solution:** The `FTraceProjectile` structs and their simulation exist **entirely on the server** within the `FProjectileThreadRunnable`. Nothing about the projectile's _path_ or _current state_ is replicated to clients.
* **Benefit:** Massively reduces network bandwidth usage compared to replicating actor projectiles. Only the _initial_ firing event (if using predictive cosmetics) and the _final impact results_ (damage via Gameplay Effects, hit confirmation via RPC, visual/audio cues via Gameplay Cues) need to be networked.

### 5. Decoupled Cosmetics (Niagara Tracers & Gameplay Cues)

* **The Problem:** How do players _see_ the bullet if the simulation isn't replicated?
* **The Solution:** Visual representation is handled separately using highly optimized systems:
  * **Client-Side Tracers:** When the firing client's Gameplay Ability runs (`OnTargetDataReadyCallback`), it typically spawns a purely cosmetic **Niagara particle effect** representing the tracer. This effect simulates its own travel based on the initial trajectory calculated by the client and often includes logic to stop its lifetime early if it detects a basic collision with the local world (this client-side collision doesn't affect gameplay, it just stops the visual).
  * **Server-Side Impact Effects:** When the simulation thread detects an authoritative hit and notifies the `UProjectileManager`, the manager triggers gameplay logic on the server. Damage is applied via efficient `GameplayEffect` replication. Visual and audio feedback for the impact (sparks, blood, sound) is typically triggered using the **Gameplay Cue** system (`ImpactCueNotify` tag passed in the spawn message). Gameplay Cues are specifically designed for efficiently replicating cosmetic events.
* **Benefit:** This decoupling allows for visually convincing projectile effects using highly optimized systems (Niagara, Gameplay Cues) without the network or performance cost of replicating full actor simulations. Players see responsive tracers, and authoritative impacts trigger appropriate, replicated effects. The simulation thread focuses purely on the mechanics, while rendering and networking use specialized, efficient pathways.

In summary, the Projectile Manager achieves high performance and scalability by simulating projectiles as server-side data structures on a dedicated thread, leveraging lag compensation for accurate collision, eliminating projectile replication overhead, and relying on decoupled cosmetic systems like Niagara and Gameplay Cues for visual feedback.

***
