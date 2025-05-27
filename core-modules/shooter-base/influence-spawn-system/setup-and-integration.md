# Setup & Integration

To enable the Influence Spawn System for a specific game mode or gameplay experience, you need to ensure that the appropriate spawning manager component is added to the correct actor (typically the Game Mode) when that experience loads. This page explains how to activate either the base `UShooterPlayerSpawningManagmentComponent` or a custom subclass you've created using the Lyra Experience system.

### Goal: Adding the Spawn Logic

The objective is to attach the `UShooterPlayerSpawningManagmentComponent` (or your custom subclass derived from it) as a component to the Game Mode actor associated with your Lyra Experience. This component will then be responsible for handling all player spawn location requests for that experience, utilizing the influence-based logic.

### Component Choice

Before proceeding, decide which component class you need to add:

1. **Base Component:** If the default behavior of `UShooterPlayerSpawningManagmentComponent`, potentially combined with adjustments via the "Configuration & Tuning" settings, is sufficient for your experience, you will add the base class directly.
2. **Custom Subclass:** If you created a Blueprint or C++ subclass (e.g., `BP_SpawningManager_CTF`) to implement custom logic via overriding `CalculateGameModeBias` or `CanSpawnInPlayerStart` (as described in "Customization & Extension"), you will add your specific subclass instead.

### Method: Lyra Experiences & `GameFeatureAction_AddComponents`

The standard Lyra approach is to manage component additions via actions within your **Lyra Experience Definitions** (`ULyraExperienceDefinition`) or reusable **Lyra Action Sets** (`ULyraExperienceActionSet`).

**Steps:**

1. **Identify Target Experience:** Open the `ULyraExperienceDefinition` asset corresponding to the game mode where you want to activate this specific spawn logic (e.g., `B_Experience_CaptureTheFlag`, `B_Experience_TeamDeathmatch`).
2. **Add the Action:**
   * Locate the **`Actions`** list within the Experience Definition asset.
   * Click the **`+`** icon to add a new action to the list.
   * Select **`GameFeatureAction_AddComponents`** as the action type.
   * _(Alternatively, if this spawner should be common to multiple experiences, you could add this action to a relevant `ULyraExperienceActionSet` which is then included in those experiences)._
3. **Configure the Action:** Select the newly added `GameFeatureAction_AddComponents` and configure its properties in the Details panel:
   * **Target Actor:** Set this to `GameMode` (or your specific `AGameModeBase` subclass if applicable, e.g., `AShooterGame_CaptureTheFlag`). The player spawning manager logic is typically associated with the Game Mode.
   * **Component List:** Click the `+` icon to add one entry to the list.
     * **Component Class:** Click the dropdown and select the class you decided on in the "Component Choice" step above – either **`ShooterPlayerSpawningManagmentComponent`** OR your **custom subclass** (e.g., `BP_SpawningManager_CTF`).
     * **Spawn Actor Condition:** Set this to **`OnlyOnServer`**. Player spawning is a server-authoritative process, so this component only needs to exist and run on the server.
4. **Save:** Save the `ULyraExperienceDefinition` asset.

### Verification (Recommended)

After adding the action, it's good practice to verify it's working correctly:

1. Load the game using the Lyra Experience you just modified.
2. If running in PIE (remembering that the spawn _logic_ itself relies on factors potentially only correct in Standalone, but component addition can be checked), you can pause the game and use the World Outliner to find your Game Mode actor instance.
3. Inspect its components in the Details panel and confirm that your chosen spawn manager component (`UShooterPlayerSpawningManagmentComponent` or your subclass) is present.
4. Ensure no unexpected _other_ player spawning manager components are present.

### Summary

Activating the Influence Spawn System for a specific Lyra Experience involves adding the `UShooterPlayerSpawningManagmentComponent` (or your custom subclass) to the corresponding Game Mode actor using a `GameFeatureAction_AddComponents`. Configure this action within your `ULyraExperienceDefinition` to target the Game Mode class and ensure the `Spawn Actor Condition` is set to `OnlyOnServer`. This connects your chosen spawn logic into the framework, allowing it to manage player spawns for that experience. Remember that testing the _full effectiveness_ of the bias calculations often requires running in Standalone mode due to the potential reliance on accurate player/enemy positioning and FOV checks.

***
