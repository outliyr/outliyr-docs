# Inventory Tile Panel

You want a grid-based inventory - rows and columns of item slots, like most RPG games. You want keyboard/gamepad navigation to work in 2D (up, down, left, right). You want empty slots to be visible and interactable.

`ULyraInventoryTilePanel` handles all of this. It wraps `UCommonTileView`, creates SlotViewModels for every slot, and provides 2D navigation.

***

### When to Use This

Choose Tile Panel when:

* You need a grid layout
* Empty slots should be visible
* Users navigate in 2D (up/down/left/right)
* You want the traditional RPG inventory look

Choose [List Panel](inventory-list-panel.md) instead when:

* You only want to show occupied items
* A simple vertical list is sufficient
* Navigation is 1D

***

### Setting Up

{% stepper %}
{% step %}
#### Create a Widget Blueprint

Create a Widget Blueprint that inherits from `ULyraInventoryTilePanel`.
{% endstep %}

{% step %}
#### Add the TileView

Add a `UCommonTileView` widget and name it exactly **"TileView"** (it's a BindWidget requirement).

Configure the TileView:

* Set `EntryWidgetClass` to your slot widget class
* Set `EntryWidth` and `EntryHeight` for grid cell size
{% endstep %}

{% step %}
#### Create Your Slot Widget

Your entry widget receives `ULyraInventorySlotViewModel` objects:

```cpp
void UMySlotWidget::NativeOnListItemObjectSet(UObject* ListItemObject)
{
    ULyraInventorySlotViewModel* SlotVM = Cast<ULyraInventorySlotViewModel>(ListItemObject);
    if (!SlotVM) return;

    // Item icon (or empty placeholder)
    if (SlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);
        ItemIcon->SetVisibility(ESlateVisibility::Visible);
        EmptySlotIcon->SetVisibility(ESlateVisibility::Collapsed);
    }
    else
    {
        ItemIcon->SetVisibility(ESlateVisibility::Collapsed);
        EmptySlotIcon->SetVisibility(ESlateVisibility::Visible);
    }

    // Stack count (only if > 1)
    StackCount->SetVisibility(SlotVM->StackCount > 1 ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
    StackCount->SetText(FText::AsNumber(SlotVM->StackCount));

    // Ghost styling for predictions
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```
{% endstep %}

{% step %}
#### Bind the ViewModel

In your parent inventory screen:

```cpp
void UMyInventoryScreen::NativeConstruct()
{
    Super::NativeConstruct();

    // Get inventory
    auto* Inventory = GetPlayerPawn()->FindComponentByClass<ULyraInventoryManagerComponent>();

    // Create ViewModel
    InventoryVM = NewObject<ULyraInventoryViewModel>(this);
    InventoryVM->Initialize(Inventory);

    // Bind to the tile panel
    InventoryTilePanel->SetInventoryViewModel(InventoryVM);
}
```
{% endstep %}
{% endstepper %}

***

### How It Works Internally

{% stepper %}
{% step %}
#### Create SlotViewModels

The panel creates SlotViewModels for every slot (based on inventory capacity).
{% endstep %}

{% step %}
#### Populate SlotViewModels

It populates them with current item data (including empty slots).
{% endstep %}

{% step %}
#### Feed TileView

SlotViewModels are fed to the TileView as list items.
{% endstep %}

{% step %}
#### Subscribe to Changes

The panel subscribes to changes to auto-refresh. Conceptually:

```
InventoryViewModel.OnItemsChanged
         │
         ▼
  RefreshFromViewModel()
         │
         ├── For each slot: Update SlotViewModel from ItemViewModel
         │
         └── TileView->RequestListRefresh()
```

Entry widgets receive SlotViewModels (not ItemViewModels) so the grid can show empty slots too.
{% endstep %}
{% endstepper %}

***

### Navigation

#### 2D Grid Navigation

The panel handles arrow key / d-pad navigation automatically:

* Up/Down moves between rows
* Left/Right moves within a row

The panel calculates grid position based on TileView dimensions and entry size.

#### Wrap Navigation

Control what happens at grid edges:

```cpp
// Wrap horizontally (left past first column → last column of same row)
TilePanel->bWrapNavigationHorizontal = true;

// Wrap vertically (up past first row → bottom of same column)
TilePanel->bWrapNavigationVertical = true;
```

When wrap is disabled, navigation at edges can escape to adjacent panels (useful for multi-panel inventory screens).

***

### Selection Sync

The panel keeps the TileView's selection synchronized with the ViewModel's focus:

* User selects a tile → ViewModel's `FocusedItem` updates
* ViewModel's focus changes → TileView selection updates

This bidirectional sync means you can programmatically focus items:

```cpp
// Focus slot 5 - both ViewModel and TileView update
InventoryVM->SetFocusedSlot(5);
```

***

### Practical Example: Complete Inventory Screen

<details>

<summary>Inventory Screen</summary>

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
    ULyraInventoryViewModel* InventoryVM;

    virtual void NativeConstruct() override;
    virtual void NativeDestruct() override;

private:
    UFUNCTION()
    void OnItemsChanged();
};
```

```cpp
// MyInventoryScreen.cpp
void UMyInventoryScreen::NativeConstruct()
{
    Super::NativeConstruct();

    if (APlayerController* PC = GetOwningPlayer())
    {
        if (APawn* Pawn = PC->GetPawn())
        {
            if (auto* Inventory = Pawn->FindComponentByClass<ULyraInventoryManagerComponent>())
            {
                // Create ViewModel
                InventoryVM = NewObject<ULyraInventoryViewModel>(this);
                InventoryVM->Initialize(Inventory);
                InventoryVM->OnItemsChanged.AddDynamic(this, &ThisClass::OnItemsChanged);

                // Configure navigation
                InventoryGrid->bWrapNavigationHorizontal = false;
                InventoryGrid->bWrapNavigationVertical = false;

                // Bind
                InventoryGrid->SetInventoryViewModel(InventoryVM);

                // Initial update
                OnItemsChanged();
            }
        }
    }
}

void UMyInventoryScreen::NativeDestruct()
{
    if (InventoryVM)
    {
        InventoryVM->Uninitialize();
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



</details>

<details>

<summary>Inventory Grid Entry Widget </summary>

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
```

```cpp
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

    // Ghost styling
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```



</details>

***
