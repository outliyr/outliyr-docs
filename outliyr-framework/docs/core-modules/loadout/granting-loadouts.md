# Granting Loadouts

A player spawns. Somewhere between the experience activating and the pawn being possessed, a saved build turns into equipped weapons, spare items, and granted perks. This page follows that path, including the part that only matters on dedicated servers.

## The Pieces an Experience Adds

Granting is driven by two experience actions plus a world subsystem that connects them.

**`UGameFeatureAction_ConfigureLoadout`** carries one property, the `ULoadoutRuleSet` for this experience. On activation it publishes the rule set into the world's `ULoadoutSubsystem`; on deactivation it clears it. Non-game worlds are skipped.

**`ULoadoutSubsystem`** is a per-world holder for the active rule set, exposing `GetActiveRuleSet()` to Blueprint and broadcasting `OnRuleSetChanged` when it changes. Routing the hand-off through a subsystem is deliberate: the action that adds consumer components and the action supplying the rule set can run in **either order**, and a consumer created after activation still finds the rules waiting.

**`ULoadoutConsumerComponent`** is added to the `PlayerState` by a `GameFeatureAction_AddComponents`, on both the client and the server.

{% hint style="warning" %}
A view model constructed **before** the `ConfigureLoadout` action runs sees a null rule set and builds zero slots. The subsystem removes ordering dependencies between the two experience actions, not between an action and arbitrary UI construction.
{% endhint %}

## From Pawn to Granted Kit

{% stepper %}
{% step %}
#### The component starts

On `BeginPlay`, if the owning PlayerState's controller is a **local** controller, the component reads the local save and pushes the selection to the server. On a listen server and in standalone the RPC executes locally, so one path covers every net mode.

Everything after this point is authority-only.
{% endstep %}

{% step %}
#### A pawn arrives

The component binds the PlayerState's `OnPawnSet`, and also handles the case where a pawn is already possessed by the time the component is added.
{% endstep %}

{% step %}
#### The ability system is waited for

`ApplyToPawn` finds the pawn's `ULyraPawnExtensionComponent` and defers through `OnAbilitySystemInitialized_RegisterAndCall`, so equipment ability grants and perks land against a ready ASC. A pawn with no pawn-extension component grants immediately.
{% endstep %}

{% step %}
#### Previous perks are revoked

Perks live on the **persistent PlayerState** ability system, which survives death. The component tracks its granted handles and takes the previous life's grant back before issuing the next one.
{% endstep %}

{% step %}
#### The loadout is resolved, sanitized, and granted

`ResolveCurrentLoadout` decides which loadout to use, `ULoadoutValidator::Sanitize` strips anything illegal, and `ULoadoutResolver::ApplyLoadout` builds and equips what survives.
{% endstep %}
{% endstepper %}

### Resolution priority

`ResolveCurrentLoadout` answers in this order, taking the first that produces something:

1. The component's `DebugLoadout`, if one is assigned. Editor builds only.
2. A loadout the owning client **pushed up**.
3. The player's **saved selection**, read server-side through the save subsystem.
4. The rule set's `DefaultLoadout`.

Returning false means nothing is granted yet, which is the seam for sourcing loadouts asynchronously. See [Extending](extending.md).

## The Client Push, and Why the First Grant Waits

With the default local save backend a loadout authored in the front end lives on the **client's** disk. A dedicated server cannot read it. The client is therefore the courier: when the consumer component starts on the owning client it loads the local save and submits the selected loadout with one reliable RPC.

The submission travels at network speed, and the pawn can spawn before it lands. A grant cannot be taken back once made, so the **first** grant for a remote player holds briefly rather than racing the RPC:

* `ShouldAwaitClientPush()` is true only for a **remote** player, and only while no submission has arrived and no wait has already expired. Local players and bots never wait.
* While waiting, the pawn is parked and a timer runs for `ClientPushWaitTime`, which defaults to **2 seconds**.
* The client **always** submits, even when it has no selection, so an empty submission is what releases the hold for a player who has never authored a loadout.
* If the wait expires, the fallback chain grants and the expiry **latches**: no later spawn in that match ever waits again.

{% hint style="info" %}
This is transport, not trust. The pushed data is client-authored either way, since a save file on the client's disk is no more trustworthy than an RPC, which is why the server sanitizes before every grant regardless of where the loadout came from.
{% endhint %}

{% hint style="warning" %}
`PushedLoadout` is a **server-only cache that is never cleared**. Once a client has pushed a valid loadout it wins over the server-side save read for the rest of the match, until the client pushes again. Selecting a different loadout mid-match re-submits through the same path and applies at the next spawn.
{% endhint %}

{% hint style="warning" %}
`GameFeatureAction_AddComponents` only names a component class, so changing `ClientPushWaitTime` means creating a **Blueprint subclass** of `ULoadoutConsumerComponent` and referencing that in the action. Setting the wait to `0` disables the hold, and remote players will race their own RPC on first spawn.
{% endhint %}

## What the Resolver Actually Does

`ULoadoutResolver::ApplyLoadout` is authority-only and reuses the public APIs the starting-item flow uses. Nothing about the granted items is special afterwards; they drop, swap, and replicate like any other equipment.

