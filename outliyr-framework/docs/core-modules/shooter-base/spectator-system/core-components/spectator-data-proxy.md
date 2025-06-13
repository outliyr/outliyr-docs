# Spectator Data Proxy

The `USpectatorDataProxy` is a vital `UPlayerStateComponent` that acts as the **gatekeeper** for spectating information. It's attached to **every** player's `APlayerState` in experiences (game modes) that have spectating and its primary responsibility is to manage and filter the replication of that player's gameplay state specifically to clients who are actively spectating them.

***

### Role and Purpose

* **Data Control:** Prevents sensitive or performance-intensive gameplay data (like detailed inventory or frequent state changes) from being replicated unnecessarily to all clients on the server.
* **Selective Replication:** Ensures that only clients actively spectating this specific player (either live or via killcam requesting data) receive the detailed spectator data payload (`USpectatorDataContainer`).
* **Subscription Management:** Maintains a list of controllers (`AController`\*) that are currently subscribed to watch this player.
* **Client State Relay:** Listens for local client-side state changes (like Camera Mode or ADS status) on the owning player and uses Server RPCs to relay this information to the server instance of the proxy, so it can be placed in the replicated container.
* **Container Ownership:** Owns and manages the lifecycle of the associated `USpectatorDataContainer` object.

***

### Key Features and Logic

1. **Component Attachment & Initialization**
   * Added to `APlayerState` (or subclasses) via Lyra Experiences (`GameFeatureAction_AddComponents`). Added on both Client and Server.
   * `BeginPlay` / `OnExperienceLoaded`: Waits for the experience to load, then calls `StartListening`.
   * `StartListening`:
     * **Server:** Creates the `USpectatorDataContainer` instance (`SpectatorData`) and initializes it. Registers server-side message listeners (e.g., for Quickbar changes).
     * **Client (Local Controller):** Registers client-side message listeners for local state changes (Camera Mode, ADS) that need to be sent to the server. Initializes the default camera mode state via message.
2. **Subscription Management**
   * **`SubscribedSpectators (TSet<TObjectPtr<AController>>)`:** An internal set storing the controllers currently allowed to receive detailed spectator data from this proxy. Not replicated.
   * **`SetSpectatorSubscribed(AController* Spectator, bool bSubscribed)` (Server-Only):** The primary function called (usually by ATeammateSpectator's server instance or killcam RPCs) to add or remove a spectator controller from the SubscribedSpectators list.
   * **`IsSpectatorSubscribed(const AController* Controller) const`:** Checks if a given controller is currently in the SubscribedSpectators list. Used by the replication filtering logic.
   * **`bIsBeingSpectated` (bool, Replicated):** A simple replicated boolean flag indicating whether the SubscribedSpectators list is currently non-empty. This provides a cheap way for the server to signal to the owning client and potentially the container whether anyone is watching, without replicating the whole list.
   * **`OnSpectatorListChanged(bool bNowSpectated)`:** Called internally when the spectator list transitions between empty and non-empty. Updates bIsBeingSpectated and notifies the SpectatorData container (so it can start/stop expensive operations like inventory queries).
3. **Replication Filtering (`ReplicateSubobjects`)**
   * This overridden function is the core of the data filtering mechanism and directly implements the replication strategy needed for both live spectating and the Killcam. It's called by the `APlayerState`'s network channel for each connected client (`Viewer`).
   * **Spectator Data Container (Always Replicated for Killcam):** The proxy always attempts to replicate the `SpectatorDataContainer` object itself (`Channel->ReplicateSubobject(SpectatorData, ...)`). This is a deliberate design choice to support the [Killcam](../../kill-cam/) feature. The Killcam works by replaying the last few seconds of network data recorded by the client's `DemoNetDriver`. Since a player isn't subscribed to their killer's data _before_ they die, this information would normally be missing from the recording. By always replicating the small `SpectatorDataContainer` object to all clients, we ensure this essential data (Camera Mode, ADS status) is present in the replay buffer when the player dies, allowing the Killcam to mimic the killer's view more accurately.
   * **QuickBar Item Instances (Conditionally Replicated):** It iterates through the `ULyraInventoryItemInstance` pointers stored within `SpectatorData->QuickBarSlots`. For each item, it checks if the current `Viewer` is actively subscribed (`IsSpectatorSubscribed(Viewer)`). **Only if the viewer is subscribed** does it attempt to replicate the `ULyraInventoryItemInstance` subobject (`Channel->ReplicateSubobject(Item, ...)`). This is the primary bandwidth-saving measure, preventing the replication of potentially large and complex inventory data to every client on the server.
4. **Client State Relaying (Client -> Server)**
   * **Local Listeners:** The instance of the proxy running on the player's own client listens for local messages indicating changes in state that aren't automatically known by the server (like camera mode changes or ADS toggles).
   * **Listeners:** `UpdateCameraMode`, `UpdateToggleADS`.
   * **RPC Calls:** When these listeners fire on the client, they check if the event owner matches the local player state and then call Server RPCs:
     * `Server_UpdateCameraMode(TSubclassOf<ULyraCameraMode> NewCameraMode)`
     * `Server_UpdateToggleADS(bool InToggleADS)`
   * **Server RPC Implementation:** The server-side implementations of these RPCs simply call the corresponding Set... function on the authoritative `SpectatorData` container instance, updating the replicated value.
5.  **Server State Updating (Server)**

    * **Server Listeners:** The instance of the proxy running on the server listens for authoritative state changes relevant to spectators (like Quickbar updates).
    * **Listeners:** `UpdateQuickBarSlots`, `UpdateActiveSlotIndex`.
    * **Direct Update:** When these listeners fire on the server, they directly call the corresponding Set... function on the authoritative `SpectatorData` container instance.



***

### Data Flow Summary

* **Server State (e.g., Quickbar):** Change occurs on Server -> `USpectatorDataProxy` Server Listener -> Updates `USpectatorDataContainer` -> Property replicates via Proxy's filter -> `OnRep_` fires on subscribed Spectator Client -> Local message broadcast -> Spectator Pawn/UI reacts.
* **Client State (e.g., Camera Mode):** Change occurs on Owning Client -> `USpectatorDataProxy` Client Listener -> Calls Server RPC -> Server RPC executes -> Updates `USpectatorDataContainer` -> Property replicates via Proxy's filter -> `OnRep_` fires on subscribed Spectator Client -> Local message broadcast -> Spectator Pawn/UI reacts.

### Summary

The `USpectatorDataProxy` is the essential security and efficiency layer for the Immersive Spectator System. By managing subscriptions and filtering replication via `ReplicateSubobjects`, it ensures that detailed gameplay state is shared only with those who need it (active spectators). It also bridges the gap for client-driven state changes (like camera mode) by relaying them to the server via RPCs so they can be incorporated into the replicated data stream maintained by the `USpectatorDataContainer`.
