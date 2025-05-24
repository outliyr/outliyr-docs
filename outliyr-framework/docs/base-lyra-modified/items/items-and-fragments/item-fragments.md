# Item Fragments

Item Fragments are the cornerstone of the inventory system's **modularity and composition**. Instead of relying on deep, complex class inheritance hierarchies to define item behaviors, functionality is broken down into smaller, reusable components called Fragments.

An `ULyraInventoryItemDefinition` achieves its complete set of features by including an array of different `ULyraInventoryItemFragment` instances.

***

### Role and Purpose

* **Encapsulation:** Each Fragment type focuses on a specific aspect of an item (e.g., how it's equipped, how it appears in UI, if it can be consumed, if it holds attachments).
* **Composition over Inheritance:** Allows creating diverse item types by simply combining different fragments in the Item Definition asset, rather than creating numerous subclasses.
* **Static Data & Logic:** Fragments primarily store static data (configured in the Item Definition asset) and provide base logic associated with their specific domain.
* **Instance Interaction:** They define hooks (`OnInstanceCreated`) and can specify associated **Transient Data** types to manage instance-specific state (covered in detail on subsequent pages).
* **Extensibility:** New item behaviors can be added to the project by simply creating new Fragment classes, without necessarily modifying existing item definitions or core inventory code (especially when combined with the Fragment Injector system).

***

### Base Class: `ULyraInventoryItemFragment`

All specific fragments inherit from the base `ULyraInventoryItemFragment` class.

**Key Virtual Functions (Implement in Derived Classes):**

* `OnInstanceCreated(ULyraInventoryItemInstance* Instance) const`
  * Called once when a new `ULyraInventoryItemInstance` is created based on a definition containing this fragment type.
  * **Use Case:** Perform initial setup related to this fragment on the new instance. For example, `UInventoryFragment_SetStats` uses this hook to apply initial Stat Tag counts.
* `CreateNewTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, FInstancedStruct& NewInstancedStruct)`
  * Override this function if your fragment needs associated **struct-based** transient data (`FTransientFragmentData`).
  * **Implementation:** Should create an instance of your specific `FTransientFragmentData`-derived struct, initialize it if necessary, wrap it in the `FInstancedStruct` output parameter, and return `true`. Return `false` if no transient struct data is needed.
  * _(See "Transient Data Fragments (`FTransientFragmentData`)" page for details)_.
* `CreateNewRuntimeTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, UTransientRuntimeFragment*& OutFragment)`
  * Override this function if your fragment needs associated **UObject-based** transient data/logic (`UTransientRuntimeFragment`).
  * **Implementation:** Should create an instance of your specific `UTransientRuntimeFragment`-derived class (using `NewObject`, typically with `ItemInstance` as the Outer), initialize it, assign it to the `OutFragment` pointer, and return `true`. Return `false` if no transient UObject is needed.
  * _(See "Transient Runtime Fragments (`UTransientRuntimeFragment`)" page for details)_.
* `CanAddItemToInventory(UActorComponent* Inventory, int32 StackCount, int32& AllowedAmount, FText& OutMessage, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr)`
  * Allows a fragment to impose custom restrictions on whether an item can be added to a specific inventory.
  * Called by `ULyraInventoryManagerComponent::CanAddItem_Implementation`.
  * **Implementation:** Check conditions based on the `Inventory` component, `StackCount`, `ItemDef`/`ItemInstance`. Modify `AllowedAmount` (reducing it if necessary) and optionally set `OutMessage` to provide user feedback if denied.
  * **Example:** An `InventoryFragment_RequiresPowerSource` could check if the target inventory component is linked to a powered grid.
* `GetWeightContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr)`
  * Calculates how much weight this _specific fragment_ contributes to the item's total weight.
  * Called by `ULyraInventoryManagerComponent::GetItemWeight`.
  * **Implementation:** Return the static weight defined by this fragment (e.g., `InventoryFragment_InventoryIcon` returns its configured `Weight` property) or calculate dynamic weight based on transient data (e.g., `InventoryFragment_Attachment` sums the weights of attached items).
  * **Result:** The Manager sums the contributions from _all_ fragments on an item to get its total weight.
* `GetItemCountContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr)`
  * Calculates how much this fragment contributes to the item count limit within an inventory. Most fragments return 0.
  * Called by `ULyraInventoryManagerComponent::GetItemCount`.
  * **Implementation:** Typically, only fragments representing the core "presence" of the item (like `InventoryFragment_InventoryIcon`) return 1. Others return 0.
  * **Result:** The Manager sums contributions to check against `ItemCountLimit`.
* `CombineItems(ULyraInventoryManagerComponent* SourceInventory, ULyraInventoryItemInstance* SourceInstance, ULyraInventoryManagerComponent* DestinationInventory, ULyraInventoryItemInstance* DestinationInstance)`
  * Encapsulates logic for what happens when `SourceInstance` is "dropped onto" or combined with `DestinationInstance`.
  * Called by `ULyraInventoryManagerComponent::CombineDifferentItems` on each fragment of the **DestinationInstance**.
  * **Implementation:** Check if the `SourceInstance` is relevant to this fragment's domain and perform the combination logic. Return `true` if the combination was handled, `false` otherwise.
  * **Example:** `InventoryFragment_Attachment` implements this to check if `SourceInstance` is a compatible attachment for `DestinationInstance` and adds it if possible. An `InventoryFragment_Container` (if you had one) might implement this to move `SourceInstance` into the container's internal inventory.
* `GetTransientFragmentDataStruct() const`
  * If using struct-based transient data, override this to return the `StaticStruct()` of your `FTransientFragmentData`-derived struct type. Used internally by the instance to find the correct data payload.
* `GetTransientRuntimeFragment() const`
  * If using UObject-based transient data, override this to return the `StaticClass()` of your `UTransientRuntimeFragment`-derived class type. Used internally by the instance.

***

### Finding Fragments

Fragments are stored in the `Fragments` array on the `ULyraInventoryItemDefinition`. You typically access the _static_ fragment data from the definition's Class Default Object (CDO).

* `ULyraInventoryItemDefinition::FindFragmentByClass<T>()` (C++)
* `ULyraInventoryItemDefinition::FindFragmentByClass()` (C++/Blueprint)
* `ULyraInventoryItemInstance::FindFragmentByClass<T>()` / `FindFragmentByClass()` (Accesses the definition via the instance)
* `UInventoryFunctionLibrary::FindItemDefinitionFragment()` (Blueprint helper)

These functions search the `Fragments` array on the definition's CDO and return the first fragment matching the specified class.

{% tabs %}
{% tab title="Blueprint" %}
<figure><img src="../../../.gitbook/assets/image (23).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="C++" %}
<pre class="language-cpp"><code class="lang-cpp">// Example of using ItemDef
void ExampleClass::ItemDefExample(TSubclassOf&#x3C;ULyraInventoryItemDefinition> ItemDef)
<strong>{
</strong>	if (!IsValid(ItemDef))
	 return;

	const ULyraInventoryItemDefinition* ItemDefinition = ItemDef.GetDefaultObject();
	const UInventoryFragment_InventoryIcon* InventoryIconFragment = ItemDefinition->FindFragmentByClass&#x3C;UInventoryFragment_InventoryIcon>();
}	


// Example of using the ItemInstance
void ExampleClass::ItemDefExample(ULyraInventoryItemInstance* ItemInstance)
{
	if (!IsValid(ItemInstance))
	 return;

	const ULyraInventoryItemDefinition* ItemDefinition = ItemInstance->GetItemDef().GetDefaultObject();
	const UInventoryFragment_Attachment* AttachmentFragment = DestinationInstance->FindFragmentByClass&#x3C;UInventoryFragment_Attachment>();
}
</code></pre>
{% endtab %}
{% endtabs %}

***

### Code Definition Reference

```cpp
// Represents a fragment of an item definition (Only store static data)
UCLASS(MinimalAPI, DefaultToInstanced, EditInlineNew, Abstract)
class ULyraInventoryItemFragment : public UObject
{
    GENERATED_BODY()

public:
    // Called when an instance is created
    UE_API virtual void OnInstanceCreated(ULyraInventoryItemInstance* Instance) const {}

    // Create associated transient struct data (override if needed)
    UE_API virtual bool CreateNewTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, FInstancedStruct& NewInstancedStruct) { return false; }
    // Create associated transient UObject data (override if needed)
    UE_API virtual bool CreateNewRuntimeTransientFragment(AActor* ItemOwner, ULyraInventoryItemInstance* ItemInstance, UTransientRuntimeFragment*& OutFragment) { return false; }

    // Custom check if item can be added (override if needed)
    UE_API virtual void CanAddItemToInventory(UActorComponent* Inventory, int32 StackCount, int32& AllowedAmount, FText& OutMessage, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr) {}
    // Get weight contribution (override if needed)
    UE_API virtual float GetWeightContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr) { return 0.0f; }
    // Get item count contribution (override if needed)
    UE_API virtual int32 GetItemCountContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr) { return 0; }

    // Handle combining items (override if needed)
    UE_API virtual bool CombineItems(ULyraInventoryManagerComponent* SourceInventory, ULyraInventoryItemInstance* SourceInstance, ULyraInventoryManagerComponent* DestinationInventory, ULyraInventoryItemInstance* DestinationInstance) { return false; }

    // Return type of associated transient struct (override if needed)
    UE_API virtual UScriptStruct* GetTransientFragmentDataStruct() const { return nullptr; }
    // Return type of associated transient UObject (override if needed)
    UE_API virtual TSubclassOf<UTransientRuntimeFragment> GetTransientRuntimeFragment() const { return nullptr; }

    // Internal index for Fragment Injector priority
    int32 OverrideIndex = 0;
    UE_API void SetOverrideIndex(int32 Index) { OverrideIndex = Index; }
};
```

***

Item Fragments provide the powerful compositional foundation of the inventory system. By understanding their role and the key virtual functions, you can effectively utilize existing fragments and create new ones to implement custom item behaviors. The following pages will detail the specific mechanisms for handling instance-specific data associated with these fragments: Transient Data Fragments (structs) and Transient Runtime Fragments (UObjects).
