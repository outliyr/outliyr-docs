# Pawn-Level Configuration

> [!success]
> This page will cover the input related aspect of the LyraPawnData, for more information outside of the input behaviour check it's [documentation page](../../gameframework-and-experience/experience-primary-assets/lyrapawndata.md).

The **`ULyraPawnData`** Data Asset is a central piece for defining a specific type or archetype of Pawn in Lyra. It bundles together various settings, including crucial configurations for how that Pawn type should handle input. When a Pawn is spawned and initialized with a specific `ULyraPawnData`, its input behavior is largely dictated by the settings within this asset.

**Role of `ULyraPawnData` in Input Setup:**

When a player-controlled Pawn is initialized, the `ULyraHeroComponent` on that Pawn reads from the assigned `ULyraPawnData` to configure several aspects of the input system:

1.  **Assigning the Primary `ULyraInputConfig`:**

    * **Property:** `InputConfig` (TObjectPtr<`ULyraInputConfig`>)
    * **Purpose:** This property directly references the `ULyraInputConfig` asset that should be considered the "default" or "base" input configuration for any Pawn using this `PawnData`.
    * **Mechanism:** The `ULyraHeroComponent::InitializePlayerInput()` function retrieves this `InputConfig` from the `PawnData`. This `InputConfig` is then passed to `ULyraInputComponent::BindNativeAction()` and `ULyraInputComponent::BindAbilityActions()` to establish the mappings between `Input Actions` and their corresponding `GameplayTags` (and thus, to C++ functions or ability activation).
    * **Your Role:** For each distinct Pawn archetype (e.g., standard player, a specific vehicle type if it has its own Pawn class), you will assign the `ULyraInputConfig` that defines its primary input-to-tag mappings here.


2. **Adding Default `InputMappingContexts` (IMCs):**
   * **Property:** `InputMappings` (TArray<`FPawnInputMappingContextAndPriority`>)
   * **Purpose:** This array allows you to specify a list of `InputMappingContext` assets that should be automatically added to the `UEnhancedInputLocalPlayerSubsystem` when a Pawn using this `PawnData` is possessed by a local player. This sets up the default hardware-to-`InputAction` bindings.
   * **`FPawnInputMappingContextAndPriority` Struct:**
     * `InputMapping` (TObjectPtr<`UInputMappingContext`>): A reference to the IMC asset.
     * `Priority` (int32): The priority for this IMC.
     * `bRegisterWithSettings` (bool): If true, this IMC will be registered with the `UEnhancedInputUserSettings`, making its mapped actions potentially available for player rebinding in a settings menu.
   * **Mechanism:** During `ULyraHeroComponent::InitializePlayerInput()`, the component iterates through this `InputMappings` array and calls `Subsystem->AddMappingContext()` for each IMC, applying its specified priority.
   * **Your Role:** Populate this array with the IMCs that define the essential, always-active key/button bindings for this Pawn type (e.g., `IMC_Default_KBM`, `IMC_Default_Gamepad`).

**Example Configuration in `PawnData_DefaultCharacter`:**

* **`InputConfig`:** -> `InputConfig_StandardControls` (This asset maps `IA_Jump` to `InputTag.Ability.Jump`, `IA_Move` to `InputTag.Move`, etc.)
* **`InputMappings`:**
  * Entry 0:
    * `InputMapping`: -> `IMC_Default_KBM` (Maps W,A,S,D to `IA_Move`; Space to `IA_Jump`, etc.)
    * `Priority`: 0
    * `bRegisterWithSettings`: true
  * Entry 1:
    * `InputMapping`: -> `IMC_Default_Gamepad` (Maps Gamepad Left Stick to `IA_Move`; Gamepad Face Button Bottom to `IA_Jump`, etc.)
    * `Priority`: 0
    * `bRegisterWithSettings`: true

***

### **Summary:**

The `ULyraPawnData` acts as the primary data-driven source for a Pawn's initial input setup. It dictates:

* Which `ULyraInputConfig` is used to translate `InputActions` into Lyra's `GameplayTag` system.
* Which default `InputMappingContexts` (defining hardware-to-`InputAction` bindings) are active for the player controlling that Pawn.

By modifying these properties within different `ULyraPawnData` assets, you can create diverse Pawn types with distinct base input schemes without altering C++ code.

**Next:**

While `ULyraPawnData` sets up the general input interpretation and hardware bindings, the actual Gameplay Abilities triggered by these inputs are often granted via `ULyraAbilitySet`s, which also play a role in linking abilities to `InputTags`.

***
