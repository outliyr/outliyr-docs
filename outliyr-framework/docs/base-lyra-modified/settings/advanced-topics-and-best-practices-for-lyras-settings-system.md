# Advanced Topics & Best Practices for Lyra's Settings System

Once you're comfortable with the core mechanics of adding and modifying settings in Lyra, there are several advanced topics and best practices to consider. These can help you create a more robust, performant, and user-friendly settings experience.

***

#### **Asynchronous Operations: Keeping it Smooth**

Performance is critical, especially during game startup or when players are interacting with menus. Lyra's settings system, particularly for operations that might involve disk I/O, leverages asynchronous operations to prevent hitches and keep the game responsive.

* **Loading `ULyraSettingsShared`:**
  * **`AsyncLoadOrCreateSettings()`** is the preferred method for loading player-specific shared settings. It performs the disk read on a background thread and invokes a delegate upon completion. This prevents the game from stalling while waiting for the save file to load, which is crucial during initial game load or player login.
  * The synchronous `LoadOrCreateSettings()` exists but should be used sparingly and only in situations where a stall is acceptable or unavoidable (e.g., very early editor-time utilities, though less common for runtime game logic).
* **Saving Settings (`ULyraSettingsShared` and `UEnhancedInputUserSettings`):**
  * `ULyraSettingsShared::SaveSettings()` calls `AsyncSaveGameToSlotForLocalPlayer()` for its own data and `UEnhancedInputUserSettings::AsyncSaveSettings()` for input bindings.
  * Asynchronous saving means the game thread isn't blocked waiting for the write operation to complete. This is generally safe, as a failed save for settings is usually not a critical game-breaking event (though data loss is undesirable).
* **Loading `ULyraSettingsLocal`:**
  * `UGameUserSettings::LoadSettings()` (which `ULyraSettingsLocal` inherits and uses) is typically synchronous as it reads from `.ini` files. This is often done early in the engine startup sequence. If you need to force a reload during gameplay, be mindful of potential minor hitches, though `.ini` file parsing is usually quite fast.

**Best Practice:** Favor asynchronous operations for any setting-related disk I/O that might occur during gameplay or critical loading phases to maintain a smooth player experience.

***

#### **Platform-Specific Considerations & Conditional Settings**

Games often need to behave differently or offer different settings based on the platform they are running on (PC, console, mobile). Lyra's settings system provides mechanisms for this:

* **Gameplay Tags for Platform Traits:**
  * Lyra extensively uses Gameplay Tags (e.g., `TAG_Platform_Trait_SupportsWindowedMode`, `TAG_Platform_Trait_NeedsBrightnessAdjustment`, `TAG_Platform_Trait_Input_SupportsGamepad`) to identify platform capabilities. These tags are typically defined in `ICommonUIModule::GetSettings().GetPlatformTraits()`.
  * **`FWhenPlatformHasTrait` Edit Condition:** In `ULyraGameSettingRegistry`, this edit condition is used to show or hide settings based on whether the current platform possesses a specific trait tag. This allows you to, for example, only show "Window Mode" options on platforms that actually support windowing.
* **CVars for Platform-Dependent Defaults or Behavior:**
  * Console Variables (CVars) are frequently used in `ULyraSettingsLocal` and related systems to define default values or control features that might vary by platform.
  * These CVars can be set per-platform in configuration files (e.g., `WindowsDeviceProfiles.ini`, `XboxOneDeviceProfiles.ini`).
  * Examples include default mobile frame rates (`Lyra.DeviceProfile.Mobile.DefaultFrameRate`) or whether granular video quality settings are supported (`bSupportsGranularVideoQualitySettings` in `ULyraPlatformSpecificRenderingSettings`).
* **`ULyraPlatformSpecificRenderingSettings`:**
  * This class (usually accessed via `ULyraPlatformSpecificRenderingSettings::Get()`) holds platform-specific rendering configurations, like `FramePacingMode` (Console, Desktop, Mobile) or `bSupportsGranularVideoQualitySettings`. The settings system queries this class to adapt its behavior.

**Best Practice:** Utilize Gameplay Tag based edit conditions in the `ULyraGameSettingRegistry` to cleanly manage UI visibility for platform-dependent settings. Use platform-specific configuration files and CVars to adjust default backend values.

***

#### **Debugging Settings: Troubleshooting Common Issues**

When settings aren't behaving as expected, here are some common areas to investigate and tips for debugging:

