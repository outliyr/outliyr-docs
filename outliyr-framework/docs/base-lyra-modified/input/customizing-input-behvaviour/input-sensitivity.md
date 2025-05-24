# Input Sensitivity

A critical aspect of player comfort and control, especially for aiming with gamepads, is input sensitivity. Lyra provides a dedicated Data Asset, **`ULyraAimSensitivityData`**, to manage the mapping between abstract sensitivity presets (defined as an enum) and their corresponding floating-point scalar values. This allows for a clean, data-driven approach to handling different sensitivity levels.

**Purpose of `ULyraAimSensitivityData`**

The primary role of `ULyraAimSensitivityData` is to serve as a lookup table. Instead of hardcoding sensitivity multipliers or having complex logic to interpret sensitivity settings, this Data Asset centralizes the definitions.

* **Decoupling:** It separates the named sensitivity levels (e.g., "Slow," "Normal," "Fast," "Insane") from the actual numerical multipliers used in calculations.
* **Ease of Tuning:** Game designers can easily tweak the float values associated with each sensitivity preset directly within this Data Asset without needing to modify code or other input assets.
* **Clarity:** Provides a clear definition of available sensitivity options.

**Structure and Configuration**

`ULyraAimSensitivityData` is a `UPrimaryDataAsset`.

* **`SensitivityMap` (TMap<`ELyraGamepadSensitivity`, float>)**:
  * This is the core property of the Data Asset.
  * It's a map where:
    * The **Key** is an enum value of type `ELyraGamepadSensitivity` (e.g., `ELyraGamepadSensitivity::Slow`, `ELyraGamepadSensitivity::Normal`, `ELyraGamepadSensitivity::FastPlusPlus`). This enum defines the named sensitivity presets available to the player in settings menus.
    * The **Value** is a `float` representing the scalar multiplier for that sensitivity level. A value of `1.0f` would typically mean no change to the base input, values less than `1.0f` reduce sensitivity, and values greater than `1.0f` increase it.
  * **Default Values:** The constructor of `ULyraAimSensitivityData` populates this map with a default set of sensitivities, ranging from `Slow` (0.5f) to `Insane` (2.5f). You can modify these defaults directly in your project's version of this asset or create new `ULyraAimSensitivityData` assets with different mappings.
* **`SensitivtyEnumToFloat(const ELyraGamepadSensitivity InSensitivity) const` Function:**
  * This `const` function is the public interface for querying the Data Asset.
  * It takes an `ELyraGamepadSensitivity` enum value as input.
  * It attempts to find this enum key in the `SensitivityMap`.
  * If found, it returns the corresponding `float` scalar value.
  * If not found (which shouldn't happen if the enum is valid and the map is populated), it defaults to returning `1.0f`.

**How It's Used**

The `ULyraAimSensitivityData` asset is primarily consumed by the **`ULyraInputModifierGamepadSensitivity`** input modifier:

1. The `ULyraInputModifierGamepadSensitivity` is applied to an input mapping (e.g., for gamepad look stick) within an `InputMappingContext`.
2. This modifier has a property, `SensitivityLevelTable`, which is assigned a reference to a `ULyraAimSensitivityData` asset.
3. During input processing, `ULyraInputModifierGamepadSensitivity` reads the player's current sensitivity choice (e.g., `ELyraGamepadSensitivity::Fast`) from `ULyraSettingsShared` (for either "Normal" or "ADS" targeting types).
4. It then calls `SensitivityLevelTable->SensitivtyEnumToFloat()` with the player's chosen `ELyraGamepadSensitivity` enum.
5. The returned float scalar is then used by the modifier to multiply the raw input value from the gamepad stick, effectively applying the selected sensitivity.

**Example:**

* Player sets their "Look Sensitivity" in the game settings to "Fast."
* `ULyraSettingsShared` stores this as `ELyraGamepadSensitivity::Fast`.
* `ULyraInputModifierGamepadSensitivity` (on the look stick input mapping) reads `ELyraGamepadSensitivity::Fast`.
* It accesses its assigned `ULyraAimSensitivityData` asset.
* It calls `SensitivtyEnumToFloat(ELyraGamepadSensitivity::Fast)`.
* The `ULyraAimSensitivityData` asset looks up `ELyraGamepadSensitivity::Fast` in its `SensitivityMap` and returns the associated float (e.g., `1.5f` by default).
* The input modifier multiplies the gamepad stick's axis value by `1.5f`.

***

The `ULyraAimSensitivityData` asset provides a straightforward and easily configurable method for managing gamepad sensitivity levels. By centralizing the mapping of named presets to numerical multipliers, it simplifies both game design tuning and the underlying logic of applying sensitivity adjustments. This Data Asset, in conjunction with the `ULyraInputModifierGamepadSensitivity` and `ULyraSettingsShared`, forms a complete system for player-adjustable gamepad sensitivity. With this understanding of input customization, we can now turn to more advanced and low-level aspects of Lyra's input pipeline.

***
