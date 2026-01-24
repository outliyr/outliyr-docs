# Adding Prediction

In [Implementing the Interface](implementing-the-interface.md), we built a Vendor using **Pattern 1: Server-Authoritative**. The interface methods contained the full logic, stock management, item creation, validation. This works because vendors don't need instant feedback; players accept a brief delay for purchases.

But what about containers where latency matters? Player inventory, equipment, attachments, these need instant response. This guide explains **Pattern 2: Client-Predicted** and how it fundamentally changes your implementation approach.

***

### The Architectural Shift

Adding prediction isn't just "adding a component." It changes where your logic lives.

#### Pattern 1: Server-Authoritative (Vendor)

```
Interface Method → Contains Full Logic → Modifies Storage Directly
```

The vendor's `RemoveItemFromSlot` does everything: validates stock, decrements count, creates the item instance. Simple and straightforward.

#### Pattern 2: Client-Predicted

```
Interface Method → Thin Wrapper → Delegates to Prediction Runtime → Runtime Handles Everything
```

The interface methods become minimal. They extract slot info, build a payload, and hand off to the runtime. The runtime decides:

* **On server:** Modify the actual array, stamp with prediction key, mark dirty
* **On client:** Record to overlay, mark view dirty, await confirmation

#### Why the Shift?

Two reasons drive this architectural change:

1. **Dual-path execution.** The same "add item" operation must work differently on server vs client. Rather than littering your interface methods with `if (HasAuthority())` checks, the runtime encapsulates this routing.
2. **`FFastArraySerializer` requirement.** Client prediction requires replication callbacks to know when the server confirms or rejects changes. `FFastArraySerializer` provides `PostReplicatedAdd`, `PostReplicatedChange`, and `PreReplicatedRemove` hooks. These callbacks feed the prediction engine, which handles phase classification and overlay cleanup.

***

## Server-Authoritative vs Predicted Vendors

In [Implementing the Interface](implementing-the-interface.md), we built a server-authoritative vendor that validates purchases through `CanRemoveItem`. Currency is deducted by the ability after a successful transaction:

```cpp
// Ability deducts currency after successful move
if (ExecuteTransactionRequest(PC, Request))
{
    DeductPlayerCurrency(PC, Price);
}
```

This works fine for most vendors, players accept a brief delay. But the currency deduction happens **outside** the transaction, so it doesn't predict.

### The Prediction Rule

> **Everything in the transaction predicts. Everything outside doesn't.**

For server-authoritative vendors:

* Item move: Inside transaction → validates via `CanRemoveItem`, executes on server
* Currency deduction: Outside transaction → doesn't predict

To predict the complete buy flow, you'd need currency changes _inside_ the transaction too.

***

### What You Need

Adding prediction requires these components working together:

| Component                  | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| **`FFastArraySerializer`** | Provides replication callbacks for phase classification |
| **Payload struct**         | What data to store in overlays                          |
| **Traits struct**          | Container-specific conversions and array access         |
| **Prediction runtime**     | View composition, authority routing, state transfer     |
| **Prediction stamp**       | Embedded in each entry for confirmation tracking        |

***

{% stepper %}
{% step %}
### Step 1: `FFastArraySerializer` Storage

Unlike the vendor's simple `TArray<FVendorCatalogEntry>`, predicted containers need `FFastArraySerializer` for replication callbacks.

#### The Entry Struct

Your replicated entry inherits from `FFastArraySerializerItem` and includes a prediction stamp:

```cpp
USTRUCT()
struct FMyContainerEntry : public FFastArraySerializerItem
{
    GENERATED_BODY()

    UPROPERTY()
    TObjectPtr<ULyraInventoryItemInstance> Item;

    UPROPERTY()
    int32 SlotIndex = INDEX_NONE;

    // Required for prediction confirmation
    UPROPERTY()
    FContainerPredictionStamp Prediction;

    // Replication callbacks - implementations shown later
    void PostReplicatedAdd(const FMyContainerList& Owner);
    void PostReplicatedChange(const FMyContainerList& Owner);
    void PreReplicatedRemove(const FMyContainerList& Owner);
};
```

