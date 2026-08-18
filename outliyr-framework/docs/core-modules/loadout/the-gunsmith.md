# The Gunsmith

The gunsmith is the menu-time editor: pick a loadout, fill its slots, fit attachments, watch the numbers move, save. Everything below the widgets is a set of MVVM view models carrying no design opinions, so the shipped screens are one presentation of the logic rather than the logic itself.

{% hint style="info" %}
The gunsmith widgets live in the **Loadout** plugin under `/Loadout/UI/`. The Gunsmith plugin is content-only and holds the shipped example experience, map, rule set and preset.
{% endhint %}

<figure><img src="../../.gitbook/assets/image (350).png" alt=""><figcaption></figcaption></figure>

## The View Models

Two roots, each owning children that the widgets bind to directly.

| View model                          | Role                                                             |
| ----------------------------------- | ---------------------------------------------------------------- |
| `ULoadoutBrowserViewModel`          | The list of loadouts, selection, create / clone / delete         |
| ↳ `ULoadoutEntryViewModel`          | One row in that list                                             |
| ↳ `ULoadoutContentRowViewModel`     | A read-only "what is in this loadout" row for the selected entry |
| `ULoadoutBuilderViewModel`          | Editing one loadout as a working copy                            |
| ↳ `ULoadoutSlotViewModel`           | One builder slot, its occupant and its options                   |
| ↳ `ULoadoutAttachmentSlotViewModel` | One attachment slot on the weapon in a slot                      |
| ↳ `ULoadoutItemOptionViewModel`     | One offered item or perk                                         |
| ↳ `ULoadoutStatRowViewModel`        | One row of the stat panel                                        |

`ULoadoutSelectableViewModel` is the shared base for anything selectable, carrying `bIsSelected`, `SetSelected`, an `OnSelectedChanged` delegate, and a `NotifyChosen` hook. Focus state (`bIsFocused` / `SetFocused`) exists on the list-like view models for controller navigation, and is opt-in: nothing sets it unless your widgets do.

Child view models are created up front and refilled in place rather than recreated, so a `ListView` keeps its entry objects and its scroll position across edits.

## The Browser

`Initialize(APlayerController*)` pulls the shared `ULoadoutSaveData` from the subsystem and subscribes to its change delegate. From there:

| Function         | Behaviour                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `SelectLoadout`  | Writes the selection to the save and tells the consumer component about it                |
| `CreateLoadout`  | Seeds a new custom loadout from the rule set's `DefaultLoadout`, named "Custom Loadout N" |
| `CloneLoadout`   | Duplicates an entry under a new GUID, named "{0} Copy"                                    |
| `DeleteLoadout`  | Removes a custom loadout and broadcasts `OnLoadoutDeleted`                                |
| `GetLoadoutData` | Reads the underlying `FLoadoutData` for an entry                                          |

`CreateLoadout` and `CloneLoadout` both refuse once `bAtCustomLoadoutLimit` is set, which the browser recomputes against the rule set's `MaxCustomLoadouts`. `DeleteLoadout` refuses to delete presets.

Selecting a **preset** writes it into the save alongside custom loadouts. That is what lets the consumer resolve a selected preset by id without needing the rule set, and the list skips saved presets when rebuilding so the row is not duplicated.

There is **no rename on the browser**, renaming is `ULoadoutBuilderViewModel::SetLoadoutName`, because a name change is an edit to the working copy like any other.

Entry icons are rendered from the loadout's **first weapon only**, with its attachments, through the icon generator component. Weapons shipping an authored icon skip the render entirely, and the whole feature degrades to authored icons when no generator is present.

## The Builder

`StartEditing` takes a copy of a loadout and every mutation from that point applies to the **working copy**. The player's save is untouched until `CommitToSave`.

{% hint style="warning" %}
Pass the **PlayerController** as `StartEditing`'s `WorldContextObject`. The builder caches it to reach the save, and without it the deleted-loadout guard below cannot function.
{% endhint %}

Opening a **preset** forks it immediately: `bIsPreset` is cleared and a new GUID is assigned at `StartEditing` time, before the player has saved anything. Preset assets are never mutated.

### Committing

`CommitToSave` runs in a fixed order and refuses rather than half-saving:

{% stepper %}
{% step %}
#### Validate

`ULoadoutValidator::Validate` runs against the rule set. On failure `ValidationErrors` is filled and the save is not touched.
{% endstep %}

{% step %}
#### Check the loadout still exists

If the loadout was in the save when editing began but is not there now, it was deleted behind the builder. The commit fails with "This loadout has been deleted." rather than resurrecting it through an upsert.
{% endstep %}

{% step %}
#### Write

The working copy is upserted, the save is written, and `bHasUnsavedChanges` clears.
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Forward the browser's `OnLoadoutDeleted` to the builder's `NotifyLoadoutDeleted` yourself, there is no automatic subscription. Without it the commit still refuses correctly, but the builder keeps displaying a loadout that no longer exists.
{% endhint %}

### Mutations

