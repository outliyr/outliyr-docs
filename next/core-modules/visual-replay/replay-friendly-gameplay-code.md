# Writing Replay-Friendly Gameplay Code

Most actors replay correctly without any extra work. The ones that don't are almost always breaking one of a small number of rules, and the same rules also decide whether the actor looks right to a player who joins a match late. This page lists them, each as what goes wrong, why, and what to do.

***

## The Principle

A shell is brought up the way a client receives an actor it has never seen: it has no authority, it is handed the current replicated values, its rep notifies run for values that differ from its class defaults, and it begins play once its first values are in.

**Code that is correct for a late-joining client is correct for a replay.** A replay bug usually shows up for late joiners too, and fixing one fixes the other. The extra rules come from what a shell deliberately doesn't do: it doesn't tick, and its timers never fire.

***

## The Rules

### Decide on the server, show on clients

**Symptom.** In a replay, an actor comes up in its starting state instead of the state it was in: an objective that was switched off shows as on, or the other way round.

**Why.** Code in BeginPlay applied a designer setting on every machine. On a shell, and on a late joiner, that overwrites the value the server had sent.

**Do.** Apply starting settings only where the actor has authority. Everywhere else, show the value that arrived.

```cpp
void AMyObjective::BeginPlay()
{
    Super::BeginPlay();
    if (HasAuthority())
    {
        SetActive(Settings.bStartsActive);   // the server decides from its settings
    }
    else
    {
        OnRep_IsActive();                     // a client, and a shell, show what the server sent
    }
}
```

### Present from rep notifies and BeginPlay, not Tick

**Symptom.** A shell never changes colour, state or animation, even though its recorded values change.

**Why.** Shells don't tick. Their state comes from the recording, so anything that would advance them on the live clock is turned off after every update.

**Do.** Drive presentation from rep notifies and BeginPlay, which run on shells exactly as on clients. A skeletal mesh's own animation is the exception: a shell's meshes keep ticking under the replayed pose.

### Wait with Delay, not timers

**Symptom.** Something that appears after a short wait, such as a marker added a moment after an objective activates, never appears in a replay.

**Why.** A shell's timers are cleared after every update. A timer would run the shell's logic later, outside the sandbox scope and on its own clock.

**Do.** Use a latent action, such as a Blueprint `Delay`. The shell set runs stand-ins' latent actions itself, inside the sandbox scope and at the replay's speed, so a wait of half a second takes half a second of replay time, even when the replay is slowed or paused.

### Rep notifies present, they never act

**Symptom.** A replayed actor does something gameplay-like on its own, such as dropping an item, or reacts to a replayed change by changing other state.

**Why.** Rep notifies run on shells, so gameplay placed in a rep notify runs in the replay too, on a copy that should only be showing what happened.

**Do.** Keep the gameplay where the server changes the value, and keep the rep notify to presentation. As a test, a rep notify that only reads the new value and updates the look is safe to run any number of times.

### Hide and show where the recording can see it

**Symptom.** Something hidden in the live match shows during a replay, or the other way round.

**Why.** The recorder sees an actor's hidden flag, every recorded component's visibility, and materials. It doesn't see per-player hiding through a player controller's own hidden lists.

**Do.** Use the actor's hidden flag or the components' visibility, set by the server or by clients alike. A shell follows its actor's recorded hidden state, and effects and lights on a hidden actor stay out of sight in the replay.

### Colour and mark by the viewer, not the local player

**Symptom.** A replay shown from another player's side, such as a kill cam from the killer's view, colours teams and shows markers from the watching player's side.

**Why.** A replay can be presented through someone else's eyes. Code that asks "which team is the local player on" gives the wrong answer.

**Do.** Ask the game's notion of the current viewer instead. In Lyra that is the team subsystem's current viewer, which spectating sets. [Team Visuals](../../base-lyra-modified/team/team-visuals.md) covers it.

### UI for a replayed player reads its stand-in

**Symptom.** During a replay, the HUD shows live values, such as the ammo the player has now rather than then.

**Why.** UI that cached a pointer to a live weapon or pawn before the replay keeps reading the live one.

**Do.** Resolve through the viewed player each time: the viewed player state's pawn, then its weapon. During a replay that chain leads to stand-ins.

### Keep stand-ins out of live registries

**Symptom.** After a replay, a live lookup finds a destroyed stand-in, or something is counted twice while one runs.

**Why.** Shells run BeginPlay and rep notifies, which may register the actor or its items with match-wide systems, such as an item registry keyed by id.

**Do.** Check whether the object is a stand-in before registering it, and skip the registration when it is. Lyra's item instances do this.

### Keep shells' side effects in the replay

**Symptom.** A replay triggers live feedback, such as a kill feed entry or an announcement, because a replayed actor broadcast a message.

**Why.** A shell's code broadcasts exactly like live code.

**Do.** Have systems that announce to the live match ignore calls made for the replay. In Lyra, gameplay messages broadcast from inside the sandbox scope are dropped unless their channel is allowed, as [Integrating a Game](integrating-a-game.md) describes.

### Record what a shell needs, leave out what it doesn't

**Symptom.** A shell is missing state, such as an empty inventory or missing tags, or recording costs more than it should.

**Why.** The state recorder records replicated properties. Fast array callbacks need the array type registered, state kept outside properties needs an extra, and bookkeeping a shell never uses should be excluded.

**Do.** Register fast arrays, add state extras and exclude bookkeeping types once at startup. [Recording](recording.md) covers all three.

### Skip one-off feedback during the lead-in

**Symptom.** When a replay opens, a burst of damage numbers or announcements plays at once.

**Why.** The replay repeats the events from just before its window, so effects that were already lingering are on screen from the first frame.

**Do.** Presentation that should only react to a live moment checks `UVisualReplayPlayback::IsPlayingLeadIn` and skips itself.

***

## Telling Replay Code Apart

When code needs to behave differently for a replay, ask the narrowest question that fits.

| Question | Ask |
| --- | --- |
| Is this code running for a replay right now? | `FVisualReplaySandboxScope::IsActive()` |
| Is this object a stand-in? | `UVisualReplayShellSet::IsStandIn(Object)`, which still answers while the object is destroyed after its replay |
| Does this actor belong to a replay, as a puppet, a stand-in, or something one spawned, owns or carries? | `VisualReplay::IsReplayActor(Actor)`, and `VisualReplay::BelongsToReplay(Object)` for components |
| Is this live actor replaced by a stand-in at the moment? | `UVisualReplaySession::IsReplacedByStandIn(LiveActor)` |
| Is a replay running in this world? | `UVisualReplaySession::IsReplaying(World)` |
| Is the lead-in playing? | `UVisualReplayPlayback::IsPlayingLeadIn()` |

For real examples of these rules applied to objectives, see the kill cam's [Making Game Modes Killcam-Ready](../shooter-base/kill-cam/killcam-ready-game-modes.md).
