# Stat Tags

Each `ULyraInventoryItemInstance` contains a `StatTags` property, which is an instance of `FGameplayTagStackContainer`. This system, originating from the base Lyra framework, provides a way to associate **persistent integer counts** (stacks) with specific **Gameplay Tags** on an item instance.

***

### Role and Purpose

* **Instance-Specific Counts:** Stores integer values directly on the item instance, allowing different instances of the same item type to have varying counts for specific tagged properties.
* **Persistence:** Unlike some transient data, these counts persist with the item instance even when it's moved between inventories, dropped, or picked up (assuming the instance itself persists).
* **Primary Use Cases:**
  * **Stack Size:** Tracking the quantity of stackable items (e.g., 30/30 Rifle Ammo, 3/5 Health Potions). The Gameplay Tag `Lyra.Inventory.Item.Count` is often used by convention for this primary stack count, especially by fragments like `InventoryFragment_InventoryIcon`.
  * **Ammo/Charges:** Storing current magazine ammo, reserve ammo counts, or charges remaining on a usable item.
  * **Durability:** Representing durability as an integer value (e.g., 100/100 points).
  * **Simple Flags/States:** While primarily for counts, a stack count > 0 can implicitly act as a boolean flag (e.g., `Item.State.IsJammed = 1`).

***

### Comparison with Transient Fragments

It's important to understand when to use Stat Tags versus the Transient Fragment system you introduced:

| Feature            | Stat Tags (`FGameplayTagStackContainer`)                 | Transient Fragments (`FTransientFragmentData`/`UTransientRuntimeFragment`)       |
| ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Data Type**      | `int32` (Stack Count)                                    | Any `USTRUCT` or `UObject`                                                       |
| **Association**    | `FGameplayTag` -> `int32`                                | Specific `ULyraInventoryItemFragment` -> Specific Data Type                      |
| **Persistence**    | High (Persists with item instance across moves)          | High (Persists with item instance across moves)                                  |
| **Primary Use**    | Integer counts, charges, durability points, simple flags | Complex state, non-integer data, related data groups, UObject logic              |
| **Initialization** | Can be initialized via `InventoryFragment_SetStats`      | Initialized via `CreateNewTransientFragment`/`CreateNewRuntimeTransientFragment` |
| **Flexibility**    | Good for simple integer tracking                         | Very high - allows arbitrary data structures and UObject features                |

**Rule of Thumb:**

* Use **Stat Tags** for simple, persistent integer counts directly associated with the item instance (like ammo or quantity).
* Use **Transient Fragments** for more complex, potentially non-integer instance-specific state, especially when that state is logically tied to a specific fragment's functionality (like attachment data being tied to the Attachment fragment, or heat data tied to a Weapon Mechanics fragment).

***

### Key Functions (on `ULyraInventoryItemInstance`)

These functions operate on the `StatTags` container within the item instance:

* `AddStatTagStack(FGameplayTag Tag, int32 StackCount)`
  * **Authority Only.**
  * Adds the specified `StackCount` to the existing count for the `Tag`. If the tag doesn't exist, it's added with the given count. Does nothing if `StackCount` <= 0.

<img src=".gitbook/assets/image (18) (1) (1) (1).png" alt="" width="334" title="">

* `SetStatTagStack(FGameplayTag Tag, int32 StackCount)`
  * **Authority Only.**
  * Sets the count for the `Tag` directly to `StackCount`. If `StackCount` <= 0, the tag is effectively removed. If the tag doesn't exist and `StackCount` > 0, it's added.

<img src=".gitbook/assets/image (19) (1) (1) (1).png" alt="" width="332" title="">

* `RemoveStatTagStack(FGameplayTag Tag, int32 StackCount)`
  * **Authority Only.**
  * Removes the specified `StackCount` from the existing count for the `Tag`. If the resulting count is <= 0, the tag is removed entirely. Does nothing if `StackCount` <= 0 or the tag doesn't exist.

<img src=".gitbook/assets/image (20) (1) (1).png" alt="" width="325" title="">

* `GetStatTagStackCount(FGameplayTag Tag) const`
  * **Client & Server.**
  * Returns the current stack count associated with the `Tag`, or 0 if the tag is not present.

<img src=".gitbook/assets/image (21) (1) (1).png" alt="" width="344" title="">

* `HasStatTag(FGameplayTag Tag) const`
  * **Client & Server.**
  * Returns `true` if the `Tag` exists in the container (i.e., has a stack count > 0), `false` otherwise.

<img src=".gitbook/assets/image (22) (1) (1).png" alt="" width="331" title="">

***

### Initialization (`InventoryFragment_SetStats`)

While you can manually call `SetStatTagStack` after creating an item instance, the common way to set initial default values is using the `UInventoryFragment_SetStats` fragment on the `ULyraInventoryItemDefinition`.

1. Add `InventoryFragment_SetStats` to your Item Definition's `Fragments` array.
2. Configure its `InitialItemStats` TMap property: Add entries mapping the desired `FGameplayTag` to its initial `int32` count.
3. When an instance of this item definition is created (e.g., via `UGlobalInventoryManager::CreateNewItem`), the `UInventoryFragment_SetStats::OnInstanceCreated` function will automatically iterate through this map and call `Instance->AddStatTagStack()` for each entry.

_Example `InitialItemStats` Configuration:_

* `Inventory.Item.Count` -> `1` (Default stack size)
* `Weapon.Ammo.Magazine` -> `30` (Initial mag capacity)
* `Item.Charges.Max` -> `3` (Max charges)
* `Item.Charges.Current` -> `3` (Current charges)

***

### Replication

The `StatTags` property (`FGameplayTagStackContainer`) on `ULyraInventoryItemInstance` is marked `UPROPERTY(Replicated)` and uses `FFastArraySerializer` internally (`FGameplayTagStack` deriving from `FFastArraySerializerItem`).

* **Efficiency:** Changes to stack counts are replicated efficiently.
* **Client Access:** Clients can safely call `GetStatTagStackCount` and `HasStatTag` to query the replicated state.
* **Authority:** Modification functions (`Add`, `Set`, `Remove`) are authority-only to maintain network consistency.

***

In essence, `StatTags` provide a straightforward, networked way to manage simple integer states that belong intrinsically to an item instance and need to persist with it. They complement the more complex and flexible Transient Fragment system for handling other types of instance-specific data.
