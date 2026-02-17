# How-To: Change Default Sensitivity or Deadzone Values

The default "feel" of gamepad controls, particularly sensitivity and stick dead zones, is critical for player comfort. Lyra provides data-driven ways to adjust these default values. This guide shows you where to make these changes.

**Goal:**

1. Adjust the default scalar value for the "Normal" gamepad look sensitivity.
2. Change the default dead zone percentage for the gamepad move stick.

**Background:**

* **Sensitivity:** In Lyra, gamepad sensitivity is typically handled by the `ULyraInputModifierGamepadSensitivity` input modifier, which uses a `ULyraAimSensitivityData` asset to look up scalar values for different sensitivity presets (e.g., Slow, Normal, Fast). Players choose a preset, and `ULyraSettingsShared` stores this choice.
* **Dead Zones:** Gamepad stick dead zones are handled by the `ULyraInputModifierDeadZone` input modifier. The actual dead zone threshold (e.g., 0.25 for 25%) is typically read from properties in `ULyraSettingsShared`.

**Method 1: Adjusting `ULyraAimSensitivityData` for Sensitivity Presets**

This method changes the _meaning_ of a sensitivity preset (e.g., what "Normal" sensitivity actually translates to as a multiplier).

1. **Step 1: Locate your `ULyraAimSensitivityData` Asset**
   * There's likely a default one in the Lyra content (e.g., `DA_LyraAimSensitivity`). If your project has its own, locate that. This asset is referenced by `ULyraInputModifierGamepadSensitivity` instances (usually on `InputMappingContexts` for gamepad look).
2. **Step 2: Open the `ULyraAimSensitivityData` Asset**
   * You will see the `SensitivityMap` property. This maps `ELyraGamepadSensitivity` enum values (like `Slow`, `Normal`, `Fast`) to float scalar values.
3. **Step 3: Modify the Scalar Value for the Desired Preset**
   * **Example:** To make "Normal" sensitivity slightly higher:
     * Find the entry in `SensitivityMap` where the key is `ELyraGamepadSensitivity::Normal`.
     * Change its associated `float` value. The default is `1.0f`. You might change it to `1.1f` for a 10% increase when "Normal" is selected.
   * You can adjust any of the preset values here (Slow, SlowPlus, Normal, Fast, Insane, etc.).
4. **Step 4: Save the `ULyraAimSensitivityData` Asset**
5. **Step 5: Test**
   * Play the game.
   * Ensure your gamepad look sensitivity preset (in game settings, which writes to `ULyraSettingsShared`) is set to "Normal" (or whichever preset you modified).
   * Observe the change in look responsiveness. The game now uses your new scalar when that preset is active.

**Method 2: Adjusting Default Values in `ULyraSettingsShared` for Dead Zones (and Default Sensitivity Choice)**

This method changes the _default fallback value_ that the game uses if a player hasn't yet saved their own settings, or the initial value presented in the settings UI. The `ULyraInputModifierDeadZone` and `ULyraInputModifierGamepadSensitivity` read their _current_ values from `ULyraSettingsShared` at runtime.

1. **Step 1: Locate `ULyraSettingsShared` C++ Class**
   * This class (`LyraSettingsShared.h/.cpp`) defines various shared game settings, including defaults for input.
2. **Step 2: Open `LyraSettingsShared.cpp` (Typically)**
   * Look for the constructor `ULyraSettingsShared::ULyraSettingsShared()` or for where member variables are initialized with default values if not in the constructor (e.g. directly in the header with C++11 style in-class member initializers).
3. **Step 3: Modify Default Values**
   * **For Move Stick Dead Zone:**
     * Find the line that initializes the variable backing `GetGamepadMoveStickDeadZone()` (e.g., a member variable like `GamepadMoveStickDeadZone`). Lyra's default is likely around `0.25f`.
     * Change this value. For example, to reduce the default dead zone: `GamepadMoveStickDeadZone = 0.15f;`
   * **For Look Stick Dead Zone:**
     * Similarly, find the variable backing `GetGamepadLookStickDeadZone()` and adjust its default initialization.
   * **For Default Sensitivity Preset Choice:**
     * Find the variables backing `GetGamepadLookSensitivityPreset()` and `GetGamepadTargetingSensitivityPreset()` (e.g., `GamepadLookSensitivityPreset`, `GamepadTargetingSensitivityPreset`). These are of type `ELyraGamepadSensitivity`.
     * Change their default initialized enum value if you want players to start with a different sensitivity preset selected by default (e.g., `GamepadLookSensitivityPreset = ELyraGamepadSensitivity::Fast;`).
4. **Step 4: Recompile Your Project**
   * Since you've modified C++ code, a recompile is necessary.
5. **Step 5: Test**
   * **Important:** To see these C++ default changes, you might need to **delete your existing saved user settings file** for the game (usually found in `Saved/SaveGames/`). This is because the game will load previously saved settings if they exist, overriding your new C++ defaults for that playthrough.
   * Play the game (after deleting old settings if needed).
   * Observe the new default dead zone behavior.
   * Check the game's settings menu; it should now reflect your new default sensitivity preset choice.

**Method 3: Directly Configuring Modifiers on `InputMappingContext` (Less Common for Defaults)**

While `ULyraInputModifierDeadZone` and `ULyraInputModifierGamepadSensitivity` are designed to be driven by `ULyraSettingsShared`, you _could_ potentially:

* Create subclasses of these modifiers that use hardcoded values instead of reading from settings.
* Or, if a modifier exposes direct value properties (not all Lyra ones do for these settings-driven behaviors), you could set them on the modifier instance within the `InputMappingContext`.

However, **this is generally not the recommended Lyra approach for sensitivity and dead zones** because it bypasses the player settings system. This method is more applicable if you wanted a specific, non-player-adjustable modification on a particular input that isn't tied to global settings.

**Choosing the Right Method:**

* **To change what a sensitivity preset&#x20;**_**means**_**&#x20;(e.g., make "Fast" even faster):** Modify `ULyraAimSensitivityData` (Method 1).
* **To change the game's&#x20;**_**initial**_**&#x20;dead zone values before a player touches settings, or the&#x20;**_**initial default choice**_**&#x20;for sensitivity preset:** Modify C++ defaults in `ULyraSettingsShared` and be prepared to clear saved settings for testing (Method 2).
* **Players will always override C++ defaults** once they save their own preferences in `ULyraSettingsShared`. The values in `ULyraAimSensitivityData` always define the scalars for the presets, regardless of player choices.

***

Adjusting default sensitivity and dead zone values allows you to fine-tune the initial out-of-the-box control experience for players using gamepads. By understanding where these values originate—either from Data Assets like `ULyraAimSensitivityData` or C++ defaults in `ULyraSettingsShared`—you can effectively tailor them to your project's needs, while still allowing players to customize them further via the in-game settings.

***
