# Extending Settings

A setting is contributed by the module that owns it. Your own game module, a game feature plugin and a standalone plugin all use the same mechanism, so there is one path to follow wherever the setting comes from, and none of it involves editing the settings registry.

## How a setting reaches the menu

Opening the settings screen builds a tree of pages and sections. The registry builds its own pages first, then runs every registered contributor over that tree, then registers the result. A contributor is handed a view of the tree while it is still being built, and through that view it can resolve any page or section by name, place settings inside them, add pages of its own, and reach the settings that are already there.

Contributors run before the tree is registered for a reason worth knowing: registering a page walks it once to subscribe to the settings it finds, so a setting added after that walk would never report its own changes.

## Adding a setting

Three pieces: a function that builds your settings, a registration so it runs, and somewhere for the value to live.

Register during your module's startup. That is early enough that the setting is present in the main menu, before any match has been played, and it stays present for the rest of the session. Unregister as the module shuts down so a reload does not leave two registrations behind.

The name you register under does two things. It identifies you in any warning about your settings, and it fixes where your settings sit relative to other contributors, because contributors run in name order rather than in the order they happened to register.

<details>

<summary>Contributing a toggle to the audio page</summary>

```cpp
// In your module's implementation file.
#include "Extension/GameSettingExtensions.h"
#include "GameSettingValueDiscreteDynamic.h"
#include "Settings/LyraExtensionSettingDataSource.h"

#define LOCTEXT_NAMESPACE "MyPlugin"

static const FName VoiceChatEnabledKey(TEXT("MyPlugin.VoiceChatEnabled"));

static void ContributeMySettings(FGameSettingExtensionContext& Context)
{
    UGameSettingValueDiscreteDynamic_Bool* Setting = NewObject<UGameSettingValueDiscreteDynamic_Bool>();
    Setting->SetDevName(TEXT("MyPlugin_VoiceChatEnabled"));
    Setting->SetDisplayName(LOCTEXT("VoiceChat_Name", "Voice Chat"));
    Setting->SetDescriptionRichText(LOCTEXT("VoiceChat_Desc", "Hear and speak to your team."));

    const TSharedRef<FLyraExtensionSettingDataSource> Source = MakeShared<FLyraExtensionSettingDataSource>(
        VoiceChatEnabledKey, ELyraExtensionSettingStorage::SharedWithPlayer, TEXT("true"));

    Setting->SetDynamicGetter(Source);
    Setting->SetDynamicSetter(Source);
    Setting->SetDefaultValue(true);

    Context.AddSetting(TEXT("AudioCollection"), Setting);
}

void FMyPluginModule::StartupModule()
{
    FGameSettingExtensions::RegisterContributor(TEXT("MyPlugin"),
        FGameSettingExtensionDelegate::CreateStatic(&ContributeMySettings));
}

void FMyPluginModule::ShutdownModule()
{
    FGameSettingExtensions::UnregisterContributor(TEXT("MyPlugin"));
}

#undef LOCTEXT_NAMESPACE
```

The default is given twice on purpose. The setting needs it to know what to reset to, and the data source needs it to answer with something sensible before the player has chosen anything.

</details>

<details>

<summary>Contributing a slider</summary>

```cpp
UGameSettingValueScalarDynamic* Setting = NewObject<UGameSettingValueScalarDynamic>();
Setting->SetDevName(TEXT("MyPlugin_VoiceChatVolume"));
Setting->SetDisplayName(LOCTEXT("VoiceVolume_Name", "Voice Chat Volume"));

const TSharedRef<FLyraExtensionSettingDataSource> Source = MakeShared<FLyraExtensionSettingDataSource>(
    FName(TEXT("MyPlugin.VoiceChatVolume")), ELyraExtensionSettingStorage::LocalToMachine, TEXT("1.0"));

Setting->SetDynamicGetter(Source);
Setting->SetDynamicSetter(Source);
Setting->SetDefaultValue(1.0);
Setting->SetDisplayFormat(UGameSettingValueScalarDynamic::ZeroToOnePercent);
Setting->SetSourceRangeAndStep(TRange<double>(0.0, 1.0), 0.01);

Context.AddSetting(TEXT("VolumeCollection"), Setting);
```

A slider reads whatever its source returns as a number, which is why the data source is given a default rather than being allowed to answer with nothing.

</details>

### Module dependencies

Add `GameSettings` to your module to build settings at all. Add `LyraGame` and `GameSubtitles` as well if you store values in the player's saved settings, because the shared settings header reaches into the subtitles plugin.

## Where the value is kept

You have two choices, and they differ in whether the framework holds the value for you.

**Store it under a key in the player's saved settings.** A module outside LyraGame cannot add a property to those classes, so values arrive under a name you choose instead. Prefix the name with your module's name so that two plugins cannot collide. Choose between the two stores by what the value describes:

* `SharedWithPlayer` follows the player, which is where a preference belongs. Changing it marks the save for writing.
* `LocalToMachine` stays on the machine, which is where anything describing the hardware belongs.

Every value is held as a string. That is the form the dynamic settings already exchange with their sources, so one key serves a toggle, a number, a slider or a list without distinction. Your gameplay code reads the same key to find out what the player chose.

**Or keep it yourself.** Write your own data source and point the setting at whatever your module already stores, whether that is a developer settings object, a save game of your own or something computed. Nothing about a setting requires the framework to be holding its value.

## Where a setting can go

Name the page or section you want by its developer name. Sections are addressable as well as pages, so a setting can land next to the ones it belongs with rather than at the bottom of a page.

