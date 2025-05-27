# How-To: Add a New Rebindable Key

Allowing players to customize their key bindings is a standard feature in many games. Lyra, through Unreal Engine's Enhanced Input system, supports this. This guide outlines the steps to make a new input action rebindable by the player through a settings menu.

**Goal:** Make the "Interact" action, triggered by a new `IA_Interact` Input Action, rebindable in the game's settings.

**Assumptions:**

* You have a UI that interfaces with `ULyraInputUserSettings` to display and modify key bindings (**Lyra comes with a settings widget**). This guide focuses on the backend setup required to make an action _available_ for rebinding.
* The "Interact" action might trigger a Gameplay Ability or a Native C++ function. The rebinding setup is largely independent of what the action _does_, focusing instead on the input mapping itself.

**Steps:**

1. **Step 1: Define the `UInputAction` (IA)**
   * **Purpose:** Create the abstract "Interact" action.
   * **Action:**
     * In the Content Browser, right-click > Input > Input Action.
     * Name it `IA_Interact`.
     * Open `IA_Interact`. Set its **Value Type** to `Boolean`.
     * Save the asset.
2. **Step 2: (Recommended for UI) Create `ULyraPlayerMappableKeySettings`**
   * **Purpose:** Provide metadata like a user-friendly display name and tooltip for this action when it appears in the settings UI.
   * **Action:**
     * In the Content Browser, right-click > Miscellaneous > Data Asset.
     * Select `LyraPlayerMappableKeySettings` as the parent class.
     * Name it `PMKS_Interact`.
     * Open `PMKS_Interact`:
       * **`Display Name`**: Set to "Interact" (or a more descriptive FText).
       * **`Tooltip`**: Set to "Perform contextual interaction with objects or characters."
       * **`Settings Grouping`** (Optional): If you have categories in your settings UI (e.g., "Movement," "Combat," "Interaction"), you can set this.
     * Save `PMKS_Interact`.
     * **Link to `IA_Interact`**: Open your `IA_Interact` asset. In its Details panel, find the **`Player Mappable Key Settings`** property and assign your `PMKS_Interact` asset to it.
     * Save `IA_Interact`.
3. **Step 3: Create or Update an `InputMappingContext` (IMC)**
   * **Purpose:** Define a _default_ hardware key mapping for `IA_Interact`. This is what the player will use initially, and what they can rebind from.
   * **Action:**
     * Create a new `InputMappingContext` or open an existing one that will contain default gameplay bindings (e.g., `IMC_Default_KBM`).
     * In this IMC, add a new mapping:
       * `Input Action`: Set to `IA_Interact`.
       * Key: Assign a default key, for example, press the 'E' key.
     * Save the IMC.
4. **Step 4: Ensure the IMC is Registered for Settings**
   * **Purpose:** This is the crucial step that tells the `ULyraInputUserSettings` system that the actions within this IMC (including your `IA_Interact`) should be available for rebinding.
   * **Action:** The `InputMappingContext` containing the `IA_Interact` mapping needs to be added to the player's `UEnhancedInputLocalPlayerSubsystem` with the `bRegisterWithSettings` flag set to `true`. This happens in one of two primary ways:
     * **Via `ULyraPawnData`:**
       * Open the `ULyraPawnData` asset used by your player pawn.
       * In the `InputMappings` array (TArray<`FPawnInputMappingContextAndPriority`>), find or add an entry for your IMC (e.g., `IMC_Default_KBM`).
       * Ensure its `bRegisterWithSettings` property is checked (set to `true`).
     * **Via `UGameFeatureAction_AddInputContextMapping`:**
       * If the IMC is being added by a Game Feature, open the `UGameFeatureAction_AddInputContextMapping` asset responsible for it.
       * In its `InputMappings` array (TArray<`FInputMappingContextAndPriority`>), find the entry for your IMC.
       * Ensure its `bRegisterWithSettings` property is checked (set to `true`).
   * **Note:** If an IMC is registered with settings, _all_ player-mappable `InputActions` within it become candidates for rebinding.
5. **Step 5: (Implementation Detail) How It Works with `ULyraInputUserSettings`**
   * When an IMC is added with `bRegisterWithSettings = true`, the `UEnhancedInputLocalPlayerSubsystem` (often triggered by `ULyraHeroComponent` or `UGameFeatureAction_AddInputContextMapping`'s `OnGameFeatureRegistering` logic) notifies its associated `ULyraInputUserSettings` instance.
   * The `ULyraInputUserSettings` then knows about `IA_Interact` (and its associated `PMKS_Interact` metadata) and its default mapping (e.g., 'E' key from `IMC_Default_KBM`).
   * Your settings UI (which you would build separately) would then:
     * Query `ULyraInputUserSettings` for all mappable keys.
     * Display "Interact" (from `PMKS_Interact`) and its current binding (initially 'E').
     * Allow the player to select `IA_Interact` and press a new key.
     * When the player applies changes, the UI calls functions on `ULyraInputUserSettings` (like `AddPlayerMappedKey` or similar methods to update the mapping for `IA_Interact` for the current profile) and then `SaveSettings()`.
     * `ULyraInputUserSettings::ApplySettings()` ensures the new custom mapping for `IA_Interact` takes precedence for that player.
6. **Step 6: Ensure the Action is Used**
   * Follow the steps in "How-To: Add a New Input to Trigger a Gameplay Ability" or "How-To: Add a New Native Input Binding (Non-Ability)" to make your `IA_Interact` actually _do_ something when triggered, using an appropriate `ULyraInputConfig` to map it to an `InputTag`. The rebinding mechanism works independently of what the action triggers.
7. **Step 7: Test (Requires a Settings UI)**
   * Play the game.
   * Open your (hypothetical) input settings screen.
   * You should see "Interact" listed as a rebindable action with its default key 'E'.
   * Try rebinding it to a different key (e.g., 'F').
   * Save settings.
   * Verify that pressing 'F' now triggers the interact action, and 'E' no longer does (for this specific `IA_Interact` action).

**Important Considerations:**

* **Unique Display Names:** Ensure the `DisplayName` in your `PlayerMappableKeySettings` is unique and clear for players.
* **Input Conflicts:** The Enhanced Input system has ways to handle conflicts (e.g., via context priorities), but your UI should ideally also warn players if they try to bind an action to a key already in use by another critical action within the same high-priority context.
* **Controller vs. KBM:** `ULyraInputUserSettings` and Enhanced Input can manage separate mappings for different hardware (keyboards, gamepads). Your UI (**Lyra default settings widgets automatically handles this**) would need to present these appropriately.

***

Making an input action rebindable in Lyra involves defining the action, providing optional UI metadata, ensuring its default mapping is in an `InputMappingContext` that is registered with user settings, and then building a UI to interface with `ULyraInputUserSettings`. This setup empowers players to tailor the game's controls to their preferences.

***
