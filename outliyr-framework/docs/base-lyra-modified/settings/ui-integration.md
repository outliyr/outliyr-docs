---
description: 'UI Integration: The ULyraGameSettingRegistry – Bridging Backend and Frontend'
---

# UI Integration

While `ULyraSettingsShared` and `ULyraSettingsLocal` manage the actual storage and application of game settings, the `ULyraGameSettingRegistry` is the central orchestrator for how these settings are discovered, organized, and presented to the player through the user interface. It leverages Unreal Engine's **GameSettings Plugin** (part of CommonUI) to create a data-driven approach to building settings screens.

***

#### **Role of the GameSettings Plugin in Lyra**

Before diving into `ULyraGameSettingRegistry` itself, it's important to understand the GameSettings Plugin it's built upon. This plugin provides a framework for:

* **Defining Settings Abstractly:** Representing individual game settings as C++ objects (`UGameSetting`).
* **Organizing Settings:** Grouping settings into collections and pages (`UGameSettingCollection`, `UGameSettingCollectionPage`) that map naturally to UI layouts.
* **Data Binding:** Linking these `UGameSetting` objects to actual C++ properties and functions that get and set their values.
* **UI Agnostic Definition:** Allowing settings to be defined in C++ without being tightly coupled to a specific UMG widget implementation. The UI can then query the registry for settings and build itself accordingly.

Lyra makes extensive use of this plugin to create its settings menus.

***

#### **`ULyraGameSettingRegistry`: The Central Hub**

The `ULyraGameSettingRegistry` class, derived from the plugin's `UGameSettingRegistry`, acts as the primary point of contact for the UI when it needs to display game settings. Each local player in Lyra will have an instance of this registry.

* **Purpose:**
  * To **discover and instantiate** all the `UGameSetting` objects that represent the various configurable options in Lyra.
  * To **organize** these settings into logical groups (e.g., Video, Audio, Gameplay) that the UI can then present as distinct sections or tabs.
  * To **manage the lifecycle** of these setting objects.
  * To provide a unified interface for the UI to **read current setting values, display options, and commit changes**.
* **Initialization Process (`OnInitialize`)**:
  * This is the most critical method within `ULyraGameSettingRegistry`. When the registry is initialized for a `ULyraLocalPlayer`, `OnInitialize` is called.
  * Inside this method, Lyra calls several helper functions (e.g., `InitializeVideoSettings`, `InitializeAudioSettings`, `InitializeGameplaySettings`, `InitializeMouseAndKeyboardSettings`, `InitializeGamepadSettings`).
  * Each of these helper functions is responsible for:
    1. Creating `UGameSettingCollection` objects to represent main categories or pages (e.g., "Video," "Audio").
    2. Populating these collections with specific `UGameSettingValue` derived objects (e.g., `UGameSettingValueDiscreteDynamic_Enum` for a dropdown, `UGameSettingValueScalarDynamic` for a slider).
    3. Crucially, **binding** these `UGameSettingValue` objects to the actual C++ getters and setters within `ULyraSettingsShared` or `ULyraSettingsLocal`.
  * Finally, each top-level `UGameSettingCollection` is registered with the base `UGameSettingRegistry` using `RegisterSetting()`.
* **Structure of Settings:**
  * **`UGameSettingCollection`:** These act as containers, often representing a tab or a major section in the settings UI (e.g., "Video"). They can contain other collections or individual setting objects.
  * **`UGameSettingCollectionPage`:** A specialized collection that usually implies navigation to a new screen or a more detailed sub-menu (e.g., "Performance Stats" page within the "Video" section).
  * **`UGameSettingValue` Derived Classes:** These represent the individual, interactive settings:
    * `UGameSettingValueDiscreteDynamic_Enum`: For settings chosen from a list of enum values (e.g., Colorblind Mode).
    * `UGameSettingValueScalarDynamic`: For settings represented by a normalized (0-1) scalar value, often displayed as a slider (e.g., Volume, Brightness).
    * `UGameSettingValueDiscreteDynamic_Bool`: For boolean on/off toggles (e.g., VSync).
    * `UGameSettingValueDiscreteDynamic_Number`: For selecting from a list of predefined numbers (e.g., Frame Rate Limit).
    * **Custom Lyra Types:** Lyra also defines several custom `UGameSettingValue` classes for more complex scenarios, such as:
      * `ULyraSettingValueDiscrete_Resolution`: Handles screen resolution selection.
      * `ULyraSettingKeyboardInput`: Manages individual keybinding rows for Enhanced Input.
      * `ULyraSettingValueDiscrete_PerfStat`: For configuring individual performance stat displays.
      * `ULyraSettingValueDiscrete_MobileFPSType`: For mobile frame rate selection.

***

#### **Connecting UI to Backend C++: The Magic of Data Sources**

The power of the GameSettings plugin, and Lyra's use of it, comes from how UI setting objects are linked to the C++ backend. This is primarily achieved through `FGameSettingDataSourceDynamic` and helper macros.

* **`SetDynamicGetter()` and `SetDynamicSetter()`:**
  * When a `UGameSettingValue` object (like `UGameSettingValueScalarDynamic`) is created in the registry, its `SetDynamicGetter()` and `SetDynamicSetter()` methods are called.
  * These methods take an `FGameSettingDataSourceDynamic` object.
