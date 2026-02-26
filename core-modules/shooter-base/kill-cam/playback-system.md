# Playback System

With data recorded and transferred, the final step is playing it back. This page covers the mechanics of triggering playback, world switching, time scrubbing, and view control.

***

### Triggering Playback

Kill Cam playback doesn't start automatically at death. External game logic controls when it begins, allowing for:

* Death animations to complete
* Score displays to show
* Custom timing per game mode

#### The Start Message

Playback begins when the `ShooterGame.KillCam.Message.Start` message is broadcast locally on the victim's client:

```cpp
USTRUCT(BlueprintType)
struct FLyraKillCamMessage
{
    UPROPERTY(BlueprintReadWrite)
    TObjectPtr<APlayerState> KilledPlayerState;

    UPROPERTY(BlueprintReadWrite)
    TObjectPtr<APlayerState> KillerPlayerState;

    // How many seconds before death to start playback
    UPROPERTY(BlueprintReadWrite)
    float KillCamStartTime = 7.0f;

    // Total playback duration
    UPROPERTY(BlueprintReadWrite)
    float KillCamFullDuration = 7.0f;
};
```

Typical trigger pattern:

{% stepper %}
{% step %}
#### Server detects player death

Server-side logic determines that a player has died and prepares any game-mode-specific behavior (scores, animations).
{% endstep %}

{% step %}
#### Server sends Client RPC to victim's controller

A Client RPC is invoked on the victim's PlayerController to notify the client.
{% endstep %}

{% step %}
#### RPC broadcasts the Start message locally

The RPC triggers a local broadcast of `ShooterGame.KillCam.Message.Start` (see payload above).
{% endstep %}

{% step %}
#### `UKillcamManager` receives and processes

The manager receives the Start message and begins the startup flow for playback.
{% endstep %}
{% endstepper %}

### Manager Receives Start

```cpp
void UKillcamManager::OnKillCamStartMessage(
    FGameplayTag Channel,
    const FLyraKillCamMessage& Payload)
{
    // Store timing parameters on the playback instance
    KillcamPlayback->KillCamStartTime = Payload.KillCamStartTime;
    KillcamPlayback->KillCamDuration = Payload.KillCamFullDuration;

    // Pass killer's overlay data to playback
    KillcamPlayback->SetKillerAimTrack(BuiltAimTrack);
    KillcamPlayback->SetKillerHitTrack(BuiltHitTrack);
    KillcamPlayback->SetKillerCameraTrack(BuiltCameraTrack);

    // Initiate playback
    KillcamPlayback->KillcamStart(
        FOnKillcamStartComplete::CreateUObject(
            this, &UKillcamManager::OnKillcamStarted));
}
```

***

### Starting Playback

The `KillcamStart` function orchestrates the complex startup sequence.

#### Pre-flight Checks

```plaintext
IsPlaybackAllowed():
    Return false if:
        - Already playing a kill cam
        - Running in Play-In-Editor mode (duplication only works in Standalone)
        - Duplicate world doesn't exist
        - Not enough replay data for the requested rewind time
        - No valid cached killer information

    Return true if all checks pass
```

#### The Startup Sequence

{% stepper %}
{% step %}
Stop recording (switching to playback mode)
{% endstep %}

{% step %}
Mark as playing
{% endstep %}

{% step %}
Activate duplicate world:

* Set duplicate collection visible
* Add duplicate levels to world
{% endstep %}

{% step %}
Start replay playback with options:

* Use in-memory streaming
* Reuse duplicated levels (`LevelPrefixOverride=1`)
{% endstep %}

{% step %}
Assign `DemoNetDriver` to duplicate collection
{% endstep %}

{% step %}
Scrub to start time:

* Target = death time - rewind amount
* On completion: proceed to show kill cam
{% endstep %}
{% endstepper %}

***

### Time Scrubbing

The replay starts at the beginning of the recorded buffer, but we need to jump to a specific moment, typically 7 seconds before death. Note, 7 seconds is the default time set, this can be changed to whatever you see fit.

#### Calculating Start Time

```cpp
float TargetTime = CachedHeroDeathDemoTime - KillCamStartTime;
```

Where:

* `CachedHeroDeathDemoTime`: The replay timestamp when death occurred
* `KillCamStartTime`: How far back to rewind (default 7.0 seconds)

#### The GotoTime Operation

```plaintext
KillcamGoToTime(targetTime, callback):
    Get DemoNetDriver for playback

    Preserve important actors during scrub:
        - Add victim's NetGUID to non-queued list
        - Add killer's NetGUID to non-queued list
        (This prevents them from being destroyed as "stale")

    Cache target time for potential restart

    Call async GotoTimeInSeconds operation
    (This processes replay stream to target time)
```

#### Completion Callback

```plaintext
OnKillcamInitialGoToTimeComplete(success, callback):
    If scrub succeeded:
        Proceed to show kill cam to user

    Else (scrub failed):
        Log error
        Stop the demo
        Mark as not playing
        Execute callback with failure
```

***

### Switching the View

Once the replay is positioned correctly, the player's view must switch to the duplicate world.

#### World Visibility Toggle

