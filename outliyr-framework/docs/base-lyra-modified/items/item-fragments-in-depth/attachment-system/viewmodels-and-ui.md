# viewmodels and ui

You're building a weapon customization screen. The player opens it, sees their rifle with its current attachments, and drags a new scope onto the scope slot. The scope appears immediately - predicted on the client, eventually confirmed by the server, but the player doesn't notice any of that. They just see their scope snap into place.

ViewModels give your widgets a clean interface to attachment state, handling prediction, slot paths, and change tracking behind the scenes.

{% hint style="info" %}
For the underlying MVVM architecture and why ViewModels exist, see [MVVM](../../../ui/item-container-ui-system/core-architecture-and-data-structures/mvvm.md) and [Data Layers (View Models)](../../../ui/item-container-ui-system/data-layers-view-models/).
{% endhint %}

***

### Quick Start: Getting a ViewModel

Use the `ULyraItemContainerUIManager` to acquire ViewModels:

```cpp
void UWeaponCustomizationWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    CachedSource = Source;
    AttachmentVM = Manager->AcquireContainerViewModel(Source);

    // Subscribe to changes
    AttachmentVM->OnChanged.AddDynamic(this, &ThisClass::OnAttachmentsChanged);

    // Bind slot widgets
    BindSlotWidgets();
}

void UWeaponCustomizationWidget::NativeDestruct()
{
    if (AttachmentVM)
    {
        ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
        Manager->ReleaseContainerViewModel(CachedSource);
    }
    Super::NativeDestruct();
}
```

{% hint style="info" %}
For details on the lease system, see [Item Container UI Manager](../../../ui/item-container-ui-system/item-container-ui-manager/).
{% endhint %}

***

### Container ViewModel: The Collection

`ULyraAttachmentViewModel` wraps an item's attachment container and provides:

#### "Get all attached items"

```cpp
const TArray<ULyraItemViewModel*>& Items = AttachmentVM->GetItems();
```

#### "Get slot ViewModels for customization UI"

```cpp
// Get or create slot ViewModels by tag
ULyraAttachmentSlotViewModel* ScopeSlot = AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Scope);
ULyraAttachmentSlotViewModel* GripSlot = AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Grip);
ULyraAttachmentSlotViewModel* MagSlot = AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Magazine);

// Get all slot ViewModels
TArray<ULyraAttachmentSlotViewModel*> AllSlots = AttachmentVM->GetAllSlotViewModels();
```

#### "Check what's in a specific slot"

```cpp
// Get the item ViewModel for a slot (nullptr if empty)
ULyraItemViewModel* AttachedScope = AttachmentVM->GetItemInSlot(TAG_Attachment_Slot_Scope);

if (AttachedScope)
{
    ScopeNameText->SetText(AttachedScope->DisplayName);
}
```

#### "Know when to refresh"

```cpp
AttachmentVM->OnChanged.AddDynamic(this, &ThisClass::OnAttachmentsChanged);

void UMyWidget::OnAttachmentsChanged()
{
    RefreshAllSlotWidgets();
}
```

***

### Slot ViewModel: Individual Positions

`ULyraAttachmentSlotViewModel` represents a single attachment slot - **whether it's occupied or empty**.

#### Attachment-Specific: Tag-Based

Like equipment, attachment slots are identified by GameplayTag:

```cpp
SlotVM->SlotTag  // Attachment.Slot.Scope, Attachment.Slot.Grip, etc.
```

#### Slots Always Exist

Your UI needs widgets for all attachment slots, not just occupied ones. An empty scope slot still needs to render as a "drop scope here" target. The slot ViewModel exists regardless of occupancy:

```cpp
// Empty slot
ScopeSlot->bIsOccupied  // false
ScopeSlot->ItemIcon     // nullptr
ScopeSlot->SlotDescriptor  // Ready for drop operations

// After attaching something
ScopeSlot->bIsOccupied  // true
ScopeSlot->ItemIcon     // The scope's icon
```

#### The `ParentActiveState` Property

This is what makes attachment slots unique. Attachments inherit behavior from their parent item's equipment state:

