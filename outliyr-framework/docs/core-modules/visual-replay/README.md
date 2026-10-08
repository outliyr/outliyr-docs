# Visual Replay

{% hint style="danger" %}
### <mark style="color:red;">Experimental</mark>

**Visual Replay is an experimental plugin.** It is the foundation of the kill cam and is tested by a large automated suite, but its interfaces may still change between versions. Read this section before building your own features on it.
{% endhint %}

A kill cam, an instant replay of a goal, a "here's how you died" all show the recent past of a match that is still going on. Unreal's usual tool for replays records network traffic and plays it back through a separate network driver, typically into a separate copy of the world. That is a heavy machine to keep running just to look a few seconds back, and the replay only knows what the network carried.

**Visual Replay** takes a different route. Each machine keeps recording what it drew, every mesh, pose, effect and light, and the replicated state of every replicated actor. To replay a window of that history, it plays it back **inside the live world**, for one viewer, while the match carries on around them. Puppets reproduce exactly what was on screen, and shells, real copies of the recorded actors, run the actors' own logic from the recorded state so markers, team colours and attached effects behave.

This buys:

* **No second world or replay driver.** It runs in Play In Editor as well as standalone, works for a listen server's host, and runs alongside Iris replication.
* **The recent past is always in memory**, so a replay can start the moment it is wanted.
* **Exactly what was seen.** Poses are recorded after animation finishes, so ragdolls and IK show as they were drawn.
* **Another player's view.** A machine can send its own recording of chosen actors, so a victim can watch a kill through the killer's eyes.

### What it is not

* **Not a saved replay system.** History lives in memory for a few seconds; nothing is written to disk.
* **Nothing is recorded on a dedicated server.** Nobody watches a replay there.
* **Not a way to rewind gameplay.** The live match never changes; a replay only shows the past.
* **Not built on Anim Rewind.** It records finished poses rather than reconstructing them.
* **Clips sent between machines need the same build on both ends.**

{% hint style="info" %}
To see a replay without writing any code, start a match with an experience that includes the kill cam, play for a few seconds, and run `Replay.Test 5` in the console. It replays the last five seconds to you.
{% endhint %}

***

### How It Fits Together

| Piece | Role |
| --- | --- |
| **Visual Replay plugin** | Recording, clips, sessions, puppets and shells, perspective clips and their codec, the debug suite. Knows nothing about any game. |
| **LyraReplay module** | Connects Lyra to it: gameplay cues and context effects as replayable events, fast arrays, ability system tags, indicators, the gameplay message filter. |
| **[Kill Cam](../shooter-base/kill-cam/)** | ShooterBase's kill cam, the main user. Decides whose recording to play, gets it from the killer and presents it. |

### Reading Paths

* **Understanding how a replay works:** [How It Works](how-it-works.md), then [Recording](recording.md), [Puppets and Shells](puppets-and-shells.md) and [Sessions](sessions.md).
* **Making your actors look right in replays:** [Writing Replay-Friendly Gameplay Code](replay-friendly-gameplay-code.md), the table on [Puppets and Shells](puppets-and-shells.md#what-a-shell-doesnt-do), and [Debugging](debugging.md).
* **Extending Visual Replay or using it in a new feature:** [How It Works](how-it-works.md), the recording and playback pages, [Integrating a Game](integrating-a-game.md), [Events and Cosmetics](events-and-cosmetics.md), [Perspective Clips](perspective-clips.md) and [Debugging](debugging.md).

### Documentation Guide

| Page | Content |
| --- | --- |
| [How It Works](how-it-works.md) | The big picture, the vocabulary, the order of each update, and where things live in the code |
| [Recording](recording.md) | What the recorder keeps, the look and the state, and how long history lasts |
| [Puppets and Shells](puppets-and-shells.md) | The two layers, how a shell is brought up and follows its puppet, and what a shell doesn't do |
| [Sessions](sessions.md) | Starting a replay, what the viewer stops seeing, seeking, buffering, sound and stopping |
| [Events and Cosmetics](events-and-cosmetics.md) | Effects, decals and lights, events and their players, cosmetic capture, the lead-in and effect catch-up |
| [Perspective Clips](perspective-clips.md) | Another machine's recording: building, encoding, joining parts and merging into a session |
| [Writing Replay-Friendly Gameplay Code](replay-friendly-gameplay-code.md) | The rules that make actors replay correctly, and how to tell replay code apart |
| [Integrating a Game](integrating-a-game.md) | Every hook a game can use, with LyraReplay as the worked example |
| [Debugging](debugging.md) | The debug suite, reports, anomalies, troubleshooting, commands and every setting |
