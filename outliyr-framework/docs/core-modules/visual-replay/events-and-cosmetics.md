# Events and Cosmetics

Meshes and replicated values cover most of what a replay shows, but not the short-lived things that make a moment readable: a muzzle flash, an impact decal, a hit sound, a lamp switching off. Visual Replay handles them in two ways. Effects, decals and lights an actor carries are **recorded as tracks** automatically. Moments the game announces, such as a gameplay cue firing, are **recorded as events** and played again by the game's own code. This page covers both, how the replay avoids drawing anything twice, and how effects already playing when a window opens are shown partway through.

***

## Cosmetic Tracks

Any actor that has a recorded mesh also has its effects, decals and lights recorded, each as a track of its own.

| Track | Records | Replays as |
| --- | --- | --- |
| **Effect** (Niagara or Cascade) | When it played, when it played without being drawn, the values set on it when it started (such as a trail's team colour), and where it was attached | A copy attached to the mirror of the part it was on, or to the puppet when that part wasn't recorded, or at its place in the world when it was attached to nothing |
| **Decal** | When it was shown, its material and its fade timings | A copy drawn where it was, fading as it did |
| **Light** | Its brightness, colour and whether it shone, changes only | A copy on the puppet that follows the recording |

Hidden counts as hidden whatever the cause. An effect on a hidden actor keeps playing out of sight: its copy keeps running but isn't drawn, so it carries on rather than restarting when the actor shows again. A light on a hidden actor is recorded as off.

Effects and lights that belong to a player's own view, such as a lens effect drawn on their screen, aren't recorded. They belong to that player's controller, not to the world.

### Who draws an actor's cosmetics

An actor with a shell runs its own logic, and that logic usually creates its effects, decals and lights itself, such as a capture point's ring and its light. Drawing the recorded track as well would show everything twice. So when an actor has a shell of its own class, its effects are **left to the shell**, and so are the decals and lights its class creates. The playback draws its own copies for actors without a shell, and for decals and lights something added to the actor while the game ran.

The exception is an effect spawned by an event the replay doesn't repeat. Nothing a shell does would recreate it, so the playback draws it even on an actor whose shell plays its own effects.

***

## Events

An event is a moment the game records on a named **channel**, with a payload describing what happened. When the replay reaches it, a function the game registered for that channel plays it again. This is how gameplay cues and context effects come back in a replay: the game knows how to fire a cue, Visual Replay doesn't need to.

A game takes part in two places: where the live moment happens, and where it is played back. Here is the pair Lyra uses for gameplay cues, shortened:

```cpp
// Recording: when a cue has run on the live match, the cue is recorded on its channel.
static void RecordGameplayCue(AActor* TargetActor, FGameplayTag Tag, EGameplayCueEvent::Type EventType, const FGameplayCueParameters& Parameters)
{
    // ... the effects the cue spawned were captured meanwhile, see below
    FLyraReplayGameplayCue Cue;
    Cue.Tag = Tag;
    Cue.EventType = EventType;
    Cue.Parameters = Parameters;
    Recorder->RecordEvent(GameplayCueChannel, TargetActor, FInstancedStruct::Make(Cue), Spawned);
}

// Playback: when the replay reaches the event, it is played on the target's stand-in.
static void PlayGameplayCue(const FVisualReplayEvent& Event, AActor* StandIn, UVisualReplayPlayback& Playback)
{
    FGameplayCueParameters Parameters = Event.Payload.GetPtr<FLyraReplayGameplayCue>()->Parameters;
    Playback.RemapToStandIns(FGameplayCueParameters::StaticStruct(), &Parameters, Context);

    // The cue manager is called directly so the cue runs only on this machine, never through an ability system
    // component, which would multicast from a listen server.
    CueManager->HandleGameplayCue(StandIn, Cue->Tag, Cue->EventType, Parameters);
}

// Once, at startup:
UVisualReplayPlayback::RegisterEventPlayer(GameplayCueChannel, &PlayGameplayCue);
```

Three things in that pair matter for any event a game records.

* **The event names its subject.** `RecordEvent` takes the actor the moment happened to, and the player receives that actor's stand-in: its shell if it has one, otherwise its puppet.
* **References in the payload are remapped.** A recorded payload points at live objects: the instigator, the effect causer, the component an effect attaches to. `RemapToStandIns` walks the payload and points every reference at its stand-in, including references to objects that have since been destroyed. A reference that can't be remapped and still points at the live match is flagged by the debug suite as `LiveReferenceKept`.
* **Playing stays local.** The player runs on one machine for one viewer, so it must not go through anything that replicates. The cue example calls the cue manager directly for that reason.

Events are recorded only while recording, never from inside the sandbox scope, so a replay never records itself. An event on a channel with no registered player is skipped silently. An event about an actor no replay can stand in for, one with neither recorded state nor recorded meshes, isn't recorded either, and the debug suite notes it as `EventSkipped`. `CanReplayEventsOn` answers the question in advance, so a game can record the cosmetics of such an event with `bReplayedByEvent` set to `false` and have the playback draw them, as LyraReplay does for cues. Events are kept longer than the rest of the history, for the lead-in described below.

<details>

<summary>In code: events</summary>

`UVisualReplaySubsystem::RecordEvent` records; `UVisualReplayPlayback::RegisterEventPlayer` and `UnregisterEventPlayer` manage the players, one per channel. Payloads are `FInstancedStruct`, so any `USTRUCT` works, and their object references are kept alive while held. `RemapToStandIns` takes the struct type, a pointer to the data and a context string, which the debug report uses when it notes a live reference left behind. [Integrating a Game](integrating-a-game.md) shows Lyra's full set of channels.

</details>

***

## Cosmetics an Event Spawned

When a live gameplay cue fires, it spawns effects, sounds and decals in the live match. During a replay of that moment, the cue's event spawns its own copies, so the live ones must be hidden from the viewer, or they would show twice. The recorder therefore has to learn which live objects each event spawned, and when.

A **cosmetic capture** does that. Open it around the live code that spawns things, and it returns every effect, sound and decal component, and actor, created in between.

```
VisualReplay::BeginCosmeticCapture();
    ... the live cue runs and spawns its effects ...
Spawned = VisualReplay::EndCosmeticCapture();
Recorder->RecordCosmetics(Spawned);                // these appeared now
Recorder->RecordEvent(Channel, Target, Payload, Spawned);
```

`RecordCosmetics` notes when the objects appeared, so a replay hides those newer than its window. It also decides, through its `bReplayedByEvent` argument, whether the replay recreates them or has to draw them itself:

| `bReplayedByEvent` | Meaning | What the recorder does |
| --- | --- | --- |
| `true` (default) | Replaying the event spawns these again | Notes them as the event's, and drops any track it had for them, since the event will recreate them |
| `false` | The event isn't replayed, or replaying it doesn't recreate these | Records the effects and decals among them as tracks from now on, marked as spawned by an event the replay doesn't repeat, so the playback draws them |

Captures nest, and only see objects *created* while they are open. A pooled effect handed out again by its pool isn't created, so as each event plays the playback also notes which Niagara and Cascade pool components went from free to handed out, and treats those as the event's own.

### Pooled actors

Some actors are kept for reuse, such as the actors of gameplay cues the cue manager recycles. A replay borrows such an actor rather than owning it. It leaves the actor's speed, collision and meshes as they are, since the live game may take the actor back at any moment, and when it is done it hands the actor back to its pool while it still holds it, and leaves it alone once the pool has it back.

A game registers each of its pools with `VisualReplay::RegisterActorPool`, giving `Keeps`, which says whether an actor is one of the pool's, and `Return`, which hands one back as finishing with it would.

<details>

<summary>In code: pooled actors</summary>

`FVisualReplayActorPool` and the registration functions live in `VisualReplayActorPool.h`. `IsLentByPool` tells whether a registered pool keeps an actor, `IsStillHeldByReplay` whether the replay still holds one, and `ReleaseReplayActor` removes an actor the replay is done with, handing it back to its pool or destroying it. LyraReplay registers the cue manager's recycled cue actors as a pool.

</details>

***

## The Lead-in

A window rarely opens on a quiet moment. A smoke grenade thrown four seconds before the window is still smoking, and a fire started earlier is still burning. If the replay only played events from inside the window, those effects would be missing.

So events are kept for `Replay.LeadInSeconds` (20) longer than the rest of the history, and a replay repeats the events from that stretch before its window that still showed something as the window opened. These are the **lead-in**. The recorder notes when the last thing each event spawned stopped showing, so a shot whose muzzle flash was long over is left out, while the one whose scorch mark is still on the wall is repeated. A sound never counts, since the replay doesn't play it again from back then.

The lead-in is repeated while the replay [prepares](sessions.md#preparing), once its stand-ins are up, a few events a frame like the rest of preparing. What it brings back is hidden and holds still until the replay begins:

* each Niagara effect is simulated forward up to the next event on the same actor, which can change or end it, and finally up to the window's start;
* decal fades and actor lifespans start running when the replay begins, aged by how long before the window they appeared;
* sounds are stopped, and anything drawn for a player's own view is removed.

The replay opens with lingering effects already in place.

A lead-in event whose actor has no stand-in at the window's start is skipped. Presentation that should only react to a live moment, such as damage numbers, can check `UVisualReplayPlayback::IsPlayingLeadIn` and skip itself while the lead-in runs.

***

## Catching Up Effects

An effect that was already playing when the window opened, or a shell that begins play after its actor had been playing for a while, would otherwise start its effects from the beginning: a looping fire would restart, a beam would grow out again. Instead, a Niagara effect shown partway through its life is simulated forward by how long it had been playing, up to `Replay.EffectCatchUpSeconds` (5), in steps of a twentieth of a second. Cascade effects can't be simulated forward and start from the beginning.

The debug suite notes each catch-up as `EffectShownPartway`, with how long the effect had played.
