# Customization and Extension

The Kill Cam system is designed with clear boundaries between what's safe to modify and what should remain untouched. This page guides you through extending the system without breaking its core functionality.

***

### Safe Extension Points

These areas are designed for customization and won't destabilize the system:

{% stepper %}
{% step %}
### Gameplay Abilities

The safest way to customize Kill Cam behavior is through the Gameplay Abilities. These are designed to be overridden or replaced.

#### `GA_Killcam_Death`

Controls what happens when the player dies:

```plaintext
Custom Death Ability (extends LyraGameplayAbility):

ActivateAbility():
    Show custom death UI (if desired)

    Set up delay timer before starting kill cam
    (Allows death animations to play, score to display, etc.)

    On timer complete: call StartKillcam()

StartKillcam():
    Create kill cam message with:
        - Custom rewind time
        - Custom duration

    Broadcast start message via GameplayMessageSubsystem
    Tag: ShooterGame.KillCam.Message.Start
```

#### **`GA_Killcam_Camera`**

Handles pawn tracking and UI indicators during playback. Note that camera modes are controlled by the **UKillcamCameraPlayback** component, not this ability.

```plaintext
Custom Pawn Tracking Ability (extends LyraGameplayAbility):

ActivateAbility(EventData):
    Get killer and victim identifiers from event data

    Begin pawn tracking:
        - The killer's pawn may not exist immediately in the duplicate world
        - Listen for pawn change events
        - Handle cases where killer's pawn changes during playback

    Create victim indicator:
        - Spawn the "you" marker widget attached to victim's pawn
        - Position indicator above victim's head
        - Configure visibility and styling

    Spawn teammate spectators:
        - Create spectator actors to watch relevant pawns
        - Used for team-based visibility during playback
```

#### `GA_Skip_Killcam`

Handles the skip action:

```plaintext
Custom Skip Ability (extends LyraGameplayAbility):

ActivateAbility():
    If using hold-to-skip mechanic:
        Start hold progress UI
        Return (don't skip immediately)
        (On hold complete: broadcast stop message)

    Otherwise (instant skip):
        Broadcast stop message via GameplayMessageSubsystem
        Tag: ShooterGame.KillCam.Message.Stop

        Trigger respawn flow
```
{% endstep %}

{% step %}
### Timing Parameters

Adjust the kill cam duration and rewind time via the start message:

```cpp
FLyraKillCamMessage Message;
Message.KillCamStartTime = 5.0f;     // Rewind 5 seconds (default: 7.0)
Message.KillCamFullDuration = 5.0f;  // Play for 5 seconds (default: 7.0)
```

**Common Timing Patterns:**

| Style      | Start Time | Duration | Use Case                |
| ---------- | ---------- | -------- | ----------------------- |
| Quick      | 3.0        | 3.0      | Fast-paced arena        |
| Standard   | 7.0        | 7.0      | Most shooters           |
| Dramatic   | 10.0       | 10.0     | Tactical games          |
| Final Kill | 7.0        | 10.0     | Match-ending highlights |
{% endstep %}

{% step %}
### UI Overlays

Add custom UI during kill cam through the camera ability or dedicated UI widgets:

```plaintext
In Death Ability - ActivateAbility():
    Create and configure overlay widget:
        - Set killer info (name, level, etc.)
        - Set weapon used
        - Set any other kill details
    Add widget to viewport

In Death Ability - EndAbility():
    Remove overlay widget from viewport
    Clear widget reference
    
In Camera Ability - ActivateAbility():
    Spawn Victim indicator widget

In Death Ability - EndAbility():
    Remove victim indicator
    Clear widget reference
```
{% endstep %}

{% step %}
### Input Bindings

Customize the skip input in your Input Config:

```cpp
// In your InputConfig data asset
{
    InputTag: "InputTag.Killcam.Skip",
    InputAction: IA_SkipKillcam,
    AbilityTags: "Ability.Killcam.Skip"
}
```

Or use different inputs for different platforms:

```cpp
// Controller
InputTag.Killcam.Skip -> Gamepad_FaceButton_Bottom (A/X)

// Keyboard
InputTag.Killcam.Skip -> SpaceBar
```
{% endstep %}
{% endstepper %}

***

### Creating Custom Recorder Components

If you need to capture additional data during gameplay, follow the existing recorder pattern.

{% stepper %}
{% step %}
#### Define Data Structures

