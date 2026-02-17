# Global Inventory manager

> [!INFO]
> The `UGlobalInventoryManager` acts as a centralized manager operating at the Game State level. Its primary responsibility is managing "world" inventories not directly tied to a specific player or Pawn.
> 
> Note: For item creation, use `ULyraItemSubsystem` instead. See the [Item Subsystem](item-subsystem.md) documentation.

### Role and Purpose

* **World Inventory Container Management:** Offers functionality (`AddNewInventory`, `DestroyItemInventory`) to register and manage `ULyraInventoryManagerComponent` instances that represent persistent or shared world containers (e.g., static chests, vendor stocks, faction stashes). This allows these inventories to exist independently of specific Pawns.
* **Central Point of Access:** Provides a static `Get` function to easily retrieve the manager instance from anywhere in the code via the World Context Object.
* **Initialization Hook:** Integrates with the Lyra Experience system (`OnExperienceLoaded`) to provide a reliable point for initialization logic, potentially including loading saved global inventory states.

***

## Key Functions & Features

* `Get(const UObject* WorldContextObject)` (Static Function)
  * Action: Retrieves the singleton instance of `UGlobalInventoryManager` associated with the current game world.
  * Logic: Gets the `AGameStateBase` from the world context and calls `FindComponentByClass<UGlobalInventoryManager>()`.
  * Returns: The `UGlobalInventoryManager*` instance, or `nullptr` if not found.
* `AddNewInventory(ULyraInventoryManagerComponent* InventoryManagerComponent)` (Authority Recommended)
  * Action: Registers an existing `ULyraInventoryManagerComponent` with the Global Manager.
  * Logic: Adds the component to its internal `ContainerInventories` array and calls `RegisterComponent()` on it (if not already registered).
  * Use Case: Spawning a persistent chest actor that creates its own `ULyraInventoryManagerComponent` and then registers it here for potential tracking or saving/loading by a global system.
* `DestroyItemInventory(ULyraInventoryManagerComponent* InventoryManagerComponent)` (Authority Recommended)
  * Action: Unregisters and destroys a world inventory component previously added via `AddNewInventory`.
  * Logic: Removes the component from the `ContainerInventories` array, calls `EmptyInventory()` on it (to potentially trigger item destruction/cleanup), and then calls `DestroyComponent()`.
  * Use Case: Destroying a world chest actor and ensuring its associated inventory component is properly cleaned up.
* `OnExperienceLoaded(const ULyraExperienceDefinition* Experience)`
  * Action: Called automatically when the Lyra Experience has finished loading.
  * Logic: Calls `InitializeGlobalInventory()`.
  * Use Case: A hook for loading saved global inventories or performing other world-inventory setup once the game mode/experience is ready.
* `InitializeGlobalInventory()`
  * Action: Placeholder for initialization logic. Currently broadcasts the `TAG_Lyra_Global_Inventory_Message_Loaded` message.
  * Intended Use: Implement logic to load saved world container data or perform any other necessary setup for globally managed inventories.
* `ClearContainerInventories()`
  * Action: Called during `EndPlay`. Iterates through the tracked `ContainerInventories`, empties them, and destroys the components. Ensures cleanup when the game state is ending.

***

## Setup and Usage

{% stepper %}
{% step %}
#### Add to Game State

Ensure the `UGlobalInventoryManager` component is added to your project's `AGameStateBase` derived class through the Lyra experience system.
{% endstep %}

{% step %}
#### World Containers

If you have persistent world containers:

* Have the container Actor create its own `ULyraInventoryManagerComponent`.
* Initialize the component's properties (limits, permissions, etc.).
* On the server, get the `UGlobalInventoryManager` and call `AddNewInventory()` passing the container's inventory component.
* When the container is destroyed, call `DestroyItemInventory()` on the server.
{% endstep %}
{% endstepper %}

***

The `UGlobalInventoryManager` provides centralized services for managing world container inventories.
