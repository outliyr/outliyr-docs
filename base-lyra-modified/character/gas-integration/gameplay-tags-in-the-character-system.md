# Gameplay Tags in the Character System

Gameplay Tags are a powerful, hierarchical naming system (`FGameplayTag`) used extensively throughout Unreal Engine, GAS, and this character system. They serve multiple purposes, acting as identifiers, state markers, event triggers, and filters for various game logic. Understanding how tags are used is crucial for controlling character behavior, abilities, and interactions.

**Key Uses of Gameplay Tags:**

1. **State Tracking:** Representing the current status or condition of a character.
2. **Input Binding:** Linking player input actions directly to ability activation.
3. **Ability Control:** Defining what an ability does, what cancels it, and what blocks it.
4. **Filtering & Querying:** Selecting actors or components based on their current tags.
5. **Event Signaling:** Triggering actions or logic when specific tags are added or removed (often via Gameplay Effects or direct C++ calls).
6. **Identification:** Categorizing damage types, ability types, or character states.

**Where Tags Come From:**

* **Gameplay Effects:** The most common way tags are applied and removed. GEs can grant tags for their duration, add/remove tags permanently, or add/remove tags based on stack count.
* **Gameplay Abilities:** Abilities themselves have tags identifying them and tags defining activation/blocking conditions. They can also directly add/remove loose tags on the ASC.
* **Components:** Core components like `ALyraCharacter`, `ULyraHealthComponent`, and `ULyraHeroComponent` often interact with tags directly on the ASC to reflect state changes.
* **Direct C++ Calls:** Code can directly add/remove Loose Gameplay Tags on an ASC (`ASC->AddLooseGameplayTag`, `ASC->RemoveLooseGameplayTag`, `ASC->SetLooseGameplayTagCount`).

**Specific Examples in the Character System:**

Here's how different parts of the system utilize specific tags (referencing tags mentioned in the provided code):

**1. Movement State (`ALyraCharacter`, `ULyraCharacterMovementComponent`)**

* **Purpose:** Track the character's current movement mode (Walking, Falling, Custom, etc.) and status (Crouching).
* **Mechanism:** `ALyraCharacter::SetMovementModeTag` adds/removes tags based on the `MovementMode` and `CustomMovementMode` from the `ULyraCharacterMovementComponent`. It uses mappings defined in `LyraGameplayTags::MovementModeTagMap` and `CustomMovementModeTagMap`.
* **Tags:**
  * `LyraGameplayTags::MovementModeTagMap` values (e.g., `MovementMode.Walking`, `MovementMode.Falling`, `MovementMode.Flying`)
  * `LyraGameplayTags::CustomMovementModeTagMap` values (for custom movement modes)
  * `LyraGameplayTags::Status_Crouching`: Added/removed in `ALyraCharacter::OnStartCrouch/OnEndCrouch`.
* **Consumers:** Animation Blueprints often query these tags to select appropriate animations. Abilities might check these tags as activation conditions (e.g., cannot sprint while falling).

**2. Death State (`ULyraHealthComponent`)**

* **Purpose:** Indicate the character's progress through the death sequence.
* **Mechanism:** `ULyraHealthComponent` adds/removes tags on the ASC when `StartDeath` and `FinishDeath` are called.
* **Tags:**
  * `LyraGameplayTags::Status_Death_Dying`: Added in `StartDeath`.
  * `LyraGameplayTags::Status_Death_Dead`: Added in `FinishDeath`.
* **Consumers:** Game modes might check for `Status_Death_Dead` to handle respawning. Abilities might be blocked or cancelled if `Status_Death_Dying` is present (unless they have the `Ability_Behavior_SurvivesDeath` tag). UI might change based on these states.

**3. Input Actions (`ULyraHeroComponent`, `ULyraInputComponent`)**

* **Purpose:** Link Enhanced Input Actions to GAS ability activation.
* **Mechanism:** `ULyraInputComponent::BindAbilityActions` maps Input Actions (defined in `ULyraInputConfig`) to Gameplay Tags (also defined in `ULyraInputConfig`). When an input is pressed/released, `ULyraHeroComponent::Input_AbilityInputTagPressed/Released` calls the corresponding function on the ASC (`ASC->AbilityInputTagPressed/Released`).
* **Tags:** Defined in `ULyraInputConfig` (e.g., `InputTag.Ability.Primary`, `InputTag.Ability.Secondary`, `InputTag.Jump`, `InputTag.Crouch`).
* **Consumers:** Gameplay Abilities listen for these specific input tags to trigger their activation (`ActivateAbility`).

