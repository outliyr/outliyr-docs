# Extending

The plugin ships a complete local-save loadout system, which is the right default for a game with no backend. This page covers the seams for going beyond that: sourcing loadouts from a service, moving where saves live, adding your own perks, and layering progression on top.

## Sourcing Loadouts From a Backend

`ULoadoutConsumerComponent::ResolveCurrentLoadout` is the intended override point. It decides which loadout to grant and returns whether it has an answer now.

For a service that answers immediately, fill the out parameter and return true. For a real network call, return **false** and call `FinishPendingGrant` when the response arrives:

```cpp
bool UMyLoadoutConsumer::ResolveCurrentLoadout(APawn* Pawn, FLoadoutData& OutLoadout)
{
    TWeakObjectPtr<APawn> WeakPawn(Pawn);
    MyBackend->FetchLoadout(GetOwningPlayerState(),
        [this, WeakPawn](const FLoadoutData& Fetched)
        {
            if (APawn* ReadyPawn = WeakPawn.Get())
            {
                FinishPendingGrant(ReadyPawn, Fetched);
            }
        });

    return false;   // nothing granted yet
}
```

`FinishPendingGrant` already handles the awkward cases: it verifies the pawn is still alive and still belongs to this player before granting, because an answer can arrive after the player it was asked for has respawned or left. It also routes through the same sanitize-and-grant path, so perk handle tracking stays accurate.

{% hint style="warning" %}
Do not grant by calling the resolver directly. `PerkHandles` is private to the component, and perks live on the persistent PlayerState ability system. Bypassing `GrantLoadout` or `FinishPendingGrant` means the previous life's perks are never revoked and they compound across respawns.
{% endhint %}

Because your override replaces the whole resolution chain, the client push simply stops mattering: the server asks your service by player identity and never consults client-authored data. Set `ClientPushWaitTime` to `0` on your component subclass so first spawns never pause for a submission you no longer need.

## Moving Where Saves Live

`ULoadoutSaveData` reads and writes itself through `ULyraSaveSubsystem` under the `Lyra.Save.Loadouts` tag, and touches nothing else. Swapping storage is therefore a save-system change, not a loadout change: subclass `ULyraSaveSubsystem` and override its storage seams, and every loadout code path follows automatically.

That covers the gunsmith too. If the editor writes through to your backend at save time, a player's builds are already where a server-side `ResolveCurrentLoadout` override will look for them by the time they join a match, and nothing travels client-to-server at spawn.

See [Extending the Save System](../../base-lyra-modified/save-system/extending-the-save-system.md) for the seams themselves.

## Removing the Client Push Entirely

The two sections above combine into the arrangement most games with a backend want: the gunsmith writes builds to your service, the server reads them back by player identity, and nothing about a loadout travels client to server at spawn. It takes three changes, and the third is easy to miss.

{% stepper %}
{% step %}
### Point storage at your service

Subclass `ULyraSaveSubsystem` and override its storage seams. The gunsmith writes through `ULoadoutSaveData`, which touches nothing but the save subsystem, so builds land in your backend the moment a player saves one.
{% endstep %}

{% step %}
### Read them back on the server

Override `ResolveCurrentLoadout` to fetch by player identity, returning false and calling `FinishPendingGrant` when the answer arrives. Your override replaces the whole resolution chain, so neither the push nor the local save read is consulted.
{% endstep %}

{% step %}
### Set `ClientPushWaitTime` to `0`

The hold that waits for a client submission runs **before** resolution, so an override does not bypass it. Leave the wait at its default with no client pushing, and every remote player's first spawn stalls for the full duration before falling through to your override. Setting it to zero removes the wait.
{% endstep %}
{% endstepper %}

With those in place the consumer component has no client-side job left, since its only one was carrying the submission. Adding it on the server alone in `GameFeatureAction_AddComponents` is then enough, and the gunsmith notifying a consumer that is not there is a silent no-op rather than an error.

## Adding Perks

A perk is a `ULoadoutPerkDefinition` naming a `ULyraAbilitySet`, so anything an ability set can grant is a valid perk: passive abilities, attribute effects, tag grants, input-bound actives.

For perks that only change weapon numbers, subclass `ULoadoutPerkAbility_WeaponStats` and fill its `WeaponStats` array with stat tag, modifier, and operation entries. It affects whatever is equipped when it activates, skipping anything that does not already carry the stat, and reverts in `EndAbility`. Because it modifies the same tag attributes the attachment abilities use, the gunsmith's stat preview accounts for it with no extra work.

{% hint style="info" %}
That ability takes its reading **once, when it activates**. A perk that should also affect weapons picked up later in the match needs to listen for equipment changes itself.
{% endhint %}

Expose a perk to players by adding it to the `AllowedPerks` list on a `Perk`-kind builder slot in the rule set.

## Customizing the Editor

The view models are the API; the shipped widgets are one presentation. [The Gunsmith](the-gunsmith.md) covers binding a custom editor in detail. Two virtuals exist for changing behaviour rather than appearance:

* `ULoadoutBrowserViewModel::RefreshEntries` decides which loadouts appear and in what order.
* `ULoadoutBuilderViewModel::RefreshSlotViewModels` decides how slots present their contents.

For row widgets, derive from `ULoadoutEntryWidgetBase` or `ULoadoutListRowBase` rather than rebuilding list-entry plumbing.

## Layering Progression On Top

Validation in this plugin is **legality only**: does this rule set offer this weapon in this slot, does this host accept this attachment, is the budget respected. There is deliberately no ownership, unlock, level, or currency concept anywhere in it.

That is the extension point rather than a gap. A progression system decides what a player has earned and expresses the answer as a rule set, which the existing validator then enforces on both sides for free. Two shapes work well:

* **Per-experience rule sets.** Different modes already point at different rule sets. A ranked mode restricting the arsenal is a rule set with a shorter `AllowedWeapons` list.
* **Runtime rule sets.** Because `UGameFeatureAction_ConfigureLoadout` publishes into `ULoadoutSubsystem`, a system that builds a `ULoadoutRuleSet` per player from their unlocks can publish it the same way. The gunsmith then offers exactly what that player owns, and the server strips anything else at grant time.

Both keep the unlock rules in one place and reuse the two-sided validation the plugin already performs.