#### The List Struct

A wrapper struct holds the entries and provides a back-pointer to the component:

```cpp
USTRUCT()
struct FMyContainerList : public FFastArraySerializer
{
    GENERATED_BODY()

    UPROPERTY()
    TArray<FMyContainerEntry> Entries;

    // Back-pointer for callbacks to access component
    UPROPERTY(NotReplicated)
    TObjectPtr<UMyContainerComponent> OwnerComponent;

    // Required for FFastArraySerializer
    bool NetDeltaSerialize(FNetDeltaSerializeInfo& DeltaParms)
    {
        return FFastArraySerializer::FastArrayDeltaSerialize<FMyContainerEntry, FMyContainerList>(
            Entries, DeltaParms, *this);
    }
};
```

#### Callback Implementation

Each callback notifies the prediction engine with the item's GUID and stamp:

```cpp
void FMyContainerEntry::PostReplicatedAdd(const FMyContainerList& Owner)
{
    if (Owner.OwnerComponent)
    {
        FGuid Guid = Item ? Item->GetItemInstanceId() : FGuid();
        Owner.OwnerComponent->GetPredictionRuntime().OnEntryReplicated(
            Guid, Prediction, EReplicatedDeltaKind::Added);
    }
}

void FMyContainerEntry::PostReplicatedChange(const FMyContainerList& Owner)
{
    if (Owner.OwnerComponent)
    {
        FGuid Guid = Item ? Item->GetItemInstanceId() : FGuid();
        Owner.OwnerComponent->GetPredictionRuntime().OnEntryReplicated(
            Guid, Prediction, EReplicatedDeltaKind::Changed);
    }
}

void FMyContainerEntry::PreReplicatedRemove(const FMyContainerList& Owner)
{
    if (Owner.OwnerComponent)
    {
        FGuid Guid = Item ? Item->GetItemInstanceId() : FGuid();
        Owner.OwnerComponent->GetPredictionRuntime().OnEntryReplicated(
            Guid, Prediction, EReplicatedDeltaKind::Removed);
    }
}
```

The engine uses the stamp to classify the phase (confirmation vs authoritative) and clears matching overlays.
{% endstep %}

{% step %}
### Step 2: The Payload Struct

Overlays store predicted state as "payloads", lightweight structs containing everything needed to reconstruct a view entry:

```cpp
USTRUCT()
struct FMyContainerPayload
{
    GENERATED_BODY()

    UPROPERTY()
    TObjectPtr<ULyraInventoryItemInstance> Instance = nullptr;

    UPROPERTY()
    int32 SlotIndex = INDEX_NONE;

    FGuid ItemGuid;

    FMyContainerPayload() = default;

    FMyContainerPayload(ULyraInventoryItemInstance* InInstance, int32 InSlotIndex)
        : Instance(InInstance)
        , SlotIndex(InSlotIndex)
    {
        if (InInstance)
        {
            ItemGuid = InInstance->GetItemInstanceId();
        }
    }

    // Construct from server entry for overlay changes
    explicit FMyContainerPayload(const FMyContainerEntry& Entry)
        : Instance(Entry.Item)
        , SlotIndex(Entry.SlotIndex)
    {
        if (Entry.Item)
        {
            ItemGuid = Entry.Item->GetItemInstanceId();
        }
    }
};
```

The payload is simpler than your server entry, it only needs what the client predicted, not the full replicated state.
{% endstep %}

{% step %}
### Step 3: Traits

Traits are the bridge between your container-specific types and the generic prediction system. They're a struct of static methods that the runtime calls.

#### Required Trait Methods

