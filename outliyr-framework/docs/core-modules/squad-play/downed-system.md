# Downed System

The downed system is the heart of SquadPlay. It turns a lethal hit into a recoverable knockdown, runs the bleed-out that follows, and decides the moment a knockdown finally becomes a real death. All of it lives on one pawn component, `USquadDownedComponent`, and one ability, the squad death ability, that decides between the two outcomes.

### The Down Versus Die Decision

Every pawn that can die receives a death gameplay event when its health empties, and an ability activates on it. The squad death ability replaces the ordinary one. Rather than always dying, it asks a single question: can the squad still act on this knockdown? If a teammate is able to revive, or the player carries a self-revive, it enters the downed state. Otherwise it proceeds straight to a real death, which is why the last member of a squad with no self-revive simply dies instead of lying down forever.

A teammate is "able" when they are on the same team, alive, and not themselves downed. The check runs against the team subsystem, so it reflects the live roster rather than a cached count.

<details>

<summary>The decision, on the death event</summary>

The ability keeps `bAutoStartDeath` off so the base class does not kill the pawn on activation. On the server it inspects the downed component and the team before choosing a branch.

```cpp
const bool bCanBeDowned =
    DownedComponent && !DownedComponent->IsDowned() &&
    (HasAbleTeammate() || DownedComponent->CanSelfRevive());

if (bCanBeDowned)
{
    DownedComponent->OnDownedEnded.AddUObject(this, &ThisClass::HandleDownedEnded);
    DownedComponent->EnterDowned();
    // Announce the knockdown now; the real elimination follows if they die.
}
else
{
    ProceedToDeath(/*bWasDowned=*/ false);
}
```

`HasAbleTeammate` resolves through `USquadDownedComponent::TeamHasAbleMember`, which walks the pawn's team for a living, non-downed member.

</details>

### The Restored Fighting Pool

Health sits at zero the instant a knockdown lands, so entering the downed state first restores a pool. This is deliberate: a downed player is not untouchable at zero health waiting on a timer, they crawl on real health that enemies can shoot away. The pool is restored through the project heal effect, and from that point the component watches the health attribute so that depleting the pool converts the down into a death through the same path a bullet would take.

Because the pool is real health, a downed player still reads as alive to the health component and to team logic. Nothing outside `SquadPlay` has to know the downed state exists for alive counts to stay correct.

### Bleed-Out Is Decay, Not A Clock

There is no separate timer that kills a downed player at the end of a window. The restored pool **drains gradually** over the bleed-out length, so the health bar slides from full to empty across the whole time the player is down. The practical effect is what you expect from a battle-royale knockdown: the longer someone is down, the less health they have and the fewer shots it takes to finish them, and any damage an enemy deals stacks on top of the drain. Whether the pool empties from the drain alone or from a bullet, hitting zero is the one and only death path.

The drain runs on a repeating server step. Each step applies a slice of damage sized so the whole pool empties across the bleed-out length, and it is applied through a cue-free damage effect so the bleed produces no floating numbers or hit feedback. The step goes through the real damage pipeline, so it fires the normal resource notifications and the drain is visible on every client and in the teammate frames.

<details>

<summary>Sizing the per-step damage</summary>

The component owns the numbers; the damage effect is a generic `SetByCaller` applicator that carries no timing of its own.

```cpp
const float DrainPerStep = DownedHealthAmount * (BleedOutDrainInterval / ActiveBleedOutDuration);
ApplyBleedDamage(DrainPerStep);   // applies BleedOutDamageEffect with SetByCaller.Damage = DrainPerStep
```

Over `ActiveBleedOutDuration`, the steps sum to `DownedHealthAmount`, so the pool reaches zero at the end of the window. A smaller `BleedOutDrainInterval` drains more smoothly at the cost of more frequent replication.

</details>

### The Knockdown Counter

The bleed-out length is not a single number. It is a map keyed by how many times the player has been knocked down this life, so repeated knockdowns bleed out faster and a squad that keeps a fragile teammate up pays a rising cost for it. The first knockdown of a life uses the first entry; each later knock this life uses the next. A knockdown past the highest key holds at that key's value, so a short list still covers every later knock.

