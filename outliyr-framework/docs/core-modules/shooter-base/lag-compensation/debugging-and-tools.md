# Debugging & Tools

Lag compensation is a time-sensitive, multi-threaded system, so visual debugging is critical for understanding how actors are rewound and why certain hits are (or aren’t) registered.

ShooterBase provides a built-in **debug visualization framework**, designed to be:

* **Thread-safe** — worker threads never draw directly to the world.
* **Fully configurable** — all visualization is driven by CVars (console variables).
* **Non-intrusive** — no impact on gameplay logic when disabled.
* **Live-updatable** — toggles can be changed at runtime in-editor or in a running game session.

***

### **Debug Settings — `ULyraLagCompensationDebugSettings`**

All debug features are controlled through the developer settings class `ULyraLagCompensationDebugSettings`, exposed in:

> **Project Settings → Lyra Lag Compensation Debug**

This class inherits from `UDeveloperSettingsBackedByCVars`, meaning any changes made here automatically update Unreal console variables, and vice versa.

**Available Settings**

| Property                     | CVar                               | Description                                                                                                                                 |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Disable Lag Compensation** | `lyra.LC.Disable`                  | Turns off the entire lag compensation system. All rewind traces fall back to live, synchronous traces. Useful for comparison and testing.   |
| **Draw Poses**               | `lyra.LC.Debug.DrawPoses`          | Continuously draws the _rewound pose_ of all registered actors (using simulated latency) to visualize how the system reconstructs history.  |
| **Draw Collisions**          | `lyra.LC.Debug.DrawCollisions`     | Draws the rewound collision shapes whenever a rewind trace detects a hit.                                                                   |
| **Draw Hit Only**            | `lyra.LC.Debug.DrawHitOnly`        | When enabled, draws _only the shapes that were actually intersected_ by the trace, not the entire actor.                                    |
| **Draw Individual Hits**     | `lyra.LC.Debug.DrawIndividualHits` | Visualizes every intersected sub-shape (e.g., per-body collisions) in blue during hit testing. Useful for diagnosing per-bone inaccuracies. |
| **Marker Radius (cm)**       | `lyra.LC.Debug.MarkerRadius`       | Radius of the white/black debug spheres drawn for entry/exit points.                                                                        |
| **Simulated Latency (ms)**   | `lyra.LC.Debug.SimLatencyMs`       | Determines how far back in time `DrawPoses` should visualize actor poses. For example, 250 ms simulates typical round-trip latency.         |
| **Pose Duration Scale**      | `lyra.LC.Debug.PoseDurationScale`  | Scales how long the continuous pose markers remain on screen per frame. Higher values make them linger for slower inspection.               |
| **Hit Duration (s)**         | `lyra.LC.Debug.HitDurationSeconds` | Duration for which historical collision hits (green shapes, entry/exit markers) are displayed.                                              |

Each of these can be changed **in real-time** in the console or through the settings panel.

***

### **The Debug Service**

**`FLagCompensationDebugService`**

The debug service acts as a **bridge between the worker thread and the Game Thread**, where actual rendering occurs.

It uses **MPSC (multi-producer, single-consumer) queues** to safely collect debug commands from worker threads, which are then drained and drawn once per tick.

#### **Core Methods:**

```cpp
void EnqueuePose(const FLagDebugPoseCmd& Cmd);
void EnqueueCollision(const FLagDebugCollisionCmd& Cmd);
void Flush(UWorld* World);
```

#### **Draw cycle:**

1. Worker thread performs rewind traces.
2. For each debug event, it enqueues `FLagDebugPoseCmd` or `FLagDebugCollisionCmd`.
3. The manager’s TickComponent calls `DebugService.Flush(World)` each frame.
4. `Flush()` executes all DrawDebug calls safely on the Game Thread.

This separation ensures no thread contention or rendering crashes, all drawing is deferred safely.

***

### **Visualization Types**

* **Continuous Pose Drawing**
  * **Purpose**: Confirm that historical reconstruction is accurate, positions, rotations, and bone offsets match the real-time mesh movement.
  * Triggered by `lyra.LC.Debug.DrawPoses = true`.
  * Visualizes actor hitboxes **at simulated latency** (default 250 ms in the past).
    * Drawn every tick by the background worker.
    * Color: **Green**
    * Controlled by:
      * `PoseDurationScale` — how long each pose remains visible.
      * `SimLatencyMs` — how far back in time to simulate.
* **Collision Visualization (on Hit)**
  * **Purpose**: Visually verify _what_ was hit, _when_ it existed in time, and _how deep_ the penetration was.
  * Triggered when a rewind trace produces a valid intersection.
  * Draws:
    * The **rewound hitboxes** (green or blue wireframes).
    * **White sphere:** trace entry point.
    * **Black sphere:** trace exit point.
  * Controlled by:
    * `DrawCollisions`
    * `DrawHitOnly`
    * `DrawIndividualHits`
    * `MarkerRadius`
    * `HitDurationSeconds`

#### **Color Key:**

| Color    | Meaning                                                          |
| -------- | ---------------------------------------------------------------- |
| 🟢 Green | Full rewound actor pose (default).                               |
| 🔵 Blue  | Only intersected sub-shapes (when `DrawIndividualHits` is true). |
| ⚪ White  | Entry point marker.                                              |
| ⚫ Black  | Exit point marker.                                               |

***

#### **Why It Works This Way**

* &#x20;**Thread-Safe Design**
  * Rendering operations (`DrawDebugBox`, etc.) are not thread-safe.\
    By using `TQueue` (MPSC mode), worker threads can enqueue draw commands freely without synchronization issues. The Game Thread is the only consumer, perfectly safe.
* **Minimal Overhead**
  * When no debug CVars are active:
    * The queues remain empty.
    * `Flush()` becomes a no-op.
    * No performance impact, even when the debug system is compiled in.
* **Scalable Debugging**
  * Because drawing is fully data-driven, additional debug layers (like frame-to-frame history visualization or latency heatmaps) can be added by simply enqueueing new command types without touching the main logic.

***

### **Practical Usage**

**To visualize rewound states in real time:**

1. Run your server instance (lag compensation runs server-side).
2.  In console, run:

    ```
    lyra.LC.Debug.DrawPoses 1
    ```
3.  Optionally simulate latency:

    ```
    lyra.LC.Debug.SimLatencyMs 250
    ```
4. Observe actors: green outlines represent their poses 250 ms in the past.

**To visualize hits:**

1.  Enable:

    ```
    lyra.LC.Debug.DrawCollisions 1
    ```
2. Fire weapons on actors with lag compensation sources
3. Each valid rewind hit draws:
   * Green hitboxes for the target pose.
   * White and black spheres for entry and exit.
   * Blue sub-shapes if `DrawIndividualHits` is on.

***

### **Summary**

ShooterBase’s lag compensation debugging system is useful for understanding time reconstruction and trace behavior.

By combining thread-safe draw queues, fully CVar-driven settings, and runtime configurability, it provides a robust way to _see the past_, analyze hit validation, and ensure the entire rewind pipeline behaves exactly as intended.

***
