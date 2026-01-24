# Slot Descriptors

Different containers use different slot types. An inventory uses integer indices. Equipment uses gameplay tags. Attachments use a tag path. Yet the transaction system needs to work with all of them uniformly.

Slot descriptors solve this problem through polymorphism—a base struct with virtual methods, wrapped in `FInstancedStruct` for value semantics.

### The Problem

Consider a simple item move. The transaction ability needs to:

{% stepper %}
{% step %}
Resolve the source container
{% endstep %}

{% step %}
Get the item from the source slot
{% endstep %}

{% step %}
Validate the move
{% endstep %}

{% step %}
Remove from source, add to destination
{% endstep %}
{% endstepper %}

Without abstraction, you'd need code like this:

```cpp
// DON'T DO THIS - just illustrating the problem
if (SourceSlot.IsInventorySlot())
{
    Item = InventoryManager->GetItemAt(SourceSlot.Index);
}
else if (SourceSlot.IsEquipmentSlot())
{
    Item = EquipmentManager->GetEquippedItem(SourceSlot.SlotTag);
}
else if (SourceSlot.IsAttachmentSlot())
{
    // Walk the attachment path...
}
// And so on for every container type...
```

Every new container type requires modifying the transaction ability. That doesn't scale.

### The Solution: `FAbilityData_SourceItem`

The base slot descriptor provides a polymorphic interface:

```cpp
USTRUCT(BlueprintType)
struct FAbilityData_SourceItem
{
    GENERATED_BODY()

    // Resolve this slot to its container
    virtual ILyraItemContainerInterface* ResolveContainer(APlayerController* PC) const;

    // Get the item in this slot (with permission checking)
    virtual ULyraInventoryItemInstance* GetSourceItem(
        EItemContainerAccessRights RequiredAccessRights,
        const EItemContainerPermissions& RequiredPermission,
        APlayerController* PlayerController) const;

    // Check if player has required permissions
    virtual bool HasPermission(APlayerController* PC, EItemContainerPermissions RequiredPermission) const;

    // Compare slots for equality
    virtual bool IsEqual(const FInstancedStruct& Other) const;

    // Debug logging
    virtual FString GetDebugString() const;
};
```

The transaction ability now becomes container-agnostic:

```cpp
// The actual approach
ILyraItemContainerInterface* Container = SourceSlot.Get<FAbilityData_SourceItem>().ResolveContainer(PC);
ULyraInventoryItemInstance* Item = Container->GetItemInSlot(SourceSlot);
```

No switch statements. No container-specific code. New containers just define their slot descriptor.

### How FInstancedStruct Enables This

`FInstancedStruct` is Unreal's mechanism for storing polymorphic structs by value. Unlike pointers:

* Value semantics: Copy, move, serialize like any struct
* No GC overhead: Structs aren't garbage collected
* Type-safe casting: Runtime type checking via `GetScriptStruct()`

```cpp
// Creating a slot descriptor
FInstancedStruct Slot;
Slot.InitializeAs<FInventoryAbilityData_SourceItem>();
FInventoryAbilityData_SourceItem& InvSlot = Slot.GetMutable<FInventoryAbilityData_SourceItem>();
InvSlot.InventoryManager = MyInventory;
InvSlot.SlotIndex = 5;

// Using it generically
if (const FAbilityData_SourceItem* Base = Slot.GetPtr<FAbilityData_SourceItem>())
{
    ILyraItemContainerInterface* Container = Base->ResolveContainer(PC);
}
```

{% hint style="info" %}
**Why structs, not UObjects?** Slot descriptors are passed around frequently—in ability payloads, transaction requests, UI callbacks. UObjects would create GC pressure and require careful lifetime management. Value-semantic structs are copied freely and cleaned up automatically.
{% endhint %}

### Concrete Slot Descriptors

Each container type defines its own slot descriptor with the data needed to identify a slot.

#### Inventory Slots

```cpp
USTRUCT(BlueprintType)
struct FInventoryAbilityData_SourceItem : public FAbilityData_InventorySourceItem
{
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraInventoryManagerComponent> InventoryManager;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 SlotIndex = INDEX_NONE;
};
```

<figure><img src="../../../.gitbook/assets/image (6) (1) (1) (1) (1) (1).png" alt="" width="473"><figcaption><p>Inventory Source Slot</p></figcaption></figure>

