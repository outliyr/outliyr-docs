# World Interaction & Global Management

While inventory components manage items _within_ containers (like a player's backpack or a chest), games often require items to exist physically in the world and need a way to manage item creation centrally. This section covers the systems responsible for:

1. **Representing Items in the World:** How items dropped or placed in the level are handled.
2. **Picking Up Items:** The mechanism for transferring world items into an inventory component.
3. **Centralized Item Creation:** A global manager ensuring item instances are created consistently.
4. **Tracking World Containers:** Managing inventories that aren't directly attached to players or standard actors (relevant for persistence or complex world simulation).

### Items in the World: Pickups

When items are not inside an `ULyraInventoryManagerComponent`, they often need a physical representation in the game world that players can see and interact with.

* **`IPickupable` Interface:** Defines a standard contract for any Actor or Component that can represent a collection of one or more inventory items available for pickup. It specifies how to retrieve the list of items (`GetPickupInventory`) and provides functions to attempt transferring those items (`AddPickupToInventory`, `AddSubsetToInventory`).
* **`ALyraWorldCollectable` Actor:** A concrete example `AActor` class implementing `IPickupable` (and `IInteractableTarget`). It's designed to be placed or spawned in the world, holding an `FInventoryPickup` struct which contains lists of item templates (`FPickupTemplate`) and/or existing item instances (`FPickupInstance`). Its visual representation (static or skeletal mesh) is dynamically created at runtime based on the item definition, and it includes physics simulation that settles into a static state. Player interaction (e.g., pressing 'E') with this actor triggers the pickup logic.
* **`UPickupableStatics` Library:** A static Blueprint function library providing utility functions, e.g. a centralized `DropItem` function for robustly spawning `ALyraWorldCollectable` actors into the world.

### Global Management: `UGlobalInventoryManager`

Creating `ULyraInventoryItemInstance` objects involves initializing their fragments and ensuring they have the correct outer object. To centralize and standardize this, the `UGlobalInventoryManager` exists.

* **Role:** A `UGameStateComponent` acting as a singleton-like manager within the game state.
* **Centralized Item Creation:** Provides the primary function `CreateNewItem(ItemDef, Amount)` which correctly allocates the `ULyraInventoryItemInstance`, sets its definition, initializes its Stat Tags (like stack count), and importantly, iterates through the definition's fragments to call `OnInstanceCreated` and create any associated **Transient Fragments** (structs and UObjects). Using this ensures instances are always set up correctly.
* **World Container Tracking:** Can optionally be used to register and manage `ULyraInventoryManagerComponent` instances that represent world containers not tied directly to a player Pawn (e.g., persistent chests, vendor inventories). This is facilitated by `AddNewInventory` and `DestroyItemInventory`.
* **Experience Loading:** Integrates with the Lyra Experience system to perform initialization (`InitializeGlobalInventory`) once an experience is loaded, potentially handling loading saved global inventory states in the future.

### Interaction Flow

**Dropping Item Example**

1. Player initiates a "Drop" action via UI or a Gameplay Ability.
2. Server-side logic calls `UPickupableStatics::DropItem`, passing the item(s) to be dropped and relevant drop parameters.
3. `DropItem` handles finding a valid spawn location, creating an `ALyraWorldCollectable` actor, initializing its visual mesh at runtime, and applying initial physics.
4. The `ALyraWorldCollectable` then monitors its physics until it settles into a static, non-simulating state.

### **Picking Up Item Example**

1. Player interacts with an `ALyraWorldCollectable` actor in the world.
2. The interaction triggers logic (often a Gameplay Ability) on the server.
3. The server logic gets the `IPickupable` interface from the `ALyraWorldCollectable`.
4. It calls `IPickupable->AddPickupToInventory()`, passing in the player's `ULyraInventoryManagerComponent`.
5. `AddPickupToInventory` iterates through the items defined in its internal `FInventoryPickup`.
6. For each item/template, it calls `PlayerInventory->TryAddItemDefinition()` or `PlayerInventory->TryAddItemInstance()`.
7. If items are successfully added, they are removed from the `ALyraWorldCollectable`'s `FInventoryPickup`.
8. If the `FInventoryPickup` becomes empty, `AddPickupToInventory` returns `true`, signaling that the `ALyraWorldCollectable` actor can likely be destroyed.

### Structure of this Section

The following sub-pages will detail these components:

* **Pickup System: Interfaces and Core Actor:** Explaining the `IPickupable` interface, data structures, and the basic properties of the `ALyraWorldCollectable` actor for item pickups.
* **Dropping Items & World Collectable Lifecycle:** Detailing the `UPickupableStatics` library, `FDropParams` struct, the dynamic visual and physics management of `ALyraWorldCollectable`, and the full workflow from dropping to settling.
* **Global Inventory Manager (`UGlobalInventoryManager`):** Detailing its role in item creation and managing world inventories.

***

This overview introduces the mechanisms for handling items outside of standard inventories and the global manager responsible for consistent item creation. These systems work together to allow players to find, pick up, and interact with items within the game world, integrating seamlessly with the core inventory components.
