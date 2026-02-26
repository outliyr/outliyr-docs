# Setup and Integration

This page provides a practical guide to enabling Kill Cam in your game experiences. The system is designed to integrate cleanly with Lyra's Experience framework.

<img src=".gitbook/assets/image (217).png" alt="" title="Blueprint killcam logic in ShooterBase">

***

### Prerequisites

#### Engine Configuration

The Kill Cam requires a custom `UGameEngine` class that enables world duplication. This must be configured in your project's `Config/DefaultEngine.ini`:

```ini
[/Script/Engine.Engine]
GameEngineClass=/Script/LyraGame.LyraGameEngine
```

**For Unreal Engine 5.5 and later**, add this additional section:

```ini
[ConsoleVariables]
s.World.CreateStaticLevelCollection=1
```

> [!DANGER]
> **Without this configuration, Kill Cam will not function.** World duplication only occurs when the engine is properly configured and the game runs in Standalone mode.

#### Verify Engine Class

The `ULyraGameEngine` class must override the experimental duplication function:

```cpp
// LyraGameEngine.h
UCLASS()
class ULyraGameEngine : public UGameEngine
{
    GENERATED_BODY()

protected:
    virtual bool Experimental_ShouldPreDuplicateMap(
        const FName MapName) const override;
};

// LyraGameEngine.cpp
bool ULyraGameEngine::Experimental_ShouldPreDuplicateMap(
    const FName MapName) const
{
    return true;  // Enable for all maps
}
```

***

### Quick Integration: Action Sets

The simplest way to add Kill Cam is through the provided Action Set.

{% stepper %}
{% step %}
#### Open Your Experience Definition

Navigate to your Experience Definition asset (e.g., `B_Experience_TeamDeathmatch`).
{% endstep %}

{% step %}
#### Add the Kill Cam Action Set

In the Details panel:

* Find the **Action Sets** array
* Click the **+** button to add a new entry
* Select `LAS_ShooterBase_Death_Killcam`

The Action Set handles all component and ability setup automatically.
{% endstep %}
{% endstepper %}

***

### What the Action Set Adds

When `LAS_ShooterBase_Death_Killcam` activates, it adds several pieces:

#### Components

| Component                   | Added To         | Net Mode        | Purpose                            |
| --------------------------- | ---------------- | --------------- | ---------------------------------- |
| `UKillcamManager`           | PlayerController | Client Only     | Orchestrates kill cam flow         |
| `UKillcamAimRecorder`       | PlayerController | Client Only     | Records aim data                   |
| `UKillcamHitMarkerRecorder` | PlayerController | Client Only     | Records hit markers                |
| `UKillcamCameraRecorder`    | PlayerController | Client Only     | Records camera state               |
| `USpectatorDataProxy`       | PlayerState      | Client & Server | Replicates spectator-relevant data |

#### Gameplay Abilities

| Ability             | Granted To        | Purpose                                         |
| ------------------- | ----------------- | ----------------------------------------------- |
| `GA_Killcam_Death`  | PlayerState (ASC) | Handles death event, initiates kill cam         |
| `GA_Killcam_Camera` | PlayerState (ASC) | Pawn tracking, victim indicator, spectator pawn |
| `GA_Skip_Killcam`   | PlayerState (ASC) | Handles skip input                              |
| `GA_Manual_Respawn` | PlayerState (ASC) | Controls respawn timing                         |

#### Input Bindings

The Action Set includes input configuration for the skip action, typically mapped to a common "interact" or "skip" input.

***

## Game Mode Variants

Different game modes may need different kill cam behavior. The framework provides variant Action Sets:

<table><thead><tr><th width="412.5333251953125">Action Set</th><th>Game Mode</th></tr></thead><tbody><tr><td><code>LAS_ShooterBase_Death_Killcam</code></td><td>Base shooter modes</td></tr><tr><td><code>LAS_ShooterBase_Death_Killcam_Arena</code></td><td>Arena/Duel</td></tr><tr><td><code>LAS_ShooterBase_Death_Killcam_Headquarters</code></td><td>Objective modes</td></tr><tr><td><code>LAS_ShooterBase_Death_Killcam_PropHunt</code></td><td>PropHunt</td></tr><tr><td><code>LAS_ShooterBase_Death_Killcam_SearchAndDestroy</code></td><td>Search &#x26; Destroy</td></tr></tbody></table>

These variants typically use different `GA_Killcam_Death` implementations that handle mode-specific logic.

{% stepper %}
{% step %}
#### Creating Your Own Variant — Duplicate Action Set

Duplicate `LAS_ShooterBase_Death_Killcam`.
{% endstep %}

{% step %}
#### Creating Your Own Variant — Create Custom Ability

Create custom `GA_Killcam_Death_YourMode` ability.
{% endstep %}

{% step %}
#### Creating Your Own Variant — Swap Ability

Replace the death ability reference in your Action Set.
{% endstep %}

{% step %}
#### Creating Your Own Variant — Add to Experience

Add your Action Set to your Experience Definition.
{% endstep %}
{% endstepper %}

***

### Testing

> [!DANGER]
> **Kill Cam only works in Standalone mode.** PIE (Play In Editor) does not trigger world duplication.

#### Testing Steps

1. Launch in Standalone Mode
   * Use the Launch button targeting "Standalone Game"
   * Or command line: `UnrealEditor.exe YourProject.uproject -game`
2. Set Up Multiplayer Test
   * Kill cam requires killer and victim to be different players
   * Use `-server` + client instances, or dedicated server
3. Trigger a Kill
   * Have one player kill another
   * Victim should see kill cam after death

#### Common Testing Issues

| Issue                                                    | Cause                          | Solution                             |
| -------------------------------------------------------- | ------------------------------ | ------------------------------------ |
| Kill cam never plays / normal death widget plays instead | Running in PIE                 | Use Standalone mode                  |
| Black screen during kill cam                             | Duplicate world not created    | Verify engine config                 |
| Camera doesn't follow killer                             | Actor not found in duplicate   | Check NetGUID caching                |
| No aim overlay                                           | Data transfer failed           | Check network/RPC logs               |
| Immediate return to live game                            | Playback allowed check failing | Check `IsPlaybackAllowed` conditions |

#### Debug Logging

Enable kill cam logging by using the `LogKillcam` category with Verbose level.

***

### Integration Checklist

Use this checklist when integrating Kill Cam:

* [ ] `DefaultEngine.ini` has `GameEngineClass=/Script/LyraGame.LyraGameEngine`
* [ ] UE 5.5+: `s.World.CreateStaticLevelCollection=1` CVar set
* [ ] Experience Definition includes Kill Cam Action Set
* [ ] Client death triggers `ShooterGame.KillCam.Message.Start` on death
* [ ] Client triggers `ShooterGame.KillCam.Message.Stop` when done
* [ ] Testing performed in Standalone mode (not PIE)
* [ ] Multiplayer testing with separate killer/victim

***

### Timing Configuration

The default timing values work well for most shooters:

```cpp
float KillCamStartTime = 7.0f;   // How far back to rewind
float KillCamFullDuration = 7.0f; // Total playback length
```

#### Adjusting Timing

Shorter duration (faster paced):

```cpp
Message.KillCamStartTime = 4.0f;
Message.KillCamFullDuration = 4.0f;
```

Longer duration (dramatic deaths):

```cpp
Message.KillCamStartTime = 10.0f;
Message.KillCamFullDuration = 10.0f;
```

> [!INFO]
> The replay buffer must be large enough to support your `KillCamStartTime`. The default 15-second buffer supports up to 15 seconds of rewind.

***
