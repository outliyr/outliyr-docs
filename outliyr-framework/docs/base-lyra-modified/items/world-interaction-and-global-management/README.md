# World Interaction & Global Management

While inventory components manage items _within_ containers (like a player's backpack or a chest), games often require items to exist physically in the world and need a way to manage item creation centrally. This section covers the systems responsible for:

* Representing Items in the World: How items dropped or placed in the level are handled.
* Picking Up Items: The mechanism for transferring world items into an inventory component.
* Centralized Item Creation: The `ULyraItemSubsystem` ensuring item instances are created consistently with proper fragment initialization.
* Tracking World Containers: Managing inventories that aren't directly attached to players or standard actors (relevant for persistence or complex world simulation).

### Items in the World: Pickups

When items are not inside an `ULyraInventoryManagerComponent`, they often need a physical representation in the game world that players can see and interact with.

* `IPickupable` Interface
  * Defines a standard contract for any Actor or Component that can represent a collection of one or more inventory items available for pickup.
  * Specifies how to retrieve the list of items (`GetPickupItem`) and provides functions to attempt transferring those items (`AddPickupToInventory`, `AddSubsetToInventory`).
* `AWorldCollectableBase` (Abstract)
  * The base actor class implementing `IPickupable` and `IInteractableTarget`.
  * Designed to be placed or spawned in the world, holding an `FItemPickup` struct which contains lists of item templates (`FPickupTemplate`) and/or existing item instances (`FPickupInstance`).
  * Concrete subclasses handle the visual representation:
    * `AWorldCollectable_Static`: For items with static meshes.
    * `AWorldCollectable_Skeletal`: For items with skeletal meshes.
* `UPickupInteractionProfile`
  * A data asset that configures interaction options for world collectables, including text modes, interaction times, and abilities to grant.
* `UPickupableStatics Library`
  * A static Blueprint function library providing utility functions, e.g. centralized `DropItem` and `DropItemAtLocation` functions for robustly spawning world collectable actors.

### Item Creation: `ULyraItemSubsystem`

Creating `ULyraInventoryItemInstance` objects involves initializing their fragments and ensuring they have the correct outer object. The `ULyraItemSubsystem` centralizes this:

* Role: A `UWorldSubsystem` responsible for item lifecycle management.
* Centralized Item Creation: Provides `CreateItemInstance(ItemDef, Amount)` which correctly allocates the `ULyraInventoryItemInstance`, sets its definition, initializes its Stat Tags (like stack count), and, importantly, iterates through the definition's fragments to call `OnInstanceCreated` and create any associated transient fragments (structs and UObjects).
* GUID-Based Tracking: Maintains a map of item GUIDs for fast O(1) lookups via `FindItemByGuid()`.
* Item Destruction: Provides `DestroyItem()` for proper cleanup including GUID map removal and fragment cleanup.

{% hint style="info" %}
Centralizing item creation in a subsystem ensures consistent initialization (fragments, stat tags, outers) and enables global tracking and cleanup.
{% endhint %}

### Container Management: `UGlobalInventoryManager`

For managing world containers that aren't directly attached to players:

* Role: A `UGameStateComponent` for tracking world inventories.
* World Container Tracking: Used to register and manage `ULyraInventoryManagerComponent` instances that represent world containers not tied directly to a player Pawn (e.g., persistent chests, vendor inventories). This is facilitated by `AddNewInventory` and `DestroyItemInventory`.
* Experience Loading: Integrates with the Lyra Experience system to perform initialization (`InitializeGlobalInventory`) once an experience is loaded.

### Interaction Flow

{% stepper %}
{% step %}
#### Dropping Item Example

* Player initiates a "Drop" action via UI or a Gameplay Ability.
* Server-side logic calls `UPickupableStatics::DropItem`, passing the item(s) to be dropped and relevant drop parameters.
* `DropItem` handles finding a valid spawn location, selects the appropriate collectable class (`AWorldCollectable_Static` or `AWorldCollectable_Skeletal`), and spawns the actor.
* The spawned actor's `RebuildVisual()` initializes its mesh from the item's pickup fragment, and physics simulation begins.
* The collectable monitors its physics until it settles into a static, non-simulating state.
{% endstep %}

{% step %}
#### Picking Up Item Example

* Player interacts with an `AWorldCollectableBase` actor in the world.
* The interaction triggers logic (often a Gameplay Ability) on the server.
* The server logic gets the `IPickupable` interface from the collectable.
* It calls `IPickupable->AddPickupToInventory()`, passing in the player's container.
* `AddPickupToInventory` iterates through the items defined in its internal `FItemPickup`.
* For each item/template, it merges stacks into existing items or creates new items via `ULyraItemSubsystem`.
* If items are successfully added, they are removed from the collectable's `FItemPickup`.
* If the `FItemPickup` becomes empty, `AddPickupToInventory` returns `true`, signaling that the collectable actor can likely be destroyed.
{% endstep %}
{% endstepper %}

### Structure of this Section

The following sub-pages will detail these components:

* Pickup System: Interfaces and Core Actor
  * Explaining the `IPickupable` interface, data structures, and the `AWorldCollectableBase` actor hierarchy for item pickups.
* Dropping Items & World Collectable Lifecycle
  * Detailing the `UPickupableStatics` library, `FDropParams` struct, the dynamic visual and physics management of world collectables, and the full workflow from dropping to settling.
* Item Subsystem (`ULyraItemSubsystem`)
  * Detailing its role in item creation, GUID tracking, and lifecycle management.
* Global Inventory Manager (`UGlobalInventoryManager`)
  * Detailing its role in managing world container inventories.

***

This overview introduces the mechanisms for handling items outside of standard inventories and the subsystems responsible for consistent item creation and container management. These systems work together to allow players to find, pick up, and interact with items within the game world, integrating seamlessly with the core inventory components.
