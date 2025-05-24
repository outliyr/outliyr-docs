# Lyra's Bridge

After the Enhanced Input system has processed a hardware input and triggered an abstract `Input Action` (IA), Lyra needs a way to connect this generic IA to its more specific, `GameplayTag`-driven systems. This is where the **`ULyraInputConfig`** Data Asset plays a pivotal role. It acts as a crucial bridge, translating editor-defined `Input Actions` into `GameplayTags` that the rest of Lyra's framework, particularly the Gameplay Ability System (GAS) and native input handlers, can understand and act upon.

**Purpose of `ULyraInputConfig`**

The primary purpose of a `ULyraInputConfig` is to map `UInputAction` assets to specific `FGameplayTag`s. This decoupling is powerful:

* **Abstraction:** `Input Actions` remain generic (e.g., `IA_PrimaryAction`, `IA_SecondaryAction`). The `ULyraInputConfig` then gives these generic actions context within Lyra (e.g., `IA_PrimaryAction` becomes `InputTag.Ability.Fire`, `IA_SecondaryAction` becomes `InputTag.Ability.Aim`).
* **Flexibility:** Different `ULyraInputConfig` assets can map the same `Input Action` to different `GameplayTags`. This allows, for instance, a "Primary Action" input to trigger a "Fire Weapon" ability in one context (defined by one `InputConfig`) and a "Melee Attack" ability in another context (defined by a different `InputConfig`).
* **Centralized Mapping:** Provides a clear, data-driven location to see how `Input Actions` are being interpreted by Lyra's systems.

**Key Properties of `ULyraInputConfig`**

A `ULyraInputConfig` Data Asset contains two main lists of mappings:

1. **`NativeInputActions` (TArray<`FLyraInputAction`>)**
   * **Purpose:** This list maps `Input Actions` to `GameplayTags` that are intended to be bound directly to native C++ functions. These are typically for core character actions that are not implemented as Gameplay Abilities, or for actions that need very direct, low-latency control.
   * **`FLyraInputAction` Struct:**
     * `InputAction` (TObjectPtr\<const `UInputAction`>): A reference to the `Input Action` asset (e.g., `IA_Move`, `IA_Look_Mouse`).
     * `InputTag` (`FGameplayTag`): The `GameplayTag` this `Input Action` will be associated with for native binding (e.g., `InputTag.Move`, `InputTag.Look.Mouse`, `InputTag.Crouch`).
   * **Usage:** The `ULyraInputComponent` will use these mappings to find the correct `Input Action` when `BindNativeAction()` is called with a specific `InputTag`. This allows components like `ULyraHeroComponent` to bind, for example, the `InputTag.Move` to its `Input_Move()` C++ function.
2. **`AbilityInputActions` (TArray<`FLyraInputAction`>)**
   * **Purpose:** This list maps `Input Actions` to `GameplayTags` that are intended to trigger Gameplay Abilities. This is the primary way player input initiates GAS actions in Lyra.
   * **`FLyraInputAction` Struct:**
     * `InputAction` (TObjectPtr\<const `UInputAction`>): A reference to the `Input Action` asset (e.g., `IA_Jump`, `IA_PrimaryFire`, `IA_Ability_1`).
     * `InputTag` (`FGameplayTag`): The `GameplayTag` this `Input Action` will be associated with for ability activation (e.g., `InputTag.Ability.Jump`, `InputTag.Ability.Primary`, `InputTag.Ability.Slot1`).
   * **Usage:**
     * The `ULyraInputComponent` uses these mappings when `BindAbilityActions()` is called. It binds the specified `Input Action` (found via the tag) to handler functions (usually in `ULyraHeroComponent`).
     * These handler functions then pass this `InputTag` to the `ULyraAbilitySystemComponent`.
     * The `ULyraAbilitySystemComponent` uses this `InputTag` to find and activate abilities that have been granted with a matching `InputTag` in their `FGameplayAbilitySpec` (often configured via a `ULyraAbilitySet`).

**How `ULyraInputConfig` Assets are Used**

`ULyraInputConfig` assets are typically referenced and activated in a couple of main ways:

* **`ULyraPawnData`:** Each `ULyraPawnData` asset (which defines a pawn archetype) has an `InputConfig` property where you can assign a default `ULyraInputConfig`. When a pawn is initialized with this `PawnData`, the `ULyraHeroComponent` will use this `InputConfig` to set up its bindings.
* **Game Feature Actions:** The `UGameFeatureAction_AddInputBinding` allows Game Feature Plugins to dynamically add or potentially layer `ULyraInputConfig` assets when the feature is active. This is useful for features that introduce new abilities or significantly alter input behavior (e.g., vehicle controls).

**Example Scenario:**

1. **Enhanced Input Layer:**
   * `IMC_Default_KBM` maps `Space Bar` key -> `IA_Jump_Default`.
   * `IA_Jump_Default` is an `Input Action` asset.
2. **Lyra's Bridge (`ULyraInputConfig_StandardCharacter`):**
   * In its `AbilityInputActions` list:
     * Maps `IA_Jump_Default` -> `InputTag.Ability.Jump`.
3. **Binding & Activation (Next Steps):**
   * The `ULyraHeroComponent` (using `ULyraInputComponent`) will bind `IA_Jump_Default` (found via `InputTag.Ability.Jump` from the active `InputConfig`) to its `Input_AbilityInputTagPressed/Released` methods.
   * When the player presses `Space Bar`, `IA_Jump_Default` triggers.
   * The binding fires, and `ULyraHeroComponent` calls `ASC->AbilityInputTagPressed(InputTag.Ability.Jump)`.
   * The ASC then looks for a granted ability whose `DynamicAbilityTags` include `InputTag.Ability.Jump` and attempts to activate it.

***

### Summary

The `ULyraInputConfig` is a vital Data Asset in Lyra's input pipeline. It translates abstract `Input Actions` (from the Enhanced Input system) into meaningful `GameplayTags`. These tags then serve as the common language for the `ULyraInputComponent` to know which `Input Actions` to bind and for the `ULyraAbilitySystemComponent` to identify which abilities to activate in response to player input.

#### **Next Step in the Journey:**

Now that an `Input Action` has been conceptually linked to a `GameplayTag` by the `ULyraInputConfig`, the next stage involves the actual binding of this input to game logic and the subsequent dispatch of commands to the relevant systems.

***
