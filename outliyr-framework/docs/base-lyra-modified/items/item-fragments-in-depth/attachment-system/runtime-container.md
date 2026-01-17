# Runtime Container

While the [Static Fragment](static-fragment.md) says "what CAN attach," the `UTransientRuntimeFragment_Attachment` tracks "what IS attached." It's created per-item-instance and manages the actual attached items at runtime - spawning actors, granting abilities, and tracking state.

***

### Why a Full Container?

The runtime fragment (`UTransientRuntimeFragment_Attachment`) implements `ILyraItemContainerInterface` - the same interface that Inventory and Equipment use.

This matters because:

* **Same transaction system** - Move a scope from inventory to weapon using the exact same `ItemTxOp_Move` operation
* **Same prediction model** - Instant feedback when attaching; server confirms or rejects
* **Same permission model** - Access control works identically

Attachments aren't special. They're containers that happen to live inside items rather than on actors. This consistency means learning one container teaches you all three.

{% hint style="info" %}
For the shared container patterns, see [Item Container Interface](../../../item-container/item-container-architecture/the-container-contract.md). This page focuses on what makes attachments unique.
{% endhint %}

***

### The Attachment Entry

Each attached item is tracked as an `FAppliedAttachmentEntry`:

```cpp
struct FAppliedAttachmentEntry : public FFastArraySerializerItem
{
    // What's attached
    FGameplayTag AttachmentSlot;                    // Which slot (scope, grip, etc.)
    TSubclassOf<ULyraInventoryItemDefinition> ItemDefinition;
    TObjectPtr<ULyraInventoryItemInstance> ItemInstance;

    // Prediction
    FContainerPredictionStamp Prediction;           // For reconciliation

    // Applied behavior (server-managed)
    TObjectPtr<AActor> ReplicatedActor;            // Server-spawned actor

    // Local state (not replicated)
    FLyraAbilitySet_GrantedHandles GrantedHandles; // For cleanup
    TArray<uint32> BindHandles;                     // Input binding handles
    bool bInputApplied;
};
```

The FastArray provides:

* Delta replication (only changes sync)
* Replication callbacks for prediction
* Efficient add/remove operations

***

### The Attachment Flow

Here's what happens when a player attaches a scope to their rifle:

{% stepper %}
{% step %}
#### Transaction Requests Attachment

```cpp
// Via ItemTransactionAbility
FItemTxOp_Move MoveOp;
MoveOp.SourceSlot = InventorySlot;      // Where scope is now
MoveOp.DestSlot = AttachmentSlot;       // FAttachmentAbilityData_SourceAttachment
```
{% endstep %}

{% step %}
#### Container Validates

```cpp
int32 CanAcceptItem(const FInstancedStruct& SlotInfo,
                    const ULyraInventoryItemInstance* Item,
                    const AController* Instigator) const override;
```

Validation checks:

* SlotInfo is `FAttachmentAbilityData_SourceAttachment`
* Slot exists in `CompatibleAttachments`
* Item definition is compatible with that slot
* Slot is not already occupied (or swap is allowed)

Returns `0` if rejected, `1` if accepted.
{% endstep %}

{% step %}
#### Entry Created

```cpp
bool AddItemToSlot(const FInstancedStruct& SlotInfo,
                   ULyraInventoryItemInstance* Item,
                   FPredictionKey PredictionKey,
                   bool bForceAdd = false) override;
```

This function:

* Creates new `FAppliedAttachmentEntry`
* Stamps prediction key
* Adds to FastArray
* Updates item's `CurrentSlot` to reflect attachment location
{% endstep %}

{% step %}
#### Behavior Applies

Based on the parent item's equipment state:

```cpp
void ApplyBehaviorForEntry(FAppliedAttachmentEntry& Entry, EAttachmentActiveState State);
```

Parent State → What Happens:

* Not equipped → Nothing - attachment sleeps
* Holstered → Apply `HolsteredAttachmentSettings`
* Held → Apply `HeldAttachmentSettings`

Behavior application includes:

* Spawning actor at configured socket
* Granting abilities (server only)
* Applying input mappings (local client only)
{% endstep %}

{% step %}
#### Replication

* Server creates entry → replicates to clients
* Client with prediction → reconciles predicted entry with server entry
* Predicted actors destroyed, server actors revealed
{% endstep %}
{% endstepper %}

***

### State Tracking

The container tracks the parent item's equipment state:

```cpp
EAttachmentActiveState DetermineStateFromSlot(const FInstancedStruct& Slot) const;
```

Slot Descriptor → Result:

* Not equipment slot → `Inactive`
* Equipment, no held slot → `Holstered`
* Equipment, valid held slot → `Equipped`

#### Responding to Parent State Changes

When the parent item moves (equipped/held/holstered), the container receives:

```cpp
virtual void ItemMoved(ULyraInventoryItemInstance* ItemInstance,
                       const FInstancedStruct& OldSlot,
                       const FInstancedStruct& NewSlot) override;
```

This triggers:

1. Determine new effective state
2. Remove old behaviors (actors, abilities)
3. Apply new behaviors based on new state
4. Recursively update nested attachments

***

### Actor Management

#### Spawning

```cpp
void SpawnAttachmentActor(AActor* AttachTarget,
                          FAppliedAttachmentEntry& Attachment,
                          EAttachmentActiveState EffectiveState,
                          bool bPredicted = false);
```

Actors spawn attached to the **parent item's spawned actor**, not the pawn:

```
Pawn (SK_Mannequin)
└── Weapon Actor (BP_Rifle)
    └── Scope Actor (BP_RedDot)  ← Attachment spawns here
```

