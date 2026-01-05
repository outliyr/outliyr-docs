# Phase Classification

This page explains how the system distinguishes between predicted and authoritative changes. Understanding phase classification is essential for implementing correct side effects that only run at the appropriate time.

### The Problem

When the server replicates an item change, the client needs to know:

* Is this my confirmed prediction? (I already applied this locally)
* Or is this new authoritative state? (Someone else did this, or server-only logic)

Getting this wrong causes problems:

* Treating authoritative as confirmed: Side effects never run
* Treating confirmed as authoritative: Side effects run twice (double-spawn actors, etc.)

***

### The `FPredictionKey` Trick

The solution leverages a clever property of Unreal's `FPredictionKey`. When a client creates a prediction key, that key "belongs" to them. The key's network serialization has a special behavior:

| Context            | `IsValidKey()` Result |
| ------------------ | --------------------- |
| Originating client | `true`                |
| Other clients      | `false`               |
| Server             | `false`               |

This happens automatically through GAS's `FPredictionKey::NetSerialize`. The key serializes normally, but its validity check only succeeds on the client that created it.

***

### FContainerPredictionStamp

Each replicated entry embeds a prediction stamp:

{% code title="FContainerPredictionStamp.h" %}
```cpp
USTRUCT()
struct FContainerPredictionStamp
{
    /** The GAS prediction key that last modified this entry (replicated) */
    UPROPERTY()
    FPredictionKey LastModifyingPredictionKey;

    /** Local-only tracking for pending prediction (NOT replicated) */
    int32 LastLocalPredictedKeyId = INDEX_NONE;

    /** Check if this is our confirmed prediction */
    bool IsConfirmedEcho() const
    {
        return LastModifyingPredictionKey.IsValidKey();
    }

    /** Check if we have a pending local prediction */
    bool HasPendingPrediction() const
    {
        return LastLocalPredictedKeyId != INDEX_NONE;
    }
};
```
{% endcode %}

#### Server Stamping Rules

The server stamps entries based on who initiated the operation:

| Scenario                 | Stamping                           |
| ------------------------ | ---------------------------------- |
| Client predicted this op | Stamp with client's prediction key |
| Server-only op           | Leave key invalid (default)        |
| Op from different client | Leave key invalid                  |

The prediction runtime handles stamping automatically, containers don't need to do this manually.

#### Phase Classification Logic

When the client receives replicated state, classification is simple:

{% code title="PhaseClassification" %}
```
function ClassifyPhase(Stamp, DeltaKind):
    if Stamp.LastModifyingPredictionKey.IsValidKey():
        return PredictionConfirmed
    else:
        return AuthoritativeApplied
```
{% endcode %}

This is race-proof because `IsValidKey()` is evaluated on the receiving client, not the sender.

***

### The Four Phases

| Phase                  | Description                          |
| ---------------------- | ------------------------------------ |
| `PredictedApplied`     | Client applied prediction locally    |
| `AuthoritativeApplied` | Server applied change, replicating   |
| `PredictionConfirmed`  | Server confirmed client's prediction |
| `PredictionRejected`   | Server rejected client's prediction  |

#### Execution Matrix

| Phase                  | Predicting Client | Server | Other Clients |
| ---------------------- | ----------------- | ------ | ------------- |
| `PredictedApplied`     | Yes               | No     | No            |
| `AuthoritativeApplied` | No                | Yes    | Yes           |
| `PredictionConfirmed`  | Yes               | No     | No            |
| `PredictionRejected`   | Yes               | No     | No            |

#### When Each Phase Fires

<details>

<summary><code>PredictedApplied</code></summary>

* Fires immediately when client applies local prediction
* Before any network round-trip
* Use for: Visual feedback, predicted actor spawning

</details>

<details>

<summary><code>AuthoritativeApplied</code></summary>

* Fires on server when it executes the operation
* Fires on non-predicting clients when they receive replicated state
* Use for: Full side effects (replicated actors, granted abilities)

</details>

<details>

<summary><code>PredictionConfirmed</code></summary>

