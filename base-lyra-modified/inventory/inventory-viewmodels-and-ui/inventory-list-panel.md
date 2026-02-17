# Inventory List Panel

You're showing a loot drop, a shop inventory, or a crafting ingredient list. You only care about items that exist - no need for empty slot placeholders. A simple vertical list is sufficient.

`ULyraInventoryListPanel` is the simpler alternative to the tile panel. It wraps `UCommonListView` and binds directly to ItemViewModels.

***

### When to Use This

Choose List Panel when:

* You only want to show occupied items
* Empty slots don't need placeholders
* A vertical or horizontal list is sufficient
* Navigation is 1D (up/down or left/right)

Choose [Tile Panel](inventory-tile-panel.md) instead when:

* You need a grid layout
* Empty slots should be visible and interactable
* Users navigate in 2D

***

### Key Difference: ItemViewModels, Not SlotViewModels

The tile panel uses SlotViewModels (one per slot, including empty). The list panel uses ItemViewModels directly (only existing items).

This means:

* Simpler entry widgets — no need to handle empty state
* No empty slot placeholders — list only shows actual items
* Different data type — your widget receives `ULyraItemViewModel`, not `ULyraInventorySlotViewModel`

***

### Setting Up

{% stepper %}
{% step %}
#### Create a Widget Blueprint

Create a Widget Blueprint that inherits from `ULyraInventoryListPanel`.
{% endstep %}

{% step %}
#### Add the ListView

Add a `UCommonListView` widget and name it exactly **"ListView"** (it's a BindWidget requirement).

Configure the ListView:

* Set `EntryWidgetClass` to your item widget class
{% endstep %}

{% step %}
#### Create Your Entry Widget

Your entry widget receives `ULyraItemViewModel` objects (not SlotViewModels):

```cpp
void UMyItemWidget::NativeOnListItemObjectSet(UObject* ListItemObject)
{
    ULyraItemViewModel* ItemVM = Cast<ULyraItemViewModel>(ListItemObject);
    if (!ItemVM) return;

    // Direct access to item data
    ItemIcon->SetBrushFromTexture(ItemVM->Icon);
    ItemName->SetText(ItemVM->DisplayName);
    ItemWeight->SetText(FText::Format(LOCTEXT("Weight", "{0} kg"), ItemVM->TotalWeight));

    // Stack count
    if (ItemVM->StackCount > 1)
    {
        StackText->SetText(FText::Format(LOCTEXT("Stack", "x{0}"), ItemVM->StackCount));
        StackText->SetVisibility(ESlateVisibility::Visible);
    }
    else
    {
        StackText->SetVisibility(ESlateVisibility::Collapsed);
    }

    // Ghost styling for predictions
    SetRenderOpacity(ItemVM->bIsGhost ? 0.5f : 1.0f);
}
```
{% endstep %}

{% step %}
#### Bind the ViewModel

```cpp
void UMyLootPanel::ShowLoot(ULyraInventoryManagerComponent* LootContainer)
{
    // Create ViewModel
    InventoryVM = NewObject<ULyraInventoryViewModel>(this);
    InventoryVM->Initialize(LootContainer);

    // Bind to list panel
    LootListPanel->SetInventoryViewModel(InventoryVM);
}
```
{% endstep %}
{% endstepper %}

***

### Navigation

#### Navigation Axis

Control which directions navigate the list:

```cpp
// Vertical list (default) - up/down navigates, left/right escapes
ListPanel->NavigationAxis = ELyraListNavigationAxis::Vertical;

// Horizontal list - left/right navigates, up/down escapes
ListPanel->NavigationAxis = ELyraListNavigationAxis::Horizontal;

// Both - all directions navigate (wraps at edges)
ListPanel->NavigationAxis = ELyraListNavigationAxis::Both;
```

#### Wrap Navigation

```cpp
// Wrap at list ends
ListPanel->bWrapNavigation = true;

// Stop at ends (navigation can escape to adjacent panels)
ListPanel->bWrapNavigation = false;
```

***

### Selection Sync

Like the tile panel, selection syncs bidirectionally:

* User selects an item → ViewModel's `FocusedItem` updates
* ViewModel's focus changes → ListView selection updates

```cpp
// Programmatically focus the third item
InventoryVM->SetFocusedSlot(2);
```

***

### Practical Example: Loot Drop UI

<div class="gb-stack">
<details class="gb-toggle">

<summary>Loot Panel Widget</summary>

```cpp
// LootPanel.h
UCLASS()
class ULootPanel : public UCommonActivatableWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    ULyraInventoryListPanel* ItemList;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* LootTitle;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* TotalWeight;

    UPROPERTY()
    ULyraInventoryViewModel* InventoryVM;

public:
    void ShowLoot(ULyraInventoryManagerComponent* LootContainer);

private:
    UFUNCTION()
    void OnItemsChanged();
};

// LootPanel.cpp
void ULootPanel::ShowLoot(ULyraInventoryManagerComponent* LootContainer)
{
    // Create ViewModel
    InventoryVM = NewObject<ULyraInventoryViewModel>(this);
    InventoryVM->Initialize(LootContainer);
    InventoryVM->OnItemsChanged.AddDynamic(this, &ThisClass::OnItemsChanged);

    // Configure list
    ItemList->NavigationAxis = ELyraListNavigationAxis::Vertical;
    ItemList->bWrapNavigation = true;
    ItemList->SetInventoryViewModel(InventoryVM);

    // Initial display
    OnItemsChanged();
}

void ULootPanel::OnItemsChanged()
{
    LootTitle->SetText(FText::Format(
        LOCTEXT("LootTitle", "Loot ({0} items)"),
        InventoryVM->ItemCount));

    TotalWeight->SetText(FText::Format(
        LOCTEXT("TotalWeight", "Total: {0} kg"),
        FText::AsNumber(InventoryVM->TotalWeight)));
}
```



</details>
<details class="gb-toggle">

<summary>Loot Entry Widget</summary>

```cpp
// LootItemWidget.h
UCLASS()
class ULootItemWidget : public UCommonListRow
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    UImage* ItemIcon;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* ItemName;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* StackText;

    UPROPERTY(meta = (BindWidget))
    UTextBlock* WeightText;

    virtual void NativeOnListItemObjectSet(UObject* ListItemObject) override;
};

// LootItemWidget.cpp
void ULootItemWidget::NativeOnListItemObjectSet(UObject* ListItemObject)
{
    Super::NativeOnListItemObjectSet(ListItemObject);

    ULyraItemViewModel* ItemVM = Cast<ULyraItemViewModel>(ListItemObject);
    if (!ItemVM) return;

    // Icon and name
    ItemIcon->SetBrushFromTexture(ItemVM->Icon);
    ItemName->SetText(ItemVM->DisplayName);

    // Stack count
    if (ItemVM->StackCount > 1)
    {
        StackText->SetText(FText::Format(LOCTEXT("Stack", "x{0}"), ItemVM->StackCount));
        StackText->SetVisibility(ESlateVisibility::Visible);
    }
    else
    {
        StackText->SetVisibility(ESlateVisibility::Collapsed);
    }

    // Weight
    WeightText->SetText(FText::Format(LOCTEXT("Weight", "{0} kg"), ItemVM->TotalWeight));

    // Ghost styling
    SetRenderOpacity(ItemVM->bIsGhost ? 0.5f : 1.0f);
}
```



</details>
</div>

***
