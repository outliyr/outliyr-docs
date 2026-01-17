# Equipment ViewModels

You're building a paperdoll screen showing where items are equipped on the player's body. Back slot, hip slot, chest slot - each needs to show what's equipped there, and whether the item is currently held or holstered. When the player draws their weapon, the UI should update.

ViewModels give your widgets a clean interface to equipment state, handling the two-level slot model and change tracking behind the scenes.

{% hint style="info" %}
For the underlying MVVM architecture and why ViewModels exist, see [MVVM](../ui/item-container-ui-system/core-architecture-and-data-structures/mvvm.md) and [Data Layers (View Models)](../ui/item-container-ui-system/data-layers-view-models/).
{% endhint %}

***

### Quick Start: Getting a ViewModel

Use the `ULyraItemContainerUIManager` to acquire ViewModels:

```cpp
void UPaperdollWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    CachedSource = Source;
    EquipmentVM = Manager->AcquireContainerViewModel(Source);

    // Subscribe to changes
    EquipmentVM->OnEquipmentChanged.AddDynamic(this, &ThisClass::OnEquipmentChanged);

    // Bind slot widgets
    BindSlotWidgets();
}

void UPaperdollWidget::NativeDestruct()
{
    if (EquipmentVM)
    {
        ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
        Manager->ReleaseContainerViewModel(CachedSource);
    }
    Super::NativeDestruct();
}
```

{% hint style="info" %}
For details on the lease system, see [Item Container UI Manager](../ui/item-container-ui-system/item-container-ui-manager/).
{% endhint %}

***

### Container ViewModel: The Collection

`ULyraEquipmentViewModel` wraps an `ULyraEquipmentManagerComponent` and provides:

#### "Get all equipped items"

```cpp
const TArray<ULyraItemViewModel*>& Items = EquipmentVM->GetItems();
```

#### "Get slot ViewModels for paperdoll"

```cpp
// Get or create slot ViewModels by tag
ULyraEquipmentSlotViewModel* BackSlotVM = EquipmentVM->GetOrCreateSlotViewModel(TAG_Equipment_Slot_Back);
ULyraEquipmentSlotViewModel* HipSlotVM = EquipmentVM->GetOrCreateSlotViewModel(TAG_Equipment_Slot_Hip);

// Get all slot ViewModels
TArray<ULyraEquipmentSlotViewModel*> AllSlots = EquipmentVM->GetAllEquipmentSlotViewModels();
```

#### "Track focused item"

```cpp
// Get currently focused slot
FGameplayTag FocusedTag = EquipmentVM->GetFocusedSlotTag();

// Set focus programmatically
EquipmentVM->SetFocusedSlot(TAG_Equipment_Slot_Back);

// React to focus changes
EquipmentVM->OnFocusedItemChanged.AddDynamic(this, &ThisClass::HandleFocusChanged);
```

#### "Know when to refresh"

```cpp
EquipmentVM->OnEquipmentChanged.AddDynamic(this, &ThisClass::OnEquipmentChanged);

void UMyWidget::OnEquipmentChanged()
{
    RefreshAllSlotWidgets();
}
```

***

### Slot ViewModel: Individual Positions

`ULyraEquipmentSlotViewModel` represents a single equipment slot - **whether it's occupied or empty**.

#### Equipment-Specific: Tag-Based

Unlike inventory (index-based), equipment slots are identified by GameplayTag:

```cpp
SlotVM->SlotTag  // Equipment.Slot.Back, Equipment.Slot.Hip, etc.
```

#### The `bIsHeld` Property

This is what makes equipment slots unique. Equipment has two states: **holstered** (on your back) and **held** (in your hands).

```cpp
// The rifle is equipped on back, currently in hand
BackSlotVM->bIsOccupied  // true - something's in the back slot
BackSlotVM->bIsHeld      // true - that item is currently held

// Player holsters the rifle
BackSlotVM->bIsOccupied  // true - still equipped
BackSlotVM->bIsHeld      // false - now holstered
```

Use this for visual feedback:

```cpp
void UEquipmentSlotWidget::RefreshDisplay()
{
    if (SlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);
        ItemIcon->SetVisibility(ESlateVisibility::Visible);

        // Glow when held
        if (SlotVM->bIsHeld)
        {
            HeldGlow->SetVisibility(ESlateVisibility::Visible);
            HeldGlow->PlayAnimation(PulseAnimation);
        }
        else
        {
            HeldGlow->SetVisibility(ESlateVisibility::Collapsed);
        }
    }
    else
    {
        ItemIcon->SetVisibility(ESlateVisibility::Collapsed);
        HeldGlow->SetVisibility(ESlateVisibility::Collapsed);
    }

    // Ghost styling for predictions
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```

📸 SCREENSHOT PLACEHOLDER: Held indicator showing active weapon

#### Key Properties

**Slot State:**

| Property      | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `SlotTag`     | Equipment slot tag (Back, Hip, Chest)              |
| `bIsOccupied` | Whether an item is equipped here                   |
| `bIsHeld`     | **Equipment-specific:** Is the item actively held? |
| `bIsFocused`  | Navigation cursor is here                          |
| `bIsSelected` | Selected for interaction                           |

**Proxied Item Data (when occupied):**

| Property          | When Empty |
| ----------------- | ---------- |
| `ItemIcon`        | nullptr    |
| `ItemDisplayName` | Empty text |
| `StackCount`      | 0          |
| `bIsGhost`        | false      |

**Equipment Instance Access:**

| Property            | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `EquipmentInstance` | Direct reference to the equipment instance |