```cpp
// MyCustomTypes.h

// Raw format - full precision for local storage
USTRUCT()
struct FMyCustomSampleRaw
{
    GENERATED_BODY()

    UPROPERTY()
    float ServerTime = 0.f;

    UPROPERTY()
    FVector CustomData;

    UPROPERTY()
    bool bCustomFlag = false;
};

// Playback format - time-normalized
USTRUCT()
struct FMyCustomSamplePlayback
{
    GENERATED_BODY()

    UPROPERTY()
    float Time = 0.f;  // Normalized to window

    UPROPERTY()
    FVector CustomData;

    UPROPERTY()
    bool bCustomFlag = false;
};

USTRUCT()
struct FMyCustomTrackPlayback
{
    GENERATED_BODY()

    UPROPERTY()
    TArray<FMyCustomSamplePlayback> Samples;

    UPROPERTY()
    float WindowSeconds = 0.f;
};
```
{% endstep %}

{% step %}
#### Create the Recorder Component

```cpp
// MyCustomRecorder.h
UCLASS()
class UMyCustomRecorder : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(EditDefaultsOnly, Category="Killcam")
    float MaxRecordLengthSeconds = 15.f;

    const TArray<FMyCustomSampleRaw>& GetSamples() const { return Samples; }

protected:
    virtual void TickComponent(float DeltaTime, ...) override
    {
        // Continuous sampling (like aim recorder)
        RecordCurrentState();
        TrimOldSamples();
    }

    // Or event-based sampling (like hit marker recorder)
    void OnCustomEvent(const FMyEvent& Event)
    {
        FMyCustomSampleRaw Sample;
        Sample.ServerTime = GetWorld()->GetTimeSeconds();
        Sample.CustomData = Event.Data;
        Samples.Add(Sample);
    }

private:
    UPROPERTY()
    TArray<FMyCustomSampleRaw> Samples;
};
```
{% endstep %}

{% step %}
#### Create the Playback Component

```cpp
// MyCustomPlayback.h
UCLASS()
class UMyCustomPlayback : public UActorComponent
{
    GENERATED_BODY()

public:
    void Initialize(const FMyCustomTrackPlayback& InTrack)
    {
        Track = InTrack;
        CurrentTime = 0.f;
        NextSampleIndex = 0;
    }

protected:
    virtual void TickComponent(float DeltaTime, ...) override
    {
        CurrentTime += DeltaTime;

        // Process samples up to current time
        while (NextSampleIndex < Track.Samples.Num())
        {
            const FMyCustomSamplePlayback& Sample =
                Track.Samples[NextSampleIndex];

            if (Sample.Time <= CurrentTime)
            {
                ApplyCustomData(Sample);
                NextSampleIndex++;
            }
            else
            {
                break;
            }
        }
    }

private:
    FMyCustomTrackPlayback Track;
    float CurrentTime = 0.f;
    int32 NextSampleIndex = 0;
};
```
{% endstep %}

{% step %}
#### Integrate with Data Transfer

Add RPCs to `UKillcamManager` for your custom data:

```cpp
// In UKillcamManager

UFUNCTION(Server, Reliable)
void ServerSendMyCustomTrack(
    APlayerState* VictimPS,
    const FMyCustomTrackRaw& Track);

UFUNCTION(Client, Reliable)
void ClientReceiveMyCustomTrack(
    const FMyCustomTrackRaw& Track);
```
{% endstep %}
{% endstepper %}

***

### Creating Custom Playback Components

For data that needs special rendering or behavior during playback:

#### Pattern: Event-Based Playback

```cpp
UCLASS()
class UKillcamEffectPlayback : public UActorComponent
{
public:
    void Initialize(const FEffectTrackPlayback& InTrack);

protected:
    virtual void TickComponent(float DeltaTime, ...) override
    {
        CurrentTime += DeltaTime;

        // Trigger effects at correct times
        while (NextEffectIndex < Track.Effects.Num())
        {
            const FEffectEvent& Effect = Track.Effects[NextEffectIndex];

            if (Effect.Time <= CurrentTime)
            {
                SpawnEffect(Effect);
                NextEffectIndex++;
            }
            else
            {
                break;
            }
        }
    }

private:
    void SpawnEffect(const FEffectEvent& Effect)
    {
        // Spawn VFX at recorded location
        UNiagaraFunctionLibrary::SpawnSystemAtLocation(
            GetWorld(),
            Effect.EffectSystem,
            Effect.Location,
            Effect.Rotation);
    }
};
```

#### Pattern: Interpolated Playback

