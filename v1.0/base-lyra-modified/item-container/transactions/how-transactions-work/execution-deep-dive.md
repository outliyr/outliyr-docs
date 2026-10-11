# Execution Deep Dive

This page provides a detailed technical walkthrough of transaction execution, covering the ability internals, type dispatch, delta recording, and rollback mechanics.

> [!WARNING]
> This is a deep dive on the transaction system, you do not need to understand this page to be able to use the item transaction system. Feel free to skip this page if you aren't interested in the internals and don't plan to modify it.

***

## Entry Points

Transactions enter the system through three paths:

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### UI-Triggered Transactions

The UI builds an `FItemTransactionRequest` and calls the function library. The library packages the request into a gameplay event and sends it to the ability system.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Ability-Triggered Transactions

Abilities that are already in an ability context can call `ExecuteTransaction` directly, passing their current prediction key.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Event-Based Activation

The transaction ability activates via gameplay event tag. It extracts the request from the event payload and executes it.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## The Transaction Ability

`ULyraItemTransactionAbility` is a `LocalPredicted` gameplay ability that coordinates transaction execution.

> [!INFO]
> This means each player must be granted this ability for client prediction to take place.

### Key Data Structures

Prediction bookkeeping lives on a `FItemTransactionPredictionState` member the ability composes by value. The ability owns the GAS lifecycle entry points; the state struct owns the pending-transaction maps and the three-phase rollback/replay machinery.

| Structure                  | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `BoundPredictionKeys`      | Tracks which prediction keys have delegates bound (avoids double-binding) |
| `BoundKeyObjects`          | Stores `FPredictionKey` objects to ensure delegate lifetime               |
| `PendingTransactions`      | Maps transaction IDs to prediction records for rollback                   |
| `TxToPredictionKeyCurrent` | Maps transaction GUID to prediction key ID                                |
| `PredictionKeyToTxId`      | Reverse lookup from key ID to transaction GUID                            |

### Lifecycle

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Activation

Event triggers ability, prediction key is established.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Pre-filter

`ShouldAbilityRespondToEvent` does cheap validation.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Execution

`ExecuteTransaction` validates and applies ops.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Recording

Deltas stored in `PendingTransactions`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Confirmation/Rejection

Delegates fire, overlays cleared or rolled back.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### End

Ability ends, cleanup runs.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Pre-Filter: ShouldAbilityRespondToEvent

Before the ability activates, a quick check rejects obviously invalid requests. This is a performance optimization, rejecting bad requests before activation is cheaper than activating and then failing.

What Pre-Filter Checks

* Ops array is non-empty
* Player controller exists
* Slot descriptors are valid types
* Basic permission checks (read-only)

What Pre-Filter Skips

These require object lookups or complex validation, so they're deferred to full execution:

* Container resolution
* Item existence checks
* Stack count validation
* Geometry checks (Tetris inventory)

> [!INFO]
> Pre-filter is intended to be cheap, anything requiring container/object lookups is deferred to full validation.

***

## ExecuteTransaction: The Core Loop

The main execution method follows a strict sequence to ensure atomicity.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Build Context

```
ExecutionContext = {
    PlayerController,
    PredictionKey,
    bIsAuthority,
    Request
}
```
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Check Prediction Capability

Before executing, resolve all containers and check if they support prediction:

```
for each op in Request.Operations:
    Container = ResolveContainer(op.SlotInfo)
    Container.CollectPredictableContainerHelpers(PC, Helpers)
    if Helpers is empty:
        bAllContainersSupportPrediction = false
        break

if not bAllContainersSupportPrediction:
    // Downgrade to server-only execution
    // Client skips local mutation entirely, waits for server replication
```

This prevents "limbo" states where some changes are predicted and others aren't.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Validation Phase

> [!DANGER]
> Critical rule: Validate ALL operations before applying ANY.

```
for each op in Request.Operations:
    ValidationResult = ValidateOp(op, Context)
    if ValidationResult.Failed:
        return TransactionFailed(ValidationResult.Reason)
```

If any operation fails validation, the entire transaction fails immediately, no partial execution. This ensures atomicity.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Create Prediction Record

```
if bClientPrediction:
    Record = CreatePredictionRecord(Request.TransactionId)
    Record.PredictionKey = Context.PredictionKey
```
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Apply Phase

```
for each op in Request.Operations:
    if ShouldRunOnThisContext(op, Context):
        Delta = ApplyOp(op, Context)
        Record.RecordedDeltas.Add(Delta)

        if ApplyFailed:
            // Shouldn't happen after validation, but defensive
            RollbackPreviousDeltas(Record)
            return TransactionFailed("Apply failed unexpectedly")
```
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Store Record and Bind Delegates

