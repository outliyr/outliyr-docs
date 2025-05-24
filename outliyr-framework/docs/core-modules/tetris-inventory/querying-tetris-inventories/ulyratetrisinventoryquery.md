# ULyraTetrisInventoryQuery

The `ULyraTetrisInventoryQuery` class is the C++ foundation for tracking specific item definitions across a hierarchy of nested inventories, starting from a root `ULyraInventoryManagerComponent`. It automatically discovers and monitors child inventories within container items.

### Purpose & Functionality

* **Hierarchical Monitoring:** Tracks specified item definitions in a root inventory _and_ recursively within any child inventories managed by `InventoryFragment_Container`.
* **Reactive Updates:** Listens for `TAG_Lyra_Inventory_Message_StackChanged` messages from _all_ tracked inventories (root and children).
* **Cached Results:** Maintains an internal map (`CachedItems`) where keys are the tracked `ULyraInventoryManagerComponent*` instances (root or child) and values are sets of matching `ULyraInventoryItemInstance*` found within that specific component.
* **Delegates:** Fires delegates (`OnUpdated`, `OnUpdatedWithTrackedDefs`) when the tracked item set changes in any part of the hierarchy, providing results grouped by inventory.

### Creating and Initializing

Similar to the base `ULyraInventoryQuery`, you typically create and manage instances within the C++ class that needs the tracking data.

```cpp
#include "Inventory/LyraTetrisInventoryQuery.h" // Include the Tetris query header
#include "Inventory/LyraTetrisInventoryManagerComponent.h"
#include "Inventory/LyraInventoryItemDefinition.h"
#include "Inventory/ItemFragments/InventoryFragment_Container.h" // Needed for child detection logic
#include "GameplayMessageSubsystem.h"

// Header (.h) of your class (e.g., UCraftingSystemComponent)
UPROPERTY() // Keep it alive
TObjectPtr<ULyraTetrisInventoryQuery> ResourceQuery;

// Implementation (.cpp) - Example initialization
void UCraftingSystemComponent::InitializeResourceTracking()
{
    // Get the root inventory component to track (e.g., from the owning player)
    AActor* Owner = GetOwner();
    APawn* OwnerPawn = Cast<APawn>(Owner);
    // Ensure you get the Tetris version if that's your root, though Initialize takes the base type
    ULyraInventoryManagerComponent* PlayerRootInventory = OwnerPawn ? OwnerPawn->FindComponentByClass<ULyraInventoryManagerComponent>() : nullptr;

    if (PlayerRootInventory)
    {
        // Define the resource item types we care about
        TArray<TSubclassOf<ULyraInventoryItemDefinition>> ResourceItemDefs;
        ResourceItemDefs.Add(UResource_Wood::StaticClass()); // Replace with your actual resource definitions
        ResourceItemDefs.Add(UResource_Metal::StaticClass());

        // Create and initialize the Tetris query object
        ResourceQuery = NewObject<ULyraTetrisInventoryQuery>(this); // 'this' as Outer
        ResourceQuery->Initialize(ResourceItemDefs, PlayerRootInventory);

        // Bind to the update delegate
        ResourceQuery->OnUpdated.AddDynamic(this, &UCraftingSystemComponent::HandleResourceQueryUpdate);
        // Or: ResourceQuery->OnUpdatedWithTrackedDefs.AddDynamic(this, &UCraftingSystemComponent::HandleResourceQueryUpdateWithDefs);

        // --- Optional: Handle initial state ---
        const TArray<FLyraTetrisInventoryQueryResult>& InitialResources = ResourceQuery->GetItemsGroupedByInventory();
        UpdateAvailableRecipes(InitialResources); // Example function call
    }
}

// Example handler function
void UCraftingSystemComponent::HandleResourceQueryUpdate(const TArray<FLyraTetrisInventoryQueryResult>& ItemsByInventory)
{
    // ItemsByInventory contains an entry for each inventory (root or child) holding tracked items.
    UE_LOG(LogTemp, Log, TEXT("Resource query updated. Found relevant items in %d inventories."), ItemsByInventory.Num());

    // Process the grouped results - e.g., calculate total counts or update UI sections per container
    UpdateAvailableRecipes(ItemsByInventory);
}

// Remember to clean up
void UCraftingSystemComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (ResourceQuery)
    {
        ResourceQuery->StopListening(); // Unregisters message listeners
    }
    Super::EndPlay(EndPlayReason); // UPROPERTY handles garbage collection
}
```

