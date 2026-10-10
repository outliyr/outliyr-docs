# Input Settings

A player opens the keybinding menu and sees every action mapped to a key. They click "Jump," press Space, and the binding updates. They can set primary and secondary bindings, detect conflicts with other actions, and reset individual bindings to defaults. Behind the scenes, this integrates with Unreal's Enhanced Input system.

## Keyboard & Mouse Bindings

The settings registry discovers all rebindable actions from Enhanced Input's player-mappable key profiles. It iterates through every profile and its mapping rows, creating a settings entry for each action that has valid keyboard-type mappings. Each action appears as a row in the Mouse & Keyboard settings page, grouped by its display category.

Each action supports two binding slots, primary and secondary. The player can assign any key to either slot. When a binding changes, the system updates the Enhanced Input profile directly through the mappable key profile API.

When the player assigns a key that is already used by another action, the system detects the overlap. It can query all mapped actions sharing that key across both slots, giving the UI enough information to warn the player or automatically reassign the conflicting binding.

Individual bindings can be reset to their default mapping. The system tracks which bindings have been customized by comparing the current mapping against stored initial values. The player can also restore a binding to whatever it was when they opened the settings screen, discarding any uncommitted changes.

Bindings persist via Enhanced Input's own save system, which the settings registry triggers alongside its normal save flow.

<details class="gb-toggle">

<summary>In code: ULyraSettingKeyboardInput</summary>

Each rebindable action is a `ULyraSettingKeyboardInput` instance. `InitializeInputData()` binds it to a `UEnhancedPlayerMappableKeyProfile` and a specific `FKeyMappingRow`. `ChangeBinding()` modifies the key, `GetAllMappedActionsFromKey()` scans for conflicts, and `IsMappingCustomized()` checks against defaults.

```cpp
void InitializeInputData(const UEnhancedPlayerMappableKeyProfile* KeyProfile,
    const FKeyMappingRow& MappingData, const FPlayerMappableKeyQueryOptions& QueryOptions);
bool ChangeBinding(int32 InKeyBindSlot, FKey NewKey);
void GetAllMappedActionsFromKey(int32 InKeyBindSlot, FKey Key, TArray<FName>& OutActionNames) const;
bool IsMappingCustomized() const;
```

</details>

### Mouse Sensitivity

* Separate X and Y sensitivity multipliers stored in shared settings (follow the player across machines)
* A targeting sensitivity multiplier that applies when aiming down sights, reduces look speed while ADS
* Axis inversion toggles for both vertical and horizontal look

### Gamepad Settings

* Sensitivity uses presets (10 levels, from Slow to Insane) rather than raw multipliers, for a consistent console-style experience

<img src=".gitbook/assets/image (271).png" alt="" width="563" title="">

* Separate presets for general look and targeting/ADS
* Deadzone configuration for move stick (left) and look stick (right), with enforced minimum and maximum limits to prevent unusable values
* Controller platform selection, determines which button prompt icons the UI shows (only appears when the platform supports multiple controller types)
* Haptic settings: force feedback toggle, trigger haptics toggle, trigger strength and start position

### How Bindings Save

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Player changes a keybinding in the UI**

The player selects an action, presses a new key, and the custom keyboard input setting writes the change into the Enhanced Input profile.
<!-- gb-step:end -->

<!-- gb-step:start -->
**The setting updates the Enhanced Input profile**

The binding change goes through Enhanced Input's mappable key profile, which handles slot assignment and conflict tracking internally.
<!-- gb-step:end -->

<!-- gb-step:start -->
**The registry saves both its own backends and Enhanced Input**

When the player confirms settings, the registry calls save on shared settings. Shared settings triggers an async save for its own data and then separately calls async save on Enhanced Input's user settings.
<!-- gb-step:end -->

<!-- gb-step:start -->
**On next launch, Enhanced Input loads the saved profile**

Enhanced Input restores custom bindings from its own saved data. The settings registry re-discovers the bindings from the loaded profiles, so the UI reflects the player's customizations.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

### How the Registry Discovers Bindings

The registry iterates all key profiles available in the Enhanced Input User Settings system. For each profile, it reads the player-mappable key rows, these are the actions marked as rebindable in the Input Mapping Context. Each row becomes a `ULyraSettingKeyboardInput` instance in the Mouse & Keyboard settings page. Gamepad bindings follow the same pattern but appear in the Gamepad settings page, filtered by key type. Only actions with `PlayerMappableKeySettings` configured in the IMC appear as rebindable, actions without this configuration are invisible to the settings system.

### Default Input Mappings

The HeroComponent has a `DefaultInputMappings` array, an array of Input Mapping Contexts with priority levels. These are registered when the hero component binds input during initialization. Additional input configs can be added and removed at runtime via `AddAdditionalInputConfig` / `RemoveAdditionalInputConfig`, for example, a vehicle mode that adds driving controls while disabling on-foot bindings.

<details class="gb-toggle">

<summary>Why does keybinding save separately from other settings?</summary>

Keybindings are managed by Unreal's Enhanced Input User Settings system, which has its own persistence. The settings registry triggers Enhanced Input's save alongside its own, but the actual binding data lives in Enhanced Input's format. This means keybindings benefit from Enhanced Input's built-in conflict resolution and profile management.

</details>
