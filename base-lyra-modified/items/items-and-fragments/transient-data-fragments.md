# Transient Data Fragments

While `ULyraInventoryItemFragment`s define the _static_ behaviors and base properties of an item type, often you need data that is unique to _each specific instance_ of that item. For **struct-based, relatively simple instance data**, the `FTransientFragmentData` system provides a lightweight and networked solution.

***

### Role and Purpose

* **Instance-Specific Data:** Allows an `ULyraInventoryItemInstance` to store custom data payloads that persist with that instance, separate from other instances of the same `ItemDef`.
* **Struct-Based:** Uses `USTRUCT`s for data storage. This is generally more memory-efficient than using full `UObject`s for simple data.
* **Fragment Association:** Each `FTransientFragmentData` struct type is logically linked to a specific `ULyraInventoryItemFragment` type. The fragment dictates _which_ transient data struct (if any) should be created for instances of items containing that fragment.
* **Lifecycle Callbacks:** Provides virtual functions that are automatically called by the core inventory and equipment systems when significant events happen to the owning `ULyraInventoryItemInstance`, allowing the transient data (and the logic within its functions) to react.
* **Replication:** Stored within a replicated `TArray<FInstancedStruct>` on the `ULyraInventoryItemInstance`, allowing client access to the instance-specific data.

***

### When to Use `FTransientFragmentData`

Use this system when you need instance-specific data that:

* Can be represented cleanly within a `USTRUCT`.
* Doesn't require complex UObject features like detailed replication graphs (`OnRep` functions on members), ticking, or extensive Blueprint exposure directly on the data payload itself.
* Is logically tied to the functionality provided by a specific `ULyraInventoryItemFragment`.

**Good Examples:**

* **Unique ID/Seed:** Storing a generated unique ID or random seed for procedural aspects specific to this instance.
*   **Simple State:** For tracking small flags or toggles specific to the instance (e.g., toggled on/off, selected state).

    > _Note:_ `StatTags` were originally introduced in Lyra as a workaround for the lack of instance data. While `FTransientFragmentData` now fills that role more robustly, `StatTags` remain useful for lightweight counters or gameplay-relevant flags that benefit from tag-based systems and built-in networking support. Use `StatTags` if the value is an integer or should be part of tag-based queries.
* **Cached References:** Storing temporary, non-replicated pointers related to the item's current state (use with caution regarding replication and lifecycle). **Make sure to destroy the reference when the item is destroyed using the `DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance)`  callback.**

**When to Consider `UTransientRuntimeFragment` Instead:**

* You need `UPROPERTY(ReplicatedUsing=...)` on specific data members within the payload.
* You need complex UObject lifecycle functions (`BeginPlay`, `EndPlay`, Ticking).
* You need to replicate nested UObjects owned by the transient payload.

