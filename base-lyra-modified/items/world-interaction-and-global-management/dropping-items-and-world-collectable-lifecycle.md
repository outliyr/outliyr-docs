# Dropping Items & World Collectable Lifecycle

This section details the process of dropping items from an inventory into the game world, how `ALyraWorldCollectable` actors are spawned and managed during their physical lifecycle (including physics simulation and settling), and the utility functions that facilitate this.

### The `UPickupableStatics` Library

The `UPickupableStatics` (`UBlueprintFunctionLibrary`) class provides static helper functions for common operations related to `IPickupable` interfaces and dropping items.

* **`GetFirstPickupableFromActor(AActor* Actor)`**
  * **Purpose:** A utility function to retrieve the first `IPickupable` interface found on an `AActor` or any of its `UActorComponent`s. This is useful when you have an actor reference and need to interact with its pickupable capabilities without knowing the exact type.
  * **Usage:** Often used by interaction systems to determine if a target actor can be picked up.
* **`DropItem(const AActor* Dropper, const FInventoryPickup& Inventory, TSubclassOf<ALyraWorldCollectable> CollectableClass, const FDropParams& Params)`**
  * **Purpose:** This is the centralized, authoritative function for robustly spawning `ALyraWorldCollectable` actors in the world when items are dropped from an inventory or generated as world loot. It handles finding a suitable spawn location, configuring the visual mesh, and initializing physics.
  * **Parameters:**
    * `Dropper`: The actor dropping the item (e.g., player character), used for calculating drop location relative to them.
    * `Inventory`: An `FInventoryPickup` struct containing the `FPickupTemplate`s and/or `FPickupInstance`s to be dropped.
    * `CollectableClass`: The `ALyraWorldCollectable` subclass to spawn. Defaults to `ALyraWorldCollectable` itself if not overridden.
    * `Params`: An `FDropParams` struct defining the behavior of the drop, such as distance, scatter, and initial impulse (see below).
  * **Logic Flow (Server-Side):**
    1. **Location Search:** Attempts `MaxTries` to find a valid spawn location in front of the `Dropper` using line traces and overlap checks to avoid spawning inside geometry or other actors.
    2. **Actor Spawning:** Spawns an `ALyraWorldCollectable` actor at the determined location with `ESpawnActorCollisionHandlingMethod::AlwaysSpawn`.
    3. **Inventory Transfer:** Calls `SetPickupInventory` on the newly spawned collectable to transfer the `FInventoryPickup` data. This also registers `ItemInstance`s for replication.
    4. **Initial Physics Setup:** Configures the `ALyraWorldCollectable`'s mesh component for physics simulation (setting mobility, collision responses, enabling physics replication) and applies an `InitialImpulse` if specified.
    5. **Physics Settling Monitoring:** Initiates monitoring of the collectable's physics velocity (`bIsMonitoringPhysicsSettling`) to determine when it has settled.

### The `FDropParams` Struct

This struct provides configurable parameters for the `DropItem` function, allowing designers to control the physics and placement behavior of dropped items.

* `MinDist`: (float) Minimum distance from the `Dropper` to attempt spawning the item (in cm).
* `MaxDist`: (float) Maximum distance from the `Dropper` to attempt spawning the item (in cm).
* `MaxYawOffset`: (float) Maximum yaw rotation offset (in degrees) from the `Dropper`'s forward direction, creating a scatter effect.
* `Height`: (float) Initial height (in cm) above the ground where the item is spawned before physics takes over and it falls.
* `MaxTries`: (int32) Maximum number of attempts to find a valid spawn location before failing to drop the item.
* `InitialImpulse`: (FVector) An initial impulse vector applied to the item's physics mesh immediately after spawning, causing it to bounce or slide.

### `ALyraWorldCollectable` Visuals & Physics Lifecycle

The `ALyraWorldCollectable` actor handles its visual representation and physics behavior dynamically during its lifecycle in the world.

* **Dynamic Mesh Creation (`RebuildVisual`):**
  * Unlike typical actors, `ALyraWorldCollectable` does not have a pre-assigned `UStaticMeshComponent` or `USkeletalMeshComponent` in its Blueprint. Instead, it dynamically creates one at runtime within the `RebuildVisual` function (called on `OnConstruction` and `SetPickupInventory`).
  * It determines whether to create a `UStaticMeshComponent` or `USkeletalMeshComponent` based on the `StaticMesh` or `SkeletalMesh` properties defined in the `InventoryFragment_PickupItem` of the item it represents. The internal `FPooledMesh` struct holds a pointer to the active mesh component.
  * This approach allows a single `ALyraWorldCollectable` class to handle both static and skeletal mesh item types seamlessly, avoiding duplication.
  * **Note for Blueprints:** Since the mesh component is created at runtime, it will not appear as a selectable component in the Blueprint editor's Components tab. Custom logic requiring access to the mesh should use `GetMeshComponent()` instead.
