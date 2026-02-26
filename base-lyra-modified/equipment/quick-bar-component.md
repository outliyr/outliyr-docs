# Quick Bar Component

Press "1" for your rifle. Press "2" for your pistol. Scroll the mouse wheel to cycle weapons. The Quick Bar provides hotbar-style weapon selection, letting players quickly switch between equipped items with instant feedback, even across network latency.

***

### Why It Lives on the Controller

The Quick Bar sits on the **PlayerController**, not the Pawn. This is intentional:

* **Input origin**: Player input comes through the controller
* **Persistence across death**: When your pawn dies, the controller survives. Your weapon selection ("slot 0 was active") persists, ready for the next spawn
* **Pawn can change**: Respawning, entering vehicles, possession - the controlled pawn changes, but your selection state stays

The [Equipment Manager](equipment-manager-component.md) lives on the **Pawn** and handles actual behavior, spawning actors, granting abilities, managing held state. The Quick Bar handles **selection**, which weapon slot is active.

When the pawn dies, equipment is destroyed. When the player respawns with a new pawn, the Quick Bar rebinds to the new Equipment Manager and syncs its state.

***

### Mirroring Equipment

Quick Bar slots don't own items, they **reference** items in the Equipment Manager. The Equipment Manager is the authoritative owner; the Quick Bar is a selection interface on top.

#### Equipment Slot Mapping

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
* Pressing "1" always selects your primary weapon
* The system enforces "one weapon per slot" naturally

#### Auto-Sync with Equipment

The Quick Bar subscribes to the Equipment Manager's `OnViewDirtied` delegate. Whenever equipment changes, i.e. through transactions, replication, or prediction reconciliation, the Quick Bar updates its slots to match.

```cpp
void ULyraQuickBarComponent::TryBindToEquipmentManager()
{
    if (ULyraEquipmentManagerComponent* EquipMgr = FindEquipmentManager())
    {
        EquipMgr->OnViewDirtied.AddUObject(this, &ULyraQuickBarComponent::OnEquipmentViewDirtied);
    }
}
```

When the controller's possessed pawn changes, the Quick Bar automatically rebinds to the new pawn's Equipment Manager.

***

### Slot Selection

#### Basic Selection

| Function                      | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `SetActiveSlotIndex(int32)`   | Server RPC - switch to specific slot         |
| `CycleActiveSlotForward()`    | Mouse wheel up - next valid slot             |
| `CycleActiveSlotBackward()`   | Mouse wheel down - previous valid slot       |
| `RevalidateActiveSelection()` | Find next valid slot when current disappears |

#### Binding Input

```cpp
void AMyPlayerController::HandleWeaponSlot1()
{
    QuickBar->SetActiveSlotIndex(0);
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

1. **Client calls `SetActiveSlotIndex(1)`** - This is a Server RPC, but prediction kicks in before it reaches the server
2. **`ExecutePredictedSlotChange()` runs locally** - The client doesn't wait. It immediately:
   * Builds a transaction via `BuildEquipTransaction()`
   * Executes on the local prediction overlay
   * The Equipment Manager spawns predicted weapon actors
3. **Server RPC executes** - The server validates the request and applies the authoritative change
4. **Reconciliation happens invisibly** - When the server's response arrives:
   * Predicted actors are destroyed
   * Replicated actors are revealed
   * The visual transition is seamless

```cpp
void ULyraQuickBarComponent::SetActiveSlotIndex(int32 NewIndex)
{
    // Client prediction happens before RPC reaches server
    ExecutePredictedSlotChange(NewIndex);

    // Then server processes authoritatively...
}
```

From the player's perspective, the weapon was there the whole time.

**Prerequisite**: See [The Overlay Model](../item-container/prediction/the-overlay-model/) for how prediction works across the container system.

</details>

***

> [!INFO]
> **Want weapon switch animations?** By default, predicted weapon actors appear/disappear instantly during cycling. To sync visibility with equip/unequip montages, enable `bUseDeferredVisibility` on your Equipment Instance and place `AnimNotify_CommitEquipVisibility` notifies on your montages. See [Equipment Instance: Deferred Visibility](equipment-instance.md#deferred-visibility-montage-driven-transitions) for setup details.

***

### Quick Swap Pickup

For Instant weapon pickup with automatic swap, the Quick Bar provides specialized functions.

#### From World Pickups

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

#### From Existing Items

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

#### Slot Policies

| Policy             | Behavior                                   | Best For                     |
| ------------------ | ------------------------------------------ | ---------------------------- |
| `SwapWithHeld`     | Only swap with currently held item         | Strict weapon swap           |
| `PreferActiveSlot` | Try active slot first, then any valid slot | Classic weapon swap          |
| `AnySlot`          | Use any available slot, swap if full       | Flexible loadouts            |
| `AddOnly`          | Only add if empty slot exists, never swap  | Collecting without replacing |

#### The Result Struct

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

### UI Integration

The Quick Bar broadcasts gameplay messages when slots or selection changes.

#### Message Types

**Slots Changed:**

```cpp
USTRUCT(BlueprintType)
struct FLyraQuickBarSlotsChangedMessage
{
    TObjectPtr<AActor> Owner;                           // The controller
    TArray<TObjectPtr<ULyraInventoryItemInstance>> Slots;  // Updated slots
};
```

**Active Selection Changed:**

```cpp
USTRUCT(BlueprintType)
struct FLyraQuickBarActiveIndexChangedMessage
{
    TObjectPtr<AActor> Owner;
    int32 ActiveIndex;
};
```

#### Subscribing in Widgets

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

### Configuration

| Property               | Default | Purpose                                               |
| ---------------------- | ------- | ----------------------------------------------------- |
| `NumSlots`             | 2       | Number of Quick Bar slots                             |
| `EquipmentSlotMapping` | Empty   | Maps equipment slot tags to indices                   |
| `bAutoSelectFirstItem` | true    | Auto-select first valid slot when nothing is selected |

***

#### Querying State

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

#### Troubleshooting

> [!INFO]
> **Weapon switch feels delayed?** Verify that:
> 
> * The Equipment Manager supports prediction (it should by default)
> * You're calling `SetActiveSlotIndex()` which triggers prediction, not directly manipulating slots

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
