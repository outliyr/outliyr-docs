# Recording

A replay can only show what was recorded, so the recorder decides what a replay can ever contain. It keeps two histories: **the look**, how every recorded mesh was drawn, and **the state**, the replicated values of every replicated actor. This page covers what goes into each, when, and what is deliberately left out.

Effects, decals, lights and events are recorded too, but they have rules of their own and live on [Events and Cosmetics](events-and-cosmetics.md).

***

## Recording Only on Request

The recorder is a world subsystem, `UVisualReplaySubsystem`, but it records nothing until something asks. A system that needs replays calls `AddRecordingRequest`, and recording runs while at least one request is held. Requests are held weakly, so a requester that is destroyed stops counting. When the last request goes, all history is dropped.

A game without anything replay-based therefore pays nothing. A dedicated server never records at all: the subsystem isn't created there, because nobody watches a replay on a machine without a player.

A game that wants recordings from different machines to line up also gives the recorder a clock. This is how the kill cam turns recording on for the local player:

```cpp
// Recordings from different machines line up only when they share a clock, so the local player stamps the
// replay recorder with the synchronised server time.
Recorder->SetClock(FVisualReplayClock::CreateWeakLambda(LyraPC, [LyraPC]() { return LyraPC->GetServerTime(); }));

// The recorder only runs while something needs it, so a game without a killcam manager records nothing.
Recorder->AddRecordingRequest(this);
```

Recorded time never runs backwards. Small corrections to the clock are ridden out by holding time still until the clock catches up. A clock that jumps back further than a window clears the history, since nothing recorded on the old timeline would line up any more.

***

## The Look

### Which actors and components

The recorder never scans the world every frame. Actors are offered to it when recording starts (every actor in the world, once), when they spawn, when a streamed level adds them, and every half second for actors already being tracked, to pick up meshes added later. A newly offered actor is also checked every frame for its first second, which catches meshes and effects set up in BeginPlay or on the first network update.

A mesh found at a later look, such as one on a component the actor adds after it spawned, is recorded from the previous look at its actor, since an event recorded in between may already refer to it. Until its first recorded sample its mirror stands where that sample places it but stays hidden, since whether it was drawn before is unknown.

A component is recorded when it is a **static or skeletal mesh with Movable mobility** and a mesh assigned. Static-mobility geometry, such as most of a level, is never recorded. It never moves, so the live world already shows it correctly during a replay. Every recorded component of one actor is grouped together, and the group becomes that actor's puppet on playback.

### What each mesh records

| Recorded | When | Notes |
| --- | --- | --- |
| Transform and visibility | Every frame | Visible means the component is visible and its actor isn't hidden. The owner-only and first-person settings are kept too, so a replay can show the right parts from the right point of view. |
| Pose | Every frame, for skeletal meshes | Taken after the animation system has finished the pose, so the recording is exactly what was drawn, including ragdoll physics and IK. Cloth isn't part of the pose; a replayed mesh with cloth simulates its own. |
| Aim | Every frame, on the parts that place a pawn | The pawn's base aim rotation, which a replay uses to show where a pawn was looking. |
| Offsets | Only while a part moves away from its usual place | For example a ragdoll whose mesh separates from its capsule. |
| Materials | `Replay.MaterialSampleRateHz` (30), stored only on change | The material asset, or a dynamic instance's parent with its scalar and vector parameters, plus custom primitive data. Texture parameters aren't recorded. |

A skeletal mesh set to keep animating while it isn't drawn skips working out its pose off screen, so it would leave nothing to record. The recorder asks such a mesh to work its pose out on its next tick, `Replay.UnseenPoseRateHz` times a second and for at most `Replay.UnseenPosesPerFrame` meshes a frame, so a character this machine never drew still records its animation, at that lower rate. While a replay plays, the live world is hidden behind it and nothing in it is drawn, so every such mesh is asked every frame until the replay ends, and a later replay of that stretch, such as the kill cam of a player who dies soon after the last one, shows it moving smoothly. A mesh set any other way doesn't animate off screen and is left as it is.

Poses are the bulk of the memory, so by default they are stored compactly: every bone rotation packed into six bytes, and only the translations and scales that differ from the track's first pose. `Replay.ExactPoses` keeps full precision for about four times the memory.

Each pose also notes whether the mesh was actually rendered on this machine around that time. A replay of another machine's recording uses this to pick extra characters that were on that player's screen.

The recorder also keeps this machine's camera every frame: where the local player's camera was, its rotation and field of view. A replay can show it, and a [perspective clip](perspective-clips.md) carries it to another machine.

***

## The State

The look explains how things appeared, but not what they were. The state recorder, `FVisualReplayStateRecorder`, keeps the replicated values of every replicated actor so its [shell](puppets-and-shells.md) can be rebuilt with the game state it had.

### What is recorded

