# Capture Model

Everything a control point does happens on the server, on a fixed update interval, from one input: who is standing inside it. This page walks the model from presence to ownership, then through the policies that make the same actor feel like Domination, Hardpoint, Headquarters or Payload, and ends with the lifecycle commands a mode drives.

***

### Presence

The capture area is a sphere; the point counts the pawns inside it per team on every server update. Team membership resolves through the team subsystem, so anything with a team, players and bots alike, participates. Two knobs shape the count before it becomes progress: `MaxPlayersCounted` caps how many teammates speed up a capture, so stacking a whole squad on the point stops paying past the cap, and the optional `AllowedTeamIds` whitelist silently ignores teams that are not supposed to interact with this point.

A single player fills the bar from empty in `TimeToFullCaptureSeconds`; additional counted players multiply that rate. The same head-count also keeps two replicated flags up to date: `bIsOccupied` is true while anyone is standing on the point, and `bIsContested` is true while more than one team is. The UI colors itself from them, and the contested flag is what the scoring policies check when deciding whether an owner keeps earning.

***

### The Two Tracks

Progress always advances along one of two tracks, and which track is live depends on whether the point currently has an owner.

A **neutral** point runs the _capture_ track: the strongest attacking team fills the bar toward ownership, and the moment it reaches full, the point is theirs and the captured message fires with everyone who contributed. An **owned** point runs the _neutralize_ track: enemies push a bar that strips the owner's control, and completing it does not hand them the point, it returns the point to neutral, from where the capture track begins fresh. Flipping an enemy point is therefore always two phases, which is what makes defending a half-neutralized point worth doing.

When the owning team drives attackers off mid-neutralize, the point enters what the UI calls _reinforcing_: the owner's control climbs back toward full. The point remembers how far the enemy got before the defence turned it around, and once control is fully restored it fires a recaptured message carrying that value and the defenders who were present. A mode can use it to score a last-second save differently from a hold that was never really in danger.

<details>

<summary>Track state as it replicates</summary>

```cpp
int32 OwnerTeamId;        // INDEX_NONE while neutral
EControlPointTrack ActiveTrack;  // None, Capture, or Neutralize
int32 TrackOwnerTeamId;   // the attacking team on the capture track
int32 TargetTeamId;       // the team the UI fill is heading toward
float CaptureProgress;    // 0..1 on the active track
bool  bIsContested;
bool  bIsOccupied;
```

`GetUIStateForViewer` folds these into a single state, neutral idle, capturing, neutralizing, reinforcing, captured, locked, or inactive, plus ours-versus-theirs sides resolved for the asking player, so widgets never re-derive the state machine themselves.

</details>

***

### The Policies

Three enums on the capture settings are where the modes diverge. They answer the three questions every capture design has to answer, and each answer is per-point, so a mixed layout is possible.

**What happens while both sides stand on the point?** `ContestResolution` either freezes all progress the moment any defender is present, the classic stalemate, or scores the difference, letting three attackers out-fill one defender at reduced speed.

**What happens to a rival's half-filled bar?** On a neutral point, `TakeoverRule` either forces the newcomer to undo the other team's progress before building their own, or wipes it instantly the moment the balance of presence flips.

**When does an owner stop earning?** `ScoringPolicy` is answered through `ShouldScore`, which a mode's scoring loop polls per team. Score-while-owned only stops when ownership is actually lost, Domination's choice. Stop-when-contested pauses the instant an enemy sets foot on the point, the Hardpoint and Headquarters feel. The hybrid stops only once neutralization is genuinely moving, so a contest that is going nowhere does not silence the scoreboard.

<details>

<summary>The policy enums</summary>

| Policy              | Options                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContestResolution` | <p><code>BlockWhenContested</code>: any opposing presence halts progress. <br><code>NetAdvantage</code>: progress scales with attackers minus defenders</p> |
| `TakeoverRule`      | `UndoRequired`: deplete the rival bar first. `InstantReset`: the rival bar wipes to zero                                                                    |
| `ScoringPolicy`     | `ScoreWhileOwned`, `StopWhenContested`, `StopWhenNeutralizingBegins`: evaluated by `ShouldScore(TeamId)`                                                    |

</details>

***

### When The Point Is Empty

An abandoned point can hold its state forever or bleed back toward a clean slate, and the empty-area settings choose per point. In-progress captures can decay at a configured rate, so a raid that got the bar to ninety percent means nothing ten seconds after everyone left. An owned point can decay toward neutral, which is how a mode punishes a team that captures and abandons. Or the point can simply reset the moment the last player leaves, overriding both rates. All three default off, which is the Domination behaviour: progress and ownership are permanent until someone changes them.

***

### Lifecycle Commands

The mode, not the point, decides when a point is playable, and it does so through server-side commands. `Lock` and `Unlock` make a point temporarily inert, with `LockForSeconds` for timed windows such as a between-rounds pause; the locked settings decide whether locking also resets progress and ownership. `Activate` and `Deactivate` are the stronger pair for rotation modes, optionally hiding the actor and dropping its collision entirely while it is out of play, which is how a Hardpoint hill that is not the current hill costs nothing. `ResetPoint` wipes progress and, optionally, ownership in place.

Points placed for an always-on mode start active by default; a rotation mode unchecks `bStartsActive` on its placed points and activates them one at a time from its own timer. Every one of these transitions broadcasts its message, so UI and bots follow the rotation with no extra wiring, and the [activation settings](setup-and-integration.md) decide what each transition does to the point's state.
