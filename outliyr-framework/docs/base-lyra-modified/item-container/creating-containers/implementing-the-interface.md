# Implementing The Interface

This guide walks you through implementing `ILyraItemContainerInterface` using a Vendor as our example. By the end, you'll have a functional container that works with the transaction system.

{% hint style="warning" %}
**This is a simplified documentation example.** The code snippets demonstrate interface patterns, not production-ready vendor logic. Real implementations would need additional error handling, currency subsystem integration, and replication setup, etc.
{% endhint %}

***

### The Vendor Example

We'll build a vendor component that:

* Has a catalog of items for sale (with stock limits)
* Validates purchases through `CanRemoveItem` (checks stock + affordability)
* Uses standard item moves for buying/selling (no special `Buy()`/`Sell()` methods)
* Uses server authority (no client prediction)

***

{% stepper %}
{% step %}
### Step 1: Define Your Slot Descriptor

Every container needs a slot descriptor that inherits from `FAbilityData_SourceItem`.

For a vendor, slots are identified by a catalog index:

```cpp
USTRUCT(BlueprintType)
struct FVendorSlotInfo : public FAbilityData_SourceItem
{
    GENERATED_BODY()

    // Which catalog entry this slot represents
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 CatalogIndex = INDEX_NONE;

    // Reference to the vendor (for container resolution)
    UPROPERTY()
    TWeakObjectPtr<UVendorComponent> Vendor;

    // Required: Find the container from this slot
    virtual ILyraItemContainerInterface* ResolveContainer(
        const APlayerController* PC) const override
    {
        return Vendor.Get();
    }

    // Required: Equality for slot matching
    virtual bool Equals(const FAbilityData_SourceItem& Other) const override
    {
        if (const FVendorSlotInfo* OtherSlot =
            static_cast<const FVendorSlotInfo*>(&Other))
        {
            return CatalogIndex == OtherSlot->CatalogIndex
                && Vendor == OtherSlot->Vendor;
        }
        return false;
    }

    // Required: Hash for map storage
    virtual uint32 GetTypeHash() const override
    {
        return HashCombine(::GetTypeHash(CatalogIndex),
                          ::GetTypeHash(Vendor.Get()));
    }
};
```

Key Points:

* `CatalogIndex` identifies which item in the vendor's catalog
* `Vendor` weak pointer lets us resolve the container from just the slot
* `Equals/GetTypeHash` enable the transaction system to compare slots
{% endstep %}

{% step %}
### Step 2: Define Your Data Structures

The vendor needs a catalog of what's for sale:

```cpp
USTRUCT(BlueprintType)
struct FVendorCatalogEntry
{
    GENERATED_BODY()

    // What item this entry sells
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef;

    // How many are in stock (-1 = unlimited)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Stock = -1;

    // Price to buy from vendor
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 BuyPrice = 100;

    // Price vendor pays when player sells (0 = won't buy)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 SellPrice = 0;
};
```
{% endstep %}

{% step %}
### Step 3: Implement the Interface

Now the component itself:

```cpp
UCLASS(BlueprintType)
class UVendorComponent : public UActorComponent, public ILyraItemContainerInterface
{
    GENERATED_BODY()

public:
    // The vendor's catalog
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Replicated)
    TArray<FVendorCatalogEntry> Catalog;

    // Cached item instances for display (created on-demand)
    UPROPERTY()
    TMap<int32, TObjectPtr<ULyraInventoryItemInstance>> CachedInstances;

    // === ILyraItemContainerInterface ===

    virtual int32 CanAcceptItem(const FInstancedStruct& SlotInfo,
        const ULyraInventoryItemInstance* Item,
        const AController* Instigator) const override;

    virtual int32 CanRemoveItem(const FInstancedStruct& SlotInfo,
        const ULyraInventoryItemInstance* Item,
        const AController* Instigator) const override;

    virtual bool AddItemToSlot(const FInstancedStruct& SlotInfo,
        ULyraInventoryItemInstance* Item, FPredictionKey PredictionKey,
        bool bForceAdd = false) override;

    virtual ULyraInventoryItemInstance* RemoveItemFromSlot(
        const FInstancedStruct& SlotInfo, FPredictionKey PredictionKey) override;

    virtual ULyraInventoryItemInstance* GetItemInSlot(
        const FInstancedStruct& SlotInfo) const override;

    virtual int32 ForEachItem(
        TFunctionRef<bool(ULyraInventoryItemInstance*, const FInstancedStruct&)>
        Callback) const override;

    virtual FString GetContainerDebugName() const override;

    virtual bool CanParticipateInClientPrediction(
        const AController* PredictingController) const override;

    // === Query Methods (for UI) ===

    UFUNCTION(BlueprintCallable)
    int32 GetBuyPrice(int32 CatalogIndex) const;

    UFUNCTION(BlueprintCallable)
    int32 GetSellPrice(TSubclassOf<ULyraInventoryItemDefinition> ItemDef) const;

private:
    // Helper: Get player's currency (integrate with your currency system)
    int32 GetPlayerCurrency(const AController* PC) const;
};
```
{% endstep %}

