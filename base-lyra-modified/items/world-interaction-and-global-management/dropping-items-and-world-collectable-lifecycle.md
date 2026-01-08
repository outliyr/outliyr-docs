# Dropping Items & World Collectable Lifecycle

This section details the process of dropping items from an inventory into the game world, how `AWorldCollectableBase` actors are spawned and managed during their physical lifecycle (including physics simulation and settling), and the utility functions that facilitate this.

### The `UPickupableStatics` Library

The `UPickupableStatics` (`UBlueprintFunctionLibrary`) class provides static helper functions for common operations related to `IPickupable` interfaces and dropping items.

* `GetFirstPickupableFromActor(AActor* Actor)`
  * Purpose: A utility function to retrieve the first `IPickupable` interface found on an `AActor` or any of its `UActorComponent`s. This is useful when you have an actor reference and need to interact with its pickupable capabilities without knowing the exact type.
  * Usage: Often used by interaction systems to determine if a target actor can be picked up.
* `ResolvePickupFragment(const FItemPickup& Inventory)`
  * Purpose: Returns the `UInventoryFragment_PickupItem` from the first instance or template in the inventory.
  * Usage: Used to determine mesh representation and other properties for world collectables.
* `SelectCollectableClassFromInventory(Inventory, StaticSubclass, SkeletalSubclass)`
  * Purpose: Determines which collectable subclass to spawn based on the item's fragment.
  * Logic: If the fragment has a `SkeletalMesh`, returns `SkeletalSubclass`; otherwise returns `StaticSubclass`.
  * Usage: Called internally by `DropItem` and `DropItemAtLocation` to auto-select the appropriate class.
* `DropItem(Dropper, Inventory, StaticCollectableClass, SkeletalCollectableClass, Params)`
  * Purpose: Centralized, authoritative function for robustly spawning world collectable actors when items are dropped from an inventory or generated as world loot.
  * Parameters:
    * `Dropper`: Actor dropping the item (e.g., player character); used to compute relative drop location.
    * `Inventory`: The `FItemPickup` (templates and/or instances) to represent in the world.
    * `StaticCollectableClass`: The `AWorldCollectable_Static` subclass to spawn for static mesh items.
    * `SkeletalCollectableClass`: The `AWorldCollectable_Skeletal` subclass to spawn for skeletal mesh items.
    * `Params`: `FDropParams` controlling distance, scatter, relative eye-height band, tries, and initial impulse.
  * Logic Flow (Server-Side):
    1. Class Selection: Uses `SelectCollectableClassFromInventory` to determine which class to spawn.
    2. Location Search: Attempts `MaxTries` to find a valid, non-overlapping location in front of the `Dropper` using a box derived from the item's mesh bounds and overlap tests.
    3. Smart Fallbacks: If no free spot is found, performs a capsule sweep downwards to land safely on nearby ground; if that still fails, uses an emergency position just in front of the dropper.
    4. Actor Spawning: Spawns the selected collectable class with `ESpawnActorCollisionHandlingMethod::AlwaysSpawn`.
    5. Inventory Transfer: Calls `SetPickupInventory` on the newly spawned collectable.
    6. Interaction Profile: Applies `OverrideInteractionProfile` from params if provided.
    7. Initial Physics Setup: Configures the mesh for physics (movable, collision, gravity) and optionally applies `InitialImpulse`.
    8. Physics Settling Monitoring: Calls `StartMonitoringPhysicsSettling()` to begin settling detection.
