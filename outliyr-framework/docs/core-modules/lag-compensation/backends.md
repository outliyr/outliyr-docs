# Backends

The lag compensation system, the manager and the worker, runs one broadphase for every tracked actor and never needs to know how any actor produces its pose. That knowledge lives in a **backend**.

Three terms are worth keeping distinct:

* **The system** is the manager (`ULagCompensationManager`) and the worker (`FLagCompensationThreadRunnable`). It owns the history, the broadphase, and the interpolation, and it is fixed. You do not modify it to add a new kind of hitbox source.
* A **backend** is a component that implements `ILagCompensationHitboxSource`. It describes one actor's hitboxes and feeds the system a trail each tick. This is the extension point.
* A **channel** is the backend's pose-delivery mode, declared through `ELagCompensationBackend`. It decides _when_ and _from where_ the worker gets a narrowphase pose. A backend picks one; it is not a separate object.

The lag compensation system ships with one default and AnimRewind plugin adds another, but neither is privileged. Both are just implementations of the same contract, and can add your own custom backend implementation in your own project.

***

## The Two Channels

Every backend pushes one broadphase trail entry per tick regardless of channel. The channel decides what, if anything, rides along with it and where the pose comes from when a trace rewinds to a past time.

| Channel             | What rides the trail                                                                                      | When the pose is produced                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`PosesInTrail`**  | A pose. The backend attaches the actor's transforms to each trail entry.                                  | In advance, every tick. The worker already holds the pose and interpolates between the two bracketing entries.                                                                                                   |
| **`PosesOnDemand`** | Nothing beyond the broadphase record (timestamp, bounds, collision responses). The pose payload is empty. | On request. When a trace survives broadphase, the worker asks the backend's pose provider to reconstruct the two bracketing poses, then interpolates them with the same math it uses for trail-resident history. |

The choice is eager versus lazy. `PosesInTrail` produces and stores a pose every tick for every tracked actor, whether or not anyone shoots, so it costs memory continuously and needs a pose available on the server each tick. `PosesOnDemand` stores nothing but the broadphase record and produces a pose only when a trace actually reaches the actor, trading that per-tick cost for reconstruction work at query time. Both resolve sub-tick hits identically, because the worker interpolates the same way on either channel.

***

## The Default Backend

`ULagCompensationSnapshotSource` is the backend that ships with the system. It uses the `PosesInTrail` channel: every tick it records the actor's finalized world-space transforms and attaches them to the trail. It is the right choice for static world geometry and for any character whose mesh already animates on the server, and it is what most actors use. You still attach it yourself; it is a default in the sense of being provided and being the common choice, not in being automatic.

It records finalized transforms, so the pose it stores is exactly the one that was rendered: for a skeletal mesh it binds to the mesh's `OnBoneTransformsFinalized` delegate, which fires after all animation evaluation is complete, and for a static mesh it captures the component transform each tick at `TG_PostUpdateWork`. This is also why it requires the mesh to actually animate on the server; a character that does not animate server-side has no finalized pose to record, and wants the on-demand backend instead.

{% stepper %}
{% step %}
### Find the mesh component

Locate the skeletal or static mesh on the actor.
{% endstep %}

{% step %}
### Build the shape tables

Extract collision shapes from the physics asset into static tables. Skeletal shapes come from the `UPhysicsAsset` body setups, static shapes from the mesh's `UBodySetup`. Each shape's type, dimensions, and local offset are recorded once and never change at runtime; the worker expands them to world space at the rewound pose.
{% endstep %}

{% step %}
### Register with the manager

Register as a hitbox source once the manager exists.
{% endstep %}

{% step %}
### Record a trail each tick

Capture bounds, collision responses, and the finalized transforms, and push the trail entry. On `EndPlay` the source unregisters itself and stops recording.
{% endstep %}
{% endstepper %}

***

## The Anim Rewind backend

`UAnimRewindHitboxProviderComponent` is a second backend, provided by the experimental [Anim Rewind](../anim-rewind/) system. It uses the `PosesOnDemand` channel: it pushes a bare trail and reconstructs the bracketing poses on request by replaying the character's animation graph headlessly. It exists for characters that do not animate on the server but still need rewound hitboxes, which the default backend cannot serve. It is documented end to end in the Anim Rewind section; here it matters only as the reference on-demand backend.

{% hint style="warning" %}
An actor carries **exactly one** hitbox source. The manager returns a source id on the first registration and refuses a second for the same actor, so it never double-reports its hitboxes. Attach the snapshot source or the Anim Rewind provider, not both.
{% endhint %}

***

## The source contract

`ILagCompensationHitboxSource` is small on purpose. Everything the manager and worker need to run broadphase and attribute a hit lives here; nothing about how poses are produced leaks out beyond the channel value and, for on-demand sources, the provider handle.

