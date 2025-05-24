# Killcam Spectating

Killcam spectating provides the player with a replay of their death from the perspective of the player who eliminated them. Unlike live spectating, this process is largely initiated and managed **on the client** within the special **duplicated world** created by the [Killcam system](../../kill-cam/). It uses the `GA_Killcam_Camera` Gameplay Ability.

### Context and Trigger

* **Context:** Client-Side, within the Duplicated World. The logic executes on the local client that is viewing the killcam.
* **Trigger:** This ability is granted to the `ALyraPlayerState`. It is activated **indirectly** by the Killcam system itself.
  1. The `UKillcamPlayback` component prepares the replay stream and switches the view to the duplicated world.
  2. Once the killer and victim actors are resolved within the duplicated world's replay context, `UKillcamPlayback::ProceedWithKillcam` sends a **Gameplay Event** tagged `TAG_GameplayEvent_Killcam` (`GameplayEvent.Killcam`) to the local player's Ability System Component.
  3. The `GA_Killcam_Camera` ability is configured to be triggered by this specific Gameplay Event tag.

### Execution Flow (`GA_Killcam_Camera` Activation - Client)

When `GA_Killcam_Camera` activates on the client in response to the `GameplayEvent.Killcam`:

1. **Receive Event Data:** The ability receives the `FGameplayEventData` which contains:
   * Instigator: The `AActor` representing the **victim** (the local player) within the duplicated world context.
   * Target: The `AActor` representing the **killer** within the duplicated world context.
   * EventMagnitude: The intended duration of the killcam playback (`KillCamFullDuration`).
2.  **Spawn Spectator Pawn Locally:** Unlike `GA_Spectate`, this ability spawns an instance of `ATeammateSpectator` **locally** on the client. No pawn is spawned or possessed on the server for this.

    ```cpp
    // Conceptual logic within GA_Killcam_Camera ActivateAbility
    AActor* KillerActor = EventData->Target;
    APlayerState* KillerPlayerState = Cast<APlayerPawn>(KillerActor)->GetPlayerState(); // Get PS from Pawn

    // Spawn ATeammateSpectator locally
    ATeammateSpectator* SpectatorPawn = GetWorld()->SpawnActor<ATeammateSpectator>(...);

    if (SpectatorPawn)
    {
        // Possess locally? Or just manage view directly?
        // Lyra likely uses SetViewTargetWithBlend directly on PlayerController targeting the SpectatorPawn
        GetActorInfo()->PlayerController->SetViewTargetWithBlend(SpectatorPawn, ...);

        // Perform client-side initialization
        SpectatorPawn->SpawnedOnClient(GetActorInfo()->PlayerController);

        // Tell the spectator pawn who to watch (only the killer)
        SpectatorPawn->SpectatePlayerState(KillerPlayerState);

        // ... potentially start timers or other killcam specific logic ...
    }
    ```

    **Note:** Direct local possession is not possible without the server; the player controller just sets its view target directly to the locally spawned spectator pawn.
3. **Client-Side Initialization:** The ability calls `SpectatorPawn->SpawnedOnClient()`. This function performs necessary setup on the spectator pawn instance that doesn't rely on server replication (like setting controller references, broadcasting initial possession message locally, setting up camera delegates, listening for local camera change messages).
4. **Set Fixed Target:** It calls `SpectatorPawn->SpectatePlayerState(KillerPlayerState)`. This configures the spectator pawn to only observe the killer's state. The `PlayerTeam` array inside the spectator pawn will contain just the killer's `PlayerState`. Target cycling logic (WatchNextPawn/Previous) is not used in this context.
5. **Camera Mimicking:** The `ATeammateSpectator's ULyraCameraComponent` will attempt to mimic the camera mode based on the state of the killer's replayed pawn within the duplicated world, using the logic described in the `ATeammateSpectator` component details. However, the `CurrentCameraMode` variable used for this might primarily update based on replicated data received via the subscription requested in step 5 if the replay stream itself doesn't perfectly replicate the camera mode class changes. There's a close interplay here between the visual replay and the replicated live data.

### Ending Killcam Spectating

[The lifecycle of the kill cam can be found in a separate page in the documentation](../../kill-cam/), here we will specifically focus on ending the killcam spectating and not the other details of the kill cam.

1. A timer started by `GA_Killcam_Camera` using `EventMagnitude` expires , OR the player activates the `GA_Skip_Killcam` ability.
2. The `GA_killcam_Camera` ability ends, this calls `FinishSpectatingOnClient` on the locally spawned `ATeammateSpectator`.
3. The player controller's view target is set back to their respawned pawn or another appropriate target by the game mode/respawn logic.

### Data Flow & Limitations (Killcam Spectating)

* **Primary Data Source:** The **pre-recorded replay stream** captured by the `DemoNetDriver` before the player's death.
* **Visuals/Movement:** Directly driven by the replayed actor transforms within the duplicated world.
* **Camera Mode/ADS State Mimicking:** Dependent on whether this state information was successfully **replicated** to the client during the recording phase and thus captured by the `DemoNetDriver`.
  * If the `USpectatorDataContainer` (holding CameraMode, ToggleADS) **was not** replicating to the client while recording (because they weren't spectating the killer pre-death), this information **will not be available** in the replay data.
  * In this default scenario, the spectator camera might only mimic basic view rotation or fall back to default modes. Achieving perfect camera mode/ADS state mirroring during killcam would require changes to replicate the container more broadly or implement predictive pre-death subscription.
* **UI Mimicking (Quickbar/Ammo/etc.):** Similarly dependent on pre-recorded data.
  * Since `QuickBarSlots` (containing `ULyraInventoryItemInstance` pointers) and their associated `SpareAmmo` stat tags are typically replicated only to subscribed spectators via the `USpectatorDataProxy` filtering, this information **is generally NOT recorded** for the killer by the client before death.
  * Therefore, **full UI mimicking (showing the killer's exact quickbar, ammo, etc.) is NOT the default behavior during killcam playback.** The killcam UI typically shows different information related to the death event itself rather than attempting to replicate the killer's live HUD.

### Summary

Killcam spectating, managed by `GA_Killcam_Camera`, is a client-centric process operating within the duplicated replay world. It spawns the `ATeammateSpectator` locally and sets it to observe the killer's replayed actions. While visuals are primarily replay-driven, it crucially requests a subscription to the live killer's data proxy on the server to receive accurate replicated state (especially Quickbar items and ammo counts) needed for the immersive UI elements. Stopping the killcam is handled by external logic triggering the Stop message and subsequent cleanup by the `UKillcamPlayback` system.
