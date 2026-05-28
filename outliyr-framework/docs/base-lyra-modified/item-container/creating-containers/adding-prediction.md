# Adding Prediction

In [Implementing the Interface](implementing-the-interface.md), we built a Vendor using **Pattern 1: Server-Authoritative**. The interface methods contained the full logic, stock management, item creation, validation. This works because vendors don't need instant feedback; players accept a brief delay for purchases.

But what about containers where latency matters? Player inventory, equipment, attachments, these need instant response. This guide explains **Pattern 2: Client-Predicted** and how it fundamentally changes your implementation approach.

{% hint style="warning" %}
Vendors are usually best kept server-authoritative rather than client-predicted. This example uses a vendor only as a teaching tool to show how a container can be adapted to support prediction.
{% endhint %}

***

## The Architectural Shift

Adding prediction isn't just "adding a component." It changes where your logic lives.

### Pattern 1: Server-Authoritative (Vendor)

```
Interface Method → Contains Full Logic → Modifies Storage Directly
```

The vendor's `RemoveItemFromSlot` does everything: validates stock, decrements count, creates the item instance. Simple and straightforward.

### Pattern 2: Client-Predicted

```
Interface Method → Thin Wrapper → Delegates to Prediction Runtime → Runtime Handles Everything
```

The interface methods become minimal. They extract slot info, build a payload, and hand off to the runtime. The runtime decides:

* **On server:** Modify the actual array, stamp with prediction key, mark dirty
* **On client:** Record to overlay, mark view dirty, await confirmation

### Why the Shift?

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

## What You Need

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

#### **The Entry Struct**

Your replicated entry inherits from `FPredictableFastArrayItem`. The base carries the prediction stamp the runtime needs for confirmation phase classification, so the entry struct itself only declares its data fields:

```cpp
USTRUCT()
struct FMyContainerEntry : public FPredictableFastArrayItem
{
    GENERATED_BODY()

    UPROPERTY()
    TObjectPtr<ULyraInventoryItemInstance> Item;

    UPROPERTY()
    int32 SlotIndex = INDEX_NONE;
};
```

The inherited `Prediction` field replicates as part of the derived entry's delta-serialised data. The validator's compile-time check enforces this base class so a missing inheritance produces a focused error.

#### **The List Struct**

The list struct holds the entries, a back-pointer to the owning component, and the four FFastArray callbacks that route replication deltas through the prediction helper:

```cpp
USTRUCT()
struct FMyContainerList : public FFastArraySerializer
{
    GENERATED_BODY()

    UPROPERTY()
    TArray<FMyContainerEntry> Entries;

    // Back-pointer so the callbacks can reach the prediction helper.
    UPROPERTY(NotReplicated)
    TObjectPtr<UMyContainerComponent> OwnerComponent;

    void PreReplicatedRemove(const TArrayView<int32> RemovedIndices, int32 FinalSize);
    void PostReplicatedAdd(const TArrayView<int32> AddedIndices, int32 FinalSize);
    void PostReplicatedChange(const TArrayView<int32> ChangedIndices, int32 FinalSize);
    void PostReplicatedReceive(const FFastArraySerializer::FPostReplicatedReceiveParameters& Parameters);

    bool NetDeltaSerialize(FNetDeltaSerializeInfo& DeltaParms)
    {
        return FFastArraySerializer::FastArrayDeltaSerialize<FMyContainerEntry, FMyContainerList>(
            Entries, DeltaParms, *this);
    }
};

template<>
struct TStructOpsTypeTraits<FMyContainerList> : public TStructOpsTypeTraitsBase2<FMyContainerList>
{
    enum { WithNetDeltaSerializer = true };
};
```

#### **Callback Implementation**

Each delta callback iterates the affected indices and routes the replicated delta through the owner's prediction helper. `PostReplicatedReceive` marks the composed view dirty after the batch completes:

