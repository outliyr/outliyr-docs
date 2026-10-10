# Anim Rewind

> [!DANGER]
> ### <mark style="color:red;">Experimental</mark>
> 
> **Anim Rewind is an experimental system.** It reaches into engine-internal animation trait layouts that are not a stable interface, so it is engine-version fragile by nature, and it only works on characters driven by an Unreal Animation Framework (UAF) graph and Mover. Treat it as a capable but moving foundation: read this section before you rely on it, and validate any trait you depend on with the determinism audit described under [Supported Traits & Extension](supported-traits-and-extension.md).

Server-side hit validation needs to know where a character's hitboxes were a fraction of a second ago (see [Lag Compensation](../lag-compensation/)). The straightforward way to answer that is to record every bone's world-space transform every tick and interpolate the history later. That works, but it costs memory for every tracked character every frame, and it only works if the character's mesh actually animates on the server.

**Anim Rewind** answers the same question a different way. Instead of storing poses, it stores the small amount of animation _state_ a character's graph needs to be re-evaluated, then reconstructs the historical pose on demand by replaying the graph headlessly. The recorded frame holds no bone transforms at all. When a rewound pose is needed, the system re-runs the character's animation graph from the captured state and reads the pose out.

This buys two things:

* **Memory.** A captured frame is a compact snapshot of timelines and trait state, not a full skeleton of transforms. History for many characters stays cheap.
* **No server animation requirement.** The character never has to tick its animation on the server. The graph is evaluated only when a past pose is actually asked for.

### How it fits together

Anim Rewind is the reconstruction engine. It is wired into two consumers:

| Piece                                           | Role                                                                                                                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`UAnimRewindComponent`**                      | Owns the capture ring buffer for one character. Records one compact frame per movement sim tick and reconstructs historical poses through a headless evaluator.                                                                  |
| **Anim Rewind Network Sync Scope** (graph node) | Placed inside the character's UAF graph, it registers the live graph instance with the component so state can be captured, and replicates sparse anchors so clients can correct their own graph to the server's animation phase. |
| **`UAnimRewindHitboxProviderComponent`**        | The bridge to lag compensation. Registers the character as an on-demand hitbox source and answers pose requests by reconstructing the bracketing frames. This is the `PosesOnDemand` [backend](../lag-compensation/backends.md). |

The same reconstruction also drives networked replay: a killcam can rebuild a character's animation from the replicated anchors rather than streaming bones.

### Documentation Guide

| Page                                                              | Content                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [How It Works](how-it-works.md)                                   | Capture, headless reconstruction, the ring buffer, and network sync                |
| [Integration](integration.md)                                     | Setting a character up: the graph node, the components, and common pitfalls        |
| [Supported Traits & Extension](supported-traits-and-extension.md) | Which traits reconstruct, adding a capturer, the audit, and the world-query hazard |
