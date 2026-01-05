# Item Container Blueprint API

The `ILyraItemContainerInterface` uses C++ constructs like `FPredictionKey` and `TFunctionRef` that don't translate well to Blueprints. The `UItemContainerFunctionLibrary` provides Blueprint-friendly access to container operations.

This page covers when to use the function library, what it provides, and how it relates to the C++ interface.

### Why a Function Library?

Blueprints can't:

* Call methods with `FPredictionKey` parameters (GAS internal type)
* Use `TFunctionRef` callbacks
* Work with raw interface pointers effectively

The function library wraps these operations in Blueprint-callable functions, handling the complexity internally.

{% hint style="info" %}
**C++ developers:** You can use either the interface directly or the function library. The function library is convenient for permission-checked operations and slot resolution. For performance-critical code, the interface methods avoid the wrapper overhead.
{% endhint %}

### Categories of Functions

The function library organizes operations into logical groups.

### Slot Resolution

These functions work with polymorphic slot descriptors (`FInstancedStruct`).

#### `IsNullSlot`

```cpp
UFUNCTION(BlueprintCallable, Category = "Source Slot")
static bool IsNullSlot(const FInstancedStruct& Slot);
```

Checks if a slot is null or invalid. Use this before operating on slots from UI or external sources.

#### `ResolveContainerFromSlot`

```cpp
UFUNCTION(BlueprintCallable, Category = "ItemContainer|Resolution", 
meta = (DisplayName = "Resolve Container From Slot"))
static bool ResolveContainerFromSlot_BP(
    const FInstancedStruct& SlotDesc,
    APlayerController* PC,
    TScriptInterface<ILyraItemContainerInterface>& OutContainer);
```

```cpp
// C++ version returns the interface directly
static ILyraItemContainerInterface* ResolveContainerFromSlot(
    const FInstancedStruct& SlotDesc,
    APlayerController* PC);
```

#### `GetItemInSlot`

```cpp
UFUNCTION(BlueprintCallable, BlueprintPure, Category = "ItemContainer|Slot")
static ULyraInventoryItemInstance* GetItemInSlot(
    const FInstancedStruct& SlotDesc,
    APlayerController* PC);
```

Gets the item in a slot, handling container resolution internally. Returns `nullptr` if the slot is empty or invalid.

#### `CanSlotAcceptItem`

```cpp
UFUNCTION(BlueprintCallable, BlueprintPure, Category = "ItemContainer|Slot")
static int32 CanSlotAcceptItem(
    const FInstancedStruct& SlotDesc,
    ULyraInventoryItemInstance* Item,
    APlayerController* PC);
```

Checks if a destination slot can accept an item. Useful for UI feedback before attempting a move.

#### `CanSlotRemoveItem`

```cpp
UFUNCTION(BlueprintCallable, BlueprintPure, Category = "ItemContainer|Slot")
static int32 CanSlotRemoveItem(
    const FInstancedStruct& SlotDesc,
    ULyraInventoryItemInstance* Item,
    APlayerController* PC);
```

Checks if a destination slot can remove an item.

#### `FindAvailableSlot`

```cpp
UFUNCTION(BlueprintCallable, Category = "ItemContainer|Slot")
static bool FindAvailableSlot(
    const FInstancedStruct& ContainerSlot,
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef,
    ULyraInventoryItemInstance* Item,
    APlayerController* PC,
    FInstancedStruct& OutAvailableSlot,
    const TArray<FGuid>& ExcludedItemIds);
```

Finds an available slot for an item in a container. The `ExcludedItemIds` parameter lets you treat slots containing specific items as available, useful for swap operations.

***

### Move Validation

#### `CanMoveItem`

```cpp
UFUNCTION(BlueprintCallable, BlueprintPure, Category = "ItemContainer|Ability")
static bool CanMoveItem(
    APlayerController* PC,
    const FInstancedStruct& SourceSlot,
    const FInstancedStruct& DestinationSlot);
```

Checks if a move between two slots would be valid. Performs permission checks, container validation, and slot compatibility checks.

Use this for:

* UI drag-and-drop feedback
* Enabling/disabling move actions
* Pre-validation before committing

***

### Transaction Execution

These functions trigger abilities that execute container operations with prediction support.

#### `CallItemActionAbility`

```cpp
UFUNCTION(BlueprintCallable, Category = "ItemContainer|Ability")
static bool CallItemActionAbility(
    APlayerController* PC,
    const FItemActionContext& Context);
```

Activates an item action ability. The `FItemActionContext` contains:

* `ActionTag`: Which action to perform (use, equip, split, etc.)
* `SourceSlot`: The slot containing the item
* `Quantity`: For quantity-based actions like split

