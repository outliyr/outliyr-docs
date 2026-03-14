# The Container Contract

At the heart of the Item container system is a single interface: `ILyraItemContainerInterface`. Every container, inventory, equipment, attachments, or your custom types, implements this interface, enabling the transaction system, prediction engine, and UI to work with any container uniformly.

This page explains what the interface requires and how different containers fulfill that contract.

> [!SUCCESS]
> A lot of these functions don't work in blueprints because they use c++ only variables like `FPredictionKey`, read the [Item Container Blueprint API](item-container-blueprint-api.md) page to see the blueprint versions.

***

### What Makes a Container?

A container is anything that:

1. **Holds items in addressable slots**
2. **Supports adding, removing, and querying items**
3. **Defines how occupied slots behave**
4. **Can participate in the transaction system**

The interface formalizes these requirements into a set of methods that every container must implement.

***

### Mutation Methods

These methods modify container state. The `FPredictionKey` parameter exists for the prediction system, if you're not implementing prediction support, you can ignore it.

> [!INFO]
> **About `FPredictionKey`:** You'll see this parameter on mutation methods. It's used by the prediction engine to track operations for potential rollback. If you're creating a simple container without prediction support, you don't need to do anything with it. See [Adding Prediction](../creating-containers/adding-prediction.md) if you want prediction support.

#### `AddItemToSlot`

```cpp
virtual bool AddItemToSlot(
    const FInstancedStruct& SlotInfo,
    ULyraInventoryItemInstance* Item,
    FPredictionKey PredictionKey,
    bool bForceAdd = false) = 0;
```

Adds an item to the specified slot. Returns `true` on success.

| Parameter       | Purpose                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `SlotInfo`      | Polymorphic slot descriptor (see Slot Descriptors)                     |
| `Item`          | The item instance to add                                               |
| `PredictionKey` | For prediction system (can ignore if not using prediction)             |
| `bForceAdd`     | Bypasses occupancy checks (used by transaction system during rollback) |

**What your implementation should do:**

* Resolve the slot from `SlotInfo` to your container's internal representation
* Validate the item can go in this slot (unless `bForceAdd` is true)
* Store the item in the slot
* Return `false` if the slot doesn't exist or the item can't be placed

#### **`RemoveItemFromSlot`**

```cpp
virtual ULyraInventoryItemInstance* RemoveItemFromSlot(
    const FInstancedStruct& SlotInfo,
    FPredictionKey PredictionKey) = 0;
```

Removes and returns the item from the specified slot. Returns `nullptr` if the slot is empty or invalid.

**What your implementation should do:**

