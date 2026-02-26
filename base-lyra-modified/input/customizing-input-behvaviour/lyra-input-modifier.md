# Lyra Input Modifier

Enhanced Input Modifiers are a powerful feature allowing you to process and alter raw input values as they flow from a hardware input, through an `InputMappingContext`'s specific mapping, to the final `InputAction` value. Lyra extends this by providing several custom input modifiers, often designed to integrate with its shared user settings system. These modifiers allow for dynamic adjustments to input feel based on player preferences or game state.

You typically apply these modifiers directly to an input mapping entry within an `InputMappingContext` asset in the editor.

**Key Lyra Input Modifiers:**

1. **`ULyraSettingBasedScalar`**
   * **Purpose:** Scales the input value (Axis1D, Axis2D, or Axis3D) based on the value of a `double` property read from the `ULyraSettingsShared` object.
   * **Configuration Properties (on the modifier instance):**
     * `XAxisScalarSettingName`, `YAxisScalarSettingName`, `ZAxisScalarSettingName` (FName): The names of the properties in `ULyraSettingsShared` to read the scalar values from.
     * `MaxValueClamp`, `MinValueClamp` (FVector): Clamps the scalar values read from settings to a defined range.
   * **Mechanism:** When input is processed, this modifier retrieves the `ULyraLocalPlayer`, gets their `ULyraSettingsShared` instance, and attempts to read the `double` values from the specified property names. It then multiplies the incoming `FInputActionValue` by these scalar values (clamped).
   * **Use Case:** Could be used for a custom sensitivity setting that isn't covered by the standard gamepad sensitivity, or for dynamically adjusting input scale based on other game settings. For example, if you had a "Mouse Scope Sensitivity Multiplier" setting.
2. **`ULyraInputModifierDeadZone`**
   * **Purpose:** Implements an axial or radial dead zone for analog stick inputs, with the dead zone threshold driven by values from `ULyraSettingsShared`. This helps prevent unwanted character movement or camera drift from slight stick inaccuracies.
   * **Configuration Properties:**
     * `Type` (`EDeadZoneType`): `Axial` (independent X/Y dead zones) or `Radial` (circular dead zone).
     * `UpperThreshold` (float): The value above which input is clamped to 1 (after dead zone processing). Default is 1.0.
     * `DeadzoneStick` (`EDeadzoneStick`): Specifies whether this dead zone applies to the `MoveStick` or `LookStick`. This determines which setting (`GetGamepadMoveStickDeadZone()` or `GetGamepadLookStickDeadZone()`) is read from `ULyraSettingsShared`.
   * **Mechanism:** Reads the appropriate dead zone value from `ULyraSettingsShared`. If the input's magnitude is below this threshold, the output value becomes zero. If above, the input value is remapped to the range \[0, 1] relative to the dead zone.
   * **Use Case:** Essential for gamepad analog stick inputs (both movement and camera look) to provide a comfortable and precise control feel.
3. **`ULyraInputModifierGamepadSensitivity`**
   * **Purpose:** Applies a scalar multiplier to gamepad input (typically look/aiming) based on the player's selected sensitivity preset. It uses a `ULyraAimSensitivityData` asset to look up the actual float multiplier.
   * **Configuration Properties:**
     * `TargetingType` (`ELyraTargetingType`): `Normal` (for general looking around) or `ADS` (for Aiming Down Sights). This determines which sensitivity setting (`GetGamepadLookSensitivityPreset()` or `GetGamepadTargetingSensitivityPreset()`) is read from `ULyraSettingsShared`.
     * `SensitivityLevelTable` (TObjectPtr\<const `ULyraAimSensitivityData`>): A reference to the Data Asset that maps sensitivity enum presets to float scalar values.
   * **Mechanism:** Reads the current sensitivity preset (Normal or ADS) from `ULyraSettingsShared`. Uses this preset to look up the corresponding float scalar from the `SensitivityLevelTable`. Multiplies the input value by this scalar.
   * **Use Case:** The standard way to implement adjustable gamepad aiming sensitivity.
4. **`ULyraInputModifierAimInversion`**
   * **Purpose:** Inverts the X and/or Y axes of an input based on the player's inversion settings stored in `ULyraSettingsShared`.
   * **Configuration Properties:** None directly on the modifier, as it reads all necessary data from settings.
   * **Mechanism:** Reads `GetInvertVerticalAxis()` and `GetInvertHorizontalAxis()` from `ULyraSettingsShared`. If true, it multiplies the corresponding axis (Y for vertical, X for horizontal) of the input value by -1.0.
   * **Use Case:** Standard implementation for allowing players to invert their look controls.

**Applying Lyra Input Modifiers:**

1. **Open your `InputMappingContext` asset.**
2. **Select a specific mapping** (e.g., the mapping for Gamepad Right Stick Y-Axis to `IA_Look_Stick`).
3. In the Details panel for that mapping, find the **`Modifiers`** array.
4. **Add an element** to the array.
5. **Select the desired Lyra Input Modifier** class from the dropdown (e.g., `LyraInputModifierGamepadSensitivity`).
6. **Configure the properties** of the added modifier instance (e.g., set `TargetingType` to `Normal`, assign your `ULyraAimSensitivityData` asset).

Multiple modifiers can be chained on a single mapping; they will be processed in the order they appear in the array.

***

By leveraging these custom input modifiers, you gain fine-grained control over how player inputs are translated into game actions, all while maintaining a strong connection to user-configurable settings. This approach ensures that the game's controls can be precisely tuned for optimal feel and can adapt dynamically to player preferences. To fully understand the sensitivity adjustments, our next exploration will be the `ULyraAimSensitivityData` asset, which works hand-in-hand with the `ULyraInputModifierGamepadSensitivity`.
