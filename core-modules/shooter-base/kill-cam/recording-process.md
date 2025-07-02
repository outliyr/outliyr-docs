# Recording Process

Before a killcam can be played back, the necessary gameplay data must first be captured. The Shooter Base Killcam system utilizes Unreal Engine's built-in **Replay System** to continuously record a short history of the local player's gameplay session on the client.

### Initiation: Starting the Recorder

The recording process doesn't wait for a death; it begins proactively shortly after the player joins the game and the relevant Lyra Experience is loaded.

1. **Experience Loaded:** The `UKillcamManager` component on the Player Controller listens for the `OnExperienceLoaded` event from the `ULyraExperienceManagerComponent`.
2. **Setup Call:** Once the experience is ready, `UKillcamManager::OnExperienceLoaded` triggers `UKillcamPlayback::SetUpKillcam`.
3. **Deferred Setup:** `SetUpKillcam` queues the actual setup work (`SetUpKillcam_Internal`) for the next game tick using `QueueTaskForNextTick`. This avoids potential issues with starting replay recording during sensitive engine initialization phases.
4. **`SetUpKillcam_Internal`:** This function performs the core setup:
   * It checks necessary conditions (client net mode, not PIE, not already recording/playing).
   * Crucially, it calls `UGameInstance::StartRecordingReplay`.

```cpp
// Inside UKillcamPlayback::SetUpKillcam_Internal
// ... checks ...
const FString KillCamReplayName = FString::Printf(TEXT("_Deathcam_%d"), FPlatformProcess::GetCurrentProcessId());
TArray<FString> AdditionalOptions;
AdditionalOptions.Add(TEXT("ReplayStreamerOverride=InMemoryNetworkReplayStreaming"));
AdditionalOptions.Add(TEXT("SkipSpawnSpectatorController")); // We manage the view manually
GameInstance->StartRecordingReplay(KillCamReplayName, KillCamReplayName, AdditionalOptions);
// ... configure DemoNetDriver settings ...
```

This initiates the replay recording process managed by a `UDemoNetDriver` instance associated with the source world collection.

### Core Mechanism: Unreal Replay System & `UDemoNetDriver`

The system leverages the engine's powerful replay functionality, typically used for full match replays or spectator features.

* **`UDemoNetDriver`:** When `StartRecordingReplay` is called, the engine creates a special type of Net Driver (`UDemoNetDriver`) that, instead of sending network packets, records replicated actor data, RPCs, and other relevant network events over time.
* **Client-Side Recording:** For the killcam, this recording happens entirely on the client that will potentially view the killcam. It records the data _that client_ is receiving from the server.

### Streaming Method: `InMemoryNetworkReplayStreaming`

Unlike typical replays that save data to disk, the killcam uses a specific, efficient streaming implementation:

* **`ReplayStreamerOverride=InMemoryNetworkReplayStreaming`:** This option passed to `StartRecordingReplay` tells the `UDemoNetDriver` to use a streamer that stores the recorded replay data directly in RAM.
* **Benefits:**
  * **Speed:** Extremely fast, as there's no disk I/O involved for recording or playback scrubbing. Ideal for the near-instant access needed for a killcam.
  * **Simplicity:** No replay files to manage on disk.
* **Limitation:** The amount of history that can be stored is limited by available system memory and the buffer settings. Once the buffer is full, older data is discarded.

### Configuration: Controlling the Recording

Several settings, primarily configured within `SetUpKillcam_Internal` via Console Variables (CVars), control how the replay is recorded:

* **`CVarKillcamMaxDesiredRecordTimeMS` (`demo.RecordHz` equivalent for time):** While `UDemoNetDriver` has `MaxDesiredRecordTimeMS`, this CVar likely influences how much time the driver aims to keep buffered. It sets the target duration of gameplay history to maintain.
* **`CVarKillcamBufferTimeInSeconds` (`ReplayStreamer->SetTimeBufferHintSeconds`):** This directly tells the `InMemoryNetworkReplayStreaming` implementation how many seconds of data it should aim to keep buffered in memory. This is a primary control over memory usage and the maximum possible lookback time.
* **`CheckpointSaveMaxMSPerFrame`:** Limits the time spent saving replay checkpoints per frame to manage performance impact.
* **`ActorPrioritizationEnabled`, `ViewerOverride`:** These settings help focus the recording effort on actors relevant to the local player's perspective, potentially optimizing the recorded data.

These settings allow tuning the trade-off between the length of the recorded history, memory consumption, and performance overhead of recording.

### Critical Step: Caching Death Information (`OnLocalHeroDeath`)

Perhaps the most crucial part of the recording phase happens _reactively_ when the player dies. Because the state needed for playback (who killed whom, when) might change rapidly or become invalid after death, this information **must be captured immediately**.

1. **Elimination Message:** `UKillcamManager` listens for the `Lyra.Elimination.Message`.
2. **Identify Local Death:** It checks if the `Payload.Target` of the message matches the local player's `PlayerState`.
3. **Trigger Cache:** If it's the local player who died, it calls `UKillcamPlayback::OnLocalHeroDeath`, passing the `PlayerState` of the victim (`DyingPlayer`) and the instigator (`KillingPlayer`).

Inside `UKillcamPlayback::OnLocalHeroDeath`:

```cpp
// Simplified from UKillcamPlayback::OnLocalHeroDeath
if (CachedSourceWorld->GetDemoNetDriver()) // Check if recording is active
{
    // Get NetGUID for the player who died (will be the focus/view target initially)
    CachedFocusActorGUID = CachedSourceWorld->GetDemoNetDriver()->GetGUIDForActor(DyingPlayer);

    // Get the precise Demo Time when the death occurred
    CachedHeroDeathDemoTime = CachedSourceWorld->GetDemoNetDriver()->GetDemoCurrentTime();

    // Get NetGUID for the player who got the kill (camera will likely follow this actor)
    CachedKillingActorGUID = CachedSourceWorld->GetDemoNetDriver()->GetGUIDForActor(KillingPlayer);

    // Also cache World Time for potential cooldown logic (not shown in snippet)
    CachedHeroDeathClientWorldTime = CachedSourceWorld->GetTimeSeconds();
}
```

* **Why Cache?**
  * **PlayerState/Pawn Validity:** After death, the player's pawn might be destroyed, unpossessed, or reused. Trying to get this information later during playback setup might fail.
  * **NetGUID Stability:** Network GUIDs assigned by the `DemoNetDriver` provide a reliable way to identify the _same_ actor instance later during playback, even if the direct `AActor` pointer becomes invalid or points to a different instance in the duplicated world.
  * **Precise Timing:** `GetDemoCurrentTime()` captures the exact moment within the replay stream when the death event was processed.
* **What's Cached:**
  * `CachedFocusActorGUID`: The network ID of the player who died. Used to potentially orient the initial playback view or identify the player's perspective.
  * `CachedKillingActorGUID`: The network ID of the player who performed the kill. This is typically the actor the camera will follow during the killcam.
  * `CachedHeroDeathDemoTime`: The timestamp within the replay stream corresponding to the death event. This is the anchor point used to calculate the playback start time (`DeathTime - LookbackDuration`).

This immediate caching upon receiving the elimination message ensures that all necessary information is preserved and available when the playback process is initiated later. Without this step, reliably setting up the correct context for the killcam playback would be nearly impossible.

***
