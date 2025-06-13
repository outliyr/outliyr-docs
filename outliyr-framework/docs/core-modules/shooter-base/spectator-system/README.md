# Spectator System

This system goes beyond traditional spectating methods to provide players with a compelling, immersive view of their teammates (or opponents in certain scenarios like killcams) after being eliminated, mirroring the experience found in modern AAA shooters.

### Purpose: Beyond Simple Viewing

Standard spectator systems in Unreal often provide a free-floating camera or a simple third-person follow-cam. This system's goal is **immersion**: when spectating another player (either a teammate after death or the killer during a killcam), the spectator should feel as though they are viewing the game directly through the spectated player's screen.

The Immersive Spectator System aims to:

* **Maximize Immersion:** Allow the spectator to see the game through the eyes of the spectated player.
* **Replicate Player Experience:** Display relevant UI elements and gameplay state indicators (equipped weapon, quickbar, ADS status, camera modes, ammo counts) belonging to the spectated player, making the spectator feel as if they are controlling that player.
* **Provide Context:** Clearly show the spectated player's actions, perspective, and available resources.
* **Unified Framework:** Offer a consistent system that can be leveraged for both live team spectating and killcam playback scenarios.

This includes mimicking:

* **Viewpoint:** Matching the spectated player's camera location and rotation.
* **Camera State:** Reflecting changes in camera modes (like Aim Down Sights (ADS) or specific weapon scopes) handled by the [`ULyraCameraComponent`](../../../base-lyra-modified/camera/).
* **UI Replication:** Displaying the spectated player's relevant HUD information, such as their quickbar/weapon slots, currently held weapon, ammo counts, and potentially health/shield status, directly on the spectator's screen.
* **Reticle/Crosshair:** Showing the appropriate crosshair based on the spectated player's weapon state (hip fire, ADS).

### Core Concepts

To achieve this level of immersion, the system combines several key concepts:

1. **Dedicated Spectator Pawn (`ATeammateSpectator`):** When spectating begins, the player's controller possesses a specialized pawn derived from `ASpectatorPawn`. This pawn contains its own camera system (`ULyraCameraComponent`) capable of mimicking the target's camera.
2. **Data Proxy & Filtering (`USpectatorDataProxy`):** Every player state has a `USpectatorDataProxy` component. This acts as a gatekeeper, managing a list of subscribed spectators and ensuring that detailed gameplay state is replicated only to those who are actively watching. This is crucial for performance and prevents leaking unnecessary information across the network.
3. **Replicated Data Container (`USpectatorDataContainer`):** Nested within the proxy, this replicated `UObject` holds the specific pieces of information needed by spectators (Quickbar slots, Active Slot Index, Camera Mode class, ADS state).
4. **Selective Replication:** The proxy filters replication, ensuring the container and its data are primarily sent only to subscribed spectators. Details like inventory item instances within the quickbar are also carefully replicated, this helps reduce bandwidth since broadcasting client information to everyone can be expensive.
5. **Client-Side Mimicking:** The `ATeammateSpectator` pawn receives the replicated data from the container (via `OnRep_` functions and local Gameplay Messages). It uses this information to update its own `ULyraCameraComponent` (setting the correct camera mode) and internal state.
6. **UI Driven by Messages:** The spectator's UI widgets listen for the local Gameplay Messages broadcast by the `USpectatorDataContainer`'s `OnRep_` functions. When a message indicates a change (e.g., active weapon slot changed), the UI updates to reflect the spectated player's current state.
7. **GAS Integration:** Gameplay Abilities (`GA_Spectate`, `GA_Killcam_Camera`) are used to initiate and manage the spectating process, handling pawn possession and initial target selection.

### Key Benefits

* **Modern Spectator Experience:** Provides the same view that the spectated player is seeing, similar to what you'd expect from contemporary multiplayer shooters.
* **Enhanced Engagement:** Keeps players invested even after elimination by giving them a clear view of ongoing action.
* **Informative:** Allows players to learn by observing teammate or opponent gameplay directly.
* **Performance Conscious:** Selective data replication managed by the proxy minimizes network overhead.
* **Modular UI Integration:** Uses Gameplay Messages to decouple the core spectating logic from specific UI widget implementations.

### Key Components Introduction

* **`ATeammateSpectator`:** The pawn possessed or is the view target of the spectator's `PlayerController`, responsible for viewing and mimicking the target.
* **`USpectatorDataProxy`:** The gatekeeper component on every player state, controlling data replication.
* **`USpectatorDataContainer`:** The replicated object holding the mirrored gameplay state.
* **`ULyraCameraComponent` / `ULyraCameraMode`:** Used on both player pawns and the spectator pawn to enable seamless camera state mimicking.
* **`GA_Spectate`:** Gameplay Ability for initiating live teammate spectating (server-driven).
* **`GA_Killcam_Camera`:** Gameplay Ability used by the Killcam system to initiate spectating the killer (client-driven within duplicate world).
* **`LAS_ShooterBase_Spectating`:** The Lyra Action Set used to easily integrate the system into an Experience.

### High-Level Flow Example (Live Spectating)

1. Player A dies.
2. `GA_Spectate` activates on Player A's (server).
3. Server spawns `ATeammateSpectator`, Player A possesses it.
4. Server identifies living Teammate B as the initial target.
5. Server tells Teammate B's `USpectatorDataProxy` to subscribe Player A's controller.
6. Server tells `ATeammateSpectator` to observe Teammate B.
7. Teammate B's `USpectatorDataProxy` replicates its `USpectatorDataContainer` (and relevant subobjects like Quickbar items) to Player A.
8. Player A's `ATeammateSpectator` receives replicated data (e.g., B changes weapon).
9. `OnRep_` function fires on Player A's client, broadcasting a local message (e.g., `ActiveIndexChanged`).
10. Player A's HUD widgets catch the message and update to show B's currently selected weapon.
11. Player A's `ATeammateSpectator` updates its camera based on B's replicated camera mode.

This overview sets the stage. The following pages will explore the roles of each component, the different spectating workflows, how the UI and camera immersion is achieved, and how to integrate the system using the provided Action Set.