{% step %}
### Step 4: Implement Each Method

#### `CanAcceptItem` (Player Selling)

This checks if the vendor will buy an item the player wants to sell:

```cpp
int32 UVendorComponent::CanAcceptItem(const FInstancedStruct& SlotInfo,
    const ULyraInventoryItemInstance* Item,
    const AController* Instigator) const
{
    if (!Item) return 0;

    // Find a catalog entry that buys this item type
    for (const FVendorCatalogEntry& Entry : Catalog)
    {
        if (Entry.ItemDef == Item->GetItemDef() && Entry.SellPrice > 0)
        {
            // Vendor buys this item type
            // Return how many we can accept (for stackable items)
            return MAX_int32; // Unlimited for simplicity
        }
    }

    // Vendor doesn't buy this item type
    return 0;
}
```

Key insight: `CanAcceptItem` answers "can the player sell this here?" For vendors, that means checking if any catalog entry buys this item type.

***

#### `CanRemoveItem` (Player Buying)

Purchase validation (stock + affordability):

```cpp
int32 UVendorComponent::CanRemoveItem(const FInstancedStruct& SlotInfo,
    const ULyraInventoryItemInstance* Item,
    const AController* Instigator) const
{
    const FVendorSlotInfo* VendorSlot = SlotInfo.GetPtr<FVendorSlotInfo>();
    if (!VendorSlot) return 0;

    // Validate catalog index
    if (!Catalog.IsValidIndex(VendorSlot->CatalogIndex))
    {
        return 0;
    }

    const FVendorCatalogEntry& Entry = Catalog[VendorSlot->CatalogIndex];

    // Check stock
    if (Entry.Stock == 0)
    {
        return 0; // Out of stock
    }

    // Check affordability
    int32 PlayerCurrency = GetPlayerCurrency(Instigator);
    if (PlayerCurrency < Entry.BuyPrice)
    {
        return 0; // Can't afford
    }

    // Return how many the player can purchase (limited by stock and affordability)
    int32 MaxAffordable = PlayerCurrency / Entry.BuyPrice;
    return (Entry.Stock < 0) ? MaxAffordable : FMath::Min(Entry.Stock, MaxAffordable);
}
```

Key insight: `CanRemoveItem` is the purchase validation. It's read-only, no state changes. Returning a quantity enables partial purchases for stackable items.

***

#### `AddItemToSlot` (Player Sells to Vendor)

Called when a player sells:

```cpp
bool UVendorComponent::AddItemToSlot(const FInstancedStruct& SlotInfo,
    ULyraInventoryItemInstance* Item, FPredictionKey PredictionKey, bool bForceAdd)
{
    if (!Item) return false;

    // Validate (unless forcing during correction)
    if (!bForceAdd && CanAcceptItem(SlotInfo, Item) == 0)
    {
        return false;
    }

    // Vendor "accepts" the item - in practice, we might:
    // - Add to vendor's stock count
    // - Just absorb it (vendor has infinite capacity)
    // - Track for resale to other players

    // For this example, vendor just absorbs the item
    // The item instance can be destroyed or recycled

    return true;
}
```

Key insight: Vendor doesn't need to store the item permanently. Currency is handled separately by the Sell ability, not here.

***

#### `RemoveItemFromSlot` (Player Buys from Vendor)

Called when a player buys:

```cpp
ULyraInventoryItemInstance* UVendorComponent::RemoveItemFromSlot(
    const FInstancedStruct& SlotInfo, FPredictionKey PredictionKey)
{
    const FVendorSlotInfo* VendorSlot = SlotInfo.GetPtr<FVendorSlotInfo>();
    if (!VendorSlot) return nullptr;

    // Validate catalog index
    if (!Catalog.IsValidIndex(VendorSlot->CatalogIndex))
    {
        return nullptr;
    }

    FVendorCatalogEntry& Entry = Catalog[VendorSlot->CatalogIndex];

    // Check stock
    if (Entry.Stock == 0)
    {
        return nullptr; // Out of stock
    }

    // Decrement stock (if not unlimited)
    if (Entry.Stock > 0)
    {
        Entry.Stock--;
    }

    // Create a new item instance for the player
    ULyraInventoryItemInstance* NewItem = NewObject<ULyraInventoryItemInstance>(this);
    NewItem->SetItemDef(Entry.ItemDef);

    return NewItem;
}
```

