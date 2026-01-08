# Pickup System

This section details the system used to represent inventory items physically within the game world and allow players to pick them up. It relies on the `IPickupable` interface and provides `AWorldCollectableBase` as the abstract base class for world pickup actors.

### The `IPickupable` Interface

The `IPickupable` interface (`UINTERFACE`) defines a standard contract for any Actor or Actor Component that represents one or more items available for pickup in the world.

Purpose

* **Standardization**: Provides a common way for interaction systems or pickup logic to query available items and attempt to transfer them to an inventory.
* **Flexibility**: Can be implemented by Actors directly (like `AWorldCollectableBase` subclasses) or by Actor Components, allowing different world entities (chests, enemy drops, static meshes) to offer items for pickup.

Key Functions

* `GetPickupItem() (virtual)`
  * Returns: A reference (`FItemPickup&`) to the struct holding the item data available for pickup.
  * Implementation: The implementing class must provide access to its internal `FItemPickup` storage.
* `AddPickupToInventory(Container, Actor, OutStackedItems, OutNewItems) (virtual, Authority Only)`
  * Action: Attempts to transfer all items contained within the `IPickupable`'s `FItemPickup` into the provided container.
  * Logic:
    1. Calls `GetPickupItem()` to get the item data.
    2. Iterates through the `Templates` and `Instances` within the `FItemPickup`.
    3. Merges stack quantities into existing items in the container where possible.
    4. Creates new items via `ULyraItemSubsystem` for overflow quantities.
    5. If an item is successfully added (fully or partially), it updates or removes the corresponding entry from the internal `FItemPickup` data.
    6. Handles replication cleanup for any `ItemInstance`s successfully transferred.
  * Returns: `true` if the `FItemPickup` is now empty (meaning the pickup actor can likely be destroyed), `false` otherwise.
  * `OutStackedItems`, `OutNewItems`: Populated with items that received stack increases and newly created items respectively.
* `AddSubsetToInventory(...) (virtual, Authority Only)`
  * Action: Attempts to transfer only a specific subset of items (defined by input arrays of `FPickupTemplate` and `FPickupInstance`) from the `IPickupable`'s inventory into the target container.
  * Logic: Similar to `AddPickupToInventory` but only processes the specified subset, checking against the full internal `FItemPickup` to ensure the items actually exist before attempting the transfer.
  * Use Case: Scenarios where only specific items should be picked up from a larger collection (e.g., looting specific items from a container UI instead of taking all).
  * Returns: `true` if the internal `FItemPickup` becomes empty after the transfer, `false` otherwise.

Data Structures

* `FItemPickup`: The main container struct held by `IPickupable` implementers.
  * `Instances` (`TArray<FPickupInstance>`): Holds items represented by existing `ULyraInventoryItemInstance` objects (typically items dropped by a player).
  * `Templates` (`TArray<FPickupTemplate>`): Holds items defined by templates (Item Definition + Stack Count), used for pre-placed loot or generated drops where a full instance isn't needed until pickup.
* `FPickupInstance`: Wrapper struct containing `TObjectPtr<ULyraInventoryItemInstance> Item`.
* `FPickupTemplate`: Wrapper struct containing `TSubclassOf<ULyraInventoryItemDefinition> ItemDef` and `int32 StackCount`.

***

### The World Collectable Actor Hierarchy

The world collectable system uses an abstract base class with concrete subclasses for different mesh types.

#### `AWorldCollectableBase` (Abstract)

The abstract base class providing common functionality for all world collectables.

Features

* Inheritance: Inherits from `AActor`, `IInteractableTarget`, and `IPickupable`.
* Storage: Contains a replicated `FItemPickup` property named `StaticInventory` to hold the item data.
* Interaction Profile: Uses `UPickupInteractionProfile` to configure interaction options.
* Interaction Widget: Contains an `InteractionWidgetComponent` for displaying interaction UI in world space.
* Physics Settling: Server-side monitoring to detect when items have settled and should stop simulating physics.
* Pure Virtual Methods: Subclasses must implement:
  * `GetMeshComponent()` - Returns the active mesh component.
  * `RebuildVisual()` - Rebuilds the visual representation from inventory data.

Key Properties

