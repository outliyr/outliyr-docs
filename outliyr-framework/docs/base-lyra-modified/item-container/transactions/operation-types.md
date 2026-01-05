# Operation Types

The transaction system supports five operation types, each handling a specific kind of container mutation. This page documents each type, when to use it, and how to construct it.

### Overview

| Operation                  | Purpose                                  | Predictable |
| -------------------------- | ---------------------------------------- | ----------- |
| `FItemTxOp_Move`           | Move/swap items between slots            | Yes         |
| `FItemTxOp_ModifyTagStack` | Change stack counts, durability, charges | Yes         |
| `FItemTxOp_SplitStack`     | Split a stack into two items             | Yes         |
| `FItemTxOp_RemoveItem`     | Remove item (destroy or drop)            | Yes         |
| `FItemTxOp_AddItem`        | Create or add item to container          | Yes         |

All operations derive from `FItemTransactionOpBase`:

```cpp
USTRUCT(BlueprintType)
struct FItemTransactionOpBase
{
    GENERATED_BODY()

    // If false, client skips prediction and waits for server
    bool bClientPredictable = true;

    virtual FString GetOpName() const;
};
```

### FItemTxOp\_Move

Moves an item from one slot to another. Handles same-container moves, cross-container transfers, and swaps.

#### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_Move : public FItemTransactionOpBase
{
    // Source slot descriptor
    FInstancedStruct SourceSlot;

    // Destination slot descriptor
    FInstancedStruct DestSlot;

    // Optional: specific item to move (for disambiguation)
    TWeakObjectPtr<ULyraInventoryItemInstance> ItemInstance;
};
```

#### Usage

```cpp
// Simple move
FItemTransactionRequest Request;
Request.AddMoveOp(InventorySlot, EquipmentSlot);

// Move with explicit item reference
FItemTxOp_Move MoveOp;
MoveOp.SourceSlot = InventorySlot;
MoveOp.DestSlot = EquipmentSlot;
MoveOp.ItemInstance = SpecificItem;
Request.Ops.Add(FInstancedStruct::Make(MoveOp));
```

#### Behavior

The executor queries `GetOccupiedSlotBehavior()` on the destination container:

| Behavior          | Result                                        |
| ----------------- | --------------------------------------------- |
| `Reject`          | Transaction fails                             |
| `Swap`            | Items exchange positions (generates 4 deltas) |
| `StackCombine`    | Stacks merge if compatible                    |
| `FragmentCombine` | Delegates to fragment logic                   |
| `SameItem`        | Internal repositioning (for multi-cell items) |

#### Validation

* Source slot contains an item
* Destination container can accept the item (or swap is valid)
* Player has required permissions on both containers

### FItemTxOp\_ModifyTagStack

Modifies any gameplay tag stack on an item. Generalized for stack counts, durability, charges, or custom stats.

#### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_ModifyTagStack : public FItemTransactionOpBase
{
    // Slot containing the item to modify
    FInstancedStruct TargetSlot;

    // Which tag to modify (e.g., Lyra.Inventory.Item.Count)
    FGameplayTag Tag;

    // Amount to change (negative = decrease)
    int32 DeltaAmount = 0;

    // If true, clamp to bounds instead of failing
    bool bClampToBounds = false;
};
```

#### Usage

```cpp
// Consume 5 items from a stack
Request.AddModifyTagStackOp(ItemSlot, TAG_Item_Count, -5);

// Reduce durability by 10 (clamping to 0 instead of failing)
FItemTxOp_ModifyTagStack DurabilityOp;
DurabilityOp.TargetSlot = WeaponSlot;
DurabilityOp.Tag = TAG_Item_Durability;
DurabilityOp.DeltaAmount = -10;
DurabilityOp.bClampToBounds = true;
Request.Ops.Add(FInstancedStruct::Make(DurabilityOp));
```

#### Behavior

* Reads current tag stack value
* Applies delta
* Records old/new values for rollback
* If `bClampToBounds` is false and result would be negative or exceed max, validation fails

#### Validation

* Slot contains an item
* Tag exists on the item (or can be added)
* Result stays within bounds (unless clamping)