```cpp
// Rifle is in inventory - attachments are inactive
ScopeSlot->ParentActiveState  // EAttachmentActiveState::Inactive

// Rifle is equipped but holstered
ScopeSlot->ParentActiveState  // EAttachmentActiveState::Holstered

// Rifle is in the player's hands
ScopeSlot->ParentActiveState  // EAttachmentActiveState::Equipped
```

Use this for visual feedback:

```cpp
void UAttachmentSlotWidget::RefreshDisplay()
{
    if (SlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);
        ItemIcon->SetVisibility(ESlateVisibility::Visible);

        // Glow when parent weapon is actively held
        if (SlotVM->ParentActiveState == EAttachmentActiveState::Equipped)
        {
            ActiveGlow->SetVisibility(ESlateVisibility::Visible);
        }
        else
        {
            ActiveGlow->SetVisibility(ESlateVisibility::Collapsed);
        }
    }
    else
    {
        ItemIcon->SetVisibility(ESlateVisibility::Collapsed);
        ActiveGlow->SetVisibility(ESlateVisibility::Collapsed);
        EmptySlotVisual->SetVisibility(ESlateVisibility::Visible);
    }

    // Ghost styling for predictions
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```

📸 SCREENSHOT PLACEHOLDER: Attachment slot showing active state indicator

#### Key Properties

**Slot State:**

| Property            | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `SlotTag`           | Attachment slot tag (Scope, Grip, Magazine)            |
| `bIsOccupied`       | Whether an attachment is in this slot                  |
| `ParentActiveState` | **Attachment-specific:** Parent item's equipment state |
| `bIsFocused`        | Navigation cursor is here                              |
| `bIsSelected`       | Selected for interaction                               |

**Proxied Item Data (when occupied):**

| Property          | When Empty |
| ----------------- | ---------- |
| `ItemIcon`        | nullptr    |
| `ItemDisplayName` | Empty text |
| `StackCount`      | 0          |
| `bIsGhost`        | false      |

#### Drag-Drop Integration

```cpp
// When dropping an attachment onto a slot
FInstancedStruct SourceSlot = SourceSlotVM->SlotDescriptor;
FInstancedStruct DestSlot = AttachmentSlotVM->SlotDescriptor;

// Execute via transaction ability
ItemTransactionAbility->MoveItem(SourceSlot, DestSlot);
```

***

### Item ViewModel: The Actual Item

`ULyraItemViewModel` wraps the item instance with display-ready properties:

| Property      | Purpose                                     |
| ------------- | ------------------------------------------- |
| `Icon`        | Item texture                                |
| `DisplayName` | Item name                                   |
| `StackCount`  | Number in stack (usually 1 for attachments) |
| `TotalWeight` | Weight                                      |
| `bIsGhost`    | Predicted but unconfirmed                   |

{% hint style="info" %}
For ghost state styling, see [Prediction and Visuals](../../../ui/item-container-ui-system/data-layers-view-models/prediction-and-visuals.md).
{% endhint %}

***

### Practical Example: Building a Weapon Customization Screen

📸 SCREENSHOT PLACEHOLDER: Weapon customization widget with attachment slots

{% stepper %}
{% step %}
#### Create the Customization Widget

```cpp
// WeaponCustomizationWidget.h
UCLASS()
class UWeaponCustomizationWidget : public UCommonActivatableWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    UAttachmentSlotWidget* ScopeSlotWidget;

    UPROPERTY(meta = (BindWidget))
    UAttachmentSlotWidget* GripSlotWidget;

    UPROPERTY(meta = (BindWidget))
    UAttachmentSlotWidget* MagazineSlotWidget;

    UPROPERTY(meta = (BindWidget))
    UImage* WeaponPreview;

    UPROPERTY()
    TObjectPtr<ULyraAttachmentViewModel> AttachmentVM;

    FInstancedStruct CachedSource;

public:
    void SetSource(const FInstancedStruct& Source);

protected:
    virtual void NativeDestruct() override;

private:
    void BindSlotWidgets();

    UFUNCTION()
    void OnAttachmentsChanged();
};
```
{% endstep %}

{% step %}
#### Acquire ViewModel and Bind Slots

