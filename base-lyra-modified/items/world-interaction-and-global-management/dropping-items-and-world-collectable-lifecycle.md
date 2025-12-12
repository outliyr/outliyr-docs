# Dropping Items & World Collectable Lifecycle

This section details the process of dropping items from an inventory into the game world, how `ALyraWorldCollectable` actors are spawned and managed during their physical lifecycle (including physics simulation and settling), and the utility functions that facilitate this.

### The `UPickupableStatics` Library

The `UPickupableStatics` (`UBlueprintFunctionLibrary`) class provides static helper functions for common operations related to `IPickupable` interfaces and dropping items.

* **`GetFirstPickupableFromActor(AActor* Actor)`**
  * **Purpose:** A utility function to retrieve the first `IPickupable` interface found on an `AActor` or any of its `UActorComponent`s. This is useful when you have an actor reference and need to interact with its pickupable capabilities without knowing the exact type.
  * **Usage:** Often used by interaction systems to determine if a target actor can be picked up.
* **`DropItem(const AActor* Dropper, const FInventoryPickup& Inventory, TSubclassOf<ALyraWorldCollectable> CollectableClass, const FDropParams& Params)`**
  * **Purpose:** Centralized, authoritative function for robustly spawning `ALyraWorldCollectable` actors in the world when items are dropped from an inventory or generated as world loot. It handles finding a suitable spawn location, configuring the visual mesh, and initializing physics.
  * **Parameters:**
    * `Dropper`: Actor dropping the item (e.g., player character); used to compute relative drop location.
    * `Inventory`: The `FInventoryPickup` (templates and/or instances) to represent in the world.
    * `CollectableClass`: The `ALyraWorldCollectable` subclass to spawn (defaults to `ALyraWorldCollectable`).
    * `Params`: `FDropParams` controlling distance, scatter, relative eye-height band, tries, and initial impulse.
  * **Logic Flow (Server-Side):**
    1. **Location Search:** Attempts `MaxTries` to find a valid, non-overlapping location in front of the `Dropper` using a box derived from the item’s mesh bounds and overlap tests. The vertical placement is randomized within `[MinRelativeEyeHeight, MaxRelativeEyeHeight]` (relative to the dropper’s eye).
    2. **Smart Fallbacks:** If no free spot is found, performs a capsule sweep downwards to land safely on nearby ground; if that still fails, uses an emergency position just in front of the dropper.
    3. **Actor Spawning:** Spawns the `ALyraWorldCollectable` with `ESpawnActorCollisionHandlingMethod::AlwaysSpawn`.
    4. **Inventory Transfer:** Calls `SetPickupInventory` on the newly spawned collectable, registering item instances for replication.
    5. **Initial Physics Setup:** Configures the mesh for physics (movable, collision, gravity) and optionally applies `InitialImpulse`.
    6. **Physics Settling Monitoring:** Enables server-side monitoring to detect when the item has come to rest and to finalize collision/mobility.
* **`DropItemAtLocation(const UObject* WorldContextObject, const FInventoryPickup& Inventory, TSubclassOf<ALyraWorldCollectable> CollectableClass, const FVector& Location, const FDropParams& Params, bool bProjectToGround = true)`**
  * **Purpose:** Spawns a world collectable at an **explicit world-space location**, instead of in front of a dropper. Useful for scripted spawns, loot chests, kill rewards, or designers placing drops via tools.
  * **Authority:** Server-only. If called on a client, returns `nullptr`. Accepts any object that provides a `UWorld` (e.g., GameMode, Controller, Actor).
  * **Parameters:**
    * `WorldContextObject`: Provides the `UWorld`.
    * `Inventory`: Items to represent in the world (`FInventoryPickup`).
    * `CollectableClass`: The `ALyraWorldCollectable` subclass to spawn.
    * `Location`: Desired **bottom** location (the item’s bottom is projected here, independent of mesh origin).
    * `Params`: `FDropParams` for initial physics behavior (e.g., impulse).
    * `bProjectToGround`: If true, will sweep down to find ground if the desired location is floating or overlapping.
  * **Placement & Collision Behavior:**
    1. **Bounds-Aware Fit:** Derives a bounding box from the item’s meshes (instances → templates → collectable defaults/placeholder). Attempts to place the item so that its **bottom** sits at `Location`, performing an overlap test against world static/dynamic, pawns, vehicles.
    2. **Ground Projection (optional):** If the initial spot overlaps and `bProjectToGround` is true, performs a capsule sweep downwards; on hit, re-tries placement with the bottom aligned to the ground (with a small epsilon).
    3. **Last Resort:** If still overlapping, nudges the Z up slightly and spawns.
    4. **Physics Setup:** Spawns with `AlwaysSpawn`, transfers inventory, configures physics/collision, applies `InitialImpulse`, and enables settling monitoring—matching `DropItem` behavior.
  * **Typical Usage:**
    * Scripted reward at a marker: “Spawn a health pack exactly here; if it’s inside geometry, slide it to the ground.”
    * Designer tool drop: “Place loot at cursor world position.”

#### The `FDropParams` Struct

This struct provides configurable parameters for the drop functions, allowing designers to control the physics and placement behavior of dropped items.