**4. Ability System Control (`ULyraHeroComponent`, ASC)**

* **Purpose:** Handling standard ability confirmations/cancellations.
* **Mechanism:** `ULyraHeroComponent` binds specific Input Actions (like Confirm/Cancel) directly to ASC functions.
* **Tags:** `LyraGameplayTags::InputTag_Confirm`, `LyraGameplayTags::InputTag_Cancel`.
* **Consumers:** The `UAbilitySystemComponent` itself uses these inputs for abilities that require confirmation or can be cancelled by the player.

**5. Damage Calculation & Effects (`ULyraHealthSet`, `ULyraDamageExecution`)**

* **Purpose:** Filtering damage, identifying damage sources, and triggering events.
* **Mechanism:** Tags are added to Gameplay Effect Specs or checked on the Target ASC.
* **Tags:**
  * `TAG_Gameplay_Damage`: (Engine default) Base tag identifying damage GEs.
  * `TAG_Gameplay_DamageImmunity`: Checked by `ULyraHealthSet::PreGameplayEffectExecute` on the Target ASC to potentially negate incoming damage.
  * `TAG_Gameplay_DamageSelfDestruct`: Added dynamically to the GE Spec by `ULyraHealthComponent::DamageSelfDestruct` to identify this specific damage type (often bypassing immunity).
  * `TAG_Gameplay_FellOutOfWorld`: Added dynamically to the GE Spec when damage is from falling out of the world.
  * `LyraGameplayTags::Cheat_GodMode`, `Cheat_UnlimitedHealth`: Checked by `ULyraHealthSet` to prevent health loss (unless self-destruct).
  * `LyraGameplayTags::GameplayEvent_Death`: Sent as a Gameplay Event tag via `AbilitySystemComponent->HandleGameplayEvent` by `ULyraHealthComponent::HandleOutOfHealth` to potentially trigger death-specific abilities on the Target ASC.
  * Source/Target Tags: Captured by executions (`ExecutionParams.GetOwningSpec().CapturedSourceTags, ...CapturedTargetTags`) and can be used in calculations or passed in messages.
* **Consumers:** Attribute Sets (`Pre/PostGameplayEffectExecute`), Damage Executions, Gameplay Abilities listening for event tags.

**6. Camera Perspective (`ULyraCameraMode`)**

* **Purpose:** Allow other systems (especially Animation Blueprints) to know the current camera perspective.
* **Mechanism:** `ULyraCameraMode::OnActivation/OnDeactivation` adds/removes the `CameraTagToAddToPlayer` as a loose tag on the Target Actor's ASC.
* **Tags:** Defined per camera mode (e.g., `Camera.View.FirstPerson`, `Camera.View.ThirdPerson`).
* **Consumers:** Animation Blueprints are a primary consumer, adjusting animation logic (like head stabilization or arm IK) based on the active camera view tag.

**7. Messaging (`ULyraHealthComponent`, `ULyraDamageExecution`)**

* **Purpose:** Broadcasting standardized game events.
* **Mechanism:** Systems use tags as the "Verb" when broadcasting messages via the `UGameplayMessageSubsystem`.
* **Tags:** `TAG_Lyra_Elimination_Message`, `TAG_Lyra_Damage_Message`, `TAG_Lyra_Camera_Message_CameraModeChanged`.
* **Consumers:** Any system listening to the `UGameplayMessageSubsystem` for these specific tags (e.g., UI displaying kill messages, stats tracking systems).

**Best Practices:**

* **Use Tags for State:** Prefer Gameplay Tags applied via Gameplay Effects for representing character states (stunned, burning, immune) over simple boolean flags.
* **Leverage Hierarchy:** Define tags in a clear hierarchy (e.g., `Status.Debuff.Stun`, `InputTag.Ability.Weapon`) for better organization and easier querying (you can check for `Status.Debuff` to see if any debuff is active).
* **Data-Driven:** Define tags in the Project Settings -> Gameplay Tags editor. Use tags defined in `ULyraInputConfig` and Ability assets rather than hardcoding strings.
* **Listen, Don't Poll:** Use tag-change delegates (`ASC->RegisterGameplayTagEvent`) or Gameplay Effect removal delegates instead of checking tag counts every frame where possible.

Gameplay Tags provide a powerful and flexible way to manage state and communication between different parts of the character system and GAS. Effectively utilizing them is key to building complex and reactive gameplay.