Key insight: Vendor creates items on-demand. It doesn't "store" instances, it has a catalog and manufactures instances when purchased.

***

#### `GetItemInSlot`

For UI display, return what's in a catalog slot:

```cpp
ULyraInventoryItemInstance* UVendorComponent::GetItemInSlot(
    const FInstancedStruct& SlotInfo) const
{
    const FVendorSlotInfo* VendorSlot = SlotInfo.GetPtr<FVendorSlotInfo>();
    if (!VendorSlot) return nullptr;

    if (!Catalog.IsValidIndex(VendorSlot->CatalogIndex))
    {
        return nullptr;
    }

    // Return cached instance (or create one for display)
    // This is a const method, so we'd need mutable cache or
    // pre-populate during BeginPlay
    return CachedInstances.FindRef(VendorSlot->CatalogIndex);
}
```

***

#### `ForEachItem`

Iterate the catalog for UI population:

```cpp
int32 UVendorComponent::ForEachItem(
    TFunctionRef<bool(ULyraInventoryItemInstance*, const FInstancedStruct&)>
    Callback) const
{
    int32 Count = 0;

    for (int32 i = 0; i < Catalog.Num(); ++i)
    {
        // Skip out-of-stock items (optional)
        if (Catalog[i].Stock == 0) continue;

        // Get or create display instance
        ULyraInventoryItemInstance* DisplayInstance =
            CachedInstances.FindRef(i);

        if (!DisplayInstance) continue;

        // Build slot descriptor
        FInstancedStruct SlotInfo;
        SlotInfo.InitializeAs<FVendorSlotInfo>();
        FVendorSlotInfo* VendorSlot = SlotInfo.GetMutable<FVendorSlotInfo>();
        VendorSlot->CatalogIndex = i;
        VendorSlot->Vendor = const_cast<UVendorComponent*>(this);

        ++Count;
        if (!Callback(DisplayInstance, SlotInfo))
        {
            break;
        }
    }

    return Count;
}
```

***

#### Simple Methods

```cpp
FString UVendorComponent::GetContainerDebugName() const
{
    return FString::Printf(TEXT("Vendor[%s]"), *GetOwner()->GetName());
}

bool UVendorComponent::CanParticipateInClientPrediction(
    const AController* PredictingController) const
{
    return false; // Server authority - no prediction
}
```
{% endstep %}

{% step %}
### Step 5: Currency Handling

The vendor validates affordability in `CanRemoveItem`, but where does the actual currency deduction happen?

#### The "Ability-Handles-Currency" Pattern

Currency deduction happens in the ability layer, not in the container. When a purchase transaction succeeds, the ability deducts currency:

```cpp
// In a vendor purchase ability (simplified)
void UGA_VendorPurchase::ExecutePurchase(const FInstancedStruct& VendorSlot,
    const FInstancedStruct& InventorySlot, APlayerController* PC)
{
    // Build the move transaction
    FItemTransactionRequest Request;
    Request.AddOp(FItemTxOp_Move(VendorSlot, InventorySlot));

    // Execute the transaction (calls CanRemoveItem, then RemoveItemFromSlot)
    if (ExecuteTransactionRequest(PC, Request))
    {
        // Transaction succeeded - now deduct currency
        int32 Price = GetVendorPrice(VendorSlot);
        DeductPlayerCurrency(PC, Price);
    }
}
```

Why This Pattern?

1. Clean separation - Container validates, ability handles side effects
2. No instigator caching - `RemoveItemFromSlot` doesn't need to know who's buying
3. Matches existing patterns - Currency after successful transaction
4. Flexibility - Different abilities can handle currency differently

Query Methods for UI

```cpp
int32 UVendorComponent::GetBuyPrice(int32 CatalogIndex) const
{
    if (Catalog.IsValidIndex(CatalogIndex))
    {
        return Catalog[CatalogIndex].BuyPrice;
    }
    return 0;
}

int32 UVendorComponent::GetSellPrice(TSubclassOf<ULyraInventoryItemDefinition> ItemDef) const
{
    for (const FVendorCatalogEntry& Entry : Catalog)
    {
        if (Entry.ItemDef == ItemDef && Entry.SellPrice > 0)
        {
            return Entry.SellPrice;
        }
    }
    return 0;
}
```
{% endstep %}

{% step %}
### Step 6: Why This Design?

#### Buying Is Just Moving

The key insight is that purchasing doesn't need special treatment:

