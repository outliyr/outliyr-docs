# Runtime Queries

Once teams are created and players assigned, the `ULyraTeamSubsystem` becomes the central authority for every team-related question at runtime. It tracks which teams exist, which actors belong to which teams, and provides the comparison and tag APIs that gameplay systems depend on. The subsystem is a `UWorldSubsystem`, so it's always available via `GetWorld()->GetSubsystem<ULyraTeamSubsystem>()`.

***

## Finding an Actor's Team

`FindTeamFromObject()` takes any `UObject` and returns the team ID it belongs to, or `INDEX_NONE` if it has no team affiliation. Internally, it walks a resolution hierarchy, trying each strategy in order until one succeeds:

<figure><img src="../../.gitbook/assets/image (23).png" alt=""><figcaption></figcaption></figure>

{% stepper %}
{% step %}
**Team agent interface**

If the object implements `ILyraTeamAgentInterface`, the subsystem reads the team ID directly via `GetGenericTeamId()`. Player states, AI controllers, and any custom actor that implements the interface resolve here.
{% endstep %}

{% step %}
**Instigator check**

If the object is an `AActor`, the subsystem checks its instigator. Projectiles, damage-dealing effects, and spawned actors typically have an instigator set to the pawn or controller that created them. If the instigator implements `ILyraTeamAgentInterface`, its team ID is returned.
{% endstep %}

{% step %}
**Team info actor**

If the object is an `ALyraTeamInfoBase` (a public or private team info actor), the subsystem returns its team ID directly. These actors don't implement the team agent interface, so they need this dedicated check.
{% endstep %}

{% step %}
**Player state fallback**

As a last resort, the subsystem tries to find an associated `ALyraPlayerState`. If the object is a Pawn, it checks the pawn's player state. If it's a Controller, it checks the controller's player state. If it's already a player state, it uses it directly. The player state's team ID is then returned.
{% endstep %}
{% endstepper %}

You rarely need to think about this hierarchy. Call `FindTeamFromObject` with whatever actor you have and get the answer. In Blueprints, `ULyraTeamStatics::FindTeamFromObject` provides the same lookup with additional output pins for `bIsPartOfTeam`, `TeamId`, and `DisplayAsset`.

***

## Comparing Teams

`CompareTeams(A, B)` takes two objects and returns an `ELyraTeamComparison`:

<figure><img src="../../.gitbook/assets/image (24).png" alt=""><figcaption></figcaption></figure>

| Value             | Meaning                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `OnSameTeam`      | Both objects have valid team IDs and they match.                       |
| `DifferentTeams`  | Both objects have valid team IDs that differ.                          |
| `InvalidArgument` | One or both objects don't have a team (their team ID is `INDEX_NONE`). |

The Blueprint-exposed version also outputs both team IDs as separate pins, and the return enum is configured with `ExpandEnumAsExecs` so you can wire each outcome to a different execution path.

### Friendly Fire: `CanCauseDamage`

`CanCauseDamage(Instigator, Target, bAllowDamageToSelf)` is the standard friendly fire gate. The logic works as follows:

{% stepper %}
{% step %}
**Self-damage check**

If `bAllowDamageToSelf` is true, the function checks whether the instigator and target are the same actor (or resolve to the same player state). If so, damage is allowed immediately, regardless of team.
{% endstep %}

{% step %}
**Team comparison**

The function calls `CompareTeams`. If the result is `DifferentTeams`, damage is allowed. If `OnSameTeam`, damage is blocked.
{% endstep %}

{% step %}
**Non-team actor fallback**

If `CompareTeams` returns `InvalidArgument` but the instigator has a valid team, damage is allowed as long as the target has an ability system component. This handles cases like destructible objects that haven't been assigned a team.
{% endstep %}
{% endstepper %}

Damage execution classes call `CanCauseDamage` to decide whether to apply damage. You don't need to add friendly fire checks in your own gameplay abilities if they go through the standard damage pipeline.

***

## Changing Teams

`ChangeTeamForActor(Actor, NewTeamId)` is server-authority only. It handles the full team-change pipeline in a single call:

<figure><img src="../../.gitbook/assets/image (33).png" alt=""><figcaption></figcaption></figure>

{% stepper %}
{% step %}
**Resolve the team agent**

The subsystem first tries to find an `ALyraPlayerState` from the actor (via pawn, controller, or direct cast). If found, it calls `SetGenericTeamId()` on the player state. If no player state exists, it falls back to casting the actor to `ILyraTeamAgentInterface` and calling `SetGenericTeamId()` on that.
{% endstep %}

{% step %}
**Refresh ability system grants**

