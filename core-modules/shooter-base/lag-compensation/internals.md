# internals

The lag compensation thread handles all heavy computation: maintaining history, interpolating poses, expanding shapes, and performing collision tests. This page covers the internal systems—required reading for debugging hit detection issues or understanding system behavior.

***

## History Management

### Storage Structure

Each registered source maintains a time-ordered doubly-linked list of historical poses:

```plaintext
ActorHistoryData: Map<ULagCompensationSource*, LinkedList<FLagCompensationData>>

FLagCompensationData:
    Timestamp: double              // World time when captured
    ActorLocation: FVector         // For broadphase and debugging
    ActorBounds: FBox              // Axis-aligned bounding box
    CollisionResponses: Container  // Which channels this actor responds to
    BoneWorld: Array<FTransform>   // World-space bone transforms (skeletal)
    StaticComponentToWorld: FTransform  // Component transform (static)
```

New snapshots are prepended to the list head, creating a chronological buffer from newest (head) to oldest (tail).

### Snapshot Processing

When the worker thread wakes, it drains all pending snapshots from the queue:

```plaintext
DrainSnapshots():
    while snapshot available in queue:
        get or create history list for source
        add snapshot to history head
        prune entries older than MaxLatency threshold
```

### Memory Considerations

| Factor             | Impact                                                        |
| ------------------ | ------------------------------------------------------------- |
| Bone count         | 60 bones × 60 FPS = 3,600 transforms/second per actor         |
| History length     | 500ms at 60 FPS = \~30 snapshots per actor                    |
| Player count       | 32 players × 30 snapshots × 60 bones = 57,600 bone transforms |
| Transform size     | \~48 bytes per FTransform                                     |
| **Total estimate** | \~2.7 MB for 32 skeletal actors                               |

The system handles this scale efficiently, but extremely long history times or very high actor counts should be profiled.

### Source Cleanup

When an actor with `ULagCompensationSource` is destroyed, the component unregisters itself. On the next drain cycle, the worker detects the invalid source and deletes its entire history list.

***

## Broadphase Culling

Before expensive per-shape collision tests, the system performs multi-stage filtering to reject actors that cannot possibly intersect the trace. This keeps performance stable regardless of how many actors are tracked.

### Culling Pipeline

{% stepper %}
{% step %}
### Stage: Find interpolation neighborhood

Find snapshots that bracket the query timestamp.\
If no valid neighborhood exists: return REJECT.
{% endstep %}

{% step %}
### Stage: Build windowed bounds

Compute expanded AABB from nearby snapshots. Add padding for trace radius.
{% endstep %}

{% step %}
### Stage: Quick intersection test

If trace definitely intersects bounds: return PASS.
{% endstep %}

{% step %}
### Stage: Detailed intersection test

Perform precise sweep test against bounds.
{% endstep %}

{% step %}
### Stage: Bypass evaluation for edge cases

If intersection failed but bypass conditions met: return BYPASS.

Return PASS or REJECT based on results.
{% endstep %}
{% endstepper %}

### Bypass Logic

The bypass system prevents false rejections in edge cases where broadphase is too conservative. A near-miss is allowed through if certain conditions are met:

| Condition               | Rationale                                       |
| ----------------------- | ----------------------------------------------- |
| **Near the bounds**     | Trace passes very close to the AABB             |
| **Facing the target**   | Trace direction points toward the actor         |
| **At history boundary** | Query timestamp near edge of history window     |
| **Target stationary**   | Minimal movement makes interpolation negligible |

### Debug Visualization

When `lyra.LC.Debug.DrawBroadphase` is enabled, each broadphase test draws:

| Color      | Meaning                                           |
| ---------- | ------------------------------------------------- |
| **Green**  | PASS - broadphase hit, proceeding to narrow-phase |
| **Yellow** | BYPASS - broadphase missed but bypass allowed     |
| **Red**    | REJECT - actor excluded from further testing      |

***

## Snapshot Interpolation

Rewind queries can request any timestamp, not just captured frame times. The system reconstructs poses by interpolating between the two snapshots that bracket the requested time.

### Interpolation Process

{% stepper %}
{% step %}
### Find bracketing snapshots

Find older and newer bracketing snapshots.
{% endstep %}

{% step %}
### Compute interpolation factor

Calculate interpolation factor (0.0 to 1.0) from timestamps.
{% endstep %}

{% step %}
### Interpolate transforms

* For skeletal meshes: interpolate each bone transform independently.
* For static meshes: interpolate the component transform.
{% endstep %}

{% step %}
### Return reconstructed pose

Return reconstructed pose at query time.
{% endstep %}
{% endstepper %}

