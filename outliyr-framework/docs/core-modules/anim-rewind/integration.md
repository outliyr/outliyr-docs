# Integration

Anim Rewind attaches to a character in three pieces: a node inside its animation graph, two components on the actor, and a lag-compensation manager on the game state. This page covers wiring them up and the mistakes that produce a broken rewind.

{% hint style="danger" %}
Anim Rewind only works on characters driven by a **UAF (Unreal Animation Framework) graph**. A character animated by a classic Animation Blueprint has no graph instance to capture or replay, so it cannot be rewound this way. Use the snapshot [backend](../lag-compensation/backends.md) for those.
{% endhint %}

## Setup

{% stepper %}
{% step %}
### Add the Anim Rewind Network Sync Scope node

Inside the character's UAF graph, place the **Anim Rewind Network Sync Scope** node on the output pose path. It passes the pose through unchanged, and while it runs it registers the live graph instance with the rewind component and marks the instance to receive network sync anchors.

This node is what makes capture possible. Without it, nothing registers the running graph, and reconstruction has no state to rebuild a pose from.

<figure><img src="../../.gitbook/assets/image (340).png" alt=""><figcaption></figcaption></figure>
{% endstep %}

{% step %}
### Add the rewind component

Add `UAnimRewindComponent` to the character. It owns the capture ring buffer and the headless evaluator. By default it targets the owning character's mesh; the rewind window and sim step are configurable on the component.

<figure><img src="../../.gitbook/assets/image (342).png" alt=""><figcaption></figcaption></figure>
{% endstep %}

{% step %}
### Add the hitbox provider component

Add `UAnimRewindHitboxProviderComponent` to the character. On the server it finds the rewind component, the skeletal mesh, and the lag-compensation manager, builds the hitbox shape table from the mesh's physics asset, and registers as the `PosesOnDemand` hitbox source. This is what connects Anim Rewind to hit validation.

<figure><img src="../../.gitbook/assets/image (341).png" alt=""><figcaption></figcaption></figure>
{% endstep %}

{% step %}
### Ensure the lag-compensation manager exists

`ULagCompensationManager` must be on the GameState, normally added through the experience so it is present once the experience has loaded. The provider registers only after the experience loads, which is when the manager exists.
{% endstep %}
{% endstepper %}

### Requirements at a glance

| Requirement                                | Why                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A UAF graph on the character               | Capture and reconstruction replay this graph; there is nothing to replay otherwise.                 |
| A skeletal mesh with a physics asset       | The physics asset defines the hitbox shapes the provider expands at the rewound pose.               |
| `ULagCompensationManager` on the GameState | The provider registers with it; hit validation queries it.                                          |
| Server authority                           | Capture and registration happen on the authority. Clients apply network anchors but do not capture. |

## Common pitfalls

The failure mode to recognize is a reconstructed pose that comes out collapsed or frozen rather than matching the character, which shows up as **mushed hitboxes**. It almost always traces to one of these.

{% hint style="warning" %}
**The sync scope node is missing from the played graph.** If the running graph has no Anim Rewind Network Sync Scope node, the component logs that it captured no graph state because no live graph instance is registered, and every reconstructed pose falls back to a rest pose. Confirm the node is on the graph the character actually plays, not a sibling graph or a layer that never runs.
{% endhint %}

{% hint style="warning" %}
**No lag-compensation manager on the game state.** If the manager is absent, the provider has nothing to register with and the character never enters rewound traces. Add `ULagCompensationManager` to the GameState through the experience.
{% endhint %}

{% hint style="warning" %}
**A trait reads live state that reconstruction cannot see.** If most of the body reconstructs wrong while one isolated part is correct, suspect a trait whose input is computed from live external state at evaluation time, for example a motion-matching trajectory generated from the live movement component each tick. The clean reconstruction instance has no such live state, so it produces a different pose. The fix is to feed that input from captured state instead; this is covered in detail under [the world-query hazard](/broken/pages/46eab4240b811aad1ba3b915b8924aac39a77e41#the-world-query-hazard).
{% endhint %}

{% hint style="info" %}
The provider and the rewind component both expose development-only debug draws: the provider draws the reconstructed hitbox shapes and the component draws the reconstructed skeleton for a given number of seconds ago. Drawing them together is the fastest way to see whether a bad rewind is the pose or the hitbox mapping. There is also a log that dumps the captured inputs and a side-by-side of captured versus reconstructed state for a past tick.
{% endhint %}

***

## Live physics against the UAF mesh

Server-authoritative hit validation goes through lag compensation and never touches the mesh's live physics bodies. **Live** physics queries do, and a UAF-driven skeletal mesh has a gap there: it writes only its render pose and never moves its kinematic physics bodies to follow the animation, so a line trace or sweep against it on a client hits the bones at the reference pose rather than where the mesh is drawn.

`UUAFKinematicPoseSyncComponent` closes that gap. Added to the character, it pushes the finalized component-space pose to the mesh's kinematic bodies each frame once the pose has resolved, so live queries land on the animated bones. It disables itself on a dedicated server, where hits resolve through lag compensation and these meshes are not animated, so it costs nothing there; it matters on clients, listen servers, and standalone.

{% hint style="info" %}
This component is a **temporary workaround for a UAF limitation**, not a permanent part of the setup, and it is independent of rewind: rewound server hits never use it. A classic Animation Blueprint moves its kinematic bodies to follow the pose automatically; the current UAF runtime does not, so the component does it by hand. Expect to drop it once UAF updates kinematic bodies natively.
{% endhint %}

***
