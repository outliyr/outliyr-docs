# Equipment Manager Component

The `ULyraEquipmentManagerComponent` is the primary runtime component responsible for managing all equipped items on a **single Pawn**. Think of it as the Pawn's personal loadout manager. It orchestrates the equipping, unequipping, and state changes (Holstered vs. Held) of gear.

**Key Characteristics:**

* **Type:** `UPawnComponent`. It needs to be added directly to your Pawn Blueprint or C++ class.
* **Authority-Driven:** Core logic operations (equipping, unequipping, holding) generally execute only on the server (or network authority).
* **Replicated:** The component replicates the list of equipped items and their current state to all clients, ensuring everyone sees the correct loadout.
* **Slot Agnostic:** Crucially, the Manager **does not define or limit the available slots itself.** It dynamically adapts to the slots specified in the `ULyraEquipmentDefinition` of the items being equipped. If an item is equipped to a `SlotTag` present in its definition's `EquipmentSlotDetails`, the manager will track it.

### Role & Responsibilities

The Manager component juggles several critical tasks:

1. **Tracking Equipment:** Maintains a replicated list (`FLyraEquipmentList`) of all currently equipped items (`FLyraAppliedEquipmentEntry`), including their state (Slot `GameplayTag`, Held status). This list grows or shrinks based on equip/unequip actions, without predefined size or slot type limits in the manager.
2. **Handling Requests:** Processes requests (usually initiated by game logic or player input via the Quick Bar) to:
   * Equip items into specific slots.
   * Unequip items from slots.
   * Transition items to the "Held" state.
   * Transition items out of the "Held" state (back to "Holstered" or removed).
3. **Instance Management:** Creates (`NewObject`) and potentially destroys `ULyraEquipmentInstance` objects based on equip/unequip actions.
4. **Applying Definitions:** Reads the `ULyraEquipmentDefinition` associated with an item to determine:
   * Which abilities to grant/remove via GAS.
   * Which actors to spawn/destroy.
   * Whether a requested `SlotTag` is valid for that item.
5. **GAS Coordination:** Interacts directly with the Pawn's Ability System Component (ASC) to grant and revoke `ULyraAbilitySet`s based on the equipment definition and the item's current state (Holstered/Held).
6. **Replication:** Ensures the state of the `FLyraEquipmentList`, the `ULyraEquipmentInstance` subobjects, and their linked `ULyraInventoryItemInstance` instigators are correctly replicated to clients.

***

### Core Functions (Authority Focus)

These are the main functions you'll interact with to change the Pawn's equipped state. **They should generally only be called on the network authority (server).**

*   `EquipItemToSlot(ULyraInventoryItemInstance* ItemInstance, FGameplayTag SlotTag)`

    * **Action:** Attempts to equip an existing `ItemInstance` from an inventory into the specified `SlotTag`.
    * **Checks:**
      1. Is `ItemInstance` valid and does it have an `InventoryFragment_EquippableItem` with a valid `ULyraEquipmentDefinition`?
      2. Is the provided `SlotTag` valid?
      3. **Crucially:** Does the item's `ULyraEquipmentDefinition` define behavior for this `SlotTag` in its `EquipmentSlotDetails`? (This is checked implicitly by the logic, as an item can only be equipped to a slot it "knows" about). The function `UInventoryFragment_EquippableItem::IsCompatible` can be used for this check.
      4. Is the `SlotTag` currently empty on this manager (checked via `FindEntryIndexBySlot`)?
    * **Process (on Success):**
      1. Adds a new `FLyraAppliedEquipmentEntry` to the `EquipmentList`.
      2. Creates the `ULyraEquipmentInstance` (using the `InstanceType` from the Definition).
      3. Sets the `ItemInstance` as the `Instigator` on the `ULyraEquipmentInstance`.
      4. Applies **Holstered** behavior: Grants `AbilitySetsToGrant` and spawns `ActorsToSpawn` defined for _this specific slot_ in the `EquipmentSlotDetails`.
      5. Calls `OnHolster()` on the `ULyraEquipmentInstance`.
      6. Updates the `ItemInstance`'s `CurrentSlot` data (using `FEquipmentAbilityData_SourceEquipment`).
      7. Marks the list/entry for replication.
    * **Returns:** The spawned `ULyraEquipmentInstance` on success, `nullptr` on failure.

    <img src=".gitbook/assets/image (93).png" alt="" width="375" title="">
