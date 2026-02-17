# Machine-Specific Configurations

Complementing `ULyraSettingsShared`, the `ULyraSettingsLocal` class is responsible for managing game settings that are specific to the local machine or hardware configuration. These are settings that typically wouldn't make sense to roam with a player to a different device, as they are often tied to the capabilities of the current system.

***

### **Purpose and Scope**

`ULyraSettingsLocal` handles configurations that affect how the game runs and presents itself on the current hardware. This includes performance-related adjustments, display settings, and audio output choices tied to the local setup.

**Key characteristics of settings managed by `ULyraSettingsLocal`:**

* **Machine-Dependent:** They relate to the specific hardware (GPU, CPU, monitor, audio devices) of the machine the game is running on.
* **Performance Tuning:** Many settings directly impact game performance and visual fidelity.
* **Local Persistence:** Saved locally, typically not intended for cloud synchronization.
* **Common Examples in Lyra:**
  * **Graphics Quality:** Resolution, VSync, texture quality, shadow quality, anti-aliasing, view distance, post-processing effects, global illumination, etc. (managed by Unreal's Scalability system).
  * **Frame Rate Limits:** Different limits for various scenarios (in-menu, on-battery, backgrounded, always).
  * **Audio Settings:** Master volume, music volume, SFX volume, dialogue volume, voice chat volume, selected audio output device, 3D headphone mode (HRTF), HDR audio mode.
  * **Display Settings:** Brightness/Gamma, UI Safe Zone.
  * **Performance Statistics Display:** Configuration for on-screen performance metrics (FPS, ping, latency markers).
  * **Controller Hardware Type:** (e.g., Xbox, PlayStation icons) if multiple controller types are supported on the platform.
  * **Replay System:** Settings for auto-recording replays.

***

### **Key Class Features**

`ULyraSettingsLocal` is built upon `UGameUserSettings`, Unreal Engine's standard class for managing such machine-specific user configurations.

* **Inheritance:** `UGameUserSettings`.
* **Singleton Access:** Provides a static `Get()` method for easy global access to the single instance managed by the engine.
* **Configuration File:** Settings are typically saved to and loaded from `GameUserSettings.ini` located in the game's saved data directory (e.g., `Saved/Config/[Platform]/GameUserSettings.ini`).
* **Core Properties:** Contains various `UPROPERTY(Config)` members representing each setting. The `Config` specifier ensures these properties are automatically handled by the `UGameUserSettings` saving/loading mechanism.
* **Overrides of `UGameUserSettings`:** Lyra extends and customizes several standard `UGameUserSettings` functions:
  * `SetToDefaults()`: Resets all local settings to their predefined default values.
  * `LoadSettings()`: Loads settings from `GameUserSettings.ini` at startup or when forced.
  * `ApplyNonResolutionSettings()`: Applies all settings _except_ screen resolution (which often requires a separate confirmation step by the user due to its potentially disruptive nature).
  * `ApplyScalabilitySettings()`: Specifically applies the detailed graphics quality settings to the engine's Scalability system.
  * `SetOverallScalabilityLevel()`: Allows setting a global quality preset (Low, Medium, High, Epic) which then influences individual scalability groups.
  * `GetEffectiveFrameRateLimit()`: Calculates the actual frame rate limit to apply based on various conditions (menu, battery, backgrounded).

***

### **Saving & Loading Mechanism**

Persistence for `ULyraSettingsLocal` leverages the `UGameUserSettings` framework.

* **Storage:** Settings are saved in a human-readable INI format in `GameUserSettings.ini`.
* **Automatic Handling:** The engine and `UGameUserSettings` base class handle much of the loading at startup and saving when `SaveSettings()` (from `UGameUserSettings`) is called.
* **Applying Settings:**
  * Changes made to `ULyraSettingsLocal` properties are not always immediately active.
  * `ApplyNonResolutionSettings()` is typically called to make most changes take effect.
  * `ApplySettings(false)` (from `UGameUserSettings`, which `ULyraSettingsLocal` can call) is a common way to apply changes and trigger a save.
  * Resolution changes are often handled separately via `ConfirmVideoMode()` after the user accepts them.

***

### **Scalability and Graphics Management**

A significant portion of `ULyraSettingsLocal` is dedicated to managing graphics quality and performance.

* **Scalability System:** Lyra deeply integrates with Unreal Engine's built-in Scalability system (`sg.*` console variables for ViewDistance, Shadows, Textures, etc.).
* **`FLyraScalabilitySnapshot`:** A utility struct used to capture and apply sets of scalability quality levels.
* **Overall Quality Presets:** The `SetOverallScalabilityLevel()` function allows users to select high-level presets (e.g., Low, Medium, High, Epic), which then set multiple individual scalability CVars.
* **Granular Control:** Users can also often adjust individual scalability settings if `bEnableScalabilitySettings` (from `ULyraPlatformSpecificRenderingSettings`) is true.
* **Device Profiles:** Lyra uses Unreal's Device Profile system to define different base levels of quality or performance targets, especially for consoles or different tiers of mobile hardware.
  * `DesiredUserChosenDeviceProfileSuffix`: Allows selection of profiles like "Performance" or "Quality" on consoles, which might adjust underlying CVars or even target frame rates.
* **Mobile Specifics:**
  * Extensive logic for handling mobile frame rate limits (`MobileFrameRateLimit`, `DesiredMobileFrameRateLimit`) and how they interact with quality settings.
  * CVars like `Lyra.DeviceProfile.Mobile.OverallQualityLimits` and `Lyra.DeviceProfile.Mobile.ResolutionQualityLimits` allow for dynamic adjustments of quality based on the chosen frame rate to maintain performance targets.
* **Frame Rate Limiting:**
  * Manages various frame rate limits: `FrameRateLimit_OnBattery`, `FrameRateLimit_InMenu`, `FrameRateLimit_WhenBackgrounded`, and the general `FrameRateLimit` (from `UGameUserSettings`).
  * `UpdateEffectiveFrameRateLimit()` calculates the most restrictive applicable limit and applies it.

***

### **Audio Configuration**

`ULyraSettingsLocal` manages key audio settings that are often tied to the local machine's setup.

* **Volume Controls:**
  * Properties like `OverallVolume`, `MusicVolume`, `SoundFXVolume`, `DialogueVolume`, `VoiceChatVolume`.
  * These volumes are applied by interacting with Unreal's Audio Modulation system, specifically by loading a `USoundControlBusMix` (defined in `ULyraAudioSettings`) and adjusting the levels of individual `USoundControlBus` objects (e.g., "Overall," "Music"). This is typically done within the setters for these volume properties or in `ApplyNonResolutionSettings()`.
* **Audio Output Device:**
  * `AudioOutputDeviceId`: Stores the ID of the selected audio output device.
  * `OnAudioOutputDeviceChanged` event: Broadcasts when the device changes, allowing UI or other systems to react.
* **Spatial Audio / HDR:**
  * `bUseHeadphoneMode` (for HRTF/3D audio spatialization).
  * `bUseHDRAudioMode` (for high dynamic range audio processing).
  * These settings often toggle specific audio processing chains or console variables.

***

### **Other Notable Settings**

* **Display Gamma:** `DisplayGamma` property, applied via `GEngine->DisplayGamma`.
* **Safe Zone:** `SafeZoneScale`, applied via `SSafeZone::SetGlobalSafeZoneScale()`.
* **Performance Statistics:** Manages which on-screen performance stats (FPS, ping, etc.) are visible and their display mode (text, graph, both) using `ELyraDisplayablePerformanceStat` and `ELyraStatDisplayMode`.
* **Latency Tracking:** Settings
