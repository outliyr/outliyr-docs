# Creating Custom Fragments

This guide provides a step-by-step process for creating your own custom `ULyraInventoryItemFragment`s, including optional associated instance-specific data using either `FTransientFragmentData` (structs) or `UTransientRuntimeFragment` (UObjects).

> [!warning]
> **Prerequisite:** Creating new fragment types currently requires C++ programming.

***

### Goal

The goal is to encapsulate new item behaviors or properties into a modular fragment that can be added to `ULyraInventoryItemDefinition` assets in the editor. This might involve:

* Adding new static data to item definitions.
* Implementing custom logic for inventory interactions (weight, combination, add checks).
* Storing unique data per item instance (durability, charge level, internal state).
* Reacting to item lifecycle events (equipped, added to inventory, etc.).

***

### Step 1: Define the Static Fragment (`ULyraInventoryItemFragment`)

This is the base requirement for any new fragment type.

1.  **Create C++ Class:** In your C++ IDE or the Unreal Editor C++ Class Wizard, create a new class inheriting from `ULyraInventoryItemFragment`. Let's call it `UMyCustomFragment`.

    ```cpp
    // MyCustomFragment.h
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
        virtual float GetWeightContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef, ULyraInventoryItemInstance* ItemInstance) override;
        // ... implement other virtuals like CombineItems, CanAddItemToInventory if needed ...

        // --> Add functions from Step 3 here later <--
    };

    // MyCustomFragment.cpp
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

    float UMyCustomFragment::GetWeightContribution(...)
    {
        // Example: This fragment adds a fixed weight
        // return 0.5f;
        return Super::GetWeightContribution(Inventory, ItemDef, ItemInstance); // Default is 0
    }

    // ... Implement other overridden functions ...
    ```
2. **Add Static Properties:** Define any `UPROPERTY(EditDefaultsOnly)` variables needed. These will be configured per-item-definition in the editor.
3. **Implement Base Virtuals:** Override functions like `GetWeightContribution`, `GetItemCountContribution`, `CombineItems`, `CanAddItemToInventory` if your fragment needs to influence these standard inventory operations. Implement `OnInstanceCreated` if you need to do something _to_ the instance based _only_ on this fragment's static data when the instance is first made.

### Step 2: Choose and Define Instance Data (Optional)

Most fragments don’t just define static behavior, they often need to store data **unique to each item instance** (like durability, charges, or contained items).\
There are two main ways to do that, depending on complexity and access needs:

* Use a **replicated struct** (`FTransientFragmentData`) for lightweight, simple data.
* Use a **replicated UObject** (`UTransientRuntimeFragment`) when you need advanced logic or Blueprint interop.

> [!info]
> **Not sure which one to pick?**\
> Use the comparison table below to choose the right mechanism for your fragment.

#### Comparison Table: Selecting the Right Instance-Data Mechanism

| Decision Criterion                                                  | <p><strong>Stat Tags</strong></p><p>(tag + stack)</p>    | <p><strong><code>FTransientFragmentData</code></strong></p><p>(replicated struct)</p> | <p><strong><code>UTransientRuntimeFragment</code></strong></p><p>(replicated <code>UObject</code>)</p> |
| ------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Data shape**                                                      | Single tag + int stack                                   | Any USTRUCT fields                                                                    | Full UObject (vars + functions)                                                                        |
| **Replicates automatically?¹**                                      | ✔ built-in                                               | ✔ whole struct                                                                        | ✔ but you implement `GetLifetimeReplicatedProps`                                                       |
| **Per-field `OnRep` / fine-grained hooks?**                         | ✖                                                        | ✖ (whole-struct only)                                                                 | ✔ (`OnRep` per property, `ReplicateSubobjects`)                                                        |
| **Editable in Blueprints?²**                                        | Read only (functions exposed by item to manipulate tags) | Read & write values                                                                   | Read & write + call functions                                                                          |
| **Custom per-frame / timer logic?**                                 | ✖                                                        | ✖                                                                                     | ✔ (`Tick`, timers, delegates)                                                                          |
| **Performance,** **memory & network overhead**<sup>**3**</sup>**?** | Minimal                                                  | Low                                                                                   | Highest (full UObject headers + per-property deltas)                                                   |
| **Use when you need …**                                             | Lightweight counters / flags queried via GameplayTags    | Small, structured per-instance data (durability, seeds, cached refs)                  | Complex state _plus_ behavior (attachment manager, charge meters, etc.)                                |

* **Replicates automatically?**\
  &#xNAN;_&#x53;tat Tags_ and _`FTransientFragmentData`_ live inside arrays already replicated by Lyra. Runtime fragments replicate like any custom sub-object: you must list properties in `GetLifetimeReplicatedProps`.
* **Editable in Blueprints?**
  * GameplayTags arrays are exposed but _read-only_ (stacks can be modified via C++/BP helper functions, not by editing fields).
  * Struct members are `UPROPERTY` values, so you can read/write them in BP, however you cannot access the functions inside a struct from blueprints only c++.
  * Runtime fragments are full UObjects: you can call methods, bind events, etc.
