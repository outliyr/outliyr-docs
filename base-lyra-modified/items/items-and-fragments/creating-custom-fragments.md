# Creating Custom Fragments

> [!WARNING]
> **Prerequisite:** Creating new fragment types currently requires C++ programming.

{% stepper %}
{% step %}
### Goal

The goal is to encapsulate new item behaviors or properties into a modular fragment that can be added to `ULyraInventoryItemDefinition` assets in the editor. This might involve:

* Adding new static data to item definitions.
* Implementing custom logic for inventory interactions (weight, combination, add checks).
* Storing unique data per item instance (durability, charge level, internal state).
* Reacting to item lifecycle events (added to container, slot changes, etc.).
{% endstep %}

{% step %}
### Define the Static Fragment (`ULyraInventoryItemFragment`)

This is the base requirement for any new fragment type.

Create a C++ class inheriting from `ULyraInventoryItemFragment`. Example:

{% code title="MyCustomFragment.h" %}
```cpp
#pragma once

#include "Inventory/LyraInventoryItemFragment.h"
#include "MyCustomFragment.generated.h"

UCLASS(MinimalAPI) // Or your module's API macro
class UMyCustomFragment : public ULyraInventoryItemFragment
{
    GENERATED_BODY()

public:
    // Add static properties editable in the Item Definition asset
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "CustomFragment")
    float StaticModifierValue = 1.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "CustomFragment")
    bool bEnableCoolFeature = false;

    // Override necessary virtual functions from base class
    virtual void OnInstanceCreated(ULyraInventoryItemInstance* Instance) const override;
    virtual float GetWeightContribution(const ULyraInventoryItemDefinition* InItemDef, ULyraInventoryItemInstance* InItemInstance) override;
    // ... implement other virtuals like CombineItems, CanAddItemToContainer if needed ...

    // --> Add functions from Step 3 here later <--
};
```
{% endcode %}

{% code title="MyCustomFragment.cpp" %}
```cpp
#include "MyCustomFragment.h"
#include "Inventory/LyraInventoryItemInstance.h" // Include if needed

void UMyCustomFragment::OnInstanceCreated(ULyraInventoryItemInstance* Instance) const
{
    Super::OnInstanceCreated(Instance); // Good practice to call Super

    // Example: Initial setup based on static data
    if (bEnableCoolFeature && Instance)
    {
        // Maybe add an initial StatTag?
        // Instance->AddStatTagStack(TAG_MyFeature_IsEnabled, 1);
        UE_LOG(LogTemp, Log, TEXT("MyCustomFragment: Feature enabled for instance of %s"), *GetNameSafe(Instance->GetItemDef()));
    }
}

float UMyCustomFragment::GetWeightContribution(const ULyraInventoryItemDefinition* InItemDef, ULyraInventoryItemInstance* InItemInstance)
{
    // Example: This fragment adds a fixed weight
    // return 0.5f;
    return Super::GetWeightContribution(InItemDef, InItemInstance); // Default is 0
}

// ... Implement other overridden functions ...
```
{% endcode %}

* Add static properties as `UPROPERTY(EditDefaultsOnly)` to be configured per item-definition in the editor.
* Implement/override base virtuals such as `GetWeightContribution`, `GetItemCountContribution`, `CanCombineItems`, `CombineItems`, `CanAddItemToContainer`, and `OnInstanceCreated` if needed.
{% endstep %}

{% step %}
### Choose and Define Instance Data (Optional)

Most fragments need instance-unique data (durability, charges, internal state). Two main approaches:

* Replicated struct: `FTransientFragmentData` — lightweight, simple data.
* Replicated UObject: `UTransientRuntimeFragment` — advanced logic, Blueprint interop and per-field OnRep hooks.

> [!INFO]
> Not sure which one to pick? Use the comparison table below to choose the right mechanism.

#### Comparison Table: Selecting the Right Instance-Data Mechanism

| Decision Criterion                           | Stat Tags (tag + stack)                                  | FTransientFragmentData (replicated struct) | UTransientRuntimeFragment (replicated UObject)   |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ |
| **Data shape**                               | Single tag + int stack                                   | Any USTRUCT fields                         | Full UObject (vars + functions)                  |
| **Replicates automatically?¹**               | ✔ built-in                                               | ✔ whole struct                             | ✔ but you implement `GetLifetimeReplicatedProps` |
| **Per-field `OnRep` / fine-grained hooks?**  | ✖                                                        | ✖ (whole-struct only)                      | ✔ (`OnRep` per property, `ReplicateSubobjects`)  |
| **Editable in Blueprints?²**                 | Read only (functions exposed by item to manipulate tags) | Read & write values                        | Read & write + call functions                    |
| **Custom per-frame / timer logic?**          | ✖                                                        | ✖                                          | ✔ (`Tick`, timers, delegates)                    |
| **Performance, memory & network overhead?³** | Minimal                                                  | Low                                        | Highest                                          |
| **Use when you need …**                      | Lightweight counters / flags queried via GameplayTags    | Small, structured per-instance data        | Complex state _plus_ behavior                    |