* **Interaction Widget Attachment (`ReattachInteractionWidgetToMesh`, `OnRep_Mesh`):**
  * The `InteractionWidget` (used for displaying interaction prompts) is attached to the dynamically created mesh component. This ensures it moves and rotates with the item's visual representation.
  * The `OnRep_Mesh` function handles this re-attachment on clients once the replicated `Mesh` property is updated, ensuring the widget is correctly positioned even after initial replication.
* **Physics Simulation & Settling (`OnPhysicsSettled`, Tick Logic):**
  * When an `ALyraWorldCollectable` is spawned (e.g., via `DropItem`), its mesh component is initially configured to simulate physics (`SetSimulatePhysics(true)`). This allows items to fall, bounce, and roll naturally.
  * The actor then monitors its velocity on the server (`bIsMonitoringPhysicsSettling` flag and `Tick` function).
  * If the item's velocity remains below the `SettlingVelocityThresholdSq` (default 4 cm/s) for `SettlingTimeRequired` (default 0.5 seconds), the `OnPhysicsSettled` function is called.
  * **`OnPhysicsSettled`:** This function transitions the item from a dynamic, physics-simulating state to a static, non-simulating state. It disables physics, sets the mesh's mobility to `Static`, and adjusts collision responses to optimize performance and prevent further unwanted movement (e.g., ignoring `ECC_Pawn` to prevent players from pushing items around once settled). This also disables actor ticking and movement replication to save performance.

### Full Workflow Example (Dropping, Settling & Picking Up)

This example combines the dropping, physics lifecycle, and pickup processes to illustrate the complete flow.

1. **Drop Action (Server):**
   * Player initiates a "Drop" action via UI or a Gameplay Ability.
   * Server-side ability resolves the `ULyraInventoryItemInstance` (`DroppedItemInstance`) from the player's inventory.
   * It checks if `DroppedItemInstance->FindFragmentByClass<UInventoryFragment_PickupItem>()` exists. If not, the drop likely fails.
   * If the fragment exists, the ability calls `PlayerInventory->RemoveItemInstance(DroppedItemInstance)` (or `RemoveItem` for partial stacks).
   * The ability then calls `UPickupableStatics::DropItem(PlayerActor, FInventoryPickup_ContainingItem, ALyraWorldCollectable::StaticClass(), FDropParams_WithInitialImpulse)`.
   * `DropItem` finds a valid spot, spawns the `ALyraWorldCollectable` actor, and calls `SetPickupInventory` on it.
   * `SetPickupInventory` populates `StaticInventory` and triggers `RebuildVisual()`.
   * `RebuildVisual()` creates the appropriate `UStaticMeshComponent` or `USkeletalMeshComponent` based on `InventoryFragment_PickupItem`, attaches it to `SceneRoot`, sets up initial collision, and applies any `InitialImpulse` from `FDropParams`.
   * The `ALyraWorldCollectable` enables `bIsMonitoringPhysicsSettling` and its tick.
2. **Physics Settling (Server-Side Only):**
   * The `ALyraWorldCollectable::Tick` function continuously monitors the mesh component's velocity.
   * The item will fall and possibly bounce due to gravity and the `InitialImpulse`.
   * Once its velocity remains below `SettlingVelocityThresholdSq` for the `SettlingTimeRequired`, `OnPhysicsSettled()` is invoked.
   * `OnPhysicsSettled()` disables physics simulation on the mesh, sets its mobility to static, updates collision responses (e.g., blocking world geometry, overlapping with players for interaction, but ignoring player pushes), disables actor ticking, and stops replicating movement to clients (saving bandwidth).
3. **Interaction (Client -> Server):**
   * Player looks at the now static `ALyraWorldCollectable` and presses the interact key.
   * The interaction system triggers a Gameplay Event/Ability on the server, targeting the `ALyraWorldCollectable`.
4. **Pickup Logic (Server):**
   * The server-side pickup ability gets the `IPickupable` interface from the `ALyraWorldCollectable` actor.
   * It gets the interacting player's `ULyraInventoryManagerComponent` (`PlayerInventory`).
   * It calls `Pickupable->AddPickupToInventory(PlayerInventory, WorldCollectable, OutStacked, OutNew)`.
   * `AddPickupToInventory` attempts to transfer the `DroppedItemInstance` (and any other items in the collectable's inventory) into `PlayerInventory` using `TryAddItemInstance` or `TryAddItemDefinition`.
   * If successful (and `AddPickupToInventory` returns `true` because the collectable's inventory is now empty), the ability destroys the `ALyraWorldCollectable` actor.
   * If unsuccessful (e.g., inventory full), the `ALyraWorldCollectable` remains, potentially with fewer items if partially picked up.
