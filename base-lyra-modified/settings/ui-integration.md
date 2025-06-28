# UI Integration

While `ULyraSettingsShared` and `ULyraSettingsLocal` manage the actual storage and application of game settings, the `ULyraGameSettingRegistry` is the central orchestrator for how these settings are discovered, organized, and presented to the player through the user interface. It leverages Unreal Engine's **GameSettings Plugin** (part of CommonUI) to create a data-driven approach to building settings screens.

***

### **Role of the GameSettings Plugin in Lyra**

Before diving into `ULyraGameSettingRegistry` itself, it's important to understand the GameSettings Plugin it's built upon. This plugin provides a framework for:

* **Defining Settings Abstractly:** Representing individual game settings as C++ objects (`UGameSetting`).
* **Organizing Settings:** Grouping settings into collections and pages (`UGameSettingCollection`, `UGameSettingCollectionPage`) that map naturally to UI layouts.
* **Data Binding:** Linking these `UGameSetting` objects to actual C++ properties and functions that get and set their values.
* **UI Agnostic Definition:** Allowing settings to be defined in C++ without being tightly coupled to a specific UMG widget implementation. The UI can then query the registry for settings and build itself accordingly.

Lyra makes extensive use of this plugin to create its settings menus.

***

### **`ULyraGameSettingRegistry`: The Central Hub**

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

### **Connecting UI to Backend C++: The Magic of Data Sources**

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

### Controlling Setting Interactivity: Edit Conditions & Dependencies

Not all settings are relevant or editable in every context. For instance, "Window Mode" options are meaningless on a platform that doesn't support windowing, or VSync might only be applicable in fullscreen mode. Lyra's settings system, through the GameSettings Plugin, uses **Edit Conditions** to dynamically control the state (enabled, disabled, hidden) of settings in the UI.

An **Edit Condition** (subclass of `FGameSettingEditCondition`) is responsible for evaluating the current game state and modifying an `FGameSettingEditableState` object. This state object then tells the UI framework how to present the setting. You can add one or more edit conditions to any `UGameSetting` object using its `AddEditCondition()` method.

**Common Responsibilities of Edit Conditions:**

* **Disable:** Make a setting visible but not interactive, often with an explanatory message.
* **Hide:** Completely remove a setting from the UI.
* **Prevent Resetting:** Stop a setting from being reset to its default value under certain conditions.
* **Exclude from Analytics:** Prevent a setting's state from being reported in analytics if it's not applicable.

**Key Edit Condition Types Used in Lyra:**

* **`FWhenCondition`:**
  * **Purpose:** Provides maximum flexibility by allowing you to define the condition logic directly as an inline C++ lambda function.
  * **Use Case:** Ideal for complex conditions that depend on the state of other settings or specific game logic not covered by more generic conditions.
  *   **Example (from `ULyraGameSettingRegistry_Video.cpp` for the "Vertical Sync" setting):**

      ```cpp
      // VSyncSetting is a UGameSettingValueDiscreteDynamic_Bool*
      // WindowModeSetting is a UGameSettingValueDiscreteDynamic_Enum* for the window mode

      VSyncSetting->AddEditDependency(WindowModeSetting); // VSync depends on Window Mode
      VSyncSetting->AddEditCondition(MakeShared<FWhenCondition>(
          [WindowModeSetting](const ULocalPlayer*, FGameSettingEditableState& InOutEditState)
          {
              // VSync is typically only configurable and effective in true Fullscreen mode.
              if (WindowModeSetting->GetValue<EWindowMode::Type>() != EWindowMode::Fullscreen)
              {
                  InOutEditState.Disable(LOCTEXT("FullscreenNeededForVSync", "This feature only works if 'Window Mode' is set to 'Fullscreen'."));
              }
          }
      ));
      ```

      In this example, the "Vertical Sync" setting is disabled if "Window Mode" is not set to "Fullscreen," with a message explaining why.
