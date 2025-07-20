# Asset Manager

The `ULyraAssetManager` is a custom subclass of Unreal Engine's `UAssetManager`. The Asset Manager is a global singleton responsible for discovering, loading, and managing game assets, particularly **Primary Assets** (like `ULyraExperienceDefinition`, `ULyraPawnData`, `ULyraUserFacingExperienceDefinition`, and `ULyraExperienceActionSet`). Lyra's customization adds specific game data loading, startup job processing, and utility functions.

<img src=".gitbook/assets/image (126).png" alt="" title="Asset Manager in ShooterBase GameFeature Data Asset">

### Role and Purpose

* **Primary Asset Management:** Core engine functionality for managing assets designated as "Primary Assets" (which can be discovered, loaded by ID, and participate in cooking/chunking rules). Experiences, Pawn Data, etc., are typically Primary Assets.
* **Centralized Asset Access:** Provides static helper functions (`GetAsset`, `GetSubclass`) for synchronously loading assets referenced by soft pointers (`TSoftObjectPtr`, `TSoftClassPtr`) and optionally keeping them in memory.
* **Global Game Data Loading:** Responsible for loading a central `ULyraGameData` asset (defined in config), which can hold references to other globally important data (like default gameplay effects or system-wide settings).
* **Startup Initialization:** Performs specific initialization tasks during engine startup (`StartInitialLoading`), such as initializing the `ULyraGameplayCueManager` and processing a list of "startup jobs."
* **Editor Integration:** Includes PIE-specific preloading logic (`PreBeginPIE`).
* **Debugging:** Offers functionality to dump currently loaded/tracked assets (`DumpLoadedAssets`).

### Key Functions and Features

> [!info]
> These internal functions support the framework and generally don’t require direct use in typical game development.

* **`Get()` (Static Function):**
  * Returns the singleton instance of `ULyraAssetManager`. Fatal errors if the `AssetManagerClassName` in `DefaultEngine.ini` is not correctly set to this class or a derivative.
* **Synchronous Asset Loading Helpers:**
  * `GetAsset<AssetType>(const TSoftObjectPtr<AssetType>& AssetPointer, bool bKeepInMemory = true)`: Resolves a `TSoftObjectPtr`, synchronously loads the asset if not already in memory, and optionally adds it to an internal `LoadedAssets` set to prevent it from being garbage collected if `bKeepInMemory` is true.
  * `GetSubclass<AssetType>(const TSoftClassPtr<AssetType>& AssetPointer, bool bKeepInMemory = true)`: Similar to `GetAsset`, but for `TSoftClassPtr`, returning a `TSubclassOf<AssetType>`.
  * `SynchronousLoadAsset(const FSoftObjectPath& AssetPath)`: The internal function used by the helpers to perform the actual blocking load via `UAssetManager::GetStreamableManager().LoadSynchronous()`.
* **`GetGameData()` / `GetOrLoadTypedGameData<GameDataClass>(...)`:**
  * Loads and returns the `ULyraGameData` asset specified by `LyraGameDataPath` (configured in `DefaultGame.ini`).
  * Uses a map (`GameDataMap`) to cache loaded game data assets by class.
  * Performs a blocking load if the data isn't already in memory.
* **`GetDefaultPawnData() const`:**
  * Loads and returns the `ULyraPawnData` asset specified by `DefaultPawnData` (configured in `DefaultGame.ini`). This is used by the Game Mode as a fallback if no other Pawn Data is specified.
* **`StartInitialLoading()`:**
  * Overridden from `UAssetManager`. Called early during engine startup.
  * Calls `Super::StartInitialLoading()`.
  * **Queues Startup Jobs:** Defines a series of startup tasks using a macro pattern (e.g., `STARTUP_JOB(InitializeGameplayCueManager)`). These jobs are simple lambda functions with associated names and weights.
    * Example Job: `InitializeGameplayCueManager()` calls `ULyraGameplayCueManager::Get()->LoadAlwaysLoadedCues()`.
    * Example Job: `GetGameData()` ensures the global game data is loaded.
  * Calls `DoAllStartupJobs()` to process these queued tasks.
* **`DoAllStartupJobs()`:**
  * Iterates through the `StartupJobs` array.
  * Executes each job's function.
  * For non-dedicated servers, it updates a load percentage (`UpdateInitialGameContentLoadPercent`) based on job weights, which could theoretically feed into an early startup loading screen (though Lyra's main loading screens are usually tied to Experience loading).
* **`InitializeGameplayCueManager()`:** A specific startup job that gets the `ULyraGameplayCueManager` and calls `LoadAlwaysLoadedCues()` on it.
* **`AddLoadedAsset(const UObject* Asset)`:** Adds an asset to an internal `LoadedAssets` set (thread-safe) to help keep it in memory if requested by `GetAsset`/`GetSubclass`.
* **`DumpLoadedAssets()` (Static Function, Console Command):** A debug utility (console command `Lyra.DumpLoadedAssets`) that logs all assets currently tracked in the `LoadedAssets` set.
* **Editor Specific (`PreBeginPIE`):**
  * Loads the global `ULyraGameData`.
  * Could be extended to preload other assets commonly needed for PIE sessions based on default experiences.

### Configuration (`DefaultEngine.ini`)

For the engine to use the asset manager, you must specify it in `Config/DefaultEngine.ini`:

```ini
;This configures the default LyraWorldSettings
[/Script/Engine.Engine]
AssetManagerClassName=/Script/LyraGame.LyraAssetManager
```

### Role in Experience Loading

* When `ULyraExperienceManagerComponent` needs to load an `ULyraExperienceDefinition` (which is a Primary Asset), it uses the `UAssetManager` (specifically `ULyraAssetManager::Get()`) to resolve the `FPrimaryAssetId` to an asset path and to request the loading of the asset and its dependencies.
* The Asset Manager's bundle system (`ChangeBundleStateForPrimaryAssets`) is also used by the Experience Manager to load specific asset bundles (e.g., Client/Server specific assets) associated with Experiences and Actions.

***

The `ULyraAssetManager` is a critical engine singleton customized by Lyra to handle the loading of global game data, manage early startup tasks like Gameplay Cue initialization, and provide convenient, synchronous loading functions for assets referenced by soft pointers. It underpins the loading of Experiences and other Primary Assets used throughout the game.
