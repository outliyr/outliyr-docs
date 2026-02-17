# How Transactions Work

A transaction is a batch of operations that execute atomically, all succeed or all fail. This page explains the execution model, how deltas enable rollback, and the flow from request to completion.

***

### The Mental Model

{% stepper %}
{% step %}
#### Begin

Start a new transaction context.
{% endstep %}

{% step %}
#### Validate

Check all operations are valid.
{% endstep %}

{% step %}
#### Execute

Apply operations, recording what changed.
{% endstep %}

{% step %}
#### Commit or Rollback

On success, finalize; on failure, undo everything.
{% endstep %}
{% endstepper %}

The key insight: **validation happens before any mutations**. If operation 3 of 5 would fail, we discover this before touching anything.

***

## Transaction Request Structure

A transaction starts with `FItemTransactionRequest`:

```cpp
USTRUCT(BlueprintType)
struct FItemTransactionRequest
{
    // Operations to execute (polymorphic via FInstancedStruct)
    TArray<FInstancedStruct> Ops;

    // Client-provided ID for correlating results
    FGuid ClientRequestId;

    // Optional: action that triggered this transaction
    FGameplayTag SourceActionTag;
};
```

Each element in `Ops` is an `FInstancedStruct` containing a derived operation type (Move, Split, etc.). Operations execute in array order.

```cpp
// Building a request
FItemTransactionRequest Request;
Request.ClientRequestId = FGuid::NewGuid();
Request.AddMoveOp(SourceSlot, DestSlot);
Request.AddModifyTagStackOp(AmmoSlot, AmmoTag, -5);
```

***

### Execution Flow

#### 1. Pre-Filter (`ShouldAbilityRespondToEvent`)

Before the ability activates, a quick check determines if the request is worth processing:

* Are there any operations?
* Are the slot descriptors valid types?
* Does the player exist?

This catches obviously invalid requests without spinning up the full ability.

#### 2. Validation Phase

The ability validates every operation before applying any:

```cpp
for (const FInstancedStruct& Op : Request.Ops)
{
    if (!ValidateOp(Op, Context))
    {
        // Reject entire transaction
        return EItemTransactionResult::Failed_Validation;
    }
}
```

Validation checks depend on the operation type:

* **Move**: Source has item, destination can accept it, permissions allow
* **Split**: Source has stackable item, amount valid, destination empty
* **Remove**: Source has item, removal policy valid
* **Add**: Destination can accept, item definition valid

> [!INFO]
> It is better not to send massive transaction batches as they are more likely to fail. Instead think of a transaction batch as the minimum number of operation necessary to achieve a specific state

#### 3. Execution Phase

Once validated, operations execute in order:

```cpp
for (const FInstancedStruct& Op : Request.Ops)
{
    ExecuteOp(Op, Context, Record);
}
```

Each operation:

1. Performs its mutations (add, remove, modify)
2. Records deltas in the `FPredictionKeyRecord`
3. Stamps containers for prediction tracking (if applicable)

#### 4. Delta Recording

Every mutation is recorded as an `FItemTransactionDelta`:

```cpp
USTRUCT()
struct FItemTransactionDelta
{
    TWeakInterfacePtr<ILyraItemContainerInterface> Container;
    FInstancedStruct SlotInfo;
    TObjectPtr<ULyraInventoryItemInstance> Item;
    bool bWasAddition;  // true = added, false = removed

    // For stack modifications
    bool bIsStackModification;
    FGameplayTag ModifiedTag;
    int32 OldStackCount;
    int32 NewStackCount;
};
```

Deltas are stored in chronological order. A move operation records two deltas:

```
[0] Remove ItemA from Inventory[5]     (bWasAddition = false)
[1] Add ItemA to Equipment[Primary]    (bWasAddition = true)
```

#### 5. Rollback (If Needed)

If the server rejects or a later operation fails, rollback iterates deltas **in reverse**:

```cpp
for (int32 i = Record.Deltas.Num() - 1; i >= 0; --i)
{
    const FItemTransactionDelta& Delta = Record.Deltas[i];

    if (Delta.bWasAddition)
    {
        // Undo add = remove
        Delta.Container->RemoveItemFromSlot(Delta.SlotInfo, PredictionKey);
    }
    else
    {
        // Undo remove = add back
        Delta.Container->AddItemToSlot(Delta.SlotInfo, Delta.Item, PredictionKey, /*bForce*/true);
    }
}
```

