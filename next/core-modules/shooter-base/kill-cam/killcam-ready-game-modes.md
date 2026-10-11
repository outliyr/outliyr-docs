# Making Game Modes Killcam-Ready

Objectives are where kill cams most often look wrong, because an objective's look depends on game state: which hill is active, who holds the flag, whether the bomb is planted. This page explains how an objective appears in a kill cam, walks through how the shipped modes were made to replay correctly, gives a checklist for a new mode, and shows how to test a mode's objectives the way the shipped ones are tested.

The rules behind each case are explained once, on Visual Replay's [Writing Replay-Friendly Gameplay Code](../../visual-replay/replay-friendly-gameplay-code.md). Each case below links to the rule it applies.

***

## How an Objective Appears in a Kill Cam

A placed objective such as a control point, a flag or a bomb is a replicated actor, so the victim's machine records its replicated values all match long. In a kill cam it comes back in two layers:

* **Its meshes are drawn by its puppet**, exactly as they were drawn, as long as they are Movable. Meshes added to a Blueprint are Movable by default.
* **Its shell runs its own class**, from the recorded values. The shell's logic provides everything else: the capture ring and its light, the marker over it, the team colours it shows. The shell is hidden whenever the objective was hidden.

Because the shell is a client-side copy with no authority, an objective that looks right to a player joining mid-match looks right in a kill cam. The cases below are bugs found that way.

***

## The Control Point's Starting State

