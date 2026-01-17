# Inventory Viewmodels and UI

You're building an inventory screen. A grid of slots showing the player's items, with capacity bars, drag-drop support, and instant feedback when items move. The inventory is networked, but the player shouldn't notice - everything should feel responsive.

ViewModels bridge the gap between your widgets and the inventory system. They provide bindable properties, handle prediction automatically, and keep your UI code clean.

{% hint style="info" %}
For the underlying MVVM architecture and why ViewModels exist, see [MVVM](../../ui/item-container-ui-system/core-architecture-and-data-structures/mvvm.md) and [Data Layers (View Models)](../../ui/item-container-ui-system/data-layers-view-models/).
{% endhint %}

***

### Quick Start: Getting a ViewModel

Use the `ULyraItemContainerUIManager` to acquire ViewModels. This ensures shared ViewModels, proper cleanup, and consistent state across widgets.

```cpp
void UMyInventoryWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    CachedSource = Source;
    InventoryVM = Manager->AcquireContainerViewModel(Source);

    // Subscribe to changes
    InventoryVM->OnItemsChanged.AddDynamic(this, &ThisClass::OnInventoryChanged);
}

void UMyInventoryWidget::NativeDestruct()
{
    if (InventoryVM)
    {
        ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
        Manager->ReleaseContainerViewModel(CachedSource);
    }
    Super::NativeDestruct();
}
```

{% hint style="info" %}
For details on the lease system and `ULyraItemContainerWindowShell` (which handles acquire/release automatically), see [Item Container UI Manager](../../ui/item-container-ui-system/item-container-ui-manager/).
{% endhint %}

***

### Container ViewModel: The Collection

`ULyraInventoryViewModel` wraps an `ULyraInventoryManagerComponent` and provides:

"Show all items"

```cpp
const TArray<ULyraItemViewModel*>& Items = InventoryVM->GetItems();

// Or pass to built-in panels
TilePanel->SetInventoryViewModel(InventoryVM);
```

"Display capacity stats"

```cpp
int32 ItemCount = InventoryVM->ItemCount;      // Current items
int32 Capacity = InventoryVM->Capacity;        // Max slots
float TotalWeight = InventoryVM->TotalWeight;  // Sum of all item weights
float MaxWeight = InventoryVM->MaxWeight;      // Weight limit

// For capacity bar
CapacityText->SetText(FText::Format(LOCTEXT("Cap", "{0}/{1}"), ItemCount, Capacity));
WeightBar->SetPercent(TotalWeight / MaxWeight);
```

"Track focused item for details panel"

```cpp
// Get currently focused item
ULyraItemViewModel* Focused = InventoryVM->FocusedItem;

// Set focus programmatically
InventoryVM->SetFocusedSlot(5);  // Focus slot 5

// React to focus changes
InventoryVM->OnFocusedItemChanged.AddDynamic(this, &ThisClass::HandleFocusChanged);

void UMyWidget::HandleFocusChanged(ULyraItemViewModel* Previous, ULyraItemViewModel* Current)
{
    if (Current)
    {
        DetailsPanel->SetVisibility(ESlateVisibility::Visible);
        ItemNameText->SetText(Current->DisplayName);
    }
    else
    {
        DetailsPanel->SetVisibility(ESlateVisibility::Collapsed);
    }
}
```

"Know when to refresh"

```cpp
InventoryVM->OnItemsChanged.AddDynamic(this, &ThisClass::OnInventoryChanged);

void UMyWidget::OnInventoryChanged()
{
    // Rebuild your display
    RefreshCapacityDisplay();
}
```

***

### Slot ViewModel: Individual Positions

`ULyraInventorySlotViewModel` represents a single slot in the inventory - **whether it's occupied or empty**.

#### Why Slots Always Exist

Consider a 20-slot inventory with 5 items. Your grid needs 20 widgets, not 5. Empty slots need:

* Placeholder graphics
* Drop target behavior
* Focus/selection state

Slot ViewModels solve this by providing **one ViewModel per slot**, regardless of occupancy.

