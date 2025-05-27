# Quick Bar Component

While the `ULyraEquipmentManagerComponent` handles the _actual_ equipping logic on the Pawn, the `ULyraQuickBarComponent` provides a common mechanism for players to _select_ which equippable item they want to **hold** actively. Think of it as the standard hotbar or weapon selection wheel interface component.

**Key Characteristics:**

* **Type:** `UControllerComponent`. It should be added to your **Controller** Blueprint or C++ class (e.g., `PlayerController_Default`, `AIController_Basic`).
* **Purpose:** Manages a list of inventory items (`ULyraInventoryItemInstance` references) accessible for quick selection. It translates player input (like pressing '1', '2', '3' or scrolling the mouse wheel) into commands for the Pawn's `ULyraEquipmentManagerComponent`.
* **Interaction:** Primarily communicates with the possessed Pawn's `ULyraEquipmentManagerComponent` to request `HoldItem` and `UnholdItem` actions.
* **Replication:** Replicates its list of slotted items and the index of the currently active slot, allowing UI elements to accurately reflect the quick bar state.

### Role & Responsibilities

The Quick Bar component focuses on the player-facing selection aspect:

1. **Storing Item References:** Maintains a replicated array (`Slots`) of `TObjectPtr<ULyraInventoryItemInstance>`. Each element represents a slot in the quick bar.
2. **Tracking Active Slot:** Keeps track of the `ActiveSlotIndex` (integer), indicating which slot is currently selected by the player. An index of `-1` typically means no slot is active.
3. **Handling Player Input:** Provides functions (`CycleActiveSlotForward`, `CycleActiveSlotBackward`, `SetActiveSlotIndex`) intended to be called from player input actions.
4. **Communicating Hold/Unhold:** When the active slot changes, it instructs the controlled Pawn's `ULyraEquipmentManagerComponent` to:
   * `UnholdItem` (if an item was previously held via the quick bar).
   * `HoldItem` (for the item in the newly selected active slot).
5. **Managing Quick Bar Contents:** Offers functions (`AddItemToSlot`, `RemoveItemFromSlot`) for external systems (like the inventory UI or pickup logic) to populate or clear the quick bar slots.
6. **Broadcasting UI Updates:** Uses `OnRep` functions and Gameplay Messages to notify local systems (especially UI widgets) when the slots or the active index change.

***

### Core Functions & Logic

* `CycleActiveSlotForward()` / `CycleActiveSlotBackward()`
  * **Action:** Finds the next/previous slot in the `Slots` array that actually contains a valid `ULyraInventoryItemInstance`. Wraps around if it reaches the end/beginning.
  * **Logic:** If a valid next/previous slot is found, it calls `SetActiveSlotIndex` with the new index.
  * **Intended Use:** Bind these to player inputs like Mouse Wheel Up/Down or Next/Previous Weapon keys.
* `SetActiveSlotIndex(int32 NewIndex)`
  * **Action:** Directly sets the active quick bar slot.
  * **Type:** **Server RPC** (`Server, Reliable`). Player input should call this RPC to ensure the change is processed authoritatively.
  * **Logic (Server-Side):**
    1. Validates the `NewIndex`.
    2. Checks if the `NewIndex` is different from the current `ActiveSlotIndex`.
    3. **Unhold Previous:** If an item was previously held via the quick bar (`EquippedItem` pointer is valid), it calls `UnequipItemInSlot()` (internal helper function).
    4. Updates the internal `ActiveSlotIndex` variable to `NewIndex`.
    5. **Hold New:** Calls `EquipItemInSlot()` (internal helper function) to attempt holding the item in the new slot.
    6. Calls `OnRep_ActiveSlotIndex()` locally on the server to immediately trigger UI updates/messages. Replication handles clients.
  * **Intended Use:** Bind this to player inputs like number keys ('1', '2', '3', etc.), passing the corresponding slot index.
* `AddItemToSlot(int32 SlotIndex, ULyraInventoryItemInstance* Item)`
  * **Action:** Places an inventory item reference into a specific quick bar slot.
  * **Authority:** **Authority Only.** Should only be called on the server (e.g., when dragging an item to the quick bar in UI, the UI sends an RPC to the server which then calls this).
  * **Logic:**
    1. Validates the `SlotIndex` and `Item`.
    2. Checks if the target slot `Slots[SlotIndex]` is currently empty (`nullptr`).
    3. If empty, assigns the `Item` to `Slots[SlotIndex]`.
    4. Calls `OnRep_Slots()` locally to trigger server-side updates/messages. Replication handles clients.