* Resolve the slot from `SlotInfo`
* Remove the item from your internal storage
* Return the item (it's no longer in this container but is not destroyed)
* Return `nullptr` if the slot is empty or doesn't exist

#### **`MoveItemBetweenSlots`**

```cpp
virtual bool MoveItemBetweenSlots(
    const FInstancedStruct& SourceSlot,
    const FInstancedStruct& DestSlot,
    ULyraInventoryItemInstance* Item,
    FPredictionKey PredictionKey);
```

Moves an item between slots **within the same container**.

**Default implementation returns `false`**, override if your container supports internal repositioning (like rearranging inventory slots).

For cross-container moves, the transaction system uses `RemoveItemFromSlot` + `AddItemToSlot` instead, so you don't need to handle those here.

***

### Query Methods

These methods read container state without modifying it.

#### **`CanAcceptItem`**

```cpp
virtual int32 CanAcceptItem(
    const FInstancedStruct& SlotInfo,
    const ULyraInventoryItemInstance* Item,
    const AController* Instigator) const = 0;
```

Checks if a slot can accept an item. Returns:

* `0` if rejected
* `>0` for quantity that can be accepted (for stackable items, returns available stack space)

**Common rejection reasons:**

* Slot is occupied with an incompatible item
* Item type not allowed in this slot
* Container weight/capacity limits exceeded
* Slot doesn't exist

#### **`CanRemoveItem`**

```cpp
virtual int32 CanRemoveItem(
    const FInstancedStruct& SlotInfo,
    const ULyraInventoryItemInstance* Item,
    const AController* Instigator) const;
```

Checks if a slot can remove an item. Returns:

* `0` if rejected
* `>0` for quantity that can be removed (for stackable items, returns available stack space)

This is a read-only validation check that does not mutate state. Unlike permission checks (which validate _who_ can access the container), this method validates container-specific business logic.

**Common rejection reasons:**

* Item is bound (quest items that cannot leave a quest container)

#### **`GetItemInSlot`**

```cpp
virtual ULyraInventoryItemInstance* GetItemInSlot(
    const FInstancedStruct& SlotInfo) const = 0;
```

Returns the item in a slot, or `nullptr` if empty.

#### **`ForEachItem`**

```cpp
virtual int32 ForEachItem(
    TFunctionRef<bool(ULyraInventoryItemInstance* Item, const FInstancedStruct& SlotInfo)> Callback) const = 0;
```

Iterates over all items in the container. The callback receives each item and its slot descriptor. Return `false` from the callback to stop early.

```cpp
// Example: Find all items of a specific type
TArray<ULyraInventoryItemInstance*> FoundItems;
Container->ForEachItem([&](ULyraInventoryItemInstance* Item, const FInstancedStruct& Slot) {
    if (Item->GetItemDef() == TargetDef)
    {
        FoundItems.Add(Item);
    }
    return true; // Continue iteration
});
```

**What your implementation should do:**

* Iterate over all items in your storage
* Build slot descriptors for each item's location
* Call the callback for each item, stopping if it returns `false`

***

### Occupied Slot Behavior

When an item is moved to an occupied slot, different containers handle it differently. The interface defines an enum and a query method:

```cpp
enum class EContainerOccupiedSlotBehavior : uint8
{
    Reject,         // Fail the move
    Swap,           // Exchange items between source and destination
    StackCombine,   // Merge stacks if items are compatible
    FragmentCombine, // Route to item fragments for special combining
    SameItem        // The "other" item is actually the same item (multi-slot items)
};

virtual EContainerOccupiedSlotBehavior GetOccupiedSlotBehavior(
    const FInstancedStruct& SlotInfo,
    const ULyraInventoryItemInstance* IncomingItem,
    const ULyraInventoryItemInstance* ExistingItem) const;
```

| Behavior          | When Used                          | Example                          |
| ----------------- | ---------------------------------- | -------------------------------- |
| `Reject`          | Slot is blocked                    | Default for unknown containers   |
| `Swap`            | Standard item exchange             | Inventory, Equipment             |
| `StackCombine`    | Merge compatible stacks            | Tetris inventory with stackables |
| `FragmentCombine` | Route to fragment logic            | Attachments, nested containers   |
| `SameItem`        | Multi-cell item overlapping itself | Tetris inventory repositioning   |

The transaction system queries this to determine how to handle the move.

***

### Prediction Support

Containers can opt into client-side prediction for responsive multiplayer:

```cpp
virtual bool CanParticipateInClientPrediction(
    const AController* PredictingController) const;
```

**Default returns `false`**, containers work safely without prediction but feel less responsive in multiplayer.

> [!INFO]
> **Prediction is optional.** Most containers work perfectly fine without it. Prediction adds complexity and is primarily valuable for containers that players interact with frequently during gameplay (inventory, equipment). Static containers (vendors, quest rewards) typically don't need it.

When you want prediction support, you override this method to return `true`. The prediction engine then handles the heavy lifting, tracking operations, managing overlays, and coordinating with the server. You don't implement prediction logic yourself; you integrate with the prediction runtime.

***

### Prediction Key Delegate Handlers

```cpp
virtual void OnPredictionKeyRejected(int32 PredictionKeyCurrent);
```

This callback notifies your container when the server rejects a predicted operation, allowing immediate UI correction rather than waiting for replication.

```cpp
virtual void OnPredictionKeyCaughtUp(int32 PredictionKeyCurrent);
```

This callback notifies your container when the a prediction key has been fully processed by the server. This is the signal to clear all overlays for this prediction key.

See [Adding Prediction](../creating-containers/adding-prediction.md) for a step-by-step guide to enabling prediction in your container.

***

### Auto-Placement

Some containers support finding an available slot automatically:

```cpp
virtual bool FindAvailableSlot(
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef,
    const ULyraInventoryItemInstance* Item,
    FInstancedStruct& OutSlot,
    const TArray<FGuid>& ExcludedItemIds = TArray<FGuid>()) const;
```

**Default returns `false`**, containers override to support auto-placement.

| Container Type   | Typical Behavior                     |
| ---------------- | ------------------------------------ |
| Grid Inventory   | Finds first empty slot               |
| Jigsaw Inventory | Finds first position where item fits |
| Equipment        | Find the first compatible empty slot |

The `ExcludedItemIds` parameter treats slots containing those items as available, useful for "swap with auto-place" operations.

***

### Item Destruction

Each container handles item destruction differently:

```cpp
virtual void DestroyItem(ULyraInventoryItemInstance* Item);
```

The default implementation marks the item for garbage collection, but containers override this to handle:

* Replication teardown
* Spawned actor cleanup
* Attachment detachment

**Important:** Remove the item from the container first, then call `DestroyItem`.

***

### Action Filtering

Containers can filter which item actions are available:

```cpp
// Actions with these tags are removed
virtual FGameplayTagContainer GetExcludedItemActions() const;

// If non-empty, only actions with these tags are allowed
virtual FGameplayTagContainer GetAllowedItemActions() const;

// Complex filtering logic
virtual void FilterItemActions(
    const ULyraInventoryItemInstance* Item,
    TArray<FLyraItemActionData>& Actions) const;
```

**Example:** Equipment containers exclude the "Split" action, you can't split a stack while it's equipped.

***

### Container Hierarchy

Some containers are owned by items (like a backpack's internal inventory or InventoryFragment_Attachment):

```cpp
virtual ULyraInventoryItemInstance* GetOwningItem() const;
```

Returns the item that owns this container, or `nullptr` for player-owned or world containers.

Used for:

* UI session reparenting when items move
* Circular reference detection (can't put a backpack inside itself)

***

### How Different Containers Implement This

#### Inventory (`LyraInventoryManagerComponent`)

* **Slots:** Index-based (`FInventoryAbilityData_SourceItem`)
* **Occupied behavior:** `Swap` (exchange items)
* **Auto-placement:** Finds first empty index
* **Prediction:** Full support

#### Equipment (`LyraEquipmentManagerComponent`)

* **Slots:** Tag-based (`FEquipmentAbilityData_SourceEquipment`)
* **Occupied behavior:** `Swap` (unequip old, equip new)
* **Auto-placement:** Finds first compatible equipment slot
* **Prediction:** Full support
* **Action filtering:** Excludes "Split" action

#### Attachments (`InventoryFragment_Attachment`)

* **Slots:** Attachment path-based (`FAttachmentAbilityData_SourceAttachment`)
* **Occupied behavior:** `FragmentCombine` (routes to attachment logic)
* **Auto-placement:** Finds first compatible attachment slot
* **Prediction:** Full support
* **Owning item:** Returns the parent item

***

### The Payoff

Because all containers implement this interface:

1. **One transaction ability** handles moves between any containers
2. **One prediction system** provides responsive multiplayer everywhere
3. **One UI architecture** displays any container type
4. **One permission model** controls access uniformly

You write container-specific logic once (how your slots work, what items fit), and everything else works automatically.

***

### Next Steps

Learn how slots are identified across different container types in Slot Descriptors.
