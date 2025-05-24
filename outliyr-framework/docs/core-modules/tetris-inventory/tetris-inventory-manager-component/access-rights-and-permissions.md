# Access Rights & Permissions

Managing who can see and interact with inventories is critical, especially with nested containers. The `ULyraTetrisInventoryManagerComponent` leverages the existing Access Rights and Permissions system established in the base `ULyraInventoryManagerComponent` but applies it consistently across the inventory hierarchy.

### Core Principle: Delegation to Base Inventory

The fundamental principle for access control in the Tetris system is that **permissions and access rights are typically determined by the root (base) inventory container.** A child inventory (like the one inside a backpack item) doesn't usually define its own independent access rules; instead, it inherits or defers to the rules of the ultimate owner's inventory (e.g., the player's main inventory component).

### Overridden Getters

To enforce this principle, the `ULyraTetrisInventoryManagerComponent` overrides the key access control functions:

* **`GetInventoryAccessRight(APlayerController* PlayerController)` Override:**
  1. Calls `GetBaseInventory()` to traverse up the `ParentInventory` chain and find the root `ULyraTetrisInventoryManagerComponent` (the one with no parent).
  2. Calls the **base implementation** (`ULyraInventoryManagerComponent::GetInventoryAccessRight`) on that **root component**, passing the `PlayerController`.
  3. Returns the result obtained from the root component.
* **`GetInventoryPermissions(APlayerController* PlayerController)` Override:**
  1. Calls `GetBaseInventory()` to find the root component.
  2. Calls the **base implementation** (`ULyraInventoryManagerComponent::GetInventoryPermissions`) on that **root component**, passing the `PlayerController`.
  3. Returns the result obtained from the root component.

_(Remember: The base implementations check the `DefaultAccessRights`/`DefaultPermissions` and the specific `FPlayerAccessRightsContainer`/`FPlayerPermissionsContainer` on the component they are called on)._

### Implications

* **Centralized Control:** Access Rights and Permissions are configured **only on the root inventory component** (e.g., the one directly attached to the Player State or a persistent world container Actor). You don't need to set specific rights/permissions on child inventory components created by `InventoryFragment_Container`.
* **Consistency:** A player's ability to interact with items inside a backpack is governed by their access/permissions to the main player inventory holding the backpack, not some separate ruleset on the backpack itself.
* **Simplicity:** Avoids complex scenarios where conflicting permissions might exist between parent and child inventories.
* **Replication Efficiency:** Only the root inventory's access/permission containers need to be fully replicated and managed. Child inventories implicitly follow the root's rules for the purpose of GAS interaction checks.

### How Checks Are Enforced

The enforcement still happens primarily within the `FAbilityData_SourceItem::GetSourceItem` virtual function (and its derivatives like `FInventoryAbilityData_SourceTetrisItem::GetSourceItem`):

1. **UI Action -> GAS Event:** The client UI sends an event with source/destination data (e.g., `FInventoryAbilityData_SourceTetrisItem` pointing to a slot inside a backpack).
2. **Ability Receives Event:** The server-side Gameplay Ability receives the event.
3. **Resolve Item:** The ability calls `GetItemFromAbilitySourceItemStruct` (or the virtual `GetSourceItem` directly).
4. **`GetSourceItem` Implementation:**
   * The `FInventoryAbilityData_SourceTetrisItem::GetSourceItem` implementation gets the `ULyraTetrisInventoryManagerComponent` referenced in the struct (the backpack's inventory).
   * It then calls **`TetrisInventory->GetInventoryAccessRight(PlayerController)`** and **`TetrisInventory->HasInventoryPermissions(PlayerController, RequiredPermission)`**.
   * **Crucially, these calls are the overridden versions**, which immediately delegate upwards to the **root inventory component**.
   * The permission/access checks are therefore performed against the **root inventory's settings**.
   * If the checks pass at the root level, the function proceeds to get the actual item instance from the backpack's grid slot (`TetrisInventory->GetItemInstanceFromSlot`).
   * If checks fail at the root level, it returns `nullptr`.
5. **Ability Action:** The ability only proceeds if a valid item instance is returned.

**Example:**

1. Player's main inventory (`RootInventory`) grants `PlayerController A` `FullAccess` and `FullPermissions`.
2. Player has a Backpack item in `RootInventory`. The Backpack's `InventoryFragment_Container` creates `ChildInventory`.
3. `ChildInventory->ParentInventory` points to `RootInventory`.
4. Player A tries to move an item _inside_ the `ChildInventory` via the UI.
5. The GAS ability receives `FInventoryAbilityData_SourceTetrisItem` pointing to a slot in `ChildInventory`.
6. `GetSourceItem` is called on the struct.
7. Inside `GetSourceItem`, it calls `ChildInventory->GetInventoryAccessRight(PlayerController A)`.
8. This overridden function finds the base (`RootInventory`) and calls `RootInventory->ULyraInventoryManagerComponent::GetInventoryAccessRight(PlayerController A)`, which returns `FullAccess`.
9. It then calls `ChildInventory->HasInventoryPermissions(PlayerController A, MoveItems)`.
10. This overridden function finds the base (`RootInventory`) and calls `RootInventory->ULyraInventoryManagerComponent::HasInventoryPermissions(PlayerController A, MoveItems)`, which returns `true`.
11. Since checks pass, `GetSourceItem` proceeds to get the item from `ChildInventory`'s grid and returns it.
12. The ability executes the move within `ChildInventory`.

Therefore, while the Tetris inventory system supports complex nesting, the access control model remains simple and centralized at the root inventory level, ensuring consistent and manageable permissions across the entire hierarchy for player interactions via GAS.