#### `ExecuteTransactionRequest`

```cpp
UFUNCTION(BlueprintCallable, Category = "ItemContainer|Ability")
static bool ExecuteTransactionRequest(
    APlayerController* PC,
    const FItemTransactionRequest& Request);
```

Executes a batch of transaction operations. The request can contain multiple operations (moves, splits, stack modifications) that execute atomically.

See [How Transactions Work](../transactions/how-transactions-work/) for details on building transaction requests.

***

### Stack Information

#### `GetStackInfoFromSlot`

```cpp
UFUNCTION(BlueprintCallable, Category = "ItemContainer|Stack")
static bool GetStackInfoFromSlot(
    const FInstancedStruct& SlotDesc,
    APlayerController* PC,
    int32& OutCurrentStack,
    int32& OutMaxStack,
    ULyraInventoryItemInstance*& OutItem);
```

Gets stack count information for an item in a slot. Returns:

* `OutCurrentStack`: Current stack count
* `OutMaxStack`: Maximum stack size (0 = unlimited)
* `OutItem`: The item instance

***

### Server-Only Operations

These functions bypass the transaction system and modify containers directly. **Server authority required.**

{% hint style="warning" %}
**Server-only functions** are marked with `BlueprintAuthorityOnly`. They won't execute on clients. Use transaction requests instead if you need client-side prediction.
{% endhint %}

#### `AddItemToContainer`

```cpp
UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "ItemContainer|Server")
static bool AddItemToContainer(
    TScriptInterface<ILyraItemContainerInterface> Container,
    ULyraInventoryItemInstance* Item,
    const FInstancedStruct& SlotInfo);
```

Directly adds an item to a container. No prediction, no transaction recording.

#### `RemoveItemFromContainer`

```cpp
UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "ItemContainer|Server")
static ULyraInventoryItemInstance* RemoveItemFromContainer(
    TScriptInterface<ILyraItemContainerInterface> Container,
    const FInstancedStruct& SlotInfo);
```

Directly removes an item from a container.

#### `AddItemDefinitionToAvailableSlot`

```cpp
UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "ItemContainer|Server")
static bool AddItemDefinitionToAvailableSlot(
    const UObject* WorldContextObject,
    TScriptInterface<ILyraItemContainerInterface> Container,
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef,
    int32 Amount,
    ULyraInventoryItemInstance*& OutCreatedItem);
```

Creates an item from a definition and adds it to the first available slot. Checks slot availability **before** creating the item to avoid orphans.

***

### Search and Removal

#### `SearchForCombinationOfItems`

```cpp
UFUNCTION(BlueprintCallable, Category = "ItemContainer|Query")
static bool SearchForCombinationOfItems(
    TScriptInterface<ILyraItemContainerInterface> Container,
    const TArray<TSubclassOf<ULyraInventoryItemDefinition>>& PossibleItemDefs,
    int32 RequiredAmount,
    TArray<ULyraInventoryItemInstance*>& OutFoundItems,
    bool& OutFoundAllItems);
```

Searches a container for items matching any of the given definitions. **Read-only**, doesn't modify the container.

Use for:

* Checking crafting ingredient availability
* Finding quest items
* Validating requirements before consuming

#### `RemoveCombinationOfItems`

```cpp
UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "ItemContainer|Server")
static bool RemoveCombinationOfItems(
    TScriptInterface<ILyraItemContainerInterface> Container,
    const TArray<TSubclassOf<ULyraInventoryItemDefinition>>& PossibleItemDefs,
    int32 RequiredAmount,
    bool bOnlyRemoveIfAllItemsFound,
    bool bDestroy,
    TArray<ULyraInventoryItemInstance*>& OutRemovedItems,
    bool& OutFoundAllItems);
```

Searches and removes items in one operation. Server-only.

Parameters:

* `bOnlyRemoveIfAllItemsFound`: If true, only removes when the full amount can be satisfied
* `bDestroy`: If true, destroys the removed items via `DestroyItem()`

***

### Validation Utilities

#### `WouldCreateCircularReference`

```cpp
UFUNCTION(BlueprintPure, Category = "ItemContainer|Validation")
static bool WouldCreateCircularReference(
    ULyraInventoryItemInstance* ItemToCheck,
    TScriptInterface<ILyraItemContainerInterface> TargetContainer,
    APlayerController* PC);
```

Checks if adding an item to a container would create circular nesting. Prevents putting a backpack inside itself or inside a container that's inside it.

### Next Steps

Understand the reasoning behind these design choices in [Design Philosophy](design-philosophy.md).
