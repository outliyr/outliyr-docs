# Transient Runtime Fragments

Sometimes per-instance data needs more than flat fields in a struct. It needs to react to individual property changes on the client, own and replicate nested objects, tick every frame, or expose callable functions to Blueprint. [Transient Data Fragments](transient-data-fragments.md) can't do any of that, they're lightweight by design. `UTransientRuntimeFragment` fills the gap by giving each item instance a full `UObject` with the complete Unreal Object system at its disposal.

Runtime fragments are full `UObject` instances that live on a `ULyraInventoryItemInstance`, giving you access to the complete Unreal Object system: fine-grained replication with `OnRep`, ticking, timers, Blueprint-callable functions, and gameplay message listening. Like struct-based transient data, each runtime fragment is logically tied to a specific static `ULyraInventoryItemFragment`.

***

## The Cost of Full UObjects

Before reaching for a runtime fragment, understand what you're paying for:

> Each runtime fragment is a full `UObject`. If you define 5 fragment types as runtime fragments, every item instance creates **6 UObjects**, 1 for the instance itself, plus 5 fragments. Multiply by hundreds of items per player, and you're creating thousands of persistent, GC-tracked objects.

This is why the system offers three tiers:

| Tier                                                    | Type                            | Overhead | Use When                                 |
| ------------------------------------------------------- | ------------------------------- | -------- | ---------------------------------------- |
| [Stat Tags](stat-tags.md)                               | Tag + int32                     | Minimal  | Simple counters, flags                   |
| [Transient Data Fragments](transient-data-fragments.md) | `USTRUCT` in `FInstancedStruct` | Low      | Structured data without UObject features |
| **Transient Runtime Fragments**                         | `UObject` subclass              | Highest  | Complex state _plus_ behavior            |

Use a runtime fragment **only when** you genuinely need:

* **Per-property `OnRep`** — reacting to specific field changes on the client
* **Sub-object replication** — the fragment owns other UObjects that must replicate
* **Ticking or timers** — per-frame logic tied to instance state
* **Blueprint-callable methods with internal state** — exposing instance-specific functions that depend on data stored inside the UObject

{% hint style="info" %}
If you only need a Blueprint-callable function that reads per-instance data, you can put it on the _static_ fragment and pass the `ItemInstance` as a parameter. Only use a runtime fragment if the logic depends on internal UObject state.
{% endhint %}

