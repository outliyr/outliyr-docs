# Operation Types

The transaction system supports five operation types, each handling a specific kind of container mutation. This page documents each type, when to use it, and how to construct it.

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

***

## Constructing Operations

Every op type can be built two ways. `FItemTransactionRequest` exposes a short builder method for each op type that fills in common fields, validates required values, and appends the op to the request. The examples on this page call these methods `AddMoveOp`, `AddModifyTagStackOp`, and so on; throughout the page they are referred to as the **helper methods**. They exist purely for ergonomics, so callers do not have to write the same five-line struct setup at every site.

Manual construction is always available when an op needs a field the helper does not expose, such as drop parameters on `FItemTxOp_RemoveItem` or initial stat tags on `FItemTxOp_AddItem`. The two forms produce equivalent ops and the rest of the transaction system does not care which path you used.

Both forms appear side by side in the Usage section of each op below, so you can see the helper's parameter shape and the equivalent manual struct assignment at the same time.

{% hint style="info" %}
The helper methods are inline C++ only. Blueprints have no access to them, so Blueprint callers always build ops by creating the op struct, setting its fields, and adding it to the request. The Usage sections below use the helpers for brevity in C++; the manual-construction snippets show the equivalent assignment Blueprints need.
{% endhint %}

***

Moves an item from one slot to another. Handles same-container moves, cross-container transfers, and swaps.

### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_Move : public FItemTransactionOpBase
{
    // Source slot descriptor
    FInstancedStruct SourceSlot;

    // Destination slot descriptor
    FInstancedStruct DestSlot;

    // The item the player is moving. Set it so the op fails if the slot is
    // empty or now contains a different item. This can happen if another
    // player or a system modifies the slot before the op runs. Leave null to
    // move whatever the slot currently contains.
    TWeakObjectPtr<ULyraInventoryItemInstance> ItemInstance;
};
```

### Usage

{% tabs %}
{% tab title="C++" %}
```cpp
ULyraInventoryItemInstance* ClickedItem = /* the item the player selected */;

// Simple move - acts on whatever the slot currently contains
FItemTransactionRequest Request;
Request.AddMoveOp(InventorySlot, EquipmentSlot);

// Move with identity verification - fails if the slot has changed
// The Move op stores the item itself, so the helper writes ClickedItem
// straight into Op.ItemInstance.
Request.AddMoveOp(InventorySlot, EquipmentSlot, ClickedItem);

// Equivalent manual construction
FItemTxOp_Move MoveOp;
MoveOp.SourceSlot = InventorySlot;
MoveOp.DestSlot = EquipmentSlot;
MoveOp.ItemInstance = ClickedItem;
Request.Ops.Add(FInstancedStruct::Make(MoveOp));
```
{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (322).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

### Behavior

The executor queries `GetOccupiedSlotBehavior()` on the destination container:

| Behavior          | Result                                        |
| ----------------- | --------------------------------------------- |
| `Reject`          | Transaction fails                             |
| `Swap`            | Items exchange positions (generates 4 deltas) |
| `StackCombine`    | Stacks merge if compatible                    |
| `FragmentCombine` | Delegates to fragment logic                   |
| `SameItem`        | Internal repositioning (for multi-cell items) |

### Validation

* Source slot contains an item
* Destination container can accept the item (or swap is valid)
* Player has required permissions on both containers

***

## `FItemTxOp_ModifyTagStack`

Modifies any gameplay tag stack on an item. Generalized for stack counts, durability, charges, or custom stats.

### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_ModifyTagStack : public FItemTransactionOpBase
{
    // Slot containing the item to modify
    FInstancedStruct TargetSlot;
    
    // GUID of the item the player is modifying. Set it so the op fails if
    // the slot is empty or now contains a different item. This can happen if
    // another player or a system modifies the slot before the op runs. Leave
    // invalid to modify whatever the slot currently contains.
    FGuid ExpectedSourceItemGuid;

    // Which tag to modify (e.g., Lyra.Inventory.Item.Count)
    FGameplayTag Tag;

    // Amount to change (negative = decrease)
    int32 DeltaAmount = 0;

    // If true, clamp to bounds instead of failing
    bool bClampToBounds = false;
};
```

