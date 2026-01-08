# Playback Process

Once the player has been eliminated and the necessary information has been cached, the system is ready to play back the killcam sequence. This involves stopping the recording, activating the duplicated world, scrubbing the replay stream to the correct time, switching the player's view, playing the sequence, and then cleanly restoring the original view.

### 1. Triggering Playback

The playback sequence isn't automatic upon death. It needs to be explicitly initiated, usually by game logic that determines _when_ the killcam should be shown (e.g., after a short delay, before the respawn timer starts).

* **Start Message:** The trigger is the `ShooterGame.KillCam.Message.Start` Gameplay Message, broadcast locally on the client of the player who died.
* **Payload (`FLyraKillCamMessage`):** This message carries important timing parameters:
  * `KillCamStartTime`: How many seconds _before_ the recorded death time the playback should begin (e.g., 7.0 seconds).
  * `KillCamFullDuration`: The total duration the killcam playback should last (e.g., 7.0 seconds). This is used by the camera/view target logic.
* **Manager Receives:** `UKillcamManager::OnKillCamStartMessage` receives this message.
* **Initiate Playback:** It updates the timing variables on its `UKillcamPlayback` instance and calls `UKillcamPlayback::KillcamStart`, passing a delegate for completion notification.

### 2. Starting Playback (`KillcamStart` -> `KillcamStart_Internal`)

The `KillcamStart` function queues the core logic (`KillcamStart_Internal`) for the next tick to ensure stability. `KillcamStart_Internal` then orchestrates the setup:

1. **Playback Allowed Check:** Calls `IsPlaybackAllowed()` to verify conditions (not already playing, sufficient recording time exists, correct net mode, duplicate world exists, etc.). Fails early if conditions aren't met.
2. **Cache GUIDs:** Preserves the NetGUIDs of essential actors (like the cached killer and victim) that shouldn't be pruned during scrubbing.
3. **Stop Recording:** Calls `GameInstance->StopRecordingReplay()` to finalize the current recording segment. The in-memory buffer now holds the complete history needed for playback.
4. **Mark as Playing:** Sets `bIsPlaying = true`.
5. **Activate Duplicate World:**
   * Finds the `DynamicDuplicatedLevels` collection.
   * Sets this collection to be visible (`DuplicateCollection->SetIsVisible(true)`).
   * Ensures the levels within the collection are properly added to the world.
6. **Start Replay Playback:** Calls `GameInstance->PlayReplay()`:
   * Specifies the same replay name used for recording (`_Deathcam_...`).
   * Passes options: `ReplayStreamerOverride=InMemoryNetworkReplayStreaming` and crucially `LevelPrefixOverride=1`. This tells the replay system to _re-use the existing duplicated levels_ instead of trying to load new ones from disk.
   * Registers `OnPostLoadMap` handler (to pause ticking initially).
7. **Assign DemoNetDriver:** Associates the newly created playback `UDemoNetDriver` with the duplicated level collection.
8. **Initiate Scrub:** Calls `KillcamGoToTime` to jump to the desired starting point in the replay stream.

### 3. Finding the Moment (`KillcamGoToTime` & `OnKillcamInitialGoToTimeComplete`)

Simply starting playback isn't enough; it needs to begin shortly _before_ the moment of death.

* **Calculate Start Time:** `CachedGoToTimeSeconds = CachedHeroDeathDemoTime - KillCamStartTime`. This uses the death timestamp cached earlier and the lookback time from the start message.
* **`KillcamGoToTime`:**
  * Retrieves the playback `UDemoNetDriver`.
  * Adds the essential cached NetGUIDs (killer, victim) to a non-queued list to prevent associated actors from being destroyed during the scrub.
  * Calls `PlaybackDemoNetDriver->GotoTimeInSeconds(CachedGoToTimeSeconds, InOnGotoTimeDelegate)`. This is an asynchronous operation where the replay system processes the stream up to the target time.
* **`OnKillcamInitialGoToTimeComplete`:** This delegate is called when `GotoTimeInSeconds` finishes.
  * **Success:** If successful, it means the replay stream is now positioned correctly. It proceeds by calling `ShowKillcamToUser` to switch the player's view.
  * **Failure:** If `GotoTimeInSeconds` fails (e.g., target time is invalid), it logs an error, stops the demo playback (`PlaybackDemoNetDriver->StopDemo()`), and notifies the `KillcamStart` caller of the failure.

