# Core Components

The Immersive Spectator System is built upon several distinct classes, each playing a crucial role in capturing, transmitting, and displaying the spectated player's experience. Understanding the responsibilities of each component is key to grasping how the system functions as a whole.

This section provides an overview of the main components involved. Please refer to the linked sub-pages for detailed explanations of each component's specific logic, properties, and interactions.

### Component Overview

1. **ATeammateSpectator (The Viewer's Eyes):**
   * **Type:** Specialized `ASpectatorPawn` subclass.
   * **Role:** This is the actor possessed or the view target of the player controller when actively spectating. It contains the camera ([`ULyraCameraComponent`](../../../../base-lyra-modified/camera/)) used to view the game world and is responsible for positioning itself and configuring its camera to mimic the viewpoint and state of the currently spectated player. It also handles logic for cycling between different spectating targets (teammates).
2. **USpectatorDataProxy (The Gatekeeper):**
   * **Type:** `UPlayerStateComponent`.
   * **Role:** Attached to every player's `APlayerState`. This component acts as a crucial filter and manager for spectating data originating from that player. It maintains a list of controllers currently spectating this player and controls which data gets replicated to whom, ensuring efficiency and preventing unnecessary data exposure minimising bandwidth. It owns the `USpectatorDataContainer`.
3. **USpectatorDataContainer (The Data Payload):**
   * **Type:** Replicated `UObject`.
   * **Role:** Owned by the `USpectatorDataProxy`, this object holds the actual gameplay state variables that need to be mirrored from the spectated player to the spectator (e.g., Quickbar contents, active slot, camera mode, ADS status). Its properties are replicated, but only to the clients subscribed via the owning Proxy. It uses `OnRep_` functions to broadcast local messages when data changes on the receiving (spectator) client.

### Supporting Components & Concepts

While the three components above are specific to this system, achieving full immersion relies on interaction with other parts of the Lyra/Shooter Base framework:

* **`ULyraCameraComponent` / `ULyraCameraMode`:** Used on both player pawns and the `ATeammateSpectator`. The spectator's camera component uses the replicated `CameraMode` class from the data container to activate the same camera mode instance locally, providing seamless visual transitions (like entering ADS).
* **`ULyraQuickBarComponent`:** The source of the Quickbar slot data that gets replicated via the USpectatorDataContainer.
* **`ULyraInventoryManagerComponent` /`ULyraInventoryQuery`:** Used by the USpectatorDataContainer (server-side) to track spare ammo counts for weapons listed in the Quickbar.
* **Gameplay Abilities (`GA_Spectate`, `GA_Killcam_Camera`, etc.):** Used to initiate the spectating process, handle player input for cycling targets, and manage the possession state of the `ATeammateSpectator`.
* **`UGameplayMessageSubsystem`:** Facilitates communication for state changes (via `OnRep_` functions broadcasting messages) and potentially for triggering spectating actions.
* **`ULyraTeamSubsystem`:** Used by `ATeammateSpectator` to find teammates for cycling targets.

The interplay between these components allows the system to selectively replicate only the necessary data and enables the spectator client to reconstruct an immersive view based on that data. The following sub-pages will elaborate on the specific responsibilities and internal workings of the `ATeammateSpectator`, `USpectatorDataProxy`, and `USpectatorDataContainer`.