```
if bClientPrediction and Record.HasDeltas():
    PendingTransactions.Add(Request.TransactionId, Record)

    if not AlreadyBound(Context.PredictionKey):
        BindRejectionDelegate(Context.PredictionKey)
        BindCaughtUpDelegate(Context.PredictionKey)
```
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Finalize Destructions

```
if bIsAuthority:
    for each Item in PendingDestructions:
        FinalizeDestroy(Item)
```

Items are destroyed only after all ops succeed, ensuring rollback can restore them if needed.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Type Dispatch

The ability uses a dispatch pattern to route operations to type-specific handlers:

```
switch op.Type:
    case Move:
        Validate: CheckSourceHasItem, CheckDestCanAccept, CheckPermissions
        Apply:    RemoveFromSource, AddToDest, RecordBothDeltas

    case ModifyTagStack:
        Validate: CheckItemExists, CheckStackLimits, CheckPermissions
        Apply:    ModifyStack, RecordStackDelta

    case SplitStack:
        Validate: CheckSourceStack >= SplitAmount, CheckDestEmpty
        Apply:    CreateNewItem, ReduceSourceStack, AddToDestination

    case RemoveItem:
        Validate: CheckItemExists, CheckPermissions
        Apply:    RemoveItem, HandleRemovalPolicy (Destroy/Drop/Hold)

    case AddItem:
        Validate: CheckDestCanAccept, CheckPermissions
        Apply:    AddItemToSlot, RecordAddDelta
```

***

## Delta Recording

Every mutation records a delta for potential rollback.

### Delta Structure

```
Delta = {
    Container,      // Which container was modified
    SlotInfo,       // Which slot was affected
    Item,           // The item instance involved
    bWasAddition,   // True for add, false for remove

    // For stack modifications:
    ModifiedTag,
    OldStackCount,
    NewStackCount,

    // For internal moves:
    SourceSlot,
    DestSlot
}
```

### Recording Example: Move Operation

Moving an item from slot A to slot B records two deltas:

```
Delta[0] = { Container: Source, Slot: A, Item: X, bWasAddition: false }
Delta[1] = { Container: Dest,   Slot: B, Item: X, bWasAddition: true }
```

Both deltas reference the same item instance, enabling proper rollback.

***

## Rollback Mechanics

Rejection rollback runs as a three-phase pipeline against every pending prediction the client still has in flight. The reverse-order intra-transaction delta inversion is the inner loop inside Phase 2; the outer loops decide which transactions to undo and in what order.

### The Rollback Process

```
function OnPredictionKeyRejected(RejectedKeyId):
    // Phase 1: classify ascending
    Walk pending keys oldest-to-newest:
        Look up the transaction record
        If the key is the rejected key:
            Seed the invalidated set with the rejected transaction's footprint
            Capture the rejected transaction for Phase 2
            continue
        If the transaction's footprint overlaps the invalidated set:
            Append to AffectedTransactions in arrival order
            Merge its footprint into the invalidated set
        Else:
            Leave it pending and untouched

    // Phase 2: roll back newest-first
    For Affected in AffectedTransactions reversed:
        InvertDeltas(Affected.Record)         // reverse-order intra-transaction undo
        Remove pending mappings for Affected.Key
    InvertDeltas(RejectedTransaction.Record)
    Remove pending mappings for RejectedKeyId
    BroadcastTransactionResult(Failed_ServerRejected, RejectedKeyId, ...)

    // Phase 3: replay oldest-first
    For Affected in AffectedTransactions in original order:
        If Affected.Record is replay-unsafe:
            BroadcastTransactionResult(Failed_ReplayInvalidated, Affected.Key, ...)
            continue
        Re-run Affected.Request through ExecuteTransaction:
            On success: re-record as pending under the original key
            On failure: BroadcastTransactionResult(Failed_ReplayInvalidated, Affected.Key, ...)
```

The same three-phase pipeline runs for foreign-update-driven invalidation. The only difference is the trigger: see Authoritative Supersession below.

### Why Newest-First Rollback Across Transactions

Consider two pending predictions on the client:

```
K1: Move ItemA from Slot1 to Slot2 → State: Slot2 has ItemA
K2: Modify ItemA stack count at Slot2 → State: ItemA stack changed at Slot2
```

K1 is rejected. K2's footprint overlaps K1 (both touch ItemA), so K2 is affected.

Rolling back K1 first would invert K1's deltas while Slot2's stack count still reflects K2's modification, the post-undo state would be inconsistent with what K1 originally wrote. Rolling back K2 first puts the slot back into the state K1 created, then K1 is undone against the state K1 saw. Each transaction's undo runs against the state that transaction created. Phase 3 then replays the surviving transactions oldest-first against the post-rollback baseline, the same order the player originally requested them.