### 4. Switching the View (`ShowKillcamToUser` -> `ShowKillcamToUser_Internal`)

Once the replay is at the correct time, the player's view needs to switch from the live world to the killcam world.

1. **Queue Task:** `ShowKillcamToUser` queues `ShowKillcamToUser_Internal` for the next tick.
2. **Hide Source World:** Sets the `DynamicSourceLevels` collection `IsVisible` to `false`. This involves marking components dirty to ensure rendering updates.
3. **Enable Collision Handling:** Calls `IgnoreCollisionsBetweenCollections()` and `StartTrackingDynamicActors()` to set up rules preventing actors in the now-visible duplicate world from interfering with actors in the now-hidden source world (See "Handling World Interactions" page).
4. **Set View Target:** Calls `SetViewTargetToKillingActor()`. This initiates the process of finding the killer's and victim's actors in the _duplicated_ world using their cached NetGUIDs.
   * **Actor Availability Check:** Uses a timer (`StartActorAvailabilityCheck`, `CheckActorAvailability`) to periodically check if both actors have been replicated and spawned in the duplicated world by the replay system. This handles potential delays in actor replication during playback.
   * **Proceed:** Once both actors are found (`ProceedWithKillcam`), it sends the `TAG_GameplayEvent_Killcam` event with the killer and victim actors (now resolved in the duplicate world) and the `KillCamFullDuration` as payload. This event is typically handled by a Gameplay Ability on the Player Controller to actually switch the camera's view target and potentially apply specific camera modes.
5. **Notify Completion:** Calls the `StartCompleteDelegate` passed from `KillcamStart` to signal that the killcam view is now active.

### 5. Ending Playback (`KillcamStop` -> `HideKillcamFromUser` -> `HideKillcamFromUser_Internal`)

Playback ends either when the specified duration expires (handled by external logic sending the stop message) or potentially if interrupted.

1. **Stop Message:** Game logic sends the `ShooterGame.KillCam.Message.Stop` message locally.
2. **Manager Receives:** `UKillcamManager::OnKillCamEndMessage` calls `UKillcamPlayback::KillcamStop`.
3. **Hide View:** `KillcamStop` queues `HideKillcamFromUser`, which in turn queues `HideKillcamFromUser_Internal`.
4. **`HideKillcamFromUser_Internal`:** This function performs the extensive cleanup and restoration:
   * **Clean Up Replay Actors:** Destroys non-startup actors within the duplicated levels. It carefully nulls references in the `DemoNetDriver`'s channels for startup actors to prevent them from being destroyed.
   * **Destroy Replay Driver:** Calls `SourceWorld->DestroyDemoNetDriver()` and marks the driver, its connection, and package map for garbage collection.
   * **Hide Duplicate World:** Sets the `DynamicDuplicatedLevels` collection `IsVisible` to `false`.
   * **Stop Collision Handling:** Calls `StopTrackingDynamicActors()` and clears the tracked actor lists.
   * **Show Source World:** Sets the `DynamicSourceLevels` collection `IsVisible` to `true` and marks components dirty.
   * **Remove Duplicate Levels:** Removes the duplicated levels from the world (`SourceWorld->RemoveFromWorld(DupLevel)`).
   * **Optional Garbage Collection:** Triggers `CollectGarbage` if `CVarKillcamGarbageCollectOnExit` is enabled.
   * **Mark as Stopped:** Sets `bIsPlaying = false`, `bIsEnabled = false`.
   * **Notify Completion:** Calls the `StopCompleteDelegate` passed from `KillcamStop`.
   * **Restore View Target:** External logic (e.g., the respawn process) is now responsible for setting the player's view target back to their newly spawned pawn or appropriate viewpoint in the source world.

### 6. Restarting Recording

After `KillcamStop` completes successfully, the `UKillcamManager::OnKillCamEndMessage` function makes one final call: `StartRecordingKillCam()`. This re-runs the `SetUpKillcam` logic, initiating a new replay recording session immediately, preparing the system for the player's next life and potential death.

This intricate process of stopping, duplicating, scrubbing, viewing, and restoring allows the killcam to function within its isolated environment while ensuring a relatively seamless transition back to the live game for the player.

***