*Rule: [decide on the server, show on clients](../../visual-replay/replay-friendly-gameplay-code.md#decide-on-the-server-show-on-clients).*

Every machine used to turn a control point on or off from its starting setting as it began play. That overwrote the value the server had sent. A player joining while a later hill was active saw it off, and a kill cam's shell of a point came up in its starting state rather than the recorded one.

```cpp
// Before: every machine applied the starting setting.
if (Settings.ActivationSettings.bStartsActive)
{
    SetActive_Internal(true);
}
else
{
    SetActive_Internal(false);
}

// After: only the server does. A client, and a kill cam shell, show the value the server sent.
if (HasAuthority())
{
    SetActive_Internal(Settings.ActivationSettings.bStartsActive);
}
else
{
    OnRep_IsActive();
    BroadcastActiveChanged(bIsActive);
}
```

An inactive point hides its actor. Its shell follows the recorded hidden state, so the next hardpoint's ring and light stay out of a kill cam until the point actually went live.

***

## The Planted Bomb

*Rules: [rep notifies present, they never act](../../visual-replay/replay-friendly-gameplay-code.md#rep-notifies-present-they-never-act), and [hide and show where the recording can see it](../../visual-replay/replay-friendly-gameplay-code.md#hide-and-show-where-the-recording-can-see-it).*

Two problems showed up together.

* **Gameplay in a rep notify.** Hearing that the bomb was planted dropped it, so every client, and every shell, pulled the bomb off its site. The rep notify now only shows the planted bomb and stops it colliding.
* **The planter.** Planting left the planter as the bomb's carrier, so the planter's death dropped the bomb from the site. Clearing the carrier instead broke the bomb's marker, the bomb site and the bots' site service, which all read it. The planter now stays named as the last carrier, and dropping does nothing once the bomb is planted.

On the server, planting frees the bomb from its owner, stops it colliding and shows it. Showing it on the server replicates the hidden flag, which the recorder captures, so a shell of a planted bomb is visible however a Blueprint subclass handles the plant.

***

## Objective Markers

*Rules: [wait with Delay, not timers](../../visual-replay/replay-friendly-gameplay-code.md#wait-with-delay-not-timers), and [colour and mark by the viewer](../../visual-replay/replay-friendly-gameplay-code.md#colour-and-mark-by-the-viewer-not-the-local-player).*

The shipped objective markers follow one pattern that works live and in a kill cam.

* **Markers are indicators on the objective.** The objective adds a Lyra indicator for one of its own components, so a shell adds its own indicator, showing what the objective was then. While a live objective has a stand-in, its live indicator is hidden.
* **Waits use Delay.** A marker that waits a moment before adding itself does so with a Blueprint `Delay`, which a shell finishes at replay speed. A timer would never fire on a shell.
* **Colours follow the viewer.** Markers observe the viewer's team rather than the local player's, so during a kill cam they show the killer's side.
* **Markers clean up when they unbind.** A marker cancels the team observers it started when its indicator unbinds. An indicator set to go when its component does is removed the moment its actor ends play, so a shell's marker is gone before the viewer switches back from the killer.

The control point, capture the flag, and search and destroy markers all work this way. Here is the control point's:

<!-- tabs:start -->
#### **Begin play**
<img src=".gitbook/assets/controlpoint-beginplay.png" alt="B_ControlPoint begin play" title="Once the experience is ready, the point starts following the viewer's team and adds its marker">


#### **Add the marker**
<img src=".gitbook/assets/controlpoint-initialize-objective-marker.png" alt="B_ControlPoint adding its objective marker" title="The marker waits a tick, retries with a Delay until the indicator manager exists, then adds the indicator">


#### **Follow the viewer's team**
<img src=".gitbook/assets/controlpoint-listen-for-team-change.png" alt="B_ControlPoint observing the viewer's team" title="ObserveViewerTeam keeps the point's colours on the viewer's side">

<!-- tabs:end -->

***

## Flags, Payload and Other State

Most objectives need nothing beyond replicated values. A flag's team and whether it is taken, a payload's distance along its track and its capture progress, and a control point's progress, owner and contested state all come back on the shell from the recording. A flag's cloth simulates on its replayed mesh and starts over each time the flag appears. Each of these is covered by a test, described below.

***

## Messages

The kill cam's presentation runs partly inside the replay's sandbox scope, where Lyra drops gameplay messages so shells can't announce things to the live match. ShooterBase lets its own `ShooterGame.KillCam` channel through, so the kill cam's messages still reach its UI while a replay runs. A mode whose replay presentation needs to hear a channel allows it the same way, once at startup:

```cpp
LyraReplayMessageFilter::AllowChannel(TEXT("MyMode.Objective"));
```

Everything under that channel is allowed too.

***

## Checklist for a New Mode

* [ ] Objectives that need to appear in kill cams replicate, and their meshes are Movable.
* [ ] Starting settings are applied only with authority; clients show replicated values.
* [ ] Presentation runs from rep notifies and BeginPlay, not Tick.
* [ ] Waits in objective presentation use Delay, not timers.
* [ ] Rep notifies only present; gameplay stays where the server changes values.
* [ ] Showing and hiding uses the actor's hidden flag or component visibility.
* [ ] Markers are indicators on the objective, coloured by the viewer's team.
* [ ] The experience includes the kill cam action set, or a mode variant of it ([Setup and Integration](setup-and-integration.md)).
* [ ] Each objective class has a shell test.

***

## Testing a Mode's Objectives

Each shipped mode tests its objectives the same way, with a shared helper from ShooterBase's test module. A test names an objective class and two moments of its replicated state. The helper then:

1. spawns the class on a test server with its own logic stopped;
2. gives it the first state, then the second, while a connected client records each;
3. brings up a shell from that recording and checks it.

The checks are that the shell is the real class, has no authority, begins play holding the first state, moves to the second as the replay time does, and leaves the live copy alone. Anything the shell logs as a warning is reported, and an error fails the test.

This is the whole control point test:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FControlPointKillcamShellTest, "ControlPointCore.Killcam.ShellShowsTheRecordedState", EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
bool FControlPointKillcamShellTest::RunTest(const FString&)
{
    return UE::ShooterBase::Tests::TestKillcamShellOfReplicatedClass(*this, TEXT("/ControlPointCore/Game/B_ControlPoint.B_ControlPoint_C"),
        { { TEXT("CaptureProgress"), TEXT("0.250000") }, { TEXT("OwnerTeamId"), TEXT("1") }, { TEXT("bIsContested"), TEXT("True") }, { TEXT("bIsActive"), TEXT("False") } },
        { { TEXT("CaptureProgress"), TEXT("0.750000") }, { TEXT("OwnerTeamId"), TEXT("2") }, { TEXT("bIsContested"), TEXT("False") }, { TEXT("bIsActive"), TEXT("True") } });
}
```

The values are written the way the properties export as text. The first state deliberately has the point inactive, which is exactly the case the starting-state bug got wrong.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Add a test module to the mode's plugin

Create an Editor module named after the plugin, such as `MyModeTests`, inside the game feature plugin. Its Build.cs depends on `Core`, `CoreUObject`, `Engine` and `ShooterBaseTests`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### List it in the plugin

Add the module to the plugin's `.uplugin` with type `Editor`, so it builds with the editor and never ships.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Write one test per objective class

Include `KillcamShellTestSupport.h` and call `TestKillcamShellOfReplicatedClass` with the class path and two moments of state that differ in every property that matters to how the objective looks.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

Keeping each mode's tests inside its own plugin means a mode can be deleted without breaking anyone else's tests.
