# Customizing Input Behaviour

Raw input values pass through Enhanced Input modifiers before triggering actions. The framework provides custom modifiers for deadzones, sensitivity scaling, and axis inversion, all reading their configuration from `ULyraSettingsShared` at runtime. This means changing a sensitivity slider or toggling axis inversion in the settings menu immediately affects how modifiers process input, with no additional wiring required.

***

## Custom Input Modifiers

Four custom `UInputModifier` subclasses ship with the framework. Each one queries the player's shared settings every frame, so player preferences stay in sync with the input pipeline automatically.

### `ULyraInputModifierDeadZone`

Filters out small analog stick deflections that would otherwise cause unintended drift. The `DeadzoneStick` property (`EDeadzoneStick`) determines which threshold to read, `MoveStick` reads `GetGamepadMoveStickDeadZone()`, `LookStick` reads `GetGamepadLookStickDeadZone()`.

Two deadzone modes are available via the `Type` property:

* **Axial** — each axis is evaluated independently. Good for movement sticks where you want clean cardinal directions.
* **Radial** — the combined magnitude of both axes is compared against the threshold. Better for look sticks where diagonal input matters.

Values below the threshold are zeroed out entirely. Values above it are rescaled into the 0-to-1 range (up to `UpperThreshold`, which defaults to 1.0), so the usable range still covers the full spectrum without a dead jump at the threshold boundary.

<figure><img src="../../.gitbook/assets/image (8) (1) (1).png" alt=""><figcaption><p>Input Action with a deadzone modifier</p></figcaption></figure>

### `ULyraInputModifierGamepadSensitivity`

Scales gamepad look input by a sensitivity multiplier drawn from a preset system. The `TargetingType` property (`ELyraTargetingType`) selects which context to read from shared settings:

* **Normal** — reads `GetGamepadLookSensitivityPreset()`. Used for general camera movement.
* **ADS** — reads `GetGamepadTargetingSensitivityPreset()`. Used while aiming down sights.

Each context stores its own independent preset, so players can have fast hip-fire look and slow ADS look simultaneously.

The modifier resolves the preset through a `ULyraAimSensitivityData` asset (referenced via the `SensitivityLevelTable` property). This data asset is a `UPrimaryDataAsset` containing a `TMap<ELyraGamepadSensitivity, float>` called `SensitivityMap`. The `ELyraGamepadSensitivity` enum defines ten levels: `Slow` (0.5x), `SlowPlus`, `SlowPlusPlus`, `Normal` (1.0x), `NormalPlus`, `NormalPlusPlus`, `Fast`, `FastPlus`, `FastPlusPlus`, and `Insane` (2.5x). At runtime the modifier calls `SensitivtyEnumToFloat()` on the data asset and multiplies the input value by the result.

<figure><img src="../../.gitbook/assets/image (6) (1) (1).png" alt=""><figcaption><p>Input Action with gamepad sensitivity modifier</p></figcaption></figure>

### `ULyraInputModifierAimInversion`

Inverts the vertical and/or horizontal look axis. This modifier has no configurable properties of its own, it reads `GetInvertVerticalAxis()` and `GetInvertHorizontalAxis()` from `ULyraSettingsShared` and multiplies the corresponding component by -1 when the toggle is enabled. Both default to `false`.

<figure><img src="../../.gitbook/assets/image (7) (1) (1).png" alt=""><figcaption><p>Input Action with aim inversion modifier</p></figcaption></figure>

### `ULyraSettingBasedScalar`

The most generic modifier, scales input by an arbitrary property value looked up by name from `ULyraSettingsShared`. Three name properties control which setting drives each axis:

* `XAxisScalarSettingName` — property name for the X-axis multiplier
* `YAxisScalarSettingName` — property name for the Y-axis multiplier
* `ZAxisScalarSettingName` — property name for the Z-axis multiplier

Each axis also has `MinValueClamp` and `MaxValueClamp` bounds (defaulting to 0 and 10 respectively). The modifier reads the named `double` properties each frame, clamps them, and multiplies the input. Internally it caches `FProperty` pointers after the first lookup to avoid per-frame reflection overhead.

This is used for mouse sensitivity (`MouseSensitivityX`, `MouseSensitivityY`, `TargetingMultiplier`) and any custom scaling needs beyond the standard gamepad presets.

<figure><img src="../../.gitbook/assets/image (9) (1) (1).png" alt=""><figcaption><p>Input Action with setting based scalar modifier</p></figcaption></figure>

***

## Sensitivity Configuration

**Gamepad:** Ten preset levels defined in `ULyraAimSensitivityData`, ranging from 0.5x to 2.5x. The player selects a preset name (e.g., `"Normal+"`) rather than entering a raw number. Separate presets are stored for general look and ADS targeting, both defaulting to `Normal`.

<figure><img src="../../.gitbook/assets/image (10) (1) (1).png" alt=""><figcaption><p>GamepadAimSensitivity_Targeting in ShooterBase</p></figcaption></figure>

**Mouse:** Three raw `double` values on `ULyraSettingsShared`, `MouseSensitivityX` (default 1.0), `MouseSensitivityY` (default 1.0), and `TargetingMultiplier` (default 0.5). These bypass the preset system entirely and are consumed through `ULyraSettingBasedScalar` modifiers configured with the corresponding property names.

<figure><img src="../../.gitbook/assets/image (11) (1).png" alt=""><figcaption></figcaption></figure>

All sensitivity values are stored in `ULyraSettingsShared` (a `ULocalPlayerSaveGame` subclass) and broadcast `OnSettingChanged` when modified, so changes apply immediately without requiring a restart or re-initialization.

***

## How to Adjust Defaults

* **Change what a sensitivity preset means:** Edit the `ULyraAimSensitivityData` asset in the editor. Adjust the float multiplier for any `ELyraGamepadSensitivity` entry. This is data-only, no recompile needed.
* **Change the default sensitivity level:** Modify the member initializers in `LyraSettingsShared.h`, `GamepadLookSensitivityPreset` and `GamepadTargetingSensitivityPreset` both default to `Normal`.
* **Change mouse sensitivity defaults:** Same file, adjust `MouseSensitivityX`, `MouseSensitivityY`, and `TargetingMultiplier` initializers.
* **Change deadzone defaults:** Modify `GamepadMoveStickDeadZone` and `GamepadLookStickDeadZone` in `LyraSettingsShared.h`.
* **Override modifier behaviour per-mapping:** In the IMC editor, select the modifier instance on a specific mapping and adjust its properties directly (e.g., switch deadzone type from Radial to Axial, swap the sensitivity data asset, or change targeting type).

Existing saved player settings will override compiled defaults. Delete `Saved/SaveGames/` to test fresh defaults.
