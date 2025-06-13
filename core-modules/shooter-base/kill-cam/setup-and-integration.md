# Setup & Integration

Integrating the Shooter Base Killcam system is streamlined using the provided Lyra Experience framework. While the underlying system is complex, enabling it for a specific gameplay experience primarily involves configuring the engine correctly and including a dedicated Action Set.

<img src=".gitbook/assets/image (185).png" alt="" title="Blueprint Killcam logic in ShooterBase">

### 1. Engine Setup Requirement (ULyraGameEngine)

This is a **mandatory prerequisite** for the Killcam system to function. As detailed in "[Under the Hood: World Duplication](under-the-hood-world-duplication.md)," the system requires a custom UGameEngine class that overrides `Experimental_ShouldPreDuplicateMap` to return true.

* **Requirement:** Ensure your project uses `ULyraGameEngine` or a child class derived from it that preserves this override.
*   **Configuration:** Verify that your `Config/DefaultEngine.ini` file has the correct configuration:

    ```ini
    # Game Engine class points to the Lyra Game Engine
    [/Script/Engine.Engine]
    GameEngineClass=/Script/LyraGame.LyraGameEngine

    # Add this section if using Unreal Engine 5.5 or later
    [ConsoleVariables]
    s.World.CreateStaticLevelCollection=1
    ```

**Without this engine setup, world duplication will not occur in Standalone mode, and the Killcam system will fail.**

### 2. Simplified Integration: `LAS_ShooterBase_Death_Killcam` Action Set

The primary method for adding Killcam functionality to your game modes is by leveraging the provided Lyra Experience Action Set: **LAS_ShooterBase_Death_Killcam**.

* **What is an Action Set?** It's a reusable data asset (`ULyraExperienceActionSet`) that bundles together multiple Game Feature Actions (like adding components or abilities) and required [Game Feature](../../../base-lyra-modified/gameframework-and-experience/game-features/) dependencies. (See separate [Experience Action Set](../../../base-lyra-modified/gameframework-and-experience/experience-primary-assets/experience-action-set.md) Documentation for more details).
* **How to Use:**
  1. Open the `ULyraExperienceDefinition` asset corresponding to the game mode or experience where you want Killcam enabled (e.g., `B_Experience_TeamDeathmatch`).
  2. Find the **Action Sets** array property in the Details panel.
  3. Click the **+** icon to add a new entry.
  4. Select `LAS_ShooterBase_Death_Killcam` from the asset picker dropdown.

By simply adding this Action Set to your Experience Definition, the necessary components, abilities, and input bindings will be automatically managed when that experience becomes active.

### 3. What the Action Set Does (Breakdown)

The `LAS_ShooterBase_Death_Killcam` Action Set uses several standard Game Feature Actions to configure the player for killcam functionality:

1. **Adds `UKillcamManager` Component:**
   * Uses [`GameFeatureAction_AddComponent`](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-components.md).
   * **Target:** `ALyraPlayerController` (or relevant subclass).
   * **Context:** Client Only. This component manages the killcam logic on the client machine.
2. **Adds `USpectatorDataProxy` Component:**
   * Uses [`GameFeatureAction_AddComponent`](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-components.md).
   * **Target:** `APlayerState` (or relevant subclass).
   * **Context:** Client & Server.
   * **Purpose:** This component is essential for viewing the killer's perspective and replicating relevant data (like ADS status, reticle state) during the killcam playback. It filters data replication, ensuring only necessary information is sent.
   * **Uniqueness:** The action ensures only one instance is added, preventing conflicts if other spectating features (using the same proxy) are also active.
   * (See separate [Spectator Data Proxy Documentation](../spectator-system/core-components/spectator-data-proxy.md) for details on how this component works).
3. **Adds Core Killcam Abilities:**
   * Uses [`GameFeatureAction_AddAbilities`](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-abilities.md).
   * **Target:** `APlayerState` (or relevant subclass, must have an Ability System Component).
   * **Granted Abilities:**
     * `GA_killcam_Death`: This ability activates automatically upon receiving the death event (e.g., triggered by a `GameplayEvent.Death` tag). It handles the main killcam flow initiation on the client (sending the start message via RPC), manages temporary UI elements (like "Press X to Skip"), and adds/removes the necessary input mapping context for the skip action.
     * `GA_killcam_Camera`: This ability is activated by the `TAG_GameplayEvent_Killcam` sent from `UKillcamPlayback` when playback is ready. It takes the Killer and Victim actors (from the duplicate world) provided in the event data, sets up the spectator view targeting the killer, and potentially displays contextual UI like a "You" indicator over the victim's replicated actor.
     * `GA_Manual_Respawn`: This ability prevents the default Lyra auto-respawn behavior. It ensures the player only respawns when explicitly triggered, typically after the killcam ends or is skipped.
4. **Adds Skip Killcam Input Ability & Binding:**
   * **Grant Ability:** The Action Set grants an Ability Set (e.g., `GAS_Skip_Killcam`) via the [`GameFeatureAction_AddAbilities`](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-abilities.md). This Ability Set contains the `GA_Skip_Killcam` ability. An ability set is used so the `GA_Skip_Killcam` can be linked to a corresponding input tag (`InputTag.Ability.SkipKillcam`).
   * **`GA_Skip_Killcam` Purpose:** This ability executes the logic when the player chooses to skip the killcam (e.g., sends the Stop message locally, potentially initiates the respawn flow early).
   * **Input Binding:** The Action Set also includes a [`GameFeatureAction_AddInputBinding`](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-input-binding.md). This adds a `ULyraInputConfig` asset (e.g., `InputConfig_Killcam`) that maps a specific InputTag (e.g., `InputTag.UI.SkipCutscene` or a dedicated `InputTag.Killcam.Skip`) to the AbilityTag associated with `GA_Skip_Killcam`. This allows the player's physical input (defined in their Enhanced Input settings) to trigger the skip ability while the killcam is active (likely managed by the `GA_killcam_Death` ability adding/removing the mapping context).

### 4. Triggering the Killcam (Start / Stop Messages)

While the Action Set automates the setup, you still need to implement the logic that triggers the start and stop sequences:

* **Start Trigger** (`ShooterGame.KillCam.Message.Start`)**:**
  * **Responsibility:** Server-side game logic (e.g., Game Mode) upon player death confirmation.
  * **Action:** Send a Client RPC to the killed player's controller. The RPC function then broadcasts the Start message **locally** on that client, including the desired `KillCamStartTime` and `KillCamFullDuration`.
* **Stop Trigger** (`ShooterGame.KillCam.Message.Stop`)**:**
  * **Responsibility:** Client-side logic, typically coordinated with the respawn flow or the skip input.
  * **Action:** Broadcast the Stop message **locally** just before respawn or when `GA_Skip_Killcam` is activated.

Refer to the "[Playback Process](playback-process.md)" page for more details on the message payloads and typical timing.

### 5. Final Reminders

* <mark style="color:red;">**TEST ONLY IN STANDALONE GAME MODE**</mark>. The system relies on world duplication unavailable in PIE.
* <mark style="color:red;">**AVOID MODIFYING UKillcamPlayback**</mark>\*\* unless absolutely essential and with full understanding of the implications. Stick to configuring via the Action Set and triggering messages.
* Ensure `LAS_ShooterBase_Death_Killcam` Action Set is in the experience you want to utilize the kill cam functionality in.

By using the provided `LAS_ShooterBase_Death_Killcam` Action Set and implementing the simple start/stop message triggers, you can integrate the sophisticated Killcam system into your experiences with minimal direct setup, leveraging the power of the Lyra Experience framework.