```plaintext
ShowKillcamToUser():
    Hide the live game world:
        - Find DynamicSourceLevels collection
        - Set visibility to false

    The duplicate world is already visible from startup
    Actors' render states update automatically

    Set up the view target to follow the killer
```

#### Finding Actors in the Duplicate World

The cached NetGUIDs are used to find the corresponding actors in the duplicate world:

```plaintext
SetViewTargetToKillingActor():
    Start polling for actor availability:
        - Check every 100ms
        - Give up after 3 seconds

CheckActorAvailability():
    Try to resolve NetGUIDs to actual actors:
        - Look up victim player state by cached GUID
        - Look up killer player state by cached GUID

    If both actors found:
        Proceed with kill cam

    Else if timeout exceeded:
        Proceed with what we have (partial data)

    Else:
        Timer will call again
```

> [!INFO]
> Pooling is ncecessary because of timing conditions that prevent the player state from being immediately available which causes issues. This seems to be nature of the using the `InMemoryReplayNetworkStreamer`.

#### The Killcam Gameplay Event

When actors are found, a gameplay event triggers the actual camera switch:

```plaintext
ProceedWithKillcam(victim, killer):
    Build gameplay event payload:
        - Instigator = killer actor
        - Target = victim actor
        - EventMagnitude = kill cam duration

    Find victim's AbilitySystemComponent
    Trigger gameplay event: GameplayEvent.Killcam

    Execute startup complete callback with success
```

The `GA_Killcam_Camera` ability responds to this event and sets the view target. This handles spawning the `TeammateSpectator` from the spectator system. It spawns widgets and also ensures to follow the killer and handle pawn switching as the killer's pawn isn't guaranteed to be present during the entire killcam sequence e.g. they died, respawned, then immediately killed the victim.

***

### Playback Components

While the replay handles world state (actor positions, animations), the overlay data components provide the killer's perspective details.

#### `UKillcamAimPlayback`

Interpolates between recorded aim samples to provide smooth crosshair movement:

```plaintext
AimPlayback Tick(deltaTime):
    Advance playback time

    Find bracketing samples for current time:
        - Lower sample (before current time)
        - Upper sample (after current time)
        - Alpha (interpolation factor 0-1)

    Interpolate rotation between samples
    Interpolate location between samples

    Apply interpolated aim to view target or camera
```

#### `UKillcamHitMarkerPlayback`

Displays hit markers at the correct moments during playback:

```plaintext
HitMarkerPlayback Tick(deltaTime):
    Advance playback time

    For each pending hit marker sample:
        If sample time <= current time:
            Display hit marker with:
                - World location
                - Hit zone
                - Success indicator
            Move to next sample
        Else:
            Break (remaining samples are in the future)
```

#### `UKillcamCameraPlayback`

Applies camera mode and ADS state changes:

```plaintext
CameraPlayback Tick(deltaTime):
    Advance playback time

    For each pending camera event:
        If event time <= current time:
            If camera mode changed:
                Apply new camera mode
                Update current mode

            If ADS state changed:
                Apply new ADS state
                Update current ADS flag

            Move to next event
        Else:
            Break (remaining events are in the future)
```

***

### Ending Playback

Playback ends either naturally (duration expires) or when skipped.

#### The Stop Message

```
ShooterGame.KillCam.Message.Stop
```

Sent by:

* Game logic when `KillCamFullDuration` expires
* `GA_Skip_Killcam` ability when player presses skip

#### Manager Receives Stop

```plaintext
OnKillCamEndMessage(Payload):
    Call KillcamStop with completion callback
    (On complete: restart recording for next life)
```

#### The Cleanup Sequence

{% stepper %}
{% step %}
Destroy replay actors (non-startup actors in duplicate levels)
{% endstep %}

{% step %}
Destroy the DemoNetDriver
{% endstep %}

{% step %}
Hide duplicate world:

* Find DynamicDuplicatedLevels collection
* Set visibility to false
{% endstep %}

{% step %}
Show live game world:

* Find DynamicSourceLevels collection
* Set visibility to true
{% endstep %}

{% step %}
Remove duplicate levels from world
{% endstep %}

{% step %}
Optional garbage collection (if CVar enabled)
{% endstep %}

{% step %}
Mark as stopped and disabled
{% endstep %}

{% step %}
Execute completion callback
{% endstep %}
{% endstepper %}

#### Restarting Recording

After playback stops, recording must resume for the player's next life:

```plaintext
OnKillcamStoppedAndReadyToRecord():
    Reinitialize recording for next potential death
```

> [!INFO]
> Another limitation of the engine, is that two demo net drivers cannot be active at the same time. So when you are watching a killcam replay you cannot record the source world at the same time. This is why there is a condition requiring a minimal amount of recording data to be there.

***

### Seamless Travel Handling

If a map transition occurs during kill cam, the system handles it gracefully:

```plaintext
OnSeamlessTravelStart(world, levelName):
    If currently playing kill cam:
        Mark as seamless traveling
        Abort playback cleanly via KillcamStop
```

The system subscribes to the `OnSeamlessTravelStart` world delegate during setup to receive these notifications.

***