> [!success]
> Still unsure? Jump to the [instance-data comparison](creating-custom-fragments.md#step-2-choose-and-define-instance-data-optional).

***

### Implementation Steps

1.  **Define the Data Struct:**

    * Create a new `USTRUCT` that inherits directly from `FTransientFragmentData`.
    * Add `UPROPERTY()` members to store your instance-specific data. Ensure they are replication-friendly types if needed (basic types, UObject pointers, other replicated structs).
    * Optionally override the virtual functions (`DestroyTransientFragment`, `AddedToInventory`, `OnEquipped`, etc.) to add custom logic tied to the item instance's lifecycle events.

    ```cpp
    // Example: Simple Durability Data
    USTRUCT(BlueprintType)
    struct FTransientFragmentData_Durability : public FTransientFragmentData
    {
        GENERATED_BODY()

    public:
        UPROPERTY(EditAnywhere, BlueprintReadWrite) // Replicated via the FInstancedStruct array
        float CurrentDurability = 100.0f;

        UPROPERTY(EditAnywhere, BlueprintReadWrite)
        float MaxDurability = 100.0f;

        // Example Lifecycle Hook: Reset durability slightly when added?
        virtual void AddedToInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance) override
        {
            // Maybe some logic here...
            // CurrentDurability = FMath::Min(CurrentDurability + 5.0f, MaxDurability);
        }

        virtual void DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance) override
        {
            // Cleanup if needed when the item instance is fully destroyed
        }
    };
    ```
2. **Link from the Static Fragment:**
   * Open the corresponding `ULyraInventoryItemFragment` class (e.g., `UInventoryFragment_Durability`).
   *   **Override `GetTransientFragmentDataStruct()`:** Return the static struct type of your data struct.

       ```cpp
       virtual UScriptStruct* GetTransientFragmentDataStruct() const override
       {
           return FTransientFragmentData_Durability::StaticStruct();
       }
       ```
   *   **Override `CreateNewTransientFragment()`:** Instantiate your data struct and initialize the output `FInstancedStruct`.

       ```cpp
       virtual bool CreateNewTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, FInstancedStruct& NewInstancedStruct) override
       {
           FTransientFragmentData_Durability DurabilityData;
           // Perform any initial setup on DurabilityData based on ItemOwner or ItemInstance if needed
           DurabilityData.MaxDurability = 100.0f; // Example default
           DurabilityData.CurrentDurability = DurabilityData.MaxDurability;

           NewInstancedStruct.InitializeAs<FTransientFragmentData_Durability>(DurabilityData);
           return true; // Indicate that transient data was created
       }
       ```
3. **Add Static Fragment to Definition:** Ensure the `UInventoryFragment_Durability` fragment is added to the `Fragments` array of the relevant `ULyraInventoryItemDefinition` asset(s).

***

### Accessing Transient Struct Data at Runtime

<!-- tabs:start -->
#### **C++**
Use the templated `ResolveTransientFragment<T>()` helper on the `ULyraInventoryItemInstance`. `T` should be the _static_ fragment type (e.g., `UInventoryFragment_Durability`). The template automatically deduces the associated transient struct type.

```cpp
// example of getting the weight for each attachment
ULyraInventoryItemInstance* MyInstance = ...;
if(auto* TransientFragmentGun = ItemInstance->ResolveTransientFragment<UInventoryFragment_Gun>())
{
	// do stuff with the gun transient fragment
}
```


#### **Blueprints**
**From Blueprint/C++:** Use `ResolveStructTransientFragment(FragmentClass)` on the `ULyraInventoryItemInstance`. This returns an `FInstancedStruct`. You'll need to use `GetInstancedStructValue` and specific the transient struct from the wildcard `value` pin.

<img src=".gitbook/assets/image (27) (1) (1).png" alt="" title="">

> [!danger]
> Ensure you select the **Corresponding Transient Struct** of the original fragment specified in `ResolveStructTransientFragment` for the wildcard `value` pin.

<!-- tabs:end -->

> [!info]
> **Updating:** To update the entire struct (less common), you can create a new instance of your data struct, modify it, and then call `ULyraInventoryItemInstance::SetTransientFragmentData()` with the new struct wrapped in an `FInstancedStruct`. This replaces the existing entry in the `TransientFragments` array.

***

### Lifecycle Callbacks

The virtual functions within `FTransientFragmentData` allow you to react to key events in the owning item instance's lifecycle:

* `DestroyTransientFragment(ULyraInventoryItemInstance* ItemInstance)`: Called when the owning item instance is being _permanently destroyed_ (via `DestroyItemInstance`), not just removed. Use for final cleanup related to this transient data.
* `AddedToInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance)`: Called when the item instance is added to an inventory component.
* `RemovedFromInventory(UActorComponent* Inventory, ULyraInventoryItemInstance* ItemInstance)`: Called when the item instance is removed from an inventory component (but not necessarily destroyed).
* `OnEquipped(APawn* Pawn, ULyraInventoryItemInstance* ItemInstance, ULyraEquipmentInstance* EquipmentInstance)`: Called when the item instance transitions to the Held state.
* `OnUnequipped(APawn* Pawn, ULyraInventoryItemInstance* ItemInstance, ULyraEquipmentInstance* EquipmentInstance)`: Called when the item instance transitions out of the Held state.
* `OnHolster(APawn* Pawn, ULyraInventoryItemInstance* ItemInstance, ULyraEquipmentInstance* EquipmentInstance)`: Called when the item instance transitions to the Holstered state.
* `OnUnholster(APawn* Pawn, ULyraInventoryItemInstance* ItemInstance, ULyraEquipmentInstance* EquipmentInstance)`: Called when the item instance transitions out of the Holstered state.
* `ItemMoved(ULyraInventoryItemInstance* ItemInstance, const FInstancedStruct& OldSlot, const FInstancedStruct& NewSlot)`: Called when the item instance's `CurrentSlot` changes (including on clients via `OnRep_CurrentSlot`). Allows reacting to location changes.

Implement these in your derived struct as needed to manage state or perform actions related to the transient data.

***

### Replication

* The `TransientFragments` array (`TArray<FInstancedStruct>`) on `ULyraInventoryItemInstance` is replicated.
* `FInstancedStruct` handles replicating the underlying struct data polymorphically.
* Changes to the data within a struct payload are automatically detected and replicated by the array replication system. No manual `MarkDirty` is usually required on the struct data itself.

***

`FTransientFragmentData` provides a structured and efficient way to add instance-specific data to items using familiar `USTRUCT`s, complete with lifecycle callbacks and replication support, making it ideal for many common instance state needs.
