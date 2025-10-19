# Item Definition

The `ULyraInventoryItemDefinition` serves as the static **blueprint** or **template** for a specific type of item in your game. Think of it as the unchanging definition that describes what an "Apple", a "Standard Rifle", or a "Basic Helmet" _is_.

#### Role and Purpose

* **Static Data:** It holds information that is common to _all_ instances of this item type. Its properties are typically configured on its Class Default Object (CDO).
* **Configuration Asset (via Blueprint Class):** You create Blueprint classes derived from `ULyraInventoryItemDefinition`. The defaults set in these Blueprint classes act as your configuration assets.
* **Fragment Container:** Its most crucial role is to hold an array of `ULyraInventoryItemFragment` objects. These fragments are `Instanced` UObjects within the definition and define the actual capabilities, properties, and behaviors associated with this item type.
* **Read-Only at Runtime:** Generally, you treat the properties of the definition (accessed via its CDO) as read-only once the game is running. Item instances hold the mutable state.

***

### Creation

You typically create Item Definitions by creating Blueprint Classes:

1. **Content Browser:** Navigate to where you want to store your item definitions (e.g., `Content/Inventory/Items/Weapons`).
2. **Right-Click:** Right-click in the empty space, select Blueprint -> Blueprint Class.
3. **Choose Parent Class:** Search for and select `LyraInventoryItemDefinition` as the parent class.
4. **Name Asset:** Give your Blueprint class a descriptive name, often prefixed with `ID_`(e.g., `ID_Rifle_AK47`, `ID_HealthPotion`).
5. **Configure Defaults:** Open the Blueprint class and edit its Class Defaults. This is where you'll set `DisplayName` and add/configure `Fragments`.

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/create_item_definition.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Create Item Definition
{% endfile %}

***

### Key Properties

When you open an Item Definition asset, you'll primarily configure these properties in the Details panel:

1. **`DisplayName` (`FText`)**
   * The user-facing name of the item type (e.g., "Assault Rifle", "Medkit"). This is often used in UI elements.
   * Supports localization.
2. **`Fragments` (`TArray<TObjectPtr<ULyraInventoryItemFragment>>`)**
   * **This is the core of the definition's functionality.** Marked `UPROPERTY(Instanced)`, meaning each definition gets its own unique instances of these fragment UObjects.
   * It's an array where you add instances of different `ULyraInventoryItemFragment`-derived classes.
   * **Adding Fragments:** Click the `+` icon next to the `Fragments` array in the Class Defaults, then select the desired Fragment class from the dropdown list. An instance of that fragment will be created, and you can then configure its specific properties directly.
   * **Order:** The order of fragments generally doesn't matter unless one fragment's initialization depends on another (which is rare).

<img src=".gitbook/assets/image (16) (1) (1) (1).png" alt="" title="">

***

### Accessing Fragments

You typically don't interact directly with the definition at runtime often, but if needed:

*   **From an Instance:** `ULyraInventoryItemInstance::GetItemDef()` returns the `TSubclassOf<ULyraInventoryItemDefinition>`. You can then get the Class Default Object (CDO) to access its fragments:

    ```cpp
    ULyraInventoryItemInstance* MyInstance = ...;
    if (MyInstance && MyInstance->GetItemDef())
    {
        const ULyraInventoryItemDefinition* ItemDefCDO = GetDefault<ULyraInventoryItemDefinition>(MyInstance->GetItemDef());
        const UInventoryFragment_InventoryIcon* IconFragment = ItemDefCDO->FindFragmentByClass<UInventoryFragment_InventoryIcon>();
        if (IconFragment)
        {
            // Use IconFragment->MaxStackSize, etc.
        }
    }
    ```
*   **Directly (e.g., in Editor Utilities or Game Systems):**

    ```cpp
    TSubclassOf<ULyraInventoryItemDefinition> ItemDefClass = ...; // Load class
    if (ItemDefClass)
    {
        const ULyraInventoryItemDefinition* ItemDefCDO = GetDefault<ULyraInventoryItemDefinition>(ItemDefClass);
        // ... access fragments as above ...
    }
    ```
* **Helper Function:** The `UInventoryFunctionLibrary::FindItemDefinitionFragment` provides a convenient Blueprint-callable wrapper for finding fragments on a definition CDO.

***

In summary, the `ULyraInventoryItemDefinition` is the static foundation upon which runtime items are built. Its primary role is to act as a container for the various `ULyraInventoryItemFragment`s that collectively define the item type's characteristics and potential behaviors. The next page will cover the `ULyraInventoryItemInstance`, which brings these definitions to life.