### Why Reverse-Order Within a Transaction

Within a single transaction's deltas, inversion still walks the deltas array from `Num()-1` down to `0`. For a swap:

```
Delta[0]: Remove ItemA from Slot1
Delta[1]: Remove ItemB from Slot2
Delta[2]: Add ItemA to Slot2
Delta[3]: Add ItemB to Slot1
```

Reverse-order inversion restores state in the proper sequence:

* Undo Delta\[3]: Remove ItemB from Slot1
* Undo Delta\[2]: Remove ItemA from Slot2
* Undo Delta\[1]: Add ItemB back to Slot2
* Undo Delta\[0]: Add ItemA back to Slot1

Forward rollback would fail because undoing early removals before late additions can encounter occupied slots.

### Inversion Rules

| Original Operation | Rollback Action                 |
| ------------------ | ------------------------------- |
| Addition           | Remove the item                 |
| Removal            | Add item back (with force flag) |
| Stack increase     | Restore original count          |
| Stack decrease     | Restore original count          |
| Internal move      | Move back to original slot      |

The force flag on rollback additions bypasses occupancy checks, since the slot state may have changed during prediction.

### Authoritative Supersession

Foreign replication, another player or the server changing a slot a predicting client has in flight, runs the same three-phase pipeline as rejection, with two differences:

* The trigger is `OnEntryReplicated` in the prediction runtime, not a GAS rejection RPC. The runtime detects that a replicated entry diverges from the predicted overlay and broadcasts an invalidation footprint to the transaction ability.
* Phase 2 has no separate "rejected transaction" to undo at the end. There are only affected later transactions; the foreign state is already authoritative.

The classification, rollback ordering, and replay phases are otherwise identical. Both code paths share the same dependency engine and the same replay-safety semantics.

For the algorithm in plain language, the dependency engine details, and the contracts custom op handlers and slot descriptors honour to participate, see [Rollback and Replay](../rollback-and-replay.md).

***

## Prediction Key Delegates

The ability binds to GAS prediction key delegates to know when predictions are caught up or rejected.

### Binding Logic

```
function BindDelegatesForKey(Key):
    if BoundPredictionKeys.Contains(Key.Current):
        return  // Already bound

    BoundPredictionKeys.Add(Key.Current)
    BoundKeyObjects.Add(Key)  // Prevent GC

    Key.NewRejectedDelegate().BindUObject(this, OnRejected)
    Key.NewCaughtUpDelegate().BindUObject(this, OnCaughtUp)
```

### Rejection Flow

```
function OnRejected(KeyId):
    // Enters the three-phase rejection algorithm documented above.
    PredictionState.HandlePredictionKeyRejected(KeyId)
```

The handler classifies later pending transactions against the rejected key's footprint, rolls back affected transactions newest-first along with the rejected one, and replays survivors oldest-first.

***

## Server Notification RPCs

In addition to GAS delegates, the server can explicitly notify clients of transaction results.

### Why Both Mechanisms?

GAS delegates handle ability-level rejection (activation failed, ability interrupted). But transactions can also fail during execution after activation succeeded.

The explicit RPC ensures rollback happens even when:

* Transaction validation failed on server
* Transaction apply failed on server
* GAS rejection delegate didn't fire for some reason

```
// Server calls this after transaction fails
function NotifyClientTransactionFailed(ClientId, TransactionId, Reason):
    SendRPC(ClientId, TransactionId, Reason)

// Client receives
function OnServerNotifyFailed(TransactionId, Reason):
    KeyId = TxToPredictionKeyCurrent.Find(TransactionId)
    if KeyId.IsValid():
        // Enters the same three-phase rejection algorithm as the GAS delegate path.
        PredictionState.HandlePredictionKeyRejected(KeyId)
```

Both paths converge on the same three-phase pipeline, so a rejection received through the explicit RPC produces the same classification, rollback ordering, and replay behaviour as a rejection received through the GAS delegate.

***

## Pending Destructions

Items marked for destruction aren't destroyed immediately during transaction execution.

### The Problem

If you destroy an item mid-transaction and a later operation fails, you can't roll back, the item is gone.

### The Solution

```
// During apply
function ApplyRemoveOp(Op, Context):
    Item = GetItemFromSlot(Op.Slot)
    RemoveFromContainer(Item)

    if Op.RemovalPolicy == Destroy:
        PendingDestructions.Add(Item)  // Don't destroy yet

    RecordDelta(...)

// After all ops succeed (server only)
function FinalizeDestructions():
    for each Item in PendingDestructions:
        if Item.IsValid():
            Item.Destroy()
    PendingDestructions.Empty()
```

> [!WARNING]
> **Clients never destroy items**, they wait for server replication to remove items authoritatively.

***
