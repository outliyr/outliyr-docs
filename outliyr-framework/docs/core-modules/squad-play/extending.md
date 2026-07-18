# Extending

The plugin's C++ classes do the state work and leave presentation and mode policy to Blueprint. This page collects the extension points that go beyond configuration: writing your own redeploy flow, turning self-revive into an item, surfacing extra resources in the frames, and replacing the shipped widgets.

### Writing A Game Mode's Own Redeploy Handler

The shipped beacon Blueprint answers `SquadPlay.Message.RedeployRequested` by respawning the member at the beacon, but the message is the actual contract, and anything can answer it. A mode with a dropship, a deployment menu, or a delayed wave respawn listens for the message itself and ignores the shipped handler entirely.

A handler has two responsibilities. First, undo whatever the mode did when the member died for good: clear the elimination mark that scoring or win conditions track, since to the rest of the mode this player is currently dead. Second, put them back in the world, either through `RespawnPlayerAtTransform` for an immediate return at the requested transform, or through the mode's own sequence, in which case the transform is just a suggestion the beacon made.

<details>

<summary>Handler shape</summary>

Listen for the message on the server, typically from a game state component or the beacon actor:

```cpp
// Payload: FSquadRedeployRequest { Member, SpawnTransform }

// 1. Clear the mode's elimination state for Member.
// 2. Bring them back:
APawn* NewPawn = ASquadTeamInfo::RespawnPlayerAtTransform(Controller, Request.SpawnTransform);
```

The helper refuses a member who already has a living pawn and drops a spectator pawn before restarting, so a handler can call it without re-checking either. `On Redeploy Requested` on the redeploy ability fires once per redeem on the server for presentation on the redeeming player's side, a confirmation sting or a beacon effect, independent of how the members actually return.

</details>

### Self-Revive As An Item

The downed component treats a player as self-revive capable while any granted ability carries the `SquadPlay.Ability.SelfRevive` tag, which the stock self-revive ability already does. That makes a consumable self-revive an item problem, not a downed-system problem: an item whose ability set grants the self-revive ability is a charge, because [equipment ability sets](../../base-lyra-modified/equipment/) come and go with the item.

The consumption side is the `On Self Revive Succeeded` event, which fires on the server after a completed self-revive. A consumable implementation removes the granting item there, which takes the ability with it and disarms the next knockdown. Leaving the event empty makes the self-revive a permanent trait instead, which is also a legitimate design, a character perk rather than an item.

### Tracking Another Resource In The Frames

The snapshot samples whatever resource attribute sets the squad team info's `TrackedResources` array lists, health and shield by default. Surfacing a custom pool, armor plates or stamina, is two steps: add its attribute set class to the array on your `SquadTeamInfo` subclass, and give the frame widget a bar bound to that set through `GetMemberResourcePercent`. The identity travels with the reading, so nothing else changes; members who lack the set simply report zero.

### Replacing The Shipped Widgets

Both squad widgets are content, and both read replicated state that any widget can read, so replacing them is a swap rather than a rewrite:

* **The teammate frames** are one entry in the HUD action set. A custom container needs only what the shipped one uses: find the squad info, bind `OnTeamStatusChanged`, and rebuild from `GetMemberStatuses`. The retry caveat in [Teammate Frames](teammate-frames.md) applies.
* **The downed-aware health bar** is one entry in the hero pawn data's widget list. A custom bar reads the same two components the shipped one does, the local resource component for the values and the downed component for the state flip.

### Presentation Hooks On The Abilities

Each C++ ability exposes its moments as Blueprint events, all server-side, so a mode layers feedback without touching the state machine:

| Ability         | Event                      | The Moment                                                                                                  |
| --------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Squad death     | `On Downed`                | The owner just entered the downed state                                                                     |
| Squad death     | `On Revived`               | The owner was revived, just before the ability ends                                                         |
| Squad death     | `On Death Started`         | Death became real; the event data still carries the original blow, so the killer is known even at bleed-out |
| Revive          | `On Revived Target`        | A teammate revive completed, with the revived pawn                                                          |
| Self-revive     | `On Self Revive Started`   | The hold began, with its length, for progress UI                                                            |
| Self-revive     | `On Self Revive Succeeded` | The hold completed; consume the charge here                                                                 |
| Retrieve banner | `On Banner Retrieved`      | A banner was recorded, with the member it redeploys                                                         |
| Redeploy        | `On Redeploy Requested`    | The carried banners were redeemed at a beacon                                                               |

The knock feed entry is also stylable without touching the feed: the relay's `KnockdownIcons` list is appended after the weapon icon on every knockdown entry, which is where a custom downed marker goes.
