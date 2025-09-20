# Pickup System

This section details the system used to represent inventory items physically within the game world and allow players to pick them up. It relies on the `IPickupable` interface and provides `ALyraWorldCollectable` as a ready-to-use example actor for _editor placement_ and serving as the target for the dropping system.

### The `IPickupable` Interface

The `IPickupable` interface (`UINTERFACE`) defines a standard contract for any Actor or Actor Component that represents one or more items available for pickup in the world.

**Purpose:**

* **Standardization:** Provides a common way for interaction systems or pickup logic to query available items and attempt to transfer them to an inventory.
* **Flexibility:** Can be implemented by Actors directly (like `ALyraWorldCollectable`) or by Actor Components, allowing different world entities (chests, enemy drops, static meshes) to offer items for pickup.

**Key Functions:**

* `GetPickupInventory() (virtual)`
  * **Returns:** A reference (`FInventoryPickup&`) to the struct holding the item data available for pickup.
  * **Implementation:** The implementing class must provide access to its internal `FInventoryPickup` storage.
* `AddPickupToInventory(ULyraInventoryManagerComponent* InventoryComponent, AActor* Actor, TArray<ULyraInventoryItemInstance*>& OutStackedItems, TArray<ULyraInventoryItemInstance*>& OutNewItems) (virtual, Authority Only)`
  * **Action:** Attempts to transfer _all_ items contained within the `IPickupable`'s `FInventoryPickup` into the provided `InventoryComponent`.
  * **Logic:**
    1. Calls `GetPickupInventory()` to get the item data.
    2. Iterates through the `Templates` and `Instances` within the `FInventoryPickup`.
    3. For each, calls `InventoryComponent->TryAddItemDefinition()` or `InventoryComponent->TryAddItemInstance()`.
    4. If an item is successfully added (fully or partially), it updates or removes the corresponding entry from the internal `FInventoryPickup` data.
    5. Handles replication cleanup for any `ItemInstance`s successfully transferred (using `Actor->RemoveReplicatedSubObject`).
    6. Broadcasts `ItemObtained` messages via the `InventoryComponent`.
  * **Returns:** `true` if the `FInventoryPickup` is now empty (meaning the pickup actor can likely be destroyed), `false` otherwise.
  * **`OutStackedItems`, `OutNewItems`:** Populated by the `TryAdd...` calls.
* `AddSubsetToInventory(...) (virtual, Authority Only)`
  * **Action:** Attempts to transfer only a _specific subset_ of items (defined by input arrays of `FPickupTemplate` and `FPickupInstance`) from the `IPickupable`'s inventory into the target `InventoryComponent`.
  * **Logic:** Similar to `AddPickupToInventory` but only processes the specified subset, checking against the full internal `FInventoryPickup` to ensure the items actually exist before attempting the transfer. Updates the internal `FInventoryPickup` accordingly.
  * **Use Case:** Scenarios where only specific items should be picked up from a larger collection (e.g., looting specific items from a container UI instead of taking all).
  * **Returns:** `true` if the internal `FInventoryPickup` becomes empty after the transfer, `false` otherwise.

**Data Structures:**

* `FInventoryPickup`: The main container struct held by `IPickupable` implementers.
  * `Instances` (`TArray<FPickupInstance>`): Holds items represented by existing `ULyraInventoryItemInstance` objects (typically items dropped by a player).
  * `Templates` (`TArray<FPickupTemplate>`): Holds items defined by templates (Item Definition + Stack Count), used for pre-placed loot or generated drops where a full instance isn't needed until pickup.
* `FPickupInstance`: Wrapper struct containing `TObjectPtr<ULyraInventoryItemInstance> Item`.
* `FPickupTemplate`: Wrapper struct containing `TSubclassOf<ULyraInventoryItemDefinition> ItemDef` and `int32 StackCount`.

### The `ALyraWorldCollectable` Actor

This class provides a ready-to-use implementation of a world pickup actor.

**Features:**

