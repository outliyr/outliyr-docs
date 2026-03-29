# Storage

Settings need to persist, but not all settings belong in the same place. Mouse sensitivity should follow the player to a new machine. Graphics quality should stay with the hardware. The framework provides two storage backends that handle this split.

***

### Shared Settings

Stored as a SaveGame file per player. Loads asynchronously when the local player is created.

What it stores, by category:

* **Input** — mouse sensitivity (per-axis), ADS targeting multiplier, axis inversion, gamepad sensitivity presets, stick deadzones
* **Accessibility** — colorblind mode and strength, subtitle toggle, subtitle text size, color, border, and background opacity
* **Audio** — background audio permission (whether sound continues when the game loses focus)
* **Localization** — language/culture preference
* **Gamepad** — force feedback toggle, trigger haptics (enabled, strength, start position, threshold behavior)

When a setting changes, it marks itself dirty and broadcasts a change event. Other systems, input, audio, UI, listen and react immediately. Saving is explicit: the UI calls save when the player confirms changes.

<details>

<summary>In code: ULyraSettingsShared</summary>

Inherits `ULocalPlayerSaveGame`. Each setting is a `UPROPERTY()` with getter/setter. Setters use `ChangeValueAndDirty()` which marks dirty and broadcasts `OnSettingChanged`. Saved as a per-player .sav file.

```cpp
template<typename T>
bool ChangeValueAndDirty(T& CurrentValue, const T& NewValue)
{
    if (CurrentValue != NewValue)
    {
        CurrentValue = NewValue;
        bIsDirty = true;
        OnSettingChanged.Broadcast(this);
        return true;
    }
    return false;
}
```

</details>

***

### Local Settings

Stored in `GameUserSettings.ini`. Loads synchronously at startup.

What it stores:

* **Display** — window mode, resolution, brightness/gamma, safe zone scale
* **Graphics** — overall quality level, individual scalability settings (shadows, textures, effects, post-processing, and more)
* **Audio** — volume levels (overall, music, SFX, dialogue, voice chat), audio output device, headphone mode (HRTF), HDR audio mode
* **Frame rate** — limits per context: on battery, in menu, when backgrounded, and a general always-on limit
* **Performance** — stat display configuration, latency flash indicators, latency tracking
* **Mobile** — FPS mode with automatic quality clamping based on device profile
* **Replays** — auto-record toggle and retention count

Integrates with Unreal's scalability system, changing "overall quality" adjusts multiple CVars at once. Frame rate limiting is context-aware: the game can use different limits when on battery power, in a menu, or running in the background.

<details>

<summary>In code: ULyraSettingsLocal</summary>

Inherits `UGameUserSettings`. Each setting is a `UPROPERTY(Config)` serialized to `GameUserSettings.ini`. Integrates with Unreal's scalability system for graphics quality presets. Access via static `ULyraSettingsLocal::Get()`.

```cpp
UCLASS(BlueprintType)
class ULyraSettingsLocal : public UGameUserSettings
{
    static ULyraSettingsLocal* Get();
    // ...
};
```

</details>

***

### How They Work Together

{% stepper %}
{% step %}
Player joins, local settings load from `.ini` (synchronous, immediate).
{% endstep %}

{% step %}
Local player created, shared settings load asynchronously from SaveGame.
{% endstep %}

{% step %}
Settings UI opens, the registry reads from both backends to populate the UI.
{% endstep %}

{% step %}
Player changes a setting, the appropriate backend is updated, change event fires.
{% endstep %}

{% step %}
Player confirms, both backends save (shared async, local sync).
{% endstep %}
{% endstepper %}

***

### Accessing Settings in Code

Both settings classes expose getter/setter pairs for each setting (e.g., `GetMouseSensitivityX()` / `SetMouseSensitivityX()`). The registry binds these automatically when building the settings UI, so you rarely call them directly. For the full list, see `LyraSettingsShared.h` and `LyraSettingsLocal.h`.

