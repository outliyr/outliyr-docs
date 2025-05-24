# Inventory Icon Fragment

The `UInventoryFragment_InventoryIcon` is a fundamental fragment, essential for most items that need to interact with the base `ULyraInventoryManagerComponent` and be represented in inventory UIs. It defines core properties like stacking behavior, weight, basic display information, and visual representation.

### Purpose

* **Basic Item Identity:** Provides the `Name` and `Description` used for display in UI tooltips or detail panels.
* **Visual Representation:** Specifies the `InventoryIcon` texture used in inventory slots.
* **Stacking Rules:** Contains the `MaxStackSize` property, which dictates if and how many units of this item can stack within a single inventory entry (`FLyraInventoryEntry`). This is critical for the `TryAddItem...` logic in the Inventory Manager.
* **Base Weight:** Defines the `Weight` contributed by a single unit of this item type towards the inventory's total weight limit.
* **Item Count Contribution:** Specifies that each instance/stack of this item contributes '1' towards the inventory's `ItemCountLimit`.
* **UI Styling:** Includes a `BackgroundColour` property that UI systems can optionally use for styling inventory slots containing this item.

### Static Configuration (`UInventoryFragment_InventoryIcon`)

Add this fragment to an `ULyraInventoryItemDefinition` and configure its properties:

<figure><img src="../../../.gitbook/assets/image (73).png" alt=""><figcaption></figcaption></figure>

1. **Add Fragment:** Add `InventoryFragment_InventoryIcon` to the Item Definition's `Fragments` array.
2. **Key Properties:**
   * **`Name` (`FText`)**: The primary display name used within inventory contexts (can differ from the Item Definition's main `DisplayName` if needed, though often they are the same). Supports localization.
   * **`Description` (`FText`)**: A description of the item, often shown in tooltips or detail views. Supports localization.
   * **`InventoryIcon` (`TObjectPtr<UTexture2D>`)**: A direct pointer to the `UTexture2D` asset used for the item's icon in inventory slots. (Note: Unlike the previous incorrect example, this uses a direct pointer, not a soft pointer).
   * **`BackgroundColour` (`FLinearColor`)**: A color value that UI can use to tint the background of the inventory slot containing this item (e.g., for rarity or item type indication).
   * **`Weight` (`float`, Default: 1.0)**: The weight contribution (in arbitrary units, often KG) of _one unit_ of this item.
   * **`MaxStackSize` (`int32`, Default: 1)**: The maximum number of units that can fit into a single inventory entry/slot.
     * `1`: The item doesn't stack (each instance requires its own entry).
     * `> 1`: Items can stack up to this amount in one entry.

_Example Configuration (`ID_Ammo_556`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_InventoryIcon`
    * `Name`: "5.56mm Rounds"
    * `Description`: "Standard assault rifle ammunition."
    * `InventoryIcon`: `T_UI_Ammo_556`
    * `BackgroundColour`: (Default grey/black)
    * `Weight`: `0.01`
    * `MaxStackSize`: `60`

_Example Configuration (`ID_Rifle_Standard`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_InventoryIcon`
    * `Name`: "Standard Rifle"
    * `Description`: "Reliable semi-automatic rifle."
    * `InventoryIcon`: `T_UI_Rifle_Standard`
    * `BackgroundColour`: (Maybe a blue tint for weapon category)
    * `Weight`: `3.5`
    * `MaxStackSize`: `1` (Doesn't stack)

### Runtime Interaction

* **Stacking Logic:** The `ULyraInventoryManagerComponent::TryAddItemDefinition` and `TryAddItemInstance` functions look for this fragment on the item being added. They use `MaxStackSize` to manage how items fill existing stacks before creating new `FLyraInventoryEntry` items. Items lacking this fragment are typically treated as unstackable.
* **Weight Calculation:** `ULyraInventoryManagerComponent` calls `GetWeightContribution` on all fragments. This fragment's implementation returns its configured `Weight`.
* **Item Count Calculation:** `ULyraInventoryManagerComponent` calls `GetItemCountContribution` on all fragments. This fragment's implementation returns `1`.
* **UI Display:** UI widgets read this fragment (via `ItemInstance->FindFragmentByClass<UInventoryFragment_InventoryIcon>()`) to get the `InventoryIcon`, `Name`, `Description`, `BackgroundColour`, and stacking info (`MaxStackSize` combined with the instance's current `Lyra.Inventory.Item.Count` StatTag).

### Importance

This fragment is **highly recommended** for nearly all items intended to be managed by the base `ULyraInventoryManagerComponent` and displayed in a typical inventory UI. Without it:

* Items generally won't stack using the standard `TryAddItem...` logic.
* Items won't contribute correctly to weight or item count limits.
* Inventory UI systems will lack the necessary data (icon, name, description, stack info) to display the item meaningfully.

### Code Definition Reference

```cpp
// Provides core data for inventory display, stacking, weight, and count limits.
UCLASS(MinimalAPI)
class UInventoryFragment_InventoryIcon : public ULyraInventoryItemFragment
{
	GENERATED_BODY()

public:
	// Overrides to contribute to inventory limits based on configured properties
	UE_API virtual float GetWeightContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr) override;
	UE_API virtual int32 GetItemCountContribution(UActorComponent* Inventory, const ULyraInventoryItemDefinition* ItemDef = nullptr, ULyraInventoryItemInstance* ItemInstance = nullptr) override;

public:
	// Name displayed in inventory UI
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Item)
	FText Name = FText::FromString(TEXT("Name"));

	// Description displayed in inventory UI (e.g., tooltips)
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Item)
	FText Description = FText::FromString(TEXT("Description"));

	// Icon texture used in inventory slots
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Appearance)
	TObjectPtr<UTexture2D> InventoryIcon;

	// Optional background color for UI styling
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Item)
	FLinearColor BackgroundColour = FColor(0.01183, 0.01215, 0.011346, 1.0f); // Default dark color

	// Weight of a single unit of this item
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Item, meta=(ForceUnits="KG"))
	float Weight = 1.0f;

	// Maximum stack size per inventory entry
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Item, meta=(ClampMin=1, UIMin=1))
	int32 MaxStackSize = 1;
};

// Implementation Snippets (.cpp)
float UInventoryFragment_InventoryIcon::GetWeightContribution(...)
{
	// Directly return the configured static weight
	return Weight;
}

int32 UInventoryFragment_InventoryIcon::GetItemCountContribution(...)
{
	// This item stack/instance contributes 1 towards the ItemCountLimit
	return 1;
}
```

***

The `InventoryFragment_InventoryIcon` serves as a cornerstone fragment, providing essential data for UI display, stacking behavior, and contribution to inventory limits within the base `ULyraInventoryManagerComponent`. Ensure it's configured appropriately for items needing these standard inventory features.
