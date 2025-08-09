# Activation Flow

The `ULyraExperienceManagerComponent`, residing on the `ALyraGameState`, is the central orchestrator responsible for managing the lifecycle of the current `ULyraExperienceDefinition` and, critically, the **loading, activation, and deactivation of the Game Feature plugins** associated with it.

### Role in Game Feature Management

* **Reads Experience Requirements:** When an experience is set via `SetCurrentExperience`, the manager reads the `GameFeaturesToEnable` lists from the `ULyraExperienceDefinition` and all included `ULyraExperienceActionSet`s.
* **Initiates Loading/Activation:** It compiles a unique list of required plugin URLs and requests the `UGameFeaturesSubsystem` to load and activate each one.
* **Tracks Loading Progress:** Monitors the asynchronous loading process of the requested Game Features.
* **Executes Actions:** Once features are loaded, it ensures the `UGameFeatureAction`s (from both the Experience Definition and its Action Sets) are executed in the correct world context.
* **Manages Lifecycle State:** Tracks the overall loading state (`ELyraExperienceLoadState`) from `Unloaded` through various loading phases (`Loading`, `LoadingGameFeatures`, `ExecutingActions`) to `Loaded` and finally `Deactivating`.
* **Handles Deactivation:** On `EndPlay` or potentially when an experience changes, it initiates the deactivation of the Game Features loaded by the current experience.
* **Fragment Injection Integration:** Coordinates with the `UFragmentInjectorManager` to apply fragment injections from activated Game Features _after_ the features themselves are loaded but _before_ the experience is considered fully loaded for gameplay systems.

### The Activation Lifecycle

Here's a breakdown of the typical activation flow managed by the component:

1. **`SetCurrentExperience(FPrimaryAssetId ExperienceId)`:**
   * Called by `ALyraGameMode` after determining the Experience ID for the session.
   * Resolves the ID to a `ULyraExperienceDefinition` asset.
   * Stores the `CurrentExperience`.
   * Calls `StartExperienceLoad()`.
2. **`StartExperienceLoad()`:**
   * Checks that it's not already loading and that the world context is appropriate (skips for dynamic duplicated levels).
   * Sets `LoadState` to `Loading`.
   * Uses the `ULyraAssetManager` to asynchronously load primary assets defined in the `CurrentExperience` and its `ActionSets` (using `ChangeBundleStateForPrimaryAssets`).
   * Binds `OnExperienceLoadComplete` to the completion delegate of the asset loading handle.
3. **`OnExperienceLoadComplete()`:**
   * Called when the core assets associated with the Experience Definition and its Action Sets are loaded.
   * Sets `LoadState` tentatively towards `LoadingGameFeatures`.
   * **Collects Game Feature URLs:** Iterates through `CurrentExperience->GameFeaturesToEnable` and `ActionSet->GameFeaturesToEnable` for all included sets. Uses `UGameFeaturesSubsystem::Get().GetPluginURLByName()` to resolve plugin names to their URLs. Stores unique URLs in `GameFeaturePluginURLs`.
   * **Initiates Feature Loading:**
     * If `GameFeaturePluginURLs` is not empty, sets `LoadState` to `LoadingGameFeatures`.
     * Sets `NumGameFeaturePluginsLoading` to the number of unique URLs found.
     * For each URL:
       * Calls `ULyraExperienceManager::NotifyOfPluginActivation(PluginURL)` (for PIE tracking).
       * Calls `UGameFeaturesSubsystem::Get().LoadAndActivateGameFeaturePlugin(PluginURL, CallbackDelegate)`. The callback delegate is bound to `OnGameFeaturePluginLoadComplete`.
     * If `GameFeaturePluginURLs` _is_ empty, directly calls `OnExperienceFullLoadCompleted()`.
4. **`OnGameFeaturePluginLoadComplete(const UE::GameFeatures::FResult& Result)`:**
   * Called asynchronously by the `UGameFeaturesSubsystem` for _each_ completed plugin load/activation attempt.
   * Decrements `NumGameFeaturePluginsLoading`.
   * If `NumGameFeaturePluginsLoading` reaches zero, it means all requested features have finished processing (successfully or not), so it calls `OnExperienceFullLoadCompleted()`.
5. **`OnExperienceFullLoadCompleted()`:**
   * Checks `LoadState` to prevent redundant execution.
   * **(Chaos Testing Delay):** Optionally adds a small random delay if configured via console variables (`lyra.chaos.ExperienceDelayLoad.*`).
   * [**Inject Fragments**](../../items/modularity-fragment-injector/)**:** If the `InjectorManager` property is valid, it iterates through the now-loaded `GameFeaturePluginURLs` and calls `InjectorManager->InjectFragmentsForGameFeature(PluginURL)` for each. This applies any fragment modifications defined by the activated features _before_ gameplay systems fully initialize.
   * Sets `LoadState` to `ExecutingActions`.
   * **Execute Actions:**
     * Creates an `FGameFeatureActivatingContext` (optionally restricted to the current world context).
     * Collects all `UGameFeatureAction*` pointers from `CurrentExperience->Actions` and all `ActionSet->Actions` in `CurrentExperience->ActionSets`.
     * Iterates through the collected actions and calls `Action->OnGameFeatureRegistering()`, `Action->OnGameFeatureLoading()`, and crucially `Action->OnGameFeatureActivating(Context)` on each valid action.
   * Sets `LoadState` to `Loaded`.
   * **Broadcast Loaded Events:** Fires the `OnExperienceLoaded_HighPriority`, `OnExperienceLoaded`, and `OnExperienceLoaded_LowPriority` delegates in that order, passing the `CurrentExperience`. This signals to other systems (like `ALyraGameMode`, UI managers, gameplay subsystems) that the experience setup is complete and they can proceed with their experience-dependent initialization.
   * Applies scalability settings via `ULyraSettingsLocal`.