* **`FWhenPlatformHasTrait`:**
  * **Purpose:** Used to enable, disable, or hide settings based on Gameplay Tags defining platform capabilities (platform traits).
  * **Why Traits over `#if PLATFORM_...`?** Lyra favors platform traits because:
    * They allow for testing other platform behaviors within the editor (Play In Editor with emulated platform traits).
    * They can be dynamically re-evaluated if traits change during a session (less common, but possible).
    * It centralizes platform capability checks rather than scattering preprocessor directives.
  * **Example Traits:**
    * `Platform.Trait.SupportsWindowedMode`
    * `Platform.Trait.Input.SupportsGamepad`
    * `Platform.Trait.NeedsBrightnessAdjustment`
  *   **Example Usage (conceptual):**

      ```cpp
      // VSyncSetting is a UGameSettingValueDiscreteDynamic_Bool*
      VSyncSetting->AddEditCondition(
          FWhenPlatformHasTrait::KillIfMissing( // KillIfMissing implies Hide if trait is absent
              TAG_Platform_Trait_SupportsVSync, // A hypothetical trait
              TEXT("VSync is not supported or controllable on this platform.")
          )
      );
      ```
* **`FWhenPlayingAsPrimaryPlayer`:**
  * **Purpose:** Restricts a setting to be editable only by the primary local player in a split-screen or multi-local-player scenario.
  * **Use Case:** For settings that are global or system-wide and should not be configurable by secondary players (e.g., overall graphics quality, audio output device).
  *   **Example Usage:**

      ```cpp
      // OverallVolumeSetting is a UGameSettingValueScalarDynamic*
      OverallVolumeSetting->AddEditCondition(FWhenPlayingAsPrimaryPlayer::Get());
      ```

**How Edit Conditions Affect the UI:**

When an edit condition determines that a setting should be disabled, it can provide a reason message (as seen in the `InOutEditState.Disable(Message)` call). The UI framework is responsible for displaying this message to the user, typically as a tooltip or an informative text block next to the disabled setting. This greatly improves user experience by explaining _why_ an option is not available.

<img src=".gitbook/assets/image (4) (1) (1) (1) (1) (1).png" alt="" title="">

**Using Edit Conditions When Extending:**

When adding your own settings:

1. **Consider Context:** Think about whether your new setting is always applicable or if its availability/editability should change based on platform, other settings, or game state.
2. **Choose the Right Condition:**
   * For simple platform capability checks, use `FWhenPlatformHasTrait`.
   * For logic dependent on other settings, `FWhenCondition` with a lambda is powerful.
   * If it's a system-wide setting, consider `FWhenPlayingAsPrimaryPlayer`.
3. **Provide Clear Messages:** If disabling a setting, use `InOutEditState.Disable(LOCTEXT("...", "Your clear explanation here"));` to inform the user.

By effectively using Edit Conditions, you can create a more intelligent and user-friendly settings interface that adapts gracefully to different situations and clearly communicates limitations to the player.

***

### **Saving Changes from the UI**

When the player interacts with the settings UI and decides to apply their changes, the following typically occurs:

1. The UI framework (often via an "Apply" button) triggers a call to `ULyraGameSettingRegistry::SaveChanges()`.
2. `ULyraGameSettingRegistry::SaveChanges()` first calls `Super::SaveChanges()`. This allows the base `UGameSettingRegistry` to perform its own logic, which might involve notifying individual `UGameSetting` objects that they should store their pending values into their C++ backend via their dynamic setters.
3. After the super call, `ULyraGameSettingRegistry::SaveChanges()` explicitly calls:
   * `LocalPlayer->GetLocalSettings()->ApplySettings(false)`: This applies changes in `ULyraSettingsLocal` (like graphics settings) and usually triggers a save of `GameUserSettings.ini`. The `false` argument typically means "don't check for resolution confirmation."
   * `LocalPlayer->GetSharedSettings()->ApplySettings()`: This applies changes in `ULyraSettingsShared` to the relevant game subsystems.
   * `LocalPlayer->GetSharedSettings()->SaveSettings()`: This saves the `ULyraSettingsShared` object to its `.sav` file and also triggers a save for `UEnhancedInputUserSettings`.

This comprehensive save process ensures that all modifications made through the UI are persisted and correctly applied to the game.

***

### Visual Presentation and Custom UI for Settings

While `ULyraGameSettingRegistry` defines _what_ settings are available and their backend connections, the actual visual rendering and interaction in the UI are managed by features of the GameSettings Plugin and Lyra's specific UMG implementations.

**`UGameSettingPanel`: The Main Settings Display Area**

* (Explain UGameSettingPanel as before - it takes a registry and populates itself)