*   `EquipItemDefToSlot(TSubclassOf<ULyraInventoryItemDefinition> ItemDef, FGameplayTag SlotTag)`

    * **Action:** Similar to `EquipItemToSlot`, but useful for initially spawning equipment without needing an existing inventory item.
    * **Process:**
      1. Creates a _new_ `ULyraInventoryItemInstance` from the provided `ItemDef` (using `UGlobalInventoryManager`).
      2. Proceeds with the exact same logic as `EquipItemToSlot` using the newly created instance.
    * **Returns:** The spawned `ULyraEquipmentInstance` on success, `nullptr` on failure.

    <img src=".gitbook/assets/image (89).png" alt="" width="375" title="">
*   `UnequipItemFromSlot(FGameplayTag SlotTag)`

    * **Action:** Removes the item currently equipped in the specified `SlotTag`.
    * **Checks:** Is there an item in `SlotTag`?
    * **Process (on Success):**
      1. Finds the `FLyraAppliedEquipmentEntry` for the slot.
      2. Retrieves the `ULyraEquipmentInstance`.
      3. **Crucially, if the item is currently Held, it first calls `UnholdItem(EquipmentInstance)`** to ensure Held abilities/actors are removed correctly before proceeding.
      4. Removes **Holstered** behavior: Takes back `AbilitySetsToGrant` and destroys `ActorsToSpawn` associated with _this slot_.
      5. Calls `OnUnHolster()` on the `ULyraEquipmentInstance`.
      6. Sets the associated `ItemInstance`'s `CurrentSlot` back to a null/invalid state.
      7. Removes the `FLyraAppliedEquipmentEntry` from the `EquipmentList`.
      8. Marks the list for replication.
      9. Removes the `ULyraEquipmentInstance` as a replicated subobject.
    * **Returns:** The `ULyraInventoryItemInstance` that was unequipped, or `nullptr`.

    <img src=".gitbook/assets/image (90).png" alt="" width="375" title="">
