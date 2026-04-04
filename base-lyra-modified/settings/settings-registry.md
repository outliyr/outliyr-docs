# Settings Registry

The settings screen doesn't define its layout in UMG. A C++ registry creates setting objects, organizes them into categories and pages, and binds each one to a backend getter and setter. When the UI opens, it reads the registry and builds itself dynamically, no designer-authored widget tree required. This system is built on Unreal's **GameSettings** plugin.

***

### The GameSettings Plugin Foundation

The GameSettings plugin provides the framework that the settings screen is built on:

* **`UGameSetting`** represents a single setting, a name, description, value type, getter, setter, and optional edit conditions.
* **`UGameSettingCollection`** groups settings into named sections (e.g., "Volume," "Graphics Quality"). Collections nest inside other collections to create hierarchy.
* **`UGameSettingCollectionPage`** (extends `UGameSettingCollection`) creates a sub-page that the UI navigates into rather than displaying inline. The Subtitles options in Audio are an example, they appear as a navigable link rather than an inline list.

Settings are defined entirely in C++ and are UI-agnostic. The registry decides _what_ settings exist and _how_ they bind to data. The UI decides _how_ they render.

Lyra extends this foundation with **`ULyraGameSettingRegistry`**, which creates every setting the game exposes to players.

***

### How the Registry Initializes

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Registry created per local player**

When the settings screen opens, `ULyraGameSettingRegistry::Get()` is called with the current `ULyraLocalPlayer`. If a registry already exists on that player, it is reused. Otherwise, a new one is created and `Initialize()` is called.
<!-- gb-step:end -->

<!-- gb-step:start -->
**`OnInitialize` builds all settings**

The override calls five category-specific functions, each returning a `UGameSettingCollection`:

* `InitializeVideoSettings()` (plus `InitializeVideoSettings_FrameRates` and `AddPerformanceStatPage` as sub-steps)
* `InitializeAudioSettings()`
* `InitializeGameplaySettings()`
* `InitializeMouseAndKeyboardSettings()`
* `InitializeGamepadSettings()`
<!-- gb-step:end -->

<!-- gb-step:start -->
**Each function creates and registers settings**

Inside each function, individual `UGameSetting` objects are created, given a dev name and display name, bound to a dynamic getter and setter, assigned edit conditions, and added to their parent collection.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Collections registered on the registry**

After each initialization function returns, the resulting collection is stored on the registry (e.g., `VideoSettings`, `AudioSettings`) and registered via `RegisterSetting()`, making it available for the UI to enumerate.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Initialization gated on shared settings**

`IsFinishedInitializing()` returns false until the local player's shared settings object is loaded. This prevents the UI from displaying before all backend data is available.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

### Five Categories

* **Video** — window mode, resolution, graphics quality, colorblind options, frame rates, and performance stat overlays
* **Audio** — volume levels (overall, music, sound effects, dialogue, voice chat), audio output device, headphone mode, subtitles, and background audio
* **Gameplay** — language, safe zone adjustment, brightness
* **Mouse & Keyboard** — look sensitivity, axis inversion, and all keybindings (one entry per mappable action)
* **Gamepad** — sensitivity presets, look stick deadzones, controller platform override, and gamepad bindings

***

### Data Source Binding

Each setting has a dynamic getter and a dynamic setter that tell it where to read and write its value. Rather than hard-coding function pointers, the system uses **property path resolution**, a chain of function name strings that is walked at runtime starting from the `ULocalPlayer`.

Two macros in `LyraGameSettingRegistry.h` create these paths:

```cpp
GET_SHARED_SETTINGS_FUNCTION_PATH(FunctionOrPropertyName)
```

Builds a path that resolves through `ULyraLocalPlayer::GetSharedSettings()` to a function or property on **`ULyraSettingsShared`**. Used for per-player preferences: sensitivity, subtitles, colorblind mode, background audio.

```cpp
GET_LOCAL_SETTINGS_FUNCTION_PATH(FunctionOrPropertyName)
```

Builds a path that resolves through `ULyraLocalPlayer::GetLocalSettings()` to a function or property on **`ULyraSettingsLocal`**. Used for per-machine settings: volume levels, resolution, graphics quality, frame rate limits.

Both macros produce a `TSharedPtr<FGameSettingDataSourceDynamic>` containing an array of two function name strings. When the UI needs a value, the data source resolves the path by calling the first function on the local player to get the settings object, then calling the second function on that object to get or set the value.

A typical binding looks like this in practice:

```cpp
Setting->SetDynamicGetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(GetOverallVolume));
Setting->SetDynamicSetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(SetOverallVolume));
```

The getter and setter don't have to use the same function, some settings read from a property directly but write through a setter that performs validation or triggers side effects.

<details class="gb-toggle">

<summary>In code: FGameSettingDataSourceDynamic</summary>

The macro produces a `TSharedRef<FGameSettingDataSourceDynamic>` containing function name strings. The dynamic resolution walks these strings at runtime via `UObject::FindFunction()`. This is why getter/setter names must be `UFUNCTION()`, the resolution system finds them by name.

```cpp
#define GET_SHARED_SETTINGS_FUNCTION_PATH(FunctionOrPropertyName)        \
    MakeShared<FGameSettingDataSourceDynamic>(TArray<FString>({           \
        GET_FUNCTION_NAME_STRING_CHECKED(ULyraLocalPlayer, GetSharedSettings), \
        GET_FUNCTION_NAME_STRING_CHECKED(ULyraSettingsShared, FunctionOrPropertyName) \
    }))
```

</details>

***

### Setting Types

| Type                                      | UI Widget   | Example                                                                |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `UGameSettingValueDiscreteDynamic_Bool`   | Toggle      | VSync, Subtitles, Headphone Mode                                       |
| `UGameSettingValueScalarDynamic`          | Slider      | Volume, Brightness                                                     |
| `UGameSettingValueDiscreteDynamic_Number` | Dropdown    | Frame Rate Limit                                                       |
| `UGameSettingValueDiscreteDynamic_Enum`   | Dropdown    | Colorblind Mode, Subtitle Text Size                                    |
| `UGameSettingAction`                      | Button      | Safe Zone Calibration, Brightness Calibration                          |
| Custom types                              | Specialized | Resolution, Keybinding, Overall Quality, Audio Output Device, Language |

Custom types encapsulate complex behavior (conflict detection for keybindings, async device enumeration for audio output) inside their own `UGameSetting` subclass. The registry creates them the same way it creates simple settings, the UI does not need special knowledge of their internal logic.

<details class="gb-toggle">

<summary>Custom Setting Types</summary>

Most settings are straightforward values: a toggle, a slider, or a dropdown. But some need behavior that goes beyond picking a value from a list.

**Keyboard input binding** needs to capture a key press modally, detect conflicts with other bindings, and support primary and secondary key slots per action. Each mappable action in the Enhanced Input system gets its own setting instance, initialized from the player's key profile.

**Resolution selection** needs to filter its list of available resolutions based on the current window mode. Fullscreen, windowed fullscreen, and windowed each expose different resolution sets. When the window mode changes, the resolution setting rebuilds its options and selects the closest match to the previous choice.

**Overall quality** needs to detect when individual scalability group settings (shadows, textures, effects, etc.) have been adjusted independently. When they no longer match a preset, the dropdown shows "Custom" as an extra option that wouldn't normally appear.

**Audio output device** needs to enumerate available audio devices asynchronously and handle hot-swapping, devices can appear or disappear while the settings screen is open.

**Mobile FPS** needs to enforce quality constraints. Selecting a high frame rate on mobile may require clamping graphics quality downward to maintain performance.

Each of these has a dedicated setting class that encapsulates the complex behavior internally. The registry creates them the same way it creates simple settings, the UI doesn't need to know about the special logic.

</details>

***

### Edit Conditions

Not every setting makes sense on every platform or in every context. Edit conditions control when a setting is visible and when it is interactable.

**Platform traits** restrict settings to hardware that supports them. HDR settings only appear on platforms with HDR support. The audio output device selector is killed entirely on platforms that don't support changing it. Lyra favors traits (gameplay tags) over `#if PLATFORM_` preprocessor checks because traits can be emulated in PIE for testing and don't scatter platform logic across the codebase.

<details class="gb-toggle">

<summary>In code: FWhenPlatformHasTrait</summary>

`FWhenPlatformHasTrait` checks a gameplay tag representing a platform capability. `KillIfMissing` hides the setting entirely if the trait is absent:

```cpp
Setting->AddEditCondition(
    FWhenPlatformHasTrait::KillIfMissing(
        TAG_Platform_Trait_SupportsWindowedMode,
        TEXT("Platform does not support window mode")));
```

Common traits include `Platform.Trait.SupportsWindowedMode`, `Platform.Trait.Input.SupportsGamepad`, and `Platform.Trait.NeedsBrightnessAdjustment`.

