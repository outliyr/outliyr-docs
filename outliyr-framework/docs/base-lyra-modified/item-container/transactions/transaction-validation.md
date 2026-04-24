# Transaction Validation

Before any transaction executes, it must pass validation. This page explains the two-stage validation process and how each operation type is validated, including which permissions are required.

***

## Two-Stage Validation

Validation happens in two phases, each serving a different purpose.

### Stage 1: Pre-Filter (Cheap Checks)

Before the ability even activates, `ShouldAbilityRespondToEvent` performs quick sanity checks:

```cpp
bool ShouldAbilityRespondToEvent(const FGameplayEventData& EventData)
{
    // Is the request valid?
    if (!Request.HasOps()) return false;

    // Are slot descriptors recognizable types?
    for (const FInstancedStruct& Op : Request.Ops)
    {
        if (!IsKnownOpType(Op)) return false;
    }

    // Does the player exist?
    if (!PC) return false;

    return true;
}
```

Purpose: Reject obviously invalid requests without allocating ability resources.

What it checks:

* Request has at least one operation
* Operation types are recognized
* Basic data is present (player controller, slots)

What it skips:

* Container resolution (requires object lookups)
* Item existence checks (requires container queries)
* Full permission validation (requires permission component access)

### Stage 2: Full Validation

Once the ability activates, each operation is fully validated:

```cpp
for (const FInstancedStruct& Op : Request.Ops)
{
    if (!ValidateOp(Op, Context))
    {
        RejectTransaction(EItemTransactionResult::Failed_Validation);
        return;
    }
}
```

What it checks:

* Containers can be resolved from slot descriptors
* Items exist in source slots
* Destinations can accept items
* Stack counts are valid
* Permissions allow the operation
* Container limits aren't exceeded

Only after **all** operations pass validation do any execute.

***

## Permissions in Validation

Each operation's final validation step checks the caller's permissions on the relevant containers. Different operations require different permission flags.

| Operation              | Required Permissions                                              |
| ---------------------- | ----------------------------------------------------------------- |
| Move (same container)  | `MoveItems` on container                                          |
| Move (cross-container) | `TakeOutItems` on source, `PutInItems` on destination             |
| ModifyTagStack         | `ModifyStack` on target container                                 |
| SplitStack             | `MoveItems` + `ModifyStack` on source, `MoveItems` on destination |
| AddItem                | `PutInItems` on destination                                       |
| RemoveItem             | `TakeOutItems` on source                                          |

{% hint style="info" %}
For full details on how Access Rights and Permissions work, including the enum definitions, the permission component, and the interface API, see the [Access Rights & Permissions](../../items/access-rights-and-permissions/) section.
{% endhint %}

***

## Validation Per Operation Type

Each operation type has specific validation requirements beyond permissions.

### Move Validation

<details>

<summary>C++ example</summary>

```cpp
bool ValidateMove(const FItemTxOp_Move& Op, FItemTransactionContext& Context)
{
    // 1. Resolve containers
    ILyraItemContainerInterface* SourceContainer = Op.SourceSlot.ResolveContainer(PC);
    ILyraItemContainerInterface* DestContainer = Op.DestSlot.ResolveContainer(PC);
    if (!SourceContainer || !DestContainer) return false;

    // 2. Check permissions
    bool bSameContainer = AreSlotsInSameContainer(Source, Dest, PC);
    if (bSameContainer)
    {
        if (!SourceView->HasPermission(PC, MoveItems)) return false;
    }
    else
    {
        if (!SourceView->HasPermission(PC, TakeOutItems)) return false;
        if (!DestView->HasPermission(PC, PutInItems)) return false;
    }

    // 3. Get source item
    ULyraInventoryItemInstance* Item = SourceContainer->GetItemInSlot(Op.SourceSlot);
    if (!Item) return false;

    // 4. Check source allows removal
    if (SourceContainer->CanRemoveItem(Op.SourceSlot, Item, PC) == 0)
        return false;

    // 5. Check destination acceptance
    if (!DestContainer->CanAcceptItem(Op.DestSlot, Item, PC))
    {
        // Check for swap behavior
        ULyraInventoryItemInstance* ExistingItem = DestContainer->GetItemInSlot(Op.DestSlot);
        if (!ExistingItem) return false;

        EContainerOccupiedSlotBehavior Behavior =
            DestContainer->GetOccupiedSlotBehavior(Op.DestSlot, Item, ExistingItem);

        if (Behavior == Reject) return false;

        // For swaps, also check source can accept the swapped item
        if (Behavior == Swap)
        {
            if (!SourceContainer->CanAcceptItem(Op.SourceSlot, ExistingItem, PC, true))
                return false;
        }
    }

    return true;
}
```

