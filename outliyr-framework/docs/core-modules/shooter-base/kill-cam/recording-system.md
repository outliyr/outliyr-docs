# Recording System

The Kill Cam needs data to play back. This page explains how the system continuously captures gameplay data so it's ready when a player dies.

### The Continuous Recording Philosophy

The Kill Cam doesn't wait for death to start recording, it records **continuously** on every client. This proactive approach ensures:

* **Instant Availability**: When death occurs, all needed data already exists
* **No Prediction Required**: No need to guess who might die
* **Complete Context**: The full lead-up to death is captured, not just the final moment

Each player's client records **their own** perspective data. When they get a kill, this pre-recorded data is transferred to the victim.

### Two Types of Recording

The system captures two distinct types of data:

#### World State Recording (Replay System)

The engine's built-in replay system continuously records the game world:

```cpp
// Initiated by UKillcamPlayback::SetUpKillcam_Internal
const FString KillCamReplayName = FString::Printf(
    TEXT("_Deathcam_%d"),
    FPlatformProcess::GetCurrentProcessId());

TArray<FString> AdditionalOptions;
AdditionalOptions.Add(TEXT("ReplayStreamerOverride=InMemoryNetworkReplayStreaming"));
AdditionalOptions.Add(TEXT("SkipSpawnSpectatorController"));

GameInstance->StartRecordingReplay(KillCamReplayName, KillCamReplayName, AdditionalOptions);
```

This captures:

* Actor positions and rotations
* Animation states
* Replicated properties
* Network events and RPCs

The `InMemoryNetworkReplayStreaming` option stores data in RAM for instant access, no disk I/O delays.

#### Overlay Data Recording (Recorder Components)

Custom components capture perspective-specific data that the replay system doesn't handle well:

| Data Type         | Why It's Needed                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **Aim Direction** | Replicated aim of other clients is interpolated/smoothed; we want exact crosshair position |
| **Hit Markers**   | These are visual feedback, not replicated game state                                       |
| **Camera Mode**   | ADS transitions, camera changes are local hence are not captured by replay                 |

***

### Recorder Components

Three components run on each player's controller, continuously buffering the last \~15 seconds of data.

#### `UKillcamAimRecorder`

**Purpose**: Captures the player's exact view direction and location at high frequency.

**Configuration**:

```cpp
// Configurable properties
UPROPERTY(EditDefaultsOnly, Category="Killcam")
float MaxRecordLengthSeconds = 15.f;  // How far back to keep

UPROPERTY(EditDefaultsOnly, Category="Killcam")
float MaxSampleRateHz = 60.f;  // Maximum samples per second
```

**What It Captures**:

```cpp
USTRUCT()
struct FKillcamAimSampleRaw
{
    float ServerTime;      // Timestamp for synchronization
    FRotator ViewRotation; // Exact view direction (Pitch, Yaw, Roll)
    FVector ViewLocation;  // Camera world position
};
```

Recording behavior:

* Samples every tick, up to `MaxSampleRateHz` limit
* Ring buffer discards samples older than `MaxRecordLengthSeconds`
* Uses server time for cross-client synchronization

Why 60Hz?

* Smooth interpolation during playback while keeping memory usage reasonable. At 60Hz with 15 seconds of buffer:
  * \~900 samples per player
  * Each sample: \~28 bytes (time + rotation + location)
  * Total: \~25KB per player

#### `UKillcamHitMarkerRecorder`

**Purpose**: Captures hit marker events for visual feedback during playback.

**Configuration**:

```cpp
UPROPERTY(EditDefaultsOnly, Category="Killcam")
float MaxRecordLengthSeconds = 15.f;
```

**What It Captures**:

```cpp
USTRUCT()
struct FKillcamHitMarkerSampleRaw
{
    float ServerTime;       // When the hit occurred
    FVector WorldLocation;  // Where in the world the hit landed
    FGameplayTag HitZone;   // What part was hit (head, body, limb)
    bool bShowAsSuccess;    // Was it a successful/damaging hit
};
```