*   `HoldItem(ULyraEquipmentInstance* EquipmentInstance)` / `HoldItem(ULyraInventoryItemInstance* ItemInstance)`

    * **Action:** Attempts to transition the specified equipment/item instance to the "Held" state.
    * **Checks:**
      1. Is another item already Held by this Manager? (Only one item can be held at a time).
      2. Is the `EquipmentInstance` (or the one derived from `ItemInstance`) valid?
      3. Does its `ULyraEquipmentDefinition` have `bCanBeHeld` set to `true`?
    * **Process (on Success):**
      1. Finds the `FLyraAppliedEquipmentEntry` (or creates a temporary one if holding directly from an inventory `ItemInstance` that wasn't previously slotted).
      2. If the item was previously **Holstered** in a slot, its Holstered abilities/actors are removed first.
      3. Applies **Held** behavior: Grants `AbilitySetsToGrant` and spawns `ActorsToSpawn` defined in the `ActiveEquipmentDetails` of the Definition.
      4. Calls `OnEquipped()` on the `ULyraEquipmentInstance`.
      5. Sets `bIsHeld = true` in the `FLyraAppliedEquipmentEntry`.
      6. Marks the entry for replication.
    * **Returns:** `true` or the held `ULyraEquipmentInstance` on success, `false` or `nullptr` otherwise.

    <img src=".gitbook/assets/image (91).png" alt="" width="375" title="">
*   `UnholdItem(ULyraEquipmentInstance* EquipmentInstance)`

    * **Action:** Takes the specified `EquipmentInstance` out of the "Held" state.
    * **Checks:** Is this `EquipmentInstance` currently Held (`bIsHeld == true`)?
    * **Process (on Success):**
      1. Finds the `FLyraAppliedEquipmentEntry`.
      2. Removes **Held** behavior: Takes back `AbilitySetsToGrant` and destroys `ActorsToSpawn` associated with `ActiveEquipmentDetails`.
      3. Calls `OnUnequipped()` on the `ULyraEquipmentInstance`.
      4. Sets `bIsHeld = false`.
      5. **Decision Point:**
         * If the entry has a valid `SlotTag` (meaning it belongs to a slot), it transitions back to **Holstered**: Re-applies the slot-specific abilities/actors and calls `OnHolster()`.
         * If the entry has _no_ valid `SlotTag` (meaning it was held directly from inventory), the `FLyraAppliedEquipmentEntry` is removed entirely from the `EquipmentList`, and the `ULyraEquipmentInstance` subobject replication is stopped.
      6. Marks the entry/list for replication.
    * **Returns:** `true` on success, `false` otherwise.

    <img src=".gitbook/assets/image (92).png" alt="" width="375" title="">

***

### State Management & The `FLyraEquipmentList`

The core of the Manager's state is the `FLyraEquipmentList` struct, which contains an array of `FLyraAppliedEquipmentEntry` structs.

* **`FLyraAppliedEquipmentEntry`:** Represents one equipped item and stores:
  * `EquipmentDefinition`: Which definition asset it uses.
  * `Instance`: The pointer to the live `ULyraEquipmentInstance`.
  * `SlotTag`: The slot it occupies (if any). Empty tag means it's held directly or has no assigned slot.
  * `bIsHeld`: The crucial boolean indicating if it's currently Held or Holstered.
  * `HolsteredGrantedHandles` / `HeldGrantedHandles`: Internal structs (`FLyraAbilitySet_GrantedHandles`) used by GAS to track granted abilities for efficient removal.
  * `LastReplicatedState`: Non-replicated struct used internally by the replication system (FFastArraySerializer) to correctly manage transitions on clients (e.g., distinguishing between Unholding and fully Unequipping).
* **`FLyraEquipmentList`:**
  * Contains the `TArray<FLyraAppliedEquipmentEntry> Entries`.
  * Implements `FFastArraySerializer` for efficient network replication of this array. This handles replicating adds, removes, and changes to the entries automatically.

***

### Replication Overview

* **What replicates:** `FLyraEquipmentList` (FastArray) + every live `ULyraEquipmentInstance`, its `Instigator` (`ULyraInventoryItemInstance`) and any `UTransientRuntimeFragment`s.
* **Driver:** `ULyraEquipmentManagerComponent::ReplicateSubobjects` handles the sub-objects; FastArray callbacks (`PostReplicatedAdd/Change/Remove`) fire the correct `OnEquipped/Unequipped/Holster` transitions on clients.
* **Authority only APIs:** `EquipItemToSlot`, `UnequipItemFromSlot`, `HoldItem`, `UnholdItem` run _server-side only_. UI or abilities should RPC/AbilityTask to reach them.
* **Client-side listening:**
  * Gameplay-Message tag **`TAG_Lyra_Equipment_Message_EquipmentChanged`** updates HUD/FX.
  * `OnInstigatorReady` lets Blueprint wait until the inventory item is valid.

> See [**Advanced Concepts → Replication Deep Dive**](advanced-concepts-and-integration.md#replication-deep-dive) for packet-level details.

***

### Querying Equipment State

You can query the Manager to find out what the Pawn currently has equipped:

* `GetInstanceFromSlot(const FGameplayTag& SlotTag)`: Get the specific `ULyraEquipmentInstance*` in a given slot. Returns `nullptr` if the slot is empty.
* `GetFirstHeldInstanceOfType(TSubclassOf<ULyraEquipmentInstance> InstanceType)`: Useful for checking if the player is currently holding a specific _type_ of item (e.g., `GetFirstHeldInstanceOfType(MyWeaponInstance::StaticClass())`). Returns the instance or `nullptr`.
* `GetEquipmentInstancesOfType(TSubclassOf<ULyraEquipmentInstance> InstanceType)`: Get _all_ equipped instances (Held or Holstered) of a specific type.
* `FindAvailableEquipmentSlots(TSubclassOf<ULyraEquipmentDefinition> EquipmentDefinition)`: Returns an array of `FGameplayTag`s representing slots that are _compatible_ with the given definition (based on its `EquipmentSlotDetails` keys) and are currently _empty_. Useful for UI or auto-equip logic.
* `GetSlots()`: Returns an array of `FLyraEquipmentSlotFound` structs, giving a snapshot of all occupied slots, the instance, and its held status.

***

### Initialization and Replication

* **Initialization:** The component initializes, typically setting up its replication parameters.
* **Replication:**
  * The `EquipmentList` uses Fast Array Serialization. When the list changes on the server, only the changed elements are efficiently sent to clients.
  * The Manager overrides `ReplicateSubobjects`. This ensures that not only the list itself is replicated, but also each valid `ULyraEquipmentInstance*` within the list, _and_ the `ULyraInventoryItemInstance*` set as the instigator for each equipment instance (including any `UTransientRuntimeFragment`s the item might have). This is crucial for clients to have access to the full state of equipped items.
  * The `ReadyForReplication` function ensures that any equipment already present when replication starts is registered correctly as a subobject.

***

The `ULyraEquipmentManagerComponent` acts as the authoritative hub on each Pawn for its equipment. It interprets the data defined in `ULyraEquipmentDefinition` and translates it into runtime state changes, GAS interactions, and replicated data for clients. Understanding its role is key to customizing how equipment behaves in your game.