Notes:

* **Replicates automatically?** Stat Tags and `FTransientFragmentData` live inside arrays already replicated by Lyra. Runtime fragments replicate like any custom sub-object: you must list properties in `GetLifetimeReplicatedProps`.
* **Editable in Blueprints?** GameplayTags arrays are exposed but read-only. Struct members are UPROPERTY values (read/write in BP). Runtime fragments are full `UObjects` (call methods, bind events).
* Runtime fragments have higher overhead, prefer struct fragments for common lightweight needs.

Choosing a path:

* If you don’t need instance-specific data, skip to Step 4.
* If your data is simple and structured, use Option A, Struct-Based.
* If your data requires Blueprint functions, replication hooks, or complex behavior, use Option B, UObject-Based.
{% endstep %}

{% step %}
### Option A: Struct-Based Instance Data (`FTransientFragmentData`)

1. Create a struct inheriting from `FTransientFragmentData`.

{% code title="MyCustomFragmentData.h" %}
```cpp
// MyCustomFragmentData.h (or often within MyCustomFragment.h/cpp)
#pragma once

#include "Inventory/LyraInventoryItemDefinition.h" // Base for FTransientFragmentData
#include "MyCustomFragmentData.generated.h"

USTRUCT(BlueprintType)
struct FMyCustomFragmentData : public FTransientFragmentData
{
    GENERATED_BODY()

public:
    // Instance-specific data
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float CurrentValue = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName InstanceSpecificName = NAME_None;

    // Optional: Override lifecycle callbacks
    virtual void AddedToContainer(UObject* Container, ULyraInventoryItemInstance* ItemInstance) override;
    virtual void RemovedFromContainer(UObject* Container, ULyraInventoryItemInstance* ItemInstance) override;
    virtual void DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance) override;
    virtual void ItemMoved(ULyraInventoryItemInstance* ItemInstance, const FInstancedStruct& OldSlot, const FInstancedStruct& NewSlot) override;
};
```
{% endcode %}

2. Add `UPROPERTY()` members for instance data.
3. Optionally implement lifecycle callbacks (`AddedToContainer`, `RemovedFromContainer`, `DestroyTransientFragment`, `ItemMoved`) in the .cpp.
{% endstep %}

{% step %}
### Option B: UObject-Based Instance Data (`UTransientRuntimeFragment`)

1. Create a UObject class inheriting from `UTransientRuntimeFragment`.

{% code title="MyTransientRuntimeFragment.h" %}
```cpp
// MyTransientRuntimeFragment.h
#pragma once

#include "Inventory/LyraInventoryItemDefinition.h" // Base for UTransientRuntimeFragment
#include "MyTransientRuntimeFragment.generated.h"

UCLASS(BlueprintType)
class UMyTransientRuntimeFragment : public UTransientRuntimeFragment
{
    GENERATED_BODY()
public:
    //~ UObject Interface (implement if needed)
    virtual bool IsSupportedForNetworking() const override { return true; }
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual bool ReplicateSubobjects(UActorChannel* Channel, FOutBunch* Bunch, FReplicationFlags* RepFlags) override;
    //~ End UObject Interface

    //~ Lifecycle Callbacks (override if needed)
    virtual void AddedToContainer(UObject* Container, ULyraInventoryItemInstance* ItemInstance) override;
    virtual void RemovedFromContainer(UObject* Container, ULyraInventoryItemInstance* ItemInstance) override;
    virtual void DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance) override;
    virtual void ItemMoved(ULyraInventoryItemInstance* ItemInstance, const FInstancedStruct& OldSlot, const FInstancedStruct& NewSlot) override;

    // Instance-specific data
    UPROPERTY(ReplicatedUsing = OnRep_SomeValue, BlueprintReadOnly)
    int32 ReplicatedInstanceValue = 0;

    UPROPERTY(BlueprintReadOnly)
    FString InstanceDescription;

    UFUNCTION() // Example OnRep
    void OnRep_SomeValue();

    UFUNCTION(BlueprintCallable) // Example BP function
    void DoSomethingInstanceSpecific();
};
```
{% endcode %}