| Entry                | What happens                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Weapon**           | `CreateItemWithInit` with the attachment tree wrapped as an `FAttachmentFragmentInit`, then `AddItemToSlot` on the pawn's equipment manager. When `bAutoHold` is set, the slot data also names the first available held slot |
| **Gear → Equipment** | Same creation path, equipped without being held                                                                                                                                                                              |
| **Gear → Inventory** | `CreateItemWithInit` against the inventory manager, then `AddItemToSlot` at `TargetInventorySlotIndex`                                                                                                                       |
| **Gear → Perk**      | The perk's `AbilitySet` is loaded and given to the ability system, its handles recorded for revoking next life                                                                                                               |

Two placements to know: **equipment lives on the pawn**, inventory lives on the **controller**. A mode that grants inventory gear needs a `ULyraInventoryManagerComponent` on the player controller.

`TryActivateAbilitiesOnSpawn` is called at the very end, after every weapon is equipped, so a perk that reads the player's weapons finds them in place.

{% hint style="info" %}
`ULoadoutResolver` and `ULoadoutValidator` derive from `UBlueprintFunctionLibrary` but their functions are **not** `UFUNCTION`s, they are C++ only. The Blueprint surface is on the component, the subsystem, and the view models.
{% endhint %}

## Validation, Twice

One implementation, two entry points, because the two call sites want different failure behaviour.

**`Validate`** runs when the player saves a build in the gunsmith. It changes nothing and appends one `FText` per violation, so the editor can tell the player exactly what is wrong and refuse the save.

**`Sanitize`** runs on the server immediately before granting. It strips illegal content in place and grants whatever legal remainder survives, returning false only when nothing is left.

Both check the same rules: weapons must pass the allow-list, builder slots must exist in the rule set, every attachment must be accepted by its host's `CompatibleAttachments` map for that specific slot, no slot may be claimed twice, blocked slots are honoured, the per-weapon attachment budget must hold, and the checks recurse through nested sub-attachments. Entries whose soft references fail to resolve are treated as absent rather than as errors, so a loadout authored against a plugin the current experience does not load degrades gracefully.

### What a strip looks like in the log

Every drop `Sanitize` makes is reported as a `LogLoadout` warning naming what was lost and why, so a silent difference between what a player authored and what they spawned with is traceable.

| Situation                            | Message                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| Host has no attachment fragment      | `Sanitize: %s hosts no attachment fragment, stripping %d attachment(s).`                |
| Attachment not accepted in that slot | `Sanitize: dropped %s from slot %s on %s because the host does not accept it there.`    |
| Slot already filled                  | `Sanitize: dropped %s because slot %s on %s is already filled.`                         |
| Weapon unresolvable                  | `Sanitize: dropped the weapon in slot %s because %s could not be resolved.`             |
| Weapon not offered there             | `Sanitize: dropped the weapon in slot %s because the rule set does not offer it there.` |
| Over the attachment budget           | `Sanitize: dropped an attachment from %s because this rule set allows %d per weapon.`   |
| No such gear slot                    | `Sanitize: dropped the gear in slot %s because the rule set has no such slot.`          |
| Gear unresolvable                    | `Sanitize: dropped the gear in slot %s because what it holds could not be resolved.`    |
| Gear not offered there               | `Sanitize: dropped the gear in slot %s because the rule set does not offer it there.`   |

{% hint style="warning" %}
Two behaviours worth knowing when a build comes back different from how it was authored. Attachments removed by a **blocking conflict** are the one case that is not logged, because the gunsmith resolves those at edit time and the pass exists for hand-edited saves. And **budget trimming pops from the tail** of the attachment array, so which attachment survives depends on save order rather than value.
{% endhint %}

{% hint style="danger" %}
**No rule set means no validation.** With a null rule set every weapon and every slot is treated as allowed. This only arises when the `ConfigureLoadout` action is missing or has not run, but it makes an unconfigured experience look permissive rather than broken.
{% endhint %}

### When nothing survives

If `Sanitize` strips a loadout to nothing, the rule set's `DefaultLoadout` is granted instead, and is itself run through `Validate` purely so an authoring mistake surfaces as a warning rather than being granted quietly. If there is no `DefaultLoadout`, the player spawns with nothing and the log says so:

```
GrantResolvedLoadout: loadout %s sanitized to empty and the rule set names no default, nothing granted.
```

## Persistence

Loadouts live in the player's save game, not in any replicated component. `ULoadoutSaveData` holds the loadout list and the selected id, implements `ILyraSaveableInterface`, and reads and writes itself through `ULyraSaveSubsystem` under the `Lyra.Save.Loadouts` tag. The gunsmith writes through it when a player saves a build; the consumer reads through it on the server at spawn.

Because both halves only touch the save subsystem's public API, swapping local save files for an online backend is a matter of subclassing `ULyraSaveSubsystem` and overriding its storage seams, with no change to any loadout code. See [Extending](extending.md) and the [Save System](../../base-lyra-modified/save-system/extending-the-save-system.md) docs.
