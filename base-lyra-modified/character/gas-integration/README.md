# GAS Integration

Epic Games' Gameplay Ability System (GAS) is the engine driving character actions, stats, statuses, and reactions within this asset, building upon the robust foundation laid by Lyra. Understanding how GAS components are structured and interact with the character classes is key to customizing gameplay.

### ASC Location & Initialization

The Ability System Component (ASC) is the central hub for GAS on any given actor. How it's assigned to a character depends on the character type:

**1. Player Characters (via `ALyraPlayerState`) - The Standard Pattern**

* **Location:** For player-controlled characters (`ALyraCharacter` derivatives), the `ULyraAbilitySystemComponent` typically resides on the associated `ALyraPlayerState`.
* **Rationale:** The Player State persists across pawn possessions (e.g., respawns). Placing the ASC here ensures that abilities, attributes, level, and long-term status effects remain with the _player_, not just the temporary pawn.
* **Initialization:**
  * The `ULyraPawnExtensionComponent` on the Pawn is responsible for finding and linking to the Player State's ASC.
  * When a Pawn is possessed by a Controller, the `PossessedBy` flow triggers `ULyraPawnExtensionComponent::HandleControllerChanged`.
  * On clients, when the Player State replicates, `ALyraCharacter::OnRep_PlayerState` triggers `ULyraPawnExtensionComponent::HandlePlayerStateReplicated`.
  * These handlers prompt the `PawnExtensionComponent` to check if initialization is possible (see `CheckDefaultInitialization` and `CanChangeInitState`).
  * Eventually, `ULyraPawnExtensionComponent::InitializeAbilitySystem` is called. It gets the ASC from the `ALyraPlayerState` (retrieved via the Controller) and calls `ASC->InitAbilityActorInfo(OwnerActor, AvatarActor)`.
    * `OwnerActor`: Usually the Player State (who owns the component).
    * `AvatarActor`: The Pawn itself (the physical representation being controlled).
* **Access:** The Pawn (`ALyraCharacter`) accesses its associated ASC via `GetAbilitySystemComponent()`, which delegates the call to `ULyraPawnExtensionComponent::GetLyraAbilitySystemComponent()`. The `PawnExtensionComponent` returns its cached pointer established during initialization.

**2. Self-Contained Characters (`ALyraCharacterWithAbilities`)**

* **Location:** For characters like AI or networked objects that don't rely on a Player State, `ALyraCharacterWithAbilities` creates and holds its own `ULyraAbilitySystemComponent` as a direct subobject.
* **Initialization:**
  * The ASC is created in the constructor.
  * In `PostInitializeComponents`, the character calls `AbilitySystemComponent->InitAbilityActorInfo(this, this)`, setting itself as both the Owner and the Avatar.
* **Access:** `ALyraCharacterWithAbilities` overrides `GetAbilitySystemComponent()` to directly return its internal `AbilitySystemComponent` member.

### Attribute Sets (`ULyraAttributeSet`, `ULyraHealthSet`, `ULyraCombatSet`)

Attribute Sets hold the numerical data defining a character's state (like health, damage potential, etc.). They live alongside the ASC (either on the Player State or the character itself).

* **`ULyraAttributeSet`:** The base class providing common helper functions like `GetLyraAbilitySystemComponent()`.
* **`ATTRIBUTE_ACCESSORS` Macro:** A C++ convenience macro used within attribute set headers (`.h` files) to automatically generate standard getter, setter, and initializer functions for attributes (e.g., `GetHealth()`, `SetHealth()`, `InitHealth()`, `GetHealthAttribute()`).

**`ULyraHealthSet`**

* **Purpose:** Manages attributes directly related to the character's vitality and damage reception.
* **Key Attributes:**
  * **`Health`:** The current health value. Replicates and clamped between `0` and `MaxHealth`. Hidden from direct Gameplay Effect modifiers; only Executions or direct C++ calls should change it (typically via the `Damage` or `Healing` meta attributes).
  * **`MaxHealth`:** The maximum health value. Replicates and clamped to be >= `1`. Can be modified by Gameplay Effects.
* **Meta Attributes (Transient Calculation Inputs):**
  * **`Damage`:** A _temporary_ attribute representing incoming damage calculated by a `GameplayEffectExecutionCalculation` (like `ULyraDamageExecution`). `PostGameplayEffectExecute` uses this value to decrease `Health` and then resets `Damage` to 0. Hidden from direct GE modifiers.
  * **`Healing`:** Similar to `Damage`, but represents incoming healing calculated by an Execution (like `ULyraHealExecution`). `PostGameplayEffectExecute` uses this to increase `Health` and resets `Healing` to 0.
* **Clamping:** Uses `PreAttributeBaseChange`, `PreAttributeChange`, and `ClampAttribute` to enforce `Health` limits (0 to `MaxHealth`) and `MaxHealth` minimum (1.0f). Also ensures `Health` doesn't exceed `MaxHealth` if `MaxHealth` is lowered.
* **Delegates:** Broadcasts events when attributes change, crucial for UI and game logic:
  * `OnHealthChanged`: Fired when `Health` changes (via replication or `PostGameplayEffectExecute`).
  * `OnMaxHealthChanged`: Fired when `MaxHealth` changes (via replication or `PostGameplayEffectExecute`).
  * `OnOutOfHealth`: Fired _once_ when `Health` drops to 0 or below. Used by `ULyraHealthComponent` to initiate the death sequence.
  * _Note:_ On clients listening to these delegates, instigator/causer information might be null as it often relies on server-side context.

