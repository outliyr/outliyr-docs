# Static Fragment

The `UInventoryFragment_Attachment` is added to an item definition to make that item capable of **hosting attachments**. It's the design-time configuration that says "this rifle can hold scopes, grips, and magazines, and here's how each attachment should behave."

***

### What the Fragment Does

Unlike most fragments that just add data, this one does several things:

* Defines slots — what attachment points exist (scope, grip, magazine)
* Defines compatibility — which items can attach to which slots
* Defines behavior — what actors spawn and abilities grant per state
* Creates runtime — spawns a `UTransientRuntimeFragment_Attachment` per instance
* Enables item actions — implements `IItemActionProvider` for UI attachment

***

### The `CompatibleAttachments` Map

This is the core configuration - a two-level map that defines everything:

```cpp
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Attachment)
TMap<FAttachmentSlotTagKey, FAttachmentSlotDetails> CompatibleAttachments;
```

#### Structure

<figure><img src="../../../../.gitbook/assets/image (221).png" alt=""><figcaption></figcaption></figure>

<details>

<summary>Ascii Diagram</summary>

```
CompatibleAttachments
│
├── Lyra.Attachment.Slot.Scope (slot tag)
│   │
│   ├── ID_Attachment_RedDot (compatible item)
│   │   ├── AttachmentIcon: T_RedDot
│   │   ├── HeldAttachmentSettings: { actors, abilities, input }
│   │   └── HolsteredAttachmentSettings: { actors, abilities, input }
│   │
│   ├── ID_Attachment_4xScope
│   │   ├── AttachmentIcon: T_4xScope
│   │   ├── HeldAttachmentSettings: { ... }
│   │   └── HolsteredAttachmentSettings: { ... }
│   │
│   └── ... more compatible items
│
├── Lyra.Attachment.Slot.Grip (another slot)
│   └── ... compatible grips with their behaviors
│
└── Lyra.Attachment.Slot.Magazine
    └── ... compatible magazines with their behaviors
```

</details>

#### Why Behavior Lives Here

You might wonder: "Why is behavior configuration on the HOST item, not on the attachment itself?"

Because the same attachment can behave differently on different hosts:

* A red dot on an **assault rifle** might spawn at `rifle_scope_socket`
* The same red dot on a **pistol** might spawn at `pistol_rail_socket`
* On a **shotgun**, it might use completely different abilities

The host item knows its own sockets and what behaviors make sense. The attachment item is just "I'm a red dot", the host says "here's how red dots work on me."

***

### Tag Filtering

The `FAttachmentSlotTagKey` wrapper restricts which tags appear in the editor:

```cpp
UPROPERTY(BlueprintReadWrite, EditDefaultsOnly, Category = "GameplayTag",
          Meta = (Categories = "Lyra.Attachment.Slot"))
FGameplayTag SlotTag;
```

This means:

* Only tags under `Lyra.Attachment.Slot` are selectable
* You can't accidentally use an unrelated tag
* Consistent hierarchy across all attachment definitions

#### Adding New Slots

* Add the tag to your tag table: `Lyra.Attachment.Slot.YourNewSlot`
* Add entries to `CompatibleAttachments` using that tag
* The runtime container automatically supports it

***

### `DefaultAttachments`

Items that come with attachments pre-installed:

```cpp
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=Attachment)
TMap<FAttachmentSlotTagKey, TSubclassOf<ULyraInventoryItemDefinition>> DefaultAttachments;
```

Example:

```
DefaultAttachments:
  Lyra.Attachment.Slot.Scope: ID_Attachment_IronSights
```

When the rifle instance is created, the iron sights automatically attach. The player can still swap them for a different scope.

{% hint style="info" %}
**Overriding defaults at spawn time:** When spawning items through starting item entries (on Equipment, Inventory, or Tetris components), you can use `FAttachmentFragmentInit` in the `FragmentInitData` array to replace the default attachments with custom ones, including nested init data on the attachments themselves. See [Fragment Initialization](../../items-and-fragments/fragment-initialization.md) for details.
{% endhint %}

***

### How It Creates the Runtime Container

When a weapon instance is created, this fragment creates the runtime container:

```cpp
virtual bool CreateNewRuntimeTransientFragment(
    AActor* ItemOwner,
    ULyraInventoryItemInstance* ItemInstance,
    UTransientRuntimeFragment*& OutFragment) override;
```