<table><thead><tr><th width="176.27276611328125">Category</th><th width="279.5455322265625">Methods</th><th>Purpose</th></tr></thead><tbody><tr><td><strong>Types</strong></td><td>Type aliases for Owner, <code>Payload</code>, <code>ServerEntry</code>, <code>ViewEntry</code></td><td>Let runtime know your types</td></tr><tr><td><strong>GUID</strong></td><td><code>GetGuid</code>, <code>GetGuidFromServerEntry</code></td><td>Extract stable identifier</td></tr><tr><td><strong>Server Access</strong></td><td><code>GetServerEntries</code>, <code>FindServerEntryByGuidMutable</code></td><td>Read/write server array</td></tr><tr><td><strong>View Conversion</strong></td><td><code>PayloadToViewEntry</code>, <code>ServerEntryToViewEntry</code></td><td>Build unified view</td></tr><tr><td><strong>Item Access</strong></td><td><code>GetInventoryItemFromPayload</code>, <code>GetInventoryItemFromServerEntry</code></td><td>Get item instances</td></tr><tr><td><strong>Authority</strong></td><td><code>IsAuthority</code></td><td>Route operations correctly</td></tr><tr><td><strong>Direct Operations</strong></td><td><code>DirectAddEntry</code>, <code>DirectRemoveEntry</code>, <code>DirectChangeEntry</code></td><td>Server-side array mutations</td></tr><tr><td><strong>Replication</strong></td><td><code>TearOffItemReplication</code></td><td>Clear item's NetGUID association on removal</td></tr><tr><td><strong>State Transfer</strong></td><td><code>TransferPredictionState</code></td><td>Move state from overlay to server entry on confirmation</td></tr><tr><td><strong>Stamping</strong></td><td><code>GetPredictionStampMutable</code>, <code>MarkEntryDirty</code></td><td>Access prediction stamp</td></tr></tbody></table>

#### Traits Implementation