* `DropItemAtLocation(WorldContextObject, Inventory, StaticCollectableClass, SkeletalCollectableClass, Location, Params, bProjectToGround)`
  * Purpose: Spawns a world collectable at an explicit world-space location, instead of in front of a dropper. Useful for scripted spawns, loot chests, kill rewards, or designers placing drops via tools.
  * Authority: Server-only. If called on a client, returns `nullptr`.
  * Parameters:
    * `WorldContextObject`: Provides the `UWorld`.
    * `Inventory`: Items to represent in the world (`FItemPickup`).
    * `StaticCollectableClass`: The static mesh collectable subclass.
    * `SkeletalCollectableClass`: The skeletal mesh collectable subclass.
    * `Location`: Desired bottom location (the item's bottom is projected here, independent of mesh origin).
    * `Params`: `FDropParams` for initial physics behavior.
    * `bProjectToGround`: If true, will sweep down to find ground if the desired location is floating or overlapping.
  * Placement & Collision Behavior:
    1. Bounds-Aware Fit: Derives a bounding box from the item's meshes. Attempts to place the item so that its bottom sits at `Location`, performing an overlap test.
    2. Ground Projection (optional): If the initial spot overlaps and `bProjectToGround` is true, performs a capsule sweep downwards; on hit, re-tries placement with the bottom aligned to the ground.
    3. Last Resort: If still overlapping, nudges the Z up slightly and spawns.
    4. Physics Setup: Same as `DropItem` - transfers inventory, configures physics/collision, applies `InitialImpulse`, and enables settling monitoring.

#### The `FDropParams` Struct

This struct provides configurable parameters for the drop functions, allowing designers to control the physics and placement behavior of dropped items.

* `MinDist`: (float, cm) Minimum forward distance from the dropper (used by `DropItem`).
* `MaxDist`: (float, cm) Maximum forward distance from the dropper (used by `DropItem`).
* `MaxYawOffset`: (float, deg) Max yaw offset from the dropper's facing for scatter (used by `DropItem`).
* `MinRelativeEyeHeight`: (float, cm) Minimum vertical offset relative to the dropper's eye position when sampling spawn points (used by `DropItem`).
* `MaxRelativeEyeHeight`: (float, cm) Maximum vertical offset relative to the eye when sampling spawn points (used by `DropItem`).
* `MaxTries`: (int32) Max attempts to find a valid, non-overlapping location (used by `DropItem`).
* `InitialImpulse`: (FVector, cm/s) Initial impulse applied to the physics mesh after spawning (both `DropItem` and `DropItemAtLocation`).
* `OverrideInteractionProfile`: (`UPickupInteractionProfile*`) Optional interaction profile to apply to the spawned collectable, overriding its default.

### `AWorldCollectableBase` Physics Lifecycle

The `AWorldCollectableBase` and its subclasses manage dynamic physics during dropping and settling into a static state.

* Components & Replication:
  * Subclasses provide mesh components: `AWorldCollectable_Static` has `StaticRoot`, `AWorldCollectable_Skeletal` has `SkeletalRoot`.
  * `GetMeshComponent()` returns the active visual component.
  * Actor replicates, but movement replication is disabled (settling finalizes pose).
  * Subobject replication includes each `ULyraInventoryItemInstance` in `StaticInventory.Instances` and any `UTransientRuntimeFragment` those instances own.
* Inventory & Visuals (`SetPickupInventory`, `RebuildVisual`, `OnRep_StaticInventory`):
  * `StaticInventory` is replicated; `OnRep_StaticInventory` triggers `RebuildVisual()` on clients.
  * `RebuildVisual()` (implemented by subclasses) selects the mesh from the item's `UInventoryFragment_PickupItem` (instances preferred, then templates).
  * If neither provides a mesh, subclasses may use a `DefaultPlaceholderMesh`.
* Interaction (`IInteractableTarget`):
  * `GatherInteractionOptions_Implementation` builds options from the `InteractionProfile`.
  * If no profile is set, provides a default "Collect" option.
  * Option text is resolved via `ResolveOptionText()` based on the profile's `EOptionTextMode`.
  * The `InteractionWidgetComponent` provides the world-space location for interaction UI.
* Physics Simulation & Settling (`Tick`, `OnPhysicsSettled`):
  * Server-only settling monitor using `bIsMonitoringPhysicsSettling`, `SettlingVelocityThresholdSq` (default 16 cm²/s²), and `SettlingTimeRequiredSeconds` (default 0.5s).
  * `StartMonitoringPhysicsSettling()` enables tick and begins monitoring.
  * Each `Tick`, checks if velocity is below threshold. If so, accumulates time; once `SettlingTimeRequiredSeconds` is reached, calls `OnPhysicsSettled()`.
  * When settled:
    * Physics is turned off.
    * Collision becomes QueryOnly with:
      * Overlap: `Visibility`, `Camera`, `Lyra_TraceChannel_Interaction`, `Pawn`.
      * Block: `WorldStatic`, `WorldDynamic`.
    * Actor tick is disabled.
    * `UpdateInteractionWidgetLocation()` is called to position the interaction dot.

### Full Workflow Example (Dropping, Settling & Picking Up)

{% stepper %}
{% step %}
#### Drop Action (Server)

* Player triggers "Drop" (UI or Gameplay Ability).
* Server resolves `ULyraInventoryItemInstance* DroppedItemInstance` from the player's inventory.
* Verifies `UInventoryFragment_PickupItem` exists; otherwise fails.
* Removes item (or partial stack) from the inventory.
* Calls one of:
  * `UPickupableStatics::DropItem(PlayerActor, Pickup, StaticClass, SkeletalClass, DropParams)` or
  * `UPickupableStatics::DropItemAtLocation(GameModeOrActor, Pickup, StaticClass, SkeletalClass, TargetWorldLocation, DropParams, /*bProjectToGround=*/true)`
* `SetPickupInventory` and `RebuildVisual()` configure visuals; physics begins; settling monitor is enabled.
{% endstep %}

{% step %}
#### Physics Settling (Server-Side)

* Server `Tick` monitors velocity until below threshold for required time.
* `OnPhysicsSettled()` finalizes collision/mobility, positions interaction widget, and disables unnecessary ticking.
{% endstep %}

{% step %}
#### Interaction (Client -> Server)

* Player looks at the settled collectable and interacts.
* Interaction system triggers a server ability/event targeting the collectable.
{% endstep %}

{% step %}
#### Pickup Logic (Server)

* Server gets the `IPickupable` from the collectable.
* Fetches the player's inventory container.
* Calls `Pickupable->AddPickupToInventory(Container, WorldCollectable, OutStacked, OutNew)`.
* On success (collectable inventory now empty), destroys the collectable; on partial/failed add, it remains with updated contents.
{% endstep %}
{% endstepper %}
