# DataFlow & Reactivity

The Item Container UI is **reactive**, when data changes in the backend, the UI updates automatically. No manual refresh calls, no polling, no "why isn't my UI updating?" debugging sessions. This page explains how that magic works.

***

### The Reactive Loop

```mermaid
sequenceDiagram
    participant Backend as Backend Component
    participant VM as ViewModel
    participant Widget as Widget

    Backend->>Backend: Item added/removed/changed
    Backend->>VM: OnViewDirtied fires
    VM->>VM: RebuildItemsList()
    VM->>VM: UE_MVVM_SET_PROPERTY_VALUE(Items)
    VM->>Widget: FieldNotify broadcasts change
    Widget->>Widget: Automatically refreshes
```

**Key insight**: You never call `widget->Refresh()`. The ViewModel sets a property, and any widget bound to that property updates automatically.

***

### FieldNotify: Unreal's Reactive Secret

Unreal's `FieldNotify` system (used by UMG View Binding) is the foundation of reactivity. Here's how it works:

#### Declaring a Reactive Property

```cpp
UPROPERTY(BlueprintReadOnly, FieldNotify, Category = "Item")
FText DisplayName;
```

The `FieldNotify` specifier tells Unreal to track this property for binding.

#### Setting a Reactive Property

```cpp
// This macro does two things:
// 1. Sets the value
// 2. Broadcasts the change to all bound widgets
UE_MVVM_SET_PROPERTY_VALUE(DisplayName, NewName);
```

> [!WARNING]
> **Never set FieldNotify properties directly!** Using `DisplayName = NewName;` bypasses the notification system and your UI won't update.

#### Binding in Blueprint

{% stepper %}
{% step %}
Select a Text widget in the UMG designer.
{% endstep %}

{% step %}
Click "Bind" next to the Text property.
{% endstep %}

{% step %}
Choose "View Binding".
{% endstep %}

{% step %}
Select `ItemViewModel.DisplayName`.
{% endstep %}
{% endstepper %}

Now whenever `DisplayName` changes, the Text widget updates automatically.

<img src=".gitbook/assets/image (14).png" alt="" title="Example of binding Equipment Slot View Model values to the Item Icon and Background Icon">

***

### How Backend Changes Reach the UI

Let's trace what happens when an item is added to inventory:

```mermaid
flowchart TB
    subgraph Step1 ["1. Backend Change"]
        A1[Server adds item to inventory]
        A2[FLyraInventoryList replicates to client]
    end

    subgraph Step2 ["2. Signal Fires"]
        B1[Inventory component fires OnViewDirtied]
        B2[ViewModel receives signal]
    end

    subgraph Step3 ["3. ViewModel Rebuilds"]
        C1[RebuildItemsList called]
        C2[Create/update ItemViewModels]
        C3[UE_MVVM_BROADCAST Items changed]
    end

    subgraph Step4 ["4. Widget Updates"]
        D1[ListView receives Items change]
        D2[New entry widget created]
        D3[Entry binds to ItemViewModel]
    end

    Step1 --> Step2 --> Step3 --> Step4
```

#### Step-by-Step Breakdown

**1. Backend Change**

```cpp
// On server
InventoryManager->AddItemToSlot(ItemInstance, SlotIndex);
// FLyraInventoryList marks entry dirty for replication
```

**2. Signal Fires**

```cpp
// In ULyraInventoryManagerComponent
void PostReplicatedAdd(const FLyraInventoryEntry& Entry)
{
    // Notify that our view of the inventory changed
    OnViewDirtied.Broadcast();
}
```

**3. ViewModel Rebuilds**

```cpp
// In ULyraInventoryViewModel
void HandleViewDirtied()
{
    RebuildItemsList();
}

void RebuildItemsList()
{
    TArray<ULyraItemViewModel*> NewItems;

    for (const auto& Entry : InventoryList.Entries)
    {
        // Reuse existing VM if we have one for this slot using the stable identity
        ULyraItemViewModel* ItemVM = GetOrCreateItemViewModel(Entry.SlotIndex);
        ItemVM->Initialize(Entry.Instance, Entry.StackCount);
        NewItems.Add(ItemVM);
    }

    // This broadcasts the change
    UE_MVVM_SET_PROPERTY_VALUE(Items, NewItems);
}
```

