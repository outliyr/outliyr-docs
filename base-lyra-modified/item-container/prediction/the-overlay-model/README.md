# The Overlay Model

The prediction system uses a **compose model** where predicted state layers on top of server state. This page explains how overlays work, how the effective view is built, and the mental model for understanding the system.

***

### The Core Insight

```
EffectiveView = Compose(ServerState, Overlay)
```

The client maintains two distinct representations:

* **`ServerState`**: The replicated, authoritative data from the server (read-only to prediction)
* **Overlay**: Client-side predicted operations with cached effective values

The UI never reads `ServerState` directly. It always reads the **`EffectiveView`**, which composes both sources according to priority rules.

***

### Operation History

Each GUID in the overlay stores a history of predicted operations. This enables correct partial confirmation when multiple predictions are in flight.

```cpp
// Per-GUID overlay structure
struct FGuidOverlay
{
    TArray<FPredictedOp> Ops;     // Operation history (oldest first)
    TPayload CachedValue;          // Computed effective value
    bool bCacheDirty;              // Needs rebuild
    bool bCachedIsTombstone;       // Effective state is "removed"
};
```

Each operation records:

* **PredictionKeyId**: Which prediction key created this op
* **Kind**: Add, Change, or Remove
* **Payload**: The state after this operation

#### Example: Add then Move

Player adds an item (K1), then moves it (K2):

```
Ops = [
    { K1, Add, {slot: 3} },      // First: add at slot 3
    { K2, Change, {slot: 5} }    // Then: move to slot 5
]
CachedValue = {slot: 5}          // Effective: show at slot 5
```

When K1 catches up, only the K1 op is removed:

```
Ops = [
    { K2, Change, {slot: 5} }    // K2 still pending
]
CachedValue = {slot: 5}          // Still show at slot 5 (now from server + K2 change)
```

***

### Compose Rules

When building the effective view, these rules apply in order:

1. GUID in Overlay and marked removed → Item is absent
2. GUID in Overlay → Use the overlay's cached value
3. GUID in `ServerEntries` only → Use the server entry directly
4. GUID not found → Item is absent

The compose algorithm:

{% stepper %}
{% step %}
#### Rebuild caches

Rebuild any dirty overlay caches (using server entry as base if exists).
{% endstep %}

{% step %}
#### Add overlays

Add all non-tombstone overlay entries to the view.
{% endstep %}

{% step %}
#### Add server-only entries

Add server entries that don't have overlays.
{% endstep %}
{% endstepper %}

***

### Cache Rebuild

The overlay caches an effective value for each GUID. This cache is rebuilt when:

* A new operation is recorded
* The base (server entry) changes via replication
* Operations are cleared (`CaughtUp/Rejected`)

#### The Rebuild Process

{% stepper %}
{% step %}
#### Start from base

Start from the base value (server entry if exists, otherwise "missing").
{% endstep %}

{% step %}
#### Replay operations

Replay each operation in order:

* Add: Mark as exists, use op's payload
* Change: Use op's payload (last-wins)
* Remove: Mark as not-exists
{% endstep %}

{% step %}
#### Store result

Store the final value and tombstone state in the cache.
{% endstep %}
{% endstepper %}

**Key principle**: The overlay doesn't fetch its own base. The Runtime passes the base value from server entries, maintaining clean layer separation.

***

### Example: Moving an Item

Player drags an item from Inventory slot 3 to Equipment slot Primary.

#### Before (Server State)

```
Inventory:
  [0] Item A
  [3] Item B  ← This item
  [5] Item C

Equipment:
  [Primary] (empty)
```

#### Prediction Applied

Two operations are recorded in separate container overlays:

**Inventory overlay:**

* Records: Remove operation for Item B's GUID
* Cache result: tombstone (item hidden)

**Equipment overlay:**

* Records: Add operation for Item B's GUID at Primary slot
* Cache result: Item B at Primary

#### Effective View (What UI Shows)

```
Inventory:
  [0] Item A
  [3] (empty)  ← Removal overlay hides Item B
  [5] Item C

Equipment:
  [Primary] Item B  ← Add overlay shows Item B
```

#### Server Confirms

Server replicates:

* Inventory: Item B removed from slot 3
* Equipment: Item B added to Primary

The prediction key's `CaughtUp` delegate fires when the server finishes processing. This clears both overlays, and the effective view now shows server state directly.

***

### View Caching

Computing the effective view on every query would be expensive. The system uses lazy caching:

* A **dirty flag** tracks when the view needs rebuild
* The cached view is returned immediately if not dirty
* View is marked dirty when:
  * A prediction is recorded (overlay changes)
  * Server state replicates (base changes)
  * An overlay is cleared (`CaughtUp/Rejected`)

Subscribers are notified when the view becomes dirty, enabling efficient UI updates.

***

### GUID Index for O(1) Lookup

During cache rebuild, the Runtime needs to find server entries by GUID. A linear scan would be O(n) per dirty overlay.

The Runtime maintains a **GUID index** that maps each GUID to its position in the server entries array. This index:

* Is rebuilt lazily when marked dirty
* Gets marked dirty on any replication callback (since array indices aren't stable)
* Enables O(1) base value lookup during cache rebuild

***

### Multiple Predictions in Flight

The operation history model handles multiple predictions naturally:

```
T=0:   Player moves Item A (Prediction K1)
T=10:  Player moves Item B (Prediction K2)
T=50:  Server finishes K1, CaughtUp fires
T=60:  Server finishes K2, CaughtUp fires
```

Each operation is tagged with its prediction key. When a prediction key catches up, only operations with that key are cleared.

#### Chained Operations

Operations on the same GUID can chain across prediction keys:

| Sequence             | Ops State                      | Cache                | Result           |
| -------------------- | ------------------------------ | -------------------- | ---------------- |
| Add(K1)              | `[{K1,Add,p1}]`                | p1                   | Show at p1       |
| Add(K1) → Change(K2) | `[{K1,Add,p1},{K2,Change,p2}]` | p2                   | Show at p2       |
| K1 catches up        | `[{K2,Change,p2}]`             | Rebuild from Base+p2 | Show at p2       |
| K2 catches up        | `[]` (empty, remove overlay)   | n/a                  | Use server entry |

***

### GUID Stability

The overlay system is keyed by GUID, not by position or pointer. This is crucial because:

1. **Split items need matching**: When splitting a stack, the client generates a GUID for the new item. The server uses the same GUID so the client can match them.
2. **Pointers change**: The server creates its own item instance. The predicted item and server item are different objects with the same GUID.
3. **Position changes**: An item might move between prediction and confirmation. GUID matching still works.

For operations that create new items (like stack splits), the client generates the GUID before sending the operation to the server. The server then uses that same GUID when creating the authoritative item.

***

<details class="gb-toggle">

<summary>Deep Dive</summary>

For implementation details including the data structures, recording algorithms, and cache rebuild mechanics, see [Overlay Internals](overlay-internals.md).

</details>

***

### Next Steps

Learn what happens when the server responds in [Reconciliation](../reconciliation/).