* **`FGameSettingDataSourceDynamic`:**
  * This object essentially stores a "path" of function names as an array of strings. This path tells the GameSettings system how to navigate from the `ULocalPlayer` to the final C++ function that gets or sets the setting's value.
* **Helper Macros:** Lyra uses preprocessor macros to simplify the creation of these data source paths:
  * **`GET_SHARED_SETTINGS_FUNCTION_PATH(FunctionOrPropertyName)`:**
    * Expands to a path like: `ULyraLocalPlayer::GetSharedSettings()` -> `ULyraSettingsShared::FunctionOrPropertyName()`.
    * Used for settings stored in `ULyraSettingsShared`.
    * Example: `Setting->SetDynamicGetter(GET_SHARED_SETTINGS_FUNCTION_PATH(GetColorBlindMode));`
  * **`GET_LOCAL_SETTINGS_FUNCTION_PATH(FunctionOrPropertyName)`:**
    * Expands to a path like: `ULyraLocalPlayer::GetLocalSettings()` -> `ULyraSettingsLocal::FunctionOrPropertyName()`.
    * Used for settings stored in `ULyraSettingsLocal`.
    * Example: `Setting->SetDynamicGetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(GetOverallVolume));`

When the UI needs to display a setting's current value, the GameSettings system uses the dynamic getter's path to invoke the correct C++ functions. Similarly, when the player changes a value in the UI, the dynamic setter's path is used to call the appropriate C++ setter.

***

#### **Edit Conditions & Dependencies**

Not all settings are relevant or editable in every context. `ULyraGameSettingRegistry` uses edit conditions to control the visibility and interactivity of settings:

* **`AddEditCondition(FGameSettingEditConditionRef Condition)`:**
  * `UGameSetting` objects can have one or more edit conditions associated with them.
  * An `FGameSettingEditCondition` is an object that can evaluate the current game state (e.g., platform, player status) and determine if a setting should be visible, enabled, or disabled.
  * Lyra uses various conditions:
    * `FWhenPlatformHasTrait`: Checks if the current platform has a specific gameplay tag (e.g., `TAG_Platform_Trait_SupportsWindowedMode`).
    * `FWhenPlayingAsPrimaryPlayer`: Ensures a setting is only available to the primary local player.
    * Custom conditions like `FGameSettingEditCondition_FramePacingMode` (checks the current frame pacing mode defined in `ULyraPlatformSpecificRenderingSettings`).
* **`AddEditDependency(UGameSetting* OtherSetting)`:**
  * Some settings can influence the state or available options of others (e.g., the "Overall Quality" preset affects individual graphics settings). Dependencies ensure that if a parent setting changes, dependent settings are re-evaluated or updated.

***

#### **Saving Changes from the UI**

When the player interacts with the settings UI and decides to apply their changes, the following typically occurs:

1. The UI framework (often via an "Apply" button) triggers a call to `ULyraGameSettingRegistry::SaveChanges()`.
2. `ULyraGameSettingRegistry::SaveChanges()` first calls `Super::SaveChanges()`. This allows the base `UGameSettingRegistry` to perform its own logic, which might involve notifying individual `UGameSetting` objects that they should store their pending values into their C++ backend via their dynamic setters.
3. After the super call, `ULyraGameSettingRegistry::SaveChanges()` explicitly calls:
   * `LocalPlayer->GetLocalSettings()->ApplySettings(false)`: This applies changes in `ULyraSettingsLocal` (like graphics settings) and usually triggers a save of `GameUserSettings.ini`. The `false` argument typically means "don't check for resolution confirmation."
   * `LocalPlayer->GetSharedSettings()->ApplySettings()`: This applies changes in `ULyraSettingsShared` to the relevant game subsystems.
   * `LocalPlayer->GetSharedSettings()->SaveSettings()`: This saves the `ULyraSettingsShared` object to its `.sav` file and also triggers a save for `UEnhancedInputUserSettings`.

This comprehensive save process ensures that all modifications made through the UI are persisted and correctly applied to the game.

***

#### **Custom UI Setting Widgets & Display**

While the GameSettings plugin promotes a data-driven approach, Lyra also employs custom UMG widgets for certain settings that require more specialized UI than what a generic slider or dropdown can provide.

* **`ULyraSettingsListEntrySetting_KeyboardInput`:** A custom widget row designed to display and manage a single keybinding from the Enhanced Input system, providing buttons for primary key, secondary key, clear, and reset. It directly interacts with an `ULyraSettingKeyboardInput` object (which is a `UGameSettingValue` derivative).
* **`ULyraSafeZoneEditor` & `ULyraBrightnessEditor`:** These are modal-like, activatable widgets that provide a dedicated, full-screen interface for adjusting safe zone boundaries and display brightness, respectively. They are launched as "actions" from simpler `UGameSettingAction` objects defined in the registry.

These custom widgets still interface with the `UGameSetting` objects defined in the registry, ensuring that the underlying data flow and saving mechanisms remain consistent.

***

The `ULyraGameSettingRegistry` is the linchpin that connects the robust backend settings logic of `ULyraSettingsShared` and `ULyraSettingsLocal` with a flexible, data-driven UI system. Understanding its role is key to modifying existing settings or adding new ones to Lyra's menus. The next section will discuss how Lyra specifically handles input and keybindings through the Enhanced Input system.
