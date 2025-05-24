# Setup & Integration

Once you have decided whether to use the base `UShooterScoring_Base` component or have created a custom subclass (e.g., `BP_Scoring_MyMode`) with your game-mode-specific logic, you need to ensure this component is added to the GameState when the relevant Lyra Experience loads.

### Goal: Adding the Scoring Logic to GameState

The objective is to attach your chosen scoring component (`UShooterScoring_Base` or your specific subclass) to the `AGameStateBase` actor associated with your Lyra Experience. Since scoring and game state management are server-authoritative, this component only needs to exist and execute on the server.

### Component Choice Recap

Remind yourself which component class holds the scoring logic you want active for this particular Experience:

1. **`UShooterScoring_Base`:** If the default elimination/assist scoring is sufficient.
2. **Your Custom Subclass (e.g., `BP_Scoring_Domination`)**: If you implemented custom rules, win conditions, or scoring events by overriding hooks or adding new logic. **This is the most common scenario.**

### Method: Lyra Experiences & `GameFeatureAction_AddComponents`

As with other gameplay systems, the standard Lyra method for adding components conditionally based on the active experience is to use the `GameFeatureAction_AddComponents` action within your Experience Definition or a relevant Action Set.

**Steps:**

1. **Identify Target Experience:** Open the `ULyraExperienceDefinition` asset for the game mode where you want this scoring logic to apply (e.g., `B_Experience_Domination`, `B_Experience_FFA`).
2. **Add the Action:**
   * Locate the **`Actions`** list within the Experience Definition asset.
   * Click the **`+`** icon to add a new action.
   * Select **`GameFeatureAction_AddComponents`** as the action type.
   * _(Consider adding this to a shared `ULyraExperienceActionSet` if the same scoring component subclass is used across multiple similar game modes)._
3. **Configure the Action:** Select the newly added `GameFeatureAction_AddComponents` and configure its properties in the Details panel:
   * **Target Actor:** Set this to `GameState` (or your specific `AGameStateBase` subclass).
   * **Component List:** Click the `+` icon to add one entry.
     * **Component Class:** Select the scoring component class you intend to use – either **`ShooterScoring_Base`** or, more likely, **your custom subclass** (e.g., `BP_Scoring_Domination`).
     * **Spawn Actor Condition:** Set this to **`OnlyOnServer`**. The scoring component manages authoritative game state and logic.
4. **Ensure Uniqueness (If Necessary):**
   * Typically, you only want **one** scoring logic component active per GameState.
   * Review the selected Experience Definition and any included Action Sets to ensure no _other_ `GameFeatureAction_AddComponents` is attempting to add a _different_ scoring component (like the base `UShooterScoring_Base` if you intended to use a subclass) to the GameState.
   * If you find a conflicting action (e.g., a base Action Set adds `UShooterScoring_Base` but your Experience needs `BP_Scoring_Domination`), you'll need to resolve it, usually by:
     * Removing the conflicting component addition from the base Action Set (if appropriate for all modes using it).
     * Or ensuring your Experience Definition overrides or correctly layers actions so only your intended component is added.
5. **Save:** Save the `ULyraExperienceDefinition` or `ULyraExperienceActionSet` asset.

### Verification

After configuration, load the relevant Experience and verify (on the server or in Standalone):

1. Use the World Outliner or Gameplay Debugger to inspect the `GameState` actor instance.
2. Confirm that your intended scoring component (`UShooterScoring_Base` or your subclass) is present as a component.
3. Confirm that no other conflicting scoring components are attached.
4. Test the scoring mechanics (eliminations, assists, custom events if applicable) to ensure points are being tracked correctly via Gameplay Tags as expected. Check win conditions defined in your subclass.

### Summary

Activating the GameState Scoring System involves adding the correct component (`UShooterScoring_Base` or your custom subclass) to the GameState actor for your specific Lyra Experience. Use `GameFeatureAction_AddComponents`, ensure it targets the `GameState` class, set the `Spawn Actor Condition` to `OnlyOnServer`, and verify that only the single, intended scoring component is active for the experience. This allows your custom or default scoring logic to manage the game's progression based on player actions.

***
