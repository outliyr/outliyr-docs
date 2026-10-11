# Debugging

A kill cam that looks wrong is either a replay problem, such as an actor missing or in the wrong state, or a kill cam problem: the wrong recording, a camera following nothing, a HUD reading the live game. The kill cam reports its own decisions to the [Visual Replay debug suite](../../visual-replay/debugging.md), so both kinds show up in the same report. This page covers the kill cam's part.

***

## Getting a Report

Turn the suite on before the kill with `Replay.Debug all`, have one player kill another, and let the kill cam play. The victim's machine writes a report to `Saved/Logs/VisualReplay`, named after the time and the machine, such as `Client1`. The kill cam's facts are in the `Game` and `Network` categories, and each is tagged with the kill and clip it belongs to, so facts from back-to-back kills stay apart.

Here is the start of a real report from a kill cam that couldn't get the killer's clip in time. The wait was set to one second when it was captured, and the player name is replaced:

```
Visual replay report Replay_2026.10.04-23.56.03_Client1
world=L_ShooterBaseDemo netmode=client machine=Client1 written=43.072 categories=0xff
window=19.933..30.933 now=30.928

Anomalies
  [Replay] t=32.117 machine=Client1 category=Network what=PerspectiveClipLate anomaly=1 subject=none class=none kill=Player clip=27933 waited=1.00s
  [Replay] t=32.117 machine=Client1 category=Network what=KillcamFellBackToOwnRecording anomaly=1 subject=LyraPlayerState_1 class=LyraPlayerState reason=the clip did not arrive in time latency_offset=0.187

Replay as a whole
  [Replay] t=30.282 machine=Client1 category=Network what=KillerTrackReceived subject=none class=none track=aim samples=440
  [Replay] t=30.282 machine=Client1 category=Network what=KillerTrackReceived subject=none class=none track=hit markers samples=9
  [Replay] t=30.282 machine=Client1 category=Network what=KillerTrackReceived subject=none class=none track=camera samples=3
```

The killer's three tracks arrived, but the clip didn't come within the wait, so the kill cam played the victim's own recording, with the killer's tracks offset by the two players' latency to line up.

***

## Kill Cam Anomalies

| Anomaly | Means | First thing to check |
| --- | --- | --- |
| `KillcamFellBackToOwnRecording` | The killer's clip was expected but didn't arrive in time, so the victim's own recording played | The `reason`; whether pieces arrived at all (`PerspectiveClipChunk` facts), and `Killcam.PerspectiveClipWaitSeconds` and the pacing budget |
| `PerspectiveClipLate` | The wait for the clip ran out | Network conditions and `Killcam.PerspectiveClipBytesPerSecond` |
| `PerspectiveClipUndecodable` | A part of the clip arrived but failed to decode | Whether sender and receiver run the same build |
| `KillerHasNoStandIn` | The killer's player state wasn't recorded in the window, so the camera has no stand-in to follow | Whether the killer was in the match for the whole window, for example joining just before the kill |
| `KillcamCameraFollowsNothing` | The viewer's camera has no target actor | The camera ability: whether its spectator found the killer's stand-in pawn |
| `KillcamCameraAtOrigin` | The camera settled at the world origin | Usually a target that never got placed; check `ShellWithoutPuppet` for the killer's pawn |
| `KillcamWeaponInterfaceReadsLive` | While the view shows the replay, the weapon UI is reading a live object that has a stand-in | UI that cached a live weapon or pawn; it should resolve through the viewed player each time |
| `KillcamNotRestored` | A frame after the kill cam ended, something of the player's view still followed the replay: the team viewer last announced was a stand-in, the camera or a spectator the player owns follows a replay object, or the manager still plays, waits for the killer's clip or holds history | The `what`; for the viewer, whether the camera ability ended on the stop message and its spectator handed the viewer back |

The kill cam runs this check a frame after its stop message, once every listener has had it, in every build but Shipping. Like the replay's own [restoration check](../../visual-replay/debugging.md#checking-that-a-replay-put-everything-back), each problem is also an error in the log, so a test that ends a kill cam fails if the view is left on the replay.

The kill cam also records two statistics: `Killcam.DeathToStartSeconds`, the time from the death to the kill cam starting, and `Killcam.FellBackToOwnRecording`, which is 1 for each kill cam that played the victim's own recording. They appear under the report's statistics.

***

## Troubleshooting by Symptom

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| No kill cam at all | No killing player, such as a fall, or the experience lacks the action set | `CanPlayerUseKillCam`; [Setup and Integration](setup-and-integration.md) |
| The kill cam shows the victim's view of the killer, not the killer's | The clip didn't arrive in time | `KillcamFellBackToOwnRecording`; [Getting the Killer's Recording](data-transfer-and-networking.md) |
| The kill cam waits a long time before starting | The clip is slow to arrive, or preparation is heavy | `WaitingForPerspectiveClip` facts; `Killcam.PrepareBudgetMs` |
| The kill cam stops early | Buffering timed out, or the death ability started the kill cam before the after-death seconds | `BufferingStarted` facts; the [timing rules](setup-and-integration.md#timing-rules) |
| The opening of the window is missing | The recorder's history is shorter than the window | The [timing rules](setup-and-integration.md#timing-rules) |
| Team colours or markers show the victim's side | The camera ability isn't spectating the killer's stand-in, or the UI reads the local player | `TeamViewer` facts; [Playback and Presentation](playback-system.md#seeing-the-match-from-the-killers-side) |
| An objective is in the wrong state | The objective doesn't replay correctly | [Making Game Modes Killcam-Ready](killcam-ready-game-modes.md) |
| The HUD shows live ammo or health | UI reading a live object | `KillcamWeaponInterfaceReadsLive` |
| Live game sounds are heard over the kill cam | Those sounds are in a class that isn't silenced | `SilencedLiveSoundClasses` on the manager |

For problems in the replay itself, such as an actor missing, showing twice or stuck at the origin, see Visual Replay's [Troubleshooting by Symptom](../../visual-replay/debugging.md#troubleshooting-by-symptom).
