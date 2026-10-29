# Kill Cam

Dying without knowing how is one of the most frustrating moments in a shooter. The kill cam replays the last seconds before a player's death through the eyes of the player who killed them: their camera, their aim, the hit markers they saw. It plays while the match carries on, so the victim is back in the action the moment it ends.

<img src=".gitbook/assets/killcam-playing.png" alt="A kill cam playing through the killer's eyes" title="A kill cam through the killer's eyes, with their weapon, their aim and the damage they dealt, and the victim marked">

The kill cam is built on [Visual Replay](../../visual-replay/), which records every player's view of the match all the time and plays the past back inside the live world. On top of it, the kill cam decides whose recording to show, gets that recording from the killer's machine safely, and presents it.

***

### Where the Picture Comes From

The victim's own machine has a recording of the kill, but it shows the killer the way the victim saw them: slightly late, smoothed, and never from the killer's first-person view. So when a kill happens, the server asks the **killer's machine** for its own recording of the window and relays it to the victim, checking every piece against its own record of the kill. The kill cam starts as soon as the opening of the window has arrived, and the rest streams in while it plays. If the killer's recording doesn't arrive in time, the kill cam plays the victim's own recording instead.

A dedicated server records nothing itself; it only keeps the record of each kill and relays.

### Limits

* **No kill cam without a killing player.** A fall or a world hazard has none.
* **A bot's kill plays the victim's own recording,** with the bot's aim and camera tracks gathered by the server. A bot has no machine to record a clip on.
* **The window is bounded by the recorder's history.** The time before the death, plus a second, must fit inside `Replay.WindowSeconds`.

***

### The Pieces

| C++ | Blueprint and assets |
| --- | --- |
| `UKillcamManager` on each controller runs the kill cam: the kill record, the start decision, the transfer | `GA_Killcam_Death` asks for the kill cam once the after-death seconds have passed |
| `UKillcamEventRelay` on the game state turns eliminations into kill records | `GA_Killcam_Camera` follows the killer's stand-in through a spectator |
| Aim, camera and hit marker recorders keep the killer's own tracks | `GA_Skip_Killcam` lets the player skip |
| `UKillcamReplay` owns the Visual Replay session and its track playbacks | `W_KillcamLayout` shows the kill cam UI and its waiting screen |
| `UKillcamRecordedViewCameraMode` shows the killer's exact recorded camera | `LAS_ShooterBase_Death_Killcam` adds everything to an experience |

### Reading Paths

* **Tuning or debugging the kill cam:** [How a Kill Cam Plays](architecture-overview.md), the settings in [Setup and Integration](setup-and-integration.md#settings), then [Debugging](debugging.md) and Visual Replay's [Debugging](../../visual-replay/debugging.md). From there, by symptom: [Getting the Killer's Recording](data-transfer-and-networking.md), [Playback and Presentation](playback-system.md), or Visual Replay's [Sessions](../../visual-replay/sessions.md) for buffering.
* **Making a game mode work in kill cams:** [Making Game Modes Killcam-Ready](killcam-ready-game-modes.md), the rules it links to on Visual Replay's [Writing Replay-Friendly Gameplay Code](../../visual-replay/replay-friendly-gameplay-code.md), then [Setup and Integration](setup-and-integration.md).
* **Changing what the kill cam shows:** [Playback and Presentation](playback-system.md), then [Extending the Kill Cam](customization-and-extension.md).

### Documentation Guide

| Page | Content |
| --- | --- |
| [How a Kill Cam Plays](architecture-overview.md) | One kill from start to finish, the window, and which piece does what |
| [Getting the Killer's Recording](data-transfer-and-networking.md) | Slices, pacing, the server's checks, receiving, waiting and cancelling |
| [Playback and Presentation](playback-system.md) | The replay, the killer's side, the camera, the tracks, sound, waiting and ending |
| [Setup and Integration](setup-and-integration.md) | Adding the kill cam to an experience, every setting, the timing rules and testing |
| [Making Game Modes Killcam-Ready](killcam-ready-game-modes.md) | How objectives appear in a kill cam, the shipped cases, a checklist and shell tests |
| [Extending the Kill Cam](customization-and-extension.md) | Replacing the camera or UI, the recorded view, custom tracks and debug facts |
| [Debugging](debugging.md) | Reading a kill cam's report, its anomalies and troubleshooting by symptom |
