# ULyraInventoryQuery

The `ULyraInventoryQuery` class is the core C++ object responsible for tracking specific item definitions within a designated `ULyraInventoryManagerComponent`. While the `UAsyncAction_ItemQuery` provides a convenient Blueprint wrapper, using `ULyraInventoryQuery` directly in C++ offers more control, especially within persistent C++ systems or actor components.

### Purpose & Functionality

* Monitors a single `ULyraInventoryManagerComponent`.
* Tracks a specified set of `ULyraInventoryItemDefinition` classes.
* Listens for `TAG_Lyra_Inventory_Message_StackChanged` messages from the target inventory.
* Maintains an internal cache (`CachedItems`) of `ULyraInventoryItemInstance*` that match the tracked definitions.
* Fires delegates (`OnUpdated`, `OnUpdatedWithTrackedDefs`) when the set of matching items or their stack counts change.

### Creating and Initializing

You typically create and manage `ULyraInventoryQuery` instances within the C++ class that needs to track the items (e.g., a weapon component tracking ammo, a crafting system component tracking resources).

```cpp
#include "Inventory/LyraInventoryQuery.h"
#include "Inventory/LyraInventoryManagerComponent.h"
#include "Inventory/LyraInventoryItemDefinition.h"
#include "GameplayMessageSubsystem.h" // For the message tag

// Header (.h) of your class (e.g., UMyWeaponComponent)
UPROPERTY() // Make it a UPROPERTY to prevent garbage collection
TObjectPtr<ULyraInventoryQuery> AmmoQuery;

// Implementation (.cpp) - Example initialization in BeginPlay or similar
void UMyWeaponComponent::InitializeAmmoTracking()
{
    // Get the inventory component to track (e.g., from the owning Pawn)
    AActor* Owner = GetOwner();
    APawn* OwnerPawn = Cast<APawn>(Owner);
    ULyraInventoryManagerComponent* PlayerInventory = OwnerPawn ? OwnerPawn->FindComponentByClass<ULyraInventoryManagerComponent>() : nullptr;

    if (PlayerInventory)
    {
        // Define the ammo types we care about
        TArray<TSubclassOf<ULyraInventoryItemDefinition>> AmmoItemDefs;
        AmmoItemDefs.Add(UAmmo_556::StaticClass()); // Replace with your actual ammo definition classes
        AmmoItemDefs.Add(UAmmo_762::StaticClass());

        // Create and initialize the query object
        // 'this' (UMyWeaponComponent) is a good Outer to manage the query's lifetime
        AmmoQuery = NewObject<ULyraInventoryQuery>(this);
        AmmoQuery->Initialize(AmmoItemDefs, PlayerInventory);

        // Bind to the update delegate
        AmmoQuery->OnUpdated.AddDynamic(this, &UMyWeaponComponent::HandleAmmoQueryUpdate);
        // Or bind to the delegate that includes the tracked definitions
        // AmmoQuery->OnUpdatedWithTrackedDefs.AddDynamic(this, &UMyWeaponComponent::HandleAmmoQueryUpdateWithDefs);

        // --- Optional: Handle initial state ---
        // The query calculates the initial list in Initialize, access it immediately if needed
        const TArray<ULyraInventoryItemInstance*>& InitialAmmoItems = AmmoQuery->GetItems();
        UpdateAmmoDisplay(InitialAmmoItems); // Example function call
    }
}

// Example handler function in your class
void UMyWeaponComponent::HandleAmmoQueryUpdate(const TArray<ULyraInventoryItemInstance*>& UpdatedAmmoItems)
{
    UE_LOG(LogTemp, Log, TEXT("Ammo query updated. Found %d relevant ammo instances."), UpdatedAmmoItems.Num());
    // Update internal state or UI based on the new list of items
    UpdateAmmoDisplay(UpdatedAmmoItems);
}

/* // Alternative handler if you need the definitions that triggered the update
void UMyWeaponComponent::HandleAmmoQueryUpdateWithDefs(
    const TSet<TSubclassOf<ULyraInventoryItemDefinition>>& TrackedDefs,
    const TArray<ULyraInventoryItemInstance*>& UpdatedAmmoItems)
{
    // ... logic ...
}
*/

// Remember to clean up
void UMyWeaponComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (AmmoQuery)
    {
        AmmoQuery->StopListening(); // Unregisters the message listener
        // AmmoQuery will be garbage collected automatically as it's a UPROPERTY
    }
    Super::EndPlay(EndPlayReason);
}
```