```cpp
void UWeaponCustomizationWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    CachedSource = Source;
    AttachmentVM = Manager->AcquireContainerViewModel(Source);
    AttachmentVM->OnChanged.AddDynamic(this, &ThisClass::OnAttachmentsChanged);

    BindSlotWidgets();
}

void UWeaponCustomizationWidget::BindSlotWidgets()
{
    ScopeSlotWidget->BindToSlot(AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Scope));
    GripSlotWidget->BindToSlot(AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Grip));
    MagazineSlotWidget->BindToSlot(AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Magazine));
}

void UWeaponCustomizationWidget::NativeDestruct()
{
    if (AttachmentVM)
    {
        ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
        Manager->ReleaseContainerViewModel(CachedSource);
    }
    Super::NativeDestruct();
}

void UWeaponCustomizationWidget::OnAttachmentsChanged()
{
    // Slot widgets update automatically via their bound ViewModels
    // Add any additional refresh logic here (weapon preview, stats display)
}
```
{% endstep %}

{% step %}
#### Create the Slot Widget

```cpp
// AttachmentSlotWidget.h
UCLASS()
class UAttachmentSlotWidget : public UUserWidget
{
    GENERATED_BODY()

protected:
    UPROPERTY(meta = (BindWidget))
    UImage* ItemIcon;

    UPROPERTY(meta = (BindWidget))
    UImage* EmptySlotVisual;

    UPROPERTY(meta = (BindWidget))
    UBorder* ActiveBorder;

    UPROPERTY()
    TWeakObjectPtr<ULyraAttachmentSlotViewModel> SlotVM;

public:
    void BindToSlot(ULyraAttachmentSlotViewModel* InSlotVM);
    void RefreshDisplay();
};

// AttachmentSlotWidget.cpp
void UAttachmentSlotWidget::BindToSlot(ULyraAttachmentSlotViewModel* InSlotVM)
{
    SlotVM = InSlotVM;
    RefreshDisplay();

    // FieldNotify handles automatic updates, or subscribe manually
}

void UAttachmentSlotWidget::RefreshDisplay()
{
    if (!SlotVM.IsValid()) return;

    // Show/hide based on occupation
    EmptySlotVisual->SetVisibility(SlotVM->bIsOccupied ? ESlateVisibility::Collapsed : ESlateVisibility::Visible);
    ItemIcon->SetVisibility(SlotVM->bIsOccupied ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);

    if (SlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(SlotVM->ItemIcon);

        // Active indicator - highlight when weapon is held
        bool bIsActive = SlotVM->ParentActiveState == EAttachmentActiveState::Equipped;
        ActiveBorder->SetBrushColor(bIsActive ? FLinearColor::Green : FLinearColor::Gray);
    }

    // Ghost styling
    SetRenderOpacity(SlotVM->bIsGhost ? 0.5f : 1.0f);
}
```
{% endstep %}
{% endstepper %}

***

### Nested Attachments

Attachments can have their own attachments. A tactical scope might have a laser sight module. The system tracks this hierarchy:

```
Rifle
├── Scope (ContainerPath: [])
│   └── Laser (ContainerPath: [Scope])
└── Grip (ContainerPath: [])
```

The `ContainerPath` property on slot ViewModels reflects nesting depth. When building UI for nested attachments, create a ViewModel for the attachment item itself:

```cpp
// Get the attached scope
ULyraInventoryItemInstance* ScopeItem = ScopeSlotVM->GetItemInstance();

if (ScopeItem)
{
    // Build source descriptor for the scope's attachment container
    FInstancedStruct ScopeAttachmentSource;
    // ... construct source pointing to scope's attachment fragment

    // Acquire ViewModel for the scope's own attachments
    ScopeAttachmentVM = Manager->AcquireContainerViewModel(ScopeAttachmentSource);

    // Now bind to the scope's attachment slots
    LaserSlotWidget->BindToSlot(ScopeAttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Illumination));
}
```

📸 SCREENSHOT PLACEHOLDER: Nested attachment UI showing scope with laser slot

{% hint style="info" %}
For how the transaction system handles nested container paths, see [Runtime Container](runtime-container.md).
{% endhint %}

***
