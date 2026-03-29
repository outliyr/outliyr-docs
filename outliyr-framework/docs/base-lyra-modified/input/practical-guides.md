# Practical Guides

Step-by-step walkthroughs for common input tasks. Each guide assumes familiarity with the input pipeline and configuration pages.

***

### Adding a New Ability Input

**Goal:** Make pressing `'G'` trigger a `"Throw Grenade"` gameplay ability.

{% stepper %}
{% step %}
#### Create the Input Action

In the Content Browser, create a new Input Action asset (`IA_ThrowGrenade`). Set Value Type to `Boolean` for a simple press/release.
{% endstep %}

{% step %}
#### Add the hardware mapping

Open the active `InputMappingContext` (e.g., `IMC_Default_KBM`). Add a mapping that binds the `'G'` key to `IA_ThrowGrenade`. Add triggers if needed, by default the ability system responds to both press and release events.
{% endstep %}

{% step %}
#### Map the IA to a tag

Open the `ULyraInputConfig` referenced by your pawn's `ULyraPawnData`. In the **AbilityInputActions** array, add an entry mapping `IA_ThrowGrenade` to a gameplay tag like `InputTag.Ability.Gadget.ThrowGrenade`. Create the tag first if it doesn't exist.
{% endstep %}

{% step %}
#### Grant the ability with the matching tag

In a `ULyraAbilitySet`, add your ability class (`GA_ThrowGrenade`) to `GrantedGameplayAbilities` with `InputTag` set to `InputTag.Ability.Gadget.ThrowGrenade`. The tag must match the InputConfig entry exactly. Make sure the ability set is granted to the player through PawnData or a Game Feature Action.
{% endstep %}

{% step %}
#### Test

Play the game and press `'G'`.
{% endstep %}
{% endstepper %}

**Troubleshooting:**

* Is the IMC actually added to the player's Enhanced Input subsystem?
* Does the `AbilityInputActions` tag match the tag in the AbilitySet?
* Is the AbilitySet being granted to the player's ASC?
* Is the ability blocked by tags, cooldowns, or costs? Use `AbilitySystem.Debug` in the console.

***

### Adding a New Native Input (Non-Ability)

**Goal:** Make pressing `'H'` call a C++ function `ToggleHat()` on a custom component, without routing through the ability system.

{% stepper %}
{% step %}
#### Create the Input Action

Create `IA_ToggleHat` in the Content Browser. Set Value Type to `Boolean`.
{% endstep %}

{% step %}
#### Add the hardware mapping

Open the active `InputMappingContext` and add a mapping from the `'H'` key to `IA_ToggleHat`.
{% endstep %}

{% step %}
#### Map the IA to a tag

Open the `ULyraInputConfig` for your pawn. In the **NativeInputActions** array (not AbilityInputActions), add an entry mapping `IA_ToggleHat` to a tag like `InputTag.Character.Cosmetic.ToggleHat`.
{% endstep %}

{% step %}
#### Bind the action in code

In `ULyraHeroComponent::InitializePlayerInput` (or your own component), call `BindNativeAction` on the `ULyraInputComponent`:

<details>

<summary>Binding code</summary>

```cpp
LyraIC->BindNativeAction(
    InputConfig,
    GameplayTags::InputTag_Character_Cosmetic_ToggleHat,
    ETriggerEvent::Triggered,
    MyCharComp,
    &UMyCharacterComponent::ToggleHat,
    /*bLogIfNotFound=*/ true
);
```

The tag must match the InputConfig entry exactly. `bLogIfNotFound` logs a warning if the tag has no matching entry, which helps catch mismatches during development.

</details>
{% endstep %}

{% step %}
#### Implement the handler

The function receives an `FInputActionValue` parameter (or can be parameterless for simple triggers). Make sure the target component exists on the pawn before the binding code runs.
{% endstep %}

{% step %}
#### Test

Play the game and press `'H'`.
{% endstep %}
{% endstepper %}

**Troubleshooting:**

* The entry must be in `NativeInputActions`, not `AbilityInputActions`.
* The gameplay tag in C++ must match the one in the InputConfig.
* Verify the `BindNativeAction` call is actually being reached (add a log if unsure).
* The target component must exist on the pawn at binding time.

***

### Changing Default Sensitivity or Deadzone Values

#### Sensitivity Presets

Open your `ULyraAimSensitivityData` asset in the editor. The `SensitivityMap` maps each `ELyraGamepadSensitivity` enum value to a float multiplier. Edit the float for any preset, for example, change `Normal` from `1.0` to `1.1` for a 10% bump. This is data-only and affects all players using that preset immediately.

#### Mouse Sensitivity Defaults

In `LyraSettingsShared.h`, change the member initializers:

* `MouseSensitivityX = 1.0`
* `MouseSensitivityY = 1.0`
* `TargetingMultiplier = 0.5`

These set the starting values for new players. Existing saved settings override them, delete `Saved/SaveGames/` to test fresh defaults.

#### Deadzone Defaults

In the same class, modify `GamepadMoveStickDeadZone` and `GamepadLookStickDeadZone` default values and recompile. The `ULyraInputModifierDeadZone` modifier reads these at runtime via the corresponding getter functions.

#### Per-Mapping Modifier Overrides

Each modifier instance on an IMC mapping has its own properties. On `ULyraInputModifierDeadZone`, you can change `Type` (Axial vs Radial), `UpperThreshold`, and which stick it reads from. On `ULyraInputModifierGamepadSensitivity`, you can swap the `SensitivityLevelTable` data asset or change `TargetingType` between Normal and ADS. These are per-mapping overrides and don't affect the global player setting values.