The mutation functions themselves (`SetWeaponInSlot`, `SetGearInSlot`, `SetPerkInSlot`, `ClearLoadoutSlot`, `SetAttachment`, `RemoveAttachment`) are C++ only. Blueprint reaches them through the child view models: `ULoadoutSlotViewModel::SelectOption`, `SetWeapon` and `ClearSlot`, and `ULoadoutAttachmentSlotViewModel::EquipOption` and `ClearAttachment`.

Two behaviours are worth knowing:

* Setting a weapon seeds its attachments from the weapon's `DefaultAttachments`, so a freshly picked weapon in the gunsmith matches one created anywhere else in the game.
* Fitting an attachment resolves conflicts **in favour of the incoming attachment**. Anything occupying a slot it blocks, and anything already fitted that blocks its slot, is removed. Attachment slots surface this to the UI through `bIsBlocked`, `BlockedReason` and `bCanFitAttachment`.

Every edit broadcasts `OnLoadoutEdited` with the affected slot tag and re-runs the stat preview.

## The Stat Preview Rig

Weapon stats in this framework are not variables on a class. As covered in [Equipment Instance](../../base-lyra-modified/equipment/equipment-instance.md#tag-attributes-flexible-parameters-without-subclassing), a weapon's effective stats live in the tag attribute container on its equipment instance: the weapon's own abilities seed base values, and attachment abilities modify them while fitted. The numbers only exist after that pipeline has run.

So the gunsmith does not read stats. It **runs the pipeline**. `ALoadoutPreviewRig` is a hidden pawn owning its own ability system and equipment manager, isolated from every player, spawned far below the level. To preview a build it:

{% stepper %}
{% step %}
#### Equips the weapon, held

The weapon is created with its full attachment tree through the same call the resolver uses at spawn, and equipped into a **held** slot, because held state is what activates the attachment modifier abilities.
{% endstep %}

{% step %}
#### Grants the perks

Perk ability sets go on after the weapon. A perk that changes how weapons handle reads what is equipped at the moment it activates, and an on-spawn ability activates as soon as it is granted, so granting first would hand it an empty rig. This is the order the resolver uses at spawn.
{% endstep %}

{% step %}
#### Waits a tick

Granted abilities apply their modifications, then the requested tag attributes are read off the equipment instance and reported. A superseding request cancels the earlier one.
{% endstep %}
{% endstepper %}

The payoff is authoring economy: any attachment that modifies stats through a normal granted ability previews correctly, automatically, with no parallel stat table to maintain. The rig runs the same abilities a match does, though it is its own code path rather than the resolver, so the order it grants things in has to match the resolver's for the numbers to agree.

Stats the weapon never seeds are omitted from the result rather than shown as zero. The rig hides itself and suppresses the cosmetic actors its equipped weapon spawns, because it is a measuring instrument, not the 3D preview, the visible weapon on the gunsmith screen is built separately through the icon generator's staging path.

{% hint style="info" %}
No stat panel appears at all when the rule set has no `StatDisplayConfig`; both the preview request and the row publishing return early. That is the switch for a game that wants a gunsmith without numbers.
{% endhint %}

## Building Your Own Editor

The view models carry no design opinions, so a completely different editor is a matter of binding to them.

{% stepper %}
{% step %}
#### Create and initialize

Create a `ULoadoutBrowserViewModel` and call `Initialize` with the player controller. Create a `ULoadoutBuilderViewModel` and call `StartEditing` when a loadout is chosen, passing the player controller as the world context.
{% endstep %}

{% step %}
#### Bind the lists

`LoadoutEntries`, `SlotViewModels`, an attachment slot's `Options`, and `StatRows` are all `FieldNotify` arrays. `ULoadoutViewConversions` provides `BlueprintPure` helpers that convert each into `UObject*` arrays for `ListView` widgets, plus small presentation helpers such as slot-kind visibility.
{% endstep %}

{% step %}
#### Wire the calls back

Selection and mutation go through the callable functions on the view models. Forward `OnLoadoutDeleted` to `NotifyLoadoutDeleted`, and surface `ValidationErrors` when `CommitToSave` returns false.
{% endstep %}

{% step %}
#### Derive your row widgets

`ULoadoutEntryWidgetBase` is an abstract, Blueprintable `ULyraButtonBase` implementing `IUserObjectListEntry`, with optional `SelectedStripe` and `Background` bindings and four authorable state colours. `ULoadoutListRowBase` is the display-only equivalent for rows that take no focus.
{% endstep %}
{% endstepper %}

Behaviour changes go through subclassing rather than reimplementation: `RefreshEntries` on the browser and `RefreshSlotViewModels` on the builder are both virtual.

{% hint style="info" %}
A gunsmith showing dropped weapons or ground pickups should be aware that a pickup's attachments render against the **pickup mesh's** sockets. See [Pickup Item Fragment](../../base-lyra-modified/items/item-fragments-in-depth/pickup-item-fragment.md#attachments-on-a-pickup) for the socket requirement.
{% endhint %}