| Page                         | Sections within it                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `VideoCollection`            | `DisplayCollection`, `GraphicsCollection`                                                            |
| `AudioCollection`            | `VolumeCollection`, `SoundCollection`, `SubtitlesCollection`                                         |
| `GameplayCollection`         | `LanguageCollection`, `ReplayCollection`                                                             |
| `MouseAndKeyboardCollection` | `MouseSensitivityCollection`, `KeyBindingCollection`                                                 |
| `GamepadCollection`          | `HardwareCollection`, `GamepadBindingCollection`, `BasicSensitivityCollection`, `DeadZoneCollection` |

Naming a collection that does not exist drops the setting and says so in the log rather than placing it somewhere unintended. The same happens to a setting whose developer name is already taken, because a developer name identifies a setting and two settings cannot answer to one name.

To add a page of your own, build a collection and hand it over as a page instead of naming a parent.

<details>

<summary>Adding a page and a section</summary>

```cpp
UGameSettingCollection* Page = NewObject<UGameSettingCollection>();
Page->SetDevName(TEXT("MyPlugin_Collection"));
Page->SetDisplayName(LOCTEXT("MyPlugin_Name", "Voice"));
Context.AddPage(Page);

// Sections are collections nested inside a page, and the menu renders the nesting for you.
UGameSettingCollection* Section = NewObject<UGameSettingCollection>();
Section->SetDevName(TEXT("MyPlugin_DeviceCollection"));
Section->SetDisplayName(LOCTEXT("MyPlugin_Device_Name", "Devices"));
Page->AddSetting(Section);
```

A page added part way through a run can be found by name by the contributors that run after it, so one plugin can add rows to a page another plugin created, provided its name sorts later.

</details>

## Changing a setting that is already there

A contributor can reach any setting in the tree, including the framework's own, and amend it. This is how you adjust the menu without editing the class that declared it.

* Rename it, or rewrite its description.
* Widen or narrow a slider's range, or change its default.
* Point it at different storage, so your module answers for the value instead.
* Add a condition so it greys out, with a reason the menu shows the player.
* Hide it, or disable one option inside a dropdown while leaving the rest.

A setting cannot be removed from a page. Hiding it takes the row out of the menu, which covers what removal would be for, while leaving nothing else holding a reference to something that has gone.

<details>

<summary>Amending the framework's own settings</summary>

```cpp
static void ContributeMySettings(FGameSettingExtensionContext& Context)
{
    // Widen a range you find too narrow.
    if (UGameSettingValueScalarDynamic* Sensitivity =
            Cast<UGameSettingValueScalarDynamic>(Context.FindSetting(TEXT("MouseSensitivityYaw"))))
    {
        Sensitivity->SetMaximumLimit(20.0);
    }

    // Take a row out of the menu.
    if (UGameSetting* Replays = Context.FindSetting(TEXT("RecordReplay")))
    {
        Replays->AddEditCondition(MakeShared<FWhenCondition>(
            [](const ULocalPlayer*, FGameSettingEditableState& InOutEditState)
            {
                InOutEditState.Hide(TEXT("This game does not record replays"));
            }));
    }
}
```

Check the result of a lookup rather than assuming it. A name you did not declare belongs to someone else and may move.

</details>

Two contributors amending the same setting is the one case this does not resolve for you. The later name wins, and nothing warns you, so treat amending another module's setting as something to do in one place.

## When your settings appear

The settings screen builds its tree when it opens, and each screen builds its own. What that means in practice:

* **Registered during module startup**, which is the case this page describes, your settings are in the menu everywhere, from the main menu onwards.
* **Registered later**, for instance when a game mode becomes active, your settings appear in the next settings screen the player opens, not in one that is already open.

If you need to know whether a tree was built before a change, the registration list reports when it changes.

## Setting types

| Type                                      | Use for                     |
| ----------------------------------------- | --------------------------- |
| `UGameSettingValueDiscreteDynamic_Bool`   | A toggle                    |
| `UGameSettingValueDiscreteDynamic_Number` | A dropdown of numbers       |
| `UGameSettingValueDiscreteDynamic_Enum`   | A dropdown from an enum     |
| `UGameSettingValueScalarDynamic`          | A slider                    |
| `UGameSettingCollection`                  | A page, or a section in one |

## Edit conditions

An edit condition decides whether a setting is visible and whether it can be changed, and is asked again whenever the thing it depends on changes.

<details>

<summary>Conditions and dependencies</summary>

```cpp
// Only where the platform supports it.
Setting->AddEditCondition(FWhenPlatformHasTrait::KillIfMissing(
    TAG_Platform_Trait_SupportsWindowedMode, TEXT("Platform does not support window mode")));

// Only for the player who owns the profile.
Setting->AddEditCondition(FWhenPlayingAsPrimaryPlayer::Get());

// Decided by another setting, which has to be declared as a dependency to be asked again when it changes.
Setting->AddEditDependency(VoiceChatEnabledSetting);
Setting->AddEditCondition(MakeShared<FWhenCondition>(
    [VoiceChatEnabledSetting](const ULocalPlayer*, FGameSettingEditableState& InOutEditState)
    {
        if (!VoiceChatEnabledSetting->GetValue<bool>())
        {
            InOutEditState.Disable(LOCTEXT("Disabled_Reason", "Voice chat is off."));
        }
    }));
```

</details>

## Settings the framework declares itself

The framework's own settings are named properties on the shared and local settings classes, registered by the settings registry. That remains the right shape for settings that ship as part of the framework, where the class and the registry are in the same module. Contributing is the path for anything outside it.