### Deactivation Lifecycle (`EndPlay`)

1. **Check State:** Checks if the component is in the `Loaded` state and not in a dynamically duplicated level.
2. **Restore Fragments:** Calls `InjectorManager->RestoreOriginalFragments()` to revert any CDO modifications made during activation.
3. **Deactivate Features:** Iterates through the stored `GameFeaturePluginURLs`. For each URL:
   * Calls `ULyraExperienceManager::RequestToDeactivatePlugin(PluginURL)` (for PIE tracking). If it returns true (meaning this is the last requestor for this plugin in PIE):
   * Calls `UGameFeaturesSubsystem::Get().DeactivateGameFeaturePlugin(PluginURL)`.
4. **Deactivate Actions:**
   * Sets `LoadState` to `Deactivating`.
   * Creates an `FGameFeatureDeactivatingContext` with a callback (`OnActionDeactivationCompleted`).
   * Collects all actions (from Experience and Action Sets) like during activation.
   * Calls `Action->OnGameFeatureDeactivating(Context)` and `Action->OnGameFeatureUnregistering()` on each action.
   * _(Note: The code mentions async deactivation isn't fully supported yet, but it tracks pausers via the context)_.
5. **Cleanup:** Once all actions are deactivated (`OnAllActionsDeactivated`), resets internal state (`LoadState = Unloaded`, `CurrentExperience = nullptr`, clears plugin URL list).

### Synchronization (`CallOrRegister_OnExperienceLoaded_...`)

Because the experience loading process is asynchronous (involving asset loading and potentially feature plugin downloads), other systems often need to wait until the experience is fully loaded before performing their own initialization. The Experience Manager provides three delegates for this:

* `OnExperienceLoaded_HighPriority`
* `OnExperienceLoaded`
* `OnExperienceLoaded_LowPriority`

The `CallOrRegister_...` functions allow systems to safely register callbacks:

* If the experience is **already loaded** (`IsExperienceLoaded()` returns true), the provided delegate is executed immediately.
* If the experience is **still loading**, the delegate is added to the corresponding multicast delegate (`OnExperienceLoaded_HighPriority`, `OnExperienceLoaded`, or `OnExperienceLoaded_LowPriority`).
* When `OnExperienceFullLoadCompleted` runs, it fires these multicast delegates in the order High -> Normal -> Low, executing all registered callbacks.

This ensures that systems can reliably hook into the experience loading process, regardless of whether they check before or after the loading completes, and allows for ordering dependencies (e.g., core systems bind to High Priority, gameplay logic to Normal, cosmetic systems to Low).

> [!danger]
> This means that initialization logic should not be placed in BeginPlay but should instead use the provided delegates for safe initialization.

<!-- tabs:start -->
#### **Blueprint**
In blueprints, `WaitForExperienceReady` should be placed before the initialization logic, for safe initialization.

<img src=".gitbook/assets/image (56).png" alt="" title="Safe initialization with experience system">


#### **C++**
In c++ you would use one of the provided delegates depending on the priority.

```cpp
void AExampleActor::BeginPlay()
{
    Super::BeginPlay();

    // Listen for the experience load to complete
    AGameStateBase* GameState = GetGameStateChecked<AGameStateBase>();
    ULyraExperienceManagerComponent* ExperienceComponent = GameState->FindComponentByClass<ULyraExperienceManagerComponent>();
    check(ExperienceComponent);
    // The Experience Manager Component will call this when the experience has finished loading
    ExperienceComponent->CallOrRegister_OnExperienceLoaded(FOnLyraExperienceLoaded::FDelegate::CreateUObject(this, &ThisClass::OnExperienceLoaded));
}
```

```cpp
// add the initialization logic in here
void AExampleActor::OnExperienceLoaded(const ULyraExperienceDefinition* Experience)
{
    InitializationLogic();
}
```

<!-- tabs:end -->

### Replication

* The `CurrentExperience` (`TObjectPtr<const ULyraExperienceDefinition>`) is replicated using an `OnRep_CurrentExperience` function.
* On clients, `OnRep_CurrentExperience` checks if the experience is not already loading locally (which can happen during seamless travel) and calls `StartExperienceLoad` if necessary to kick off the client-side loading and activation process.

***

The `ULyraExperienceManagerComponent` is the engine driving the Experience and Game Feature systems at runtime. It meticulously manages the asynchronous loading, activation, execution of actions, fragment injection, and eventual deactivation, providing clear states and synchronization points for the rest of the game framework.
