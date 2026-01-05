# Execution Deep Dive

This page provides a detailed technical walkthrough of transaction execution, covering the ability internals, type dispatch, delta recording, and rollback mechanics.

***

### Entry Points

Transactions enter the system through three paths:

{% stepper %}
{% step %}
#### UI-Triggered Transactions

The UI builds an `FItemTransactionRequest` and calls the function library. The library packages the request into a gameplay event and sends it to the ability system.
{% endstep %}

{% step %}
#### Ability-Triggered Transactions

Abilities that are already in an ability context can call `ExecuteTransaction` directly, passing their current prediction key.
{% endstep %}

{% step %}
#### Event-Based Activation

The transaction ability activates via gameplay event tag. It extracts the request from the event payload and executes it.
{% endstep %}
{% endstepper %}

***

### The Transaction Ability

`ULyraItemTransactionAbility` is a `LocalPredicted` gameplay ability that coordinates transaction execution.

{% hint style="info" %}
This means each player must be granted this ability for client prediction to take place.
{% endhint %}

#### Key Data Structures

The ability maintains several maps to track prediction state:

| Structure                  | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `BoundPredictionKeys`      | Tracks which prediction keys have delegates bound (avoids double-binding) |
| `BoundKeyObjects`          | Stores `FPredictionKey` objects to ensure delegate lifetime               |
| `PendingTransactions`      | Maps transaction IDs to prediction records for rollback                   |
| `TxToPredictionKeyCurrent` | Maps transaction GUID to prediction key ID                                |
| `PredictionKeyToTxId`      | Reverse lookup from key ID to transaction GUID                            |

#### Lifecycle

{% stepper %}
{% step %}
#### Activation

Event triggers ability, prediction key is established.
{% endstep %}

{% step %}
#### Pre-filter

`ShouldAbilityRespondToEvent` does cheap validation.
{% endstep %}

{% step %}
#### Execution

`ExecuteTransaction` validates and applies ops.
{% endstep %}

{% step %}
#### Recording

Deltas stored in `PendingTransactions`.
{% endstep %}

{% step %}
#### Confirmation/Rejection

Delegates fire, overlays cleared or rolled back.
{% endstep %}

{% step %}
#### End

Ability ends, cleanup runs.
{% endstep %}
{% endstepper %}

***

### Pre-Filter: ShouldAbilityRespondToEvent

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

{% hint style="info" %}
Pre-filter is intended to be cheap, anything requiring container/object lookups is deferred to full validation.
{% endhint %}

***

### ExecuteTransaction: The Core Loop

The main execution method follows a strict sequence to ensure atomicity.

{% stepper %}
{% step %}
#### Build Context

```
ExecutionContext = {
    PlayerController,
    PredictionKey,
    bIsAuthority,
    Request
}
```
{% endstep %}

{% step %}
#### Check Prediction Capability

Before executing, resolve all containers and check if they support prediction:

```
for each op in Request.Operations:
    Container = ResolveContainer(op.SlotInfo)
    if not Container.CanParticipateInClientPrediction():
        bAllContainersSupportPrediction = false
        break

if not bAllContainersSupportPrediction:
    // Downgrade to server-only execution
    // Client waits for server, no local prediction
```

This prevents "limbo" states where some changes are predicted and others aren't.
{% endstep %}

{% step %}
#### Validation Phase

{% hint style="danger" %}
Critical rule: Validate ALL operations before applying ANY.
{% endhint %}

```
for each op in Request.Operations:
    ValidationResult = ValidateOp(op, Context)
    if ValidationResult.Failed:
        return TransactionFailed(ValidationResult.Reason)
```

If any operation fails validation, the entire transaction fails immediately, no partial execution. This ensures atomicity.
{% endstep %}

{% step %}
#### Create Prediction Record

```
if bClientPrediction:
    Record = CreatePredictionRecord(Request.TransactionId)
    Record.PredictionKey = Context.PredictionKey
```
{% endstep %}

{% step %}
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
{% endstep %}

{% step %}
#### Store Record and Bind Delegates

```
if bClientPrediction and Record.HasDeltas():
    PendingTransactions.Add(Request.TransactionId, Record)

    if not AlreadyBound(Context.PredictionKey):
        BindRejectionDelegate(Context.PredictionKey)
        BindCaughtUpDelegate(Context.PredictionKey)
```
{% endstep %}

{% step %}
#### Finalize Destructions

```
if bIsAuthority:
    for each Item in PendingDestructions:
        FinalizeDestroy(Item)
```

Items are destroyed only after all ops succeed, ensuring rollback can restore them if needed.
{% endstep %}
{% endstepper %}

***

### Type Dispatch

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

### Delta Recording

Every mutation records a delta for potential rollback.

#### Delta Structure

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

#### Recording Example: Move Operation

Moving an item from slot A to slot B records two deltas:

```
Delta[0] = { Container: Source, Slot: A, Item: X, bWasAddition: false }
Delta[1] = { Container: Dest,   Slot: B, Item: X, bWasAddition: true }
```

Both deltas reference the same item instance, enabling proper rollback.

***

### Rollback Mechanics

When the server rejects a prediction, the ability triggers rollback.

#### The Rollback Process

```
function OnPredictionKeyRejected(KeyId):
    TransactionId = LookupTransactionId(KeyId)
    Record = PendingTransactions.Find(TransactionId)

    // Notify containers to clear overlays
    for each Container in Record.AffectedContainers:
        Container.OnPredictionKeyRejected(KeyId)

    // Reverse deltas in REVERSE order
    for i = Record.Deltas.Length - 1 down to 0:
        InvertDelta(Record.Deltas[i])

    // Cleanup
    PendingTransactions.Remove(TransactionId)
    BroadcastTransactionFailed(TransactionId)
```

#### Why Reverse Order?

Consider a swap operation with these deltas:

```
Delta[0]: Remove ItemA from Slot1
Delta[1]: Remove ItemB from Slot2
Delta[2]: Add ItemA to Slot2
Delta[3]: Add ItemB to Slot1
```

Forward rollback would fail because undoing early removals/additions can encounter occupied slots. Reverse-order rollback restores state in the proper sequence:

* Undo Delta\[3]: Remove ItemB from Slot1
* Undo Delta\[2]: Remove ItemA from Slot2
* Undo Delta\[1]: Add ItemB back to Slot2
* Undo Delta\[0]: Add ItemA back to Slot1

#### Inversion Rules

| Original Operation | Rollback Action                 |
| ------------------ | ------------------------------- |
| Addition           | Remove the item                 |
| Removal            | Add item back (with force flag) |
| Stack increase     | Restore original count          |
| Stack decrease     | Restore original count          |
| Internal move      | Move back to original slot      |

The force flag on rollback additions bypasses occupancy checks, since the slot state may have changed during prediction.

***

### Prediction Key Delegates

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
    TransactionId = PredictionKeyToTxId.Find(KeyId)
    if TransactionId.IsValid():
        NotifyContainersOfRejection(KeyId)
        ExecuteRollback(TransactionId)
        BroadcastFailure(TransactionId)
```

***

### Server Notification RPCs

In addition to GAS delegates, the server can explicitly notify clients of transaction results.

#### Why Both Mechanisms?

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
        ExecuteRollback(TransactionId)
        BroadcastFailure(TransactionId, Reason)
```

***

### Pending Destructions

Items marked for destruction aren't destroyed immediately during transaction execution.

#### The Problem

If you destroy an item mid-transaction and a later operation fails, you can't roll back, the item is gone.

#### The Solution

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

{% hint style="warning" %}
**Clients never destroy items**, they wait for server replication to remove items authoritatively.
{% endhint %}

***