* **Setting Not Appearing in UI:**
  * **Registry:** Is it correctly instantiated and added to a collection in `ULyraGameSettingRegistry`?
  * **Backend Binding:** Are `SetDynamicGetter`/`SetDynamicSetter` correctly pointing to valid functions in `ULyraSettingsShared` or `ULyraSettingsLocal`? Use the `GET_..._FUNCTION_PATH` macros carefully.
  * **Edit Conditions:** Is an edit condition unintentionally hiding the setting? Place breakpoints in the `GatherEditState` method of your conditions.
  * **Mappable Keys (for input):** Ensure "Is Player Mappable" is checked and `PlayerMappableKeySettings` (with a unique Name) is assigned in the `InputMappingContext`.
* **Setting Value Not Changing or Applying:**
  * **Setter Implementation:** Is the C++ setter in `ULyraSettingsShared` or `ULyraSettingsLocal` actually updating the property? For `ULyraSettingsShared`, is `ChangeValueAndDirty()` being called?
  * **Apply Logic:** Is the relevant `ApplySettings()` or `ApplyNonResolutionSettings()` method being called after changes? Does it contain the logic to make your setting take effect (e.g., setting a CVar, calling an engine function)?
  * **`SaveChanges()` Flow:** Trace the `ULyraGameSettingRegistry::SaveChanges()` call to ensure it correctly propagates to `ApplySettings()` and `SaveSettings()` on the backend objects.
* **Setting Not Saving/Loading:**
  * **Property Specifiers:** Is the property in `ULyraSettingsShared` marked `UPROPERTY()`? Is it `UPROPERTY(Config)` in `ULyraSettingsLocal`?
  * **Save/Load Calls:** Are `SaveSettings()` and the load operations (e.g., `AsyncLoadOrCreateSettings`) being called at appropriate times?
  * **Save File Corruption (Rare):** Occasionally, deleting the relevant `.sav` file or `GameUserSettings.ini` can resolve persistent loading issues if corruption is suspected (ensure you back them up if they contain important progress).
  * **Data Versioning (`ULyraSettingsShared`):** If you've changed the structure of your saved data, ensure `GetLatestDataVersion()` is updated and you handle potential migration if needed (though for simple additions, this is often not an issue).
* **Console Commands & CVars:**
  * Many settings in `ULyraSettingsLocal` ultimately control engine CVars. You can directly inspect or change these CVars in the console (e.g., `sg.ViewDistanceQuality`, `r.VSync`) to test their effect independently of the settings UI. This can help isolate whether an issue is in the UI/registry layer or the backend application logic.
  * Use `get [CVarName]` to see a CVar's current value and `set [CVarName] [Value]` or just `[CVarName] [Value]` to change it.
* **Output Log:** Always keep an eye on the Output Log in the editor or packaged game for errors or warnings related to settings, save/load operations, or UMG.
* **Enhanced Input Debugging:** For keybinding issues, `ShowDebug EnhancedInput` in the console is invaluable for seeing active IMCs and current mappings.

**Best Practice:** Test settings changes thoroughly across different scenarios: fresh game start (no save files), after changing and applying, and after restarting the game to ensure persistence.

***

#### **Understanding the "Why": Appreciating Lyra's Design Choices**

It's worth reiterating why Lyra's settings system, despite its multiple layers, is structured the way it is. Understanding these design choices can help you appreciate its strengths and make more informed decisions when extending it:

* **Modularity and Reusability:**
  * Separating backend logic (`ULyraSettingsShared`/`Local`) from UI registration (`ULyraGameSettingRegistry`) allows for cleaner code and potentially easier reuse of backend logic if the UI were to change drastically.
  * The GameSettings Plugin itself promotes a reusable way of defining settings.
* **Clear Separation of Data Types:**
  * Distinguishing between player-specific/roaming data and machine-specific data is crucial for a good user experience, especially in multi-platform or cloud-enabled scenarios.
* **Leveraging Engine Strengths:**
  * Using `USaveGame`, `UGameUserSettings`, and Enhanced Input means Lyra benefits from mature, tested engine systems rather than building everything from scratch. This includes their existing serialization, persistence, and platform abstraction layers.
* **Data-Driven UI:**
  * Defining settings in C++ via the registry makes it easier to add, remove, or reorder settings without needing to manually edit complex UMG hierarchies for every change. The UI can adapt to the registered settings.
* **Extensibility:**
  * While there are several interconnected parts, the system is designed with extension in mind. Adding new settings largely follows a consistent pattern.

While it might seem complex at first, this layered approach provides a robust and flexible foundation. The goal is typically to **work within this framework** by adding your settings to the appropriate backend class and registering them with the UI, rather than trying to bypass or replace large parts of it, unless you have very specific and significantly different requirements.