Context → What Spawns:

* Server → Replicated actor → `ReplicatedActor`
* Owning client (predicted) → Local-only actor → prediction overlay
* Simulated proxy → Waits for replicated actor

#### Destruction

```cpp
void RemoveAttachmentActors(FAppliedAttachmentEntry& Attachment,
                            bool bPredictedOnly = false);
```

* `bPredictedOnly = false` - Destroys both replicated and predicted
* `bPredictedOnly = true` - Only predicted (during reconciliation)

#### Visibility Control

During prediction reconciliation:

```cpp
void HideReplicatedActorForGuid(const FGuid& Guid);   // Hide server actor
void UnhideReplicatedActorForGuid(const FGuid& Guid); // Show server actor
```

When client predicts removal, the server actor hides until server confirms.

***

### Prediction Flow

{% hint style="info" %}
For the full prediction model, see [Prediction Architecture](../../../item-container/prediction/prediction-architecture.md). This section covers attachment-specific aspects.
{% endhint %}

### Client Predicts Add

1. `AddItemToSlot` called with prediction key
2. Runtime records add in overlay
3. Predicted actor spawns immediately
4. UI updates to show attachment

### Server Confirms

1. Server entry arrives via replication
2. `PostReplicatedAdd` fires
3. Runtime reconciles prediction with server state
4. Predicted actor destroyed
5. Server actor revealed

### Server Rejects

1. `OnPredictionKeyRejected` fires
2. Runtime clears overlay
3. Predicted actor destroyed
4. Item state rolled back
5. UI updates

***

## Ability and Input Management

### Granting Abilities

```cpp
void GrantAbilities(FAppliedAttachmentEntry& Attachment,
                    ULyraInventoryItemInstance* AttachmentContainerItemInstance,
                    EAttachmentActiveState EffectiveState);
```

* Grants abilities from the behavior's `AbilitySetsToGrant`
* Uses **attachment item instance** as source object
* Stores handles in `GrantedHandles` for cleanup

### Input Context

```cpp
void AddInputContextMapping(FAppliedAttachmentEntry& Attachment,
                            EAttachmentActiveState EffectiveState);
void RemoveInputContextMapping(FAppliedAttachmentEntry& Attachment,
                               EAttachmentActiveState EffectiveState);
```

* Only applies on locally controlled client
* Adds/removes `InputMappings` from behavior config
* Tracks via `BindHandles` for cleanup

***

## Container Interface

The full `ILyraItemContainerInterface` implementation:

#### Query Methods

* `GetItemInSlot(SlotInfo)` → Get item in specific slot
* `CanAcceptItem(SlotInfo, Item, Instigator)` → Validate attachment
* `FindAvailableSlot(ItemDef, Item, OutSlot)` → Find compatible empty slot
* `ForEachItem(Callback)` → Iterate all attachments

#### Mutation Methods

* `AddItemToSlot(SlotInfo, Item, PredictionKey)` → Attach item
* `RemoveItemFromSlot(SlotInfo, PredictionKey)` → Detach item
* `MoveItemBetweenSlots(Source, Dest, Item, Key)` → Move attachment

#### Behavior Configuration

* `GetOccupiedSlotBehavior()` → `Reject` - attachments don't auto-swap
* `CanParticipateInClientPrediction()` → `true` - full prediction support

***

### Replication

#### Why the Fragment Overrides ReplicateSubobjects

The attachment runtime fragment owns UObjects (the attached item instances) that need to replicate. Unlike Actor properties, UObjects don't replicate automatically.

The fragment overrides `ReplicateSubobjects` to handle this:

```cpp
bool UTransientRuntimeFragment_Attachment::ReplicateSubobjects(UActorChannel* Channel,
    FOutBunch* Bunch, FReplicationFlags* RepFlags)
{
    bool bWroteSomething = Super::ReplicateSubobjects(Channel, Bunch, RepFlags);

    for (FAppliedAttachmentEntry& Entry : AttachmentList.Entries)
    {
        if (Entry.ItemInstance)
        {
            // Replicate the attached item
            bWroteSomething |= Channel->ReplicateSubobject(Entry.ItemInstance, *Bunch, *RepFlags);

            // Recursively replicate any fragments on the attached item
            // (including nested attachment containers)
            for (UTransientRuntimeFragment* Fragment : Entry.ItemInstance->GetRuntimeFragments())
            {
                bWroteSomething |= Channel->ReplicateSubobject(Fragment, *Bunch, *RepFlags);
            }
        }
    }
    return bWroteSomething;
}
```

This is called by the owning inventory/equipment manager's `ReplicateSubobjects`, the parent component replicates this fragment, and then this fragment replicates its owned objects.

#### Avoiding Double-Replication

The same item might be reachable through multiple paths (inventory references, equipment references, attachment references). The replication system uses tracking to ensure each UObject is only replicated once per frame.

#### Reconciliation

```cpp
virtual void ReconcileWithPredictedFragment(
    UTransientRuntimeFragment* PredictedFragment) override;
```

When server item replaces predicted item, this transfers:

* Transient pointers (`AttachActor`, `OwningActor`)
* Prediction runtime overlays
* Per-entry cosmetic state

***

### Nested Attachments

Attachments can have their own attachments:

```
Rifle
├── Scope (attachment)
│   └── Laser (attachment on scope)
└── Grip (attachment)
```

When the rifle's state changes:

1. Rifle's attachment container updates all attachments
2. Each attachment with its own container recursively updates
3. State propagates through the entire hierarchy

The `bRecurse` parameter on behavior methods controls this propagation.