</details>

Move validation steps:

{% stepper %}
{% step %}
**Resolve containers**

Resolve source and destination containers from the slot descriptors. If either cannot be resolved, validation fails.
{% endstep %}

{% step %}
**Check permissions**

For internal moves (same container): requires `MoveItems`. For cross-container moves: requires `TakeOutItems` on source and `PutInItems` on destination.
{% endstep %}

{% step %}
**Get source item**

Ensure there is an item in the source slot. If no item exists, validation fails.
{% endstep %}

{% step %}
**Check source allows removal**

The source container's `CanRemoveItem` is called to verify the item can be removed. Containers can override this to prevent removal of certain items.
{% endstep %}

{% step %}
**Check destination acceptance**

Verify the destination can accept the item. If occupied, check swap behavior. For swaps, also verify the source can accept the swapped item back.
{% endstep %}
{% endstepper %}

### ModifyTagStack Validation

<details>

<summary>C++ example</summary>

```cpp
bool ValidateModifyTagStack(const FItemTxOp_ModifyTagStack& Op, FItemTransactionContext& Context)
{
    // 1. Check permission
    if (!TargetSlot.HasPermission(PC, ModifyStack)) return false;

    // 2. Validate tag
    if (!Op.Tag.IsValid()) return false;

    // 3. Validate delta
    if (Op.DeltaAmount == 0) return false;

    // 4. Resolve and get item
    ILyraItemContainerInterface* Container = Op.TargetSlot.ResolveContainer(PC);
    ULyraInventoryItemInstance* Item = Container->GetItemInSlot(Op.TargetSlot);
    if (!Item) return false;

    // 5. Check resulting value
    int32 CurrentValue = Item->GetStatTagStackCount(Op.Tag);
    int32 NewValue = CurrentValue + Op.DeltaAmount;

    if (!Op.bClampToBounds)
    {
        if (NewValue < 0) return false;
    }

    return true;
}
```

</details>

ModifyTagStack validation steps:

{% stepper %}
{% step %}
**Check permission**

Verify the caller has `ModifyStack` permission on the target container.
{% endstep %}

{% step %}
**Validate tag and delta**

The gameplay tag must be valid and the delta amount must be non-zero.
{% endstep %}

{% step %}
**Resolve and get item**

Resolve the container and fetch the target item. If missing, validation fails.
{% endstep %}

{% step %}
**Check resulting value**

Compute the new tag stack value and ensure it stays within bounds (unless `bClampToBounds` is enabled, which clamps instead of failing).
{% endstep %}
{% endstepper %}

### SplitStack Validation

<details>

<summary>C++ example</summary>

```cpp
bool ValidateSplitStack(const FItemTxOp_SplitStack& Op, FItemTransactionContext& Context)
{
    // 1. Check permissions
    if (!SourceView->HasPermission(PC, MoveItems) ||
        !SourceView->HasPermission(PC, ModifyStack))
        return false;

    if (!DestView->HasPermission(PC, MoveItems))
        return false;

    // 2. Valid split amount
    if (Op.AmountToSplit <= 0) return false;

    // 3. Source has stackable item with enough quantity
    ULyraInventoryItemInstance* Item = GetItemFromSlot(Op.SourceSlot);
    if (!Item) return false;

    int32 CurrentStack = Item->GetStackCount();
    if (Op.AmountToSplit >= CurrentStack) return false;

    // 4. Destination is empty
    if (DestContainer->GetItemInSlot(Op.DestSlot) != nullptr) return false;

    // 5. GUID provided
    if (!Op.SplitItemGUID.IsValid()) return false;

    return true;
}
```

</details>

SplitStack validation steps:

{% stepper %}
{% step %}
**Check permissions**

Source container requires both `MoveItems` and `ModifyStack` permissions. Destination container requires `MoveItems`.
{% endstep %}

{% step %}
**Valid split amount**

Ensure the split amount is > 0 and less than the current stack count (cannot split the entire stack).
{% endstep %}

{% step %}
**Source has item**

Confirm the source contains an item.
{% endstep %}

{% step %}
**Destination is empty**

Resolve destination and ensure its slot is empty.
{% endstep %}

{% step %}
**GUID provided**

A valid GUID for the split item must be included for prediction reconciliation.
{% endstep %}
{% endstepper %}

### AddItem Validation

<details>

<summary>C++ example</summary>