**`ULyraCombatSet`**

* **Purpose:** Holds attributes primarily used as _inputs_ for damage and healing calculations within Executions.
* **Key Attributes:**
  * **`BaseDamage`:** Represents the base damage potential of an attack or effect. Captured by `ULyraDamageExecution` from the _Source_'s ASC. Replicates owner-only.
  * **`BaseHeal`:** Represents the base healing potential. Captured by `ULyraHealExecution` from the _Source_'s ASC. Replicates owner-only.
* **Meta Attribute (`TotalDamage`):**
  * Tracks the total damage dealt during a GameplayEffect execution. While `HealthSet::Damage` and `ShieldSet::Damage` are used to apply actual damage to respective attributes, `CombatSet::TotalDamage` is useful for consolidated feedback (e.g., damage number popups). This is especially relevant when damage is split across multiple layers, such as shield and health, allowing you to show a single, combined damage value in gameplay cues.

> [!info]
> Although not part of the actual damage application logic, `TotalDamage` is typically modified during executions like `ULyraShieldDamageExecution` in **ShooterBase** and is consumed by gameplay cues to present unified damage feedback to the player.

### Gameplay Effect Executions (`ULyraDamageExecution`, `ULyraHealExecution`)

Executions provide custom C++ logic to calculate the outcome of a Gameplay Effect, essential for complex interactions like damage.

* **`ULyraDamageExecution`:**
  * **Triggered by:** Applying a Gameplay Effect containing this execution.
  * **Input:** Captures `BaseDamage` from the _Source_'s `ULyraCombatSet`.
  * **Context:** Accesses the `FLyraGameplayEffectContext` to retrieve detailed information like the Effect Causer, Hit Result (if any), Physical Material, and potentially an `ILyraAbilitySourceInterface` for advanced calculations.
  * **Calculation:**
    1. Determines the actual Hit Actor and Impact Location.
    2. Checks team affiliation using `ULyraTeamSubsystem` to apply `DamageInteractionAllowedMultiplier` (preventing/allowing friendly fire based on game rules).
    3. Calculates distance and applies distance attenuation (using `ILyraAbilitySourceInterface` if available).
    4. Applies physical material attenuation (using `ILyraAbilitySourceInterface` if available).
    5. Calculates the final `DamageDone`.
  * **Output:** If `DamageDone > 0`, it applies an _additive modifier_ to the **Target's** `ULyraHealthSet::Damage` attribute. This temporary value is then processed by the `ULyraHealthSet`'s `PostGameplayEffectExecute` to actually reduce the `Health` attribute.
* **`ULyraHealExecution`:**
  * **Triggered by:** Applying a Gameplay Effect containing this execution.
  * **Input:** Captures `BaseHeal` from the _Source_'s `ULyraCombatSet`.
  * **Calculation:** Calculates `HealingDone` (simple Max(0, BaseHeal) in this case).
  * **Output:** If `HealingDone > 0`, it applies an _additive modifier_ to the **Target's** `ULyraHealthSet::Healing` attribute. This is then processed by the `ULyraHealthSet`'s `PostGameplayEffectExecute` to increase the `Health` attribute.

### Gameplay Tags

Gameplay Tags are fundamental to GAS and are used extensively throughout the character system for state tracking, identification, event signaling, and flow control.

* **State Tracking:**
  * Movement: `MovementModeTagMap`, `CustomMovementModeTagMap` (e.g., `MovementMode.Walking`, `MovementMode.Falling`) applied by `ALyraCharacter`.
  * Status: `Status.Crouching`, `Status.Death.Dying`, `Status.Death.Dead` applied by `ALyraCharacter` and `ULyraHealthComponent`.
* **Input Binding:**
  * Input actions (defined in `ULyraInputConfig`) are mapped to tags (e.g., `InputTag.Move`, `InputTag.Ability.Primary`, `InputTag.Look.Mouse`). `ULyraHeroComponent` presses/releases these tags on the ASC to activate abilities.
* **Control Flow & Identification:**
  * `Gameplay.MovementStopped`: Checked by `ULyraCharacterMovementComponent` to halt movement.
  * `Gameplay.DamageImmunity`: Checked by `ULyraHealthSet` to ignore incoming damage.
  * `Gameplay.Damage.SelfDestruct`, `Gameplay.Damage.FellOutOfWorld`: Added to specific damage effects to identify their cause and potentially bypass immunities.
  * Ability Tags, Cancel Tags, Block Tags (within Ability Blueprints/C++): Control ability activation and interaction.
* **Events & Messaging:**
  * `GameplayEvent.Death`: Sent by `ULyraHealthComponent` to the ASC upon reaching zero health, potentially triggering death abilities.
  * `Lyra.Damage.Message`, `Lyra.Elimination.Message`: Used as verbs with the `UGameplayMessageSubsystem` to broadcast standardized game events triggered by health/damage logic.

Systems constantly monitor and react to the presence or absence of these tags on the character's ASC. This allows for decoupled communication and complex state management (e.g., an ability grants `Gameplay.MovementStopped`, and the Movement Component reacts independently).

### Summary

The integration of GAS provides the character system with:

* A flexible way to define character statistics (Attributes).
* A powerful system for actions and abilities (Gameplay Abilities).
* A robust framework for temporary and permanent state changes (Gameplay Effects).
* Complex, context-aware calculations (Executions).
* A dynamic state and communication mechanism (Gameplay Tags).

Understanding these core GAS elements and how they plug into the Pawn, Player State, and various Components is essential for customizing character behavior in your project.

