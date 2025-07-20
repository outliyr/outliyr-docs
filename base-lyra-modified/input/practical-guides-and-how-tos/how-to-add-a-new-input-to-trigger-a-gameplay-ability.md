# How-To: Add a New Input to Trigger a Gameplay Ability

This guide walks you through the complete process of setting up a new hardware input (like a key press) to trigger a specific `ULyraGameplayAbility`. This involves creating or identifying several assets and ensuring they are correctly linked. Once you've successfully set this up, you can refer to the [**Input & Keybindings documentation**](../../settings/input-and-keybindings.md) to learn how to make this new input action rebindable in the game's settings menu.

**Goal:** Make pressing the 'G' key trigger a "Throw Grenade" Gameplay Ability.

**Steps:**

1. **Step 1: Define the `UInputAction` (IA)**
   * **Purpose:** Create an abstract representation of the "Throw Grenade" action.
   * **Action:**
     * In the Content Browser, right-click > Input > Input Action.
     * Name it something like `IA_ThrowGrenade`.
     * Open `IA_ThrowGrenade`. Set its **Value Type** to `Boolean` (as it's a simple press/release action).
     * Save the asset.
2. **Step 2: Define the `InputTag` for the Ability**
   * **Purpose:** Create a unique `GameplayTag` that will represent the intent to use this ability via input.
   * **Action:**
     * Open your project's `GameplayTag` manager (usually via Project Settings > Project > Gameplay Tags).
     * Add a new tag, for example: `InputTag.Ability.Gadget.ThrowGrenade`.
     * (Ensure this tag is added to your `GameplayTagList` if you manage tags via an INI file).
3. **Step 3: Update or Create a `ULyraInputConfig`**
   * **Purpose:** Map your new `IA_ThrowGrenade` to the `InputTag.Ability.Gadget.ThrowGrenade`.
   * **Action:**
     * Locate an existing `ULyraInputConfig` that's active for your player pawn (e.g., one assigned in `ULyraPawnData` or added by a Game Feature). Let's assume `InputConfig_DefaultCharacter`.
     * Open `InputConfig_DefaultCharacter`.
     * Find the `AbilityInputActions` array.
     * Add a new element:
       * `InputAction`: Set to your `IA_ThrowGrenade`.
       * `InputTag`: Set to `InputTag.Ability.Gadget.ThrowGrenade`.
     * Save the `ULyraInputConfig`.
     * _(Alternatively, if this input is part of a new Game Feature, you might create a new `ULyraInputConfig` just for that feature and add it via `GameFeatureAction_AddInputBinding`)_.
4. **Step 4: Create or Update an `InputMappingContext` (IMC)**
   * **Purpose:** Map the physical 'G' key to your `IA_ThrowGrenade`.
   * **Action:**
     * Locate an existing IMC that's active for your player pawn when using Keyboard & Mouse (e.g., `IMC_Default_KBM` from `ULyraPawnData`).
     * Open `IMC_Default_KBM`.
     * Under "Mappings," click the "+" to add a new mapping.
     * For the new mapping:
       * Assign the `IA_ThrowGrenade` asset to the `Input Action` field.
       * Click the keyboard icon next to the mapping entry and press the 'G' key.
       * (Optional) Add Triggers if needed (e.g., if you only want it on "Pressed"). By default, it will trigger on press and release type events based on how `BindAbilityActions` works.
     * Save the `IMC_Default_KBM`.
     * _(Ensure this IMC is actually being added to the player, typically via `ULyraPawnData` , `GameFeatureAction_AddInputContextMapping` or during runtime)_.
5. **Step 5: Create the `ULyraGameplayAbility`**
   * **Purpose:** Define the actual logic for throwing a grenade.
   * **Action:**
     * Create a new Blueprint class inheriting from `ULyraGameplayAbility`. Name it something like `GA_ThrowGrenade`.
     * Implement the grenade throwing logic within this Blueprint (e.g., spawning a projectile, playing an animation).
     * In its Class Defaults, you might want to set:
       * `Ability Tags`: Add a tag like `Ability.Action.Gadget.ThrowGrenade` (this is for the ability itself, not the input).
       * `Activation Policy`: Likely `OnInputTriggered`.
6. **Step 6: Grant the Ability via a `ULyraAbilitySet`**
   * **Purpose:** Give the `GA_ThrowGrenade` ability to the player and, crucially, link it to the `InputTag.Ability.Gadget.ThrowGrenade`.
   * **Action:**
     * Create or open an existing `ULyraAbilitySet` (e.g., `AbilitySet_Gadgets` or one associated with the player's core abilities).
     * In the `GrantedGameplayAbilities` array, add a new element:
       * `Ability`: Set to your `GA_ThrowGrenade`.
       * `AbilityLevel`: Set to `1` (or as appropriate).
       * **`InputTag`**: Set to `InputTag.Ability.Gadget.ThrowGrenade`. **This is the critical link!**
     * Save the `ULyraAbilitySet`.
     * Ensure this `ULyraAbilitySet` is granted to the player (e.g., via `ULyraPawnData`'s `AbilitySets` array, or through `GameFeatureAction_AddAbilities`).
7. **Step 7: Test**
   * Play the game.
   * Ensure your Pawn has the necessary `ULyraPawnData` (which references the updated `InputConfig_DefaultCharacter` and `IMC_Default_KBM`, and grants `AbilitySet_Gadgets`).
   * Press the 'G' key. Your `GA_ThrowGrenade` ability should activate.

**Troubleshooting Checklist:**

* **IMC Active?** Is the `IMC_Default_KBM` (or whichever IMC has the 'G' key mapping) actually being added to the `UEnhancedInputLocalPlayerSubsystem`? Check `ULyraHeroComponent::InitializePlayerInput` or relevant Game Feature Actions.
* **InputConfig Active?** Is `InputConfig_DefaultCharacter` (or the relevant one) active for the Pawn? Check `ULyraPawnData` or Game Feature Actions.
* **IA -> InputTag Mapping Correct in InputConfig?** Does `InputConfig_DefaultCharacter` correctly map `IA_ThrowGrenade` to `InputTag.Ability.Gadget.ThrowGrenade` in its `AbilityInputActions`?
* **Ability Granted?** Is `AbilitySet_Gadgets` (or the relevant set) being granted to the player's ASC?
* **InputTag Match in AbilitySet?** Does the `GA_ThrowGrenade` entry in `AbilitySet_Gadgets` have its `InputTag` property set precisely to `InputTag.Ability.Gadget.ThrowGrenade`? (Typos are common here!)
* **Ability Blocked?** Check the ASC logs for any reasons why the ability might be failing to activate (e.g., blocked by other tags, cooldowns, costs). Use the `showlog` and `AbilitySystem.Debug` console commands.

By following these steps, you establish a clear, data-driven path from a physical key press all the way to the activation of your desired Gameplay Ability.

***

This detailed guide provides a concrete example of how to add new input-driven abilities. The subsequent How-To guides will cover other common scenarios, building on the principles outlined here.
