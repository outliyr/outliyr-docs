# Low level Input

Most input work uses the high-level pipeline of Input Actions, Input Mapping Contexts, and `ULyraInputConfig`. These classes handle specialized low-level concerns that sit beneath that layer.

### `ULyraPlayerInput`

Custom `UEnhancedPlayerInput` subclass, set as the active player input class in `DefaultEngine.ini`. It overrides `InputKey()` to intercept raw key events and trigger latency markers for NVIDIA Reflex integration. Specifically, it watches for left mouse button presses and fires a latency flash indicator when the feature is enabled in `ULyraSettingsLocal`. The `bShouldTriggerLatencyFlash` flag updates automatically when the player toggles the setting.

### `ULyraInputUserSettings`

Extends `UEnhancedInputUserSettings`. Currently a placeholder for framework-specific input settings extensions, the class contains scaffolding comments suggesting future properties like toggle-vs-hold preferences. It serializes alongside shared settings and supports cloud saves.

### `ULyraPlayerMappableKeySettings`

Extends `UPlayerMappableKeySettings` with a `Tooltip` text property. This lets the rebinding UI display richer per-action descriptions beyond just the action name.

### `ULyraPlayerMappableKeyProfile`

Extends `UEnhancedPlayerMappableKeyProfile` with custom `EquipProfile()` and `UnEquipProfile()` overrides, providing hook points for applying or removing a key binding profile at runtime.