{% hint style="info" %}
You can read this [persistent slot pattern](../../ui/item-container-ui-system/data-layers-view-models/persistent-slot-pattern.md) for more detail on this.
{% endhint %}

#### Inventory-Specific: Index-Based

Unlike equipment (tag-based), inventory slots are identified by index:

```cpp
SlotVM->SlotIndex  // 0, 1, 2, 3...
```

#### Key Properties

**Slot State:**

| Property      | Purpose                         |
| ------------- | ------------------------------- |
| `SlotIndex`   | 0-based position in inventory   |
| `bIsOccupied` | Whether an item is in this slot |
| `bIsFocused`  | Navigation cursor is here       |
| `bIsSelected` | Selected for interaction        |

**Proxied Item Data (when occupied):**

| Property          | When Empty |
| ----------------- | ---------- |
| `ItemIcon`        | nullptr    |
| `ItemDisplayName` | Empty text |
| `StackCount`      | 0          |
| `TotalWeight`     | 0          |
| `bIsGhost`        | false      |

#### Building a Slot Widget

```cpp
void UMySlotWidget::NativeOnListItemObjectSet(UObject* ListItemObject)
{
    ULyraInventorySlotViewModel* SlotVM = Cast<ULyraInventorySlotViewModel>(ListItemObject);
    if (!SlotVM) return;

    // Show item or empty placeholder
    if (SlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);
        ItemIcon->SetVisibility(ESlateVisibility::Visible);
        EmptyIcon->SetVisibility(ESlateVisibility::Collapsed);

        // Stack count (only show if > 1)
        StackText->SetVisibility(SlotVM->StackCount > 1 ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
        StackText->SetText(FText::AsNumber(SlotVM->StackCount));
    }
    else
    {
        ItemIcon->SetVisibility(ESlateVisibility::Collapsed);
        EmptyIcon->SetVisibility(ESlateVisibility::Visible);
        StackText->SetVisibility(ESlateVisibility::Collapsed);
    }

    // Ghost styling for predicted items
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);

    // Focus border
    FocusBorder->SetVisibility(SlotVM->bIsFocused ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
}
```

#### Drag-Drop Integration

The `SlotDescriptor` property contains a pre-built descriptor for the transaction system:

```cpp
// When starting a drag
FInstancedStruct SourceSlot = SlotVM->SlotDescriptor;

// When dropping
FInstancedStruct DestSlot = TargetSlotVM->SlotDescriptor;

// Execute the move
ItemTransactionAbility->MoveItem(SourceSlot, DestSlot);
```

This works for both occupied and empty slots - empty slots are valid drop targets.

***

### Item ViewModel: The Actual Item

`ULyraItemViewModel` wraps the item instance with display-ready properties:

| Property      | Purpose                   |
| ------------- | ------------------------- |
| `Icon`        | Item texture              |
| `DisplayName` | Item name                 |
| `StackCount`  | Number in stack           |
| `TotalWeight` | Weight of entire stack    |
| `Description` | Item description          |
| `bIsGhost`    | Predicted but unconfirmed |

#### Live Updates for Stat Tags

For items with changing stats (ammo, durability):

```cpp
ItemVM->OnStatTagChanged.AddDynamic(this, &ThisClass::HandleStatChanged);

void UMyWidget::HandleStatChanged(FGameplayTag Tag, int32 NewValue)
{
    if (Tag == TAG_Weapon_Ammo)
    {
        AmmoText->SetText(FText::AsNumber(NewValue));
    }
}
```

{% hint style="info" %}
For ghost state styling patterns, see [Prediction and Visuals](../../ui/item-container-ui-system/data-layers-view-models/prediction-and-visuals.md).
{% endhint %}

***

### Built-In Panels

The system provides two ready-made panels that handle the common cases.

#### `ULyraInventoryListPanel` (List)

For simpler lists showing only occupied items:

Use when:

* You only want to show items that exist
* No empty slot placeholders needed
* Navigation is 1D (up/down or left/right)
* Good for: loot drops, shop inventories, crafting ingredients

{% hint style="info" %}
You can read [Inventory List Panel](inventory-list-panel.md) page for more detail.
{% endhint %}