```cpp
struct FMyContainerTraits
{
    // ===== Required Type Definitions =====
    using TOwner = UMyContainerComponent;
    using FPayload = FMyContainerPayload;
    using FServerEntry = FMyContainerEntry;
    using FViewEntry = FMyContainerEntry;  // Often same as server entry

    static constexpr bool HasPredictionStamp = true;

    // ===== GUID Extraction =====

    static FGuid GetGuid(const FPayload& Payload)
    {
        return Payload.ItemGuid;
    }

    static FGuid GetGuidFromServerEntry(const FServerEntry& Entry)
    {
        return Entry.Item ? Entry.Item->GetItemInstanceId() : FGuid();
    }

    // ===== Server Entries Access =====

    static const TArray<FServerEntry>& GetServerEntries(const TOwner* Owner)
    {
        return Owner->ItemList.Entries;
    }

    static FServerEntry* FindServerEntryByGuidMutable(TOwner* Owner, const FGuid& Guid)
    {
        for (FServerEntry& Entry : Owner->ItemList.Entries)
        {
            if (GetGuidFromServerEntry(Entry) == Guid)
            {
                return &Entry;
            }
        }
        return nullptr;
    }

    // ===== View Composition =====

    static FViewEntry PayloadToViewEntry(const FPayload& Payload, const FPredictedOpMeta& Meta)
    {
        FViewEntry Entry;
        Entry.Item = Payload.Instance;
        Entry.SlotIndex = Payload.SlotIndex;
        Entry.Prediction.LastLocalPredictedKeyId = Meta.PredictionKey.Current;
        return Entry;
    }

    static FViewEntry ServerEntryToViewEntry(const FServerEntry& Entry)
    {
        return Entry;  // Identity for simple cases
    }

    // ===== Authority Check =====

    static bool IsAuthority(const TOwner* Owner)
    {
        if (!Owner || !Owner->GetOwner()) return true;
        return Owner->GetOwner()->HasAuthority();
    }

    // ===== Item Access =====

    static ULyraInventoryItemInstance* GetInventoryItemFromPayload(const FPayload& Payload)
    {
        return Payload.Instance;
    }

    static ULyraInventoryItemInstance* GetInventoryItemFromServerEntry(const FServerEntry& Entry)
    {
        return Entry.Item;
    }

    // ===== Direct Array Operations (Server Path) =====

    static FServerEntry* DirectAddEntry(TOwner* Owner, const FPayload& Payload)
    {
        FServerEntry& NewEntry = Owner->ItemList.Entries.AddDefaulted_GetRef();
        NewEntry.Item = Payload.Instance;
        NewEntry.SlotIndex = Payload.SlotIndex;
        Owner->ItemList.MarkItemDirty(NewEntry);
        return &NewEntry;
    }

    static bool DirectRemoveEntry(TOwner* Owner, const FGuid& Guid)
    {
        for (int32 i = Owner->ItemList.Entries.Num() - 1; i >= 0; --i)
        {
            if (GetGuidFromServerEntry(Owner->ItemList.Entries[i]) == Guid)
            {
                Owner->ItemList.Entries.RemoveAt(i);
                Owner->ItemList.MarkArrayDirty();
                return true;
            }
        }
        return false;
    }

    static FServerEntry* DirectChangeEntry(TOwner* Owner, const FGuid& Guid, const FPayload& Payload)
    {
        if (FServerEntry* Entry = FindServerEntryByGuidMutable(Owner, Guid))
        {
            Entry->SlotIndex = Payload.SlotIndex;
            Owner->ItemList.MarkItemDirty(*Entry);
            return Entry;
        }
        return nullptr;
    }
    
    // ===== Replication TearOff =====

    static void TearOffItemReplication(TOwner* Owner, ULyraInventoryItemInstance* Item)
    {
        if (!Owner || !Item) return;

        // TearOff runtime fragments first
        for (UTransientRuntimeFragment* Fragment : Item->RuntimeFragments)
        {
            if (Fragment)
            {
                Owner->TearOffReplicatedSubObjectOnRemotePeers(Fragment);
            }
        }
        // TearOff the item itself
        Owner->TearOffReplicatedSubObjectOnRemotePeers(Item);
    }

    // ===== Prediction State Transfer =====

    static void TransferPredictionState(FPayload& Payload, FServerEntry& Entry)
    {
        // Transfer container-specific state from overlay to server entry
        // Most containers: nothing to transfer (empty implementation)
    }

    // ===== Prediction Stamp Access =====

    static FContainerPredictionStamp& GetPredictionStampMutable(FServerEntry& Entry)
    {
        return Entry.Prediction;
    }

    static void MarkEntryDirty(TOwner* Owner, FServerEntry& Entry)
    {
        Owner->ItemList.MarkItemDirty(Entry);
    }
};
```

{% hint style="info" %}
**Static asserts guide you.** The runtime has compile-time checks that produce clear error messages if you're missing required trait methods. Follow the error messages to implement the complete interface.
{% endhint %}

#### State Transfer

The `TransferPredictionState` method handles edge cases where the overlay holds state that needs to persist after confirmation. When the server confirms a prediction, the overlay is cleared, but sometimes it contains data the server entry needs.

For most containers, this is empty. `LyraEquipmentManagerComponent` and `InventotyFragment_Attachment` use this to transfer spawned actor references from the predicted overlay to the confirmed server entry. If your container spawns actors or holds other transient state during prediction, you'd transfer it here.
{% endstep %}

{% step %}
### Step 4: The Component with Runtime

Add `TGuidKeyedPredictionRuntime<YourTraits>` to your container class. This example uses a component, but the pattern works for any class that implements the interface (fragments, subsystems, etc. See `InventoryFragment_Attachment` for a fragment example).

```cpp
UCLASS()
class UMyContainerComponent : public UActorComponent, public ILyraItemContainerInterface
{
    GENERATED_BODY()

public:
    // Replicated item storage
    UPROPERTY(Replicated)
    FMyContainerList ItemList;

private:
    // The prediction runtime
    TGuidKeyedPredictionRuntime<FMyContainerTraits> PredictionRuntime;

public:
    virtual void BeginPlay() override
    {
        Super::BeginPlay();
        ItemList.OwnerComponent = this;
        PredictionRuntime.Initialize(this);
    }

    // Expose for FFastArray callbacks
    TGuidKeyedPredictionRuntime<FMyContainerTraits>& GetPredictionRuntime()
    {
        return PredictionRuntime;
    }

    // Expose for UI
    const TArray<FMyContainerEntry>& GetEffectiveView() const
    {
        return PredictionRuntime.GetEffectiveView();
    }

    FOnViewDirtied& OnViewDirtied()
    {
        return PredictionRuntime.OnViewDirtied();
    }
};
```
{% endstep %}