The system uses appropriate interpolation methods for each transform component to ensure smooth, accurate pose reconstruction.

***

## Shape Expansion

Unlike systems that store pre-expanded hitboxes every frame, ShooterBase records only lightweight transform data and expands shapes on demand at rewind time. This trades computation for memory efficiency and maintains perfect fidelity with the physics asset.

### Why Expand at Rewind Time?

| Approach                 | Memory                                | CPU                         | Accuracy                             |
| ------------------------ | ------------------------------------- | --------------------------- | ------------------------------------ |
| **Pre-expanded storage** | High (world-space shapes every frame) | Low at query time           | Degrades if mesh scales change       |
| **Expand on demand**     | Low (transforms only)                 | Moderate (on worker thread) | Perfect (uses current physics asset) |

### Shape Definition Tables

At registration time, `ULagCompensationSource` extracts collision shapes from the physics asset and stores them in static tables. These tables describe the local-space geometry and never change at runtime.

### Expansion Process

```plaintext
ExpandShapesAtTime(source, interpolated_pose):
    for each shape definition in source:
        get corresponding bone transform from pose
        apply local offset to compute world transform
        scale shape dimensions appropriately for actor scale
        add to hitbox list

    return expanded hitboxes
```

The system handles non-uniform scaling appropriately for each shape type (spheres, boxes, capsules, convex).

***

## Chaos Collision Testing

The lag compensation system uses Unreal's Chaos physics library directly for collision queries. This provides thread-safe, high-performance geometric intersection tests without accessing the main physics scene.

### Why Chaos?

| Requirement       | Solution                                         |
| ----------------- | ------------------------------------------------ |
| Thread safety     | Chaos queries are stateless—no scene lock needed |
| Shape support     | Native Box, Sphere, Capsule, Convex support      |
| Sweep queries     | Efficient shape sweep operations                 |
| No UObject access | Works with raw geometry data only                |

### Collision Test Flow

```plaintext
TestCollision(trace_start, trace_end, trace_shape, hitbox):
    // Check for initial overlap
    if trace starts inside hitbox:
        record overlap hit at trace start
        return

    // Perform sweep to find entry
    sweep from start toward end
    if hit detected:
        record entry point and normal

        // Find exit point
        calculate where trace exits the shape
        record exit point and normal

        compute penetration depth
```

### Per-Shape Algorithms

| Shape       | Description                             |
| ----------- | --------------------------------------- |
| **Sphere**  | Sphere-sphere sweep for time-of-impact  |
| **Box**     | Oriented bounding box intersection test |
| **Capsule** | Segment-sphere distance calculation     |
| **Convex**  | Plane clipping along sweep path         |

### Result Aggregation

After testing all shapes on all actors, results are sorted by entry distance (closest first) and packaged into the final result structure.

***

## Processing a Rewind Request

When the worker thread dequeues a rewind trace request, it executes this pipeline:

{% stepper %}
{% step %}
### Phase 1: Broadphase culling

For each tracked actor: if it passes broadphase test, add to candidate list.
{% endstep %}

{% step %}
### Phase 2: Pose reconstruction

For each candidate: interpolate pose at query timestamp and expand shapes to world space.
{% endstep %}

{% step %}
### Phase 3: Collision testing

For each candidate's shapes: test trace against shape and collect all hits.
{% endstep %}

{% step %}
### Phase 4: Result assembly

Sort hits by distance, merge with non-compensated world trace, fulfill the promise with results.
{% endstep %}
{% endstepper %}

***

## Thread Safety

The worker thread is completely isolated from gameplay code:

| Guarantee                   | Implementation                                                      |
| --------------------------- | ------------------------------------------------------------------- |
| **No UObject access**       | After snapshot ingestion, worker never touches live game objects    |
| **Immutable asset data**    | Shape tables read from physics assets which don't change at runtime |
| **Lock-free communication** | Snapshot and request queues use MPSC atomic operations              |
| **Deferred debug commands** | Debug drawing enqueued to game thread, never called directly        |

### Queue Design

The system uses Multiple Producer, Single Consumer (MPSC) queues. The worker is the only consumer; the game thread and sources are producers.

***

## Summary

| Phase               | What It Does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| **Broadphase**      | Multi-stage filtering to quickly reject actors that can't be hit |
| **Interpolation**   | Reconstruct poses between captured snapshots                     |
| **Shape Expansion** | Transform local shapes to world space with proper scaling        |
| **Collision**       | Chaos sweep queries for each shape                               |
| **Aggregation**     | Sort by distance, merge with world trace, fulfill promise        |

***
