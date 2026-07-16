# How It Works

Anim Rewind has three moving parts: **capture** writes a compact frame every sim tick, **reconstruction** turns a frame back into a pose by replaying the graph, and **network sync** lets clients follow the server's animation phase without streaming poses. This page walks each one.

***

## Capture

On the server, `UAnimRewindComponent` records one frame at the end of every movement simulation tick. Capture is driven off the mover's post-simulation broadcast, so the recorded frames line up with the authoritative movement sim rather than the render frame rate. Each frame is keyed by the mover's sim frame number and stamped with the world time at that tick.

A frame does **not** contain bone transforms. It contains the small amount of state the animation graph needs to be re-evaluated to the same pose:

* the movement sync state and the controller's view for that tick,
* the graph's clip and blend **timelines** (where every player and blend sat),
* a **trait snapshot list**, one compact snapshot per stateful trait whose cross-tick state cannot be recomputed from the timelines alone,
* the graph's public **variables**, read generically so a variable beyond any named set is still captured.

The graph state is harvested from the live graph instance the character is actually playing. The Anim Rewind Network Sync Scope node registers that instance with the component from inside the graph, which is why the node must be present: without a registered instance the component still captures movement and view state, but no graph state, and reconstruction has nothing to rebuild the pose from.

Capture is split so it scales across many characters. The heavy read of each character's graph runs in parallel as a worker-safe pass that touches only that character's own state and ring buffer; the small amount of work that writes replicated data is done afterward on the game thread.

<details>

<summary>What a captured frame holds</summary>

```
FAnimRewindFrame:
    SimTickId        // mover sim frame number, the key
    WorldTimeSeconds // server time at this tick
    Epoch            // continuity generation (see below)
    MoverSyncState   // authoritative movement state
    ControllerView   // view rotation for aim-driven graphs
    RestoreState:
        Timelines        // clip/blend positions
        TraitSnapshots[] // one compact snapshot per stateful trait
        Variables        // the graph's public variables, captured generically
```

No `FTransform` skeleton is stored. The pose is a function of this state, recovered by re-evaluation.

</details>

***

## Reconstruction

To produce the pose at a past tick, the component runs a **headless evaluator**: a graph instance with no rendered mesh and no notifies, evaluated purely to read out a pose.

{% stepper %}
{% step %}
### Start from clean

A fresh graph instance is initialized from the same asset the character plays. Starting clean is what makes reconstruction deterministic: nothing carries over from a previous query.
{% endstep %}

{% step %}
### Restore the captured state

The frame's timelines, trait snapshots, and variables are written back onto the instance, putting every trait exactly where it sat at capture time. An ordered list of trait capturers does this, and the order matters where two traits share a stack (a trait that rebuilds a stack's children runs before any smoother that reads those children).
{% endstep %}

{% step %}
### Evaluate one tick

The graph is updated once with the captured sim step and produces local-space bone transforms, which are accumulated into component space over the reference skeleton.
{% endstep %}
{% endstepper %}

Because the evaluator has no mesh component bound, replaying a tick fires **no** animation notifies, montage events, or gameplay events. Reconstruction reads a pose; it never re-runs side effects.

A request rarely lands exactly on a captured tick, so a query resolves the two frames bracketing the requested time and the normalized position between them; the caller interpolates the two reconstructed poses. Reconstruction is serialized per character and its results are cached for the handful of ticks repeated queries reuse, so the same past tick is not rebuilt twice in a row. Once the evaluator has been primed on the game thread, a query can run on a worker thread, which is what lets the lag-compensation [on-demand backend](../lag-compensation/backends.md) reconstruct off the game thread.

***

## The ring buffer and epochs

History lives in a fixed-capacity ring buffer sized from the rewind window and the sim step. The default window covers a little over half a second, enough to bracket any query inside the rewind window with a frame on each side to interpolate between. A slower sim step covers the same span in fewer frames.

Continuity breaks, a respawn, a teleport, or a possession change, would make interpolation across the break meaningless. Each break advances an **epoch**; frames carry the epoch they were captured under, and a time query never interpolates across an epoch boundary, clamping to the frame on the newer side instead.

***

## Network sync

Reconstruction is server-authoritative, but simulated proxies run their own live UAF graph on each client, and those graphs drift out of phase with the server's. Anim Rewind corrects that drift without streaming poses, by replicating two sparse **anchors**.

| Anchor                | Carries                                               | When                                                                           |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Full state anchor** | The whole lean restore state, serialized generically. | On topology or epoch changes, when the graph's structure has actually shifted. |
| **Phase anchor**      | Only the clip timeline positions.                     | At a low, steady correction rate (about ten hertz by default).                 |

A client applies received anchors to its live graph instance, the same instance the sync scope node registered, nudging its timelines and, when structure changed, its full state back toward the server's. Because the full state is serialized generically rather than field by field, the network path is agnostic to which traits a graph uses: a new captured trait rides along with no extra networking code. Replication of the anchors and their application are each toggleable, and the phase rate is configurable.