| Member                                               | Purpose                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GetHitboxOwner()`                                   | The actor whose hitboxes this source contributes. One source per actor.                                             |
| `GetHitboxBackend()`                                 | The pose delivery channel, `PosesInTrail` or `PosesOnDemand`.                                                       |
| `GetBoneShapeTable()` / `GetStaticShapeTable()`      | The collision shapes built from the physics asset, per bone for skeletal sources or a single table for static ones. |
| `GetBonePhysMaterials()` / `GetStaticPhysMaterial()` | The physical materials a hit reports, indexed like the shape table.                                                 |
| `GetHitboxMeshComponent()`                           | The mesh component a hit is attributed to in the trace result.                                                      |
| `GetOnDemandPoseProvider()`                          | The pose provider for a source on the on-demand channel, or null on the in-trail channel.                           |

The registration and description methods are read on the game thread when the trail is ingested and mirrored to the worker as plain shared data, so the worker never touches the live source object afterward.

### The on-demand pose provider

A source on the `PosesOnDemand` channel hands the worker an `ILagCompensationOnDemandPoseProvider`, held by a thread-safe shared pointer so it outlives the source object. It has two jobs.

* `IsWorkerSafe()` declares the thread its production may run on. A provider that reads only its own captured, copied state returns true and is called on the worker where the query already runs. One that must touch live game-thread state returns false and is dispatched to the game thread instead.
* `ProducePosesAtTime()` returns the two world-space bone poses bracketing the requested time and the normalized position of the request between them. The worker interpolates the pair exactly as it interpolates trail history, so a hit lands between sim ticks identically on both channels. A request older than the oldest captured state clamps to it and reports the gap, mirroring how the trail history clamps.

{% hint style="info" %}
Keeping the provider **worker-safe** is what keeps the on-demand path off the game thread. The Anim Rewind provider achieves this by copying the two captured frames out of its ring buffer up front and reconstructing from the copies, so no live state is read while the worker runs.
{% endhint %}

***

## Adding a backend

The two shipped backends cover static geometry, server-animated characters, and characters reconstructed from Anim Rewind. When something else needs rewound hitboxes, a compressed transform history, a different animation system, a networked replay, you add a backend by implementing the contract. Nothing in the manager or worker changes.

{% stepper %}
{% step %}
### Implement `ILagCompensationHitboxSource`

Add a component to the actor that implements the interface. Build the bone or static shape table from the physics asset at registration, and answer the owner, mesh component, and physical material queries.
{% endstep %}

{% step %}
### Pick a channel

Return `PosesInTrail` if you can attach a finalized pose to every trail entry, or `PosesOnDemand` if you would rather reconstruct on request.
{% endstep %}

{% step %}
### Register and push a trail each tick

Register once with `RegisterHitboxSource` when the manager exists (after the experience has loaded), and call `IngestTrail_GameThread` once per tick with an `FLagCompensationTrail` carrying the timestamp, bounds, and collision responses. Attach the poses on the in-trail channel; leave them empty on the on-demand channel.
{% endstep %}

{% step %}
### Supply a pose provider (on-demand only)

Return an `ILagCompensationOnDemandPoseProvider` from `GetOnDemandPoseProvider()`. Make it worker-safe if you can, so reconstruction stays off the game thread, and reconstruct the two bracketing world-space poses in `ProducePosesAtTime()`.
{% endstep %}
{% endstepper %}

<details>

<summary>Sketch of a minimal on-demand backend</summary>

```cpp
// Declares the on-demand channel and hands the worker a provider.
ELagCompensationBackend UMyHitboxSource::GetHitboxBackend() const
{
    return ELagCompensationBackend::PosesOnDemand;
}

TSharedPtr<ILagCompensationOnDemandPoseProvider, ESPMode::ThreadSafe>
UMyHitboxSource::GetOnDemandPoseProvider() const
{
    return PoseProvider; // built once at registration, invalidated on EndPlay
}

// Each tick: a bare broadphase entry, no pose payload.
void UMyHitboxSource::TickComponent(float Dt, ELevelTick, FActorComponentTickFunction*)
{
    FLagCompensationTrail Trail;
    Trail.Timestamp          = GetWorld()->GetTimeSeconds();
    Trail.ActorLocation      = GetOwner()->GetActorLocation();
    Trail.ActorBounds        = /* current bounds */;
    Trail.CollisionResponses = /* channel responses */;
    Manager->IngestTrail_GameThread(this, MoveTemp(Trail));
}
```

The provider's `ProducePosesAtTime()` fills the older and newer world-space bone arrays and the alpha between them; the worker does the rest.

</details>

{% hint style="danger" %}
A backend runs inside server-authoritative hit validation and, on the worker path, on a background thread. A provider that returns true from `IsWorkerSafe()` while reading live game-thread state is a data race, not a correctness nuance. When in doubt, return false and pay the game-thread hop.
{% endhint %}

***

The [Anim Rewind](../anim-rewind/) section documents the reference on-demand backend end to end: how it captures state, reconstructs poses, and keeps its provider worker-safe.