**Key Differences from Base Initialization:**

* Include `Inventory/LyraTetrisInventoryQuery.h`.
* Instantiate `ULyraTetrisInventoryQuery` instead of `ULyraInventoryQuery`.
* The `Initialize` function signature is the same, taking the base `ULyraInventoryManagerComponent*` as the root.
* The delegates provide results grouped by inventory (`TArray<FLyraTetrisInventoryQueryResult>`).

### Accessing Query Results

* **`GetItemsGroupedByInventory() const`:** Returns `TArray<FLyraTetrisInventoryQueryResult>`. Each element in the array represents one inventory (root or child) that contains tracked items.
  * `FLyraTetrisInventoryQueryResult`: Contains `Inventory` (the `ULyraInventoryManagerComponent*`) and `Items` (`TArray<ULyraInventoryItemInstance*>`) found within that specific inventory.
* **`GetItems() const`:** Returns a _flat_ `TArray<ULyraInventoryItemInstance*>` containing all tracked items combined from all inventories in the hierarchy. Useful if you only need the total list regardless of location.
* **`GetTrackedItemDefs() const`:** Returns the `TSet` of item definitions being tracked.

### How Hierarchical Tracking Works Internally

1. **`Initialize`:**
   * Stores the `RootInventory` and `TrackedItemDefs`.
   * Calls `TrackChildInventory(RootInventory)` to begin the recursive scan.
   * Subscribes to `TAG_Lyra_Inventory_Message_StackChanged` using the `GameplayMessageSubsystem`.
2. **`TrackChildInventory(InInventory)`:**
   * Checks if `InInventory` is valid and not already tracked in `CachedItems`.
   * Iterates through `InInventory->GetAllItems()`:
     * If an item matches `TrackedItemDefs`, adds it to a temporary set for this `InInventory`.
     * **Recursion:** Checks if the item has an `InventoryFragment_Container`. If so, resolves its `ChildInventory` and recursively calls `TrackChildInventory` on it.
   * If any matching items were found in `InInventory`, adds the temporary set to the `CachedItems` map with `InInventory` as the key.
3. **`HandleInventoryChanged(Channel, Message)`:**
   * Triggered by `StackChanged` message from _any_ inventory that has been added to the `CachedItems` map (or the root if it was initially empty but later received items).
   * Identifies the `ChangedInventory` from `Message.InventoryOwner`.
   * Checks if `Message.Instance` matches `TrackedItemDefs`.
   * **If Added/Increased:**
     * Ensures `ChangedInventory` exists as a key in `CachedItems`.
     * Adds `Message.Instance` to the set associated with `ChangedInventory`.
     * **Recursion Trigger:** If the added `Message.Instance` is a container, calls `TrackChildInventory` on its child to start monitoring it if not already tracked.
     * Sets `bUpdated = true`.
   * **If Removed/Decreased (Count <= 0):**
     * Removes `Message.Instance` from the set for `ChangedInventory`.
     * If the set becomes empty, removes `ChangedInventory` entirely from the `CachedItems` map.
     * **Recursion Trigger:** If the removed `Message.Instance` was a container, calls `UntrackChildInventory` on its child to stop monitoring it and its descendants.
     * Sets `bUpdated = true`.
   * If `bUpdated` is true, calls `GetItemsGroupedByInventory` to construct the result array and broadcasts the `OnUpdated` / `OnUpdatedWithTrackedDefs` delegates.
4. **`UntrackChildInventory(InInventory)`:**
   * Removes `InInventory` from the `CachedItems` map.
   * Recursively calls `UntrackChildInventory` for any containers _within_ `InInventory` to clean up the entire sub-hierarchy.
5. **`StopListening / BeginDestroy`:** Unregisters the single `GameplayMessageListenerHandle`.

By recursively tracking child inventories discovered through container fragments and listening to messages from all tracked components, `ULyraTetrisInventoryQuery` provides an efficient way to monitor item states across complex, nested storage hierarchies in C++.