**4. Widget Updates**

```cpp
// ListView is bound to Items property
// UMG automatically calls SetListItems when Items changes
// Entry widgets are created/destroyed as needed
// Each entry widget binds to its ItemViewModel
```

***

### The "Never Manual Refresh" Philosophy

Traditional UI code is littered with manual updates:

```cpp
// BAD: Manual refresh everywhere
void OnItemPickedUp() { RefreshInventory(); }
void OnItemDropped() { RefreshInventory(); }
void OnItemMoved() { RefreshInventory(); }
void OnItemStacked() { RefreshInventory(); }
void OnInventoryOpened() { RefreshInventory(); } // Just in case...
```

With reactive binding:

```cpp
// GOOD: Just update the data
void OnItemPickedUp() { /* Backend handles it */ }
// ViewModel is subscribed to OnViewDirtied
// Widget is bound to ViewModel properties
// Everything updates automatically
```

> [!SUCCESS]
> **The Reactive Guarantee**: If the backend data changes and fires `OnViewDirtied`, the UI will update. No exceptions.

***

### Stable Identity: Preserving Selection

When the item list rebuilds, you don't want to lose selection state. The system uses **stable identity** via `SlotIndex`:

```mermaid
flowchart LR
    subgraph Before ["Before Rebuild"]
        A1["Slot 0: Sword (selected)"]
        A2["Slot 1: Shield"]
        A3["Slot 2: Potion"]
    end

    subgraph After ["After Rebuild (item added)"]
        B1["Slot 0: Sword (still selected!)"]
        B2["Slot 1: Shield"]
        B3["Slot 2: Potion"]
        B4["Slot 3: New Item"]
    end

    Before -->|"RebuildItemsList"| After
```

**How it works:**

```cpp
ULyraItemViewModel* GetOrCreateItemViewModel(int32 SlotIndex)
{
    // Check cache first
    if (ULyraItemViewModel* Existing = SlotViewModels.FindRef(SlotIndex))
    {
        return Existing; // Reuse! Focus/selection preserved
    }

    // Create new only if needed
    ULyraItemViewModel* NewVM = NewObject<ULyraItemViewModel>();
    SlotViewModels.Add(SlotIndex, NewVM);
    return NewVM;
}
```

The same ViewModel instance is reused for the same slot, so any state on it (focus, selection, custom properties) persists across rebuilds.

***

### Property Change Events

For more control, you can subscribe to specific property changes:

#### In Blueprints

Use the `OnFieldValueChanged` node with the property name.

#### In C++

```cpp
// Subscribe to a specific property change
ItemViewModel->FieldNotifyDelegate(
    ULyraItemViewModel::FFieldNotificationClassDescriptor::StackCount
).AddUObject(this, &UMyWidget::OnStackCountChanged);
```

### Common Events

| ViewModel            | Event/Property         | When It Fires                        |
| -------------------- | ---------------------- | ------------------------------------ |
| `ContainerViewModel` | `OnItemsChanged`       | Items added/removed/reordered        |
| `ContainerViewModel` | `OnFocusedItemChanged` | User navigates to different item     |
| `ItemViewModel`      | `OnStatTagChanged`     | Item stats change (durability, ammo) |
| `ItemViewModel`      | `bIsGhost`             | Prediction state changes             |

***

### Debugging Data Flow

If your UI isn't updating, check these points in order:

```mermaid
flowchart TB
    A[UI not updating?] --> B{Is OnViewDirtied firing?}
    B -->|No| C[Check backend - is data actually changing?]
    B -->|Yes| D{Is ViewModel rebuilding?}
    D -->|No| E[Check subscription - is VM listening?]
    D -->|Yes| F{Is property broadcasting?}
    F -->|No| G[Check UE_MVVM_SET_PROPERTY_VALUE usage]
    F -->|Yes| H{Is widget bound?}
    H -->|No| I[Check View Binding in UMG]
    H -->|Yes| J[Check widget logic]
```

> [!INFO]
> **Quick Debug**: Add `UE_LOG` in `RebuildItemsList()` and watch the Output Log. If it's firing but the UI doesn't update, the problem is in the binding. If it's not firing, the problem is in the signal chain.

***

## Next Steps

Now that you understand how data flows, let's look at why the system uses windows instead of a single panel in [The Window Model](the-window-model.md).