If the actor has a `ULyraAbilitySystemComponent`, the subsystem notifies `ULyraGlobalAbilitySystem::RefreshASCForTeam()`. This removes ability grants that were tied to the old team and applies grants for the new team.
{% endstep %}

{% step %}
**Apply team pawn data**

If the actor is a player, the subsystem looks up the `ULyraTeamCreationComponent` on the game state and calls `ApplyTeamPawnDataToPlayer()`. This ensures the player gets the correct pawn data for their new team in asymmetric modes.
{% endstep %}
{% endstepper %}

The player state replicates the new team ID to all clients. The team change delegate on the player state fires, which async actions and UI listeners pick up to update visuals.

If the actor already belongs to the requested team, the function returns `true` immediately without doing any work.

***

## Team Tags

Teams can carry gameplay tag stacks on their info actors. These act as replicated counters attached to a team rather than an individual player, useful for tracking shared state that any client can read but only the server can modify.

| Function                                      | Authority   | Description                                                                                               |
| --------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| `AddTeamTagStack(TeamId, Tag, StackCount)`    | Server only | Adds stacks to the tag on the team's **public** info actor. Does nothing if `StackCount` is below 1.      |
| `RemoveTeamTagStack(TeamId, Tag, StackCount)` | Server only | Removes stacks from the tag on the team's **public** info actor. Does nothing if `StackCount` is below 1. |
| `GetTeamTagStackCount(TeamId, Tag)`           | Any         | Returns the total stack count by **summing** from both the public and private info actors.                |
| `TeamHasTag(TeamId, Tag)`                     | Any         | Convenience check: returns `true` if `GetTeamTagStackCount` returns greater than 0.                       |

{% tabs %}
{% tab title="Add Team Tag Stack" %}
<figure><img src="../../.gitbook/assets/image (25).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Remove Team Tag Stack" %}
<figure><img src="../../.gitbook/assets/image (26).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Get Team Tag Stack" %}
<figure><img src="../../.gitbook/assets/image (28).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Team Has Tag" %}
<figure><img src="../../.gitbook/assets/image (29).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
The add and remove operations target the public info actor only, but the read operations sum from both public and private. This means you can use private info tags for server-side-only state (set directly on the private info actor) while keeping shared state on the public side through the subsystem API.
{% endhint %}

Use cases include tracking team kills, deaths, score, objectives ("numbers of flags captured"), applying team-wide buffs via gameplay tag checks, and counting shared resources. The `OnTeamTagChanged` delegate on the team info actors broadcasts when tags change, so UI can react immediately.

<figure><img src="../../.gitbook/assets/image (40).png" alt=""><figcaption><p>Update the the number of bombs defused for the player and team</p></figcaption></figure>

***

## Viewer Tracking

The subsystem tracks who the local player is currently observing. During normal play, this is the local player themselves. During spectating or a killcam, it switches to whoever is being watched.

* `SetCurrentViewer(PlayerState)` updates the viewed player. Passing `nullptr` resets it to the local player state.
* `GetCurrentViewer()` returns the current viewer. Falls back to the local player state if no viewer has been explicitly set.
* `IsViewingSelf()` returns `true` when the effective viewer is the local player.

This drives perspective color resolution. When perspective mode is enabled, `GetEffectiveTeamDisplayAsset()` needs to know the viewer's team to decide whether any given team should appear as ally or enemy. When the viewer changes (e.g., the player starts spectating a teammate), the display assets need to be re-evaluated.

The `OnViewerChanged` delegate fires whenever the viewer changes. The `UAsyncAction_ObserveViewerTeam` async action listens to this delegate and also tracks the viewer's own team changes. It fires once immediately with the current state, then again whenever the viewer switches or the viewer's team changes. This is the recommended way for UI widgets to stay in sync with perspective-dependent team colors.

<figure><img src="../../.gitbook/assets/image (41).png" alt=""><figcaption></figcaption></figure>

<details>

<summary>Blueprint convenience: ULyraTeamStatics</summary>

`ULyraTeamStatics` is a Blueprint function library that wraps the subsystem's viewer and team queries into static functions with world context:

* `GetCurrentViewer(WorldContextObject)` returns the current viewer's player state.
* `GetCurrentViewerTeam(WorldContextObject)` returns the viewer's team membership (bIsPartOfTeam, TeamId, DisplayAsset).
* `GetEffectiveTeamDisplayAsset(WorldContextObject, TeamId, ViewerTeamId)` returns the perspective-aware display asset. If `ViewerTeamId` is -1, perspective mode falls back to the raw team display asset.
* `GetTeamScalarWithFallback`, `GetTeamColorWithFallback`, `GetTeamTextureWithFallback` extract named parameters from a display asset with fallback defaults.

These are the functions you'll call most often in widget Blueprints and material parameter bindings.

</details>