{% stepper %}
{% step %}
#### Create runtime instance

Creates a `UTransientRuntimeFragment_Attachment` instance.
{% endstep %}

{% step %}
#### Initialize attached items

Initializes the FastArray for attached items.
{% endstep %}

{% step %}
#### Setup prediction

Sets up prediction runtime for networked gameplay.
{% endstep %}

{% step %}
#### Attach defaults

Attaches any `DefaultAttachments`.
{% endstep %}

{% step %}
#### Subscribe to state changes

Subscribes to parent item's state changes to react to held/holstered transitions.
{% endstep %}
{% endstepper %}

You don't call this directly, it happens automatically during item creation via `UGlobalInventoryManager::CreateNewItem`.

***

### Compatibility Queries

#### Checking If an Item Can Attach

```cpp
bool IsCompatible(TSubclassOf<ULyraInventoryItemDefinition> ItemDefinition, FGameplayTag Slot) const;
```

Returns true if the item definition is in the compatible list for that slot. Used by:

* UI to show valid drop targets
* Transaction validation
* Drag-drop handling

#### Getting Behavior Configuration

```cpp
FAttachmentDetails FindAttachmentDetails(
    TSubclassOf<ULyraInventoryItemDefinition> ItemDefinition,
    FGameplayTag Slot) const;
```

Returns the full `FAttachmentDetails` including icons and both behavior configurations. Used when actually applying the attachment's behavior.

#### Finding Any Compatible Slot

```cpp
FAttachmentDetails FindFirstAttachmentDetail(
    TSubclassOf<ULyraInventoryItemDefinition> ItemDefinition,
    FGameplayTag& OutSlot) const;
```

Searches all slots for one that accepts this item. Returns the first match and outputs the slot tag. Useful when you have an attachment and want to find where it can go.

***

### Drag-Drop Attachment

The fragment implements the `CanCombineItems`/`CombineItems` pattern to enable drag-drop attachment in UI.

{% hint style="info" %}
Do not be confused with normal drag and drop logic. This is specific to automatically attaching items by dragging an item onto an attachment item.
{% endhint %}

#### How It Works

When a player drags an item onto this item in the inventory:

1. **`CanCombineItems`** - Checks if the dragged item is compatible with any slot
2. **`CombineItems`** - Executes a transaction to move the item into the attachment container

```cpp
// Item combination methods (NOT IItemActionProvider)
virtual bool CanCombineItems(const FItemCombineContext& Context) const override;
virtual bool CombineItems(FItemCombineContext& Context) override;
```

#### The Flow

```
Player drags scope onto rifle
        │
        ▼
CanCombineItems checks IsCompatible
        │
        ├── Not compatible → Return false, drag fails
        │
        └── Compatible → CombineItems executes
                │
                ▼
        Find available slot (FindFirstAttachmentDetail)
                │
                ▼
        Create transaction: Move item to attachment slot
                │
                ▼
        Transaction executes via ItemTransactionAbility
```

***

### Action Menu Integration

This fragment also implements `IItemActionProvider` to add an **Attachments** action to the item's context menu.

<table><thead><tr><th width="146.333251953125">Action</th><th>Tag</th><th>Purpose</th></tr></thead><tbody><tr><td><strong>Attachments</strong></td><td><code>Ability.Item.ShowAttachmentWindow</code></td><td>Opens the attachment management UI</td></tr></tbody></table>

**When shown:** The action only appears when `CompatibleAttachments.Num() > 0` (the item has at least one attachment slot defined).

**When enabled:** Same condition, if the item has attachment slots, the action is enabled.

This gives players a dedicated button to open the attachment customization screen for weapons or other items with attachment slots.

{% hint style="info" %}
For the full action menu system, see [Context Menus & Action Logic](../../../ui/item-container-ui-system/interaction-and-transactions/context-menus-and-action-logic.md).
{% endhint %}

***

### Weight Contribution

Attachments add to the host item's weight:

```cpp
virtual float GetWeightContribution(
    const ULyraInventoryItemDefinition* InItemDef,
    ULyraInventoryItemInstance* InItemInstance) override;
```

This iterates through all attached items and sums their weights. When the inventory calculates the rifle's weight, it includes the scope, grip, and magazine.

***

### Static Helpers

#### `CanAttachItem`

