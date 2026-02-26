# Supporting Systems

While the core interaction with Game Features happens through Experiences and Actions, a couple of specialized classes provide policy overrides and editor-specific management for the system.

### `ULyraGameFeaturePolicy`

This class inherits from `UDefaultGameFeaturesProjectPolicies` and allows the project (Lyra in this case, or your derived project) to customize certain behaviors of the global `UGameFeaturesSubsystem`.

**Role:**

* **Policy Overrides:** Provides hooks to change default engine behavior regarding Game Feature loading, activation, and interaction with other systems.
* **Global Observers:** Registers global observers that react to _all_ Game Feature state changes, regardless of which Experience triggered them.

**Key Overrides & Features in Lyra:**

* **`InitGameFeatureManager()` / `ShutdownGameFeatureManager()`:**
  * **Registers Observers:** Creates and registers instances of global observer objects like:
    * `ULyraGameFeature_HotfixManager`: Hooks into feature loading to potentially trigger online hotfix checks/asset patching.
    * `ULyraGameFeature_AddGameplayCuePaths`: Listens for feature registration/unregistration to globally manage adding/removing Gameplay Cue paths (as detailed in the `UGameFeatureAction_AddGameplayCuePath` documentation).
  * Cleans up observers on shutdown.
* **`GetGameFeatureLoadingMode(bool& bLoadClientData, bool& bLoadServerData) const`:**
  * Determines whether client-specific or server-specific assets should be loaded when activating a feature based on the current network mode.
  * Lyra's implementation ensures client data isn't loaded on dedicated servers (`!IsRunningDedicatedServer()`) and server data isn't loaded on pure clients (`!IsRunningClientOnly()`). Editor loads both.
* **`GetPreloadAssetListForGameFeature(...)` / `GetPreloadBundleStateForGameFeature()`:** Hooks for specifying assets that should be preloaded when a feature is being prepared (Lyra's implementation currently just calls the base class).
* **`IsPluginAllowed(...)`:** A hook to potentially prevent certain plugins from being loaded based on project rules (Lyra currently calls base class).

**Usage:**

* You generally **don't interact directly** with this class unless you need to fundamentally change how the Game Features subsystem behaves project-wide (e.g., adding new global observers, changing loading rules).
* It's configured in `DefaultEngine.ini` via the `GameFeaturesProjectPoliciesClassName` setting within the `[/Script/GameFeatures.GameFeaturesProjectPolicies]` section, pointing it to use `LyraGameFeaturePolicy`.

### `ULyraExperienceManager` (Engine Subsystem)

This `UEngineSubsystem` serves a very specific and limited purpose, primarily related to managing Game Feature activation counts correctly within the **Play-In-Editor (PIE)** environment.

**Role:**

* **PIE Activation Counting:** When running multiple PIE instances, different "worlds" might independently request the activation of the same Game Feature plugin (e.g., two client windows both loading an Experience that requires the "ShooterCore" feature). The standard Game Features subsystem activates plugins process-wide. Without tracking, the first PIE window closing might prematurely deactivate the plugin even if the second window still needs it.
* **First-In, Last-Out:** This manager tracks how many different PIE-related activation requests have been made for each specific Game Feature plugin URL.

**Key Static Functions (Editor Only):**

* `NotifyOfPluginActivation(const FString PluginURL)`:
  * Called by `ULyraExperienceManagerComponent` _before_ it requests activation of a plugin URL via the subsystem.
  * Finds the `ULyraExperienceManager` subsystem.
  * Increments a reference count associated with the `PluginURL` in an internal map (`GameFeaturePluginRequestCountMap`).
* `RequestToDeactivatePlugin(const FString PluginURL)`:
  * Called by `ULyraExperienceManagerComponent` _before_ it requests deactivation of a plugin URL.
  * Finds the subsystem.
  * Decrements the reference count for the `PluginURL`.
  * **Returns `true` only if the count reaches zero**, indicating this is the last PIE instance that needed the plugin, and it's now safe to _actually_ request deactivation from the `UGameFeaturesSubsystem`. Otherwise, returns `false`, preventing premature deactivation.
* `OnPlayInEditorBegun()`: Clears the tracking map when a new PIE session starts.

**Usage:**

* This system works **automatically in the background** within the Editor/PIE environment.
* You do not need to interact with it directly. Its existence ensures that Game Features shared across multiple PIE windows behave correctly regarding activation and deactivation lifecycles. It has no effect in packaged builds.

***

These supporting systems handle lower-level policy decisions and editor-specific management for the Game Features system. While `ULyraGameFeaturePolicy` allows project-wide customization and observer registration, and `ULyraExperienceManager` ensures correct PIE behavior, your primary interaction with Game Features will typically be through defining Experiences, Action Sets, and specific `UGameFeatureAction` assets.
