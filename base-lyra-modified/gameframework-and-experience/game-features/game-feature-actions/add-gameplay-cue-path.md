# Add Gameplay Cue Path

The `UGameFeatureAction_AddGameplayCuePath` is a simple but essential Game Feature Action responsible for registering specific directory paths with the **Gameplay Cue Manager** (`UGameplayCueManager`). This allows the Ability System Global singleton to scan these directories and discover `GameplayCueNotify` assets (like `GameplayCueNotify_Static` and `GameplayCueNotify_Actor`) defined within your Game Feature Plugin.

### Purpose

* **Gameplay Cue Discovery:** Ensures that Gameplay Cues defined as assets within a Game Feature Plugin's content directory are found and loaded by the central Gameplay Cue Manager.
* **Decoupling Cues:** Allows Gameplay Cue assets (which handle visual and auditory feedback for Gameplay Effects and Tags) to live alongside the features that use them, rather than requiring all cues to be in a single, globally known location.
* **On-Demand Loading:** Cues defined within a feature are only scanned and potentially loaded when that feature is active.

### Configuration

This action is typically added automatically if needed by other systems, but can be manually added to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet` if you have custom Gameplay Cue paths within your feature.

<img src=".gitbook/assets/image (123).png" alt="" title="Add_GameplayCuePath GameFeatureAction configuration">

* **`Directory Paths To Add` (`TArray<FDirectoryPath>`)**: An array of directory paths (relative to the _Content_ directory of the plugin containing this action) that should be scanned by the `UGameplayCueManager`.
  * **Default:** Includes `/GameplayCues` by default, as this is a common convention.
  * **Configuration:** Use the path picker (+) to add additional directories within your Game Feature Plugin where you store `GameplayCueNotify` assets. Ensure the paths are marked as `RelativeToGameContentDir`.

_Example Configuration (if Cues are in `MyFeaturePlugin/Content/MySpecialCues`):_

* `Directory Paths To Add`:
  * `[0]`: `/GameplayCues` (Keep the default unless you _only_ use custom paths)
  * `[1]`: `/MySpecialCues`

### Runtime Execution Flow

1. **Registration (`OnGameFeatureRegistering` - via `ULyraGameFeature_AddGameplayCuePaths` Observer):**
   * Lyra uses an observer pattern (`ULyraGameFeature_AddGameplayCuePaths` attached to the `ULyraGameFeaturePolicy`) rather than direct execution within this action's `OnGameFeatureRegistering`.
   * When _any_ Game Feature containing _any_ `UGameFeatureAction_AddGameplayCuePath` action is registered, the `ULyraGameFeature_AddGameplayCuePaths::OnGameFeatureRegistering` observer function is called.
   * It iterates through _all_ actions of type `UGameFeatureAction_AddGameplayCuePath` within the registering Game Feature Data.
   * For each action found, it gets the `DirectoryPathsToAdd`.
   * It retrieves the `ULyraGameplayCueManager`.
   * For each `DirectoryPath` in the action's list, it calls `GCM->AddGameplayCueNotifyPath(Path, bShouldRescanCueAssets = false)`. (It fixes up the path to be relative to the specific plugin).
   * After processing all paths from all relevant actions in the feature, it calls `GCM->InitializeRuntimeObjectLibrary()` to potentially rebuild the library if paths were added.
   * It may also call `GCM->RefreshGameplayCuePrimaryAsset()` if the number of cues changed.
2. **Unregistration (`OnGameFeatureUnregistering` - via Observer):**
   * Similarly, when the Game Feature is unregistered, the `ULyraGameFeature_AddGameplayCuePaths::OnGameFeatureUnregistering` observer function runs.
   * It finds all `UGameFeatureAction_AddGameplayCuePath` actions within the unregistering feature.
   * For each path defined in those actions, it calls `GCM->RemoveGameplayCueNotifyPath(Path, bShouldRescanCueAssets = false)`.
   * If paths were removed, it calls `GCM->InitializeRuntimeObjectLibrary()` again.

**Note:** The actual addition/removal logic is handled centrally by the `ULyraGameFeature_AddGameplayCuePaths` observer listening to _all_ feature registrations/unregistrations, rather than each individual action instance managing world state. The action asset itself primarily serves as a data container specifying the paths for the observer to process.

### Use Cases

* **Standard Practice:** Include this action (often with the default `/GameplayCues` path) in any Game Feature Plugin that defines its own `GameplayCueNotify` assets to ensure they are usable by the Gameplay Ability System.
* **Organizing Cues:** If you organize cues into subdirectories within your feature plugin (e.g., `/MyFeature/Content/VFX/GameplayCues`, `/MyFeature/Content/Audio/GameplayCues`), add those specific paths to the action's configuration.

### Key Dependencies

* **Gameplay Ability System:** Relies on the `UAbilitySystemGlobals` and `UGameplayCueManager` (specifically the `ULyraGameplayCueManager` subclass in Lyra).
* **Game Features Subsystem:** The activation/deactivation lifecycle triggers the path registration/unregistration via the observer policy.

***

Although simple in its configuration, `UGameFeatureAction_AddGameplayCuePath` plays a vital role in Lyra's modularity by ensuring that Gameplay Cue assets defined within Game Features are correctly discovered and made available to the central Ability System when those features are active.
