# Getting the Killer's Recording

The victim's machine already has a recording of the kill: its own. But that recording shows the killer the way the victim saw them, which isn't how the killer saw the moment. Remote players are drawn a little late and smoothed, their aim arrives coarsely, and the victim never saw the killer's first-person view at all. The killer's own machine has all of that, so the kill cam asks it for its recording. This page covers how that recording travels from the killer to the victim, how the server keeps it honest, and what happens when it is late or never comes.

What a recording contains, and how it is encoded, is covered by Visual Replay's [Perspective Clips](../../visual-replay/perspective-clips.md). This page is about the trip.

***

## Slices, Oldest First

As soon as the server asks, the killer's machine builds its recording of the window up to the death and sends it in **slices** of `Killcam.PerspectiveClipSliceSeconds` (1.5 seconds), oldest first, starting 0.25 seconds before the window. Slices let the kill cam begin as soon as the opening of the window has arrived, while the rest streams in ahead of playback, rather than waiting for one large clip.

Each slice is a perspective clip whose subjects are the killer's pawn and the victim's pawn, plus up to `Killcam.PerspectiveClipExtraCharacters` (4) other characters that were on the killer's screen for a good part of the window. It is encoded on a worker thread, so building it costs the killer's frame almost nothing, and cut into pieces of at most `Killcam.PerspectiveClipPieceBytes` (8 KB).

The part recorded **after** the death can't exist yet when the kill happens. It is requested once the victim's kill cam is about to start, and goes out as one final part, numbered 255 so it always sorts after the slices.

A clip is identified by the server time of the death in whole milliseconds. The victim's own estimate of its death can trail the server's, so ids within two seconds of each other count as the same kill. Two kills of one victim are always further apart than that.

***

## Pacing

A clip is far larger than anything else the game sends, so sending it all at once would delay everything else on the connection, including movement. Pieces go out on a byte budget of `Killcam.PerspectiveClipBytesPerSecond` (128 KB per second). The budget allows a quarter of a second's worth at once, and always at least the next piece, so no piece is ever too big to send.

On the legacy net driver, a piece also waits while the connection has more than 48 reliable messages waiting to be acknowledged, well short of the point where the engine would close the connection. Iris has no actor channels to inspect, so there the byte budget alone keeps the queue short.

Pacing applies on both hops: from the killer's machine to the server, and from the server to the victim. A listen server's own local player never touches the network and isn't paced.

***

## What the Server Checks

The server relays every piece and track, which makes it the place to stop a client sending another player data it was never asked for. Everything is checked against the **kill record** the server wrote when the elimination happened. Here is the check every clip piece passes before it is relayed:

```cpp
// Only the killer the server recorded may send a victim pieces, only of that kill's clip, only well formed ones, and
// only up to a byte budget, so no client can send another player data it was never asked for.
UKillcamManager* VictimMgr = KillCamManager::FindManagerOf(VictimPS);
const FServerKillRecord* Kill = VictimMgr ? &VictimMgr->ServerKill : nullptr;
if (!Kill || Kill->bCancelled || Kill->Killer.Get() != GetPlayerState<APlayerState>() || Chunk.ClipId != Kill->ClipId
    || !KillCamManager::IsWellFormedPiece(Chunk) || Kill->BytesRelayed + Chunk.Bytes.Num() > KillCamManager::MaxRelayedBytesPerKill)
{
    return nullptr;
}
return VictimMgr;
```

Tracks go through the same kind of check: only from the recorded killer, a bounded number per kill, and a bounded size each. The server also stamps each track with *its own* time of death before relaying it, so a killer can't shift the victim's timeline. The request for the after-death part is honoured once per kill, with the killer, the death time and the window all taken from the record, never from what the victim asks for.

| Limit | Value |
| --- | --- |
| Bytes in one piece | 8 KB |
| Pieces in one part | 4096 |
| Subjects named by a part | 16 |
| Clip bytes relayed for one kill | 8 MB |
| Tracks relayed for one kill | 8 |
| Samples in one track | 4096 |

The limits are generous. A normal kill uses a small fraction of each, so they only ever stop a client that is misbehaving. They are compile-time constants in `KillcamManagerPrivate.h`.

<details>

<summary>In code: the server side</summary>

`UKillcamEventRelay::OnEliminationMessage` writes the record through `UKillcamManager::NoteServerKill`. Pieces pass `AcceptPieceFromKiller` and tracks pass `AcceptTrackFromKiller`, both on the killer's server-side manager. `ServerRequestFinalKillcamData` takes no parameters: the server reads everything from the record. The aim track's network serializer also refuses an oversized sample count before allocating anything, so a malformed track can't make the server allocate memory. The tests under `ShooterBase.Killcam.Security` cover each check.

</details>

***

## Receiving and Assembling

The victim's machine collects pieces until a part is complete, then decodes it on a worker thread. A piece of a newer kill replaces whatever was being assembled, and pieces of an older kill are ignored.

Parts can finish decoding in any order, so they join in recording order, from the first, only as far as they run on without a gap. A slice that overtook the one before it waits for that one. Once a kill cam is playing, each newly joined part is appended to the running replay.

The time of the death the kill cam uses comes, in order of preference, from the killer's tracks (stamped by the server), then from the clip's id, then from the victim's own clock.

***

## Late, Missing or Skipped

* **Waiting at the start.** The kill cam begins once the first second of the window has arrived. Until then it shows the waiting message, for up to `Killcam.PerspectiveClipWaitSeconds` (3 seconds). If the clip still isn't there, it plays the victim's own recording instead and keeps it to the end. The debug suite records this as `KillcamFellBackToOwnRecording`.
* **Waiting while playing.** If playback catches up with what has arrived, the replay holds and the waiting message shows again, for up to `Killcam.BufferingTimeoutSeconds` (3 seconds) before the kill cam ends.
* **History.** The victim's recorder holds its history back to just before the window, for 20 seconds after the death and again for 20 seconds plus the kill cam's length once it starts, so the opening isn't trimmed away while the kill cam waits. Only the manager that took the hold releases it, which matters on a listen server, where the host's manager and the server-side copies share one recorder.
* **Skipping and ending.** When the kill cam ends for any reason, the victim tells the server the clip is no longer wanted. The server drops pieces still queued for the victim and tells the killer to stop. The killer remembers its last few cancelled clips, so a late request for the after-death part of one of them is ignored.

***

## The Killer's Tracks

Alongside the clip, the killer sends three small tracks from its own recorders:

* **aim**: its control rotation at up to 60 samples per second;
* **camera**: its camera mode and aiming-down-sights changes;
* **hit markers**: the hits it was shown.

They cover the recorders' full 15 seconds before the death, and later the window after it.

The tracks travel separately because they are useful even without a clip. A bot has no machine to record a clip on, but the server records its tracks. When the kill cam falls back to the victim's own recording, the killer's exact aim still comes from its track. Camera modes and hit markers are never part of a clip at all. [Playback and Presentation](playback-system.md) covers how they play.

***

## Bots and Self-Kills

* **A bot killer** has no clip. The server gathers the bot's tracks itself and sends them to the victim, and the kill cam starts straight from the victim's own recording, with the bot's tracks on top. The after-death tracks are still requested. Past the end of the bot's aim track, the view the victim's machine recorded for the bot's pawn takes over.
* **A death the victim caused** has no other machine to ask. The kill cam plays the victim's own recording with the victim's own camera.
* **A death with no killing player**, such as a fall, has no kill cam.