```cpp
void FMyContainerList::PreReplicatedRemove(const TArrayView<int32> RemovedIndices, int32 FinalSize)
{
    UMyContainerComponent* Comp = Cast<UMyContainerComponent>(OwnerComponent);
    FPredictableContainerHelper* Helper = Comp ? Comp->GetPredictionHelper() : nullptr;

    for (int32 Index : RemovedIndices)
    {
        if (Entries.IsValidIndex(Index))
        {
            FMyContainerEntry& Entry = Entries[Index];
            const FGuid EntryGuid = Entry.Item ? Entry.Item->GetItemInstanceId() : FGuid();
            if (Helper && EntryGuid.IsValid())
            {
                Helper->OnEntryReplicated(EntryGuid, Entry.Prediction, EReplicatedDeltaKind::Removed);
            }
        }
    }
}

void FMyContainerList::PostReplicatedAdd(const TArrayView<int32> AddedIndices, int32 FinalSize)
{
    UMyContainerComponent* Comp = Cast<UMyContainerComponent>(OwnerComponent);
    FPredictableContainerHelper* Helper = Comp ? Comp->GetPredictionHelper() : nullptr;

    for (int32 Index : AddedIndices)
    {
        if (Entries.IsValidIndex(Index))
        {
            FMyContainerEntry& Entry = Entries[Index];
            const FGuid EntryGuid = Entry.Item ? Entry.Item->GetItemInstanceId() : FGuid();
            if (Helper && EntryGuid.IsValid())
            {
                Helper->OnEntryReplicated(EntryGuid, Entry.Prediction, EReplicatedDeltaKind::Added);
            }
        }
    }
}

void FMyContainerList::PostReplicatedChange(const TArrayView<int32> ChangedIndices, int32 FinalSize)
{
    UMyContainerComponent* Comp = Cast<UMyContainerComponent>(OwnerComponent);
    FPredictableContainerHelper* Helper = Comp ? Comp->GetPredictionHelper() : nullptr;

    for (int32 Index : ChangedIndices)
    {
        if (Entries.IsValidIndex(Index))
        {
            FMyContainerEntry& Entry = Entries[Index];
            const FGuid EntryGuid = Entry.Item ? Entry.Item->GetItemInstanceId() : FGuid();
            if (Helper && EntryGuid.IsValid())
            {
                Helper->OnEntryReplicated(EntryGuid, Entry.Prediction, EReplicatedDeltaKind::Changed);
            }
        }
    }
}

void FMyContainerList::PostReplicatedReceive(const FFastArraySerializer::FPostReplicatedReceiveParameters& Parameters)
{
    if (UMyContainerComponent* Comp = Cast<UMyContainerComponent>(OwnerComponent))
    {
        Comp->GetPredictionHelper()->MarkViewDirty();
    }
}
```

The helper hands the delta to the runtime, which uses the stamp to classify the phase (confirmation vs authoritative) and clears matching overlays.
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

{% hint style="info" %}
At first glance this looks like a lot, but most trait methods are simple adapters around your existing storage and entry types.
{% endhint %}

#### **Required Trait Methods**

