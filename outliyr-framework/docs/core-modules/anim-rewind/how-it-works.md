# How It Works

Anim Rewind has three moving parts: **capture** writes a compact frame every sim tick, **reconstruction** turns a frame back into a pose by replaying the graph, and **network sync** lets clients follow the server's animation phase without streaming poses. This page walks each one.

***

## Capture

On the server, `UAnimRewindComponent` records one frame for every movement simulation tick. Capture is driven off the mover's post-simulation broadcast, so the recorded frames line up with the authoritative movement sim rather than the render frame rate. Each frame is keyed by the mover's sim frame number and stamped with the world time at that tick. The character's location and facing are read at that moment, as each sim tick ends, so a frame that runs several sim ticks to catch up still records where the character stood on each one.

A frame does **not** contain bone transforms. It contains the small amount of state the animation graph needs to be re-evaluated to the same pose:

* the character's **location and facing** when the tick ended, which place the reconstructed pose in the world,
* the graph's public **variables**, read generically so a variable beyond any named set is still captured,
* the graph's clip and blend **timelines** (where every player and blend sat),
* the **relevance flags** of each two-way blend, which decide whether a child resets when it becomes active again,
* a **trait snapshot list**, one compact snapshot per stateful trait whose cross-tick state cannot be recomputed from the timelines alone.

The graph state is harvested from the live graph instance the character is actually playing. The Anim Rewind Network Sync Scope node registers that instance with the component from inside the graph, which is why the node must be present: without a registered instance the component still captures the character's placement, but no graph state, and reconstruction has nothing to rebuild the pose from.

Capture is split so it scales across many characters. The heavy read of each character's graph runs in parallel as a worker-safe pass that touches only that character's own state and ring buffer; the small amount of work that writes replicated data is done afterward on the game thread. The character's animation update waits for that read, so a frame always holds the graph as the previous update left it, never partway through the next one. Frame T therefore holds the state just before tick T's animation update, and reconstruction replays that update.

<details>

<summary>What a captured frame holds</summary>

```
FAnimRewindFrame:
    Input:
        SimTickId            // mover sim frame number, the key
        WorldTimeSeconds     // server time at this tick
        Epoch                // continuity generation (see below)
        Location             // where the character stood when the tick ended
        Orientation          // which way it faced
        CustomGraphVariables // the graph's public variables, captured generically
    Restore:
        Timelines            // clip/blend positions
        BlendRelevance[]     // two-way blend relevance flags
        TraitSnapshots[]     // one compact snapshot per stateful trait
    Extensions[]             // payloads appended by code outside the plugin
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

The graph is updated once with the captured sim step and produces local-space bone transforms. UAF keeps bones in its own level-of-detail order, so the pose is put back into the mesh's bone order, filling any bone the graph left out from the reference pose, before it is accumulated into component space over the reference skeleton.
{% endstep %}
{% endstepper %}

Because the evaluator has no mesh component bound, replaying a tick fires **no** animation notifies, montage events, or gameplay events. Reconstruction reads a pose; it never re-runs side effects.

A request rarely lands exactly on a captured tick, so a query resolves the two frames bracketing the requested time and the normalized position between them; the caller interpolates the two reconstructed poses. Reconstruction is serialized per character and its results are cached for the handful of ticks repeated queries reuse, so the same past tick is not rebuilt twice in a row. Once the evaluator has been primed on the game thread, a query can run on a worker thread, which is what lets the lag-compensation [on-demand backend](../lag-compensation/backends.md) reconstruct off the game thread.

***

## The ring buffer and epochs

History lives in a fixed-capacity ring buffer sized from the rewind window and the sim step. The default window covers a little over half a second, enough to bracket any query inside the rewind window with a frame on each side to interpolate between. A slower sim step covers the same span in fewer frames. Changing either while the game runs resizes the buffer and clears the history.

Continuity breaks, a respawn, a teleport, a possession change, or a switch to a different animation graph, would make interpolation across the break meaningless. Each break advances an **epoch**; frames carry the epoch they were captured under, and a time query never interpolates across an epoch boundary, clamping to the frame on the newer side instead. A graph switch also rebuilds the headless evaluator, so frames captured from the old graph are never replayed through the new one.

***

## Network sync

Reconstruction is server-authoritative, but simulated proxies run their own live UAF graph on each client, and those graphs drift out of phase with the server's. Anim Rewind corrects that drift without streaming poses, by replicating two sparse **anchors**.

| Anchor                | Carries                                               | When                                                                           |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Full state anchor** | The lean restore state, serialized generically, without the trait state that cannot survive being sent. | On topology or epoch changes, when the graph's structure has actually shifted. |
| **Phase anchor**      | Only the clip timeline positions.                     | At a low, steady correction rate (about ten hertz by default).                 |

A client applies received anchors to its live graph instance, the same instance the sync scope node registered, nudging its timelines and, when structure changed, its full state back toward the server's. An anchor is not applied the moment it arrives. It is queued on the character's animation system and applied just before the next animation update, so it never lands in the middle of one.

Because the full state is serialized generically rather than field by field, most traits need no networking code of their own. The exceptions are traits that keep part of their state outside the property system, which a generic serializer cannot send: motion matching, pose history, dead blending, and blend space. Their snapshots stay off the full state anchor, and each client keeps its own state for those traits. A capturer declares which kind it is when it is registered, as described under [Adding a capturer](supported-traits-and-extension.md#adding-a-capturer). Replication of the anchors and their application are each toggleable, and the phase rate is configurable.