Recording behavior:

* Event-based, not continuous sampling
* Listens for hit marker gameplay messages
* Only records when hits actually occur
* Trims old samples beyond `MaxRecordLengthSeconds`

Example pseudocode:

```cpp
void UKillcamHitMarkerRecorder::OnHitMarkerMessage(
    FGameplayTag Channel,
    const FHitMarkerMessage& Message)
{
    // Extract data and add sample
    AddHitSample(ServerTime, WorldLocation, HitZone, bShowAsSuccess);
}
```

Memory efficiency: Since hits are event-based (not every frame), typical buffer size is much smaller than aim data.

### `UKillcamCameraRecorder`

**Purpose**: Captures camera mode changes and ADS (Aim Down Sights) state.

**Configuration**:

```cpp
UPROPERTY(EditDefaultsOnly, Category="Killcam")
float MaxRecordLengthSeconds = 15.f;
```

**What It Captures**:

```cpp
USTRUCT()
struct FKillcamCameraEventRaw
{
    float ServerTime;                        // When the change occurred
    TSubclassOf<ULyraCameraMode> CameraMode; // The camera mode class
    bool bIsADS;                             // Aim down sights state
};
```

Recording behavior:

* State-change based, not continuous
* Listens for camera mode change messages
* Listens for ADS toggle messages
* Only records when state actually changes (compression)

Example pseudocode:

```cpp
void UKillcamCameraRecorder::OnCameraModeChanged(
    FGameplayTag Channel,
    const FLyraCameraModeChangedMessage& Message)
{
    if (Message.CameraMode != CurrentCameraMode)
    {
        CurrentCameraMode = Message.CameraMode;
        RecordEvent(ServerTime, CurrentCameraMode, bCurrentADS);
    }
}

void UKillcamCameraRecorder::OnADSChanged(
    FGameplayTag Channel,
    const FGameplayADSMessage& Message)
{
    if (Message.bIsADS != bCurrentADS)
    {
        bCurrentADS = Message.bIsADS;
        RecordEvent(ServerTime, CurrentCameraMode, bCurrentADS);
    }
}
```

Memory efficiency: Only state changes are recorded, so typical buffer contains very few entries.

***

## Replay System Recording

### When Recording Starts

Recording begins when the Lyra Experience loads:

```
OnExperienceLoaded
    └── UKillcamManager::OnExperienceLoaded
        └── UKillcamPlayback::SetUpKillcam
            └── SetUpKillcam_Internal (queued for next tick)
                └── GameInstance->StartRecordingReplay(...)
```

The next-tick deferral prevents issues with starting replay during sensitive engine initialization phases.

### In-Memory Streaming

Unlike disk-based replays, kill cam uses `InMemoryNetworkReplayStreaming`:

| Aspect          | In-Memory             | Disk-Based            |
| --------------- | --------------------- | --------------------- |
| **Speed**       | Instant access        | Disk I/O latency      |
| **Capacity**    | Limited by RAM        | Limited by disk space |
| **Persistence** | Lost on exit          | Survives restarts     |
| **Use Case**    | Short, recent history | Full match recordings |

### Buffer Configuration

Several CVars control replay recording:

```cpp
extern TAutoConsoleVariable<float> CVarKillcamMaxDesiredRecordTimeMS;
extern TAutoConsoleVariable<float> CVarKillcamBufferTimeInSeconds;
```

The `BufferTimeInSeconds` directly controls how much history the in-memory streamer keeps. Once the buffer is full, older data is discarded.

***

### Caching Death Information

When a player dies, critical information must be captured **immediately**, before the dying player's pawn is destroyed or unpossessed.

### Why Immediate Caching?

After death:

* The pawn may be destroyed
* The PlayerState reference may become invalid
* The controller may unpossess
* Direct actor pointers become unreliable

The solution: cache **NetGUIDs** instead of actor pointers. NetGUIDs remain valid for identifying actors during replay playback.