### FItemTxOp\_SplitStack

Splits a stack, creating a new item with a portion of the original.

#### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_SplitStack : public FItemTransactionOpBase
{
    // Slot containing the stack to split
    FInstancedStruct SourceSlot;

    // Destination for the split portion
    FInstancedStruct DestSlot;

    // Amount to split off
    int32 AmountToSplit = 1;

    // Client-generated GUID for the new item (for prediction reconciliation)
    FGuid SplitItemGUID;
};
```

#### Usage

```cpp
// Split 10 items to a new slot
Request.AddSplitStackOp(SourceSlot, EmptySlot, 10);
// Note: AddSplitStackOp automatically generates the GUID

// Manual construction
FItemTxOp_SplitStack SplitOp;
SplitOp.SourceSlot = StackSlot;
SplitOp.DestSlot = TargetSlot;
SplitOp.AmountToSplit = 5;
SplitOp.SplitItemGUID = FGuid::NewGuid();  // Must generate before sending!
Request.Ops.Add(FInstancedStruct::Make(SplitOp));
```

#### Behavior

{% stepper %}
{% step %}
Reduces source item's stack count by `AmountToSplit`.
{% endstep %}

{% step %}
Creates new item with same definition.
{% endstep %}

{% step %}
Sets new item's stack count to `AmountToSplit`.
{% endstep %}

{% step %}
Adds new item to destination slot.
{% endstep %}

{% step %}
Uses `SplitItemGUID` so client can match predicted item to server item.
{% endstep %}
{% endstepper %}

#### Validation

* Source contains stackable item
* `AmountToSplit` > 0 and < current stack count
* Destination slot is empty (or can stack-combine)

{% hint style="warning" %}
**GUID is required for prediction.** The client generates `SplitItemGUID` before sending. The server uses this same GUID when creating the item, allowing the client to reconcile its predicted item with the authoritative one.
{% endhint %}

### FItemTxOp\_RemoveItem

Removes an item from a container entirely. Supports destruction, dropping to world, or transfer to holding.

#### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_RemoveItem : public FItemTransactionOpBase
{
    // Slot containing the item to remove
    FInstancedStruct SourceSlot;

    // What to do with the removed item
    EItemRemovalPolicy RemovalPolicy = EItemRemovalPolicy::Destroy;

    // For DropToWorld: override location
    FVector DropLocation = FVector::ZeroVector;

    // Drop parameters (impulse, offset, etc.)
    FDropParams DropParams;

    // Collectable classes for spawning world pickups
    TSubclassOf<AWorldCollectableBase> StaticCollectableClass;
    TSubclassOf<AWorldCollectableBase> SkeletalCollectableClass;

    // Quantity to remove (0 = entire item)
    int32 QuantityToRemove = 0;

    // For partial removal: GUID for split item
    FGuid SplitItemGUID;
};
```

#### Removal Policies

```cpp
enum class EItemRemovalPolicy : uint8
{
    Destroy,           // Item is destroyed
    DropToWorld,       // Spawn as world pickup
    TransferToHolding  // Keep in temporary storage
};
```

#### Usage

```cpp
// Destroy an item
Request.AddRemoveItemOp(ItemSlot, EItemRemovalPolicy::Destroy);

// Drop to world
FItemTxOp_RemoveItem DropOp;
DropOp.SourceSlot = ItemSlot;
DropOp.RemovalPolicy = EItemRemovalPolicy::DropToWorld;
DropOp.StaticCollectableClass = AMyPickup::StaticClass();
DropOp.DropParams.Impulse = FVector(100, 0, 200);
Request.Ops.Add(FInstancedStruct::Make(DropOp));

// Partial removal (drop 5 from a stack of 20)
FItemTxOp_RemoveItem PartialOp;
PartialOp.SourceSlot = StackSlot;
PartialOp.RemovalPolicy = EItemRemovalPolicy::DropToWorld;
PartialOp.QuantityToRemove = 5;
PartialOp.SplitItemGUID = FGuid::NewGuid();
Request.Ops.Add(FInstancedStruct::Make(PartialOp));
```

#### Behavior

