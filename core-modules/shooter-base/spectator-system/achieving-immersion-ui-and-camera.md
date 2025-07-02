# Achieving Immersion: UI & Camera

The core goal of the Immersive Spectator System is to make the spectator feel like they are truly seeing through the eyes of the player they are watching. This involves not only matching the camera's viewpoint but also replicating key elements of the spectated player's Heads-Up Display (HUD) and camera behaviors like Aim Down Sights (ADS). This page details how the system synchronizes UI elements and camera states.

### UI Mimicking: Data Flow and Message Broadcasting

Replicating the spectated player's UI elements (Quickbar, ammo count, potentially health/shields) relies on the flow of data through the `USpectatorDataProxy` and `USpectatorDataContainer`, culminating in local message broadcasts on the spectator's client.

**The Pattern:**

1. **State Change (Server or Client):** An event occurs that changes the state relevant to the UI.
   * Example (Server): Player picks up a weapon, `ULyraQuickBarComponent` updates its slots server-side.
   * Example (Client): Player toggles ADS, `Gameplay.Message.ADS` is broadcast locally on the player's client.
2. **Proxy Detects/Relays:**
   * Server State: The server-side `USpectatorDataProxy` listens for authoritative messages (like `Lyra.QuickBar.Message.SlotsChanged`) and directly updates the `USpectatorDataContainer`.
   * Client State: The client-side USpectatorDataProxy listens for local messages (like `Gameplay.Message.ADS`), calls a Server RPC (`Server_UpdateToggleADS`), which then updates the `USpectatorDataContainer` on the server.
3. **Container Replication:** The relevant property within the `USpectatorDataContainer` (e.g., `QuickBarSlots`, `ToggleADS`) is replicated from the server only to subscribed spectators (as filtered by the proxy).
4. **OnRep_ Notification:** When the property value changes on the spectator's client due to replication, the corresponding `OnRep_` function inside `USpectatorDataContainer` executes (e.g., `OnRep_QuickBarSlots`, `OnRep_ToggleADS`).
5. **Local Message Broadcast:** The `OnRep_` function constructs a specific spectator message (e.g., `FLyraQuickBarSlotsChangedMessage`, `FGameplayADSMessage`) containing the updated data and broadcasts it **locally** on the spectator's client using a distinct tag (e.g., `TAG_ShooterGame_Spectator_Message_SlotsChanged`, `TAG_ShooterGame_Spectator_Message_ToggleADS`).
6. **UI Widget Listener:** Spectator-specific UI widgets (potentially part of a dedicated Spectator HUD layout) are designed to listen for these local spectator messages.
7. **UI Update:** When a widget receives a relevant message, it updates its visual representation.
   * Example: A Quickbar widget receives `TAG_ShooterGame_Spectator_Message_SlotsChanged`, clears its current display, and rebuilds it using the item instances from the message payload. It receives `TAG_ShooterGame_Spectator_Message_ActiveIndexChanged` and highlights the correct slot.
   * Example: An ammo counter widget might listen for `SlotsChanged` or `ActiveIndexChanged`. When the active weapon changes, it gets the corresponding `ULyraInventoryItemInstance` from the message, finds its `TAG_Lyra_Weapon_SpareAmmo` stat tag (which was updated via the Inventory Query system and replicated), and displays that value.
   * Example: A reticle widget or overlay listens for `TAG_ShooterGame_Spectator_Message_ToggleADS` and shows/hides the ADS overlay or changes the crosshair appearance.

This message-based approach effectively decouples the core replication logic from the specific UI implementation, allowing different HUDs to react to the same underlying state changes.

### Camera Mimicking: Leveraging `ULyraCameraComponent`

Matching the spectated player's camera behavior (especially switching between different `ULyraCameraMode` instances like hip-fire vs. ADS scopes) relies heavily on both players (spectated and spectator) using the `ULyraCameraComponent`.

**The Flow:**

1. **Mode Change (Spectated Player):** The spectated player performs an action that triggers a camera mode change (e.g., presses the ADS input). Their pawn's `ULyraCameraComponent` pushes or modifies its internal `ULyraCameraModeStack`.
2. **Local Message (Spectated Player):** The `ULyraCameraComponent::GetCameraView` function detects when the top camera mode on the stack changes (`CurrentCameraMode != PreviousCameraMode`). It broadcasts a `Lyra.Camera.Message.CameraModeChanged` message **locally** on the spectated player's client, containing the owning Actor and the `TSubclassOf<ULyraCameraMode>` of the new active mode.
3. **Proxy Listener & RPC (Spectated Player):** The `USpectatorDataProxy` on the spectated player's client listens for this message (`UpdateCameraMode function`). Upon receiving it, it calls the `Server_UpdateCameraMode(NewCameraModeClass)` RPC.
4. **Server Update:** The server receives the RPC and updates the `CameraMode` property (the `TSubclassOf`) within the `USpectatorDataContainer`.
5. **Container Replication:** The `CameraMode` property replicates to subscribed spectators.
6. **OnRep_ & Local Message (Spectator Client):** `OnRep_CameraMode` fires on the spectator's client. It broadcasts the `TAG_ShooterGame_Spectator_Message_CameraModeChanged` message locally, containing the owning `PlayerState` and the new CameraMode class.
7. **Spectator Pawn Listener** (`ATeammateSpectator::OnCameraChangeMessage`)**:** The spectator pawn listens for this specific local message. When received, it checks if the message owner matches the currently spectated player state. If so, it updates its internal `CurrentCameraMode` variable with the received `TSubclassOf<ULyraCameraMode>`.
8. **Spectator Camera Update:** On the next camera update tick, the spectator pawn's `ULyraCameraComponent` calls its `DetermineCameraModeDelegate`, which points to `ATeammateSpectator::DetermineCameraMode`. This function now returns the new CurrentCameraMode class it received via the message.
9. **Mode Activation:** The spectator's `ULyraCameraComponent`'s `CameraModeStack` finds or creates an instance of the specified `ULyraCameraMode` class and pushes it onto its own stack.
10. **Visual Change:** The spectator's camera now uses the logic and view parameters defined by the newly activated camera mode (e.g., applying the ADS zoom, offset, and FOV), blending smoothly according to the mode's blend settings.

**Why it Works:** Because both pawns use the `ULyraCameraComponent` and `ULyraCameraMode` system, activating the same camera mode class on the spectator's camera component produces a visually identical result (relative to the target pawn) as activating it on the spectated player's camera component. The system essentially replicates the intent (which camera mode class should be active) rather than raw camera transforms.

### Summary

Achieving immersion relies on two key data flows:

* **UI Data:** Replicated state within `USpectatorDataContainer` triggers local messages via `OnRep_` functions, allowing decoupled UI widgets to update based on spectated player state changes. Ammo requires a special server-side query system updating replicated item stats.
* **Camera Data:** Local camera mode changes on the spectated player are relayed via RPC to the server, replicated via the `USpectatorDataContainer`, trigger local messages on the spectator, and are finally used by the spectator pawn's `ULyraCameraComponent` to activate the identical `ULyraCameraMode`, ensuring visual consistency.

This combination provides spectators with a view that closely mirrors what the player they are watching is experiencing.
