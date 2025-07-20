# Input & Keybindings

Lyra leverages Unreal Engine's **Enhanced Input System** for its input processing, which includes providing users the ability to customize their keybindings. While the general settings UI is managed by `ULyraGameSettingRegistry`, the specifics of keybinding configuration are deeply tied to the features of Enhanced Input, particularly `UEnhancedInputUserSettings`.

***

### **Lyra's Approach to Keybindings**

Instead of implementing a completely bespoke keybinding system within `ULyraSettingsShared` or `ULyraSettingsLocal`, Lyra adopts the robust functionality provided by the Enhanced Input plugin.

* **Primary Reliance on `UEnhancedInputUserSettings`:**
  * The `UEnhancedInputUserSettings` class, part of the Enhanced Input plugin, is designed specifically to manage player-specific customizations to input mappings. This includes:
    * Changing the key bound to a specific mappable action (e.g., remapping "Jump" from Spacebar to a mouse button).
    * Saving and loading these custom key profiles.
    * Handling multiple keybinding slots (e.g., primary and secondary keys for an action).
* **Integration with `ULyraSettingsShared` for Saving:**
  * While `UEnhancedInputUserSettings` handles the logic of key mappings, Lyra integrates its persistence. When `ULyraSettingsShared::SaveSettings()` is called, it also explicitly triggers `UEnhancedInputUserSettings::AsyncSaveSettings()`.
  * This ensures that player-customized keybindings are saved alongside other shared, player-specific preferences. The keybinding data itself is typically stored in a separate `.sav` file managed by `UEnhancedInputUserSettings` (often named like `InputUserSettings.sav`).
* **Player Mappable Keys:**
  * The core concept relies on defining `InputActions` within `InputMappingContexts` as "Player Mappable." This is done by:
    1. Checking the "Is Player Mappable" boolean on an `InputAction` mapping within an `InputMappingContext`.
    2. Assigning a `PlayerMappableKeySettings` data asset to that mapping. This asset contains metadata like the unique `Name` for the mapping (critical for the settings system), its user-friendly `DisplayName`, and its `DisplayCategory`.

***

### **Exposing Keybindings in the UI**

To display and allow modification of these Enhanced Input keybindings within Lyra's settings menu, a specialized `UGameSettingValue` and corresponding UI widget are used.

* **`ULyraSettingKeyboardInput` (`UGameSettingValue` Derivative):**
  * This custom class is created by `ULyraGameSettingRegistry::InitializeMouseAndKeyboardSettings` for each mappable action that should appear in the "Keyboard & Mouse" settings.
  * It doesn't directly store the keybinding itself. Instead, it holds references (like `ActionMappingName` and `ProfileIdentifier`) that allow it to query and command the `UEnhancedInputUserSettings`.
  * It provides methods to:
    * Get the display text for the currently bound key in a specific slot (primary, secondary).
    * Initiate a change to a keybinding for a specific slot.
    * Reset a binding to its default key(s).
    * Check if a mapping has been customized from its default.
* **`ULyraSettingsListEntrySetting_KeyboardInput` (UMG Widget):**
  * This is the UMG widget that visually represents a single keybinding row in the settings menu.
  * It typically displays the action's name (e.g., "Jump") and buttons for the primary and secondary key slots.
  * When a key slot button is clicked, it usually triggers a "press any key" panel.
  * Upon key selection, it calls methods on its associated `ULyraSettingKeyboardInput` object to update the binding via `UEnhancedInputUserSettings`.
  * It also handles displaying "Clear" and "Reset to Default" buttons for the binding.
* **Dynamic Population in Registry:**
  * `ULyraGameSettingRegistry::InitializeMouseAndKeyboardSettings` (and similarly `InitializeGamepadSettings` for gamepad-specific views of bindings) iterates through the `UEnhancedPlayerMappableKeyProfile`s available in `UEnhancedInputUserSettings`.
  * For each `FKeyMappingRow` (representing a mappable action with its various key slots) that meets the criteria (e.g., is intended for keyboard, has default mappings), it creates an instance of `ULyraSettingKeyboardInput`.
  * These `ULyraSettingKeyboardInput` objects are then added to the appropriate `UGameSettingCollection` (often grouped by the `DisplayCategory` defined in `PlayerMappableKeySettings`).

***

### **Interaction with Player Mappable Key Profiles**

Enhanced Input supports the concept of "Key Profiles" (`UEnhancedPlayerMappableKeyProfile`). These allow for different sets of default bindings or configurations.

* Lyra's settings system typically queries the `UEnhancedInputUserSettings` for available key profiles.
* The UI will then display the mappable actions from the currently active or relevant profiles.
* When a key is rebound, the change is made within the context of the current key profile in `UEnhancedInputUserSettings`.