```cpp
UCLASS()
class UKillcamSmoothDataPlayback : public UActorComponent
{
protected:
    virtual void TickComponent(float DeltaTime, ...) override
    {
        CurrentTime += DeltaTime;

        // Find bracketing samples
        int32 LowerIdx = 0;
        int32 UpperIdx = 0;
        float Alpha = 0.f;

        FindBracketingSamples(CurrentTime, LowerIdx, UpperIdx, Alpha);

        // Interpolate between samples
        const FSmoothSample& Lower = Track.Samples[LowerIdx];
        const FSmoothSample& Upper = Track.Samples[UpperIdx];

        FVector InterpolatedValue = FMath::Lerp(
            Lower.Value,
            Upper.Value,
            Alpha);

        ApplyInterpolatedValue(InterpolatedValue);
    }
};
```

***

### Modifying Camera Behavior

Camera behavior during kill cam is controlled by the **`UKillcamCameraPlayback`** component, which uses the recorded camera state from the killer.

#### How Camera Playback Works

The camera playback component receives recorded data about the killer's camera state (camera mode, ADS status, etc.) and applies it during playback:

```plaintext
CameraPlayback Tick(deltaTime):
    Get current playback time
    Find appropriate camera sample for this time

    If camera mode changed:
        Push/pop camera modes to match killer's state

    If ADS state changed:
        Trigger ADS transition (or exit)

    Apply camera state to view
```

#### Customizing Camera Playback

To modify camera behavior, extend **`UKillcamCameraPlayback`**:

```cpp
UCLASS()
class UMyKillcamCameraPlayback : public UKillcamCameraPlayback
{
    GENERATED_BODY()

public:
    // Override to use your custom camera modes
    virtual TSubclassOf<ULyraCameraMode> GetCameraModeForTag(
        FGameplayTag CameraModeTag) const override;

    // Override to customize ADS behavior
    virtual void HandleADSStateChange(bool bIsADS) override;

protected:
    UPROPERTY(EditDefaultsOnly, Category = "Camera")
    TSubclassOf<ULyraCameraMode> KillcamFirstPersonMode;

    UPROPERTY(EditDefaultsOnly, Category = "Camera")
    TSubclassOf<ULyraCameraMode> KillcamThirdPersonMode;

    UPROPERTY(EditDefaultsOnly, Category = "Camera")
    TSubclassOf<ULyraCameraMode> KillcamADSMode;
};
```

#### Camera Mode Mapping

The camera playback component maps recorded camera mode tags to actual camera modes. Override `GetCameraModeForTag` to use your own camera modes:

```cpp
TSubclassOf<ULyraCameraMode> UMyKillcamCameraPlayback::GetCameraModeForTag(
    FGameplayTag CameraModeTag) const
{
    // Map recorded tags to your custom camera modes
    if (CameraModeTag.MatchesTag(TAG_Camera_FirstPerson))
    {
        return KillcamFirstPersonMode;
    }

    if (CameraModeTag.MatchesTag(TAG_Camera_ThirdPerson))
    {
        return KillcamThirdPersonMode;
    }

    if (CameraModeTag.MatchesTag(TAG_Camera_ADS))
    {
        return KillcamADSMode;
    }

    // Fall back to parent implementation
    return Super::GetCameraModeForTag(CameraModeTag);
}
```

#### Custom ADS Handling

Override ADS behavior to add custom effects like scope overlays:

```cpp
void UMyKillcamCameraPlayback::HandleADSStateChange(bool bIsADS)
{
    Super::HandleADSStateChange(bIsADS);

    // Add custom scope overlay when entering ADS
    if (bIsADS)
    {
        if (APlayerController* PC = GetOwningPlayerController())
        {
            // Show scope overlay widget
            if (ScopeOverlayClass)
            {
                ScopeOverlayWidget = CreateWidget<UUserWidget>(PC, ScopeOverlayClass);
                ScopeOverlayWidget->AddToViewport();
            }
        }
    }
    else
    {
        // Remove scope overlay when exiting ADS
        if (ScopeOverlayWidget)
        {
            ScopeOverlayWidget->RemoveFromParent();
            ScopeOverlayWidget = nullptr;
        }
    }
}
```

***

### What NOT to Modify

> [!DANGER]
> These areas interact with complex engine systems. Modifications here carry high risk of crashes, networking issues, or unpredictable behavior.

#### `UKillcamPlayback` Core Logic

Avoid modifying:

* `KillcamStart_Internal` / `KillcamStop` flow
* World visibility toggling logic
* `UDemoNetDriver` interactions
* Level collection management
* GotoTimeInSeconds handling

#### World Duplication Mechanics

Do not change:

* `ULyraGameEngine::Experimental_ShouldPreDuplicateMap`
* Level collection type handling
* Duplicate world creation/destruction

#### Replay System Internals

Leave these alone:

* `StartRecordingReplay` / `StopRecordingReplay` calls
* `PlayReplay` options (except timing)
* NetGUID preservation logic
* DemoNetDriver assignment to collections

***