* `RemoveItemFromSlot(int32 SlotIndex)`
  * **Action:** Removes an item reference from a specific quick bar slot.
  * **Authority:** **Authority Only.** Similar authority requirements as `AddItemToSlot`.
  * **Logic:**
    1. Validates the `SlotIndex`.
    2. **Unhold Check:** If the slot being removed _is_ the currently `ActiveSlotIndex`, it first calls `UnequipItemInSlot()` and resets `ActiveSlotIndex` to `-1`.
    3. Retrieves the `ItemInstance` from `Slots[SlotIndex]`.
    4. Sets `Slots[SlotIndex]` to `nullptr`.
    5. Calls `OnRep_Slots()` locally. Replication handles clients.
  * **Returns:** The `ULyraInventoryItemInstance*` that was removed, or `nullptr`.

***

### Interaction with Equipment Manager

The Quick Bar **delegates** the actual equipping work. Its internal helper functions bridge the gap:

* `EquipItemInSlot()` (**Private Helper**)
  * Called by `SetActiveSlotIndex` after the index is updated.
  * Checks if the `ActiveSlotIndex` is valid and points to a valid `ItemInstance` in the `Slots` array.
  * Finds the controlled Pawn's `ULyraEquipmentManagerComponent` using `FindEquipmentManager()`.
  * Calls `EquipmentManager->HoldItem(SlotItem)`.
  * Stores the returned `ULyraEquipmentInstance` in the `EquippedItem` variable (a non-replicated pointer used internally to track what the quick bar is currently responsible for holding).
* `UnequipItemInSlot()` (**Private Helper**)
  * Called by `SetActiveSlotIndex` _before_ changing the index, and by `RemoveItemFromSlot` if removing the active slot.
  * Checks if the internal `EquippedItem` pointer is valid.
  * Finds the Pawn's `ULyraEquipmentManagerComponent`.
  * Calls `EquipmentManager->UnholdItem(EquippedItem)`.
  * Clears the internal `EquippedItem` pointer (`nullptr`).
* `FindEquipmentManager()` (**Private Helper**)
  * Gets the owning `AController`.
  * Gets the `APawn` possessed by the controller.
  * Finds and returns the `ULyraEquipmentManagerComponent` on that Pawn using `Pawn->FindComponentByClass()`.

**In essence: Quick Bar handles&#x20;**_**selection**_**&#x20;-> tells Equipment Manager to&#x20;**_**Hold/Unhold**_**.** It doesn't care about _how_ the holding happens, only that it needs to be initiated or stopped based on player selection.

***

### **Important Distinction: Holding vs. Slotting Equipment**

* **Quick Bar's Role:** The `ULyraQuickBarComponent` is primarily concerned with selecting an item to be **actively held** by the character (e.g., a weapon in hand, a tool being used). When you add an item to the quick bar using `AddItemToSlot`, you are essentially marking it as a candidate for being held.
* **Equipping to Specific Slots (e.g., Armor, Holstered Weapons):** If a player wants to equip an item into a specific, non-held equipment slot (like putting on a helmet, equipping armor, or placing a rifle on their back), this action is typically **not directly managed by the Quick Bar component.**
  * This kind of "slotting" logic would usually be handled by your **Inventory UI**. For example, dragging a helmet icon from the inventory grid to a "Head Slot" UI element.
  * The Inventory UI, upon such an action, would then activate a gameplay abillity to call`ULyraEquipmentManagerComponent::EquipItemToSlot(ItemInstance, TargetSlotTag)` on the server.
* **Quick Bar Reflection (Optional):** Whether the Quick Bar UI also visually reflects items that are slotted but not held (e.g., showing a greyed-out icon for a holstered secondary weapon) is a design decision for your UI. The Quick Bar component itself focuses on the "held" state transition.

***

### Automatic Slot Assignment via Equipment Slot Mapping

While the Quick Bar primarily handles "holding," it can assist in organizing items that are frequently held via the `EquipmentSlotMapping` property. This map allows for a predefined association between an item's equipment type (via a `GameplayTag`) and a specific quick bar slot index.

**Purpose**:

* Streamlines the initial population of the quick bar for items intended to be _held_, automatically assigning them to preferred quick bar slots when picked up or equipped. This is useful for default loadouts or standard "holdable" equipment (e.g., primary weapon in quick bar slot 1, secondary in slot 2).

**Property**:

```cpp
UPROPERTY(EditAnywhere, BlueprintReadWrite)
TMap<FGameplayTag, int32> EquipmentSlotMapping;
```

* **Behavior & UI/Gameplay Logic:**
  * External systems (like inventory pickup logic or initial pawn setup) can consult this map.
  * When an item is acquired, these systems can check if its `ULyraEquipmentDefinition` has a GameplayTag (e.g., `Lyra.Equipment.Slot.Weapon.Primary`, though this tag usually refers to an actual equipment slot, a more specific tag like `Item.Type.Weapon.PrimaryHoldable` might be used for the map key if distinction is needed) that maps to a quick bar index in `EquipmentSlotMapping`.
  * If a mapping exists, the item can be automatically added to that quick bar slot using `ULyraQuickBarComponent::AddItemToSlot`.
  * This mechanism provides a good example of how UI/gameplay logic can **bridge the gap between abstract `GameplayTags` (defined in `ULyraEquipmentDefinition` to categorize items) and concrete UI elements (quick bar indices).**
* **Configuration:** This map is typically configured per game experience (e.g., in a `ULyraQuickBarComponent` subclass used by your [`ExperienceDefinition`](../gameframework-and-experience/experience-primary-assets/experience-definition.md)) to suit gameplay needs.

> [!danger]
> Slot conflicts (e.g., multiple items mapped to the same index) should be resolved by external logic before assigning items. This will automatically replace items in those slots. In this asset, logic using the EquipmentSlotMapping resides in  `GA_EquipTetrisItem::HandleHeldItems` (**TetrisInventory Plugin**), and is used in the **BattleRoyale Plugin** for mapping the primary and secondary slots.

***

### UI Updates & Replication

Keeping the UI synchronized is crucial for a quick bar.

* **Replication:**
  * The `Slots` array (`TArray<TObjectPtr<ULyraInventoryItemInstance>>`) is replicated.
  * The `ActiveSlotIndex` (`int32`) is replicated.
* **OnRep Functions:**
  * `OnRep_Slots()`: Called on clients when the `Slots` array changes. Broadcasts a `FLyraQuickBarSlotsChangedMessage`.
  * `OnRep_ActiveSlotIndex()`: Called on clients when `ActiveSlotIndex` changes. Broadcasts a `FLyraQuickBarActiveIndexChangedMessage`.
* **Gameplay Messages:**
  * `FLyraQuickBarSlotsChangedMessage`: Contains the `Owner` (Controller) and the updated `Slots` array.
  * `FLyraQuickBarActiveIndexChangedMessage`: Contains the `Owner` (Controller) and the new `ActiveIndex`.
  * **Purpose:** UI Widgets should listen for these messages (using the `UGameplayMessageSubsystem`) specifically for the local player's controller. When a message is received, the UI can redraw itself to reflect the current quick bar items and highlight the active slot.

***

### Setup and Configuration

1. **Add Component:** Add the `ULyraQuickBarComponent` to your Player Controller Blueprint (or C++ class). You might also add it to AI Controllers if they need similar quick-selection logic.
2. **Configure Properties:**
   * `NumSlots` (`int32`): Set the desired number of slots for the quick bar (e.g., 3, 10). The `Slots` array will be initialized to this size.
3. **Bind Input:** In your input setup (e.g., Enhanced Input Actions), bind player actions (Number Keys, Mouse Wheel, etc.) to call the appropriate functions on the `ULyraQuickBarComponent` (`SetActiveSlotIndex` RPC, `CycleActiveSlotForward`/`Backward` locally which then call the RPC).
4. **Connect Inventory UI:** Your inventory UI logic needs to:
   * Call `AddItemToSlot` (via a server RPC) when the player assigns an item to a quick bar slot.
   * Call `RemoveItemFromSlot` (via a server RPC) when the player removes an item.
5. **Connect Quick Bar UI:** Your HUD/Quick Bar widget needs to:
   * Get the local player's `ULyraQuickBarComponent`.
   * Listen for `FLyraQuickBarSlotsChangedMessage` and `FLyraQuickBarActiveIndexChangedMessage` via the `UGameplayMessageSubsystem`.
   * Update its visual representation based on the received messages (displaying item icons, highlighting the active index).

***

The `ULyraQuickBarComponent` serves as a vital bridge between player input and the underlying equipment mechanics, providing a standard way to manage item selection for active use. While optional (you could devise other ways to trigger `HoldItem`), it's the intended component for typical hotbar functionality.
