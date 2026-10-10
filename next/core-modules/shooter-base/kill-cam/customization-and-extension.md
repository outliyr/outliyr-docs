# Extending the Kill Cam

The kill cam has a few clear seams: its settings, its Blueprint abilities and UI, its gameplay messages, and its tracks. This page covers each, from the cheapest change to the most involved, and says plainly where an extension has to go into the kill cam's own C++.

***

## Tuning

Most changes need no code. The window's length, the camera choice, the sound classes, how long to wait for the killer's clip and how it is paced are all settings, listed on [Setup and Integration](setup-and-integration.md#settings). Keep the [timing rules](setup-and-integration.md#timing-rules) in mind when changing the window.

***

## Replacing the Camera or the UI

The presentation is Blueprint, and the C++ talks to it through a small, fixed surface. Anything that replaces part of it only needs to honour that surface.

* **The camera ability** is started by `GameplayEvent.Killcam`, which carries the victim's stand-in as `Instigator`, the killer's stand-in as `Target` and the duration as `EventMagnitude` ([Playback and Presentation](playback-system.md#the-replay)). A replacement should spectate the killer's stand-in, which is what makes the match show from the killer's side, and end on the stop message.
* **The UI** can follow the kill cam through three gameplay messages:
  * `ShooterGame.KillCam.Message.Start` and `ShooterGame.KillCam.Message.Stop`, each carrying an `FLyraKillCamMessage` with the victim's and the killer's player states;
  * `ShooterGame.KillCam.Message.Waiting`, carrying an `FKillcamWaitingMessage` with the victim and whether the kill cam is waiting.

  The shipped layout is added to the HUD by the death ability, and learns the killer, the victim and the duration from the camera ability through `ShooterGame.KillCam.Message.KillerPlayerReady`, `KilledPlayerReady` and `SetDuration`, which only the Blueprints use. A countdown should pause while waiting, as the shipped layout does. `GetKillcamTiming` also gives the duration.
* **The death flow** belongs to the death ability. A mode with a different flow ships its own death ability in its own copy of the action set ([mode variants](setup-and-integration.md#mode-variants)). Its one obligation is to broadcast the start message once the after-death seconds have passed.

Other systems can listen to the same messages to react to a kill cam, for example to hide a minimap or mute an announcer while one plays.

***

## Showing the Recorded View

To make every kill cam show the killer's exact recorded camera, turn on `bPreferRecordedView` on the manager, or set `Killcam.RecordedView 1` to try it. To change how the recorded view is shown, such as adding a blend or an overlay, subclass `UKillcamRecordedViewCameraMode` and set it as the manager's `RecordedViewCameraMode`. The camera mode reads the session's recorded camera, which the killer's clip carries.

***

## Adding a Custom Track

The killer's aim, camera modes and hit markers are tracks: something the killer's machine records all the time, sends with its clip, and the victim plays on the replay's clock. A game can add its own, such as a weapon's heat or a scope's zoom level that the camera should follow.

> [!WARNING]
> This is the most involved extension, and it goes into the kill cam's own C++. Each track kind has its own pair of RPCs on `UKillcamManager`, its own storage there, and its own place in the replay. Every track also counts against the server's per-kill limits of 8 tracks and 4096 samples each.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Record it

Add a recorder component to controllers, like the three shipped recorders, keeping a few seconds of samples stamped with the recorder's time. Bots' recorders run on the server.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Give it a network form

Define the raw samples, a compact network struct with conversions both ways, and the playback form with times counted from the track's start. The shipped types headers, such as `KillcamHitMarkerTypes.h`, show the pattern. Cap sample counts when reading from the network.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Send and relay it

Add a server RPC the killer calls and a client RPC the server calls on the victim, both on `UKillcamManager`. The server side passes `AcceptTrackFromKiller` before relaying. Send the track alongside the others, both up to the death and in the after-death request, and from the event relay for bots.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Play it

Subclass `UKillcamTrackPlayback`, and have `UKillcamReplay` create it on the killer's stand-in alongside the others.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

The playback is the part with a reusable base. The replay sets its clock, and `GetPlaybackTime` gives seconds into the track, in step with the replay through pauses, speed changes and seeks, with the latency offset applied.

```cpp
UCLASS()
class UMyKillcamHeatPlayback : public UKillcamTrackPlayback
{
    GENERATED_BODY()

public:
    void Init(const FMyHeatTrackPlayback& InTrack) { Track = InTrack; }

protected:
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override
    {
        Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

        // Seconds into the track, wherever the replay is.
        const float Time = GetPlaybackTime();

        // Find the sample at Time and present it, for example on the killer's stand-in that owns this component.
    }

private:
    FMyHeatTrackPlayback Track;
};
```

`UKillcamHitMarkerPlayback` is the smallest shipped example: it shows each hit marker once as playback reaches it, and accepts a longer track while playing without repeating the ones already shown.

***

## Adding Debug Facts

The kill cam reports its decisions to the Visual Replay debug suite, so they appear in each replay's report next to everything the replay did. A game's own kill cam additions can do the same through the `Game` category:

```cpp
VISUALREPLAY_DEBUG_FACT(this, Game, TEXT("HeatTrackStarted"), FVisualReplayDebugSubject(KillerStandIn), TEXT("samples=%d"), Track.Samples.Num());
```

The macro costs one check when the category is off and compiles away in Shipping builds. `VISUALREPLAY_DEBUG_ANOMALY` records a fact that points at something wrong, which the report lists first. [Debugging](debugging.md) covers reading the report.
