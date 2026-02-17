# Thread Internals

The lag compensation thread handles all heavy computation: maintaining history, interpolating poses, expanding shapes, and performing collision tests. This page covers the algorithms in detail, required reading for debugging hit detection issues or understanding why certain edge cases behave as they do.

***

### History Management

#### Storage Structure

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

#### Snapshot Processing

When the worker thread wakes, it drains all pending snapshots from the queue:

```plaintext
DrainSnapshots():
    while snapshot available in queue:
        get or create history list for source
        add snapshot to history head
        prune entries older than MaxLatency threshold
```

#### Memory Considerations

<table><thead><tr><th width="230.5333251953125">Factor</th><th>Impact</th></tr></thead><tbody><tr><td>Bone count</td><td>60 bones × 60 FPS = 3,600 transforms/second per actor</td></tr><tr><td>History length</td><td>500ms at 60 FPS = ~30 snapshots per actor</td></tr><tr><td>Player count</td><td>32 players × 30 snapshots × 60 bones = 57,600 bone transforms</td></tr><tr><td>Transform size</td><td>~48 bytes per FTransform</td></tr><tr><td><strong>Total estimate</strong></td><td>~2.7 MB for 32 skeletal actors</td></tr></tbody></table>

The system handles this scale efficiently, but extremely long history times or very high actor counts should be profiled.

#### Source Cleanup

When an actor with `ULagCompensationSource` is destroyed, the component unregisters itself. On the next drain cycle, the worker detects the invalid source and deletes its entire history list.

***

### Broadphase Culling

Before expensive per-shape collision tests, the system performs multi-stage filtering to reject actors that cannot possibly intersect the trace. This keeps performance stable regardless of how many actors are tracked.

#### Three-Stage Filtering

{% stepper %}
{% step %}
#### Find interpolation neighborhood

```plaintext
should_rewind(history_list, query_timestamp, trace_start, trace_end, trace_info):

    middle_node = find_node_nearest_timestamp(history_list, query_timestamp)
    newer_node = middle_node.prev   // More recent
    older_node = middle_node.next   // Less recent

    if no valid neighborhood:
        return REJECT
```

This locates the snapshots that bracket the requested timestamp. If no valid neighborhood exists, the actor is rejected.
{% endstep %}

{% step %}
#### Build windowed AABB with padding

```plaintext
    padding = compute_broadphase_padding(trace_info)
    // padding = trace_radius + small epsilon

    windowed_aabb = build_windowed_aabb(middle_node, window_size=2, padding)
    // Union of bounds from middle_node and its neighbors,
    // expanded by padding on all sides
```

Bounds are expanded to account for interpolation uncertainty and the trace shape radius.
{% endstep %}

{% step %}
#### Quick segment-AABB overlap test

```plaintext
    if segment_overlaps_aabb(trace_start, trace_end, windowed_aabb):
        // Fast path: definitely intersects
        out_pose = interpolate_pose(middle_node, newer_node, query_timestamp)
        return PASS
```

If the trace segment overlaps the padded windowed AABB, the actor passes broadphase and the pose is interpolated for narrow-phase testing.
{% endstep %}

{% step %}
#### Full broadphase sweep test

```plaintext
    broadphase_hit = perform_chaos_sweep_vs_aabb(
        trace_start, trace_end, trace_info, windowed_aabb)
```

If the quick test missed, a full sweep vs AABB is performed using Chaos.
{% endstep %}

{% step %}
#### Bypass logic for near-misses

```plaintext
    if NOT broadphase_hit:
        should_bypass = evaluate_bypass_conditions(
            history_list, query_timestamp, middle_node,
            newer_node, older_node, padding, trace_start, trace_end)

        if NOT should_bypass:
            return REJECT

    // Either broadphase hit or bypass allowed
    out_pose = interpolate_pose(middle_node, newer_node, query_timestamp)
    return PASS (or BYPASS)
```

