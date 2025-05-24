# Gameplay Ability Activation

The final stage in the journey of an input intended to trigger a Gameplay Ability involves the **`ULyraAbilitySystemComponent` (ASC)** and the **`ULyraGameplayAbility`** itself. After the `ULyraHeroComponent` has processed an input and determined the relevant `InputTag` (derived from the active `ULyraInputConfig`), it passes this tag to the ASC. The ASC then takes over to find and potentially activate a corresponding ability.

**`ULyraAbilitySystemComponent` (ASC)**

* **Role:** The ASC is the heart of the Gameplay Ability System for an actor. It manages granted abilities, attributes, active gameplay effects, and handles the logic for ability activation, execution, and termination. In Lyra, it's typically found on the `ALyraPlayerState` for player-controlled characters, but can also be on Pawns or other actors.
* **Receiving Input Events:**
  * **`AbilityInputTagPressed(const FGameplayTag& InputTag)`:**
    * This function is called by the `ULyraHeroComponent` when an input action (mapped to an ability in `ULyraInputConfig`) is triggered (e.g., key pressed).
    * Its core logic is to iterate through all `FGameplayAbilitySpec`s in its `ActivatableAbilities.Items` list.
    * For each `AbilitySpec`, it checks if the `AbilitySpec.GetDynamicSpecSourceTags()` (which includes the `InputTag` assigned when the ability was granted, often via `ULyraAbilitySet`) contains the `InputTag` received from the `ULyraHeroComponent`.
    * If a match is found:
      * It adds the `AbilitySpec.Handle` to internal lists (`InputPressedSpecHandles`, `InputHeldSpecHandles`) for tracking.
      * The actual attempt to activate the ability often happens within `ProcessAbilityInput` based on these tracked handles and the ability's activation policy.
  * **`AbilityInputTagReleased(const FGameplayTag& InputTag)`:**
    * Called by `ULyraHeroComponent` when an input action is completed (e.g., key released).
    * It similarly iterates through `ActivatableAbilities` to find matching `AbilitySpec`s.
    * It adds the `AbilitySpec.Handle` to `InputReleasedSpecHandles` and removes it from `InputHeldSpecHandles`.
    * This can trigger `AbilitySpecInputReleased` on an active ability or influence abilities with a "While Input Active" policy.
* **Processing Input and Activating Abilities (`ProcessAbilityInput(float DeltaTime, bool bGamePaused)`):**
  * This function is typically called every frame (e.g., by the PlayerController or Pawn).
  * It processes the `InputPressedSpecHandles`, `InputReleasedSpecHandles`, and `InputHeldSpecHandles` arrays.
  * **For Held Inputs:** If an ability spec in `InputHeldSpecHandles` has an activation policy of `ELyraAbilityActivationPolicy::WhileInputActive` and is not yet active, it will be added to a list of abilities to try activating.
  * **For Pressed Inputs:** If an ability spec in `InputPressedSpecHandles` has an activation policy of `ELyraAbilityActivationPolicy::OnInputTriggered` and is not yet active, it will be added to the list to try activating. If the ability is already active, `AbilitySpecInputPressed()` is called on the spec, allowing the active ability instance to react to further presses if designed to do so.
  * **Activation Attempt:** It then iterates through the collected list of abilities to activate and calls `TryActivateAbility(AbilitySpecHandle)` for each.
  * **For Released Inputs:** If an ability spec in `InputReleasedSpecHandles` is active, `AbilitySpecInputReleased()` is called on the spec. This can signal an active ability that its input has been released, potentially causing it to end or change behavior.
* **Core Activation Logic:**
  * `TryActivateAbility(FGameplayAbilitySpecHandle AbilityHandle, bool bAllowRemoteActivation = true)`: This is the fundamental GAS function that checks if an ability can be activated (costs, cooldowns, tags, etc.) and then proceeds to activate it if all checks pass.
  * `CallServerTryActivateAbility()` / `ClientActivateAbilitySucceed()` / `ClientActivateAbilityFailed()`: Handles the network replication aspects of ability activation.

**`ULyraGameplayAbility`**