#### `ULyraInventoryTilePanel` (Grid)

For traditional RPG-style grid inventories:

Use when:

* You need a grid layout
* Empty slots should be visible
* Navigation is 2D (up/down/left/right)

{% hint style="info" %}
You can read [Inventory Tile Panel](inventory-tile-panel.md) page for more detail.
{% endhint %}

#### When to Use Custom Widgets

Build custom if you need:

* Non-standard layouts (hexagonal, radial)
* Complex slot interactions beyond CommonUI
* Tetris-style spatial inventory (see TetrisInventory plugin)

***

### Practical Example: Building an Inventory Grid

📸 SCREENSHOT PLACEHOLDER: Completed inventory grid in editor

{% stepper %}
{% step %}
#### Create the Screen Widget

```cpp
// MyInventoryScreen.h
UCLASS()
class UMyInventoryScreen : public UCommonActivatableWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    ULyraInventoryTilePanel* InventoryGrid;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* CapacityText;

    UPROPERTY(meta = (BindWidget))
    UProgressBar* WeightBar;

    UPROPERTY()
    TObjectPtr<ULyraInventoryViewModel> InventoryVM;

    FInstancedStruct CachedSource;

public:
    void SetSource(const FInstancedStruct& Source);

protected:
    virtual void NativeDestruct() override;

private:
    UFUNCTION()
    void OnItemsChanged();
};
```
{% endstep %}

{% step %}
#### Acquire ViewModel and Bind

```cpp
void UMyInventoryScreen::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    CachedSource = Source;
    InventoryVM = Manager->AcquireContainerViewModel(Source);
    InventoryVM->OnItemsChanged.AddDynamic(this, &ThisClass::OnItemsChanged);

    // Configure navigation
    InventoryGrid->bWrapNavigationHorizontal = false;
    InventoryGrid->bWrapNavigationVertical = false;

    // Bind to panel
    InventoryGrid->SetInventoryViewModel(InventoryVM);

    // Initial display
    OnItemsChanged();
}

void UMyInventoryScreen::NativeDestruct()
{
    if (InventoryVM)
    {
        ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
        Manager->ReleaseContainerViewModel(CachedSource);
    }
    Super::NativeDestruct();
}

void UMyInventoryScreen::OnItemsChanged()
{
    CapacityText->SetText(FText::Format(
        LOCTEXT("Capacity", "{0}/{1}"),
        InventoryVM->ItemCount,
        InventoryVM->Capacity));

    if (InventoryVM->MaxWeight > 0)
    {
        WeightBar->SetPercent(InventoryVM->TotalWeight / InventoryVM->MaxWeight);
    }
}
```
{% endstep %}

{% step %}
#### Create the Slot Widget

```cpp
// MySlotWidget.h
UCLASS()
class UMySlotWidget : public UCommonListRow
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    UImage* ItemIcon;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* StackCount;

    UPROPERTY(meta = (BindWidget))
    UImage* EmptySlotIcon;

    UPROPERTY(meta = (BindWidget))
    UBorder* FocusBorder;

    virtual void NativeOnListItemObjectSet(UObject* ListItemObject) override;
};

// MySlotWidget.cpp
void UMySlotWidget::NativeOnListItemObjectSet(UObject* ListItemObject)
{
    Super::NativeOnListItemObjectSet(ListItemObject);

    ULyraInventorySlotViewModel* SlotVM = Cast<ULyraInventorySlotViewModel>(ListItemObject);
    if (!SlotVM) return;

    // Item display
    ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);
    ItemIcon->SetVisibility(SlotVM->bIsOccupied ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);

    // Empty placeholder
    EmptySlotIcon->SetVisibility(SlotVM->bIsOccupied ? ESlateVisibility::Collapsed : ESlateVisibility::Visible);

    // Stack count
    StackCount->SetText(FText::AsNumber(SlotVM->StackCount));
    StackCount->SetVisibility(SlotVM->StackCount > 1 ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);

    // Ghost styling for predictions
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```
{% endstep %}
{% endstepper %}