* Fires on predicting client when server echoes their prediction
* Replicated key's `IsValidKey()` returns true
* Use for: State transfer, cleanup of predicted objects

</details>

<details>

<summary><code>PredictionRejected</code></summary>

* Fires on predicting client when server rejects
* Either via GAS rejection delegate or explicit failure RPC
* Use for: Rollback, destroy predicted actors, restore UI

</details>

***

### Removal Classification: GUID Matching

Removals use a different classification approach than adds and changes.

Why not stamps? While `PreReplicatedRemove` fires before the entry is deleted (so you _can_ access the entry and its stamp), GUID matching is simpler and more reliable for removals. The client's removal overlay was recorded locally with local metadata, matching by GUID is straightforward: "Did we predict removing this GUID?"

Solution: GUID matching

For removals, the engine checks if there's a pending removal overlay for the GUID:

{% code title="ClassifyRemovalPhase" %}
```
function ClassifyRemovalPhase(Guid):
    if Overlay.HasRemoval(Guid):
        return PredictionConfirmed
    else:
        return AuthoritativeApplied
```
{% endcode %}

This works because the client recorded a removal overlay when it predicted the removal. If the server removes the same GUID, that confirms the prediction.

***

### Side Effect Implementation

Use phase to gate side effects. The pattern for equipment might be:

| Phase                  | For Additions                             | For Removals             |
| ---------------------- | ----------------------------------------- | ------------------------ |
| `PredictedApplied`     | Spawn predicted actor (no replication)    | Hide actor               |
| `AuthoritativeApplied` | Spawn replicated actor                    | Destroy actor            |
| `PredictionConfirmed`  | Transfer predicted actor to authoritative | Clean up overlay         |
| `PredictionRejected`   | Destroy predicted actor                   | Restore actor visibility |

#### Example: Equipment Actor Spawning

{% code title="OnEquipmentEvent" %}
```
function OnEquipmentEvent(Guid, Phase, Item):
    switch Phase:
        case PredictedApplied:
            // Spawn local-only predicted actor
            Actor = SpawnPredictedEquipmentActor(Item)
            Actor.SetReplicates(false)
            PredictedActors.Add(Guid, Actor)

        case AuthoritativeApplied:
            // Spawn full replicated actor (server or other clients)
            Actor = SpawnEquipmentActor(Item)
            Actor.SetReplicates(true)

        case PredictionConfirmed:
            // Transfer predicted actor to authoritative slot
            PredictedActor = PredictedActors.Find(Guid)
            if PredictedActor:
                TransferToAuthoritative(PredictedActor, ServerEntry)
                PredictedActors.Remove(Guid)

        case PredictionRejected:
            // Destroy predicted actor, rollback
            PredictedActor = PredictedActors.Find(Guid)
            if PredictedActor:
                PredictedActor.Destroy()
                PredictedActors.Remove(Guid)
```
{% endcode %}

Containers subscribe to prediction events and switch on the phase to execute the appropriate side effects.

***

### Local Prediction Tracking

For UI purposes (showing "pending" state), entries track local prediction separately via `LastLocalPredictedKeyId`:

* This field is not replicated, it's purely client-side
* Set when the client applies a prediction
* Cleared when confirmed or rejected
* UI checks `HasPendingPrediction()` to show ghost state

{% code title="HasPendingPrediction" %}
```
function HasPendingPrediction(Stamp):
    return Stamp.LastLocalPredictedKeyId != 0

// In UI widget
if Entry.Prediction.HasPendingPrediction():
    ShowGhostState()  // Reduced opacity, pulsing, etc.
else:
    ShowNormalState()
```
{% endcode %}

***

### Common Scenarios

This section explains how the prediction system handles typical real-world situations.

<details>

<summary>Chained Predictions on Same Item</summary>

When a client makes multiple predictions on the same item before server confirmation:

```
t=0:    Client predicts Add (K1)
t=10:   Client predicts Change (K2) - e.g., modify stack count
t=20:   Client predicts Change (K3) - e.g., move to different slot
```

**Overlay state:** `Ops = [Add(K1), Change(K2), Change(K3)]`

