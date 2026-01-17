# Attachment Viewmodels

You're building a weapon customization screen. The player opens it, sees their rifle with its current attachments, drags a new scope onto the scope slot, and sees it update immediately. Behind the scenes, prediction is happening, the transaction system is validating, and eventually the server confirms - but the player doesn't care about any of that. They just want to see their scope appear.

ViewModels exist to bridge that gap. They give your UI widgets a clean, reactive interface to attachment state while handling all the underlying complexity.

***

### Why Not Use the Runtime Container Directly?

You could bind your widgets directly to `UTransientRuntimeFragment_Attachment`. But you'd need to:

* Subscribe to `OnViewDirtied` delegates and rebuild on every change
* Understand prediction overlays and effective views
* Construct slot descriptors for the transaction system
* Track container paths for nested attachment hierarchies
* Handle slots that don't exist yet (empty slots still need widgets)

ViewModels handle all of this. Your widgets just read properties and respond to changes.

{% hint style="info" %}
You can read on this section to better understand [View models](../../../ui/item-container-ui-system/core-architecture-and-data-structures/mvvm.md). This is page is specific to the attachment view model
{% endhint %}

***

### Getting ViewModels: The UI Manager

Use the `ULyraItemContainerUIManager` subsystem rather than creating ViewModels manually.

The UI Manager provides a **lease system**:

```cpp
void UWeaponCustomizationWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetOwningLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();

    // Acquire a shared ViewModel
    AttachmentVM = Manager->AcquireContainerViewModel(Source);
}

void UWeaponCustomizationWidget::NativeDestruct()
{
    if (AttachmentVM)
    {
        GetManager()->ReleaseContainerViewModel(Source);
    }
    Super::NativeDestruct();
}
```

{% hint style="info" %}
If you use the provided `ULyraItemContainerWindowShell`, acquire/release is handled automatically. You can read [item container lease system](../../../ui/item-container-ui-system/item-container-ui-manager/the-lease-system.md) for more information
{% endhint %}

***

### The Attachment ViewModel

`ULyraAttachmentViewModel` wraps a weapon's (or any host item's) attachment container.

#### Manual Creation (For Understanding)

For simple cases or learning:

```cpp
AttachmentVM = NewObject<ULyraAttachmentViewModel>(this);
AttachmentVM->InitializeForItem(WeaponItem);
```

{% hint style="warning" %}
Manual creation is fine for prototyping, but production UI should use the UI Manager.
{% endhint %}

The ViewModel automatically:

* Finds the attachment runtime fragment on the item
* Creates slot ViewModels for every defined slot (scope, grip, magazine, etc.)
* Subscribes to the prediction runtime for live updates
* Computes the container path for nested scenarios

Now your widgets can query the ViewModel:

```cpp
// Get all slot ViewModels (even empty ones)
TArray<ULyraAttachmentSlotViewModel*> AllSlots = AttachmentVM->GetAllSlotViewModels();

// Get a specific slot
ULyraAttachmentSlotViewModel* ScopeSlot = AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Scope);

// Check what's attached
ULyraItemViewModel* AttachedScope = AttachmentVM->GetItemInSlot(TAG_Attachment_Slot_Scope);
```

***

### Slot ViewModels Always Exist

This is important: **slot ViewModels exist even when the slot is empty**.

Your UI needs widgets for all attachment slots, not just occupied ones. An empty scope slot still needs to render as a "drop scope here" target. The `ULyraAttachmentSlotViewModel` for that slot exists and has:

* `bIsOccupied = false`
* `ItemIcon = nullptr`
* `SlotDescriptor` ready for drop operations

When the player attaches something, the same ViewModel updates - you don't create a new one.

***

## Practical Example: Weapon Customization Screen

Here's how you might build a weapon customization widget:

```cpp
void UWeaponCustomizationWidget::NativeConstruct()
{
    Super::NativeConstruct();

    // Get the weapon we're customizing
    ULyraInventoryItemInstance* WeaponItem = GetSelectedWeapon();

    // Create the attachment ViewModel
    AttachmentVM = NewObject<ULyraAttachmentViewModel>(this);
    AttachmentVM->InitializeForItem(WeaponItem);

    // Bind each slot widget to its ViewModel
    ScopeSlotWidget->BindToSlot(AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Scope));
    GripSlotWidget->BindToSlot(AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Grip));
    MagazineSlotWidget->BindToSlot(AttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Magazine));
}
```

Each slot widget binds to its ViewModel and updates when it changes:

```cpp
void UAttachmentSlotWidget::BindToSlot(ULyraAttachmentSlotViewModel* SlotVM)
{
    CachedSlotVM = SlotVM;

    // Initial display
    RefreshDisplay();

    // The ViewModel notifies on changes via FieldNotify,
    // or you can poll on tick for simpler implementations
}

void UAttachmentSlotWidget::RefreshDisplay()
{
    if (!CachedSlotVM) return;

    // Show the attachment icon if something's attached
    if (CachedSlotVM->bIsOccupied)
    {
        ItemIcon->SetBrushFromTexture(CachedSlotVM->ItemIcon);
        ItemIcon->SetVisibility(ESlateVisibility::Visible);
    }
    else
    {
        ItemIcon->SetVisibility(ESlateVisibility::Collapsed);
    }

    // Ghost styling for predicted (unconfirmed) attachments
    SetRenderOpacity(CachedSlotVM->bIsGhost ? 0.5f : 1.0f);
}
```

***

## Responding to Changes

{% stepper %}
{% step %}
### Transaction flow and UI update

* Transaction executes (predicted on client)
* Prediction runtime updates effective view
* ViewModel refreshes from new state
* FieldNotify properties broadcast changes
* Bound widgets update automatically
{% endstep %}
{% endstepper %}

If you're using traditional binding instead of UMG View Binding:

```cpp
// Subscribe to the container ViewModel's change delegate
AttachmentVM->OnChanged.AddUObject(this, &UMyWidget::HandleAttachmentsChanged);

void UMyWidget::HandleAttachmentsChanged()
{
    // Refresh all slot widgets
    for (auto* SlotWidget : SlotWidgets)
    {
        SlotWidget->RefreshDisplay();
    }
}
```

***

## Parent State Awareness

Slot ViewModels track `ParentActiveState` - whether the host item is inactive, holstered, or held. This lets you show visual feedback:

```cpp
// Highlight slots when weapon is actively held
bool bIsActive = SlotVM->ParentActiveState == EAttachmentActiveState::Equipped;
ActiveGlow->SetVisibility(bIsActive ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
```

***

## Nested Attachments

When a scope has its own attachments (like a laser sight), the system tracks the path:

```
Rifle
├── Scope (path: [])
│   └── Laser (path: [Scope])
└── Grip (path: [])
```

The `ContainerPath` property on slot ViewModels reflects this hierarchy. When building UI for nested attachments, create a new `ULyraAttachmentViewModel` for the attachment item itself:

```cpp
// Get the attached scope
ULyraInventoryItemInstance* ScopeItem = ScopeSlotVM->GetItemInstance();

// Create a ViewModel for the scope's own attachments
ScopeAttachmentVM = NewObject<ULyraAttachmentViewModel>(this);
ScopeAttachmentVM->InitializeForItem(ScopeItem);

// Now you can display laser slot, etc.
LaserSlotWidget->BindToSlot(ScopeAttachmentVM->GetSlotViewModel(TAG_Attachment_Slot_Illumination));
```

{% hint style="info" %}
For the general MVVM architecture used across containers, see the [ViewModels and UI](/broken/pages/fc9f3f8a27b83d7f32f5149fa05eb38231dd0fc3) section. The patterns are consistent - attachment ViewModels follow the same conventions as inventory and equipment ViewModels.
{% endhint %}
