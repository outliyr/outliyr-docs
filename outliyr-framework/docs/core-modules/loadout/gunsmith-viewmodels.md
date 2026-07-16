# gunsmith viewmodels

The gunsmith ships as an MVVM logic layer, following the same philosophy as the [Equipment ViewModels](/broken/pages/417aa6a2b6cd67e5d4f8d42ec9e9f39776ee4b5f) and the Tetris inventory UI: every operation, rule, and piece of display state lives in ViewModels, and widgets only bind and style. The consequence is that the entire look of the editor is yours to change. A COD-style bench, a flat military menu, a diegetic in-world terminal, or a radial attachment picker all bind to the same ViewModels without touching a line of the logic.

Two guarantees the layer holds everywhere:

* **Child ViewModels always exist.** Every builder slot the rule set declares gets a slot ViewModel whether or not it holds a weapon, and every attachment slot on a weapon gets one whether or not it is occupied. Widgets bind without null checks and decide themselves how an empty slot looks.
* **Affordance state is opt-in.** Fields such as `bIsFocused` and `bIsSelected` exist on every list-like ViewModel with `SetFocused` style setters for widgets to drive. What focus looks like, or whether it is used at all, is a widget decision.

***

## The ViewModels

```
ULoadoutBrowserViewModel                 the player's loadout list
 └── ULoadoutEntryViewModel (per loadout)
ULoadoutBuilderViewModel                 one editing session
 ├── ULoadoutSlotViewModel (per rule set slot)
 │    └── ULoadoutAttachmentSlotViewModel (per attachment slot on the weapon)
 │         └── ULoadoutAttachmentOptionViewModel (per legal attachment)
 └── StatRows (per stat in the display config)
```

### Browser

`ULoadoutBrowserViewModel` is the entry point. `Initialize` with a player controller loads the save and builds the entry list: the rule set's presets first, then the player's custom loadouts, each entry flagged with whether it is the active selection. `SelectLoadout` persists the choice and, when a consumer component is present in the world, submits it so the next spawn uses it. `CreateLoadout`, `CloneLoadout`, and `DeleteLoadout` manage the list, with `bAtCustomLoadoutLimit` exposing the rule set's cap so widgets can disable their create button. `GetLoadoutData` fetches the full data behind an entry, which is how a builder session starts.

### Builder

`ULoadoutBuilderViewModel` owns one editing session. `StartEditing` takes a copy of a loadout, and from that point every mutation applies to the **working copy** only; the player's save is untouched until `CommitToSave`, which validates first and fills `ValidationErrors` instead of persisting an illegal build. Opening a preset transparently clones it, so preset assets are never modified.

The builder exposes one slot ViewModel per rule set slot, `bHasUnsavedChanges` for the widget's discard-prompt logic, and the stat panel state. All mutations funnel through it, whether called directly or through the child ViewModels:

<details>

<summary>The mutation surface</summary>

```cpp
// Weapons and gear
void SetWeaponInSlot(FGameplayTag LoadoutSlotTag, TSubclassOf<ULyraInventoryItemDefinition> WeaponDef,
    FGameplayTag TargetEquipmentSlot, bool bAutoHold);
void ClearLoadoutSlot(FGameplayTag LoadoutSlotTag);

// Attachments on the weapon in a slot
void SetAttachment(FGameplayTag LoadoutSlotTag, FGameplayTag AttachmentSlotTag,
    TSubclassOf<ULyraInventoryItemDefinition> AttachmentDef);
void RemoveAttachment(FGameplayTag LoadoutSlotTag, FGameplayTag AttachmentSlotTag);

// Persistence and stats
bool CommitToSave(APlayerController* PlayerController);
void RequestStatPreview(FGameplayTag LoadoutSlotTag);
```

</details>

Putting a weapon in a slot seeds the working copy with the weapon's `DefaultAttachments`, so the editor opens showing exactly the configuration a freshly created item would carry.

### Slots and options

`ULoadoutSlotViewModel` presents one builder slot: the occupant's name and icon, whether it holds a weapon, and, when it does, the attachment slot ViewModels built from that weapon's `CompatibleAttachments` map. `ULoadoutAttachmentSlotViewModel` presents one attachment point with its current occupant and its `Options` list, one `ULoadoutAttachmentOptionViewModel` per legal attachment, each flagged with `bIsEquipped`. Everything offered is legal by construction because the lists come straight from the compatibility map, and the save-time validator backstops whatever a custom widget might do anyway.

### Stats

`StatRows` on the builder is an array of `FLoadoutStatRow`, one per entry in the rule set's stat display config, in config order. Each row carries the computed value, the delta against the previous preview of the same slot, `bDeltaIsImprovement` resolved through the config's higher-is-better flag, and the format metadata. Rows for stats the weapon never seeds have `bHasValue` false, so a widget can hide or grey them.

Stat updates are asynchronous by nature: the preview rig needs a tick for the ability pipeline to settle, so widgets bind to `StatRows` and react when it changes rather than reading it immediately after an edit. Every mutation of a weapon automatically re-requests its preview.

***

## Building Your Own Editor

The minimum viable gunsmith binds surprisingly little:

1. A list bound to the browser's `LoadoutEntries`, calling `SelectLoadout` on click.
2. A panel bound to the builder's `SlotViewModels`, showing `ItemName` per slot.
3. For the focused weapon slot, a list of its `AttachmentSlots`, each showing `Options` and calling `EquipOption` or `ClearAttachment`.
4. A save button calling `CommitToSave`, showing `ValidationErrors` when it returns false.

Everything beyond that is presentation you add because your game wants it, not because the system requires it.

For a 3D weapon display, the builder exposes `GetPreviewRig`. The rig's equipment manager holds the previewed weapon with its attachment actors spawned by the ordinary equipment flow, so you can stage those actors in any scene you like: a PocketWorlds room in the style of the [item inspection system](/broken/pages/f451cb0696722c41c78ae497587917cb41ce28b4), a scene capture, or a simple camera in the menu map. The rig is deliberately just a pawn with equipment; it imposes no scene, no camera, and no bench.

Behavior changes go through subclassing rather than reimplementation. The refresh and entry-building methods on the browser and builder are virtual, so a subclass can add fields to entries, filter which options appear, or extend what a refresh touches while keeping the working-copy and validation flow intact.