* `InteractionProfile` (`UPickupInteractionProfile*`): Data asset configuring interaction options.
* `InteractionWidgetComponent` (`UWidgetComponent*`): Widget for interaction dot/icon display.
* `DefaultInteractionWidgetClass`: The widget class to use for the interaction dot.
* `InteractionDotOffset` (`FVector`): Manual offset for the interaction widget position.
* `StaticInventory` (`FItemPickup`): The replicated inventory this collectable represents.
* `SettlingVelocityThresholdSq`: Squared velocity threshold for settling detection (default: 16 cm²/s²).
* `SettlingTimeRequiredSeconds`: Time below threshold before freezing physics (default: 0.5s).

#### `AWorldCollectable_Static`

Concrete subclass for items with static meshes.

Features

* Contains a `UStaticMeshComponent` named `StaticRoot`.
* Implements `GetMeshComponent()` to return `StaticRoot`.
* Implements `RebuildVisual()` to set the static mesh from the item's `UInventoryFragment_PickupItem`.
* Has `DefaultPlaceholderMesh` for when no fragment mesh is found.

#### `AWorldCollectable_Skeletal`

Concrete subclass for items with skeletal meshes.

Features

* Contains a `USkeletalMeshComponent` named `SkeletalRoot`.
* Implements `GetMeshComponent()` to return `SkeletalRoot`.
* Implements `RebuildVisual()` to set the skeletal mesh from the item's `UInventoryFragment_PickupItem`.

***

### Interaction Profile System

The `UPickupInteractionProfile` data asset provides configurable interaction behavior for world collectables.

`EOptionTextMode` (Enum)

* `FromInventoryDisplayName`: Derives text from the item's display name.
* `FixedText`: Uses a fixed text string.
* `FormatString`: Uses a format string with tokens like `{ItemName}` and `{Count}`.

`FProfileOptionSpec` (Struct)

* `TextMode`: How to generate the interaction text.
* `FixedText`: Fixed text when `TextMode == FixedText`.
* `FormatString`: Format string with token support when `TextMode == FormatString`.
* `InteractionTime`: How long the interaction takes (0 for instant).
* `InteractionAbilityToGrant`: Gameplay ability granted when interacting.
* `InteractionWidgetClass`: Optional per-option widget class.

`UPickupInteractionProfile` (Data Asset)

* `Options`: Array of `FProfileOptionSpec` defining available interaction options.
* `ResolveCustomOptionText()`: Blueprint-overridable hook for custom text logic.

***

### Role of `InventoryFragment_PickupItem`

The `InventoryFragment_PickupItem` plays a key role in the intended workflow for representing items in the world:

* Defines World Appearance: This fragment, added to an `ULyraInventoryItemDefinition`, stores the `StaticMesh` or `SkeletalMesh`, `MeshOffset`, `DisplayName` (for world context), and `PadColor` used when representing this item type as a physical object.
* Determines Collectable Class: The presence of a `SkeletalMesh` vs `StaticMesh` determines whether `AWorldCollectable_Skeletal` or `AWorldCollectable_Static` is spawned.
* Enables Dropping (Implicitly): Systems responsible for dropping items typically check if the item's definition has this fragment. If it doesn't, the system may assume the item cannot be dropped or represented physically.

***

### Workflow Example (Picking Up)

{% stepper %}
{% step %}
#### Interaction (Client -> Server)

* Player looks at the `AWorldCollectableBase` and presses the interact key.
* Interaction system triggers a Gameplay Event/Ability on the server.
{% endstep %}

{% step %}
#### Pickup Logic (Server)

* The server-side pickup ability gets the collectable actor that was interacted with.
* It gets the `IPickupable` interface from the actor.
* It gets the interacting player's inventory container.
* It calls `Pickupable->AddPickupToInventory(Container, WorldCollectable, OutStacked, OutNew)`.
* `AddPickupToInventory` attempts to transfer the items defined in the collectable's `FItemPickup` into the container, merging with existing stacks or creating new items via `ULyraItemSubsystem`.
* If items are successfully added, they are removed from the collectable's `FItemPickup`.
* If the `FItemPickup` becomes empty (meaning all items were picked up), `AddPickupToInventory` returns `true`, signaling that the collectable actor can likely be destroyed.
* If unsuccessful (e.g., inventory full), the collectable remains, potentially with fewer items if partially picked up.
{% endstep %}
{% endstepper %}

***

The `IPickupable` interface and `AWorldCollectableBase` hierarchy provide the standard mechanism for items to exist and be interacted with in the game world, bridging the gap between the abstract inventory system and the physical level environment. The `InventoryFragment_PickupItem` is the key data source for defining how an item appears when it takes this physical form.
