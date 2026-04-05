# Extending Settings

Adding a new setting touches two layers: the **backend** (where the value is stored and applied) and the **registry** (where the UI discovers it). This guide walks through both.

{% stepper %}
{% step %}
### Choose the Backend

* **`ULyraSettingsShared`**, follows the player across machines (sensitivity, accessibility, language). Serialized via the SaveGame system.
* **`ULyraSettingsLocal`**, tied to hardware (graphics quality, volumes, frame rates). Serialized to `GameUserSettings.ini`.
{% endstep %}

{% step %}
### Add the Property and Accessors

#### Shared Setting (example: auto-reload toggle)

```cpp
// LyraSettingsShared.h
private:
    UPROPERTY()
    bool bEnableAutoReload = true;

public:
    UFUNCTION(BlueprintCallable, Category = Settings)
    bool GetEnableAutoReload() const { return bEnableAutoReload; }

    UFUNCTION(BlueprintCallable, Category = Settings)
    void SetEnableAutoReload(bool NewValue) { ChangeValueAndDirty(bEnableAutoReload, NewValue); }
```

Shared setters use `ChangeValueAndDirty()`, which marks the save dirty and broadcasts `OnSettingChanged`.

#### Local Setting (example: motion blur quality)

```cpp
// LyraSettingsLocal.h
private:
    UPROPERTY(Config)
    int32 MotionBlurQuality = 2;

public:
    UFUNCTION(BlueprintCallable, Category = Settings)
    int32 GetMotionBlurQuality() const { return MotionBlurQuality; }

    UFUNCTION(BlueprintCallable, Category = Settings)
    void SetMotionBlurQuality(int32 NewValue) { MotionBlurQuality = FMath::Clamp(NewValue, 0, 3); }
```

Local properties use `UPROPERTY(Config)` for `.ini` serialization. Setters assign directly, the `UGameUserSettings` base handles dirtying. If the setting controls a CVar, apply it in the setter or in `ApplyNonResolutionSettings()`.
{% endstep %}

{% step %}
### Register in the UI

Open the appropriate registry file (e.g., `LyraGameSettingRegistry_Gameplay.cpp`) and create a setting object bound to your getter/setter.

#### Boolean (auto-reload)

```cpp
UGameSettingValueDiscreteDynamic_Bool* Setting = NewObject<UGameSettingValueDiscreteDynamic_Bool>();
Setting->SetDevName(TEXT("EnableAutoReload"));
Setting->SetDisplayName(LOCTEXT("AutoReload_Name", "Auto-Reload"));
Setting->SetDescriptionRichText(LOCTEXT("AutoReload_Desc", "Automatically reload when the magazine is empty."));
Setting->SetDynamicGetter(GET_SHARED_SETTINGS_FUNCTION_PATH(GetEnableAutoReload));
Setting->SetDynamicSetter(GET_SHARED_SETTINGS_FUNCTION_PATH(SetEnableAutoReload));
Setting->SetDefaultValue(GetDefault<ULyraSettingsShared>()->GetEnableAutoReload());
GameplayCollection->AddSetting(Setting);
```

#### Discrete number (motion blur)

```cpp
UGameSettingValueDiscreteDynamic_Number* Setting = NewObject<UGameSettingValueDiscreteDynamic_Number>();
Setting->SetDevName(TEXT("MotionBlurQuality"));
Setting->SetDisplayName(LOCTEXT("MotionBlur_Name", "Motion Blur"));
Setting->SetDynamicGetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(GetMotionBlurQuality));
Setting->SetDynamicSetter(GET_LOCAL_SETTINGS_FUNCTION_PATH(SetMotionBlurQuality));
Setting->SetDefaultValue(GetDefault<ULyraSettingsLocal>()->GetMotionBlurQuality());
Setting->AddOption(0, LOCTEXT("Off", "Off"));
Setting->AddOption(1, LOCTEXT("Low", "Low"));
Setting->AddOption(2, LOCTEXT("Medium", "Medium"));
Setting->AddOption(3, LOCTEXT("High", "High"));
VideoCollection->AddSetting(Setting);
```

`GET_SHARED_SETTINGS_FUNCTION_PATH` and `GET_LOCAL_SETTINGS_FUNCTION_PATH` are macros defined in `LyraGameSettingRegistry.h` that build the dynamic data-source path through `ULyraLocalPlayer` to the settings object.
{% endstep %}

{% step %}
### Add Edit Conditions (Optional)

Edit conditions control when a setting is visible or interactive.

```cpp
// Only show on platforms with a specific trait
Setting->AddEditCondition(FWhenPlatformHasTrait::KillIfMissing(
    TAG_Platform_Trait_SupportsWindowedMode, TEXT("Platform does not support window mode")));

// Disable based on another setting's value
Setting->AddEditDependency(WindowModeSetting);
Setting->AddEditCondition(MakeShared<FWhenCondition>(
    [WindowModeSetting](const ULocalPlayer*, FGameSettingEditableState& InOutEditState)
    {
        if (WindowModeSetting->GetValue<EWindowMode::Type>() == EWindowMode::WindowedFullscreen)
        {
            InOutEditState.Disable(LOCTEXT("Disabled_Reason", "Not available in windowed fullscreen."));
        }
    }));
```
{% endstep %}
{% endstepper %}

***

## UI Organization

Settings are arranged in a tree of `UGameSettingCollection` objects (sections) and `UGameSettingCollectionPage` objects (sub-pages). To add a new section, create a collection and add it to an existing parent, the UI renders the hierarchy automatically.

```cpp
UGameSettingCollection* NewSection = NewObject<UGameSettingCollection>();
NewSection->SetDevName(TEXT("MyNewSection"));
NewSection->SetDisplayName(LOCTEXT("MyNewSection_Name", "My Section"));
ParentCollection->AddSetting(NewSection);
```

***

## Modifying Existing Settings

* **Default values** - change the property initializer and `SetToDefaults()` (Local only).
* **Application logic -** update the setter, `ApplySettings()` (Shared), or `ApplyNonResolutionSettings()` (Local).
* **UI presentation** - change display name, options, or edit conditions in the registry file.

***

## Common Setting Types

| Type                                      | Use For                        |
| ----------------------------------------- | ------------------------------ |
| `UGameSettingValueDiscreteDynamic_Bool`   | Toggle (On/Off)                |
| `UGameSettingValueDiscreteDynamic_Number` | Dropdown with numbered options |
| `UGameSettingValueScalarDynamic`          | Slider (float range)           |
| `UGameSettingValueDiscreteDynamic_Enum`   | Dropdown from an enum          |
