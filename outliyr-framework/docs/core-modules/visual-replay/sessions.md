# Sessions

A session is one replay. It cuts a window out of the recording, brings up the window's puppets and shells, hides what they replace from one viewer, plays the window, and puts everything back when it stops. This page covers starting a session, what the viewer stops seeing, controlling playback, waiting for more of a perspective clip, the replay's sound, and stopping.

***

## Starting a Session

`UVisualReplaySession::Start` takes the world, the window's start and end on the recording clock, and a set of options. The options say who watches, how it plays, and how the game wants to be involved:

* `Viewer` is the player controller that sees the replay. Hiding the live world applies to this viewer only.
* `Speed` and `bStopAtEnd` control playback. By default a session plays at real time and stops itself at the window's end.
* `PerspectiveClip` is another machine's recording to play instead of this machine's own for its subjects. `bUseLocalCamera` instead exposes this machine's own camera as the replay's camera.
* `ReplaySoundClass` and `LiveAudioMix` separate the replay's sound from the live game's.
* `PrepareBudgetMs` spreads preparing the replay over several frames, and removing it over the frames after it stops.
* `OnStandInsReady` and `OnTimeApplied` are the game's hooks: once when every stand-in holds its starting state, and after every update.

This is how the kill cam starts its session, shortened:

```cpp
FVisualReplaySessionOptions Options;
Options.Viewer = Params.Viewer;
Options.PerspectiveClip = Params.PerspectiveClip;   // the killer's recording, when it arrived in time
Options.ReplaySoundClass = Params.ReplaySoundClass;
Options.LiveAudioMix = Params.LiveAudioMix;
Options.PrepareBudgetMs = KillcamReplay::PrepareBudgetMs;

// The replay holds its last frame until the killcam is told to stop, so the camera never loses its target early.
Options.bStopAtEnd = false;
LyraReplaySupport::ConfigureSessionOptions(Options);   // the game's own per-session setup goes in first
FollowSessionCallbacks(Options);                       // the killcam's hooks then run after the game's

Session = NewObject<UVisualReplaySession>(this);
Session->Start(World, Params.WindowStart, Params.WindowEnd, MoveTemp(Options));
```

The order of the last lines matters. The game layer fills the hooks first, and the kill cam wraps them so its own handling runs after the game's, rather than replacing it.

`Start` returns false when the window holds nothing at all. Keep a strong reference to a running session, such as a `UPROPERTY`: sessions are only tracked weakly while they run, so an unreferenced one can be garbage collected.

{% hint style="info" %}
To try a replay without writing any code, run `Replay.Test 5` in the console. It replays the last five seconds to the first local player. It needs something to be recording already, such as an experience with the kill cam; if nothing is, it starts recording and asks you to run it again. `Replay.Stop` ends it.
{% endhint %}

***

## Preparing

