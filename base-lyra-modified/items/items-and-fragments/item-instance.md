# Item Instance

While the `ULyraInventoryItemDefinition` is the static template, the `ULyraInventoryItemInstance` is the **dynamic, runtime object** representing a specific item that actually exists within the game world, an inventory, or equipped on a character. If a player has three Health Potions, there will be one `ID_Consumable_HealthPotion` _definition_, but potentially one or more `ULyraInventoryItemInstance` objects representing those potions (depending on stacking rules).

***

### Role and Purpose

* **Runtime Representation:** Acts as the concrete object for an item during gameplay.
* **Holds Instance State:** Crucially, it stores data unique to _this specific_ item instance, differentiating it from other instances of the same type. This includes:
  * Stack counts or charges (`StatTags`).
  * Durability, current ammo, unique modifiers, attached components (`TransientFragments` / `RuntimeFragments`).
* **Links to Definition:** Contains a reference (`ItemDef`) back to the `ULyraInventoryItemDefinition` it's based on.
* **Location Tracking:** Stores its current location (`CurrentSlot`) using an `FInstancedStruct` pointing to a `FAbilityData_SourceItem`-derived struct (e.g., identifying its inventory, equipment slot, or attachment chain).
* **Networking:** Replicated as a subobject by its owning container (like `ULyraInventoryManagerComponent` or `ULyraEquipmentManagerComponent`) to ensure clients have access to its state.

***

### Creation

You typically **do not create Item Instances directly** in the editor. They are created at runtime, primarily by:

1. **`UGlobalInventoryManager::CreateNewItem`:** The preferred centralized method for creating a fresh item instance from a definition. This function also handles initializing the instance's Fragments (both static and transient).
2. **`ULyraInventoryManagerComponent::AddItemDefinition`:** Internally calls `UGlobalInventoryManager::CreateNewItem` when adding a new item type to an inventory.
3. **Duplication:** `ULyraInventoryItemInstance::DuplicateItemInstance` can create a deep copy of an existing instance (useful for splitting stacks or transferring items where you need a new unique object).

***

### Key Properties and Functionality

* **`ItemDef` (`TSubclassOf<ULyraInventoryItemDefinition>`)**
  * Replicated property storing the **Blueprint class** of the `ULyraInventoryItemDefinition` this instance is based on.
  * Accessed via `GetItemDef()`. The static data is then typically read from the CDO of this class.
* **`StatTags` (`FGameplayTagStackContainer`)**
  * **Purpose:** Stores persistent, instance-specific **integer** counts associated with Gameplay Tags. Ideal for ammo, charges, stack quantity, durability points, etc.
  * **Replication:** Uses `FFastArraySerializer` for efficient replication.
  * **Access:**
    * `AddStatTagStack(Tag, Count)` (Authority)
    * `SetStatTagStack(Tag, Count)` (Authority)
    * `RemoveStatTagStack(Tag, Count)` (Authority)
    * `GetStatTagStackCount(Tag)` (Client/Server)
    * `HasStatTag(Tag)` (Client/Server)
  * **Key Tag:** `TAG_Lyra_Inventory_Item_Count` is conventionally used by many fragments (like `InventoryIcon`) to represent the primary stack count of the item within an inventory entry.
  * _(See the dedicated "Stat Tags" page for more details)_.
* **`TransientFragments` (`TArray<FInstancedStruct>`)**
  * **Purpose:** Holds the instance-specific **struct** data payloads (`FTransientFragmentData`-derived) associated with fragments from the `ItemDef`.
  * **Replication:** Replicated array. `FInstancedStruct` handles polymorphism.
  * **Initialization:** Populated during item creation based on `ULyraInventoryItemFragment::CreateNewTransientFragment`.
  * **Access:** Use `ResolveTransientFragment<T>()` (C++) or `ResolveStructTransientFragment()` (Blueprint/C++) to get a pointer/copy of the specific transient data struct. Use `SetTransientFragmentData()` to update it (usually on authority).
  * _(See the dedicated "Transient Data Fragments" page for more details)_.