</details>

**Context conditions** respond to the current value of other settings. Resolution disables itself in borderless fullscreen (locked to display resolution). The overall quality dropdown shows "Custom" when individual scalability settings have been manually adjusted. These conditions use lambdas that receive the current game state and can disable or hide the setting with an explanatory message.

<details class="gb-toggle">

<summary>In code: FWhenCondition + AddEditDependency</summary>

`FWhenCondition` takes a lambda that evaluates the condition. `AddEditDependency` ensures the condition re-evaluates when the dependency changes:

```cpp
ResolutionSetting->AddEditDependency(WindowModeSetting);
ResolutionSetting->AddEditCondition(MakeShared<FWhenCondition>(
    [WindowModeSetting](const ULocalPlayer*, FGameSettingEditableState& InOutEditState)
    {
        if (WindowModeSetting->GetValue<EWindowMode::Type>() == EWindowMode::WindowedFullscreen)
        {
            InOutEditState.Disable(LOCTEXT("Res_Disabled",
                "Resolution is automatic in fullscreen borderless."));
        }
    }));
```

Without the dependency, the resolution setting would only evaluate its condition once at initialization, it wouldn't react when the player changes window mode.

</details>

**Primary player restrictions** apply in splitscreen. Settings like audio device selection or display resolution only make sense for the primary local player, other players shouldn't be able to change machine-wide settings.

<details class="gb-toggle">

<summary>In code: FWhenPlayingAsPrimaryPlayer</summary>

`FWhenPlayingAsPrimaryPlayer` is a singleton condition, call `Get()` to share the same instance across settings:

```cpp
Setting->AddEditCondition(FWhenPlayingAsPrimaryPlayer::Get());
```

</details>

Edit conditions produce three severity levels:

* **Kill** — removes the setting from the UI entirely (the player never sees it)
* **Disable** — greys the setting out with an explanatory message
* **Read-only** — prevents editing without visual greying

Dependencies (`AddEditDependency`) make conditions reactive, when the window mode setting changes, the resolution setting's conditions re-evaluate automatically.

<img src=".gitbook/assets/image (266).png" alt="" title="V-sync not being allowed unless in fullscreen mode">

***

### UI Rendering

The UI side is separate from the registry and handles turning setting objects into visible widgets:

* **`UGameSettingPanel`** takes a registry reference via `SetRegistry()` and populates itself with widgets for each setting. It manages a navigation stack for drilling into sub-pages (`UGameSettingCollectionPage`) and handles filtering, selection, and detail display.
* **`UGameSettingVisualData`** is a data asset that maps setting types to widget classes. It holds two maps: one by `UGameSetting` subclass and one by setting dev name. When the panel needs to render a setting, `GetEntryForSetting()` looks up the appropriate `UGameSettingListEntryBase` widget. For most settings, the default class-based mapping works. Named overrides exist for settings that need a custom widget, like `ULyraSettingsListEntrySetting_KeyboardInput` for keybinding rows.
* **`UGameSettingAction`** settings appear as buttons in the list. When pressed, they fire a named action (identified by a gameplay tag) that the screen handles, typically launching a dedicated fullscreen editor like safe zone or brightness calibration.

<img src=".gitbook/assets/image (267).png" alt="" title="The Game Settings Registry Visual Data contains details on how the panel should display.">

***

### Save Flow

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Player clicks Apply**

`SaveChanges()` is called on the registry.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Base class saves**

`Super::SaveChanges()` handles any framework-level save logic.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Local settings applied and saved**

`ULyraSettingsLocal::ApplySettings()` pushes CVars, audio volumes, display changes, and frame rate limits into effect. This also triggers a save to the local .ini file.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Shared settings applied and saved**

`ULyraSettingsShared::ApplySettings()` applies per-player preferences (sensitivity, subtitles, colorblind mode). Then `SaveSettings()` writes them to a SaveGame file.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Enhanced Input bindings saved separately**

Any modified keybindings are persisted through the Enhanced Input user settings system, which has its own save path independent of the shared/local split.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

If the player cancels instead of confirming, the registry reverts any applied-but-unsaved changes.

***

<details class="gb-toggle">

<summary>Why data-driven instead of UMG layout?</summary>

Defining settings in code means the registry is the single source of truth. Adding a setting doesn't require touching the UI. Edit conditions, tooltips, and validation logic live next to the getter and setter, not scattered across widget trees. The tradeoff is that designers can't rearrange settings visually without code changes.

</details>