```cpp
bool ValidateAddItem(const FItemTxOp_AddItem& Op, FItemTransactionContext& Context)
{
    // 1. Resolve destination
    ILyraItemContainerInterface* DestContainer = Op.DestSlot.ResolveContainer(PC);
    if (!DestContainer) return false;

    // 2. Check permission
    if (!DestView->HasPermission(PC, PutInItems)) return false;

    // 3. Validate item source
    if (Op.IsAddExisting())
    {
        if (!Op.ExistingItem.IsValid()) return false;
    }
    else if (Op.IsCreateNew())
    {
        if (!Op.ItemDef) return false;
        if (Op.StackCount <= 0) return false;
        if (!Op.ItemGUID.IsValid()) return false;
    }
    else
    {
        return false; // Must specify either ItemDef or ExistingItem
    }

    return true;
}
```

</details>

AddItem validation steps:

{% stepper %}
{% step %}
**Resolve destination**

Resolve the destination container from the slot descriptor.
{% endstep %}

{% step %}
**Check permission**

Verify the caller has `PutInItems` permission on the destination container.
{% endstep %}

{% step %}
**Validate item source**

For creating new items: `ItemDef` must be valid, `StackCount` must be positive, and a client-generated `ItemGUID` is required. For adding existing items: the item reference must still be valid.
{% endstep %}
{% endstepper %}

### RemoveItem Validation

<details>

<summary>C++ example</summary>

```cpp
bool ValidateRemoveItem(const FItemTxOp_RemoveItem& Op, FItemTransactionContext& Context)
{
    // 1. Resolve and get item
    ILyraItemContainerInterface* Container = Op.SourceSlot.ResolveContainer(PC);
    if (!Container) return false;

    // 2. Check permission
    if (!SourceView->HasPermission(PC, TakeOutItems)) return false;

    // 3. Get item
    ULyraInventoryItemInstance* Item = Container->GetItemInSlot(Op.SourceSlot);
    if (!Item) return false;

    // 4. Check removal allowed
    if (Container->CanRemoveItem(Op.SourceSlot, Item, PC) == 0) return false;

    // 5. Validate quantity (partial removal)
    if (Op.QuantityToRemove > 0)
    {
        int32 StackCount = Item->GetStackCount();
        if (Op.QuantityToRemove > StackCount) return false;

        // Partial removal needs a GUID for the split item
        if (Op.QuantityToRemove < StackCount && !Op.SplitItemGUID.IsValid())
            return false;
    }

    return true;
}
```

</details>

RemoveItem validation steps:

{% stepper %}
{% step %}
**Resolve and get item**

Resolve the container and confirm an item exists in the source slot.
{% endstep %}

{% step %}
**Check permission**

Verify the caller has `TakeOutItems` permission on the source container.
{% endstep %}

{% step %}
**Check removal allowed**

The container's `CanRemoveItem` is called to verify removal is permitted.
{% endstep %}

{% step %}
**Validate quantity (partial removal)**

If `QuantityToRemove` is specified, it must not exceed the stack count. Partial removals also require a client-generated `SplitItemGUID`.
{% endstep %}
{% endstepper %}

***

## Rejection Feedback

When validation or apply fails, the transaction carries back both a human-readable message and a structured `FGameplayTag` that the UI can branch on. This avoids parsing localised strings at the UI layer and lets plugins extend the rejection vocabulary without touching core.

### `FItemRejectionReason`

Every validator takes an `FItemRejectionReason& OutRejection` parameter. The struct holds two fields:

```cpp
USTRUCT(BlueprintType)
struct FItemRejectionReason
{
    FGameplayTag Reason;   // Lyra.Item.Reject.* — used for UI branching
    FText Message;         // Player-facing display text
};
```

Two setter conventions cover the player-facing and developer-facing cases:

* `Set(Tag, Message)` — for rejections the player can understand and react to, such as missing permission, slot occupied, or container full. The message is purpose-written for display.
* `SetDev(Tag)` — for rejections the player should never see, such as null world, stale handle, or malformed op payload. `Message` is set to the generic `"Action couldn't complete"`, and the technical detail is emitted via `UE_LOG(LogItemContainerPrediction, Warning, ...)` at the call site.

### Flow from validator to UI

A rejection propagates through four layers:

{% stepper %}
{% step %}
**Validator sets the rejection**

Each `Validate`, `ValidateTyped`, `Apply`, `ApplyTyped`, `CanAcceptItem`, `CanRemoveItem`, `CanAddItemToContainer`, and `CombineItems` method populates `OutRejection` before returning false.
{% endstep %}

{% step %}
**Handler returns up the stack**

The transaction op handler returns false with the populated rejection; the transaction ability's `ExecuteTransaction` catches it and holds both fields on the stack.
{% endstep %}

{% step %}
**Ability broadcasts the gameplay message**

`BroadcastTransactionResult` forwards both `RejectReason` and `ErrorMessage` into `FItemTransactionResultMessage` and sends it on the `Lyra.Item.Message.TransactionResult` gameplay message channel.
{% endstep %}