{% step %}
### Step 5: Interface Methods Become Thin

Compare the vendor's `AddItemToSlot` (full validation, stock management, return value) to a predicted container:

#### Vendor Pattern (Full Logic in Method)

```cpp
bool UVendorComponent::AddItemToSlot(const FInstancedStruct& SlotInfo,
    ULyraInventoryItemInstance* Item, FPredictionKey PredictionKey, bool bForceAdd)
{
    if (!Item) return false;

    // Full validation
    if (!bForceAdd && CanAcceptItem(SlotInfo, Item) == 0)
    {
        return false;
    }

    // Full logic - vendor absorbs the item
    // Maybe update stock, maybe destroy, maybe store
    return true;
}
```

#### Predicted Pattern (Thin Wrapper)

```cpp
bool UMyContainerComponent::AddItemToSlot(const FInstancedStruct& SlotInfo,
    ULyraInventoryItemInstance* Item, FPredictionKey PredictionKey, bool bForceAdd)
{
    const FMyContainerSlotInfo* Slot = SlotInfo.GetPtr<FMyContainerSlotInfo>();
    if (!Slot || !Item) return false;

    // Light validation
    if (!bForceAdd && CanAcceptItem(SlotInfo, Item) == 0)
    {
        return false;
    }

    // Build payload and delegate to runtime
    FMyContainerPayload Payload(Item, Slot->SlotIndex);

    PredictionRuntime.RecordAdd(
        Item->GetItemInstanceId(),
        Payload,
        PredictionKey
    );

    return true;
}

ULyraInventoryItemInstance* UMyContainerComponent::RemoveItemFromSlot(
    const FInstancedStruct& SlotInfo, FPredictionKey PredictionKey)
{
    const FMyContainerSlotInfo* Slot = SlotInfo.GetPtr<FMyContainerSlotInfo>();
    if (!Slot) return nullptr;

    ULyraInventoryItemInstance* Item = GetItemInSlot(SlotInfo);
    if (!Item) return nullptr;

    // Delegate to runtime
    PredictionRuntime.RecordRemoval(
        Item->GetItemInstanceId(),
        PredictionKey
    );

    return Item;
}
```

The runtime handles:

* Authority checking
* Server: Direct array modification + stamping
* Client: Overlay recording
* Event broadcasting

#### Query Methods Use Effective View

```cpp
ULyraInventoryItemInstance* UMyContainerComponent::GetItemInSlot(
    const FInstancedStruct& SlotInfo) const
{
    const FMyContainerSlotInfo* Slot = SlotInfo.GetPtr<FMyContainerSlotInfo>();
    if (!Slot) return nullptr;

    // Query the effective view, not raw server array
    for (const FMyContainerEntry& Entry : GetEffectiveView())
    {
        if (Entry.SlotIndex == Slot->SlotIndex)
        {
            return Entry.Item;
        }
    }
    return nullptr;
}

int32 UMyContainerComponent::ForEachItem(
    TFunctionRef<bool(ULyraInventoryItemInstance*, const FInstancedStruct&)> Callback) const
{
    int32 Count = 0;

    // Iterate effective view
    for (const FMyContainerEntry& Entry : GetEffectiveView())
    {
        if (Entry.Item)
        {
            FInstancedStruct SlotInfo;
            SlotInfo.InitializeAs<FMyContainerSlotInfo>();
            SlotInfo.GetMutable<FMyContainerSlotInfo>()->SlotIndex = Entry.SlotIndex;

            ++Count;
            if (!Callback(Entry.Item, SlotInfo))
            {
                break;
            }
        }
    }

    return Count;
}
```
{% endstep %}

