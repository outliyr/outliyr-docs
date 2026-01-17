# Category Fragment

The `UInventoryFragment_Category` provides a simple mechanism to assign one or more **Gameplay Tags** to an item type, effectively placing it into different categories. This is primarily used for filtering, sorting, or applying category-specific logic in UI or gameplay systems.

### Purpose

* **Categorization:** Assign meaningful tags to items (e.g., `Item.Category.Weapon.Rifle`, `Item.Category.Consumable.Healing`, `Item.Category.Armor.Helmet`, `Item.Category.Material.Metal`).
* **Filtering & Sorting:** Allow UI systems or inventory queries to easily filter or group items based on these category tags.
* **Gameplay Logic:** Enable systems to quickly check if an item belongs to a certain category (e.g., "Does this item count as 'Quest Item'?").

### Static Configuration (`UInventoryFragment_Category`)

This fragment purely holds static data configured in the Item Definition.

<img src=".gitbook/assets/image (75).png" alt="" title="">

1. **Add Fragment:** Add `InventoryFragment_Category` to the `ULyraInventoryItemDefinition`'s `Fragments` array.
2. **Key Property:**
   * **`Item Categories` (`FGameplayTagContainer`)**: This is the core property. Use the Gameplay Tag editor (+) to add one or more relevant category tags to this container. Choose tags that logically group this item type with others.

_Example Configuration (`ID_Rifle_Standard`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_Category`
    * `Item Categories`:
      * `Item.Category.Weapon.Rifle`
      * `Item.Category.Firearm`
      * `Item.Type.TwoHanded`

_Example Configuration (`ID_Consumable_HealthPotion`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_Category`
    * `Item Categories`:
      * `Item.Category.Consumable.Healing`
      * `Item.Type.Potion`

### Runtime Interaction

This fragment doesn't typically have complex runtime logic associated with it directly. Its value lies in being queried by other systems:

* **UI Filtering/Sorting:** An inventory UI widget could:
  1. Get all items from the `ULyraInventoryManagerComponent`.
  2. For each `ULyraInventoryItemInstance`:
     * Find its `InventoryFragment_Category` using `Instance->FindFragmentByClass<UInventoryFragment_Category>()`.
     * If the fragment exists, get its `ItemCategories` container.
     * Check if the container `HasTag()` or `HasAny()` matching the UI's current filter selection (e.g., show only items with `Item.Category.Weapon`).
     * Use the tags for sorting logic.
*   **Gameplay Checks:** Other systems (e.g., crafting, quest objectives) can perform similar checks:

    ```cpp
    ULyraInventoryItemInstance* Item = ...;
    const UInventoryFragment_Category* CategoryFragment = Item ? Item->FindFragmentByClass<UInventoryFragment_Category>() : nullptr;
    if (CategoryFragment && CategoryFragment->ItemCategories.HasTag(TAG_Item_Category_QuestItem))
    {
        // This is a quest item, proceed with quest logic...
    }
    ```

### Importance

* Provides a structured, data-driven way to categorize items using the engine's built-in Gameplay Tag system.
* Decouples category logic from item class inheritance.
* Enables powerful filtering and querying capabilities for UI and gameplay systems.

***

The `InventoryFragment_Category` is a simple yet effective fragment for adding semantic meaning to your items through Gameplay Tags, facilitating better organization, filtering, and category-based gameplay logic.