#### Accessing the Equipment Instance

For advanced use cases, access the actual equipment:

```cpp
ULyraEquipmentInstance* Equipment = SlotVM->EquipmentInstance;

if (Equipment)
{
    // Read tag attributes
    float Damage = Equipment->GetTagAttributeValue(TAG_Weapon_Damage);

    // Access the inventory item for persistent data
    ULyraInventoryItemInstance* Item = Equipment->GetInstigator();
    int32 AmmoCount = Item->GetStatTagStackCount(TAG_Ammo);
}
```

#### Drag-Drop Integration

```cpp
// When dropping an item onto an equipment slot
FInstancedStruct SourceSlot = SourceSlotVM->SlotDescriptor;
FInstancedStruct DestSlot = EquipmentSlotVM->SlotDescriptor;

// Execute via transaction ability
ItemTransactionAbility->MoveItem(SourceSlot, DestSlot);
```

{% hint style="info" %}
For the two-level slot model (storage vs held slots), see [Equipment Manager Component](equipment-manager-component.md).
{% endhint %}

***

### Item ViewModel: The Actual Item

`ULyraItemViewModel` wraps the item instance with display-ready properties:

| Property      | Purpose                                   |
| ------------- | ----------------------------------------- |
| `Icon`        | Item texture                              |
| `DisplayName` | Item name                                 |
| `StackCount`  | Number in stack (usually 1 for equipment) |
| `TotalWeight` | Weight                                    |
| `bIsGhost`    | Predicted but unconfirmed                 |

{% hint style="info" %}
For ghost state styling, see [Prediction and Visuals](../ui/item-container-ui-system/data-layers-view-models/prediction-and-visuals.md).
{% endhint %}

***

### Practical Example: Building a Paperdoll

📸 SCREENSHOT PLACEHOLDER: Paperdoll widget with equipped items

{% stepper %}
{% step %}
### Create the Paperdoll Widget

```cpp
// PaperdollWidget.h
UCLASS()
class UPaperdollWidget : public UCommonActivatableWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    UEquipmentSlotWidget* BackSlotWidget;

    UPROPERTY(meta = (BindWidget))
    UEquipmentSlotWidget* HipSlotWidget;

    UPROPERTY(meta = (BindWidget))
    UEquipmentSlotWidget* ChestSlotWidget;

    UPROPERTY()
    TObjectPtr<ULyraEquipmentViewModel> EquipmentVM;

    FInstancedStruct CachedSource;

public:
    void SetSource(const FInstancedStruct& Source);

protected:
    virtual void NativeDestruct() override;

private:
    void BindSlotWidgets();

    UFUNCTION()
    void OnEquipmentChanged();
};
```
{% endstep %}

{% step %}
### Acquire ViewModel and Bind Slots

```cpp
void UPaperdollWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    CachedSource = Source;
    EquipmentVM = Manager->AcquireContainerViewModel(Source);
    EquipmentVM->OnEquipmentChanged.AddDynamic(this, &ThisClass::OnEquipmentChanged);

    BindSlotWidgets();
}

void UPaperdollWidget::BindSlotWidgets()
{
    BackSlotWidget->BindToSlot(EquipmentVM->GetOrCreateSlotViewModel(TAG_Equipment_Slot_Back));
    HipSlotWidget->BindToSlot(EquipmentVM->GetOrCreateSlotViewModel(TAG_Equipment_Slot_Hip));
    ChestSlotWidget->BindToSlot(EquipmentVM->GetOrCreateSlotViewModel(TAG_Equipment_Slot_Chest));
}

void UPaperdollWidget::NativeDestruct()
{
    if (EquipmentVM)
    {
        ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
        Manager->ReleaseContainerViewModel(CachedSource);
    }
    Super::NativeDestruct();
}

void UPaperdollWidget::OnEquipmentChanged()
{
    // Slot widgets update automatically via their bound ViewModels
    // Add any additional refresh logic here
}
```
{% endstep %}

{% step %}
### Create the Slot Widget

```cpp
// EquipmentSlotWidget.h
UCLASS()
class UEquipmentSlotWidget : public UUserWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    UImage* ItemIcon;

    UPROPERTY(meta = (BindWidget))
    UImage* EmptySlotVisual;

    UPROPERTY(meta = (BindWidget))
    UBorder* HeldBorder;

    UPROPERTY()
    TWeakObjectPtr<ULyraEquipmentSlotViewModel> SlotVM;

public:
    void BindToSlot(ULyraEquipmentSlotViewModel* InSlotVM);
    void RefreshDisplay();
};

// EquipmentSlotWidget.cpp
void UEquipmentSlotWidget::BindToSlot(ULyraEquipmentSlotViewModel* InSlotVM)
{
    SlotVM = InSlotVM;
    RefreshDisplay();

    // FieldNotify handles automatic updates, or subscribe manually
}

void UEquipmentSlotWidget::RefreshDisplay()
{
    if (!SlotVM.IsValid()) return;

    // Show/hide based on occupation
    EmptySlotVisual->SetVisibility(SlotVM->bIsOccupied ? ESlateVisibility::Collapsed : ESlateVisibility::Visible);
    ItemIcon->SetVisibility(SlotVM->bIsOccupied ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);

    if (SlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);

        // Held indicator - green when in hand, gray when holstered
        HeldBorder->SetBrushColor(SlotVM->bIsHeld ? FLinearColor::Green : FLinearColor::Gray);
    }

    // Ghost styling
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```
{% endstep %}
{% endstepper %}
