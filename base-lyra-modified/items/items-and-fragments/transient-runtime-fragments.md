# Transient Runtime Fragments

While `FTransientFragmentData` provides a way to store instance-specific **struct** data, sometimes you need more power and flexibility. **Transient Runtime Fragments**, based on `UTransientRuntimeFragment`, allow you to associate a full **`UObject`** instance with each `ULyraInventoryItemInstance` that uses a particular static fragment.

***

### Role and Purpose

* **Complex Instance State & Logic:** Enables storing more complex data structures and encapsulating related logic directly within the UObject payload.
* **Full UObject Features:** Leverages the standard Unreal Object system, offering features unavailable to simple structs:
  * **Detailed Replication:** Use `UPROPERTY(ReplicatedUsing=...)` for fine-grained replication control with `OnRep` functions. Replicate nested UObjects owned by the fragment using `ReplicateSubobjects`. Implement `GetLifetimeReplicatedProps`.
  * **Ticking:** Can implement the `Tick` function if per-frame updates are needed (use sparingly for performance).
  * **Blueprint Exposure:** Easily expose functions (`UFUNCTION(BlueprintCallable)`) and properties (`UPROPERTY(BlueprintReadOnly)`) from the runtime fragment to Blueprints, allowing BP-based logic to interact with the instance-specific state.
  * **Timers & Latent Actions:** Utilize standard UObject timer management.
  * **Gameplay Message Listening:** Can register as a listener with the `UGameplayMessageSubsystem`.
* **Fragment Association:** Like struct-based fragments, each `UTransientRuntimeFragment` type is logically linked to a specific `ULyraInventoryItemFragment` type on the item definition.
* **Lifecycle Callbacks:** Inherits the same set of lifecycle virtual functions as `FTransientFragmentData` (`DestroyTransientFragment`, `AddedToInventory`, `OnEquipped`, etc.) allowing it to react to the owning item instance's state changes.
* **Replication:** Stored within a replicated `TArray<TObjectPtr<UTransientRuntimeFragment>>` on the `ULyraInventoryItemInstance`. Requires the owning component (`ULyraInventoryManagerComponent`, etc.) to correctly handle subobject replication for these UObjects.

***

### When to Use `UTransientRuntimeFragment`

Use a `UTransientRuntimeFragment` when your instance-specific needs **go beyond simple data storage** and require **full UObject behavior** — such as fine-grained replication, timers, ticking, or complex Blueprint integration.

Before choosing this path, consider the cost:

> Each runtime fragment is a full `UObject`.\
> So if you have 5 fragment types marked as runtime fragments, every item instance using them will create **6 UObjects** —\
> 1 for the `ULyraInventoryItemInstance`, and 5 more for the fragments.

This overhead **adds up quickly** in inventory-heavy games (e.g., hundreds of items per player).\
That’s exactly why Lyra uses **static fragments (shared, per-class)** and why `FTransientFragmentData` exists — it’s a **lightweight**, stack-allocated alternative with no GC cost, stored inside a replicated `FInstancedStruct` array.

Use `UTransientRuntimeFragment` when:

* **Complex Networking:** You need `OnRep` notifications for specific variables within the instance payload, or you need to replicate owned UObjects (e.g., an internal component list).
* **Blueprint Interaction:** You want Blueprints (like abilities or UI widgets) to directly call functions or easily read properties on the instance-specific data object.
* **Encapsulated Logic:** The instance-specific data requires significant associated logic that benefits from being encapsulated within its own UObject class (potentially including ticking).
* **Standard UObject Features:** You need timers, message bus integration, or other features inherent to `UObject`s.

**Examples:**

* **Attachment Container (`UTransientRuntimeFragment_Attachment`):** Manages the list (`FAppliedAttachmentArray`) of attached items, handles activation/deactivation logic triggered by `OnEquipped`/`OnHolster`, and needs to replicate the array and potentially the attached item instances as subobjects. (As per your example).
* **Procedural Effects:** A fragment managing a complex, ongoing procedural effect on the item might use a UObject to handle ticking, state transitions, and potentially replicate visual parameters.
* **Resource Generation:** An item that passively generates a resource over time could use a ticking UObject fragment to manage the generation logic and current resource level.

#### Don't use runtime fragments **just** for Blueprint exposure

If you're only trying to expose a function like:

```cpp
UFUNCTION(BlueprintCallable)
float GetDamageMultiplier(const ULyraInventoryItemInstance* ItemInstance) const;
```

...you can do that directly on the **static fragment** — just pass the `ItemInstance` as a parameter. Static fragments are shared, so they can’t access per-instance state unless you give it to them via arguments — but that’s often enough.

Only use a runtime fragment if your logic truly **depends on internal state** stored inside the UObject itself.