* `MinDist`: (float, cm) Minimum forward distance from the dropper (used by `DropItem`).
* `MaxDist`: (float, cm) Maximum forward distance from the dropper (used by `DropItem`).
* `MaxYawOffset`: (float, deg) Max yaw offset from the dropper’s facing for scatter (used by `DropItem`).
* `MinRelativeEyeHeight`: (float, cm) Minimum vertical offset **relative to the dropper’s eye position** when sampling spawn points (used by `DropItem`).
* `MaxRelativeEyeHeight`: (float, cm) Maximum vertical offset relative to the eye when sampling spawn points (used by `DropItem`).
* `MaxTries`: (int32) Max attempts to find a valid, non-overlapping location (used by `DropItem`).
* `InitialImpulse`: (FVector, cm/s) Initial impulse applied to the physics mesh after spawning (both `DropItem` and `DropItemAtLocation`).

### `ALyraWorldCollectable` Visuals, Interaction & Physics Lifecycle

The `ALyraWorldCollectable` actor now ships with dedicated mesh components and selects the active one at runtime, while keeping replication and interaction tight with the inventory.

* **Components & Replication:**
  * Pre-created components: `USkeletalMeshComponent` and `UStaticMeshComponent`, both replicated but with physics off by default.
  * `UMeshComponent* MeshComponent` points to the currently active visual component.
  * Actor replicates, but **movement replication is disabled** (settling finalizes pose).
  * Subobject replication includes each `ULyraInventoryItemInstance` in `StaticInventory.Instances` **and** any `UTransientRuntimeFragment` those instances own.
* **Inventory & Visuals (`SetPickupInventory`, `RebuildVisual`, `OnRep_StaticInventory`):**
  * `StaticInventory` is replicated; `OnRep_StaticInventory` triggers `RebuildVisual()` on clients.
  * `RebuildVisual()` selects the mesh from the item’s `UInventoryFragment_PickupItem` (instances preferred, then templates). If neither is present, falls back to `DefaultPlaceholderMesh`.
  * When a mesh is chosen:
    * Sets it on the corresponding component, enables **QueryAndPhysics** (during dynamic state), points `MeshComponent` to it, and calls `K2_OnMeshSet()` (Blueprint hook).
* **Interaction (`IInteractableTarget`):**
  * `GatherInteractionOptions_Implementation` returns a replicated `FInteractionOption` (`Option`).
  * On `BeginPlay`, if `Option.Text` is empty, it auto-populates:
    * Multiple templates ⇒ “Collect Items”.
    * Single template with valid `ItemDef` ⇒ “Collect {DisplayName}”.
    * Fallback ⇒ “Collect Item”.
* **Physics Simulation & Settling (`Tick`, `OnPhysicsSettled`):**
  * Server-only settling monitor using `bIsMonitoringPhysicsSettling`, `SettlingVelocityThresholdSq` (default 4 cm/s squared), and `SettlingTimeRequired` (default 0.5 s).
  * When settled:
    * Physics is turned **off**.
    * Collision becomes **QueryOnly** with:
      * Overlap: `Visibility`, `Camera`, `Lyra_TraceChannel_Interaction`, `Pawn`.
      * Block: `WorldStatic`, `WorldDynamic`.
      * Object type remains `WorldDynamic`.
    * Actor tick is disabled and movement remains non-replicated.
  * Helpers:
    * `IsMonitoringPhysicsSettling()` getter and `SetIsMoniteringPhysicsSettling(bool)` setter (server toggles monitoring).
    * `GetMeshComponent()`, `GetStaticInventory()`, `GetDefaultPlaceholderMesh()` accessors.
    * `K2_OnMeshSet()` Blueprint event fires right after a mesh is assigned.

### Full Workflow Example (Dropping, Settling & Picking Up)

1. **Drop Action (Server):**
   * Player triggers “Drop” (UI or Gameplay Ability).
   * Server resolves `ULyraInventoryItemInstance* DroppedItemInstance` from the player’s inventory.
   * Verifies `UInventoryFragment_PickupItem` exists; otherwise fails.
   * Removes item (or partial stack) from the inventory.
   * Calls either:
     * `UPickupableStatics::DropItem(PlayerActor, Pickup, ALyraWorldCollectable::StaticClass(), DropParams)` **or**
     * `UPickupableStatics::DropItemAtLocation(GameModeOrActor, Pickup, ALyraWorldCollectable::StaticClass(), TargetWorldLocation, DropParams, /*bProjectToGround=*/true)`
   * `SetPickupInventory` and `RebuildVisual()` configure visuals and physics; settling monitor is enabled.
2. **Physics Settling (Server-Side Only):**
   * Server `Tick` monitors velocity until below threshold for required time.
   * `OnPhysicsSettled()` finalizes collision/mobility and disables unnecessary replication/ticking.
3. **Interaction (Client → Server):**
   * Player looks at the static collectable and interacts.
   * Interaction system triggers a server ability/event targeting the collectable.
4. **Pickup Logic (Server):**
   * Server gets the `IPickupable` from the collectable.
   * Fetches the player’s `ULyraInventoryManagerComponent`.
   * Calls `Pickupable->AddPickupToInventory(PlayerInventory, WorldCollectable, OutStacked, OutNew)`.
   * On success (collectable inventory now empty), destroys the collectable; on partial/failed add, it remains with updated contents.