The counter climbs across revives within a single life and **resets on death and on redeploy**. A player who bleeds out or is finished starts their next life fresh, and a redeployed player spawns with a new pawn and therefore a new count of zero.

<details>

<summary>Looking up the bleed-out length</summary>

`BleedOutDurationByDownCount` maps knockdown number, first knock being one, to seconds. The lookup takes the highest key at or below the current count.

```cpp
// e.g. { 1: 30, 2: 18, 3: 10, 4: 5 }
//   first down  -> 30s
//   second down -> 18s
//   fifth down  -> 5s   (holds at the last key)
```

An empty map falls back to a safe internal default so the drain never divides by a zero window.

</details>

### The Entry Invulnerability Window

A shotgun blast that knocks a player down is often still mid-burst. Without protection, the remaining pellets of that same shot would delete the freshly restored pool before the player ever really got a chance to crawl. So entering the downed state grants a short damage immunity, long enough for the finishing burst to pass, after which a fresh shot can finish the knocked player as normal. The window is applied as a loose immunity tag that the damage pipeline already honours, and it is cleared the moment it elapses or the downed state ends.

### Becoming A Real Death

A downed state ends in one of two ways. A revive brings the player back and the story continues. Otherwise the knockdown resolves into a real death, and the same death ability that put the player down finishes the job: it runs the death presentation, records who was knocked, and hands the player to spectating. This is why the bleed-out and an enemy's killing blow feel identical. Both routes reduce the pool to zero, the health watch reacts, and the single death path runs.

The finish is deferred by a tick when the pool is emptied by damage, so the downed component resolves the death before the health component's own out-of-health handling would, which prevents a duplicate elimination in the feed.

<details>

<summary>Ending the downed state</summary>

The component exposes both outcomes, and a broadcast lets the death ability complete a real death when a knockdown was not revived.

```cpp
void Revive();          // server: brings a downed owner back
void ForceBleedOut();   // server: ends the down as a death now

FSquadPlayDownedEnded OnDownedEnded;   // server signal, carries bWasRevived
```

When `OnDownedEnded` reports it was not a revive, the death ability proceeds to the real death; when it was a revive, the ability simply ends.

</details>

### Reacting To The Downed State

The downed flag replicates, and its replication drives everything a listener needs. A `Status.Death.Downed` gameplay tag is mirrored onto the owner's ability system on both server and clients, so an ability relationship can block a downed player from acting simply by treating that tag as an activation-blocking condition. A delegate fires on every state flip, and a gameplay message carries the same information for systems that prefer messaging, such as the elimination feed announcing a knockdown separately from the eventual elimination.

<details>

<summary>State signals</summary>

```cpp
bool IsDowned() const;
float GetBleedOutTimeRemaining() const;   // valid on server and clients while downed

FSquadPlayDownedStateChanged OnDownedStateChanged;   // server and clients, on every flip
```

The `SquadPlay.Message.Downed` gameplay message carries the player, whether they are now downed, and whether the change was a revive.

</details>

### Configuration

Every knob lives on the downed component, so a mode tunes the feel without touching code.

<details>

<summary>Downed component settings</summary>

| Setting                         | What It Controls                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `BleedOutDurationByDownCount`   | Bleed-out seconds keyed by knockdown number this life; a count past the last key holds at it |
| `DownedHealthAmount`            | The pool restored on a knockdown, and therefore how much damage a downed player can soak     |
| `BleedOutDrainInterval`         | Seconds between drain steps; smaller is smoother at a higher replication cost                |
| `BleedOutDamageEffect`          | The cue-free `SetByCaller` damage effect each drain step applies                             |
| `DownedInvulnerabilityDuration` | The entry immunity window; zero disables it                                                  |
| Revive settings                 | The hold time, prompt text, granted ability, and prompt widget for reviving this player      |
| Banner settings                 | The banner class dropped on a real death and how long it lasts                               |

</details>
