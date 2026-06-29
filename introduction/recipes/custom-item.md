# Custom Item

## What you're building

A **consumable medkit** as the worked example, pick it up, click "Use" in the inventory, restore health, stack decrements.

The bigger goal: understand **items as a composition of fragments**. The medkit is one specific composition (Inventory Icon + Pickup + Consume); other items use different combinations. Once you see the pattern, you compose each item exactly to its role rather than trying to fit a one-size template.

By the end you'll know:

* How an item is built (it's not what you might expect, almost nothing lives on the Item Definition itself)
* Which fragment to add for which capability
* The full fragment menu and where each one is documented
* How a consumable activates and removes itself from the stack

> [!INFO]
> This recipe assumes you've completed the [Quick Start Guide](../quick-start-guide.md) and have a [Game Feature Plugin](../installing-and-setup.md) of your own. Build new items inside your plugin, not inside framework plugins.

***

## What an item is

An **Item Definition** is a thin data record. Almost every behaviour comes from the **fragments** you add to it. A fragment is a small, focused class that adds one capability to an item, "this item shows in the inventory," "this item is droppable," "this item can be consumed for an effect," "this item attaches to a host."

You build an item by deciding what it _does_, then adding the fragments that match. There's no "copy this folder" template that fits every case, no two items have quite the same shape. A bandage and a medkit might share most of their fragments; a medkit and a backpack share almost none. Pick from the fragment menu below for each item you build.

The only thing every inventoryable item must have is the **Inventory Icon Fragment**, without it, the item can't appear in the inventory UI. Everything else is optional and additive.

***

## The fragment menu

Add fragments to the Item Definition's `Fragments` array, one per capability. Most projects use a handful per item; a few items (guns) use many.

| Fragment                               | What it adds                                                                                                                        | When to add it                                                                                                                                                                       | Deep dive                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **`InventoryFragment_InventoryIcon`**  | Inventory icon, weight, max stack, background. The item appears in the inventory UI.                                                | Required for **any** item in an inventory.                                                                                                                                           | [Inventory Icon Fragment](../../base-lyra-modified/items/item-fragments-in-depth/inventory-icon-fragment.md)                      |
| **`InventoryFragment_PickupItem`**     | World-droppable; the item can be dropped from the inventory and picked up off the ground.                                           | Optional. Add if the item should leave the inventory.                                                                                                                                | [Pickup Item Fragment](../../base-lyra-modified/items/item-fragments-in-depth/pickup-item-fragment.md)                            |
| **`InventoryFragment_Consume`**        | A "Use" action in the item's context menu, wired to a Gameplay Ability that runs on use. The item is consumable.                    | For consumables, medkits, bandages, ammo packs, food, throwables triggered from the inventory.                                                                                       | [Consume Fragment](../../base-lyra-modified/items/item-fragments-in-depth/consumable-items/)                                      |
| **`InventoryFragment_QuickBarIcon`**   | Quickbar slot icon (separate from the inventory icon). The item displays in the quickbar when slotted.                              | For items that can be bound to a quickbar (held weapons, hotbar consumables).                                                                                                        | [Quick Bar Component](../../base-lyra-modified/equipment/quick-bar-component.md)                                                  |
| **`InventoryFragment_EquippableItem`** | Links the item to an Equipment Definition. Makes the item equippable.                                                               | For equipment, armour, shoes, weapons, anything the player wears or wields. See the [Custom Equipment Recipe](custom-equipment.md).                                                  | [Defining Equippable Items](../../base-lyra-modified/equipment/defining-equippable-items.md)                                      |
| **`InventoryFragment_SetStats`**       | Initial stat tag values applied to the item instance on creation.                                                                   | When the item has runtime stats, durability, charges, condition.                                                                                                                     | [Set Stats Fragment](../../base-lyra-modified/items/item-fragments-in-depth/set-stats-fragment.md)                                |
| **`InventoryFragment_Category`**       | Sorts the item into a category for the inventory UI's filter / tab system.                                                          | When the inventory UI groups items by category.                                                                                                                                      | [Category Fragment](../../base-lyra-modified/items/item-fragments-in-depth/category-fragment.md)                                  |
| **`InventoryFragment_Attachment`**     | The item exposes attachment slots, defines which item definitions can attach to each slot, and how each one behaves while attached. | For items that _host_ attachments (a rifle accepting a scope, a shield accepting a power crystal). The attachments themselves are normal items; this fragment only goes on the host. | [Attachment System](../../base-lyra-modified/items/item-fragments-in-depth/attachment-system/)                                    |
| **`InventoryFragment_Gun`**            | Ammo, magazine size, spare ammo. Gun-specific.                                                                                      | For guns. See the [Custom Weapon Recipe](custom-weapon.md).                                                                                                                          | [Gun Fragment](../../core-modules/shooter-base/weapons/gun-fragment/)                                                             |
| **`InventoryFragment_ReticleConfig`**  | Weapon reticle and ammo-counter widgets.                                                                                            | For weapons that show a crosshair.                                                                                                                                                   | [Reticle Fragment](../../base-lyra-modified/weapons/reticle-fragment.md)                                                          |
| **`InventoryFragment_Tetris`**         | Grid shape, the polyomino footprint the item occupies in a Tetris-style inventory.                                                  | When using the Tetris Inventory plugin.                                                                                                                                              | [InventoryFragment_Tetris](../../core-modules/tetris-inventory/item-fragments-tetris-specific/inventoryfragment_tetris.md)       |
| **`InventoryFragment_Container`**      | The item is itself a container, it holds other items inside it (a backpack, a briefcase, a pouch).                                  | For nested-inventory items.                                                                                                                                                          | [InventoryFragment_Container](../../core-modules/tetris-inventory/item-fragments-tetris-specific/inventoryfragment_container.md) |
| **`InventoryFragment_CraftRecipe`**    | The item is a crafting recipe / blueprint.                                                                                          | For craftable items in the Tetris plugin.                                                                                                                                            | [InventoryFragment_CraftRecipe](../../core-modules/tetris-inventory/item-fragments-tetris-specific/inventoryfragment_combine.md) |
| **`InventoryFragment_Inspect`**        | "Inspect" action that opens a 3D inspection view of the item.                                                                       | For items the player should be able to examine in 3D.                                                                                                                                | [InventoryFragment_Inspect](../../core-modules/tetris-inventory/item-fragments-tetris-specific/inventoryfragment_inspect.md)     |

If nothing in the menu fits a behaviour you need, write your own fragment, see [Creating Custom Fragments](../../base-lyra-modified/items/items-and-fragments/creating-custom-fragments.md). The fragment system is open and additive.

***

## Create A New Item

Five steps. Goal: a player picks up `ID_Medkit`, presses **Use** in the inventory, gains 50 HP, and the stack decrements by one. When the stack reaches zero, the item is removed.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Item Definition + Inventory Icon Fragment

Create a new **Lyra Inventory Item Definition** asset (e.g. `ID_Medkit`). On the **Fragments** array, add an **`InventoryFragment_InventoryIcon`**.

Configure it:

* **Inventory Icon** — the icon texture shown in the inventory grid
* **Display Name** — "Medkit"
* **Weight** — How heavy the medkit is
* **Max Stack Size** — how many medkits stack into one slot (e.g. 5)
* **Background Color / Frame -** The background color of the icon

This is the fragment that makes the item _real_ from the inventory's perspective. Skip this and the medkit can technically exist as a data asset, but it can't be added to an inventory or shown in the UI.

<img src=".gitbook/assets/image (310).png" alt="" title="">
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Pickup Fragment (optional, but typical for medkits)

Add **`InventoryFragment_PickupItem`** to the Fragments array. Configure the world mesh / pickup actor so the medkit appears as a pickup-able object when dropped into the world.

Skip this fragment if the medkit should _not_ be droppable, e.g. it's only ever granted as a starting inventory item or via a vendor, and shouldn't end up on the floor.

Reference: [Pickup Item Fragment](../../base-lyra-modified/items/item-fragments-in-depth/pickup-item-fragment.md), [Pickup System](../../base-lyra-modified/items/world-interaction-and-global-management/pickup-system.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Heal Gameplay Effect (`GE_Heal_Medkit`)

Create a new Gameplay Effect asset. Configure it to add 40 to the player's Health attribute on application. Use an **Instant** duration so the heal applies once and finishes.

<img src=".gitbook/assets/image (311).png" alt="" title="">

Reference: [Gameplay Effects](../../base-lyra-modified/gas/gameplay-effects.md), [Damage and Healing](../../base-lyra-modified/gas/damage-and-healing.md).
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Consume ability (`GA_Consume_Medkit`)

Create a new Gameplay Ability. **Subclass `ULyraGameplayAbility_FromConsume`**, this is the base class for abilities triggered by a Consume Fragment. It handles the wiring between the inventory's "Use" action and your effect logic.

In `ActivateAbility` (Blueprint or C++):

1. Apply `GE_Heal_Medkit` to the player.
2. Optionally, play a use animation, sound, or particle.
3. Call **`ConsumeItem()`** when the heal should "cost" a medkit. This is the call that decrements the stack. The system handles removal automatically when the stack reaches zero.
4. Call **`EndAbility()`** to release the ability. Without this, the consume system locks and the player can't use other consumables.

<img src=".gitbook/assets/image (312).png" alt="" title="">

Reference: [Consumable Items](../../base-lyra-modified/items/item-fragments-in-depth/consumable-items/).
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Consume Fragment

Open `ID_Medkit` and add **`InventoryFragment_Consume`** to the Fragments array. Configure:

* **Ability To Activate** → `GA_Consume_Medkit`
* **Amount To Consume** → `1` (one stack per use)
* **Finish Policy** → `BlockOtherConsumes` (medkits typically have a brief windup; you don't want the player spamming heal)
* **Action Display Name** → `"Use"` (or `"Apply"` for bandages, `"Inject"` for syringes, the inventory's Use button shows this label)

<img src=".gitbook/assets/image (313).png" alt="" title="">

That's the entire wiring. The framework adds a "Use" button to the medkit's context menu in the inventory, hooks it to the activation flow, and handles the stack decrement when your ability calls `ConsumeItem()`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Verify

1. Get `ID_Medkit` to the player: add it to the **Inventory Manager Component's `DefaultStartingItems`**, or place a **`WorldCollectableSpawner`** in your level configured with `ID_Medkit` so the player can pick it up.
2. Launch your Experience in PIE.
3. Take damage so health is below max.
4. Open the inventory, right-click the medkit, select **Use**.
5. Confirm: health restores by 40, stack decrements by one, and when stack reaches zero the medkit is removed from the inventory.

If the Use button doesn't appear, the Consume Fragment isn't pointing at the right ability or the ability isn't a subclass of `ULyraGameplayAbility_FromConsume`. If the stack doesn't decrement, the ability isn't calling `ConsumeItem()`. If the consume system locks (subsequent uses fail), the ability isn't calling `EndAbility()`.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Other item shapes

The medkit's composition is `InventoryIcon` + `Pickup` + `Consume`. Other items use different combinations of the same fragment menu:

* **Crafting material** — `InventoryIcon` + `Category`. Exists in the inventory; gets carried; gets spent by a recipe somewhere else. No pickup if granted-only, no consume. Examples: scrap metal, wire.
* **Container item** — `InventoryIcon` + `Container` + `Pickup`. The container fragment turns the item itself into an inventory that holds nested items. Examples: `Pouch`, `SecureBriefcase`, `LargeBackpack` in `Plugins/GameFeatures/TetrisInventory/Content/Demo/Items/`.
* **Item with attachment slots** — `InventoryIcon` + `Attachment` + `Pickup`. The Attachment Fragment defines what slots the item exposes, which item definitions can attach to each slot, and how each attached item behaves while attached. Attachments themselves are just normal items, they don't need a special fragment. Example: `KineticShield` in `Plugins/GameFeatures/TetrisInventory/Content/Demo/Items/` exposes a slot that accepts `PowerCrystal`.
* **Equipment item** — `InventoryIcon` + `EquippableItem` plus whatever else fits. The Equipment Definition handles the rest; see the [Custom Equipment Recipe](custom-equipment.md). Examples: rocket shoes, vortex armour, all weapons.
* **Inspectable item** — your other fragments _plus_ `Inspect`, for a 3D inspection view. Layers on top of any other shape.
* **Gun** — `InventoryIcon` + `EquippableItem` + `Gun` + `ReticleConfig` + `QuickBarIcon` + `Pickup`. The most fragment-heavy shape; see the [Custom Weapon Recipe](custom-weapon.md).

**The pattern.** Every item is its own composition of the same fragment menu, there's no fixed taxonomy of item types. Don't ask "what _kind_ of item is this?" Ask "what capabilities does it need?"

***

## Common pitfalls

* **Forgetting the Inventory Icon Fragment.** The most common silent failure. The item exists as a data asset, can be granted, can be referenced, but never appears in any inventory UI. Every inventoryable item needs this fragment.
* **Wrong fragment for the capability.** Each fragment in the menu provides one specific behaviour. Pick the one that names the capability you're after. If nothing in the menu fits, write a custom fragment rather than coercing an existing one into a role it wasn't designed for.
* **Authoring items inside framework plugins.** Always work inside _your own_ Game Feature Plugin. Items in `Source/LyraGame/...`, `ShooterBase`, `TetrisInventory`, or any other framework plugin are framework code; your changes will fight future updates.

For per-fragment configuration nuances (Consume's Finish Policy and the use-and-decrement contract, Attachment's slot system, Tetris's grid shape, etc.), each fragment's own doc covers its specific gotchas, follow the links in the fragment menu above.

***

## How to extend further

* **Custom fragments** — when no existing fragment fits, write your own. The fragment system is open. See [Creating Custom Fragments](../../base-lyra-modified/items/items-and-fragments/creating-custom-fragments.md).
* **Transient data on instances** — when an item needs runtime state that varies per instance (charges remaining, durability percentage, custom modifiers), see [Transient Data Fragments](../../base-lyra-modified/items/items-and-fragments/transient-data-fragments.md) and [Transient Runtime Fragments](../../base-lyra-modified/items/items-and-fragments/transient-runtime-fragments.md).
* **Stat tags on items** — items carry runtime numeric values via Stat Tags. See [Stat Tags](../../base-lyra-modified/items/items-and-fragments/stat-tags.md).
* **World pickups customization** — the visual representation of an item dropped on the ground. See [Pickup System](../../base-lyra-modified/items/world-interaction-and-global-management/pickup-system.md), [Dropping Items](../../base-lyra-modified/items/world-interaction-and-global-management/dropping-items-and-world-collectable-lifecycle.md), [Client Predicted Pickup Ability](../../base-lyra-modified/items/world-interaction-and-global-management/client-predicted-pickup-ability.md).
* **The Item Subsystem** — runtime queries across all items in the game. See [Item Subsystem](../../base-lyra-modified/items/world-interaction-and-global-management/item-subsystem.md)
* **Inventory UI rendering** — once you have items, the [Item Container UI System](../../base-lyra-modified/ui/item-container-ui-system/) handles displaying them. The [Custom HUD Widget Recipe](custom-hud-widget.md) covers how widgets bind to game state.

When you're ready for a different system, head back to the [Recipes](./).
