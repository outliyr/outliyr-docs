# Overlay Internals

This page provides a detailed technical reference for the overlay storage and prediction engine. It covers the data structures, algorithms, and cleanup mechanisms.

***

### Data Structures

#### `FPredictedOp`

A single predicted operation stored in an overlay's history:

```cpp
template<typename TPayload>
struct FPredictedOp
{
    /** The prediction key ID (FPredictionKey.Current) that created this op */
    int32 PredictionKeyId;

    /** What kind of operation this represents */
    EItemDeltaKind Kind;  // Added, Changed, Removed

    /** The payload state after this op (used for Add/Change, ignored for Remove) */
    TPayload Payload;
};
```

#### `FGuidOverlay`

Per-GUID overlay with operation history and cached effective state:

```cpp
template<typename TPayload>
struct FGuidOverlay
{
    /** Ordered list of predicted operations (oldest first) */
    TArray<FPredictedOp<TPayload>> Ops;

    /** Cache: whether the cache needs rebuilding */
    bool bCacheDirty;

    /** Cache: true if the effective state is "removed" (item should not exist) */
    bool bCachedIsTombstone;

    /** Cache: the effective payload value (only valid if !bCachedIsTombstone) */
    TPayload CachedValue;

    /** Check if this overlay represents a removed item */
    bool IsRemoved() const { return bCachedIsTombstone; }

    /** Get the cached value (nullptr if removed) */
    const TPayload* GetValue() const;
};
```

### `TGuidKeyedOverlay`

The overlay store manages all per-GUID overlays plus indices for efficient operations:

```cpp
template<typename TPayload>
struct TGuidKeyedOverlay
{
    /** Per-GUID overlay data */
    TMap<FGuid, FGuidOverlay<TPayload>> Overlays;

    /** GUIDs that need cache rebuild before next view composition */
    TSet<FGuid> DirtyGuids;

    /** Reverse index: KeyId -> GUIDs that have ops for that key */
    /** Enables O(affected) CaughtUp/Rejected handling instead of O(all overlays) */
    TMap<int32, TSet<FGuid>> KeyToGuids;

    // Recording, cache rebuild, clearing methods...
};
```

***

### Recording Operations

When the client predicts an operation, it's recorded to the overlay:

```
RecordOp(guid, kind, payload, keyId):
    overlay = Overlays.findOrAdd(guid)

    // Append to operation history
    op = { keyId, kind, payload }
    overlay.Ops.append(op)

    // Mark for lazy cache rebuild
    overlay.CacheDirty = true
    DirtyGuids.add(guid)

    // Update index for efficient clearing
    KeyToGuids[keyId].add(guid)
```

Key points:

* Operations are appended to the history (not replaced)
* Cache is marked dirty, not immediately rebuilt
* The KeyToGuids index is updated for later cleanup

#### Operation Kinds

| Kind   | Meaning                | Effect on Cache                        |
| ------ | ---------------------- | -------------------------------------- |
| Add    | Item is being added    | CachedIsTombstone = false, use payload |
| Change | Item is being modified | Use payload (last-wins semantics)      |
| Remove | Item is being removed  | CachedIsTombstone = true               |

***

### Cache Rebuild

The cache is rebuilt lazily when needed. The rebuild replays operations on top of a base value:

```
RebuildCache(guid, baseValue):
    overlay = Overlays.find(guid)
    if overlay is null or not overlay.CacheDirty:
        return

    // Start from base or "missing"
    exists = (baseValue is not null)
    current = baseValue or empty

    // Replay operations in order
    for op in overlay.Ops:
        if op.Kind == Add:
            exists = true
            current = op.Payload
        else if op.Kind == Change:
            current = op.Payload  // Last-wins
        else if op.Kind == Remove:
            exists = false

    overlay.CachedValue = current
    overlay.CachedIsTombstone = not exists
    overlay.CacheDirty = false
```

#### Base Value Source

The Runtime passes the base value from server entries:

```
// In GetEffectiveView:
for guid in DirtyGuids:
    base = FindServerEntryAsPayload(guid)
    RebuildCache(guid, base)
DirtyGuids.clear()
```

The overlay doesn't fetch its own base. The Runtime passes the base value from server entries, maintaining clean layer separation.

#### When Cache Rebuilds

The cache is marked dirty (and later rebuilt) when:

* A new operation is recorded
* The base (server entry) changes via replication
* Operations are cleared (`CaughtUp/Rejected`)

***

### Clearing Mechanisms

Overlays are cleared through the prediction key lifecycle, not during replication.

#### The `KeyToGuids` Index

The KeyToGuids map enables efficient clearing. Instead of scanning all overlays to find matching keys, we look up which GUIDs are affected:

```
// O(affected) instead of O(total overlays)
affectedGuids = KeyToGuids.find(keyId)
if affectedGuids exists:
    for guid in affectedGuids:
        // Process only affected overlays
```

#### `CaughtUp` (Confirmation Path)

When the server finishes processing a prediction key, the `CaughtUp` delegate fires:

```
OnPredictionKeyCaughtUp(keyId):
    affectedGuids = KeyToGuids.find(keyId)
    if affectedGuids is null:
        return

    for guid in affectedGuids:
        overlay = Overlays.find(guid)
        if overlay is null:
            continue

        // Remove only ops with this key
        overlay.Ops.removeWhere(op => op.PredictionKeyId == keyId)

        if overlay.Ops.isEmpty():
            // No more ops, remove entire overlay
            Overlays.remove(guid)
        else:
            // Other ops remain, mark dirty for rebuild
            overlay.CacheDirty = true
            DirtyGuids.add(guid)

    // Clean up index
    KeyToGuids.remove(keyId)
    MarkViewDirty()
```

Key insight: Only operations with the matching PredictionKeyId are removed. Other operations (from different prediction keys) remain, enabling correct partial confirmation.

#### Rejected (Rollback Path)

Rejection uses the same clearing mechanism, but also broadcasts rejection events:

```
OnPredictionKeyRejected(keyId):
    affectedGuids = KeyToGuids.find(keyId)
    if affectedGuids exists:
        // Broadcast rejection events before clearing
        for guid in affectedGuids:
            BroadcastRejectionEvent(guid, keyId)

    // Clear ops for this key (same as CaughtUp)
    ClearOpsForKey(keyId)
```

***

### View Composition

The Runtime composes the effective view by merging overlay and server state:

```
GetEffectiveView():
    if not ViewDirty:
        return CachedView

    CachedView.clear()
    processedGuids = empty set

    // 1. Rebuild dirty overlay caches
    for guid in DirtyGuids:
        base = FindServerEntryAsPayload(guid)
        RebuildCache(guid, base)
    DirtyGuids.clear()

    // 2. Add overlay entries (excluding tombstones)
    for guid in Overlays.keys():
        overlay = Overlays[guid]
        if overlay.CachedIsTombstone:
            continue  // Tombstone - skip
        CachedView.add(ToViewEntry(overlay.CachedValue))
        processedGuids.add(guid)

    // 3. Add server entries not in overlay
    for entry in ServerEntries:
        guid = GetGuid(entry)
        if guid not in processedGuids:
            CachedView.add(ToViewEntry(entry))

    ViewDirty = false
    return CachedView
```

{% stepper %}
{% step %}
#### Rebuild dirty overlay caches

For each GUID in DirtyGuids:

* base = FindServerEntryAsPayload(guid)
* RebuildCache(guid, base)

After processing, clear DirtyGuids.
{% endstep %}

{% step %}
#### Add overlay entries

For each GUID in Overlays:

* If overlay.CachedIsTombstone: skip
* Otherwise, add overlay.CachedValue to CachedView
* Add GUID to processedGuids
{% endstep %}

{% step %}
#### Add remaining server entries

For each entry in ServerEntries:

* If entry's GUID is not in processedGuids, add the server entry to CachedView

Finally: ViewDirty = false and return CachedView.
{% endstep %}
{% endstepper %}

***

### Authority-Aware Recording

The Runtime routes operations based on authority:

```
RecordAdd(guid, payload, predictionKey):
    if IsAuthority():
        // Server path: modify array directly
        entry = DirectAddEntry(payload)
        StampEntry(entry, predictionKey)
        MarkEntryDirty(entry)
        BroadcastEvent(guid, AuthoritativeApplied)
    else:
        // Client path: record to overlay
        RecordOp(guid, Add, payload, predictionKey.Current)
        MarkViewDirty()
        BroadcastEvent(guid, PredictedApplied)
```

This eliminates boilerplate in containers, they call `RecordAdd/Change/Remove` and the Runtime handles routing.

***

### Replication Processing

When server state replicates to the client:

```
OnEntryReplicated(guid, stamp, deltaKind):
    phase = ClassifyPhase(stamp, deltaKind)

    // Base value changed, mark overlay dirty if exists
    if Overlays.contains(guid):
        Overlays[guid].CacheDirty = true
        DirtyGuids.add(guid)

    // Accumulate change for batched broadcast
    AccumulateChange(guid, deltaKind, phase)

    MarkViewDirty()
```

Overlays are not cleared during replication. The `CaughtUp` delegate handles cleanup after the server finishes processing.

***

### State Transfer

On replication confirmation, the Runtime transfers state from overlay to server entry:

```
OnConfirmation(guid):
    predictedPayload = Overlays[guid].CachedValue
    serverEntry = FindServerEntry(guid)

    if predictedPayload and serverEntry:
        // Item-level reconciliation (tag deltas, etc.)
        predictedItem = GetItemFromPayload(predictedPayload)
        authItem = GetItemFromEntry(serverEntry)

        if predictedItem and authItem:
            authItem.ReconcileWithPredicted(predictedItem)

        // Container-specific state transfer
        TransferPredictionState(predictedPayload, serverEntry)
```

***

### Change Accumulation

The engine accumulates changes for batched broadcasting:

```
AccumulatedChanges = []

AccumulateChange(guid, kind, phase):
    AccumulatedChanges.append({ guid, kind, phase })

FlushChanges():
    if AccumulatedChanges.isNotEmpty():
        OnViewDirtiedWithChanges.broadcast(AccumulatedChanges)
        AccumulatedChanges.clear()
```

This enables efficient UI updates, subscribers receive detailed change information instead of rescanning the entire container.

***