**`UGameSettingVisualData`: Mapping Settings to Widgets**

* (Explain UGameSettingVisualData as before - it maps UGameSetting types to UMG widget classes)
* Mention Lyra's default visual data asset (e.g., `GameSettingVisualData_Lyra`) and that developers usually don't need to touch this unless making broad UI style changes or adding entirely new setting widget types.

<img src=".gitbook/assets/image (5) (1) (1) (1) (1).png" alt="" width="563" title="The Game Settings Registry Visual Data contains details on how the panel should display.">

**Customizing Setting Appearance and Interaction in Lyra**

Lyra extends the basic GameSettings UI capabilities in several ways to provide a tailored experience:

* **Specialized `UGameSettingListEntry` Widgets:** For certain setting types that require a more complex UI than a standard row, Lyra uses custom UMG widgets derived from `UGameSettingListEntryBase`.
  * **Example: Keyboard Input:** The `ULyraSettingsListEntrySetting_KeyboardInput` widget provides the UI for a single keybinding, including buttons for primary/secondary keys, clear, and reset. This custom widget is then associated with the `ULyraSettingKeyboardInput` (a `UGameSettingValue` derivative) via mappings in Lyra's `UGameSettingVisualData`.
* **Launching Dedicated Editors with `UGameSettingAction`:** For settings that benefit from a full-screen or modal editing experience, Lyra uses `UGameSettingAction`.
  * A `UGameSettingAction` in the registry appears as a button in the settings list.
  * When clicked, it can execute custom C++ or Blueprint logic, often to push a new UI layer or activate a dedicated widget.
  * **Examples in Lyra:**
    * `ULyraSafeZoneEditor`: Launched via an action to provide an interactive safe zone adjustment screen.
    * `ULyraBrightnessEditor`: Similarly launched for a dedicated brightness calibration UI.
* **Implementing Real-Time Previews (e.g., for Subtitles, Colorblindness):**
  * To provide immediate visual feedback as a setting is changed (like in COD's graphics options), Lyra's settings screens often include a dedicated "preview" area.
  * This preview UMG widget typically:
    1. Becomes aware of the currently selected or focused `UGameSetting` in the list.
    2. Subscribes to change notifications. This could be the `OnSettingChanged` delegate of the `UGameSetting` itself, or it might listen to the `OnSettingChanged` event from the backend `ULyraSettingsShared` or `ULyraSettingsLocal` objects if the change is applied there first.
    3. When a change is detected, the preview widget updates its display accordingly (e.g., re-renders sample subtitle text with new size/color, applies a colorblind post-process filter to a sample image).
  * This powerful feature enhances usability but is implemented as part of the settings screen's specific UMG logic rather than being a generic feature of every `UGameSetting`.

**When to Consider These Advanced UI Techniques:**

* **Modifying `UGameSettingVisualData`:** If you want to change the default UMG widget used for _all_ instances of a standard setting type (e.g., all boolean toggles should use your new custom widget).
* **Creating Custom `UGameSettingListEntry` Widgets:** If you're introducing a new `UGameSettingValue` type that requires a unique list representation.
* **Using `UGameSettingAction`:** If a setting is best configured through a dedicated, interactive UI panel rather than a simple list entry.
* **Implementing Preview Panels:** If providing immediate visual feedback for a setting significantly improves the user's ability to configure it effectively.

For many common scenarios of adding new settings using Lyra's existing `UGameSettingValue` types, you'll get a functional UI automatically. These advanced techniques are for when you need to go beyond that standard presentation.

***

In essence, the ULyraGameSettingRegistry is pivotal for Lyra's settings UI, responsible for:

* **Organizing:** Structuring all game settings into logical collections and pages.
* **Binding:** Connecting UI representations to backend C++ data in `ULyraSettingsShared` and `ULyraSettingsLocal`.
* **Controlling Interactivity:** Utilizing Edit Conditions to dynamically enable, disable, or hide settings.
* **Facilitating Visual Presentation:** Working with GameSettings Plugin components like `UGameSettingPanel` and `UGameSettingVisualData` to render the UI, and enabling custom widgets or real-time previews for an enhanced user experience.

Understanding these functions of the registry is key to modifying or extending Lyra's settings. We will now delve into how Lyra manages input and keybindings.
