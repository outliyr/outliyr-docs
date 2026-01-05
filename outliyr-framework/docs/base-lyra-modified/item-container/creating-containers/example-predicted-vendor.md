# Example: Predicted Vendor

This example demonstrates a fully predicted vendor flow where both the item transfer and currency change happen atomically with client prediction.

{% hint style="info" %}
**This is an advanced pattern.** The server-authoritative vendor in [Implementing the Interface](implementing-the-interface.md) is simpler and works well for most games. This page shows the predicted approach for completeness.
{% endhint %}

***

### How It Works

In a server-authoritative vendor, currency is deducted after the transaction succeeds:

```
Transaction(Move item) → Success → DeductCurrency()
```

The currency deduction happens **outside** the transaction, so it doesn't predict. The item appears instantly, but the currency change waits for the server round-trip.

For a fully predicted vendor flow, currency changes must be **inside** the transaction:

```
Transaction(Move item + ModifyTagStack on currency) → Both predict together
```

This requires currency to be a container that the transaction system can operate on.

***

### Currency Container

A currency container is a lightweight container that stores numeric amounts rather than item instances.

#### Storage: Numeric, Not Item Instances

Unlike inventory, the currency container stores amounts directly:

```cpp
USTRUCT()
struct FCurrencyEntry : public FFastArraySerializerItem
{
    GENERATED_BODY()

    UPROPERTY()
    FGameplayTag CurrencyTag;  // e.g., Currency.Gold

    UPROPERTY()
    int32 Amount = 0;

    UPROPERTY()
    FContainerPredictionStamp Prediction;

    // Replication callbacks...
};
```

This is more efficient for currency, no `UObject` overhead for what's essentially a number.

### Slot Descriptor

Currency slots use `FGameplayTag` identifiers:

```cpp
USTRUCT(BlueprintType)
struct FCurrencySlotInfo : public FAbilityData_SourceItem
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FGameplayTag CurrencyTag;  // e.g., Currency.Gold, Currency.Silver

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TWeakObjectPtr<ULyraCurrencyContainerComponent> Container;

    // Required interface methods
    virtual ILyraItemContainerInterface* ResolveContainer(const AController* Controller) const override;
    virtual uint32 GetTypeHash() const override;
    virtual bool Equals(const FAbilityData_SourceItem& Other) const override;
};
```

### `GetItemInSlot`: Cached Instances

For interface compliance, `GetItemInSlot` must return a `ULyraInventoryItemInstance*`. The currency container creates and caches instances on demand:

```cpp
ULyraInventoryItemInstance* ULyraCurrencyContainerComponent::GetItemInSlot(
    const FInstancedStruct& SlotInfo) const
{
    const FCurrencySlotInfo* CurrencySlot = SlotInfo.GetPtr<FCurrencySlotInfo>();
    if (!CurrencySlot) return nullptr;

    // Find entry in effective view
    for (const FCurrencyEntry& Entry : GetEffectiveView())
    {
        if (Entry.CurrencyTag == CurrencySlot->CurrencyTag)
        {
            // Return cached instance with current amount as stack count
            return GetOrCreateCachedInstance(Entry.CurrencyTag, Entry.Amount);
        }
    }
    return nullptr;
}
```

The cached instance's stack count reflects the currency amount. When UI queries the item, it sees the predicted amount.

#### Prediction Without Item Instances

The prediction runtime is GUID-keyed. It tracks overlays by item GUID. But currency containers don't have item instances. How does prediction work?

**Solution: Deterministic GUIDs from tags.**

The slot descriptor generates a stable GUID from the currency tag:

```cpp
FGuid FCurrencySlotInfo::GetItemGuid() const
{
    // Same tag always produces same GUID
    return FGuid::NewDeterministicGuid(CurrencyTag.ToString());
}
```

And the traits extract GUIDs the same way:

```cpp
static FGuid GetGuidFromServerEntry(const FCurrencyEntry& Entry)
{
    return FGuid::NewDeterministicGuid(Entry.CurrencyTag.ToString());
}
```

This means:

* `Currency.Gold` always maps to the same GUID on client and server
* The prediction runtime tracks overlays by this GUID
* `ModifyTagStack` operations become "change" overlays on that GUID
* No actual `ULyraInventoryItemInstance` needed for prediction to work

The currency container uses the same prediction infrastructure from [Adding Prediction](adding-prediction.md), runtime, traits, callbacks, just with tag-based GUIDs instead of item instance GUIDs.

### `ModifyTagStack` for Currency Changes

Currency changes use `FItemTxOp_ModifyTagStack` operations:

```cpp
// Build a currency slot
FInstancedStruct CurrencySlot;
CurrencySlot.InitializeAs<FCurrencySlotInfo>();
CurrencySlot.GetMutable<FCurrencySlotInfo>()->CurrencyTag =
    FGameplayTag::RequestGameplayTag("Currency.Gold");
CurrencySlot.GetMutable<FCurrencySlotInfo>()->Container = CurrencyContainer;

// Decrease gold by 100
Request.AddOp(FItemTxOp_ModifyTagStack(CurrencySlot, StatTags.StackCount, -100));
```

Since this is inside the transaction, it predicts along with any other operations in the same request.

***

### Predicted Buy Flow

With currency as a container, a predicted buy flow includes both operations in one transaction:

```cpp
void UBuyFromVendorAbility::ActivateAbility(...)
{
    const FBuyPayload& Payload = GetEventData<FBuyPayload>();

    FItemTransactionRequest Request;

    // Op 1: Move item from vendor to player inventory
    FInstancedStruct VendorSlot;
    VendorSlot.InitializeAs<FVendorSlotInfo>();
    VendorSlot.GetMutable<FVendorSlotInfo>()->CatalogIndex = Payload.CatalogIndex;
    VendorSlot.GetMutable<FVendorSlotInfo>()->Vendor = Payload.Vendor;

    Request.AddOp(FItemTxOp_Move(VendorSlot, Payload.DestinationSlot));

    // Op 2: Decrease player's currency
    int32 Price = Payload.Vendor->GetBuyPrice(Payload.CatalogIndex);

    FInstancedStruct CurrencySlot;
    CurrencySlot.InitializeAs<FCurrencySlotInfo>();
    CurrencySlot.GetMutable<FCurrencySlotInfo>()->CurrencyTag = CurrencyTag_Gold;
    CurrencySlot.GetMutable<FCurrencySlotInfo>()->Container = GetPlayerCurrencyContainer();

    Request.AddOp(FItemTxOp_ModifyTagStack(CurrencySlot, StatTags.StackCount, -Price));

    // Execute transaction - BOTH operations predict together
    ExecuteTransaction(Request, CurrentPredictionKey);
}
```

{% stepper %}
{% step %}
#### Client prediction

* Item appears in player inventory (overlay add)
* Gold decreases (overlay change on currency entry)
{% endstep %}

{% step %}
#### UI update

* Inventory shows new item
* Gold display shows reduced amount
{% endstep %}

{% step %}
#### Server validation

* Is the catalog index valid?
* Does player have enough gold?
* Can player inventory accept the item?
{% endstep %}

{% step %}
#### Server confirmation or rejection (atomic)

* If success: Both overlays clear, server state takes over
* If failure: Both overlays clear, item disappears, gold restored
{% endstep %}
{% endstepper %}

***
