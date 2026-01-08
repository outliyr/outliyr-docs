# Inventory Icon Fragment

The `UInventoryFragment_InventoryIcon` is a fundamental fragment, essential for most items that need to interact with the base `ULyraInventoryManagerComponent` and be represented in inventory UIs. It defines core properties like stacking behavior, weight, basic display information, and visual representation.

### Purpose

* **Basic Item Identity:** Provides the `Name` and `Description` used for display in UI tooltips or detail panels.
* **Visual Representation:** Specifies the `InventoryIcon` texture used in inventory slots.
* **Stacking Rules:** Contains the `MaxStackSize` property, which dictates if and how many units of this item can stack within a single inventory entry (`FLyraInventoryEntry`).
* **Base Weight:** Defines the `Weight` contributed by a single unit of this item type towards the inventory's total weight limit.
* **UI Styling:** Includes a `BackgroundColour` property that UI systems can optionally use for styling inventory slots containing this item.

### Static Configuration (`UInventoryFragment_InventoryIcon`)

Add this fragment to an `ULyraInventoryItemDefinition` and configure its properties:

<figure><img src="../../../.gitbook/assets/image (73).png" alt=""><figcaption></figcaption></figure>

1. **Add Fragment:** Add `InventoryFragment_InventoryIcon` to the Item Definition's `Fragments` array.
2. **Key Properties:**
   * **`Name` (`FText`)**: The primary display name used within inventory contexts (can differ from the Item Definition's main `DisplayName` if needed, though often they are the same). Supports localization.
   * **`Description` (`FText`)**: A description of the item, often shown in tooltips or detail views. Supports localization.
   * **`InventoryIcon` (`TObjectPtr<UTexture2D>`)**: A direct pointer to the `UTexture2D` asset used for the item's icon in inventory slots.
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

* **Stacking Logic:** The item containers use the  `MaxStackSize` variable from this fragment to manage how items fill existing stacks before adding them to empty slots.
* **Weight Calculation:** `ItemInstance` calls `GetWeightContribution` on all fragments. This fragment's implementation returns its configured `Weight * stack count`.
* **Item Count Calculation:** `ItemInstance` calls `GetItemCountContribution` on all fragments. This fragment's implementation returns `stack count`.
* **UI Display:** `ItemViewModel` read this fragment to get the `InventoryIcon`, `Name`, `Description`, `BackgroundColour`, and stacking info.

### Importance

This fragment is **highly recommended** for nearly all items intended to be managed by item containers. Without it:

* Items generally won't stack.
* Items won't contribute correctly to weight or item count limits.
* UI systems will lack the necessary data (icon, name, description, stack info) to display the item meaningfully.

***

The `InventoryFragment_InventoryIcon` serves as a cornerstone fragment, providing essential data for UI display, stacking behavior, and contribution to item instance weight and item count. Ensure it's configured appropriately for items needing these standard inventory features.