* **Performance, memory & network overhead**
  * Runtime fragments scale poorly if used carelessly; prefer struct fragments for common lightweight needs.

#### Choosing a Path

Once you've reviewed the table:

* If you **don’t need any instance-specific data**, you’re done. Skip to Step 4.
* If your data is **simple and structured**, go to Option A – Struct-Based.
* If your data requires **blueprint exposed functions, replication hooks, or Blueprint logic**, skip to Option B – UObject-Based.

#### Option A: Struct-Based Instance Data (`FTransientFragmentData`)

1.  **Create C++ Struct:** Define a new struct inheriting from `FTransientFragmentData`.

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
        virtual void AddedToInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance) override;
        virtual void DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance) override;
        // ... override others like OnEquipped, ItemMoved if needed ...
    };

    // MyCustomFragmentData.cpp (if needed for implementations)
    #include "MyCustomFragmentData.h"

    void FMyCustomFragmentData::AddedToInventory(...) { /* Logic */ }
    void FMyCustomFragmentData::DestroyTransientFragment(...) { /* Cleanup */ }
    // ...
    ```
2. **Add Members:** Define `UPROPERTY()` members for your instance data.
3. **Implement Lifecycle Callbacks:** Optionally override the virtual functions to add logic tied to the owning item instance's events.

#### Option B: UObject-Based Instance Data (`UTransientRuntimeFragment`)

1.  **Create C++ Class:** Define a new class inheriting from `UTransientRuntimeFragment`.

    ```cpp
    // MyTransientRuntimeFragment.h
    #pragma once

    #include "Inventory/LyraInventoryItemDefinition.h" // Base for UTransientRuntimeFragment
    #include "MyTransientRuntimeFragment.generated.h"

    UCLASS(BlueprintType) // Or MinimalAPI
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
        virtual void AddedToInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance) override;
        virtual void DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance) override;
        // ... override others like OnEquipped, ItemMoved if needed ...

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
2. **Add Members:** Define `UPROPERTY()` members. Use replication specifiers (`Replicated`, `ReplicatedUsing`) as needed. Implement `GetLifetimeReplicatedProps`.
3. **Implement Lifecycle/UObject Callbacks:** Override UObject virtuals (`Tick`, `ReplicateSubobjects`) and/or the transient fragment lifecycle functions as required.

### Step 3: Link Static Fragment to Instance Data

Go back to your static fragment class (`UMyCustomFragment.h/.cpp` from Step 1) and link it to the instance data type you created in Step 2.

*   **If you chose Option A (Struct):**

    ```cpp
    // Add to UMyCustomFragment class definition in MyCustomFragment.h
    // Tells the system which struct type this fragment uses
    virtual UScriptStruct* GetTransientFragmentDataStruct() const override;

    // Add to UMyCustomFragment class definition in MyCustomFragment.h
    // Creates the actual struct instance when an item instance is made
    virtual bool CreateNewTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, FInstancedStruct& NewInstancedStruct) override;

    // In MyCustomFragment.cpp
    #include "MyCustomFragmentData.h" // Include your struct header

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
*   **If you chose Option B (UObject):**

    ```cpp
    // Add to UMyCustomFragment class definition in MyCustomFragment.h
    // Tells the system which UObject class this fragment uses
    virtual TSubclassOf<UTransientRuntimeFragment> GetTransientRuntimeFragment() const override;

    // Add to UMyCustomFragment class definition in MyCustomFragment.h
    // Creates the actual UObject instance when an item instance is made
    virtual bool CreateNewRuntimeTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, UTransientRuntimeFragment*& OutFragment) override;

    // In MyCustomFragment.cpp
    #include "MyTransientRuntimeFragment.h" // Include your UObject header

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

### Step 4: Compile C++ Code

Compile your project to make the new C++ classes available in the editor.

### Step 5: Add Fragment to Item Definition Asset

1. **Find or Create:** Locate the `ULyraInventoryItemDefinition` asset(s) you want to use this new fragment with, or create a new one.
2. **Add Fragment:** Open the asset, find the `Fragments` array property in the Details panel.
3. **Select Class:** Click `+` to add a new element, and select your static fragment class (`UMyCustomFragment`) from the dropdown.
4. **Configure:** Set the values for any `EditDefaultsOnly` properties you defined on `UMyCustomFragment` (like `StaticModifierValue`, `bEnableCoolFeature`).

### Step 6: Access Instance Data at Runtime

Refer back to the "Accessing..." sections on the previous two pages ([`FTransientFragmentData`](transient-data-fragments.md#accessing-transient-struct-data-at-runtime) / [`UTransientRuntimeFragment`](transient-runtime-fragments.md#accessing-transient-runtime-fragments-at-runtime)) for examples of how to get and use the instance-specific data you created, typically using `ItemInstance->ResolveTransientFragment<UMyCustomFragment>()`.

***

By following these steps, you can create new, modular fragments in C++ to extend the inventory system with custom behaviors and instance-specific data, keeping your item definitions clean and your functionality encapsulated. Remember to choose between struct-based and UObject-based transient data based on the complexity and networking requirements of the instance state.
