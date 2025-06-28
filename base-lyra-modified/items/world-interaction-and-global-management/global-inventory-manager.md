# Global Inventory manager

The `UGlobalInventoryManager` acts as a centralized, singleton-like manager operating at the Game State level. Its primary responsibilities revolve around the standardized creation of item instances and the potential management of "world" inventories not directly tied to a specific player or Pawn.

> [!warning]
> This might be replaced with an ItemSubSystem instead.

### Role and Purpose

* **Standardized Item Instance Creation:** Provides the definitive method (`CreateNewItem`) for creating new `ULyraInventoryItemInstance` objects. This ensures that instances are always correctly initialized, including the crucial step of creating and associating their required Transient Fragments (both struct and UObject based).
* **World Inventory Container Management (Optional):** Offers functionality (`AddNewInventory`, `DestroyItemInventory`) to register and manage `ULyraInventoryManagerComponent` instances that represent persistent or shared world containers (e.g., static chests, vendor stocks, faction stashes). This allows these inventories to exist independently of specific Pawns.
* **Central Point of Access:** Provides a static `Get` function to easily retrieve the manager instance from anywhere in the code via the World Context Object.
* **Initialization Hook:** Integrates with the Lyra Experience system (`OnExperienceLoaded`) to provide a reliable point for initialization logic, potentially including loading saved global inventory states.

### Key Functions & Features

* `CreateNewItem(TSubclassOf<ULyraInventoryItemDefinition> ItemDef, int32 Amount = 1)`
  * **The Standard Creation Method:** This is the **recommended** way to create a new `ULyraInventoryItemInstance` from scratch.
  * **Process:**
    1. Creates a new `ULyraInventoryItemInstance` object (typically using the `UGlobalInventoryManager`'s owning Game State as the Outer, though the code comment notes potential workarounds).
    2. Sets the `ItemDef` on the new instance.
    3. Sets the initial stack count using the `Lyra.Inventory.Item.Count` StatTag.
    4. Marks the instance as client-predicted (`bIsClientPredicted = true`) if called on a client (this flag helps differentiate temporary predicted instances).
    5. Retrieves the `ItemDef`'s Class Default Object (CDO).
    6. Iterates through the `Fragments` array on the CDO.
    7. For each fragment:
       * Calls `Fragment->OnInstanceCreated(NewInstance)`.
       * Calls `Fragment->CreateNewTransientFragment(...)` and adds the resulting `FInstancedStruct` to the instance's `TransientFragments` array if successful.
       * Calls `Fragment->CreateNewRuntimeTransientFragment(...)` and adds the resulting `UTransientRuntimeFragment*` to the instance's `RuntimeFragments` array if successful.
  * **Returns:** The fully initialized `ULyraInventoryItemInstance*`.
  * **Why Use This?** Directly calling `NewObject<ULyraInventoryItemInstance>` would _not_ automatically initialize the crucial Transient Fragment data payloads. Using `CreateNewItem` guarantees correct setup according to the item's definition.
* `Get(const UObject* WorldContextObject)` (Static Function)
  * **Action:** Retrieves the singleton instance of `UGlobalInventoryManager` associated with the current game world.
  * **Logic:** Gets the `AGameStateBase` from the world context and calls `FindComponentByClass<UGlobalInventoryManager>()`.
  * **Returns:** The `UGlobalInventoryManager*` instance, or `nullptr` if not found (e.g., the component hasn't been added to the Game State).
* `AddNewInventory(ULyraInventoryManagerComponent* InventoryManagerComponent)` (Authority Recommended)
  * **Action:** Registers an existing `ULyraInventoryManagerComponent` with the Global Manager. Primarily intended for world containers.
  * **Logic:** Adds the component to its internal `ContainerInventories` array and calls `RegisterComponent()` on it (if not already registered).
  * **Use Case:** Spawning a persistent chest actor that creates its own `ULyraInventoryManagerComponent` and then registers it here for potential tracking or saving/loading by a global system.
* `DestroyItemInventory(ULyraInventoryManagerComponent* InventoryManagerComponent)` (Authority Recommended)
  * **Action:** Unregisters and destroys a world inventory component previously added via `AddNewInventory`.
  * **Logic:** Removes the component from the `ContainerInventories` array, calls `EmptyInventory()` on it (to potentially trigger item destruction/cleanup), and then calls `DestroyComponent()`.
  * **Use Case:** Destroying a world chest actor and ensuring its associated inventory component is properly cleaned up.
* `OnExperienceLoaded(const ULyraExperienceDefinition* Experience)`
  * **Action:** Called automatically when the Lyra Experience has finished loading.
  * **Logic:** Calls `InitializeGlobalInventory()`.
  * **Use Case:** A hook for loading saved global inventories or performing other world-inventory setup once the game mode/experience is ready.
* `InitializeGlobalInventory()`
  * **Action:** Placeholder for initialization logic. Currently broadcasts the `TAG_Lyra_Global_Inventory_Message_Loaded` message.
  * **Intended Use:** This is where you would implement logic to load saved world container data or perform any other necessary setup for globally managed inventories.
* `ClearContainerInventories()`
  * **Action:** Called during `EndPlay`. Iterates through the tracked `ContainerInventories`, empties them, and destroys the components. Ensures cleanup when the game state is ending.

### Setup and Usage

1. **Add to Game State:** Ensure the `UGlobalInventoryManager` component is added to your project's `AGameStateBase` derived class through the Lyra experience system.
2. **Item Creation:** Whenever you need to create a _new_ item instance from a definition (e.g., granting a reward, spawning loot from a template), get the `UGlobalInventoryManager` using `UGlobalInventoryManager::Get(WorldContextObject)` and call `CreateNewItem()`.
3. **World Containers (Optional):** If you have persistent world containers:
   * Have the container Actor create its own `ULyraInventoryManagerComponent`.
   * Initialize the component's properties (limits, permissions, etc.).
   * On the server, get the `UGlobalInventoryManager` and call `AddNewInventory()` passing the container's inventory component.
   * When the container is destroyed, call `DestroyItemInventory()` on the server.

***

The `UGlobalInventoryManager` provides essential centralized services for the inventory system, ensuring consistent item instance creation with full fragment initialization and offering a mechanism to track non-player inventories within the game world. Utilizing its `CreateNewItem` function is the standard practice for generating new item instances programmatically.
