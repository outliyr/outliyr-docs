# Quick Bar Component

Press "1" for your rifle. Press "2" for your pistol. Scroll the mouse wheel to cycle weapons. The Quick Bar provides hotbar-style weapon selection, letting players quickly switch between equipped items with instant feedback, even across network latency.

***

## Why It Lives on the Controller

The Quick Bar sits on the **PlayerController**, not the Pawn. This is intentional:

* **Input origin**: Player input comes through the controller
* **Persistence across death**: When your pawn dies, the controller survives. Your weapon selection ("slot 0 was active") persists, ready for the next spawn
* **Pawn can change**: Respawning, entering vehicles, possession, the controlled pawn changes, but your selection state stays

The [Equipment Manager](equipment-manager-component.md) lives on the **Pawn** and handles actual behavior, spawning actors, granting abilities, managing held state. The Quick Bar handles **selection**, which weapon slot is active.

When the pawn dies, equipment is destroyed. When the player respawns with a new pawn, the Quick Bar rebinds to the new Equipment Manager and syncs its state.

***

## Mirroring Equipment

Quick Bar slots don't own items, they **reference** items in the Equipment Manager. The Equipment Manager is the authoritative owner; the Quick Bar is a selection interface on top.

### **Equipment Slot Mapping**

For structured loadouts, you can map equipment slot tags to Quick Bar indices:

```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite)
TMap<FGameplayTag, int32> EquipmentSlotMapping;
```

Example configuration:

```
Equipment.Slot.Weapon.Primary   → 0
Equipment.Slot.Weapon.Secondary → 1
Equipment.Slot.Throwable        → 2
Equipment.Slot.Utility          → 3
```

With this mapping:

* When a primary weapon is equipped, it automatically appears in Quick Bar slot 0
* Pressing the key to select slot 0 always selects your primary weapon
* The system enforces "one weapon per slot" naturally

### **Auto-Sync with Equipment**

The Quick Bar subscribes to the Equipment Manager's `OnViewDirtiedWithChanges` delegate, which provides specific change info (item added, removed, or modified). Rather than rebuilding all slots on every change, the handler updates only the affected slot. This keeps slot switching correct during multi-operation transactions like pickup swaps.

```cpp
void ULyraQuickBarComponent::TryBindToEquipmentManager()
{
    if (ULyraEquipmentManagerComponent* EquipMgr = FindEquipmentManager())
    {
        EquipMgr->GetOnViewDirtiedWithChanges()->AddUObject(
            this, &ULyraQuickBarComponent::OnEquipmentViewChanged);
    }
}
```

When the controller's possessed pawn changes, the Quick Bar automatically rebinds to the new pawn's Equipment Manager.

***

## Slot Selection

### **Basic Selection**

| Function                       | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `SelectActiveSlotIndex(int32)` | Switch to a specific slot with equipment transitions   |
| `CycleActiveSlotForward()`     | Mouse wheel up — next valid slot                       |
| `CycleActiveSlotBackward()`    | Mouse wheel down — previous valid slot                 |
| `SetActiveSlotIndex(int32)`    | Server RPC — used internally by clients and by AI bots |
| `RevalidateActiveSelection()`  | Find next valid slot when current disappears           |

### **Binding Input**

```cpp
void AMyPlayerController::HandleWeaponSlot1()
{
    QuickBar->SelectActiveSlotIndex(0);
}

void AMyPlayerController::HandleNextWeapon()
{
    QuickBar->CycleActiveSlotForward();
}
```

The cycling functions skip empty slots and wrap around at the ends.

<details class="gb-toggle">

<summary>How Prediction Works</summary>

When a player presses "2" to switch weapons, they expect instant feedback. The Quick Bar provides this through client-side prediction.

**The Flow**

1. **Player calls `SelectActiveSlotIndex(1)`** — this calls `ApplyActiveSlotIndexChange` which builds equip/unequip transactions via `BuildEquipTransaction`
2. **Transactions execute locally** — the transaction ability runs with `LocalPredicted` policy, immediately applying the change on the local prediction overlay. The Equipment Manager spawns predicted weapon actors
3. **Client sends `SetActiveSlotIndex` RPC** — the server receives the slot index and applies the same equipment transitions authoritatively
4. **Reconciliation happens invisibly** — when the server's confirmation arrives, predicted actors are replaced by replicated actors seamlessly

```cpp
void ULyraQuickBarComponent::SelectActiveSlotIndex(int32 NewIndex)
{
    // Builds and executes equip/unequip transactions locally
    ApplyActiveSlotIndexChange(NewIndex, true);

    // Client sends RPC so the server tracks the active index
    if (!GetOwner()->HasAuthority())
    {
        SetActiveSlotIndex(NewIndex);
    }
}
```

From the player's perspective, the weapon was there the whole time.

**Prerequisite**: See [The Overlay Model](../item-container/prediction/the-overlay-model/) for how prediction works across the container system.

</details>

### **AI Weapon Switching**

AI bots use `AAIController` instead of `APlayerController`, so they can't go through the transaction system. When `SetActiveSlotIndex` is called from an AI controller, the Quick Bar falls back to direct `MoveItemBetweenSlots` calls on the Equipment Manager and force-commits deferred visibility so the weapon mesh swaps immediately.