For each replicated actor, the recorder takes the actor, its replicated components, and the subobjects its replicated properties refer to that a client could also have received. On each of them it records the **replicated properties**: those marked for replication, sampled at `Replay.StateSampleRateHz` (30 per second). A value is stored only when it changes. Each sample first compares against a copy of the last value, and only exports to text when the value may have changed.

A subobject that becomes reachable between two samples, or a component replication adds after the actor spawned, is found only at the next look, yet an event recorded in between may already refer to it. It is recorded from the previous look at whatever it was found through, never from before that was itself recorded, and never further back than the longest regular gap between looks.

Two extra facts are kept per actor:

* **When it began play.** An actor from the network can exist for a while before it begins play, until values such as references have arrived. Its shell begins play at the same moment, with the values it had then.
* **When it was hidden.** Whether an actor is drawn is often set by its own code, or by the server through the engine's replicated hidden flag, and neither is a value its shell could rebuild. The recorder notes each stretch of time the actor was hidden, and a shell takes its visibility from that record.

### What is left out, and why

| Left out | Why |
| --- | --- |
| The engine's own actor and component properties, apart from `Owner` and `Instigator` | Replication plumbing a shell doesn't need. Owner and instigator are kept because game logic reads them, for example to work out whose side a projectile is on. |
| Info actors other than player states | The game state, teams and world settings are match-wide and stay live during a replay. Player states are recorded, since a replay needs the players as they were. |
| Controllers, spectator pawns, movement components | Controllers only ever reach their own player, a spectator pawn carries one player's view, and movement re-simulates rather than presents. The look already records where things were. |
| Static array properties | Not supported by the recorder. |
| Struct types and classes a game excludes | Bookkeeping such as ability specs, active effects and prediction keys, which mean nothing to a shell and are expensive to record. |

A game adds its own exclusions and fills gaps through three extension points. Each is set up once, before recording starts, because the recorded properties of a class are worked out once and cached.

* **Excluded struct types** keep every property of that type out of the recording.
* **Excluded classes** keep whole actors or components out, either for one world or for every replay.
* **State extras** record state an actor keeps outside its properties, through a capture function and an apply function. Lyra uses one for the gameplay tags an ability system owns.

Fast arrays need one more step. A shell receives a fast array's values without going through the network, so the replication callbacks its items rely on, such as an inventory reacting to an item being added, only fire if the array type has been registered.

<details class="gb-toggle">

<summary>In code: exclusions, extras and fast arrays</summary>

* `FVisualReplayStateRecorder::AddExcludedPropertyStruct` keeps a struct type out of every recording.
* `AddGloballyExcludedClass` keeps a class out of every replay. `AddExcludedClass` and `AddExcludedClassName` on a world's recorder, reached through `UVisualReplaySubsystem::GetStateRecorder`, do the same for one world. The name form covers classes a module can't link against.
* `FVisualReplayStateRecorder::RegisterStateExtra` takes a class, a capture function and an apply function. Extras are applied after properties and rep notifies.
* `VisualReplay::RegisterFastArray<FMySerializer, FMyItem>()`, in `VisualReplayFastArrays.h`, registers a fast array type. Call it once, in the module that owns the type. An unregistered fast array still gets its values, but fires no callbacks, and a warning names the type once.

[Integrating a Game](integrating-a-game.md) shows Lyra's full set.

</details>

***

## How Long History Lasts

The recorder keeps the last `Replay.WindowSeconds` (10) of everything, and trims older samples every half second. It always keeps the last sample *before* the cutoff, so the state at the start of any window inside the history is known. Events are kept `Replay.LeadInSeconds` (20) longer than the rest, so a replay can repeat the ones from just before its window.

A replay that will start later, such as a kill cam waiting for the killer's clip, can hold history back with `HoldHistory`. A hold keeps everything since a given time, but never more than three windows' worth, so a forgotten hold can't grow memory without limit. `ReleaseHistory` lets it go.

***

## Settings

| Setting | Default | Controls |
| --- | --- | --- |
| `Replay.Enabled` | on | Recording frames, events and cosmetics at all |
| `Replay.WindowSeconds` | 10 | How much history is kept |
| `Replay.StateSampleRateHz` | 30 | How often replicated state is sampled |
| `Replay.MaterialSampleRateHz` | 30 | How often materials are checked for changes |
| `Replay.RescanIntervalSeconds` | 0.5 | How often tracked actors are rescanned for new meshes |
| `Replay.ExactPoses` | off | Full-precision poses, for about four times the memory |
| `Replay.UnseenPoseRateHz` | 10 | How many times a second an animated mesh this machine isn't drawing works out its pose for the recording |
| `Replay.UnseenPosesPerFrame` | 4 | The most such meshes asked to work out their pose in one frame |
| `Replay.LeadInSeconds` | 20 | How much longer events are kept than the rest |

`Replay.Stat` prints what the recorder is holding and what it costs per frame. [Debugging](debugging.md) has the complete settings reference.
