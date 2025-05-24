---
description: 'Item Fragments: Set Stats Fragment (UInventoryFragment_SetStats)'
---

# Set Stats Fragment

The `UInventoryFragment_SetStats` fragment provides a convenient, data-driven way to initialize specific **Stat Tags** (`FGameplayTagStackContainer`) on a `ULyraInventoryItemInstance` the moment it is created.

### Purpose

* **Initial State:** Set default integer values for Stat Tags when an item instance first comes into existence (e.g., setting starting ammo, initial charges, default stack size).
* **Data-Driven Configuration:** Allows designers to define these initial Stat Tag values directly within the `ULyraInventoryItemDefinition` asset, without needing custom code for simple initialization.
* **Complements Stat Tags:** Works directly with the `StatTags` system inherent to `ULyraInventoryItemInstance`.

### Static Configuration (`UInventoryFragment_SetStats`)

This fragment holds the initialization data configured in the Item Definition.

<figure><img src="../../../.gitbook/assets/image (76).png" alt=""><figcaption></figcaption></figure>

1. **Add Fragment:** Add `InventoryFragment_SetStats` to the `ULyraInventoryItemDefinition`'s `Fragments` array.
2. **Key Property:**
   * **`Initial Item Stats` (`TMap<FGameplayTag, int32>`)**: This map defines the core initialization data.
     * **Key (`FGameplayTag`):** The specific Stat Tag you want to initialize (e.g., `Inventory.Item.Count`, `Weapon.Ammo.Magazine`, `Item.Charges.Current`).
     * **Value (`int32`):** The initial integer value (stack count) to assign to that Stat Tag when an instance is created.

_Example Configuration (`ID_Rifle_Standard`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_SetStats`
    * `Initial Item Stats`:
      * `Inventory.Item.Count`: `1` (Rifles don't stack, start as 1 unit)
      * `Weapon.Ammo.Magazine`: `30` (Starts with a full magazine)
      * `Weapon.Ammo.Reserve`: `90` (Starts with reserve ammo)

_Example Configuration (`ID_Consumable_HealthPotion`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_SetStats`
    * `Initial Item Stats`:
      * `Inventory.Item.Count`: `1` (Represents one potion in the stack initially)
      * `Item.Charges.Current`: `1` (Has one use charge)
      * `Item.Charges.Max`: `1` (Can only hold one charge)

### Runtime Interaction

The fragment's primary interaction happens during item instance creation:

1. **Instance Creation:** When `UGlobalInventoryManager::CreateNewItem` (or a function calling it) creates a new `ULyraInventoryItemInstance`.
2. **Fragment Iteration:** The creation process iterates through all fragments listed in the item's definition.
3. **`OnInstanceCreated` Called:** For each fragment, including `UInventoryFragment_SetStats`, the `OnInstanceCreated(ULyraInventoryItemInstance* Instance)` virtual function is called.
4. **Applying Stats:** The `UInventoryFragment_SetStats::OnInstanceCreated` implementation specifically iterates through its `InitialItemStats` map. For each Key-Value pair (Tag, Value), it calls `Instance->AddStatTagStack(Tag, Value)` on the newly created item instance.

**Result:** By the time `CreateNewItem` returns the new instance, its `StatTags` container will already be populated with the initial values defined in this fragment.

### Why Use This?

* **Convenience:** Avoids the need for custom `OnInstanceCreated` logic in other fragments or separate initialization code just for setting default Stat Tag values.
* **Clarity:** Clearly defines the starting state of an item's key counts within its definition asset.
* **Consistency:** Ensures all instances created from a definition start with the same base Stat Tag values.

### Code Definition Reference

```cpp
// Initializes specific Stat Tags on an item instance upon creation.
UCLASS(MinimalAPI)
class UInventoryFragment_SetStats : public ULyraInventoryItemFragment
{
	GENERATED_BODY()

protected:
	// Map of Gameplay Tags to their initial integer stack count values.
	UPROPERTY(EditDefaultsOnly, Category=Equipment)
	TMap<FGameplayTag, int32> InitialItemStats;

public:
	// Called when an item instance is created based on a definition containing this fragment.
	// Iterates through InitialItemStats and applies them to the instance's StatTags.
	virtual void OnInstanceCreated(ULyraInventoryItemInstance* Instance) const override;

	// Helper to get a specific stat value directly from the fragment's configuration
	// (less common than letting OnInstanceCreated handle it).
	int32 GetItemStatByTag(FGameplayTag Tag) const;
};

// Implementation Snippet (.cpp)
void UInventoryFragment_SetStats::OnInstanceCreated(ULyraInventoryItemInstance* Instance) const
{
	Super::OnInstanceCreated(Instance); // Call base implementation if any

	if (!Instance)
	{
		return;
	}

	// Apply all configured initial stats to the new instance
	for (const auto& KVP : InitialItemStats)
	{
		if (KVP.Key.IsValid() && KVP.Value != 0) // Check for valid tag and non-zero value
		{
			Instance->AddStatTagStack(KVP.Key, KVP.Value);
		}
	}
}
```

***

The `InventoryFragment_SetStats` fragment is a simple but essential tool for initializing the default state of an item instance's `StatTags` in a clean, data-driven manner directly from the item definition asset. Use it to set starting ammo, charges, stack counts, or any other integer state represented by Stat Tags.