If the sweep also misses, evaluate bypass conditions (see next section). If bypass is granted, pose is interpolated and the actor is allowed through.
{% endstep %}
{% endstepper %}

#### Bypass Logic

The bypass system prevents false rejections in edge cases where the broadphase test is too conservative. A near-miss is allowed through if any of these conditions are met:

| Condition                    | Rationale                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| **Within padding threshold** | Trace passes very close to the AABB                                |
| **Facing the target**        | Trace direction points toward the AABB (cos angle > -0.1)          |
| **At history window edge**   | Query timestamp is within 1 frame of history bounds                |
| **Target nearly stationary** | Neighborhood motion < 0.5cm (interpolation wouldn't change result) |

#### Debug Visualization

When `lyra.LC.Debug.DrawBroadphase` is enabled, each broadphase test draws:

| Color      | Meaning                                           |
| ---------- | ------------------------------------------------- |
| **Green**  | PASS - broadphase hit, proceeding to narrow-phase |
| **Yellow** | BYPASS - broadphase missed but bypass allowed     |
| **Red**    | REJECT - actor excluded from further testing      |

***

### Snapshot Interpolation

Rewind queries can request any timestamp, not just captured frame times. The system reconstructs poses by interpolating between the two snapshots that bracket the requested time.

#### Interpolation Process

{% stepper %}
{% step %}
#### Find bracketing snapshots

Find older and newer bracketing snapshots.
{% endstep %}

{% step %}
#### Compute interpolation factor

Calculate interpolation factor (0.0 to 1.0) from timestamps.
{% endstep %}

{% step %}
#### Interpolate transforms

* For skeletal meshes: interpolate each bone transform independently.
* For static meshes: interpolate the component transform.
{% endstep %}

{% step %}
#### Return reconstructed pose

Return reconstructed pose at query time.
{% endstep %}
{% endstepper %}

***

### Shape Expansion

Unlike systems that store pre-expanded hitboxes every frame, ShooterBase records only lightweight transform data and expands shapes on demand at rewind time. This trades computation for memory efficiency and perfect fidelity with the physics asset.

#### Why Expand at Rewind Time?

| Approach             | Memory                                | CPU                         | Accuracy                             |
| -------------------- | ------------------------------------- | --------------------------- | ------------------------------------ |
| Pre-expanded storage | High (world-space shapes every frame) | Low at query time           | Degrades if mesh scales change       |
| Expand on demand     | Low (transforms only)                 | Moderate (on worker thread) | Perfect (uses current physics asset) |

#### Shape Definition Tables

At registration time, `ULagCompensationSource` extracts collision shapes from the physics asset and stores them in static tables. These tables describe the local-space geometry and never change at runtime.

#### Expansion Process

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

#### Non-Uniform Scale Handling

Actors may be scaled differently along each axis. Each shape type handles this differently:

<!-- tabs:start -->
#### **Boxes**
```
apply_nonuniform_scale_box(local_offset, component_scale, local_extents, out world_extents):
    // Transform local box axes by component rotation, then scale
    quat = local_offset.rotation

    // Each axis gets scaled by how much it projects onto world axes
    local_x = quat.rotate_vector(Vector(1,0,0)) * component_scale
    local_y = quat.rotate_vector(Vector(0,1,0)) * component_scale
    local_z = quat.rotate_vector(Vector(0,0,1)) * component_scale

    scale_x = local_x.length()
    scale_y = local_y.length()
    scale_z = local_z.length()

    world_extents = Vector(
        local_extents.x * scale_x,
        local_extents.y * scale_y,
        local_extents.z * scale_z
    )
```


#### **Spheres**
```
// Spheres must remain spherical, so use largest scale component
scaled_radius = local_radius * max(scale.x, scale.y, scale.z)
```


#### **Capsules**
```
apply_nonuniform_scale_capsule(local_offset, component_scale, out radius, out half_height):
    // Capsule axis is local X
    quat = local_offset.rotation
    capsule_axis_world = quat.rotate_vector(Vector(1,0,0)) * component_scale

    // Height scales along the capsule axis
    axis_scale = capsule_axis_world.length()
    half_height = local_half_height * axis_scale

    // Radius scales uniformly by the perpendicular axes
    perp_scale = max(
        (quat.rotate_vector(Vector(0,1,0)) * component_scale).length(),
        (quat.rotate_vector(Vector(0,0,1)) * component_scale).length()
    )
    radius = local_radius * perp_scale
```

<!-- tabs:end -->

***

### Chaos Collision Testing

The lag compensation system uses Unreal's Chaos physics library directly for collision queries. This provides thread-safe, high-performance geometric intersection tests without accessing the main physics scene.

#### Why Chaos?

| Requirement       | Solution                                                |
| ----------------- | ------------------------------------------------------- |
| Thread safety     | Chaos queries are stateless, no scene lock needed       |
| Shape support     | Native Box, Sphere, Capsule, Convex support             |
| Sweep queries     | `Chaos::SweepQuery()` handles sphere sweeps efficiently |
| No UObject access | Works with raw geometry data only                       |

#### Chaos Shape Types

Shapes are constructed as Chaos primitives for queries:

```plaintext
// Sphere
Chaos::TSphere<float, 3>(center, radius)

// Box (uses min/max representation)
Chaos::TBox<float, 3>(min_corner, max_corner)

// Capsule
Chaos::FCapsule(point_a, point_b, radius)

// Convex (from plane equations)
Chaos::FConvex(planes, vertices)
```

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

#### Per-Shape Algorithms

| Shape   | Entry Detection                            | Exit Detection                         |
| ------- | ------------------------------------------ | -------------------------------------- |
| Sphere  | Sphere-sphere sweep, time-of-impact        | Reverse sweep from trace end           |
| Box     | Closest-point OBB test with Minkowski sum  | Reverse sweep                          |
| Capsule | Segment-sphere distance, capsule endpoints | Reverse sweep                          |
| Convex  | Cyrus-Beck plane clipping along sweep path | Plane clipping from opposite direction |

#### Result Aggregation

After testing all shapes on all actors, results are sorted by entry distance (closest first) and packaged into the final result structure.

***

### Processing a Rewind Request

When the worker thread dequeues a rewind trace request, it executes this pipeline:

{% stepper %}
{% step %}
#### Phase 1: Broadphase culling

For each tracked actor: if it passes broadphase test, add to candidate list.
{% endstep %}

{% step %}
#### Phase 2: Pose reconstruction

For each candidate: interpolate pose at query timestamp and expand shapes to world space.
{% endstep %}

{% step %}
#### Phase 3: Collision testing

For each candidate's shapes: test trace against shape and collect all hits.
{% endstep %}

{% step %}
#### Phase 4: Result assembly

Sort hits by distance, merge with non-compensated world trace, fulfill the promise with results.
{% endstep %}
{% endstepper %}

***

### Thread Safety

The worker thread is completely isolated from gameplay code:

| Guarantee               | Implementation                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------- |
| No UObject access       | After snapshot ingestion, worker never touches live game objects                      |
| Immutable asset data    | Shape tables read from `UPhysicsAsset` and `UBodySetup` which don't change at runtime |
| Lock-free communication | Snapshot and request queues use MPSC atomic operations                                |
| Deferred debug commands | Debug drawing enqueued to game thread, never called directly                          |

#### Queue Design

```plaintext
// MPSC = Multiple Producer, Single Consumer
// Worker is the only consumer; game thread and sources are producers

SnapshotQueue: TQueue<FQueuedLagSnapshot, EQueueMode::Mpsc>
RequestQueue: TQueue<FRewindLineTraceRequest, EQueueMode::Mpsc>
DebugPoseQueue: TQueue<FLagDebugPoseCmd, EQueueMode::Mpsc>
DebugCollisionQueue: TQueue<FLagDebugCollisionCmd, EQueueMode::Mpsc>
```

***
