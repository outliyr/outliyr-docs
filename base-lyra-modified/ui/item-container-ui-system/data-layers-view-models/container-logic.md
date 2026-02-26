# Container Logic

The `ULyraContainerViewModel` is the "Manager" of the data layer. It doesn't represent a single item; it represents the entire collection.

Its primary job is to take the raw, replicated data from the server (e.g., `ULyraInventoryManagerComponent`) and transform it into a list of ViewModels that UMG can consume.

### The Rebuild Loop

Unlike a simple list, we cannot just "clear and refill" the array every time something changes. If we did that, any active animations, selection states, or focus tracking in the UI would be reset.

We use a **Smart Rebuild** strategy inside `RebuildItemsList`.

#### 1. Preparation

We start by creating a "Scratch Pad" to track which slots are currently valid.

```cpp
void ULyraContainerViewModel::RebuildItemsList()
{
    BeginSlotRebuild(); 
    Items.Empty(); // Clear the output array (bindings), but NOT the cache!
```

#### 2. Iteration & Caching

We iterate through the raw server data. For every entry, we ask: _"Do I already have a ViewModel for this slot?"_

```cpp
    for (const FLyraInventoryEntry& Entry : Entries)
    {
        // Stable Identity: We identify items by their SLOT INDEX, not their pointer.
        // If Item A moves from Slot 1 to Slot 2, it gets a NEW ViewModel.
        // This ensures the ViewModel always represents "Slot X".
        ULyraItemViewModel* ItemVM = GetOrCreateSlotViewModel(Entry.SlotIndex);
        
        // Update the data inside the existing VM
        ItemVM->Initialize(Entry.Instance, SlotDescriptor, StackCount);
        
        Items.Add(ItemVM);
        MarkSlotActive(Entry.SlotIndex);
    }
```

**Why Slot Index?** You might think we should cache by `ItemInstance`. However, in a grid-based UI, the widget represents the _Space_. By keying the cache to the Slot Index, we ensure that the ViewModel associated with "Grid Cell 1" stays stable in memory, even if the item inside it is swapped.

#### 3. Cleanup (`EndSlotRebuild`)

After iterating all valid items, we check our cache. If there are any ViewModels in the cache that were _not_ marked active (i.e., the item was removed or moved), we destroy them.

```cpp
void ULyraContainerViewModel::ClearOrphanedSlotViewModels()
{
    for (auto It = SlotViewModels.CreateIterator(); It; ++It)
    {
        if (!ActiveSlotsDuringRebuild.Contains(It.Key()))
        {
            // This slot is now empty/invalid.
            It.RemoveCurrent();
        }
    }
}
```

### Totals & Aggregates

The Container ViewModel is also responsible for aggregate data. UMG often needs to know "Total Weight" or "Capacity" to show a progress bar.

This is handled in `RecalculateContainerTotals`. It iterates the finalized list of `ItemViewModels` and sums up their properties.

```cpp
void ULyraContainerViewModel::RecalculateContainerTotals()
{
    float NewWeight = 0.0f;
    int32 NewItemCount = 0;

    for (const ULyraItemViewModel* ItemVM : Items)
    {
        NewWeight += ItemVM->TotalWeight;
        NewItemCount += ItemVM->ItemCount;
    }

    // Broadcast changes to UMG via FieldNotify
    UE_MVVM_SET_PROPERTY_VALUE(TotalWeight, NewWeight);
    UE_MVVM_SET_PROPERTY_VALUE(ItemCount, NewItemCount);
}
```

### Event-Driven Updates

The ViewModel does not tick. It is purely reactive. It binds to the `OnViewDirtied` delegate of the underlying component.

* **Server Replication:** When the server replicates a change to the FastArray, `OnViewDirtied` fires.
* **Client Prediction:** When the client predicts a move, the Prediction Runtime fires `OnViewDirtied`.

In both cases, `RebuildItemsList()` runs, ensuring the UI always reflects the current _effective_ state (Server + Prediction).
