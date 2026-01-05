# The Lease System

The Lease System is the memory management backbone of the UI. It solves the problem of sharing expensive ViewModels across multiple widgets without creating duplicate logic or causing memory leaks.

### The Concept

Instead of "Creating" a ViewModel, a widget **"Acquires"** it. Instead of "Destroying" a ViewModel, a widget **"Releases"** it.

The UI Manager acts as the landlord. It keeps track of how many widgets are currently using a specific ViewModel.

* **Ref Count 0 -> 1:** The ViewModel is created and initialized.
* **Ref Count 1 -> 2:** The existing ViewModel is returned.
* **Ref Count 2 -> 1:** Nothing happens.
* **Ref Count 1 -> 0:** The ViewModel is uninitialized and destroyed.

### The Mechanics

#### 1. The Unified Cache Key (`FUnifiedVMCacheKey`)

To share ViewModels, we need to know if two requests are asking for the "same" thing. Since `FInstancedStruct` can hold any type of data, we cannot just compare pointers. We use a composite key:

```cpp
struct FUnifiedVMCacheKey
{
    /** The Class of the struct (e.g., FInventoryContainerSource::StaticStruct()) */
    TObjectPtr<const UScriptStruct> StructType;

    /** The hash computed by the source (e.g., hash of the Component Pointer) */
    uint32 ContentHash;
};
```

This allows us to cache _any_ type of source—Inventory, Equipment, or a custom Crafting Table—in a single map: `TMap<FUnifiedVMCacheKey, TObjectPtr<ULyraContainerViewModel>>`.

#### 2. Acquiring a ViewModel

When `AcquireViewModel(Source)` is called:

1. **Resolve Key:** The Manager calls `Source.GetContentHash()` to build the cache key.
2. **Check Cache:**
   * **Hit:** Increment `UnifiedVMRefCounts` and return the existing instance.
   * **Miss:**
     * Call `Source.CreateViewModel(this)`.
     * Initialize the new VM.
     * Add to `UnifiedViewModelCache`.
     * Set RefCount to 1.
3. **Owner Tracking:** The Manager registers a "Destruction Listener" on the source's Owner (e.g., the `AActor`). If the Actor dies unexpectedly, the Manager can force-release the ViewModel.

#### 3. Releasing a ViewModel

When `ReleaseViewModel(Source)` is called:

1. **Resolve Key:** Rebuild the cache key.
2. **Decrement:** Decrease the RefCount.
3. **Cleanup Check:**
   * If RefCount > 0: Do nothing.
   * If RefCount == 0:
     * Call `ViewModel->Uninitialize()` (Unbinds delegates, clears lists).
     * Remove from `UnifiedViewModelCache`.
     * Remove from `UnifiedVMRefCounts`.

### Stale Data Protection

What happens if a developer forgets to call `ReleaseViewModel`?

Usually, this would be a memory leak. However, the UI Manager has a safety net: **Weak Pointer Owner Tracking**.

```cpp
// Map: Weak Pointer to Owner -> Cache Keys associated with it
TMultiMap<TWeakObjectPtr<UObject>, FUnifiedVMCacheKey> OwnerToUnifiedCacheKeys;
```

If the underlying Inventory Component (the Owner) is garbage collected, the Manager detects this via the `OnUnifiedComponentOwnerDestroyed` delegate or periodic cleanup sweeps. It will then forcibly uninitialize and remove the ViewModel, ensuring the UI doesn't crash trying to read dead memory.

{% hint style="danger" %}
The UI Manager cleanup is not infalliable, it is still advised to use `ReleaseViewModel` and not rely on the container/object being deleted for the view model to be cleaned up.
{% endhint %}

### Integration Example

Here is how you use the lease system manually in a custom widget:

```cpp
// 1. Define the source
FInventoryContainerSource InventorySrc(MyInventoryComponent);
FInstancedStruct Source = FInstancedStruct::Make(InventorySrc);

// 2. Lease the VM
ULyraInventoryViewModel* VM = UIManager->AcquireViewModel(Source);

// ... (Use the VM) ...

// 3. Return the lease (Crucial!)
UIManager->ReleaseViewModel(Source);
```

{% hint style="success" %}
If you are using the `LyraItemContainerWindowShell`, it handles this automatically via `AcquireViewModelLease`. It stores a list of all leases it opened and releases them all in `NativeDestruct`.
{% endhint %}