```cpp
// In a State Tree task
InstanceData.QuickBarComponent->SetActiveSlotIndex(BestWeaponSlotIndex);
```

No additional setup is needed. The Quick Bar detects the controller type and routes accordingly.

***

> [!INFO]
> **Want weapon switch animations?** By default, predicted weapon actors appear/disappear instantly during cycling. To sync visibility with equip/unequip montages, enable `bUseDeferredVisibility` on your Equipment Instance and place `AnimNotify_CommitEquipVisibility` notifies on your montages. See [Equipment Instance: Deferred Visibility](equipment-instance.md#deferred-visibility-montage-driven-transitions) for setup details.

***

## Quick Swap Pickup

For Instant weapon pickup with automatic swap, the Quick Bar provides specialized functions.

### **From World Pickups**

```cpp
FQuickSwapResult Result = QuickBar->TryQuickSwapPickupFromPickup(
    WorldPickup,                                // The pickup actor
    AStaticMeshCollectable::StaticClass(),      // For dropped static items
    ASkeletalMeshCollectable::StaticClass(),    // For dropped skeletal items
    EQuickSwapSlotPolicy::PreferActiveSlot,     // Slot selection policy
    true,                                       // Auto-hold the new weapon
    DropParams);                                // How to drop displaced items
```

This uses server validation, the client predicts the pickup, but the server validates that the pickup actor exists and the player can legitimately take it.

### **From Existing Items**

```cpp
FQuickSwapResult Result = QuickBar->TryQuickSwapPickup(
    ItemInstance,                               // Item to add
    StaticCollectableClass,
    SkeletalCollectableClass,
    EQuickSwapSlotPolicy::PreferActiveSlot,
    true,
    DropParams,
    OverrideEquipmentSlot);                     // Optional: target specific slot
```

### **Slot Policies**

| Policy             | Behavior                                   | Best For                     |
| ------------------ | ------------------------------------------ | ---------------------------- |
| `SwapWithHeld`     | Only swap with currently held item         | Strict weapon swap           |
| `PreferActiveSlot` | Try active slot first, then any valid slot | Classic weapon swap          |
| `AnySlot`          | Use any available slot, swap if full       | Flexible loadouts            |
| `AddOnly`          | Only add if empty slot exists, never swap  | Collecting without replacing |

### **The Result Struct**

```cpp
struct FQuickSwapResult
{
    bool bSuccess;                              // Did it work?
    ULyraInventoryItemInstance* ItemPickedUp;   // What was picked up
    ULyraInventoryItemInstance* ItemToDrop;     // What got displaced (may be null)
    int32 SlotIndex;                            // Where it went (-1 if failed)
    FGuid RequestId;                            // For async tracking
    FText ErrorMessage;                         // Why it failed
};
```

***

## UI Integration

The Quick Bar broadcasts gameplay messages when slots or selection changes.

### Message Types

#### **Slots Changed:**

```cpp
USTRUCT(BlueprintType)
struct FLyraQuickBarSlotsChangedMessage
{
    TObjectPtr<AActor> Owner;                              // The controller
    TArray<TObjectPtr<ULyraInventoryItemInstance>> Slots;  // Updated slots
};
```

#### **Active Selection Changed:**

```cpp
USTRUCT(BlueprintType)
struct FLyraQuickBarActiveIndexChangedMessage
{
    TObjectPtr<AActor> Owner;
    int32 ActiveIndex;
};
```

### **Subscribing in Widgets**

```cpp
void UQuickBarWidget::NativeConstruct()
{
    UGameplayMessageSubsystem& Msgs = UGameplayMessageSubsystem::Get(this);

    Msgs.RegisterListener(TAG_Lyra_QuickBar_Message_SlotsChanged,
        this, &UQuickBarWidget::OnSlotsChanged);

    Msgs.RegisterListener(TAG_Lyra_QuickBar_Message_ActiveIndexChanged,
        this, &UQuickBarWidget::OnActiveIndexChanged);
}
```

***

## **Querying State**

```cpp
// Get all slot contents
TArray<ULyraInventoryItemInstance*> Slots = QuickBar->GetSlots();

// Get currently selected index (-1 if none)
int32 ActiveIndex = QuickBar->GetActiveSlotIndex();

// Get item in active slot
ULyraInventoryItemInstance* ActiveItem = QuickBar->GetActiveSlotItem();

// Find first empty slot (-1 if all full)
int32 FreeSlot = QuickBar->GetNextFreeItemSlot();
```

***

## **Troubleshooting**

> [!INFO]
> **Weapon switch feels delayed?** Verify that:
> 
> * The Equipment Manager supports prediction (it should by default)
> * You're calling `SelectActiveSlotIndex()` which triggers prediction, not directly manipulating slots

> [!INFO]
> **Slots not matching equipment?** Check:
> 
> * `EquipmentSlotMapping` maps the correct equipment tags to indices
> * The Quick Bar is bound to the Equipment Manager (happens automatically on possession)
> * The pawn has an Equipment Manager component

> [!INFO]
> **Quick swap not working?** Verify:
> 
> * You're passing valid collectable classes for dropped items
> * The item has a compatible equipment slot (check its Equipment Definition)
> * The policy allows the swap type you're attempting

***
