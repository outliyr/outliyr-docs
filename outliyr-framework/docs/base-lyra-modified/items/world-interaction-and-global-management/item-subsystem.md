# Item Subsystem

The `ULyraItemSubsystem` is a `UWorldSubsystem` responsible for centralized item lifecycle management. It provides a standardized way to create, track, and destroy item instances with proper fragment initialization.

### Role and Purpose

* **Standardized Item Instance Creation:** Provides `CreateItemInstance()` for creating new `ULyraInventoryItemInstance` objects with proper initialization, including fragment setup.
* **GUID-Based Item Tracking:** Maintains a fast lookup map of all managed items by their GUID, enabling cross-container item references and prediction reconciliation.
* **Item Lifecycle Management:** Provides `DestroyItem()` for proper cleanup including GUID map removal and fragment destruction.
* **Prediction Support:** Supports client prediction by allowing items to be created with explicit GUIDs that match between client and server.

### Key Functions

#### `CreateItemInstance`

Two overloads are available:

* `CreateItemInstance(ItemDef, Amount)` - Creates with auto-generated GUID
* `CreateItemInstance(ItemDef, Amount, ItemGuid)` - Creates with explicit GUID (for prediction)

{% hint style="info" %}
Directly calling `NewObject<ULyraInventoryItemInstance>` will not automatically initialize the crucial Transient Fragment data payloads. Use `CreateItemInstance` to guarantee correct setup according to the item's definition.
{% endhint %}

Creation Process:

{% stepper %}
{% step %}
#### Create the instance

1. Creates a new `ULyraInventoryItemInstance` with the subsystem as Outer.
2. Sets the `ItemDef` on the new instance.
3. Sets the initial stack count using the `Lyra.Inventory.Item.Count` StatTag.
{% endstep %}

{% step %}
#### Initialize fragments from the ItemDef CDO

1. Retrieves the `ItemDef`'s Class Default Object (CDO).
2. Iterates through the `Fragments` array on the CDO:
   * Calls `Fragment->OnInstanceCreated(NewInstance)`.
   * Calls `Fragment->CreateNewTransientFragment(...)` and adds the resulting `FInstancedStruct` to the instance's `TransientFragments` array.
   * Calls `Fragment->CreateNewRuntimeTransientFragment(...)` and adds the resulting `UTransientRuntimeFragment*` to the instance's `RuntimeFragments` array.
{% endstep %}

{% step %}
#### Register and return

1. Registers the item in the GUID map.
2. Returns the fully initialized `ULyraInventoryItemInstance*`.
{% endstep %}
{% endstepper %}

#### Why Use This?

* Guarantees correct transient fragment initialization that would be missed by directly constructing the UObject.
* Ensures items are properly registered for GUID-based lookup and prediction reconciliation.

***

#### `FindItemByGuid`

```cpp
ULyraInventoryItemInstance* FindItemByGuid(const FGuid& ItemGuid) const;
```

* **Purpose:** O(1) lookup of items by their stable GUID identifier.
* **Use Cases:**
  * Cross-container item references (e.g., attachment systems referencing parent items).
  * Prediction reconciliation (matching client-predicted items with server-authoritative items).
  * View models resolving item references.

***

#### `DestroyItem`

```cpp
void DestroyItem(ULyraInventoryItemInstance* Item);
```

* **Purpose:** Properly destroys an item with full cleanup.
* **Process:**
  1. Removes the item from the GUID map.
  2. Calls `PrepareForDestruction()` on the item (cleans up fragments).
  3. Calls `ConditionalBeginDestroy()` for proper UObject cleanup.

***

#### `RegisterItem / UnregisterItem`

```cpp
void RegisterItem(ULyraInventoryItemInstance* Item);
void UnregisterItem(ULyraInventoryItemInstance* Item);
```

* **Purpose:** Manage the GUID map when items are replicated or destroyed.
* **Prediction Reconciliation:** `RegisterItem` handles the case where a client-predicted item needs to be replaced by the server-authoritative item. If an existing predicted item shares the GUID with a new authoritative item, the predicted item is replaced.

### Client Prediction Integration

<details>

<summary>How the subsystem supports client prediction (expand)</summary>

1. **Prediction Creation:** During client prediction, items are created with an explicit GUID using `CreateItemInstance(ItemDef, Amount, ItemGuid)`.
2. **Marking Predicted Items:** Items created during prediction are marked with `bIsClientPredicted = true`.
3. **GUID Matching:** Server and client use the same GUID for the same logical item, enabling reconciliation.
4. **Reconciliation:** When the server's authoritative item replicates to the client, `RegisterItem()` detects that a predicted item exists with the same GUID. If the existing item is predicted (`bIsClientPredicted == true`) and the new item is authoritative (`bIsClientPredicted == false`), the predicted item is replaced with the authoritative one.

</details>

***

### Usage Examples

Creating an item from code:

```cpp
ULyraItemSubsystem* ItemSubsystem = GetWorld()->GetSubsystem<ULyraItemSubsystem>();
if (ItemSubsystem)
{
    ULyraInventoryItemInstance* NewItem = ItemSubsystem->CreateItemInstance(ItemDefinitionClass, 1);
    // Use NewItem...
}
```

Finding an item by GUID:

```cpp
ULyraItemSubsystem* ItemSubsystem = GetWorld()->GetSubsystem<ULyraItemSubsystem>();
if (ItemSubsystem)
{
    ULyraInventoryItemInstance* Item = ItemSubsystem->FindItemByGuid(SomeGuid);
    if (Item)
    {
        // Item found...
    }
}
```

Creating a predicted item:

```cpp
// During client prediction
FGuid PredictedGuid = FGuid::NewGuid();
ULyraInventoryItemInstance* PredictedItem = ItemSubsystem->CreateItemInstance(ItemDef, Amount, PredictedGuid);
PredictedItem->bIsClientPredicted = true;

// Send PredictedGuid to server so it creates with the same GUID
```

***

### Technical Details

* **Subsystem Type:** `UWorldSubsystem` - automatically created per-world.
* **GUID Map:** Uses `TMap<FGuid, TWeakObjectPtr<ULyraInventoryItemInstance>>` for efficient lookups. Weak pointers allow items to be garbage collected without requiring explicit unregistration (though `UnregisterItem()` is called during destruction for cleanup).
* **Fragment Initialization:** Happens in `InitializeItemInstance()`, which is called by both `CreateItemInstance` overloads.

***

The `ULyraItemSubsystem` centralizes item lifecycle management, ensuring consistent creation with proper fragment initialization and providing GUID-based tracking essential for cross-system item references and client prediction.