Preparing a replay can be heavy: a busy match may have dozens of puppets and shells, and the [lead-in](events-and-cosmetics.md#the-lead-in) can repeat a hundred or more events. With a `PrepareBudgetMs` above zero, the session does this a little at a time, within that many milliseconds a frame and always at least one piece of work a frame, in this order:

1. the window, copied out of the recording, its look first and its replicated state on a later frame;
2. the puppets;
3. the shells of actors present as the window opens;
4. the lead-in;
5. the shells of actors that appear later in the window, such as a player who respawns partway through.

`Start` itself only checks that the window holds anything, so the frame the replay is started in stays light. A recording that forgets its history while the replay prepares, as it does when its clock is replaced, first hands over whatever of the window the session has not copied yet.

Nothing of the replay shows while it prepares. Puppets stay hidden, shells are hidden as they are spawned, what the lead-in brings back is hidden and holds still, and the live world stays on screen. When everything is ready, the session shows the puppets and what the lead-in brought back, hides what they replace, applies the first update, calls `OnStandInsReady` and broadcasts `OnPrepared`, so the frame the replay first shows in does little more than switch what the viewer sees. `IsPreparing` tells a game the session is still building, which the kill cam shows as waiting.

A shell made for an actor that appears later stays hidden and stands in for nothing until the replay reaches its actor. That moment then only places the shell and applies its state.

The work is the same whatever the budget. A larger budget finishes it in fewer frames, each of them longer, so the replay appears sooner while those frames run slower.

With a budget of zero, everything happens inside `Start`, including `OnStandInsReady` and `OnPrepared`. Bind delegates before calling `Start` if the budget may be zero.

***

## What the Viewer Stops Seeing

While a session runs, the live versions of what it replays are hidden from the viewer:

* **Live actors drawn by a puppet**, and live actors whose tracks a perspective clip replaced.
* **Live actors that appeared after the window opened**, such as loot dropped at a death, apart from the viewer's own pawn and anything the viewer owns. New ones are hidden as they appear.
* **Live effects, sounds and decals newer than the window**, because the replay plays its own copies when it reaches them. New ones are hidden as they appear.
* **Lights on hidden actors**, switched off on this machine so they don't light the replay from wherever the live actor is now. A light that replicates is left on when this machine is the server, since switching it off would reach every player.

All of this goes through the viewer's own player controller lists and the components on this machine, never through replication. On a listen server the host can watch a replay while every client keeps playing. When the session stops it restores exactly what it hid, and never touches anything the game had already hidden itself.

What isn't hidden:

* **Static geometry** was never recorded and is correct as it is.
* **Match-wide actors** such as the game state stay live.
* **An actor with a shell but no puppet** keeps its live self on screen, since nothing else draws it.

Live HUD elements that point at replayed actors, such as markers over live characters, are a game's concern. `UVisualReplaySession::IsReplacedByStandIn` tells it whether a live actor currently has a stand-in, and [Integrating a Game](integrating-a-game.md) shows how Lyra uses it to hide live indicators.

***

## Speed, Pause and Seeking

`SetSpeed` changes how fast replay time moves, and `SetPaused` freezes it. Everything the replay owns runs at the replay's speed through its time dilation, so pausing freezes puppets, shells, effects and latent waits at once.

There are two ways to move to another time, and they differ in what happens on the way.

| | `PlayTo(t)`, forward | `Seek(t)` |
| --- | --- | --- |
| Events between now and `t` | All play, as one long frame | None play |
| Shells | Updated through every change | Rebuilt as a client joining at `t` would receive them |
| Moving backward | Behaves like `Seek` | Shells of actors not there yet at `t` are removed, ended shells alive at `t` come back, and whatever later events spawned is destroyed |

When playback reaches the end of the window, `OnReachedEnd` is broadcast once. A session with `bStopAtEnd` then stops. The kill cam turns that off so the last frame holds until the kill cam itself decides to end.

***

## Waiting for More of the Recording

A session started with only part of a perspective clip, such as the opening slices of a killer's recording, can't play past what has arrived. Later parts join with `AppendPerspectiveClip` while it plays. The session handles the gap in two steps.

```
recording arrived ─────────────────────────────────|              window end
playback          ────────────────────────────►
                                       |<- 1 s ->|
                                       slows towards 0.85x     holds and waits (buffering)
```

* **Easing.** Within `Replay.EasedLeadSeconds` (1) of the end of what has arrived, playback slows smoothly towards `Replay.EasedMinSpeed` (0.85 of normal speed). A slightly slower replay goes unnoticed, while catching up and stopping is obvious.
* **Buffering.** If playback still reaches the end of what has arrived, it holds there. Everything the replay owns stands still, `IsBuffering` is true, and `OnBufferingChanged` is broadcast. When the next part arrives, it carries on.

How long to wait before giving up is the game's decision. The kill cam ends after `Killcam.BufferingTimeoutSeconds`.

***

## Sound

Every sound the replay makes plays in the session's `ReplaySoundClass`: sounds from replayed events, sounds a shell plays by itself (such as an animation notify's footstep), and sounds of actors a shell spawned. A sound that is already playing is moved into the class without restarting, so a gunshot that started this frame is never cut.

`LiveAudioMix`, when set, is pushed for as long as the session runs, typically to duck the live game. A sound mix is global, so on a machine with several local players it affects all of them. Live sounds newer than the window are muted individually, and their volume is restored when the session stops.

***

## Stopping

`Stop` ends a session at any time, including while it is still preparing. It:

1. shows the live world again, restoring only what the session hid;
2. hands the shells and anything they spawned to the [removal queue](#the-removal-queue);
3. hands the puppets over the same way, removes the replay's own effects, decals and lights, sending pooled effects back to their pool rather than destroying them, and stops every sound the stand-ins started;
4. hands over any actor the replay made that still stands, such as one a stand-in spawned that neither had gathered, giving one a pool lends back to its pool while the replay still holds it;
5. checks that it put everything back and finishes the debug report, in every build but Shipping;
6. broadcasts `OnStopped`.

The frame a replay stops in only switches the view back. Its actors are hidden at once and removed over the frames after.

A session stopped while preparing hands over only what it had built so far. While another replay runs in the same world, step 4 hands over only what appeared as this one ended, since the rest may be the other replay's. [Debugging](debugging.md#checking-that-a-replay-put-everything-back) covers the check.

### The Removal Queue

`UVisualReplayDisposal` is a world subsystem that removes the actors replays are done with, `Replay.DisposeBudgetMs` (2) milliseconds a frame, oldest first. While an actor waits its turn it is hidden and does nothing on its own: it doesn't tick, collide or run timers, and its sounds are stopped. A shell retired during a replay goes the same way.

* **Whatever removing an actor spawns waits its turn after it.** An exploding projectile that spawns its blast as it ends play leaves nothing behind, however long the chain.
* **An actor a pool lends goes straight back to its pool,** since the pool may hand it to the live game.
* **A session with a budget of zero empties the queue as it stops,** so everything is gone when `Stop` returns.
* **The queue empties as soon as its world starts a seamless travel.** A client carries every actor it does not own into the next world, and the replay's actors are such actors.

For a few frames after a replay, code that walks the world's actors can still meet its actors waiting their turn. `UVisualReplayShellSet::IsStandIn` and `VisualReplay::IsReplayActor` still recognise them, and `UVisualReplayDisposal::IsWaiting` says whether one is waiting to be removed.

<details>

<summary>In code: handing an actor to the removal queue</summary>

An actor a game spawns for a replay, and wants gone with it, goes through the same queue:

```cpp
UVisualReplayDisposal::Dispose(*Actor);   // hidden and inert now, removed within the frame budget
```

`DisposeUntil(DeadlineSeconds)` removes what waits until a deadline passes, and `CallWhenEmpty` runs a callback once nothing is left waiting.

</details>