* **Inheritance:** Inherits from `AActor`, `IInteractableTarget`, and `IPickupable`.
* **Storage:** Contains a replicated `FInventoryPickup` property named `StaticInventory` to hold the item data.
* **Interaction:** Implements `GatherInteractionOptions_Implementation` to provide interaction options (like "Collect Item") to the player interaction system. The default text is often derived from the item's `DisplayName`.
* **Pickup Logic:** Implements `GetPickupInventory` to return its `StaticInventory`. Interaction logic (likely within a Gameplay Ability triggered by interaction) would typically call `AddPickupToInventory` on this actor.
* **Visuals:** Designed to display a mesh. The actual `UStaticMeshComponent` or `USkeletalMeshComponent` is dynamically created at runtime within the actor based on the `StaticMesh` or `SkeletalMesh` properties found in the `InventoryFragment_PickupItem` on the item definition. This allows a single `ALyraWorldCollectable` actor to represent items with different mesh types (static or skeletal) seamlessly. The `DisplayName` from the fragment might also be used for the interaction text. For comprehensive details on how the mesh is created, managed, and its physics behavior, refer to the \[Dropping Items & World Collectable Lifecycle] documentation.
* **Replication:** Replicates `StaticInventory`. Crucially, it overrides `ReplicateSubobjects` to ensure any `ULyraInventoryItemInstance`s stored within `StaticInventory.Instances` are properly replicated as subobjects to clients. It also uses `AddReplicatedSubObject` when instances are added via `SetPickupInventory`. The dynamically created mesh component (`FPooledMesh`) is also replicated.

### Role of `InventoryFragment_PickupItem`

While not strictly enforced by the `IPickupable` interface itself, the `InventoryFragment_PickupItem` plays a key role in the _intended workflow_ for representing items in the world:

* **Defines World Appearance:** This fragment, added to an `ULyraInventoryItemDefinition`, stores the `StaticMesh` or `SkeletalMesh`, `MeshOffset`, `DisplayName` (for world context), and `PadColor` used when representing this item type as a physical object in the world (typically via `ALyraWorldCollectable`).
* **Enables Dropping (Implicitly):** Systems responsible for dropping items from an inventory into the world will typically check if the item instance's definition _has_ this fragment. If it doesn't, the system may assume the item cannot be dropped or represented physically and prevent the action. If it _does_ have the fragment, the system uses the fragment's properties to spawn and configure the `ALyraWorldCollectable` (or similar pickup actor). This fragment is essential for any item intended to be physically present and interactable in the world.

**In short:** Add `InventoryFragment_PickupItem` to items that players should be able to drop or that should have a specific physical mesh when placed in the world as a pickup.

### Workflow Example (Picking Up)

1. **Interaction (Client -> Server):**
   * Player looks at the `ALyraWorldCollectable` and presses the interact key.
   * Interaction system triggers a Gameplay Event/Ability on the server.
2. **Pickup Logic (Server):**
   * The server-side pickup ability gets the `ALyraWorldCollectable` actor that was interacted with.
   * It gets the `IPickupable` interface from the actor.
   * It gets the interacting player's `ULyraInventoryManagerComponent` (`PlayerInventory`).
   * It calls `Pickupable->AddPickupToInventory(PlayerInventory, WorldCollectable, OutStacked, OutNew)`.
   * `AddPickupToInventory` attempts to transfer the items defined in the `ALyraWorldCollectable`'s `FInventoryPickup` into `PlayerInventory` using `TryAddItemDefinition` or `TryAddItemInstance`.
   * If items are successfully added, they are removed from the `ALyraWorldCollectable`'s `FInventoryPickup`.
   * If the `FInventoryPickup` becomes empty (meaning all items were picked up), `AddPickupToInventory` returns `true`, signaling that the `ALyraWorldCollectable` actor can likely be destroyed.
   * If unsuccessful (e.g., inventory full), the `ALyraWorldCollectable` remains, potentially with fewer items if partially picked up.

***

The `IPickupable` interface and `ALyraWorldCollectable` actor provide the standard mechanism for items to exist and be interacted with in the game world, bridging the gap between the abstract inventory system and the physical level environment. The `InventoryFragment_PickupItem` is the key data source for defining _how_ an item appears when it takes this physical form.