> [!success]
> Still unsure? Jump to the [instance-data comparison](creating-custom-fragments.md#step-2-choose-and-define-instance-data-optional).

***

### Implementation Steps

1.  **Define the Runtime Fragment Class:**

    * Create a new C++ class inheriting from `UTransientRuntimeFragment`.
    * Add `UPROPERTY()` members for the instance-specific data. Use standard replication specifiers (`Replicated`, `ReplicatedUsing`) as needed.
    * Implement `GetLifetimeReplicatedProps` if you have replicated properties.
    * Optionally implement `Tick`, `BeginPlay`, `EndPlay`, etc., if needed.
    * Implement `ReplicateSubobjects` if this fragment owns other UObjects that need replication.
    * Optionally override the lifecycle virtual functions (`DestroyTransientFragment`, `AddedToInventory`, `OnEquipped`, etc.) inherited from the base class to add custom logic.

    ```cpp
    // Example: Simple Charge Meter (UObject version)
    UCLASS(BlueprintType)
    class UTransientRuntimeFragment_Charge : public UTransientRuntimeFragment
    {
        GENERATED_BODY()
    public:
        //~ UObject Interface
        virtual bool IsSupportedForNetworking() const override { return true; }
        virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
        //~ End UObject Interface

        //~ Lifecycle Callbacks
        virtual void OnEquipped(APawn* Pawn, ULyraInventoryItemInstance* ItemInstance, ULyraEquipmentInstance* EquipmentInstance) override;
        virtual void OnUnequipped(APawn* Pawn, ULyraInventoryItemInstance* ItemInstance, ULyraEquipmentInstance* EquipmentInstance) override;
        virtual void Tick(float DeltaTime); // If ticking is needed
        //~ End Lifecycle

        UPROPERTY(ReplicatedUsing = OnRep_CurrentCharge, BlueprintReadOnly)
        float CurrentCharge = 0.0f;

        UPROPERTY(EditDefaultsOnly, BlueprintReadOnly) // Likely static, set during creation maybe
        float MaxCharge = 100.0f;

        UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
        float ChargeRate = 5.0f; // Units per second while equipped

        UFUNCTION()
        void OnRep_CurrentCharge();

        UFUNCTION(BlueprintCallable) // Example BP callable function
        void Discharge(float Amount);

    private:
        bool bIsCharging = false;
        FTimerHandle ChargeTimerHandle; // Example UObject feature
    };

    // .cpp
    void UTransientRuntimeFragment_Charge::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
    {
        Super::GetLifetimeReplicatedProps(OutLifetimeProps);
        DOREPLIFETIME(UTransientRuntimeFragment_Charge, CurrentCharge);
    }

    void UTransientRuntimeFragment_Charge::OnEquipped(...)
    {
        // Start charging when equipped
        bIsCharging = true;
        // Or use Tick... SetComponentTickEnabled(true);
    }
    void UTransientRuntimeFragment_Charge::OnUnequipped(...)
    {
        // Stop charging
        bIsCharging = false;
        // Or use Tick... SetComponentTickEnabled(false);
    }
     void UTransientRuntimeFragment_Charge::Tick(float DeltaTime)
     {
         Super::Tick(DeltaTime); // Call if base class implements Tick
         if (bIsCharging && GetOwner()->HasAuthority()) // Check authority
         {
             CurrentCharge = FMath::Min(CurrentCharge + ChargeRate * DeltaTime, MaxCharge);
         }
     }
    // ... other implementations ...
    ```
2. **Link from the Static Fragment:**
   * Open the corresponding `ULyraInventoryItemFragment` class (e.g., `UInventoryFragment_Chargeable`).
   *   **Override `GetTransientRuntimeFragment()`:** Return the static class of your runtime fragment UObject.

       ```cpp
       virtual TSubclassOf<UTransientRuntimeFragment> GetTransientRuntimeFragment() const override
       {
           return UTransientRuntimeFragment_Charge::StaticClass();
       }
       ```
   *   **Override `CreateNewRuntimeTransientFragment()`:** Instantiate your runtime fragment UObject using `NewObject` (typically with the `ItemInstance` as the Outer) and assign it to the output parameter.

       ```cpp
       virtual bool CreateNewRuntimeTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, UTransientRuntimeFragment*& OutFragment) override
       {
           UTransientRuntimeFragment_Charge* ChargeFragment = NewObject<UTransientRuntimeFragment_Charge>(ItemInstance); // Outer is ItemInstance
           if (ChargeFragment)
           {
               // Perform any initial setup on ChargeFragment if needed
               // ChargeFragment->MaxCharge = GetMaxChargeFromStaticFragmentData(); // Example
               OutFragment = ChargeFragment;
               return true; // Indicate that transient data was created
           }
           return false;
       }
       ```
3. **Add Static Fragment to Definition:** Ensure the `UInventoryFragment_Chargeable` fragment is added to the `Fragments` array of the relevant `ULyraInventoryItemDefinition` asset(s).

***

### Accessing Transient Runtime Fragments at Runtime

<!-- tabs:start -->
#### **C++**


**From C++:** Use the templated `ResolveTransientFragment<T>()` helper on the `ULyraInventoryItemInstance`. `T` should be the _static_ fragment type (e.g., `UInventoryFragment_Chargeable`). The template automatically deduces the associated runtime fragment UObject type.

```cpp
// example of getting the weight for each attachment
ULyraInventoryItemInstance* MyInstance = ...;
if(const auto* AttachmentTransientData = ItemInstance->ResolveTransientFragment<UInventoryFragment_Attachment>())
{
	// do stuff with the attachment transient runtime fragment
}
```


#### **Blueprints**


**From Blueprint/C++:** Use `ResolveRuntimeTransientFragment(FragmentClass)` on the `ULyraInventoryItemInstance`, passing the _static_ fragment class. This returns a pointer to the `UTransientRuntimeFragment` base. You'll need to cast this pointer to your specific derived class (e.g., `UTransientRuntimeFragment_Charge`) to access its unique members and functions.

<img src=".gitbook/assets/image (26) (1) (1).png" alt="" title="">

> [!danger]
> Ensure you cast to **Corresponding Transient Runtime Object** of the original fragment specified in `ResolveRuntimeTransientFragment`.

<!-- tabs:end -->

***

### Lifecycle Callbacks

Similar to `FTransientFragmentData`, the `UTransientRuntimeFragment` base class provides the same set of virtual lifecycle functions (`DestroyTransientFragment`, `AddedToInventory`, `OnEquipped`, etc.). Override these in your derived UObject class to execute logic when the owning item instance undergoes state changes.

***

### Replication

* The `RuntimeFragments` array (`TArray<TObjectPtr<UTransientRuntimeFragment>>`) on `ULyraInventoryItemInstance` is replicated.
* **Crucially:** For the UObject instances themselves and their internal properties to replicate, the owning component (`ULyraInventoryManagerComponent`, `ULyraEquipmentManagerComponent`, etc.) **must** implement `ReplicateSubobjects` correctly and add these `UTransientRuntimeFragment` instances to the list of replicated subobjects (using `AddReplicatedSubObject`). The provided `ULyraInventoryManagerComponent` and `ULyraEquipmentManagerComponent` code already handles this.
* Internal replication within your `UTransientRuntimeFragment` subclass follows standard UObject replication rules (implement `GetLifetimeReplicatedProps`, use `DOREPLIFETIME` macros, handle `OnRep` functions).
* If your runtime fragment owns _other_ UObjects that need replicating, you must also override `ReplicateSubobjects` within your runtime fragment class itself to handle those nested subobjects.

***

<div class="collapse">
<p class="collapse-title">Why not just use UObjects for everything?</p>
<div class="collapse-content">

It’s tempting to always use `UTransientRuntimeFragment` when you need custom logic or instance data, but there’s a **real performance and memory cost** to that approach, especially at scale.

#### Here's what happens:

If you define 5 different fragment types as runtime fragments, then:

* Every `ULyraInventoryItemInstance` spawns 5 additional `UObject`s (1 per fragment).
* These `UObject`s:
  * Live on the heap
  * Are tracked by the garbage collector (GC)
  * May be replicated as subobjects
* Multiply that by hundreds of item instances per player or per game world, and you can quickly create thousands of persistent UObjects.

This is **why this asset architecture prefers**:

* **Static fragments** (`ULyraInventoryItemFragment`) — shared, instanced once per asset, not per instance.
* **Struct-based fragments** (`FTransientFragmentData`) — stack-allocated, replicated via `FInstancedStruct`, **lightweight** and GC-free.

#### When are runtime fragments worth it?

Use `UTransientRuntimeFragment` **only when**:

* You need complex `OnRep` behavior or per-property replication.
* You require timers, ticking, or other UObject features.
* You need to expose internal state directly to Blueprints (and passing an `ItemInstance` isn’t enough).

For everything else — durability, charge levels, internal IDs, flags — a simple struct is faster, lighter, and easier to maintain.

</div>
</div>

***

`UTransientRuntimeFragment` offers the full power of the Unreal Object system for managing complex, instance-specific item state and logic. Choose this option when you need advanced networking, Blueprint interaction, ticking, or other UObject features that go beyond the capabilities of simple `FTransientFragmentData` structs. Remember that proper subobject replication setup on the owning component is essential for these fragments to function correctly in a networked environment.
