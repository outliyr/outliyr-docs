# Modular Input with GameFeatures

> [!success]
> This page will cover the input related aspect of how GameFeatures can be used, for more information outside of the input behaviour check it's [documentation page](../../gameframework-and-experience/game-features/).

Lyra's architecture heavily leverages **Game Feature Plugins** to achieve modularity. This extends to the input system, allowing distinct features (like a new game mode, a vehicle system, or a unique set of character abilities) to introduce their own input configurations without altering core game files. This is primarily achieved through specific **Game Feature Actions**.

When a Game Feature Plugin is activated (often driven by the current `ULyraExperienceDefinition`), its defined actions are executed, allowing it to:

* Add new `InputMappingContexts` (IMCs) to define how hardware inputs map to `Input Actions`.
* Add new `ULyraInputConfig` assets to define how `Input Actions` map to `GameplayTags` for ability or native function binding.
* Grant abilities (via `ULyraAbilitySet`s) that are linked to these new or existing input configurations.

**Key Game Feature Actions for Input:**

1. **`UGameFeatureAction_AddInputContextMapping`**
   * **Purpose:** This action is used to add one or more `InputMappingContext` (IMC) assets to the local player's `UEnhancedInputLocalPlayerSubsystem` when the Game Feature activates.
   * **Configuration (within the Action asset):**
     * `InputMappings` (TArray<`FInputMappingContextAndPriority`>): An array where each element specifies:
       * `InputMapping` (TSoftObjectPtr<`UInputMappingContext`>): A reference to the IMC asset to add.
       * `Priority` (int32): The priority for this IMC. Higher priority IMCs are processed first by the Enhanced Input system.
       * `bRegisterWithSettings` (bool): If true, this IMC's mappable actions are registered with `UEnhancedInputUserSettings`, potentially allowing them to be rebound by the player.
   * **Use Cases:**
     * A "VehicleGameplay" feature adding an `IMC_VehicleControls` with high priority to override standard on-foot controls.
     * A "PauseMenu" feature adding an `IMC_MenuNavigation` with very high priority to handle menu inputs.
     * A game mode feature adding an IMC for mode-specific interactions.
   * **Mechanism:** On feature activation, it iterates its `InputMappings` and calls `InputSubsystem->AddMappingContext()`. On deactivation, it removes them. It also handles registration/unregistration with `UEnhancedInputUserSettings` during the feature's own registration/unregistration lifecycle.
2. **`UGameFeatureAction_AddInputBinding`**
   * **Purpose:** This action is used to activate `ULyraInputConfig` assets, effectively making their `InputAction`-to-`GameplayTag` mappings available to the `ULyraHeroComponent` and `ULyraInputComponent` for binding.
   * **Configuration (within the Action asset):**
     * `InputConfigs` (TArray\<TSoftObjectPtr\<const `ULyraInputConfig`>>): An array of `ULyraInputConfig` assets to make active.
   * **Use Cases:**
     * A feature introducing a new set of abilities that need to be triggered by existing or new `InputActions`. The feature would provide an `ULyraInputConfig` mapping those `InputActions` to the `InputTags` used by its new abilities.
     * Temporarily changing how existing `InputActions` are interpreted (e.g., making `IA_PrimaryAction` map to `InputTag.Ability.Build` instead of `InputTag.Ability.Fire` while a "BuildMode" feature is active). _Care must be taken with ordering and removal if overriding existing configs._
   * **Mechanism:** On feature activation, for each Pawn ready to bind inputs (often signaled by `ULyraHeroComponent::NAME_BindInputsNow`), this action calls `ULyraHeroComponent::AddAdditionalInputConfig()` for each specified `ULyraInputConfig`. This causes the `ULyraInputComponent` to bind the actions within that config. On deactivation, it calls `ULyraHeroComponent::RemoveAdditionalInputConfig()` to undo these bindings.
3. **`UGameFeatureAction_AddAbilities` (Relevant for Input)**
   * **Purpose (in context of input):** While its primary role is to grant abilities and attribute sets, it's often used in conjunction with the input actions above. When this action grants an `ULyraAbilitySet`, any `InputTag`s specified within that set for its abilities become relevant.
   * **Connection:** You would typically use:
     1. `UGameFeatureAction_AddInputContextMapping` to define how keys map to `InputActions` (e.g., 'G' key -> `IA_ThrowGrenade`).
     2. `UGameFeatureAction_AddInputBinding` to provide an `ULyraInputConfig` that maps `IA_ThrowGrenade` -> `InputTag.Ability.Grenade`.
     3. `UGameFeatureAction_AddAbilities` to grant an `ULyraAbilitySet` which, in turn, grants `GA_ThrowGrenade` and associates it with `InputTag.Ability.Grenade`.
   * This ensures that when the feature is active, the player has the new keybinds, the new input interpretation, and the new ability itself, all correctly linked.

**Benefits of Using Game Features for Input:**

* **Encapsulation:** Input logic specific to a feature (e.g., vehicle controls, special game mode actions) is contained within that feature's plugin.
* **Reduced Core Game Changes:** New input schemes or abilities can be added without modifying the base player pawn or core input components directly.
* **On-Demand Loading:** Input configurations are only active when the relevant feature is active, potentially saving resources and avoiding input conflicts.
* **Extensibility:** Makes it easier for your project or other developers to add new input-driven functionalities as separate modules.

**Example Scenario: Adding a "Grappling Hook" Feature**

1. **Create Game Feature Plugin:** "MyProject_GrapplingHook"
2. **Inside Plugin Content:**
   * `IA_Grapple`: New `UInputAction`.
   * `IMC_GrappleControls`: New `UInputMappingContext` mapping a key (e.g., 'Q') to `IA_Grapple`.
   * `InputConfig_Grapple`: New `ULyraInputConfig` mapping `IA_Grapple` to `InputTag.Ability.Grapple`.
   * `GA_GrappleAbility`: New `ULyraGameplayAbility`.
   * `AbilitySet_Grapple`: New `ULyraAbilitySet` granting `GA_GrappleAbility` and linking it to `InputTag.Ability.Grapple`.
3. **In the Game Feature's Actions (e.g., in the Experience Definition that enables this feature):**
   * Add `UGameFeatureAction_AddInputContextMapping`:
     * Configure it with `IMC_GrappleControls` (Priority might be 1, if default gameplay is 0).
   * Add `UGameFeatureAction_AddInputBinding`:
     * Configure it with `InputConfig_Grapple`.
   * Add `UGameFeatureAction_AddAbilities`:
     * Configure it to grant `AbilitySet_Grapple` to the player character class.

Now, when the "GrapplingHook" feature is active, players will have the 'Q' key bound, it will be interpreted as the grapple ability input, and they will have the grapple ability granted and ready to be triggered.

***

### **Summary:**

Game Feature Actions provide a powerful and clean way to dynamically introduce and manage input configurations. By using actions like `UGameFeatureAction_AddInputContextMapping` and `UGameFeatureAction_AddInputBinding`, developers can create self-contained gameplay modules that bring their own input schemes and ability bindings, integrating seamlessly with Lyra's core input system.

**Next Step in Documentation:**

Having covered the core flow and configuration aspects, the next section will focus on how you can customize the _behavior_ of the input itself, such as sensitivity, dead zones, and user-configurable settings.

***