***

### **Modifying & Adding Keybindable Actions in Lyra**

To add a new action that players can rebind, or to modify an existing one, you generally need to work with the Enhanced Input assets directly:

**Defining Mappable Setting for Input Action**

1. **Create/Modify `InputAction` Asset:** Define the action itself (e.g., `IA_Interact`).
2. **Configure Player Mappable Settings:**
   *   Assign a **`PlayerMappableKeySettings`** Data Asset.

       * **Name:** Provide a unique `FName` (e.g., `Interact`). This name is crucial as it's used by the settings UI to identify this specific binding.
       * **Display Name:** Set the text that will appear in the settings menu (e.g., "Interact," "Use Item").
       * **Display Category:** Assign a category (e.g., "General," "Combat") to group it with other similar actions in the settings UI.

       <img src=".gitbook/assets/image (36).png" alt="" title="Setting the Player Mappable Key Settings in an input action">

**Overriding Mappable Setting for Input Mapping Context**

By default, when you mark an **Input Action** as player-mappable, the associated **PlayerMappableKeySettings** asset defines its metadata, such as the mapping name, display name, and display category. These values determine how the action appears and is grouped in the settings UI.

However, **Input Mapping Contexts (IMCs)** can **override these default settings** on a per-mapping basis. This allows you to define alternate metadata for the same input action depending on the context in which it's used.

For example:

* You might have a generic input action like `IA_Interact` used in multiple contexts (e.g., in-world interaction, UI interaction).
* In one context (e.g., Gameplay), the action might be labeled “Use” and grouped under the “Gameplay” category.
* In another context (e.g., when in a vehicle), the same action might be labeled “Horn” and placed under the “Vehicle” category.

To override the default mappable settings in an IMC:

1. **Add to `InputMappingContext` (IMC):**
   * Add the `InputAction` to one or more IMCs.
   * Assign one or more default keys to this action in the IMC.
2.  **Configure Player Mappable Settings:**

    * In the IMC, for the specific mapping of your `InputAction`:
      * Set the `SettingBehaviour` field to either
        * `OverrideSettings` – to override the default `PlayerMappableKeySettings` defined on the Input Action.
        * `IgnoreSettings` – to disable all settings customization for this specific mapping (useful for internal or hidden mappings).
      * **Assign a custom `PlayerMappableKeySettings` data asset** to the mapping if using `OverrideSettings`. This allows you to redefine how the action appears in the settings UI for this specific context.

    <img src=".gitbook/assets/image (3) (1) (1) (1) (1) (1) (1).png" alt="" title="Overriding IA_QuickSlot1 in ShooterBase IMC">

#### Ensuring Actions Are Functional and Discoverable

Regardless of how you've configured the Input Action or its associated PlayerMappableKeySettings, **an Input Mapping Context (IMC) must be actively applied** to the player for the input action to become functional and visible in the settings UI.

In other words, because input actions are only processed when they're part of an active mapping context, you must ensure that the `InputMappingContext` **containing the mappable action is added to the** `UEnhancedInputLocalPlayerSubsystem` at the appropriate point during gameplay. If the context is not active, the action's bindings won’t be functional, and it won’t show up in the keybinding UI.

#### Automatic Registry Population

Once the relevant IMC is active and the mappable action has default keys configured:

* The **ULyraGameSettingRegistry** will automatically detect and register the action during its initialization routines—specifically in `InitializeMouseAndKeyboardSettings()` or `InitializeGamepadSettings()`.
* The **DisplayCategory** specified in the `PlayerMappableKeySettings` determines which section the action appears in within the settings UI.
  * If the category is new or unique, a new section will be dynamically created in the UI.

**Important Considerations for Keybindings:**

* **Unique Mapping Names:** The `Name` field in `PlayerMappableKeySettings` should be unique across all mappable actions you intend to expose. Duplicates can lead to unpredictable behavior in the settings UI.
* **Gamepad vs. Keyboard/Mouse Sections:** Lyra typically separates keybinding displays for Gamepad and Keyboard/Mouse. The logic in `InitializeMouseAndKeyboardSettings` and `InitializeGamepadSettings` often filters which actions appear based on their default key types or specific query options.
* **Conflicts:** `UEnhancedInputUserSettings` has built-in (or can be extended with) logic to handle or warn about keybinding conflicts, which the UI (like `ULyraSettingsListEntrySetting_KeyboardInput` and its "key already bound" warning panel) can then present to the user.

***

By integrating closely with `UEnhancedInputUserSettings`, Lyra avoids redundant implementation for keybinding management and benefits from the features and robustness of the engine's dedicated input customization system. Developers extending Lyra should primarily focus on correctly configuring their Enhanced Input assets to make new actions appear in the settings UI.