<table><thead><tr><th width="176.27276611328125">Category</th><th width="279.5455322265625">Methods</th><th>Purpose</th></tr></thead><tbody><tr><td><strong>Types</strong></td><td>Type aliases for <code>TOwner</code>, <code>FPayload</code>, <code>FServerEntry</code>, <code>FViewEntry</code></td><td>Let runtime know your types</td></tr><tr><td><strong>GUID</strong></td><td><code>GetGuid</code>, <code>GetGuidFromServerEntry</code></td><td>Extract stable identifier</td></tr><tr><td><strong>Server Access</strong></td><td><code>GetServerEntries</code></td><td>Read the server array (the runtime owns mutable lookups itself)</td></tr><tr><td><strong>View Conversion</strong></td><td><code>PayloadToViewEntry</code>, <code>ServerEntryToViewEntry</code>, <code>ServerEntryToPayload</code></td><td>Build unified view</td></tr><tr><td><strong>Item Access</strong></td><td><code>GetInventoryItemFromPayload</code>, <code>GetInventoryItemFromServerEntry</code></td><td>Get item instances</td></tr><tr><td><strong>Authority</strong></td><td><code>IsAuthority</code></td><td>Route operations correctly</td></tr><tr><td><strong>Direct Operations</strong></td><td><code>DirectAddEntry</code>, <code>DirectRemoveEntry</code>, <code>DirectChangeEntry</code></td><td>Server-side array mutations</td></tr><tr><td><strong>Replication</strong></td><td><code>TearOffReplicatedSubObject</code></td><td>Clear a single sub-object's NetGUID on removal; the runtime calls this for each runtime fragment and the item itself</td></tr><tr><td><strong>Slot</strong></td><td><code>PayloadToSlotStruct</code></td><td>Build the slot descriptor the runtime writes onto the item's CurrentSlot</td></tr><tr><td><strong>Stamping</strong></td><td><code>GetPredictionStampMutable</code>, <code>MarkEntryDirty</code></td><td>Access prediction stamp</td></tr><tr><td><strong>Optional</strong></td><td><code>TransferPredictionState</code>, <code>PreparePredictedPayload</code></td><td>Hooks for containers that spawn actors, hold ability handles, or otherwise need to move state from the predicted overlay onto the confirmed server entry. Omit when there is nothing to transfer.</td></tr></tbody></table>

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

    // ===== View Composition =====

    static FPayload ServerEntryToPayload(const FServerEntry& Entry)
    {
        return FPayload(Entry);  // Uses your payload's "from-server-entry" constructor
    }

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
        for (FServerEntry& Entry : Owner->ItemList.Entries)
        {
            if (GetGuidFromServerEntry(Entry) == Guid)
            {
                Entry.SlotIndex = Payload.SlotIndex;
                // MarkItemDirty is left to the runtime so it can run after stamping.
                return &Entry;
            }
        }
        return nullptr;
    }

    // ===== Slot Descriptor =====

    static FInstancedStruct PayloadToSlotStruct(TOwner* Owner, const FPayload& Payload)
    {
        FMyContainerSlotInfo SlotData;
        SlotData.Container = Owner;
        SlotData.SlotIndex = Payload.SlotIndex;
        return FInstancedStruct::Make(SlotData);
    }

    // ===== Replication TearOff =====

    static void TearOffReplicatedSubObject(TOwner* Owner, UObject* SubObject)
    {
        if (Owner && SubObject)
        {
            Owner->TearOffReplicatedSubObjectOnRemotePeers(SubObject);
        }
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

#### **Optional: State Transfer on Confirmation**

When the server confirms a prediction, the overlay is cleared. Most containers have nothing on the overlay that needs to survive that clearing because the predicted payload only carries data, and the server's authoritative entry already replicates that data. Containers that spawn actors, hold ability handles, or otherwise carry transient state during prediction need somewhere to move that state onto the confirmed server entry before the overlay is dropped.

That is what the optional `TransferPredictionState` hook does. Define it on your traits when your container has state to move; omit it entirely otherwise.

```cpp
static void TransferPredictionState(FPayload& Payload, FServerEntry& Entry)
{
    // Move spawned actors, ability handles, input bindings, etc.
    Entry.SpawnedActor = Payload.PredictedActor;
    Payload.PredictedActor = nullptr;
}
```

The equipment manager and the attachment runtime fragment both implement this hook to transfer the predicted equipment instance and its ability handles onto the confirmed entry. Inventory and tetris containers carry only data, so they omit it.
{% endstep %}

{% step %}
### Step 4: The Component with Runtime

Compose `FPredictableContainerHelper` as a member of your container. The helper owns the prediction runtime and exposes it through a small set of templated and non-templated accessors. Containers compose one helper per traits class they predict against and route their interface methods through it. The shape works for any host class that implements `ILyraItemContainerInterface`, components, runtime fragments, subsystems. See `InventoryFragment_Attachment` for a fragment example.

```cpp
UCLASS()
class UMyContainerComponent : public UActorComponent, public ILyraItemContainerInterface
{
    GENERATED_BODY()

public:
    // Replicated item storage
    UPROPERTY(Replicated)
    FMyContainerList ItemList;

    virtual void InitializeComponent() override
    {
        Super::InitializeComponent();
        PredictionHelper.InitRuntimeAs<FMyContainerTraits>(this);
        ItemList.OwnerComponent = this;
    }

    // Exposes the container's prediction helper to predicted transaction requests.
    virtual void CollectPredictableContainerHelpers(
        const AController* PredictingController,
        TArray<FPredictableContainerHelper*>& OutHelpers) const override
    {
        if (PredictionHelper.IsInitialized())
        {
            OutHelpers.Add(const_cast<FPredictableContainerHelper*>(&PredictionHelper));
        }
    }

    
    // The list callbacks reach the helper through this accessor.
    FPredictableContainerHelper* GetPredictionHelper() { return &PredictionHelper; }

    // Typed view accessor for UI consumers.
    const TArray<FMyContainerEntry>& GetEffectiveView() const
    {
        return PredictionHelper.GetEffectiveView<FMyContainerTraits>();
    }

    FOnViewDirtied* GetOnViewDirtied() const { return PredictionHelper.OnViewDirtied(); }

private:
    FPredictableContainerHelper PredictionHelper;
};
```

`InitRuntimeAs<FMyContainerTraits>(this)` instantiates `TGuidKeyedPredictionRuntime<FMyContainerTraits>` and stores it on the helper. Subsequent typed access goes through `PredictionHelper.GetTypedRuntime<FMyContainerTraits>()` or the convenience templated accessors.

`CollectPredictableContainerHelpers` is the one prediction-related interface override your container needs. Appending an initialized helper opts the container into client prediction; leaving `OutHelpers` empty means the container runs server-authoritatively for predicted transaction requests. Containers with multiple prediction surfaces append multiple helpers from one call.
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
    if (!bForceAdd && CanAcceptItem(SlotInfo, Item, nullptr) == 0)
    {
        return false;
    }

    // Full logic - vendor absorbs the item
    // Maybe update stock, maybe destroy, maybe store
    return true;
}
```

#### **Predicted Pattern (Thin Wrapper)**

```cpp
bool UMyContainerComponent::AddItemToSlot(const FInstancedStruct& SlotInfo,
    ULyraInventoryItemInstance* Item, FPredictionKey PredictionKey, bool bForceAdd)
{
    const FMyContainerSlotInfo* Slot = SlotInfo.GetPtr<FMyContainerSlotInfo>();
    if (!Slot || !Item) return false;

    // Light validation
    if (!bForceAdd && CanAcceptItem(SlotInfo, Item, nullptr) == 0)
    {
        return false;
    }

    // Build payload and delegate to the typed runtime through the helper.
    FMyContainerPayload Payload(Item, Slot->SlotIndex);

    PredictionHelper.GetTypedRuntime<FMyContainerTraits>()->RecordAdd(
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

    // Delegate to the typed runtime through the helper.
    PredictionHelper.GetTypedRuntime<FMyContainerTraits>()->RecordRemoval(
        Item->GetItemInstanceId(),
        PredictionKey
    );

    return Item;
}
```

If you have many recording call sites, give your component a private accessor that wraps the typed downcast once:

```cpp
TGuidKeyedPredictionRuntime<FMyContainerTraits>* GetTypedRuntime() const
{
    return PredictionHelper.GetTypedRuntime<FMyContainerTraits>();
}
```

Then call sites read `GetTypedRuntime()->RecordAdd(...)`.

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
### Step 6: Smoother Recovery from Conflicts

Your container is already correct after the previous steps. Predictions show immediately, the server rejects when it disagrees, and replication takes over on confirmation. This step covers an optional refinement that lets the framework handle conflicts more gracefully.

Two situations can cause more visual churn than the player needs. The first is when the player has done several things in quick succession and one earlier action is rejected by the server; without help, every later action gets rolled back and re-tried, even ones that touched a different slot or a different item. The second is when another player or the server itself modifies the same container while the local player still has predicted actions waiting on a response; without help, the local player has to wait for the explicit failure response before anything settles.

The framework can handle both situations more gracefully when each slot descriptor produces a stable identity string. With that in place, the framework can tell which queued actions actually depended on the rejected one and leave the rest alone. See Rollback and Replay for the full picture; this step shows how to honour the contract on your slot descriptor.

#### **Implement stable slot identity**

The framework compares slots by a stable identifier the slot descriptor produces. Override `GetStableSlotIdentity` on every slot descriptor type your container uses:

```cpp
bool FMyContainerSlotInfo::GetStableSlotIdentity(FString& OutIdentity) const override
{
    if (SlotIndex == INDEX_NONE)
    {
        OutIdentity.Reset();
        return false;
    }

    OutIdentity = FString::Printf(TEXT("MyContainerSlot:%d"), SlotIndex);
    return true;
}
```

The identifier must be:

* **Canonical** — same slot always produces the same string.
* **Free of mutable state** — no display text, item names, localised strings, timestamps, or anything that changes when the slot's contents change.
* **Derived from the addressable location**, not from what currently occupies it.

Returning false marks the slot as not having a stable identity. Any action touching that slot is rolled back rather than kept intact when an earlier action is rejected. That is the safe path when the slot type cannot describe itself stably.

Composite slot types, such as attachment slots that are addressed through a parent slot, recurse: produce the parent's stable identity first, then append your local discriminator. The framework's attachment descriptor follows this pattern.

#### **What about custom ops?**

If you write your own transaction ops, each op handler implements `CollectFootprint` to describe what the op touches. The framework uses that description to decide which queued actions depend on a rejected one. See the [Rollback and Replay](../transactions/rollback-and-replay.md) page for the per-op responsibilities.
{% endstep %}
{% endstepper %}

***

## Comparing the Two Patterns

| Aspect                | Server-Authoritative          | Client-Predicted                 |
| --------------------- | ----------------------------- | -------------------------------- |
| **Storage**           | Simple `TArray` or `TMap`     | `FFastArraySerializer`           |
| **Interface methods** | Full logic                    | Thin wrappers                    |
| **Where logic lives** | In interface methods          | In traits + runtime              |
| **Replication**       | Basic `UPROPERTY(Replicated)` | Callbacks feed prediction engine |
| **State on client**   | Waits for server              | Optimistic overlay + server base |
| **Complexity**        | Lower                         | Higher                           |

***

## When to Use Each Pattern

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

## Testing Prediction

### Network Emulation

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

### Checklist

* [ ] Item moves update UI instantly
* [ ] Server confirmation doesn't cause visual glitches
* [ ] Server rejection rolls back correctly
* [ ] Multiple rapid operations don't cause duplicates
* [ ] Cross-container moves work correctly

### Debug Logging

Log at key points:

* When recording adds/removals (include GUID, prediction key, authority)
* When replication callbacks fire (include phase classification)
* When overlays are cleared (include reason: confirmed vs rejected)

***

## Summary

Adding prediction transforms your container architecture:

1. **Storage changes** to `FFastArraySerializer` for replication callbacks
2. **Logic moves** from interface methods to traits + runtime
3. **Interface methods become thin** wrappers that delegate to the runtime
4. **The runtime routes** operations based on authority
5. **Replication callbacks** feed the engine for phase classification
6. **Overlays compose** with server state for the effective view
7. **Stable slot identity** unlocks smoother recovery when actions overlap with server changes

The vendor example shows Pattern 1 in its purest form, logic in interface methods, simple storage, no prediction. When you need instant feedback, Pattern 2 inverts the architecture: the runtime becomes the brain, interface methods become the messenger.

***

## Next Steps

With prediction working, connect your container to the UI system. See [UI Integration](ui-integration.md).

For an advanced example showing how to make vendor purchases fully predicted (with atomic currency changes), see [Example: Predicted Vendor](example-predicted-vendor.md).
