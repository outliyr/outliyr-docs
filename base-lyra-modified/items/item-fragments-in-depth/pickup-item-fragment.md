# Pickup Item Fragment

When an item needs to exist physically in the game world – either placed intentionally or dropped by a player – the `UInventoryFragment_PickupItem` defines how it should look and potentially some basic display information for interaction prompts.

### Purpose

* **World Visuals:** Specifies the Static Mesh or Skeletal Mesh used to visually represent this item type when it's an actor in the world (typically via `ALyraWorldCollectable` or a similar actor implementing `IPickupable`).
* **Appearance Customization:** Allows defining mesh offsets/transforms and potentially a specific display name to use when the item is in its physical world form.
* **Interaction Hint:** Can provide data (like `DisplayName` or `PadColor`) that interaction systems might use when generating prompts for picking up the item.
* **Enabling Dropping:** Systems that handle dropping items from an inventory often check for the presence of this fragment on the item's definition. If the fragment is missing, the system may prevent the item from being dropped, assuming it has no defined physical representation.

### Static Configuration (`UInventoryFragment_PickupItem`)

You configure the world appearance by adding this fragment to an `ULyraInventoryItemDefinition`:

<img src=".gitbook/assets/image (74).png" alt="" title="">

1. **Add Fragment:** Add `InventoryFragment_PickupItem` to the Item Definition's `Fragments` array.
2. **Key Properties:**
   * **`SkeletalMesh` (`TObjectPtr<USkeletalMesh>`)**: The skeletal mesh to use if the world representation should be animated or use physics simulation based on a skeletal structure. Usually, only one of `SkeletalMesh` or `StaticMesh` is set.
   * **`StaticMesh` (`TObjectPtr<UStaticMesh>`)**: The static mesh to use for the world representation. This is common for simple objects like ammo boxes, potions, or non-animated gear.
   * **`MeshOffset` (`FTransform`)**: A relative transform (translation, rotation, scale) applied to the mesh component _after_ it's attached to the root of the world pickup actor (e.g., `ALyraWorldCollectable`). Useful for adjusting pivot points or default orientations.
   * **`DisplayName` (`FText`)**: A specific name to potentially display in interaction prompts when looking at the item in the world (e.g., "Pick up Rifle Ammo"). This can differ from the main `DisplayName` on the Item Definition itself if needed.
   * **`PadColor` (`FLinearColor`)**: An optional color value, potentially used by interaction UI elements or highlighting systems associated with the pickup.

_Example Configuration (`ID_Ammo_RifleBox`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_PickupItem`
    * `SkeletalMesh`: `null`
    * `StaticMesh`: `SM_AmmoBox_Rifle`
    * `MeshOffset`: (Default Transform)
    * `DisplayName`: "Rifle Ammunition"
    * `PadColor`: (Default Color)

_Example Configuration (`ID_Rifle_Standard`):_

* `Fragments`:
  * `[index]`: `InventoryFragment_PickupItem`
    * `SkeletalMesh`: `null`
    * `StaticMesh`: `SM_Rifle_Standard_Dropped` (A specific mesh for the dropped state)
    * `MeshOffset`: (Maybe slightly rotated for a natural look)
    * `DisplayName`: "Standard Rifle"
    * `PadColor`: (Default Color)

### Runtime Interaction

This fragment primarily stores static data. Its main interaction happens when an item is dropped or placed into the world:

1. **Drop/Spawn Logic:** The system responsible for creating the world pickup (e.g., code handling item dropping from inventory, or level design placing loot) retrieves the `ULyraInventoryItemInstance` to be represented.
2. **Fragment Check:** It calls `ItemInstance->FindFragmentByClass<UInventoryFragment_PickupItem>()`.
3. **Actor Creation:** If the fragment is found:
   * It spawns an actor capable of representing the pickup (e.g., `ALyraWorldCollectable`).
   * It reads the `StaticMesh` or `SkeletalMesh` property from the fragment.
   * It sets the mesh component on the spawned actor using the retrieved mesh asset.
   * It applies the `MeshOffset` transform to the mesh component.
   * It might use the `DisplayName` from the fragment to configure the interaction prompt data on the spawned actor.
   * It populates the spawned actor's `IPickupable` inventory (`FInventoryPickup`) with the `ItemInstance` being dropped/placed.
4. **Interaction System:** The interaction system, when querying the world actor (`ALyraWorldCollectable`), might read the `DisplayName` or `PadColor` from the fragment (by getting the item instance from the pickupable data and finding its fragment) to customize interaction widgets.

### Importance

* **Visual Representation:** Without this fragment (or a similar custom solution), items dropped or placed in the world won't have a defined mesh or appearance.
* **Droppability:** As mentioned, game logic often uses the presence of this fragment as a prerequisite for allowing an item to be dropped from an inventory.

***

The `InventoryFragment_PickupItem` provides the essential link between an abstract inventory item definition and its tangible, visual representation when present as an interactable object within the game world. Configure it for any item that needs to be seen and picked up from the level.