### What Gets Cached

```cpp
void UKillcamPlayback::OnLocalHeroDeath(
    const APlayerState* DyingPlayer,
    const APlayerState* KillingPlayer)
{
    if (UDemoNetDriver* DemoDriver = CachedSourceWorld->GetDemoNetDriver())
    {
        // NetGUID of the victim (for identifying in replay)
        CachedFocusActorGUID = DemoDriver->GetGUIDForActor(DyingPlayer);

        // Exact replay time when death occurred
        CachedHeroDeathDemoTime = DemoDriver->GetDemoCurrentTime();

        // NetGUID of the killer (camera will follow this actor)
        CachedKillingActorGUID = DemoDriver->GetGUIDForActor(KillingPlayer);

        // World time for cooldown logic
        CachedHeroDeathClientWorldTime = CachedSourceWorld->GetTimeSeconds();
    }
}
```

| Cached Value                     | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `CachedFocusActorGUID`           | Identifies victim in the duplicate world           |
| `CachedKillingActorGUID`         | Identifies killer for camera targeting             |
| `CachedHeroDeathDemoTime`        | Anchor point for calculating playback start time   |
| `CachedHeroDeathClientWorldTime` | Prevents starting playback too quickly after death |

### Trigger Flow

```
Elimination Message Broadcast
    │
    ├── Server: UKillcamEventRelay::OnEliminationMessage
    │   └── Initiates data transfer (see Data Transfer page)
    │
    └── Client (Victim): UKillcamManager::OnEliminationMessage
        └── Checks if this is the local player
            └── UKillcamPlayback::OnLocalHeroDeath
                └── Caches NetGUIDs and timing
```

***

### Network Data Structures

The recorder components store data in "Raw" format optimized for local storage. Before network transfer, data is converted to "Net" format optimized for bandwidth.

#### Raw vs Net Formats

Aim Data Example:

```cpp
// Raw format (local storage) - Full precision
struct FKillcamAimSampleRaw
{
    float ServerTime;        // 4 bytes
    FRotator ViewRotation;   // 12 bytes (3 floats)
    FVector ViewLocation;    // 12 bytes (3 floats)
};                           // Total: 28 bytes

// Net format (network transfer) - Compressed
struct FKillcamAimSampleNet
{
    int16 TimeOffsetShort;           // 2 bytes (normalized offset)
    uint16 PitchShort;               // 2 bytes (compressed angle)
    uint16 YawShort;                 // 2 bytes (compressed angle)
    uint16 RollShort;                // 2 bytes (compressed angle)
    FVector_NetQuantize10 ViewLocation; // Quantized location
};
```

Compression techniques:

* Time stored as offset from death time, normalized to int16
* Rotation uses Unreal's `CompressAxisToShort` (16-bit angle compression)
* Location uses `FVector_NetQuantize10` (1 decimal precision)

#### Conversion Functions

```plaintext
Conversion functions (in KillcamAimTypes namespace):

BuildNetTrackFromRaw(RawTrack, MaxRecordLength):
    Compress timestamps to normalized int16 offsets
    Compress rotations using 16-bit angle compression
    Quantize locations for network efficiency
    Return network-optimized track

BuildRawTrackFromNet(NetTrack):
    Decompress timestamps back to float seconds
    Decompress rotations to full FRotator precision
    Restore full location precision
    Return raw track for local use
```

***

### Memory Considerations

#### Per-Player Memory Usage

| Component           | Typical Buffer Size                |
| ------------------- | ---------------------------------- |
| Aim Recorder        | \~25KB (900 samples × 28 bytes)    |
| Hit Marker Recorder | \~1-5KB (depends on hit frequency) |
| Camera Recorder     | <1KB (state changes only)          |
| Replay Buffer       | Configurable via CVars             |

#### Scaling

For a 64-player server, each player records their own data locally, the server doesn't store any of this. Memory impact is per-client, not centralized.