{% hint style="success" %}
Still unsure? Jump to the [instance-data comparison](creating-custom-fragments.md#choose-and-define-instance-data-optional).
{% endhint %}

***

## Real-World Example: Attachments

The attachment system is the primary user of runtime fragments. `UTransientRuntimeFragment_Attachment` manages a replicated array of attached items, grants and revokes ability sets when the host weapon transitions between held and holstered states, and spawns/destroys visual actors. None of this is possible with a struct.

***

## Implementation

{% stepper %}
{% step %}
**Define the Runtime Fragment Class**

Create a `UObject` subclass of `UTransientRuntimeFragment`. Add replicated properties, implement `GetLifetimeReplicatedProps`, and override lifecycle callbacks as needed.

```cpp
UCLASS(BlueprintType)
class UTransientRuntimeFragment_Charge : public UTransientRuntimeFragment
{
    GENERATED_BODY()
public:
    virtual bool IsSupportedForNetworking() const override { return true; }
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    UPROPERTY(ReplicatedUsing = OnRep_CurrentCharge, BlueprintReadOnly)
    float CurrentCharge = 0.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    float MaxCharge = 100.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    float ChargeRate = 5.0f;

    UFUNCTION()
    void OnRep_CurrentCharge();

    UFUNCTION(BlueprintCallable)
    void Discharge(float Amount);

    // Lifecycle — react to equipment state changes
    virtual void ItemMoved(ULyraInventoryItemInstance* ItemInstance,
        const FInstancedStruct& OldSlot, const FInstancedStruct& NewSlot) override;
};
```

```cpp
void UTransientRuntimeFragment_Charge::GetLifetimeReplicatedProps(
    TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UTransientRuntimeFragment_Charge, CurrentCharge);
}
```
{% endstep %}

{% step %}
**Link from the Static Fragment**

Override two functions on your `ULyraInventoryItemFragment` subclass:

```cpp
TSubclassOf<UTransientRuntimeFragment> GetTransientRuntimeFragment() const override
{
    return UTransientRuntimeFragment_Charge::StaticClass();
}

bool CreateNewRuntimeTransientFragment(AActor* ItemOwner,
    ULyraInventoryItemInstance* ItemInstance,
    UTransientRuntimeFragment*& OutFragment) override
{
    auto* Fragment = NewObject<UTransientRuntimeFragment_Charge>(ItemInstance);
    OutFragment = Fragment;
    return true;
}
```
{% endstep %}

{% step %}
**Add the Static Fragment to Your Item Definition**

Add your fragment to the `Fragments` array. The runtime fragment is created automatically when instances spawn.
{% endstep %}
{% endstepper %}

***

## Accessing Runtime Fragments

{% tabs %}
{% tab title="C++" %}
Use the same `ResolveTransientFragment<T>()` template as struct fragments — it detects at compile time whether the associated type is a `UObject` and routes to the correct array.

```cpp
if (auto* AttachmentData = ItemInstance->ResolveTransientFragment<UInventoryFragment_Attachment>())
{
    // AttachmentData is a UTransientRuntimeFragment_Attachment*
}
```
{% endtab %}

{% tab title="Blueprint" %}
**From Blueprint/C++:** Use `ResolveRuntimeTransientFragment(FragmentClass)` on the `ULyraInventoryItemInstance`, passing the _static_ fragment class. This returns a pointer to the `UTransientRuntimeFragment` base. You'll need to cast this pointer to your specific derived class (e.g., `UTransientRuntimeFragment_Charge`) to access its unique members and functions.

<figure><img src="../../../.gitbook/assets/image (2) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

{% hint style="danger" %}
Cast to the **specific runtime fragment class** that corresponds to the fragment you specified, not the base `UTransientRuntimeFragment`.
{% endhint %}
{% endtab %}
{% endtabs %}

***

## Lifecycle Callbacks

Runtime fragments provide the same lifecycle hooks as struct-based fragments:

| Callback                         | When It Fires                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DestroyTransientFragment`       | Item instance is being permanently destroyed                                                              |
| `AddedToContainer`               | Item added to any container                                                                               |
| `RemovedFromContainer`           | Item removed from a container                                                                             |
| `ItemMoved`                      | Item's slot changed — inspect the old and new `FInstancedStruct` to determine equipment state transitions |
| `ReconcileWithPredictedFragment` | Transfer local state from predicted copy during reconciliation                                            |

> Note: The old `OnEquipped`, `OnUnequipped`, `OnHolster`, and `OnUnholster` callbacks have been removed. Use `ItemMoved()` and check the slot type to detect equipment state transitions.

<details>

<summary>Save interface</summary>

Runtime fragments can opt into persistence through `BlueprintNativeEvent` methods:

* `WantsSave()` — return `true` to opt this fragment into the save system
* `SaveFragmentData()` — serialize the fragment's state for persistence
* `LoadFragmentData()` — restore state from a save

</details>

***

## Replication

The `RuntimeFragments` array on `ULyraInventoryItemInstance` is `TArray<TObjectPtr<UTransientRuntimeFragment>>` and is replicated. For the UObject instances and their internal properties to replicate correctly:

* The owning component (`ULyraInventoryManagerComponent`, `ULyraEquipmentManagerComponent`, etc.) must implement `ReplicateSubobjects` and add these fragments via `AddReplicatedSubObject`. The provided components already handle this.
* Internal replication follows standard UObject rules, implement `GetLifetimeReplicatedProps`, use `DOREPLIFETIME`, handle `OnRep` functions.
* If your runtime fragment owns _other_ UObjects that need replicating, override `ReplicateSubobjects` within your fragment class to handle those nested sub-objects.