{% code title="MyTransientRuntimeFragment.cpp" %}
```cpp
// MyTransientRuntimeFragment.cpp
#include "MyTransientRuntimeFragment.h"
#include "Net/UnrealNetwork.h" // For DOREPLIFETIME

void UMyTransientRuntimeFragment::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UMyTransientRuntimeFragment, ReplicatedInstanceValue);
}
// ... Implement other functions ...
```
{% endcode %}

2. Add `UPROPERTY()` members and replication specifiers. Implement `GetLifetimeReplicatedProps`.
3. Override `UObject` & lifecycle callbacks (Tick, `ReplicateSubobjects`, `AddedToContainer`, etc.) as needed.
{% endstep %}

{% step %}
### Link Static Fragment to Instance Data

Modify your static fragment (`UMyCustomFragment`) to tell the system which instance-data type to create.

* If you chose Option A (Struct):

{% code title="UMyCustomFragment (struct linkage) - snippets" %}
```cpp
// In UMyCustomFragment class definition
virtual UScriptStruct* GetTransientFragmentDataStruct() const override;
virtual bool CreateNewTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, FInstancedStruct& NewInstancedStruct) override;

// In MyCustomFragment.cpp
#include "MyCustomFragmentData.h"

UScriptStruct* UMyCustomFragment::GetTransientFragmentDataStruct() const
{
    return FMyCustomFragmentData::StaticStruct();
}

bool UMyCustomFragment::CreateNewTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, FInstancedStruct& NewInstancedStruct)
{
    FMyCustomFragmentData InstanceData;
    // Initialize InstanceData based on ItemOwner, ItemInstance, or static props if needed
    InstanceData.CurrentValue = 0.0f;
    InstanceData.InstanceSpecificName = FName(*FString::Printf(TEXT("Instance_%d"), FMath::Rand())); // Example init

    NewInstancedStruct.InitializeAs<FMyCustomFragmentData>(InstanceData);
    return true; // We created data
}
```
{% endcode %}

* If you chose Option B (UObject):

{% code title="UMyCustomFragment (UObject linkage) - snippets" %}
```cpp
// In UMyCustomFragment class definition
virtual TSubclassOf<UTransientRuntimeFragment> GetTransientRuntimeFragment() const override;
virtual bool CreateNewRuntimeTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, UTransientRuntimeFragment*& OutFragment) override;

// In MyCustomFragment.cpp
#include "MyTransientRuntimeFragment.h"

TSubclassOf<UTransientRuntimeFragment> UMyCustomFragment::GetTransientRuntimeFragment() const
{
    return UMyTransientRuntimeFragment::StaticClass();
}

bool UMyCustomFragment::CreateNewRuntimeTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, UTransientRuntimeFragment*& OutFragment)
{
    // Create UObject, ItemInstance is a good Outer
    UMyTransientRuntimeFragment* RuntimeData = NewObject<UMyTransientRuntimeFragment>(ItemInstance);
    if (RuntimeData)
    {
         // Initialize RuntimeData based on ItemOwner, ItemInstance, or static props if needed
         RuntimeData->InstanceDescription = FString::Printf(TEXT("Runtime Fragment for %s"), *GetNameSafe(ItemInstance)); // Example init

         OutFragment = RuntimeData;
         return true; // We created data
    }
    return false;
}
```
{% endcode %}
{% endstep %}

{% step %}
### Compile C++ Code

Compile your project so the new C++ classes are available in the editor.
{% endstep %}

{% step %}
### Add Fragment to Item Definition Asset

1. Find or create the `ULyraInventoryItemDefinition` asset you want to modify.
2. Open the asset, locate the `Fragments` array in the Details panel.
3. Click `+` to add a new element, and select your static fragment class (e.g., `UMyCustomFragment`) from the dropdown.
4. Configure any `EditDefaultsOnly` properties (e.g., `StaticModifierValue`, `bEnableCoolFeature`).
{% endstep %}

{% step %}
### Access Instance Data at Runtime

Refer to the sections on these pages for examples:

* transient struct data: [transient-data-fragments](transient-data-fragments.md#accessing-transient-struct-data-at-runtime)
* transient runtime fragment: [transient-runtime-fragments](transient-runtime-fragments.md#accessing-transient-runtime-fragments-at-runtime)

By following these steps you can create new modular fragments in C++ to extend the inventory system with custom behaviors and instance-specific data, while keeping item definitions clean and functionality encapsulated. Remember to choose struct-based or UObject-based transient data based on complexity and networking needs.
{% endstep %}
{% endstepper %}
