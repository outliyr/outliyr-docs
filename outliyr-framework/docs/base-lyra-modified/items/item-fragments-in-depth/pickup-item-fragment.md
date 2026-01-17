# Pickup Item Fragment

When an item needs to exist physically in the game world, either placed intentionally or dropped by a player, the `UInventoryFragment_PickupItem` defines how it should look and potentially some basic display information for interaction prompts.

### Purpose

* **World Visuals:** Specifies the Static Mesh or Skeletal Mesh used to visually represent this item type when it's an actor in the world (typically via `AWorldCollectableBase` subclasses or a similar actor implementing `IPickupable`).
* **Appearance Customization:** Allows defining mesh offsets/transforms and potentially a specific display name to use when the item is in its physical world form.
* **Interaction Hint:** Can provide data (like `DisplayName` or `PadColor`) that interaction systems might use when generating prompts for picking up the item.
* **Enabling Dropping:** Systems that handle dropping items from an inventory often check for the presence of this fragment on the item's definition. If the fragment is missing, the system may prevent the item from being dropped, assuming it has no defined physical representation.

### Static Configuration (`UInventoryFragment_PickupItem`)

You configure the world appearance by adding this fragment to an `ULyraInventoryItemDefinition`:

<figure><img src="../../../.gitbook/assets/image (74).png" alt=""><figcaption></figcaption></figure>

{% stepper %}
{% step %}
#### Add fragment

Add `InventoryFragment_PickupItem` to the Item Definition's `Fragments` array.
{% endstep %}

{% step %}
#### Key properties

* `SkeletalMesh` (`TObjectPtr<USkeletalMesh>`): The skeletal mesh to use if the world representation should be animated or use physics simulation based on a skeletal structure. Usually only one of `SkeletalMesh` or `StaticMesh` is set.
* `StaticMesh` (`TObjectPtr<UStaticMesh>`): The static mesh to use for the world representation. Common for simple objects like ammo boxes, potions, or non-animated gear.
* `MeshOffset` (`FTransform`): A relative transform (translation, rotation, scale) applied to the mesh component after it's attached to the root of the world pickup actor. Useful for adjusting pivot points or default orientations.
* `DisplayName` (`FText`): A specific name to potentially display in interaction prompts when looking at the item in the world (e.g., "Pick up Rifle Ammo"). This can differ from the main `DisplayName` on the Item Definition itself if needed.
* `PadColor` (`FLinearColor`): An optional color value, potentially used by interaction UI elements or highlighting systems associated with the pickup.
{% endstep %}
{% endstepper %}

Example configurations

* ID\_Ammo\_RifleBox:
  * `Fragments`:
    * `[index]`: `InventoryFragment_PickupItem`
      * `SkeletalMesh`: `null`
      * `StaticMesh`: `SM_AmmoBox_Rifle`
      * `MeshOffset`: (Default Transform)
      * `DisplayName`: "Rifle Ammunition"
      * `PadColor`: (Default Color)
* ID\_Rifle\_Standard:
  * `Fragments`:
    * `[index]`: `InventoryFragment_PickupItem`
      * `SkeletalMesh`: `null`
      * `StaticMesh`: `SM_Rifle_Standard_Dropped` (A specific mesh for the dropped state)
      * `MeshOffset`: (Maybe slightly rotated for a natural look)
      * `DisplayName`: "Standard Rifle"
      * `PadColor`: (Default Color)

### Runtime Interaction

This fragment primarily stores static data. Its main interaction happens when an item is dropped or placed into the world:

{% stepper %}
{% step %}
#### Drop/Spawn Logic

The system responsible for creating the world pickup (e.g., code handling item dropping from inventory, or level design placing loot) retrieves the `ULyraInventoryItemInstance` to be represented.
{% endstep %}

{% step %}
#### Fragment check

It calls `ItemInstance->FindFragmentByClass<UInventoryFragment_PickupItem>()`.
{% endstep %}

{% step %}
#### Actor creation (if fragment found)

* The system determines whether to spawn `AWorldCollectable_Static` or `AWorldCollectable_Skeletal` based on the fragment's mesh type.
* It reads the `StaticMesh` or `SkeletalMesh` property from the fragment.
* The spawned actor's `RebuildVisual()` sets the mesh component using the retrieved mesh asset.
* It applies the `MeshOffset` transform to the mesh component.
* It might use the `DisplayName` from the fragment to configure the interaction prompt data on the spawned actor.
* It populates the spawned actor's `IPickupable` inventory (`FItemPickup`) with the `ItemInstance` being dropped/placed.
{% endstep %}
{% endstepper %}

{% hint style="info" %}
Importance:

* Visual Representation: Without this fragment, items dropped or placed in the world won't have a defined mesh or appearance.
* Droppability: Game logic often uses the presence of this fragment as a prerequisite for allowing an item to be dropped from an inventory.
{% endhint %}

***

### Action Menu Integration

This fragment implements `IItemActionProvider` to add a **Drop** action to the item's context menu.

| Action   | Tag                 | Quantity Input   |
| -------- | ------------------- | ---------------- |
| **Drop** | `Ability.Item.Drop` | Yes (for stacks) |

**When enabled:** The action is enabled when the item has either a `SkeletalMesh` or `StaticMesh` defined. Without a mesh, the item cannot exist in the world, so dropping is not possible.

**Quantity prompt:** For stackable items with a stack count > 1, the player is prompted to choose how many to drop:

* `MinQuantity`: 1
* `MaxQuantity`: Current stack count

This allows players to drop part of a stack (e.g., drop 10 of 30 bullets) rather than the entire stack.

{% hint style="info" %}
For the full action menu system, see [Context Menus & Action Logic](../../ui/item-container-ui-system/interaction-and-transactions/context-menus-and-action-logic.md).
{% endhint %}

***

The `InventoryFragment_PickupItem` provides the essential link between an abstract inventory item definition and its tangible, visual representation when present as an interactable object within the game world. Configure it for any item that needs to be seen and picked up from the level.