The `bForceAdd` flag bypasses validation during rollback, we're restoring known-good state, not validating a new operation.

***

### Prediction Integration

When running on a predicting client:

1. **Check prediction support**: Query each involved container via `CanParticipateInClientPrediction()`
2. **If all support prediction**: Execute locally, record deltas, wait for server
3. **If any don't support**: Skip local execution, wait for server replication

> [!INFO]
> **Mixed prediction scenarios:** If a transaction involves both predicting and non-predicting containers, the entire transaction runs without prediction. This ensures consistency, you don't want half the operation to predict and half to wait.

The execution context tracks this:

```cpp
struct FItemTransactionContext
{
    TWeakObjectPtr<APlayerController> PC;
    FPredictionKey PredictionKey;
    bool bIsServerExecution;
    bool bAllowPrediction;  // Set after checking all containers

    bool ShouldRunLocalPrediction() const
    {
        return bAllowPrediction && !bIsServerExecution && PredictionKey.IsLocalClientKey();
    }
};
```

***

### Server Confirmation

After client prediction, the server runs the same transaction:

1. **Server validates**: Same checks as client
2. **Server executes**: Authoritative mutations
3. **Server responds**: Confirms or rejects the prediction key

**On confirmation:**

* Client's overlays are cleared
* Server state replicates and replaces overlay data
* Deltas are discarded (no longer needed)

**On rejection:**

* Client rolls back using recorded deltas
* UI auto-corrects to match server state
* Error feedback sent via `FItemTransactionResultMessage`

***

### The Prediction Key Record

All deltas for a prediction are stored together:

```cpp
USTRUCT()
struct FPredictionKeyRecord
{
    FPredictionKey Key;
    TArray<FItemTransactionDelta> Deltas;
    TArray<TWeakObjectPtr<ULyraInventoryItemInstance>> PendingDestructions;
};
```

`PendingDestructions` handles items marked for destruction—they aren't destroyed until the server confirms. On rejection, they're restored via the normal delta mechanism.

***

### Example: Move with Swap

Player drags ItemA to a slot containing ItemB.

{% stepper %}
{% step %}
#### Validation

* Check ItemA exists at source ✓
* Check destination slot accepts ItemA ✓
* Query `GetOccupiedSlotBehavior()` → returns `Swap`
* Check source slot accepts ItemB (for the swap) ✓
{% endstep %}

{% step %}
#### Execution

Delta\[0]: Remove ItemA from Inventory\[3]\
Delta\[1]: Remove ItemB from Equipment\[Primary]\
Delta\[2]: Add ItemA to Equipment\[Primary]\
Delta\[3]: Add ItemB to Inventory\[3]
{% endstep %}

{% step %}
#### Rollback (if rejected)

Undo in reverse order:

Undo Delta\[3]: Remove ItemB from Inventory\[3]\
Undo Delta\[2]: Remove ItemA from Equipment\[Primary]\
Undo Delta\[1]: Add ItemB to Equipment\[Primary]\
Undo Delta\[0]: Add ItemA to Inventory\[3]

Result: Both items return to their original positions.
{% endstep %}
{% endstepper %}

***

### Transaction Results

Transactions broadcast results via `FItemTransactionResultMessage`:

```cpp
USTRUCT()
struct FItemTransactionResultMessage
{
    EItemTransactionResult Result;  // Success, Failed_Validation, etc.
    int32 PredictionKeyCurrent;
    FGuid ClientRequestId;          // Echoed from request
    FText ErrorMessage;
    TWeakObjectPtr<AActor> Instigator;
};
```

UI can listen for this to show feedback:

```cpp
enum class EItemTransactionResult : uint8
{
    Success,
    Failed_Validation,
    Failed_ServerRejected,
    Failed_ActivationRejected,
    Failed_Timeout
};
```

> [!INFO]
> The [interaction view mode](../../../ui/item-container-ui-system/interaction-and-transactions/ui-transaction-pipeline.md)l utilizes this for feedback on item movement

***

### Key Principles

1. **Validate first**: All operations validated before any execute
2. **Record everything**: Every mutation becomes a delta
3. **Reverse to rollback**: Undo in reverse chronological order
4. **Force during rollback**: Skip validation when restoring state
5. **All or nothing**: Partial success is not an option

***

### Deep Dive

For the complete execution flow with code details, see [Execution Deep Dive](execution-deep-dive.md).

***

### Next Steps

Learn about the available operation types in [Operation Types](../operation-types.md).