Each prediction key fires CaughtUp independently when the server finishes processing it. This enables **partial confirmation**:

1. K1's CaughtUp fires → removes K1 op from overlay
2. K2's CaughtUp fires → removes K2 op from overlay
3. K3 remains pending until server processes it

The overlay cache is rebuilt after each CaughtUp, using the now-confirmed server state as the base plus any remaining pending ops.

</details>

<details>

<summary>Batched Server Processing</summary>

`FFastArraySerializer` batches operations before replication. If the server processes multiple operations on the same entry before replicating:

```
t=0:    Client predicts Add (K1)
t=10:   Client predicts Move (K2)
t=20:   Client predicts Move (K3)
t=30:   Client predicts Move (K4)
t=100:  Server processes Add(K1) + Move(K2) together
t=150:  Server replicates to client
```

**What the client sees:** One `PostReplicatedAdd` callback with stamp = K2 (the last modifier in the batch)

**What gets confirmed:**

<table><thead><tr><th width="129.8182373046875">Prediction</th><th width="160.727294921875">Status</th><th>Why</th></tr></thead><tbody><tr><td>K1</td><td>Confirmed</td><td>Server processed it, CaughtUp fires</td></tr><tr><td>K2</td><td>Confirmed</td><td>Server processed it, CaughtUp fires, stamp holder triggers state transfer</td></tr><tr><td>K3, K4</td><td>Still pending</td><td>Server hasn't processed these yet</td></tr></tbody></table>

**The flow:**

1. `PostReplicatedAdd` fires with K2's stamp
2. `IsValidKey()` returns true → `PredictionConfirmed` phase
3. State transfer happens from overlay cache to server entry
4. CaughtUp for K1 fires → removes K1 op from overlay
5. CaughtUp for K2 fires → removes K2 op from overlay
6. K3 and K4 ops remain in overlay (server hasn't processed them yet)
7. Overlay cache rebuilds using server state + remaining K3/K4 ops

**Key insight:** `CaughtUp` only fires for prediction keys the server has actually finished processing. If K3 and K4 haven't reached the server yet, their `CaughtUp` delegates won't fire, and their ops remain in the overlay.

</details>

<details>

<summary>Interleaved Client and Server Operations</summary>

When the client predicts while the server is still processing:

```
t=0:    Client sends Move A → B (K1)
t=50:   Server processes, stamps with K1
t=100:  Client predicts ModifyStack on A (K2) - not knowing K1's result yet
t=150:  Server replicates Move confirmation
t=200:  Server receives ModifyStack, processes with K2
```

Each operation proceeds independently:

* Move confirmation arrives → K1 CaughtUp fires
* ModifyStack is a separate prediction → K2 follows its own lifecycle

</details>

<details>

<summary>Cross-Container Operations</summary>

For moves between containers (e.g., Inventory → Equipment):

| Container               | Overlay         | Phase Classification                                |
| ----------------------- | --------------- | --------------------------------------------------- |
| Source (Inventory)      | Removal overlay | GUID matching: "Did we predict removing this GUID?" |
| Destination (Equipment) | Add overlay     | Stamp check: "Is this our prediction key?"          |

Each container classifies its own delta independently. The transaction system ensures atomicity, both succeed or both fail, preventing orphaned overlays.

</details>

***

### Helper Methods

The stamp provides convenience methods (shown in the struct definition above):

| Method                   | Purpose                              |
| ------------------------ | ------------------------------------ |
| `IsConfirmedEcho()`      | Check if `IsValidKey()` returns true |
| `HasPendingPrediction()` | Check if local prediction is pending |

Use `IsConfirmedEcho()` during replication processing to detect confirmed predictions and trigger state transfer:

{% code title="OnReplicatedEntry" %}
```cpp
void OnReplicatedEntry(const FMyEntry& Entry)
{
    if (Entry.Prediction.IsConfirmedEcho())
    {
        // This is our confirmed prediction
        HandleConfirmation(Entry);
    }
    else
    {
        // This is authoritative from server/other client
        HandleAuthoritativeChange(Entry);
    }
}
```
{% endcode %}

***