```cpp
static bool CanAttachItem(
    ULyraInventoryItemInstance* AttachmentContainerItemInstance,
    ULyraInventoryItemInstance* AttachmentItemInstance,
    const FGameplayTag& AttachmentSlotID);
```

Utility to check if attachment is possible given item **instances** (not just definitions). Useful when you have actual items and need to validate before attempting attachment.

#### `SetItemCurrentSlot`

```cpp
static void SetItemCurrentSlot(
    ULyraInventoryItemInstance* AttachmentItemInstance,
    ULyraInventoryItemInstance* AttachmentContainerItemInstance,
    const FGameplayTag& AttachmentSlotID);
```

Updates the attachment item's `CurrentSlot` descriptor to reflect its position in the attachment hierarchy. Called by the runtime container during attachment.

***

### Attachment Definition Examples

<details>

<summary>Example: Assault Rifle</summary>

**Item Definition: `ID_Weapon_AssaultRifle`**

```
Fragments:
  - UInventoryFragment_EquippableItem
      EquipmentDefinition: ED_AssaultRifle

  - UInventoryFragment_InventoryIcon
      Icon: T_AssaultRifle_Icon
      Weight: 3.5

  - UInventoryFragment_Attachment
      CompatibleAttachments:
        Lyra.Attachment.Slot.Scope:
          ID_Attachment_RedDot:
            AttachmentIcon: T_RedDot_Icon
            HeldAttachmentSettings:
              ActorSpawnInfo: { BP_RedDot, scope_socket }
              AbilitySetsToGrant: [GAS_RedDot_ADS]
            HolsteredAttachmentSettings:
              ActorSpawnInfo: { BP_RedDot_Small, scope_socket_back }

          ID_Attachment_4xScope:
            AttachmentIcon: T_4xScope_Icon
            HeldAttachmentSettings:
              ActorSpawnInfo: { BP_4xScope, scope_socket }
              AbilitySetsToGrant: [GAS_4xScope_ADS, GAS_4xScope_Zoom]
            HolsteredAttachmentSettings:
              ActorSpawnInfo: { BP_4xScope_Folded, scope_socket_back }

        Lyra.Attachment.Slot.Grip:
          ID_Attachment_VerticalGrip:
            AttachmentIcon: T_VertGrip_Icon
            HeldAttachmentSettings:
              ActorSpawnInfo: { BP_VertGrip, grip_socket }
              AbilitySetsToGrant: [GAS_Grip_RecoilReduction]
            HolsteredAttachmentSettings:
              ActorSpawnInfo: { BP_VertGrip_Folded, grip_socket_back }

      DefaultAttachments:
        Lyra.Attachment.Slot.Scope: ID_Attachment_IronSights
```

This rifle:

* Accepts red dots and 4x scopes in the scope slot
* Accepts vertical grips in the grip slot
* Comes with iron sights by default
* Each attachment has different actors/abilities for held vs holstered states

</details>

<details>

<summary>Example: Tactical Vest (Armor)</summary>

**Item Definition: `ID_Armor_TacticalVest`**

```
Fragments:
  - UInventoryFragment_EquippableItem
      EquipmentDefinition: ED_TacticalVest

  - UInventoryFragment_Attachment
      CompatibleAttachments:
        Lyra.Attachment.Slot.ChestPlate:
          ID_Module_ArmorPlate_Light:
            HeldAttachmentSettings: {}  # Armor isn't "held"
            HolsteredAttachmentSettings:
              AbilitySetsToGrant: [GAS_ArmorPlate_Light_DamageReduction]
              ActorSpawnInfo: { BP_ArmorPlate_Light, chest_socket }

          ID_Module_ArmorPlate_Heavy:
            HeldAttachmentSettings: {}
            HolsteredAttachmentSettings:
              AbilitySetsToGrant: [GAS_ArmorPlate_Heavy_DamageReduction]
              ActorSpawnInfo: { BP_ArmorPlate_Heavy, chest_socket }

        Lyra.Attachment.Slot.Pouch:
          ID_Module_AmmoPouch:
            HolsteredAttachmentSettings:
              AbilitySetsToGrant: [GAS_AmmoPouch_ExtraCapacity]
              ActorSpawnInfo: { BP_AmmoPouch, pouch_socket_left }
```

Since armor is never "held" (it's always worn/holstered), only `HolsteredAttachmentSettings` matters. The `HeldAttachmentSettings` can be left empty.

</details>