```
┌──────────────────────────────────────────────────────────────┐
│ UI                                                           │
│                                                              │
│  Player drags item from vendor slot 3 to inventory slot 5    │
│  → ExecuteTransactionRequest(PC, MoveOp)                     │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ TRANSACTION SYSTEM                                           │
│                                                              │
│  ValidateMoveOp:                                             │
│  1. CanRemoveItem(VendorSlot) → Stock? Affordable?           │
│  2. CanAcceptItem(InventorySlot) → Has space?                │
│  3. Execute: RemoveItemFromSlot → AddItemToSlot              │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ ABILITY (after success)                                      │
│                                                              │
│  DeductPlayerCurrency(PC, Price)                             │
└──────────────────────────────────────────────────────────────┘
```

CanRemoveItem Is the Validation Layer

All purchase business logic lives in `CanRemoveItem`:

* Stock availability
* Currency requirements
* Any other vendor-specific rules

This is declarative, the transaction system asks "can this happen?" before doing anything.

Currency Flexibility

Different vendors can check different currencies in `CanRemoveItem`:

```cpp
// Gold vendor
int32 UGoldVendorComponent::CanRemoveItem(...) const
{
    int32 PlayerGold = UGoldSubsystem::Get(Instigator)->GetGold();
    if (PlayerGold < Entry.BuyPrice) return 0;
    return PlayerGold / Entry.BuyPrice; // How many can afford
}

// Reputation vendor
int32 UReputationVendorComponent::CanRemoveItem(...) const
{
    int32 Reputation = UFactionSubsystem::Get(Instigator)->GetReputation(FactionTag);
    if (Reputation < Entry.ReputationCost) return 0;
    return Reputation / Entry.ReputationCost;
}

// Token vendor (tokens are items!)
int32 UTokenVendorComponent::CanRemoveItem(...) const
{
    int32 TokenCount = CountTokensInInventory(Instigator);
    if (TokenCount < Entry.TokenCost) return 0;
    return TokenCount / Entry.TokenCost;
}
```

Server Authority

Because `CanRemoveItem` runs on both client and server:

* Client: Pre-validates for UI feedback (gray out unaffordable items)
* Server: Authoritative validation before executing

Stock and currency can't be exploited, the server always has final say.
{% endstep %}
{% endstepper %}

***

### What About Prediction?

Notice we didn't implement:

* `FFastArraySerializer`
* Prediction stamps
* Overlay management
* Traits

That's because this vendor is server-authoritative. The interface methods contain the real logic, and prediction is disabled.

For containers that need prediction (player inventory, equipment), the pattern changes significantly. See [Adding Prediction](adding-prediction.md) for how the architecture differs.

***

### Implementation Checklist

Use this checklist when implementing any custom container.

#### Slot Descriptor

* [ ] Inherits from `FAbilityData_SourceItem`
* [ ] Has a pointer/reference to the container
* [ ] Implements `ResolveContainer()` returning the container interface
* [ ] Implements `GetItemGuid()` returning the item's GUID (or invalid if empty)
* [ ] Implements `GetTypeHash()` for slot comparison
* [ ] Implements `operator==` for equality checks

#### Required Interface Methods

* [ ] `CanAcceptItem` - Returns 0 if rejected, >0 for quantity accepted
* [ ] `AddItemToSlot` - Adds item to slot, returns success
* [ ] `RemoveItemFromSlot` - Removes and returns item from slot
* [ ] `GetItemInSlot` - Returns item in slot or nullptr
* [ ] `ForEachItem` - Iterates all items with their slot descriptors

#### Optional Interface Methods

* [ ] `CanRemoveItem` - Override if you have removal validation (default allows all)
* [ ] `MoveItemBetweenSlots` - Override if you support internal repositioning
* [ ] `FindAvailableSlot` - Override if you support auto-placement
* [ ] `GetOccupiedSlotBehavior` - Override if you support swap/stack combining
* [ ] `CanParticipateInClientPrediction` - Override to return true for prediction support
* [ ] `GetContainerDebugName` - Override for better debug output

#### Testing

* [ ] Each interface method works in isolation
* [ ] Slot descriptors hash and compare correctly
* [ ] `ForEachItem` visits every item exactly once
* [ ] Items added via `AddItemToSlot` appear in `GetItemInSlot`
* [ ] Items removed via `RemoveItemFromSlot` no longer appear
* [ ] Replication works in multiplayer (if applicable)
* [ ] Transaction system can move items to/from your container

***

### Next Steps

This vendor works but has network latency on every purchase. For containers where that matters, see [Adding Prediction](adding-prediction.md) to understand how the implementation pattern changes.