{% tabs %}
{% tab title="Blueprints" %}
* Get the Local Player node → Cast to `ULyraLocalPlayer`
* Call `GetSharedSettings()` for per-player settings (sensitivity, colorblind, subtitles, etc.)
* Call `GetLocalSettings()` for per-machine settings (volumes, graphics, frame rates, etc.)
* For local settings without a player reference, use `ULyraSettingsLocal::Get()` (static, returns the singleton)

<figure><img src="../../.gitbook/assets/image (269).png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../.gitbook/assets/image (268).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="C++" %}
```cpp
if (ULyraLocalPlayer* LyraLP = Cast<ULyraLocalPlayer>(GetLocalPlayer()))
{
    ULyraSettingsShared* Shared = LyraLP->GetSharedSettings();
    float SensX = Shared->GetMouseSensitivityX();

    ULyraSettingsLocal* Local = LyraLP->GetLocalSettings();
    float MasterVol = Local->GetOverallVolume();
}
```
{% endtab %}
{% endtabs %}

For the full list of available getters/setters, see `LyraSettingsShared.h` and `LyraSettingsLocal.h`.

***

### Loading and Timing

Local settings load synchronously from .ini at startup. They're available immediately, the engine needs them for resolution and graphics before the first frame renders.

Shared settings load asynchronously via the SaveGame system. They aren't available at startup. The local player triggers the load when created, and a delegate fires when they're ready.

If you try to access shared settings before they've loaded, the system returns a temporary default object. This is safe but the values won't reflect the player's saved preferences. The registry handles this by deferring initialization until shared settings are loaded.

<details>

<summary>In code: AsyncLoadOrCreateSettings</summary>

`ULyraSettingsShared::AsyncLoadOrCreateSettings(LocalPlayer, Delegate)` starts the async load. The delegate fires with the loaded (or newly created) settings object. Until the delegate fires, `GetSharedSettings()` returns a temporary default object, safe to read but won't have the player's saved values.

```cpp
static bool AsyncLoadOrCreateSettings(const ULyraLocalPlayer* LocalPlayer, FOnSettingsLoadedEvent Delegate);
```

</details>

***

### How Settings Apply

Shared settings apply immediately when set. Calling `SetMouseSensitivityX()` updates the value and applies it to the input system in the same frame. Same for subtitles, colorblind mode, and input sensitivity.

Local settings also apply immediately but through different mechanisms:

* Scalability changes adjust CVars (shadow quality, texture quality, etc.) which the rendering pipeline reads each frame
* Audio volume changes update the sound mix directly
* Frame rate limits take effect on the next frame
* Resolution and window mode changes trigger the engine's display mode switch

Saving is separate from applying. Settings take effect immediately, but they only persist to disk when explicitly saved. If the player backs out of the settings menu without saving, applied changes should be reverted (the UI handles this via the registry's cancel flow).

***

### Platform-Specific Handling

**Device profiles** interact with scalability. Console platforms define quality presets (Quality, Performance) as device profile suffixes. The settings system selects the appropriate profile and applies it, which sets baseline CVars for that hardware tier.

**Mobile FPS clamping:** On mobile, selecting a high frame rate (e.g., 60 FPS on a device that struggles above 30) automatically reduces graphics quality to maintain performance. The system cross-references the requested FPS against what the device can sustain at each quality level.

**Frame rate contexts:** The system supports different frame rate limits per context, a lower limit on battery power to save energy, a reduced limit in menus where visual fidelity isn't critical, and a minimal limit when the app is backgrounded.

***

<details>

<summary>Why two backends instead of one?</summary>

SaveGame files are per-player and can sync to cloud storage. But they load asynchronously, so they can't be used for settings the engine needs at startup (resolution, graphics quality). `GameUserSettings.ini` loads synchronously and is available immediately, but it's per-machine. The split lets each setting use the right persistence model.

</details>
