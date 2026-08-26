# Redeploy

A real death does not have to be the end of a squad member's match. When a player dies for good, they drop a banner where they fell. A living teammate retrieves it, the squad carries it, and any member can redeem it at a respawn beacon to bring the fallen player back. The plugin owns the banner and beacon flow end to end, but deliberately stops at the moment of respawn: it broadcasts a request, and the game mode decides how the member actually returns.

***

### The Banner

The banner is dropped by the dead player's downed component the moment their death is final, whether they bled out or were finished. Which banner class drops, and how long it lasts, are the component's `BannerClass` and `BannerLifetimeSeconds` settings; leaving the class unset drops no banner, which is how an experience opts out of redeploy entirely. The lifetime matters because a banner is a promise: once it expires, the member is gone for good, and the squad's window to act closes.

Like the revive interactable, the banner is its own actor because the interaction scan only considers actors implementing the interactable interface. It carries the interaction volume, the prompt, and a replicated reference to the dead member, and it offers its pickup only to that member's teammates.

<details class="gb-toggle">

<summary>Retrieving a banner</summary>

The banner's interaction option grants `USquadGameplayAbility_RetrieveBanner` and passes the banner as the event's optional object. On activation the ability records the banner's dead member on the squad's team info, then destroys the banner whether or not it still named a member, so a stale banner cannot linger in the world.

```cpp
if (APlayerState* Member = Banner->GetDeadMember())
{
    // Records onto the squad, not this player, so any teammate can redeem it.
    SquadInfo->AddCarriedBanner(Member);
    K2_OnBannerRetrieved(Member);
}
Banner->Destroy();
```

| Setting             | What It Controls                                                      |
| ------------------- | --------------------------------------------------------------------- |
| `PickupText`        | Prompt shown to a teammate looking at the banner                      |
| `PickupHoldSeconds` | Seconds the teammate holds to retrieve it                             |
| `PickupAbility`     | Ability granted by the option; the stock retrieve ability works as-is |
| `PickupWidgetClass` | Widget shown during the hold                                          |
| `InteractionRadius` | Size of the pickup volume around the banner                           |

</details>

***

### Carried By The Squad, Not A Player

A retrieved banner is recorded on the [squad's team info](teammate-frames.md#the-squad-team-info), not on whoever picked it up. Because a squad's private team info replicates only to its own members, the carried list is visible to the entire squad and to no one else, so any teammate can finish the job at a beacon, including someone who never touched the banner. There is no banner item to drop, lose, or have killed out of a player's hands; once retrieved, the carry belongs to the squad until it is redeemed.

***

### The Respawn Beacon

`ASquadRespawnBeacon` is a placed interactable, positioned in the level wherever the mode wants members brought back. It offers its option only while the interacting player's squad is actually carrying at least one banner, so an empty-handed squad walks past a silent beacon rather than a dead prompt.

Completing the beacon's hold activates the redeploy ability, which redeems every banner the squad is carrying at once. Each carried member produces one `SquadPlay.Message.RedeployRequested` broadcast carrying the member and the beacon's transform, and the carried list is cleared. From the plugin's point of view, the redeploy is now done: the announcement is the hand-off.

<details class="gb-toggle">

<summary>Redeeming at a beacon</summary>

```cpp
// USquadGameplayAbility_Redeploy, activated by the beacon's interaction option.
SquadInfo->RedeemCarriedBannersAt(Beacon->GetActorTransform());

// ASquadTeamInfo::RedeemCarriedBannersAt broadcasts one request per member:
FSquadRedeployRequest Request;
Request.Member = Member;                 // the fully dead member to bring back
Request.SpawnTransform = SpawnTransform; // where the beacon wants them to reappear
MessageSubsystem.BroadcastMessage(TAG_SquadPlay_Message_RedeployRequested, Request);
```

| Setting               | What It Controls                                                      |
| --------------------- | --------------------------------------------------------------------- |
| `RedeployText`        | Prompt shown while a carrying squad member is in range                |
| `RedeployHoldSeconds` | Seconds held to redeem the carried banners                            |
| `RedeployAbility`     | Ability granted by the option; the stock redeploy ability works as-is |
| `RedeployWidgetClass` | Widget shown during the hold                                          |
| `InteractionRadius`   | Size of the use volume around the beacon                              |

</details>

***

### The Mode Fulfils The Request

Bringing a player back touches things the plugin cannot know about: elimination records, scoring, spectator hand-offs, a dropship sequence. So the respawn itself belongs to mode content. The shipped beacon Blueprint listens for the redeploy request message and answers it with the one helper the plugin does provide, `RespawnPlayerAtTransform`, which routes the member back through the game mode's normal restart so they return with the mode's own pawn data.

The helper is deliberately guarded. It refuses a member who already has a living player pawn, and it recognises the teammate spectator a dead player watches from, dropping that spectator pawn before restarting so the mode can possess a fresh one. A redeployed player therefore returns on a brand-new pawn, which also means their [knockdown counter](downed-system.md#the-knockdown-counter) starts fresh.

<details class="gb-toggle">

<summary>The default respawn helper</summary>

```cpp
// Server only. Returns the new pawn, or null when respawn is refused.
static APawn* ASquadTeamInfo::RespawnPlayerAtTransform(AController* Controller, const FTransform& SpawnTransform);
```

A living player pawn means the member is already back in the fight, so the call refuses. A spectator pawn is unpossessed and destroyed, then the game mode's `RestartPlayerAtTransform` places the member at the beacon.

A mode with its own return sequence simply listens for `SquadPlay.Message.RedeployRequested` itself instead of using the shipped beacon handler; that recipe is in [Extending](extending.md).

</details>

> [!INFO]
> A player who redeploys outside a mode's play area is the mode's problem to police, the same as any other spawn. The battle royale experiences, for example, re-evaluate players against the safe zone on a timer, so a member redeployed outside it starts taking zone damage like anyone else.