* **`RuntimeFragments` (`TArray<TObjectPtr<UTransientRuntimeFragment>>`)**
  * **Purpose:** Holds the instance-specific **UObject** payloads (`UTransientRuntimeFragment`-derived) associated with fragments from the `ItemDef`.
  * **Replication:** Replicated array of UObject pointers (requires subobject replication setup by the owning component).
  * **Initialization:** Populated during item creation based on `ULyraInventoryItemFragment::CreateNewRuntimeTransientFragment`.
  * **Access:** Use `ResolveTransientFragment<T>()` (C++) or `ResolveRuntimeTransientFragment()` (Blueprint/C++) to get a pointer to the specific runtime fragment UObject.
  * _(See the dedicated "Transient Runtime Fragments" page for more details)_.
* **`CurrentSlot` (`FInstancedStruct`)**
  * **Purpose:** Tracks the current location or context of this item instance. Uses `FInstancedStruct` to hold different data types depending on the location.
  * **Types:**
    * `FNullSourceSlot`: Item is not in a recognized slot (e.g., just created, being dropped).
    * `FInventoryAbilityData_SourceItem`: Item is in a `ULyraInventoryManagerComponent` at a specific index.
    * `FEquipmentAbilityData_SourceEquipment`: Item is equipped in a `ULyraEquipmentManagerComponent` slot.
    * `FAttachmentAbilityData_SourceAttachment`: Item is attached to another item.
  * **Replication:** Replicated using `OnRep_CurrentSlot`.
  * **Access:** `GetCurrentSlot()`, `SetCurrentSlot()` (Authority Only).
  * **`OnRep_CurrentSlot(const FInstancedStruct& OldSlot)`:** Called on clients when `CurrentSlot` changes. Crucially, it iterates through all `TransientFragments` and `RuntimeFragments` calling their `ItemMoved(this, OldSlot, CurrentSlot)` function, allowing fragment logic to react to location changes. It also broadcasts the `TAG_Lyra_Inventory_Message_ItemMoved` gameplay message.
* **`bIsClientPredicted` (`bool`)**
  * A flag used internally, often set to `true` for temporary item instances created on the client for prediction purposes (e.g., showing an item pickup immediately before server confirmation). These predicted instances are typically destroyed or replaced when the authoritative server state arrives.
* **`FindFragmentByClass<T>()` / `FindFragmentByClass()`**
  * Convenience function to find the _static_ `ULyraInventoryItemFragment` on the instance's `ItemDef` CDO. Useful for accessing static fragment data directly from an instance.
* **`DuplicateItemInstance(UObject* NewOuter)`**
  * Performs a deep copy of the item instance, including its Stat Tags and Transient/Runtime fragments.
  * Essential for splitting stacks or transferring items where a new, unique instance is required.

***

### Lifecycle & Destruction

* **Creation:** Via `UGlobalInventoryManager` or duplication. Fragments are initialized.
* **Management:** Held within `FLyraInventoryList` (Inventory Component) or tracked by other systems (Equipment Manager, World Collectable).
* **Destruction:**
  * Explicitly via `ULyraInventoryManagerComponent::DestroyItemInstance`. This function is intended for when an item is truly consumed or permanently removed (e.g., using a consumable). It triggers the `DestroyTransientFragment` callback on all associated fragments before removing the item instance from the inventory list.
  * Implicitly when its owning container/actor is destroyed (standard UObject garbage collection).
  * `BeginDestroy()`: Overridden to broadcast a `TAG_Lyra_Inventory_Message_ItemDestroyed` gameplay message when the instance UObject is being garbage collected.

***

### Networking

* `IsSupportedForNetworking()`: Returns true.
* **Replication:** As mentioned, Item Instances are replicated as **subobjects** of their containing component (`ULyraInventoryManagerComponent`, `ULyraEquipmentManagerComponent`, or potentially `ALyraWorldCollectable` if configured). This requires the owning component/actor to correctly handle subobject replication (overriding `ReplicateSubobjects`, using `AddReplicatedSubObject`, etc.).
* **Properties:** Key properties like `ItemDef`, `StatTags`, `TransientFragments`, `RuntimeFragments`, and `CurrentSlot` are marked `UPROPERTY(Replicated)`. Runtime Fragments themselves need internal replication setup if they contain replicated properties.

***

The `ULyraInventoryItemInstance` is the dynamic workhorse of the inventory system. It bridges the static definition with runtime state through its various containers (`StatTags`, `TransientFragments`, `RuntimeFragments`) and tracks its place in the game world via `CurrentSlot`. Understanding its properties and lifecycle is key to managing item state effectively.