* `QuantityToRemove = 0`: Removes entire item
* `QuantityToRemove > 0`: Splits stack, removes split portion
* `Destroy`: Item added to `PendingDestructions`, destroyed on confirmation
* `DropToWorld`: Spawns appropriate collectable actor

#### Validation

* Slot contains an item
* For `DropToWorld`: collectable class specified
* For partial: `QuantityToRemove` <= stack count

### FItemTxOp\_AddItem

Adds an item to a container. Supports creating new items or adding existing ones.

#### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_AddItem : public FItemTransactionOpBase
{
    // Destination slot
    FInstancedStruct DestSlot;

    // For new items: definition to instantiate
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef;

    // Stack count for new items
    int32 StackCount = 1;

    // Client-generated GUID for prediction reconciliation
    FGuid ItemGUID;

    // For existing items: item to add
    TWeakObjectPtr<ULyraInventoryItemInstance> ExistingItem;

    // Initial stat tags for new items
    TMap<FGameplayTag, int32> InitialStatTags;

    // If true, merge with existing stacks before placing
    bool bMergeWithExistingStacks = false;
};
```

#### Usage

```cpp
// Create new item
Request.AddCreateItemOp(EmptySlot, UMyItemDef::StaticClass(), 10);
// Note: AddCreateItemOp automatically generates the GUID

// Add existing item
Request.AddExistingItemOp(TargetSlot, ExistingItemPtr);

// Create with initial stats
FItemTxOp_AddItem CreateOp;
CreateOp.DestSlot = Slot;
CreateOp.ItemDef = UWeaponDef::StaticClass();
CreateOp.StackCount = 1;
CreateOp.ItemGUID = FGuid::NewGuid();
CreateOp.InitialStatTags.Add(TAG_Item_Durability, 100);
CreateOp.InitialStatTags.Add(TAG_Item_Ammo, 30);
Request.Ops.Add(FInstancedStruct::Make(CreateOp));
```

#### Modes

{% stepper %}
{% step %}
#### Create New

* `IsCreateNew() == true`
* `ItemDef` is set, `ExistingItem` is null
* Creates new instance from definition
* Uses `ItemGUID` for prediction matching
{% endstep %}

{% step %}
#### Add Existing

* `IsAddExisting() == true`
* `ExistingItem` is set
* Adds already-created item to container
* Uses item's existing GUID
{% endstep %}
{% endstepper %}

#### Merge Behavior

{% stepper %}
{% step %}
Finds existing stacks of same item type.
{% endstep %}

{% step %}
Fills them up to max stack size.
{% endstep %}

{% step %}
If quantity remains, places in destination slot.
{% endstep %}

{% step %}
If source fully merged, adds to pending destruction.
{% endstep %}
{% endstepper %}

### Validation

* Destination slot can accept item
* For create: `ItemDef` is valid
* For existing: item exists and isn't already in a container

### Combining Operations

Operations compose naturally for complex behaviors:

<details>

<summary>Craft Item (Consume + Create)</summary>

```cpp
FItemTransactionRequest Request;

// Consume ingredients
Request.AddModifyTagStackOp(IronSlot, TAG_Item_Count, -5);
Request.AddModifyTagStackOp(WoodSlot, TAG_Item_Count, -3);

// Create result
Request.AddCreateItemOp(OutputSlot, USwordDef::StaticClass());

// All three must succeed, or none do
```

</details>

<details>

<summary>Reload Weapon (Move Ammo + Modify Charges)</summary>

```cpp
FItemTransactionRequest Request;

// Remove ammo from inventory
Request.AddRemoveItemOp(AmmoSlot, EItemRemovalPolicy::Destroy);

// Set weapon ammo
Request.AddModifyTagStackOp(WeaponSlot, TAG_Weapon_Ammo, 30);
```

</details>

<details>

<summary>Swap and Consume</summary>

```cpp
FItemTransactionRequest Request;

// Swap items
Request.AddMoveOp(InventorySlot, EquipmentSlot);

// Consume a buff item
Request.AddRemoveItemOp(BuffSlot, EItemRemovalPolicy::Destroy);
```

</details>
