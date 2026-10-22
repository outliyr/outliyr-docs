# Setup & Integration

To enable the Influence Spawn System for a specific game mode or gameplay experience, you need to ensure that the appropriate spawning manager component is added to the correct actor (typically the Game Mode) when that experience loads. This page explains how to activate either the base `UShooterPlayerSpawningManagmentComponent` or a custom subclass you've created using the Lyra Experience system.

### Goal: Adding the Spawn Logic

The objective is to attach the `UShooterPlayerSpawningManagmentComponent` (or your custom subclass derived from it) as a component to the Game Mode actor associated with your Lyra Experience. This component will then be responsible for handling all player spawn location requests for that experience, utilizing the influence-based logic.

### Component Choice

Before proceeding, decide which component class you need to add:

1. **Base Component:** If the default behavior of `UShooterPlayerSpawningManagmentComponent`, potentially combined with adjustments via the "Configuration & Tuning" settings, is sufficient for your experience, you will add the base class directly.
2. **Custom Subclass:** If you created a Blueprint or C++ subclass (e.g., `BP_SpawningManager_CTF`) to implement custom logic via overriding `CalculateGameModeBias` or `CanSpawnInPlayerStart` (as described in "Customization & Extension"), you will add your specific subclass instead.

### Method: Lyra Experiences & `GameFeatureAction_AddComponents`

The standard Lyra approach is to manage component additions via actions within your **Lyra Experience Definitions** (`ULyraExperienceDefinition`).

**Steps:**

1. **Identify Target Experience:** Open the `ULyraExperienceDefinition` asset corresponding to the game mode where you want to activate this specific spawn logic (e.g., `B_Experience_CaptureTheFlag`, `B_Experience_TeamDeathmatch`).
2. **Add the Action:**
   * Locate the **`Actions`** list within the Experience Definition asset.
   * Click the **`+`** icon to add a new action to the list.
   * Select **`GameFeatureAction_AddComponents`** as the action type.
3. **Configure the Action:** Select the newly added `GameFeatureAction_AddComponents` and configure its properties in the Details panel:
   * **Target Actor:** Set this to `LyraGameState`.
   * **Component List:** Click the `+` icon to add one entry to the list.
     * **Component Class:** Click the dropdown and select the class you decided on in the "Component Choice" step above – either **`ShooterPlayerSpawningManagmentComponent`** OR your **custom subclass** (e.g., `BP_SpawningManager_CTF`).
     * **Spawn Actor Condition:** Set this to **`OnlyOnServer`**. Player spawning is a server-authoritative process, so this component only needs to exist and run on the server.
4. **Save:** Save the `ULyraExperienceDefinition` asset.

### Summary

Activating the Influence Spawn System for a specific Lyra Experience involves adding the `UShooterPlayerSpawningManagmentComponent` (or your custom subclass) to the corresponding Game Mode actor using a `GameFeatureAction_AddComponents`. Configure this action within your `ULyraExperienceDefinition` to target the Game Mode class and ensure the `Spawn Actor Condition` is set to `OnlyOnServer`. This connects your chosen spawn logic into the framework, allowing it to manage player spawns for that experience.

***