### Usage

{% tabs %}
{% tab title="C++" %}
```cpp
ULyraInventoryItemInstance* ClickedItem = /* the item the player selected */;

// Consume 5 items from a stack
Request.AddModifyTagStackOp(ItemSlot, TAG_Item_Count, -5);

// Consume 5 items with identity verification - fails if the slot has changed
// The op stores a GUID; the helper extracts ClickedItem->GetItemInstanceId()
// and writes it into Op.ExpectedSourceItemGuid.
Request.AddModifyTagStackOp(ItemSlot, TAG_Item_Count, -5, /*bClamp=*/false, ClickedItem);

// Reduce durability by 10, clamping to 0 instead of failing.
// Manual construction shows the GUID being set directly.
FItemTxOp_ModifyTagStack DurabilityOp;
DurabilityOp.TargetSlot = WeaponSlot;
DurabilityOp.ExpectedSourceItemGuid = WeaponInstance->GetItemInstanceId();
DurabilityOp.Tag = TAG_Item_Durability;
DurabilityOp.DeltaAmount = -10;
DurabilityOp.bClampToBounds = true;
Request.Ops.Add(FInstancedStruct::Make(DurabilityOp));
```


{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (325).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

### Behavior

* Reads current tag stack value
* Applies delta
* Records old/new values for rollback
* If `bClampToBounds` is false and result would be negative or exceed max, validation fails

### Validation

* Slot contains an item
* Tag exists on the item (or can be added)
* Result stays within bounds (unless clamping)

***

## `FItemTxOp_SplitStack`

Splits a stack, creating a new item with a portion of the original.

### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_SplitStack : public FItemTransactionOpBase
{
    // Slot containing the stack to split
    FInstancedStruct SourceSlot;
    
    // GUID of the item the player is splitting. Set it so the op fails if
    // the slot is empty or now contains a different item. This can happen if
    // another player or a system modifies the slot before the op runs. Leave
    // invalid to split whatever the slot currently contains.
    FGuid ExpectedSourceItemGuid;

    // Destination for the split portion
    FInstancedStruct DestSlot;

    // Amount to split off
    int32 AmountToSplit = 1;

    // Client-generated GUID for the new item (for prediction reconciliation)
    FGuid SplitItemGUID;
};
```

### Usage

{% tabs %}
{% tab title="First Tab" %}
```cpp
ULyraInventoryItemInstance* SourceItem = /* the stack the player selected */;

// Split 10 items to a new slot
Request.AddSplitStackOp(SourceSlot, EmptySlot, 10);
// Note: AddSplitStackOp automatically generates the GUID for the new item

// Split with identity verification - fails if the source slot has changed.
// The op stores a GUID; the helper extracts SourceItem->GetItemInstanceId()
// and writes it into Op.ExpectedSourceItemGuid.
Request.AddSplitStackOp(SourceSlot, EmptySlot, 10, SourceItem);

// Manual construction shows the GUID being set directly.
FItemTxOp_SplitStack SplitOp;
SplitOp.SourceSlot = StackSlot;
SplitOp.ExpectedSourceItemGuid = SourceItem->GetItemInstanceId();
SplitOp.DestSlot = TargetSlot;
SplitOp.AmountToSplit = 5;
SplitOp.SplitItemGUID = FGuid::NewGuid();  // Must generate before sending!
Request.Ops.Add(FInstancedStruct::Make(SplitOp));
```


{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (324).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

### Behavior

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

### Validation

* Source contains stackable item
* `AmountToSplit` > 0 and < current stack count
* Destination slot is empty (or can stack-combine)

{% hint style="warning" %}
**GUID is required for prediction.** The client generates `SplitItemGUID` before sending. The server uses this same GUID when creating the item, allowing the client to reconcile its predicted item with the authoritative one.
{% endhint %}

***

## `FItemTxOp_RemoveItem`

Removes an item from a container entirely. Supports destruction, dropping to world, or transfer to holding.

### Structure

```cpp
USTRUCT(BlueprintType)
struct FItemTxOp_RemoveItem : public FItemTransactionOpBase
{
    // Slot containing the item to remove
    FInstancedStruct SourceSlot;
    
    // GUID of the item the player is removing. Set it so the op fails if the
    // slot is empty or now contains a different item. This can happen if
    // another player or a system modifies the slot before the op runs. Leave
    // invalid to remove whatever the slot currently contains.
    FGuid ExpectedSourceItemGuid;

    // What to do with the removed item
    EItemRemovalPolicy RemovalPolicy = EItemRemovalPolicy::Destroy;

    // For overriding the drop location, if empty drop params will be used instead
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

### Removal Policies

```cpp
enum class EItemRemovalPolicy : uint8
{
    Destroy,           // Item is destroyed
    DropToWorld,       // Spawn as world pickup
    TransferToHolding  // Keep in temporary storage
};
```

### Usage

{% tabs %}
{% tab title="C++" %}
```cpp
ULyraInventoryItemInstance* ClickedItem = /* the item the player selected */;

// Destroy an item
Request.AddRemoveItemOp(ItemSlot, EItemRemovalPolicy::Destroy);

// Destroy with identity verification - fails if the slot has changed.
// The op stores a GUID; the helper extracts ClickedItem->GetItemInstanceId()
// and writes it into Op.ExpectedSourceItemGuid.
Request.AddRemoveItemOp(ItemSlot, EItemRemovalPolicy::Destroy, ClickedItem);

// Drop to world, with the GUID set directly through manual construction.
FItemTxOp_RemoveItem DropOp;
DropOp.SourceSlot = ItemSlot;
DropOp.ExpectedSourceItemGuid = ClickedItem->GetItemInstanceId();
DropOp.RemovalPolicy = EItemRemovalPolicy::DropToWorld;
DropOp.StaticCollectableClass = AMyPickup::StaticClass();
DropOp.DropParams.Impulse = FVector(100, 0, 200);
Request.Ops.Add(FInstancedStruct::Make(DropOp));

// Partial removal - drop 5 from a stack of 20.
FItemTxOp_RemoveItem PartialOp;
PartialOp.SourceSlot = StackSlot;
PartialOp.ExpectedSourceItemGuid = StackItem->GetItemInstanceId();
PartialOp.RemovalPolicy = EItemRemovalPolicy::DropToWorld;
PartialOp.QuantityToRemove = 5;
PartialOp.SplitItemGUID = FGuid::NewGuid();
Request.Ops.Add(FInstancedStruct::Make(PartialOp));
```


{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (326).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

### Behavior

* `QuantityToRemove = 0`: Removes entire item
* `QuantityToRemove > 0`: Splits stack, removes split portion
* `Destroy`: Item added to `PendingDestructions`, destroyed on confirmation
* `DropToWorld`: Spawns appropriate collectable actor

### Validation

* Slot contains an item
* For `DropToWorld`: collectable class specified
* For partial: `QuantityToRemove` <= stack count

***

## `FItemTxOp_AddItem`

Adds an item to a container. Supports creating new items or adding existing ones.

### Structure

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

    // Optional: source pickup actor for server validation
    TWeakObjectPtr<AActor> SourcePickupActor;
};
```

### Usage

{% tabs %}
{% tab title="C++" %}
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
CreateOp.ItemGUID = FGuid::NewGuid();  // Required for create-new; matches predicted item to server authoritative.
CreateOp.InitialStatTags.Add(TAG_Item_Durability, 100);
CreateOp.InitialStatTags.Add(TAG_Item_Ammo, 30);
Request.Ops.Add(FInstancedStruct::Make(CreateOp));
```
{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (327).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

{% hint style="warning" %}
**GUID is required for create-new prediction.** When `IsCreateNew()` is true, the client generates `ItemGUID` before sending. The server uses this same GUID when creating the item, allowing the client to reconcile its predicted instance with the authoritative one. The `AddCreateItemOp` helper does this automatically; manual construction must set the field explicitly. The Add-Existing branch does not need a GUID because the existing item already carries one.
{% endhint %}

### Modes

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

### Merge Behavior

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

### **SourcePickupActor for World Pickups**

When adding an item from an actor with `IPickupable` interface e.g. `AWorldCollectableBase`, set `SourcePickupActor` to enable server-side validation:

```cpp
FItemTxOp_AddItem AddOp;
AddOp.DestSlot = EquipmentSlot;
AddOp.SourcePickupActor = WorldCollectable;  // The pickup being picked up from
AddOp.ItemDef = ItemDefClass;                // For template pickups
// or
AddOp.ExistingItem = ItemInstance;           // For instance pickups
```

#### **Server Validation Flow:**

{% stepper %}
{% step %}
Server receives transaction with `SourcePickupActor` set
{% endstep %}

{% step %}
Server validates the pickup actor exists and is valid
{% endstep %}

{% step %}
Server calls `IPickupable::TakeItemInstance()` or `IPickupable::TakeTemplate()` to extract the item
{% endstep %}

{% step %}
If validation succeeds, item is added to target container
{% endstep %}

{% step %}
If validation fails (pickup destroyed, already empty, etc.), client prediction is rolled back
{% endstep %}
{% endstepper %}

#### **Why This Matters:**

Without `SourcePickupActor`, clients could potentially add items they don't have legitimate access to. By requiring the server to validate and extract from the actual pickup actor, the system ensures:

* The pickup actually exists and has the expected item
* The item is properly removed from the pickup (preventing duplication)
* Race conditions between multiple players grabbing the same pickup are handled correctly

{% hint style="info" %}
`SourcePickupActor` is only processed during server execution. On clients, the field is ignored, the client optimistically assumes the item will be available.
{% endhint %}

### Validation

* Destination slot can accept item
* For create: `ItemDef` is valid
* For existing: item exists and isn't already in a container

***

## Combining Operations

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

***

## Identity Verification

Slot-based ops carry an expected item identity that the apply path compares against the slot's current contents. The check exists to prevent silent substitution when concurrent state changes happen between the player's input and the server's processing.

The pattern is the same across every op that addresses a source slot: pass the expected item or its GUID when constructing the op, and the apply path rejects with `Reject_Item_Mismatch` if the slot is empty or now contains a different item.

| Op                                       | Expected-identity field  | How to populate                                       |
| ---------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `FItemTxOp_Move`                         | `ItemInstance`           | Pass the item observed when the player gave the input |
| `FItemTxOp_RemoveItem`                   | `ExpectedSourceItemGuid` | Pass `ExpectedSourceItem` to `AddRemoveItemOp`        |
| `FItemTxOp_SplitStack`                   | `ExpectedSourceItemGuid` | Pass `ExpectedSourceItem` to `AddSplitStackOp`        |
| `FItemTxOp_ModifyTagStack`               | `ExpectedSourceItemGuid` | Construct the op directly and set the field           |
| `FItemTxOp_AddItem` (For existing items) | `ExistingItem`           | Pass the item the player is adding                    |

When the field is left unset, the op falls back to operating on whatever currently occupies the slot. That is appropriate for system-authored cleanup or scripted flows where "current occupant" is the intended target.

#### Why it matters under contention

Without the identity check, a slot-based op operates on whatever the slot contains at apply time. If a foreign update has swapped the slot's contents between the player's input and the server's processing, the op completes structurally on the wrong item. The player sees a successful move or modification that affected a different item than they intended.

With the identity check, the framework detects the mismatch and rejects the op cleanly. The player sees a clear failure and can retry against the new state.

#### Interaction with rollback and replay

The identity check is independent of the dependency-based Rollback and Replay machinery, but the two layers reinforce each other. The dependency engine identifies which preserved transactions need re-validation when an earlier transaction is rolled back; the identity check ensures that re-validation actually fails when the item identity has drifted underneath. Without the identity check, replay would silently re-bind to the new occupant.