Inventory slots are simple: a reference to the inventory component and an integer index.

#### Equipment Slots

```cpp
USTRUCT(BlueprintType)
struct FEquipmentAbilityData_SourceEquipment : public FAbilityData_EquipmentSourceItem
{
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TObjectPtr<ULyraEquipmentManagerComponent> EquipmentManager;

    // Storage slot - where item LIVES (e.g., PrimaryWeapon)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FGameplayTag EquipmentSlot;

    // Active held slot - which hand is holding (e.g., HeldSlot.Primary)
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FGameplayTag ActiveHeldSlot;
};
```

<figure><img src="../../../.gitbook/assets/image (27).png" alt="" width="391"><figcaption><p>Equipment Source Slot</p></figcaption></figure>

Equipment slots use gameplay tags. Notice `ActiveHeldSlot`, this represents a _state_ (is the item being held?), not a separate location. The item always lives in `EquipmentSlot`; `ActiveHeldSlot` indicates whether it's currently in-hand.

{% hint style="info" %}
This gives the benefit of the held state (i.e. holstering vs holding an item) equating to a move from one slot to another.
{% endhint %}

#### Attachment Slots

```cpp
USTRUCT(BlueprintType)
struct FAttachmentAbilityData_SourceAttachment : public FAbilityData_SourceItem
{
    // Where the attachment chain starts (inventory or equipment slot)
    UPROPERTY(BlueprintReadWrite)
    FInstancedStruct RootAttachmentSlot;

    // Path through nested containers to reach this attachment's parent
    UPROPERTY(BlueprintReadWrite)
    TArray<FGameplayTag> ContainerAttachmentPath;

    // The final attachment slot tag
    UPROPERTY(BlueprintReadWrite)
    FGameplayTag AttachmentSlot;
};
```

<figure><img src="../../../.gitbook/assets/image (8) (1) (1) (1) (1).png" alt="" width="563"><figcaption><p>Attachment Source Slot</p></figcaption></figure>

Attachments are more complex because they can nest. A scope attached to a weapon that's equipped requires:

* RootAttachmentSlot: The equipment slot holding the weapon
* ContainerAttachmentPath: Empty (scope is directly on weapon)
* AttachmentSlot: The "Scope" attachment point

A scope attached to a weapon attached to another weapon (attachment chains):

* RootAttachmentSlot: Equipment slot
* ContainerAttachmentPath: `[UnderbarrelAttachment]` (path to reach the attached weapon)
* AttachmentSlot: The scope attachment point

#### Pickup Slots

```cpp
USTRUCT(BlueprintType)
struct FPickupAbilityData_SourceItem : public FAbilityData_PickupSourceItem
{
    // The world collectable actor containing the items
    UPROPERTY(BlueprintReadWrite)
    TWeakObjectPtr<AWorldCollectableBase> Pickup;

    // Index within the Templates or Instances array
    UPROPERTY(BlueprintReadWrite)
    int32 ItemIndex = INDEX_NONE;

    // Whether this is a template (definition + count) or an instance (actual UObject)
    UPROPERTY(BlueprintReadWrite)
    bool bIsTemplate = false;
};
```

<figure><img src="../../../.gitbook/assets/image.png" alt="" width="536"><figcaption><p>Pickup Source Slot</p></figcaption></figure>

Pickup slots reference items within a world collectable's `FItemPickup`:

* **Pickup**: The world collectable actor containing the items
* **ItemIndex**: Index within the `Templates` or `Instances` array
* **bIsTemplate**: Whether this is a template (definition + count) or an instance (actual UObject)

{% hint style="info" %}
Unlike other slot types, pickup slots distinguish between templates and instances. Templates are lightweight data (item definition + stack count) while instances are full `ULyraInventoryItemInstance` objects. This matters because templates are created on-the-fly during pickup while instances are transferred directly.
{% endhint %}

### Marker Base Structs

Notice the intermediate structs like `FAbilityData_InventorySourceItem` , `FAbilityData_EquipmentSourceItem` and `FAbilityData_PickupSourceItem`  These are marker structs, they contain no data but establish a type hierarchy.