{% step %}
**UI receives and branches**

Widgets subscribe to the gameplay message directly for the categories they care about. A crafting widget watches `Lyra.Item.Reject.Craft.*`; a tetris grid watches `Lyra.Item.Reject.Layout.*`. See [Interaction & Transactions](../../ui/item-container-ui-system/interaction-and-transactions/) for subscription snippets.
{% endstep %}
{% endstepper %}

#### Tag hierarchy

Tags live under `Lyra.Item.Reject.*` and are grouped by category. Leaf tags identify specific reasons; parent tags are used by UI listeners for broad category matching.

<details>

<summary>Base categories, declared in <code>LyraItemRejectionTags.h</code></summary>

| Category       | Examples                                                                                                                         | When it fires                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Op.*`         | `InvalidStruct`, `UnknownType`, `InvalidMode`, `InvalidDelta`, `InvalidAmount`                                                   | Malformed operation payload. Dev-camp.                    |
| `Slot.*`       | `Invalid`, `Empty`, `Occupied`, `OutOfBounds`, `Inaccessible`                                                                    | Slot descriptor malformed or target slot in wrong state.  |
| `Container.*`  | `NotFound`, `Full`, `CannotAccept`, `AddFailed`, `RemoveFailed`, `SwapFailed`                                                    | Container could not be resolved or refused the operation. |
| `Item.*`       | `Invalid`, `NotFound`, `MissingDefinition`, `RemovalBlocked`, `CreationFailed`, `DuplicationFailed`, `CombineFailed`, `Mismatch` | Item instance state or identity problem.                  |
| `Stack.*`      | `Insufficient`, `Full`, `InvalidAmount`, `TooLarge`                                                                              | Stack count constraints.                                  |
| `Permission.*` | `PutIn`, `TakeOut`, `Move`, `ModifyStack`, `Hold`, `ReadOnly`                                                                    | Caller lacks a permission flag.                           |
| `Capacity.*`   | `WeightExceeded`, `ItemCountExceeded`, `NoSpaceForCombineResult`                                                                 | Container weight or count limit.                          |
| `Pickup.*`     | `NotFound`, `NoTemplate`, `NotPickupable`                                                                                        | World-pickup source errors.                               |
| `System.*`     | `NoWorld`, `NoSubsystem`                                                                                                         | Engine preconditions. Dev-camp.                           |
| `Prediction.*` | `MissingGUID`, `ReconciliationFailed`                                                                                            | Client-prediction reconciliation. Dev-camp.               |
| `Validation.*` | `InvalidSlotData`, `WrongContainer`                                                                                              | Internal routing. Dev-camp.                               |

</details>

<details>

<summary>Tetris plugin categories, declared in <code>TetrisInventoryRejectionTags.h</code></summary>

| Category    | Examples                                                        | When it fires                            |
| ----------- | --------------------------------------------------------------- | ---------------------------------------- |
| `Layout.*`  | `CellOccupied`, `OutOfBounds`, `InvalidSlot`, `InvalidRotation` | Grid-geometry rejections.                |
| `Shape.*`   | `InvalidFit`, `Empty`, `NoFit`                                  | Item shape does not fit.                 |
| `Nesting.*` | `Cycle`, `TooDeep`                                              | Parent-child container hierarchy guards. |
| `Craft.*`   | `InvalidItem`, `InsufficientQuantity`                           | Recipe combine constraints.              |

</details>

### Extending the hierarchy

Plugins declare additional tags under the same `Lyra.Item.Reject.*` namespace in their own native tag headers. No core change is required, UI listeners that match on a category parent tag automatically pick up plugin leaves.

```cpp
// In your plugin's native tag header
YOURMODULE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Reject_MyFeature_CustomRule);

// And in the accompanying cpp
UE_DEFINE_GAMEPLAY_TAG_COMMENT(Reject_MyFeature_CustomRule,
    "Lyra.Item.Reject.MyFeature.CustomRule", "Description for the editor.");
```

Emit the tag from any validator:

```cpp
OutRejection.Set(Reject_MyFeature_CustomRule,
    LOCTEXT("MyRuleFailed", "Short player message"));
return false;
```

***

## Containers Without Permissions

Not all containers use permissions. The slot descriptor's `HasPermission` defaults to allowing operations:

```cpp
// In FAbilityData_SourceItem base
virtual bool HasPermission(APlayerController* PC, EItemContainerPermissions Perm) const
{
    return true;  // Default: no permissions = full access
}
```

Simple containers can skip the permission component entirely. When no permission component is present, all operations are allowed by default.

***