**Key Steps:**

1. **Include Headers:** Include necessary inventory and query headers.
2. **Declare Member:** Declare a `UPROPERTY() TObjectPtr<ULyraInventoryQuery>` in your class header to hold the query object and prevent premature garbage collection.
3. **Get Target Inventory:** Obtain a pointer to the `ULyraInventoryManagerComponent` you want to monitor.
4. **Define Item Definitions:** Create a `TArray` containing the `TSubclassOf<ULyraInventoryItemDefinition>` classes you want to track.
5. **Create Query:** Use `NewObject<ULyraInventoryQuery>(Outer)` to create an instance. The `Outer` should typically be the C++ object managing the query (like `this`).
6. **Initialize:** Call `AmmoQuery->Initialize(ItemDefs, TargetInventory)`. This performs the initial scan and subscribes to inventory change messages.
7. **Bind Delegate:** Bind a function in your class to one of the query's delegates (`OnUpdated` or `OnUpdatedWithTrackedDefs`) to receive notifications. Use `AddDynamic` for UFUNCTIONs.
8. **Handle Updates:** Implement the bound function(s) to react to changes in the tracked item list.
9. **Cleanup:** In your class's `EndPlay` or equivalent cleanup function, call `AmmoQuery->StopListening()` to unregister the message listener explicitly (though `BeginDestroy` on the query also does this). Rely on garbage collection to destroy the query object itself since it's a `UPROPERTY`.

### Accessing Query Results

* `GetItems() const`: Returns a `const TArray<ULyraInventoryItemInstance*>&` containing the currently cached list of item instances matching the tracked definitions. This list is updated automatically when the `OnUpdated` delegate fires.
* `GetInventory() const`: Returns the `ULyraInventoryManagerComponent*` being monitored.
* `GetTrackedItemDefs() const`: Returns the `TSet<TSubclassOf<ULyraInventoryItemDefinition>>` used to initialize the query.

### How it Works Internally

1. **`Initialize`:** Stores the inventory pointer and item definitions. It iterates through `Inventory->GetAllItems()` once to populate the initial `CachedItems` list. It then uses `UGameplayMessageSubsystem::RegisterListener` to subscribe to `TAG_Lyra_Inventory_Message_StackChanged`.
2. **`HandleInventoryChanged`:** This function is called whenever the subscribed `StackChanged` message is received.
   * It checks if the message is from the correct `InventoryOwner`.
   * It checks if the `Message.Instance`'s definition is one of the `TrackedItemDefs`.
   * If the item matches and its `NewCount` is > 0, it ensures the instance is in `CachedItems` (adding it if not).
   * If the item matches and its `NewCount` is <= 0, it removes the instance from `CachedItems`.
   * If a change occurred (`Message.Delta != 0`), it broadcasts the `OnUpdated` and `OnUpdatedWithTrackedDefs` delegates with the _updated_ `CachedItems` list.
3. **`StopListening` / `BeginDestroy`:** Calls `ListenerHandle.Unregister()` to stop listening to the message subsystem, preventing further updates and potential issues after the query or its owner is no longer valid.

***

Using `ULyraInventoryQuery` directly in C++ provides an efficient, reactive way for your game systems to stay synchronized with specific parts of an inventory's state without resorting to inefficient polling. Remember to manage its lifecycle appropriately within its owning C++ object.
