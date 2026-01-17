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

It's important to understand when to use Stat Tags versus the Transient Fragment system:

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

<img src=".gitbook/assets/image (18) (1) (1) (1) (1).png" alt="" width="334" title="">

* `SetStatTagStack(FGameplayTag Tag, int32 StackCount)`
  * **Authority Only.**
  * Sets the count for the `Tag` directly to `StackCount`. If `StackCount` <= 0, the tag is effectively removed. If the tag doesn't exist and `StackCount` > 0, it's added.

<img src=".gitbook/assets/image (19) (1) (1) (1) (1).png" alt="" width="332" title="">

* `RemoveStatTagStack(FGameplayTag Tag, int32 StackCount)`
  * **Authority Only.**
  * Removes the specified `StackCount` from the existing count for the `Tag`. If the resulting count is <= 0, the tag is removed entirely. Does nothing if `StackCount` <= 0 or the tag doesn't exist.

<img src=".gitbook/assets/image (20) (1) (1) (1).png" alt="" width="325" title="">

* `GetStatTagStackCount(FGameplayTag Tag) const`
  * **Client & Server.**
  * Returns the current stack count associated with the `Tag`, or 0 if the tag is not present.

<img src=".gitbook/assets/image (21) (1) (1) (1).png" alt="" width="344" title="">

* `HasStatTag(FGameplayTag Tag) const`
  * **Client & Server.**
  * Returns `true` if the `Tag` exists in the container (i.e., has a stack count > 0), `false` otherwise.

<img src=".gitbook/assets/image (22) (1) (1) (1).png" alt="" width="331" title="">

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

#### Change Notifications (Delegates)

When stat tag values change, item instances broadcast a delegate to notify interested systems like UI widgets:

```cpp
UPROPERTY(BlueprintAssignable, Category="Inventory|Stats")
FOnGameplayTagStackChangedDynamic OnItemStatTagChanged;
```

**Delegate Signature:**

* `Tag` (`FGameplayTag`): The tag that changed
* `NewCount` (`int32`): The new stack count
* `OldCount` (`int32`): The previous stack count

**Usage Example (C++):**

```cpp
ItemInstance->OnItemStatTagChanged.AddDynamic(this, &UMyWidget::HandleStatChanged);

void UMyWidget::HandleStatChanged(FGameplayTag Tag, int32 NewCount, int32 OldCount)
{
    if (Tag == TAG_Weapon_Ammo_Magazine)
    {
        UpdateAmmoDisplay(NewCount);
    }
}
```

**Usage Example (Blueprint):** Bind to the `OnItemStatTagChanged` event on your item instance reference to receive notifications when any stat tag changes.

**Prediction Support**

The item instance stat tag system includes prediction support for responsive UI updates:

* **`RecordPredictedTagDelta(Tag, Delta, PredKeyId)`**: Records a predicted change that will be applied immediately to `GetStatTagStackCount()` results, allowing UI to show the predicted value before server confirmation.
* **`PendingTagDeltas`**: Internal map tracking predicted changes keyed by prediction ID.
* **`ClearPredictedDeltasForKey(PredKeyId)`**: Called when a prediction is confirmed or rejected to clean up pending deltas.

**Prediction Behavior:**

1. When a predicted delta is recorded, the delegate fires immediately with the predicted value
2. The replicated value updates separately via server replication
3. When prediction is cleared, the delegate fires with the final confirmed value
4. If prediction is rejected, the rollback broadcasts the corrected value

This allows UI to show immediate feedback (e.g., ammo decrementing when firing) while maintaining server authority over the actual values.

***

#### Related Delegates

The stat tag delegate pattern is used consistently across the framework:

| Class                        | Delegate                 | Purpose                                      |
| ---------------------------- | ------------------------ | -------------------------------------------- |
| `ULyraInventoryItemInstance` | `OnItemStatTagChanged`   | Item-level stats (ammo, durability, charges) |
| `ALyraPlayerState`           | `OnPlayerStatTagChanged` | Player-level stats (kills, deaths, score)    |
| `ALyraTeamInfoBase`          | `OnTeamTagChanged`       | Team-level stats (objectives, resources)     |

All three delegates share the same signature: `(FGameplayTag Tag, int32 NewCount, int32 OldCount)`

***

In essence, `StatTags` provide a straightforward, networked way to manage simple integer states that belong intrinsically to an item instance and need to persist with it. They complement the more complex and flexible Transient Fragment system for handling other types of instance-specific data.