* **Role:** This is the base class for all gameplay abilities in Lyra. It defines the logic, effects, and conditions of a specific action a character can perform (e.g., jump, fire weapon, cast spell).
* **Association with an `InputTag`:**
  * A `ULyraGameplayAbility` doesn't directly know about an `InputTag` in its class definition.
  * The link is established when the ability is **granted** to an ASC. Typically in Lyra, this happens via a `ULyraAbilitySet`.
  * The `FLyraAbilitySet_GameplayAbility` struct within a `ULyraAbilitySet` has an `InputTag` field.
  * When `ULyraAbilitySet::GiveToAbilitySystem` is called, it creates an `FGameplayAbilitySpec` for the ability. The `InputTag` from the `FLyraAbilitySet_GameplayAbility` is added to this `FGameplayAbilitySpec`'s `DynamicSpecSourceTags`.
  * **Crucially, this `InputTag` in the `ULyraAbilitySet` MUST match the `InputTag` configured in the `ULyraInputConfig`'s `AbilityInputActions` list for the input to trigger this specific ability.**
* **Activation Policies (`ELyraAbilityActivationPolicy`):**
  * `OnInputTriggered`: The ability attempts to activate when its associated input is first pressed.
  * `WhileInputActive`: The ability attempts to activate when its input is pressed and remains active as long as the input is held. It will typically end or be cancelled when the input is released.
  * `OnSpawn`: The ability attempts to activate automatically when the owning actor spawns or the ability is granted.\
    (These are defined on the `ULyraGameplayAbility` CDO).
* **Reacting to Input in an Active Ability:**
  * Even after an ability is activated, it might need to respond to further input events (e.g., a charged ability).
  * `UGameplayAbility::AbilitySpecInputPressed()` and `UGameplayAbility::AbilitySpecInputReleased()`: These virtual functions can be overridden in a `ULyraGameplayAbility` subclass to react to continued input presses or releases while the ability is active. This is often used in conjunction with ability tasks like `UAbilityTask_WaitInputPress` or `UAbilityTask_WaitInputRelease`.

**The Complete Chain for an Ability Input:**

1. **Hardware Key Press** (e.g., Left Mouse Button).
2. **`InputMappingContext`** maps `LMB` -> `IA_PrimaryFire`.
3. **`IA_PrimaryFire`** (Input Action) is triggered.
4. **`ULyraInputConfig`** (active for the Pawn) maps `IA_PrimaryFire` -> `InputTag.Ability.PrimaryFire`.
5. **`ULyraInputComponent`** (on Pawn), during setup by `ULyraHeroComponent`, bound `IA_PrimaryFire` (identified by `InputTag.Ability.PrimaryFire`) to `ULyraHeroComponent::Input_AbilityInputTagPressed`.
6. Player presses LMB: `ULyraHeroComponent::Input_AbilityInputTagPressed(InputTag.Ability.PrimaryFire)` is called.
7. `ULyraHeroComponent` calls `MyASC->AbilityInputTagPressed(InputTag.Ability.PrimaryFire)`.
8. **`ULyraAbilitySystemComponent`** (`MyASC`):
   * Finds a granted `FGameplayAbilitySpec` for `GA_Weapon_Fire` whose `DynamicSpecSourceTags` contains `InputTag.Ability.PrimaryFire` (this tag was added when `GA_Weapon_Fire` was granted via a `ULyraAbilitySet` that specified `InputTag.Ability.PrimaryFire` for it).
   * Marks this spec for activation.
   * `MyASC->ProcessAbilityInput()` eventually calls `TryActivateAbility()` on the `GA_Weapon_Fire` spec.
9. **`ULyraGameplayAbility`** (`GA_Weapon_Fire`): If activation checks pass, its `ActivateAbility()` method is called, and the weapon fires.

***

### Summary

The `ULyraAbilitySystemComponent` acts as the receiver for `InputTags` dispatched by the `ULyraHeroComponent`. It uses these tags to identify which of its granted abilities should react to the input, considering the ability's activation policy. The `ULyraGameplayAbility` itself is linked to an `InputTag` at the point of granting (typically via `ULyraAbilitySet`), enabling this sophisticated, data-driven activation chain.

This concludes the detailed walkthrough of how a player's input press becomes a Gameplay Ability activation in Lyra. The subsequent sections will focus on how to configure these pieces and customize various aspects of the input system.

#### **Next Step in Documentation:**

With the core flow understood, the next logical step is to explore how these different pieces are configured and brought together using Data Assets and Game Features.

***
