# Player-Specific & Cloud-Ready Configurations

At the heart of Lyra's ability to remember player-specific preferences across sessions and potentially across different devices lies the `ULyraSettingsShared` class. This component is specifically designed to handle settings that are tied to an individual player's choices rather than the machine they are currently using.

***

### **Purpose and Scope**

`ULyraSettingsShared` is the designated C++ backend for settings that define a player's personal experience. These are typically preferences that a player would expect to remain consistent, regardless of where or how they log into the game.

**Key characteristics of settings managed by `ULyraSettingsShared`:**

* **Player-Centric:** They reflect individual user choices (e.g., "I prefer subtitles on," or "My preferred language is X").
* **Device Agnostic:** Ideally, these settings should apply even if the player moves to a new computer or console.
* **Cloud Save Suitable:** The underlying storage mechanism (`USaveGame`) makes these settings prime candidates for cloud synchronization services (if implemented by the game).
* **Common Examples in Lyra:**
  * Accessibility options like Colorblind Mode and Strength.
  * Subtitle display preferences (enabled, size, color, etc.).
  * Preferred game language/culture.
  * Gamepad vibration and sensitivity presets.
  * Mouse sensitivity and axis inversion (though Enhanced Input also plays a role here).
  * Permission for audio to play when the game is in the background.

***

### **Key Class Features**

`ULyraSettingsShared` is built upon `ULocalPlayerSaveGame`, a specialized version of `USaveGame` designed for local player data. This inheritance is fundamental to its role.

* **Inheritance:** `ULocalPlayerSaveGame` (which itself inherits from `USaveGame`).
* **Serialization:** Properties marked with `UPROPERTY()` are automatically serialized by the `USaveGame` system, meaning they are saved to and loaded from disk.
* **Ownership:** An instance of `ULyraSettingsShared` is typically owned by the `ULyraLocalPlayer`.
* **Core Properties:** Contains various `UPROPERTY()` members representing each setting (e.g., `EColorBlindMode ColorBlindMode`, `bool bForceFeedbackEnabled`, `FString PendingCulture`).
* **Change Notification:** Features an `OnSettingChanged` event (delegate) that is broadcast whenever a setting's value is modified through its designated setter. This allows other systems, particularly the UI, to react dynamically to changes without waiting for a full "apply" cycle.
* **Dirty Flag:** A `bIsDirty` boolean flag is maintained to track if any settings have been changed since the last save. This is useful for prompting the user to save changes or for optimizing save operations.

***

### **Saving & Loading Mechanism**

Persistence for `ULyraSettingsShared` is handled by Unreal Engine's SaveGame system.

* **Storage:** Settings are saved into a binary `.sav` file. The slot name for this file is defined by `SHARED_SETTINGS_SLOT_NAME` (typically `"SharedGameSettings"`).
* **Per-Player:** `ULocalPlayerSaveGame` ensures that these save files are associated with the specific local player.
* **Core Operations:**
  * **`CreateTemporarySettings(const ULyraLocalPlayer* LocalPlayer)`:** Creates a new, in-memory instance of `ULyraSettingsShared`. This instance is not loaded from disk but is set up to be saveable. Useful for initial setup or when a save file doesn't exist yet.
  * **`LoadOrCreateSettings(const ULyraLocalPlayer* LocalPlayer)`:** Synchronously attempts to load the settings from the save file. If the file doesn't exist or fails to load, it creates a new instance (similar to `CreateTemporarySettings`). _Use with caution due to its synchronous nature, which can cause hitches during critical game moments._
  * **`AsyncLoadOrCreateSettings(const ULyraLocalPlayer* LocalPlayer, FOnSettingsLoadedEvent Delegate)`:** Asynchronously attempts to load or create the settings. This is the preferred method for loading during gameplay or startup to avoid stalling the game thread. It invokes the provided `Delegate` upon completion, passing the loaded (or newly created) settings object.
  * **`SaveSettings()`:** Initiates an asynchronous save of the current settings to disk. It also triggers a save for `UEnhancedInputUserSettings`, as some input-related preferences (like customized keybindings) are managed there but saved in conjunction with these shared settings.
* **Data Versioning:** The `GetLatestDataVersion()` method allows for handling changes in the save file format over time, ensuring backward compatibility or data migration if the structure of saved settings evolves.

***

### **Applying Settings**

Simply changing a property in `ULyraSettingsShared` doesn't always mean the game will immediately reflect that change in its behavior. The `ApplySettings()` method is responsible for taking the current values stored in the object and actively pushing them to the relevant engine or game subsystems.

**The `ApplySettings()` method typically handles:**

* **Subtitle Options:** Configures the `USubtitleDisplaySubsystem` with the chosen subtitle format (size, color, background).
* **Background Audio:** Sets the application's volume multiplier when unfocused via `FApp::SetUnfocusedVolumeMultiplier()`.
* **Culture/Language:** Sets the current game culture using `FInternationalization::Get().SetCurrentCulture()`. This also involves updating `GGameUserSettingsIni` for early-load language needs.
* **Enhanced Input Settings:** Calls `ApplySettings()` on the `UEnhancedInputUserSettings` obtained from the `UEnhancedInputLocalPlayerSubsystem`. This is crucial for applying keybinding changes, sensitivities, and other input-related preferences managed by the Enhanced Input system.
* **Colorblind Mode:** While the setters for colorblind mode (`SetColorBlindMode`, `SetColorBlindStrength`) apply the changes directly to `FSlateApplication::Get().GetRenderer()`, the `ApplySettings()` method acts as a general point to ensure all such settings are active.

This application step is vital and is usually called after settings are loaded or when the player explicitly applies changes from the UI.

***

### **Change Detection & Notification**

To ensure responsiveness and efficient updates, `ULyraSettingsShared` uses a simple but effective change detection mechanism:

* **`ChangeValueAndDirty(T& CurrentValue, const T& NewValue)` Template Function:**
  * This function is used by most setters.
  * It compares the `NewValue` with the `CurrentValue`.
  * If they are different:
    1. The `CurrentValue` is updated.
    2. The `bIsDirty` flag is set to `true`.
    3. The `OnSettingChanged.Broadcast(this)` event is fired, notifying any listeners (like UI elements) that a specific setting within this object has changed.
* **`bIsDirty` Flag:** Can be queried (e.g., by the UI) to determine if there are pending, unsaved changes. It's cleared by `ClearDirtyFlag()`, typically after a successful save.
* **`OnSettingChanged` Event:** Allows UI elements or other game logic to subscribe and react immediately when a setting's value changes, enabling dynamic updates (e.g., a preview of a colorblind filter changing as the user adjusts the slider).

***

This detailed look at `ULyraSettingsShared` should provide a solid understanding of its role in managing player-specific, persistent settings within the Lyra framework. The next section will explore its counterpart, `ULyraSettingsLocal`, which handles machine-specific configurations.