{% step %}
### Step 6: Prediction Callbacks

Your component needs to handle both rejection and caught-up events:

```cpp
void UMyContainerComponent::OnPredictionKeyRejected(int32 PredictionKeyCurrent)
{
    // Immediate rollback - clear overlays for this key
    PredictionRuntime.GetEngine().OnPredictionKeyRejected(PredictionKeyCurrent);
    PredictionRuntime.MarkViewDirty();
}

void UMyContainerComponent::OnPredictionKeyCaughtUp(int32 PredictionKeyCurrent)
{
    // Server caught up - clear overlays for this key
    PredictionRuntime.GetEngine().OnPredictionKeyCaughtUp(PredictionKeyCurrent);
    PredictionRuntime.MarkViewDirty();
}

bool UMyContainerComponent::CanParticipateInClientPrediction(
    const AController* PredictingController) const
{
    return true; // Enable prediction
}
```

The two callbacks serve different purposes:

* **`OnPredictionKeyRejected`**: Server rejected the ability, immediate rollback
* **`OnPredictionKeyCaughtUp`**: Server finished processing, clear confirmed overlays
{% endstep %}
{% endstepper %}

***

### Comparing the Two Patterns

| Aspect                | Server-Authoritative          | Client-Predicted                 |
| --------------------- | ----------------------------- | -------------------------------- |
| **Storage**           | Simple `TArray` or `TMap`     | `FFastArraySerializer`           |
| **Interface methods** | Full logic                    | Thin wrappers                    |
| **Where logic lives** | In interface methods          | In traits + runtime              |
| **Replication**       | Basic `UPROPERTY(Replicated)` | Callbacks feed prediction engine |
| **State on client**   | Waits for server              | Optimistic overlay + server base |
| **Complexity**        | Lower                         | Higher                           |

***

### When to Use Each Pattern

#### Use Server-Authoritative When:

* Brief latency is acceptable (purchases, quest rewards)
* Server must validate external state (currency, stock limits)
* Container belongs to NPC or world object
* Simplicity matters more than instant feedback

#### Use Client-Predicted When:

* Instant feedback is essential (inventory during combat)
* Player interacts with this container constantly
* Latency would feel "sluggish"
* You're willing to accept the implementation complexity

***

### Testing Prediction

#### Network Emulation

{% stepper %}
{% step %}
1. Project Settings > Engine > Network Emulation
{% endstep %}

{% step %}
2. Set **Avg Latency** to 200ms
{% endstep %}

{% step %}
3. Set **Packet Loss** to 5%
{% endstep %}
{% endstepper %}

#### Checklist

* [ ] Item moves update UI instantly
* [ ] Server confirmation doesn't cause visual glitches
* [ ] Server rejection rolls back correctly
* [ ] Multiple rapid operations don't cause duplicates
* [ ] Cross-container moves work correctly

#### Debug Logging

Log at key points:

* When recording adds/removals (include GUID, prediction key, authority)
* When replication callbacks fire (include phase classification)
* When overlays are cleared (include reason: confirmed vs rejected)

***

### Summary

Adding prediction transforms your container architecture:

1. **Storage changes** to `FFastArraySerializer` for replication callbacks
2. **Logic moves** from interface methods to traits + runtime
3. **Interface methods become thin** wrappers that delegate to the runtime
4. **The runtime routes** operations based on authority
5. **Replication callbacks** feed the engine for phase classification
6. **Overlays compose** with server state for the effective view

The vendor example shows Pattern 1 in its purest form, logic in interface methods, simple storage, no prediction. When you need instant feedback, Pattern 2 inverts the architecture: the runtime becomes the brain, interface methods become the messenger.

***

### Next Steps

With prediction working, connect your container to the UI system. See [UI Integration](ui-integration.md).

For an advanced example showing how to make vendor purchases fully predicted (with atomic currency changes), see [Example: Predicted Vendor](example-predicted-vendor.md).