```cpp
// Can ask "is this an inventory-type slot?" without knowing the concrete type
if (Slot.GetScriptStruct()->IsChildOf(FAbilityData_InventorySourceItem::StaticStruct()))
{
    // This is some kind of inventory slot (standard, grid, tetris, etc.)
}
```

This enables:

* Plugin extensibility: A Tetris inventory plugin can define `FTetrisInventorySlot : public FAbilityData_InventorySourceItem`
* Category detection: UI can show different icons for inventory vs equipment slots
* Future-proofing: Core code doesn't need to know about every concrete slot type

### The ResolveContainer Pattern

The key method is `ResolveContainer()`:

<pre class="language-cpp"><code class="lang-cpp"><strong>virtual ILyraItemContainerInterface* ResolveContainer(APlayerController* PC) const;
</strong></code></pre>

Each slot descriptor implements this to return its container. The implementation varies:

Inventory:

```cpp
ILyraItemContainerInterface* FInventoryAbilityData_SourceItem::ResolveContainer(APlayerController* PC) const
{
    return InventoryManager.Get();  // Direct reference
}
```

Equipment:

```cpp
ILyraItemContainerInterface* FEquipmentAbilityData_SourceEquipment::ResolveContainer(APlayerController* PC) const
{
    return EquipmentManager.Get();  // Direct reference
}
```

Attachments:

```cpp
ILyraItemContainerInterface* FAttachmentAbilityData_SourceAttachment::ResolveContainer(APlayerController* PC) const
{
    // 1. Resolve the root slot to get the root container
    // 2. Get the item at the root
    // 3. Walk the ContainerAttachmentPath through nested attachments
    // 4. Return the final container (InventoryFragment_Attachment)
}
```

The caller doesn't care about these details, it just gets a container interface.

### Slot Comparison

Slots need to be comparable for operations like "did this item's slot change?":

```cpp
virtual bool IsEqual(const FInstancedStruct& Other) const;
```

Each descriptor defines what makes two slots "the same":

* Inventory: Same `InventoryManager` and `SlotIndex`
* Equipment: Same `EquipmentManager`, `EquipmentSlot`, and `ActiveHeldSlot`
* Attachment: Same `RootAttachmentSlot`, `ContainerAttachmentPath`, and `AttachmentSlot`

There are also static utilities for common comparisons:

```cpp
// Are these slots in the same container?
static bool AreSlotsInSameContainer(
    const FInstancedStruct& SlotA,
    const FInstancedStruct& SlotB,
    APlayerController* PC);

// Do these slots share the same root container?
// (For attachments, compares the RootAttachmentSlot)
static bool AreSlotsInSameRootContainer(
    const FInstancedStruct& SlotA,
    const FInstancedStruct& SlotB);
```

### The Null Slot

A special descriptor represents "no slot":

```cpp
USTRUCT(BlueprintType)
struct FNullSourceSlot : public FAbilityData_SourceItem
{
    // All methods return nullptr/false/empty
};
```

<figure><img src="../../../.gitbook/assets/image (9) (1) (1) (1) (1).png" alt="" width="181"><figcaption><p>Null Source Slot</p></figcaption></figure>

Use this instead of invalid/empty `FInstancedStruct` when you need an explicit "no slot" value.

```cpp
// Check for null slot
bool UItemContainerFunctionLibrary::IsNullSlot(const FInstancedStruct& Slot)
{
    return !Slot.IsValid() || Slot.GetScriptStruct() == FNullSourceSlot::StaticStruct();
}
```

### Creating Your Own Slot Descriptor

When implementing a custom container, you'll need a slot descriptor. The requirements:

{% stepper %}
{% step %}
Inherit from `FAbilityData_SourceItem` (or a marker base if appropriate)
{% endstep %}

{% step %}
Store enough data to identify the slot (container reference + slot-specific info)
{% endstep %}

{% step %}
Implement `ResolveContainer()` to return your container interface
{% endstep %}

{% step %}
Implement `GetSourceItem()` with permission checking
{% endstep %}

{% step %}
Implement `IsEqual()` for slot comparison
{% endstep %}

{% step %}
Implement `GetDebugString()` for logging
{% endstep %}
{% endstepper %}

See [Implementing the Interface](../creating-containers/implementing-the-interface.md) for a complete example.

### Next Steps

See how the Blueprint layer wraps these C++ constructs in [Blueprint API](item-container-blueprint-api.md).
