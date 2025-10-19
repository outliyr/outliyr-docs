# Teammate Spectator

`ATeammateSpectator` is the specialized pawn class (`ASpectatorPawn` subclass) that a player's controller possesses or is the view target when they enter spectating mode (either live teammate spectating or during killcam playback). It acts as the spectator's presence in the world, responsible for managing the camera view and selecting which player to observe.

***

### Role and Purpose

* **Spectator Vessel:** Provides the Actor context for the spectator's controller in the world.
* **Camera Host:** Contains a `ULyraCameraComponent` used to render the view for the spectator.
* **View Mimicking:** Configures its camera component to match the state (location, rotation, camera mode) of the currently observed player's pawn.
* **Target Management:** Handles the logic for selecting and cycling through available spectating targets (primarily living teammates).
* **State Communication:** Broadcasts messages about possession state and changes in the observed player.

***

### Key Responsibilities

`ATeammateSpectator` handles:

* Spawning and possession logic
* Tracking and switching between valid teammates
* Attaching its camera to the observed player’s pawn
* Notifying the UI system of changes (e.g., which player is being observed)
* Maintaining awareness of team structure and player states
* Responding to elimination events, allowing fallback logic (e.g., switch to killer)

***

### Key Features and Logic

1. **Camera System (`ULyraCameraComponent`)**
   * **Instance:** Contains its own instance of [`ULyraCameraComponent`](../../../../base-lyra-modified/camera/camera-component.md).
   * **Target Actor:** The spectator's camera component's `TargetActor` is dynamically set to the pawn of the currently observed player (`AttachToObservedPawn`). This allows the camera modes applied within the spectator's camera component to correctly calculate offsets relative to the observed pawn.
   * **Mode Determination (`DetermineCameraMode`):** This function is bound to the camera component's `DetermineCameraModeDelegate`. It returns the appropriate `TSubclassOf<ULyraCameraMode>` to use.
     * It checks the internal `CurrentCameraMode` variable (which is updated via messages based on replicated data from the observed player - see `OnCameraChangeMessage`).
     * If `CurrentCameraMode` is valid, it returns that class.
     * Otherwise, it falls back to the `DefaultCameraMode` property (useful for initial state or if the observed player has no specific mode active, or potentially for observing AI without full camera state replication).
   * **Mode Updates (`OnCameraChangeMessage`):** Listens for the local `ShooterGame.Spectator.Message.CameraModeChanged` message (broadcast by `USpectatorDataContainer`'s `OnRep_CameraMode`). When received and the message owner matches the currently spectated player, it updates the internal `CurrentCameraMode` variable. This change is then picked up by `DetermineCameraMode` on the next camera update cycle.
2. **Target Management (Live Spectating)**
   * **Populating the List (`PopulatePlayerTeam`):** Called (usually by `GA_Spectate`) to find all `APlayerState` objects belonging to a specific `TeamId` (excluding the spectator themselves) and store them in the `PlayerTeam` array.
   * **Cycling Targets (`WatchNextPawn`, `WatchPreviousPawn`):** These functions handle the input-driven cycling (triggered by GA_Spectate_Next/Previous). They increment/decrement the `CurrentObservablePawnIndex`, wrap around the `PlayerTeam` array, and critically, **skip** any player states that are not currently considered "alive" (`IsPlayerStateAlive` check) or match an optional `IgnorePlayer`.
   * **Selecting a Target (`SetObservedPawn`):** Updates the `CurrentObservablePawnIndex`, calls `AttachToObservedPawn` to update the camera target and tick prerequisites, and broadcasts the `SpectatingPlayerChanged` message.
   * **Handling Eliminations (`HandleElimination`, `OnEliminationMessage`):** Listens for the `Lyra.Elimination.Message`. If the currently observed player (`PlayerTeam[CurrentObservablePawnIndex]`) is the one eliminated (`Payload.Target`), it automatically attempts to `WatchNextPawn` (ignoring the just-killed player). If no living teammates are found (`WatchNextPawn` returns false), it can optionally switch to spectating the killer's team.
3. **Target Management (Killcam)**
   * **`SpectatePlayerState` Function:** This function is called specifically by the killcam logic (`GA_Killcam_Camera`). It bypasses the team population and cycling logic. It clears the `PlayerTeam` array, adds only the provided `ObservePlayerState(the killer)`, sets the index to 0, attaches the camera, and broadcasts the change.
4. **State & Initialization**
   * **Possession (`PossessedBy`, `OnRep_Controller`):** When possessed by a controller (server-side, or via `OnRep_Controller` on clients), it initializes references (`OwningController`, `LyraPlayerState`), handles `PawnExtComponent` updates, sets the initial view target to itself temporarily (standard spectator behavior, often quickly overridden), sets up message listeners (`ListenForChanges`), and broadcasts the Possessed message.
   * **Unpossession (`UnPossessed`):** Cleans up, broadcasts the Possessed (false) message, disables ticking, broadcasts `SpectatingPlayerChanged(nullptr)`.
   * **Client-Side Killcam Init (`SpawnedOnClient`):** Called instead of `PossessedBy` when the spectator is spawned locally for the killcam. Performs essential client-side setup (setting controller/playerstate refs, broadcasting Possessed message, setting up camera delegate, listening for camera change messages).
   * **Client-Side Killcam Cleanup (`FinishSpectatingOnClient`):** Called when killcam ends to perform necessary cleanup on the client-spawned spectator.
5. **Synchronization (`AttachToObservedPawn`)**
   * Sets the `ULyraCameraComponent`'s `TargetActor` to the observed pawn.
   * Crucially, it sets up a **Tick Prerequisite**. It finds the observed pawn's `USkeletalMeshComponent` (or another relevant component) and makes the `ATeammateSpectator` tick after that component ticks (`AddTickPrerequisiteComponent`). This helps ensure the spectator's camera updates after the observed pawn has moved for the frame, reducing visual lag or jitter between the spectated character and the camera's follow motion. It also removes the prerequisite from the previously observed pawn.
6. **Messaging (`Broadcast... functions`)**
   * **`BroadcastSpectatorPawnPossessed`:** Sends `ShooterGame.Spectator.Message.Possessed` locally when possessed/unpossessed. UI or other systems can listen to know when spectating starts/stops.
   * **`BroadcastSpectatingPlayerChanged`:** Sends `ShooterGame.Spectator.Message.SpectatePlayerChanged` locally when the observed player changes (via cycling or initial setup). Passes the new APlayerState. UI uses this to know whose data to display.
7. **Ability System Interface**
   * Implements `IAbilitySystemInterface` to reference the LyraPlayerState's AbilitySystemComponent. It also uses `ULyraPawnExtensionComponent` to initialize itself for the ASC. This ensures the target cycling abilities can find the avatar (pawn) when the abilities are being activated.

### Summary

`ATeammateSpectator` acts as the spectator's mobile camera platform. It intelligently manages which player to follow, synchronizes its position and camera state based on replicated data received indirectly via Gameplay Messages, and communicates its own state changes to other local systems like the UI. Its integration with `ULyraCameraComponent` is key to achieving the seamless mimicking of the spectated player's view modes.
