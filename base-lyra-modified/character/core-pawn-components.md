# Core Pawn Components

The `ALyraCharacter` and `ALyraPawn` classes serve as containers, but much of their specific functionality comes from dedicated Actor Components. This modular approach promotes flexibility and composition over complex inheritance. Here are the key components driving the character system:

### `ULyraPawnExtensionComponent` (The Coordinator)

This is arguably the most critical component for integrating various systems onto a Pawn within the Lyra framework. Think of it as the central nervous system coordinator for the Pawn.

* **Purpose:** To manage essential Pawn data, coordinate the initialization of other components (especially the Ability System Component), and handle crucial state changes related to controllers and player states.
* **Location:** Intended to be added to _any_ Pawn that needs to interact deeply with Lyra systems (`ALyraCharacter`, `ALyraPawn` derivatives).

**Key Responsibilities & Features:**

1. **Ability System Initialization:**
   * Its primary role is to find the correct `ULyraAbilitySystemComponent` (ASC) for the Pawn and initialize it.
   * For player-controlled Pawns, it typically gets the ASC from the `ALyraPlayerState`. For self-contained Pawns like `ALyraCharacterWithAbilities`, it recognizes the ASC might be owned elsewhere (or directly on the Pawn).
   * **`InitializeAbilitySystem(ULyraAbilitySystemComponent* InASC, AActor* InOwnerActor)`:** Called by the Pawn (usually during possession or state changes) to establish the link between the Pawn (as the Avatar) and the ASC. It handles potential conflicts if another Pawn was previously the avatar.
   * **`UninitializeAbilitySystem()`:** Cleans up the ASC link, cancelling abilities (respecting `Ability_Behavior_SurvivesDeath` tag), clearing input, and removing cues when the Pawn is no longer the avatar (e.g., on death or unpossession).
   * **`GetLyraAbilitySystemComponent()`:** The central function for other components or the Pawn itself to reliably access the _correct_ ASC instance associated with this Pawn.
   * Provides delegates (`OnAbilitySystemInitialized`, `OnAbilitySystemUninitialized`) for other components to hook into these critical moments.
2. **Pawn Data Management:**
   * Holds a reference to the `ULyraPawnData` asset (`PawnData`). This asset defines crucial configuration like ability sets, input configs, camera modes, etc.
   * **`SetPawnData(const ULyraPawnData* InPawnData)`:** Used (usually by the spawning system) to assign the specific `ULyraPawnData` for this instance. This is replicated.
   * **`GetPawnData<T>()`:** Templated accessor to retrieve the PawnData, cast to a specific type if needed.
3. **State Change Handling:**
   * **`HandleControllerChanged()`:** Called by the Pawn when its Controller changes. It refreshes the ASC's Actor Info if needed.
   * **`HandlePlayerStateReplicated()`:** Called by the Pawn when its Player State becomes available, crucial for finding the ASC on clients.
4. **Initialization Coordination (`InitState` System):**
   * Implements `IGameFrameworkInitStateInterface` and acts as a central feature (`NAME_ActorFeatureName`) in Lyra's initialization system.
   * It waits for dependencies (like PawnData, Controller, PlayerState) before progressing its own init state.
   * Other components (like `ULyraHeroComponent`) often depend on the `PawnExtensionComponent` reaching specific initialization states (`InitState_DataInitialized`) before they can fully initialize themselves.
   * **`CheckDefaultInitialization()`:** Drives the progression through initialization states.

* **Why it Matters:** The `PawnExtensionComponent` decouples the Pawn from directly needing to know _where_ its ASC lives (Player State vs. self). It standardizes the process of initialization and provides a reliable way to access core systems, making the overall architecture much cleaner and more robust, especially in networked scenarios.

### `ULyraHeroComponent` (Player Input & Camera)

This component is specifically designed for Pawns that are _controlled_ by a player (or an AI simulating a player), handling input processing and camera management.

* **Purpose:** To set up Enhanced Input bindings based on `ULyraInputConfig`, translate player inputs into Gameplay Ability System actions, handle basic movement/look inputs, and determine the appropriate camera view.
* **Location:** Added to Pawns intended for direct player control (typically `ALyraCharacter` derivatives).

**Key Responsibilities & Features:**

1. **Enhanced Input Setup:**
   * Reads `InputMappingContext` definitions from the `ULyraPawnData` assigned via the `PawnExtensionComponent`.
   * Uses the `UEnhancedInputLocalPlayerSubsystem` to add these mappings contexts for the controlling player.
   * Can add additional Input Configs dynamically (`AddAdditionalInputConfig`, `RemoveAdditionalInputConfig`).
2. **Input Action Binding:**
   * Works with `ULyraInputComponent` (required on the Pawn) to bind Input Actions defined in the `ULyraInputConfig` to specific Gameplay Tags.
   * **`Input_AbilityInputTagPressed/Released(FGameplayTag InputTag)`:** These functions are bound to input actions. When triggered, they call the corresponding `AbilityInputTagPressed/Released` function on the Pawn's `ULyraAbilitySystemComponent`, activating or deactivating abilities mapped to that tag.
   * **`BindNativeAction(...)`:** Also binds specific Input Actions to native C++ functions for core actions like movement (`Input_Move`), looking (`Input_LookMouse`, `Input_LookStick`), crouching (`Input_Crouch`), and auto-run (`Input_AutoRun`).
3. **Camera Management:**
   * Works with the `ULyraCameraComponent` (expected to be on the same Pawn).
   * **`DetermineCameraMode()`:** This delegate is bound to the `ULyraCameraComponent`. It decides which `ULyraCameraMode` class should be active based on the current game state.
   * It prioritizes camera modes set by active Gameplay Abilities (`AbilityCameraMode`). If no ability override is active, it falls back to the `DefaultCameraMode` specified in the `ULyraPawnData`.
   * **`SetAbilityCameraMode/ClearAbilityCameraMode(...)`:** Allows Gameplay Abilities to temporarily override the default camera mode.
4. **Initialization (`InitState` System):**
   * Also implements `IGameFrameworkInitStateInterface`.
   * Waits for dependencies like the Player State, Controller, Local Player, Input Component, and critically, for the `ULyraPawnExtensionComponent` to reach `InitState_DataInitialized` before it attempts to bind inputs.
   * **`IsReadyToBindInputs()`:** Indicates if the component has successfully initialized and bound the player's input.

* **Why it Matters:** The `HeroComponent` centralizes player input handling, cleanly separating it from the Pawn's core logic. Its tight integration with Enhanced Input and GAS makes setting up complex ability activation via player input straightforward and data-driven. Managing camera modes here allows abilities to easily influence the player's view.

> [!success]
> The [input section](../input/) goes into more detail in how input works in Lyra, and the roles that LyraHeroComponent plays in setting up the input.

### `ULyraHealthComponent` (Health & Death)

This component is responsible for managing the health and death state of its owning actor.

* **Purpose:** To interact with the Gameplay Ability System's health attributes, track whether the owner is alive or dead, and broadcast events related to health changes and death transitions.
* **Location:** Added to any actor that needs health and can die (typically `ALyraCharacter`, but could be placed on other actors like destructible objects if they use GAS).

**Key Responsibilities & Features:**

1. **GAS Attribute Interaction:**
   * **`InitializeWithAbilitySystem(ULyraAbilitySystemComponent* InASC)`:** Must be called to link this component to the relevant ASC. It finds the `ULyraHealthSet` on the ASC and registers listeners for attribute changes.
   * **`UninitializeFromAbilitySystem()`:** Cleans up listeners when the link is broken.
   * Listens for changes to `Health`, `MaxHealth` attributes within the `ULyraHealthSet`.
   * Listens for the `OnOutOfHealth` event broadcast by the `ULyraHealthSet` when health reaches zero.
2. **Health Accessors:**
   * Provides simple functions to get the current state: `GetHealth()`, `GetMaxHealth()`, `GetHealthNormalized()`.
3. **Death State Management:**
   * Tracks the current state using the `ELyraDeathState` enum (`NotDead`, `DeathStarted`, `DeathFinished`). This state is replicated (`OnRep_DeathState`).
   * **`StartDeath()`:** Called (typically in response to the `OnOutOfHealth` event) to begin the death sequence. Sets state to `DeathStarted`, applies the `Status_Death_Dying` tag via the ASC, and broadcasts `OnDeathStarted`.
   * **`FinishDeath()`:** Called to finalize the death sequence. Sets state to `DeathFinished`, applies the `Status_Death_Dead` tag, and broadcasts `OnDeathFinished`. The Pawn's `OnDeathFinished` handler usually triggers final cleanup/destruction.
   * **`IsDeadOrDying()`:** Helper function to check the current death state.
4. **Event Broadcasting:**
   * `OnHealthChanged`, `OnMaxHealthChanged`: Delegates fired when the respective attributes change (includes instigator info where available).
   * `OnDeathStarted`, `OnDeathFinished`: Delegates fired when the death state transitions occur. These are used by `ALyraCharacter` to trigger Blueprint events (`K2_OnDeathStarted/Finished`) and disable collision/movement.
5. **Damage Handling:**
   * `HandleOutOfHealth(...)` (called by `ULyraHealthSet` delegate): When health reaches zero, this function (on the server) triggers the `GameplayEvent_Death` tag event on the owner's ASC (potentially activating a death ability) and broadcasts gameplay messages (like `TAG_Lyra_Elimination_Message`).
   * `DamageSelfDestruct(...)`: Applies maximum damage to the owner via a specific Gameplay Effect, typically used for falling out of the world or explicit suicide actions.

* **Why it Matters:** The `HealthComponent` provides a clear separation of concerns for health and death logic. It acts as the bridge between the raw attribute data in GAS and the higher-level concept of "dying" within the game logic, providing essential events for characters and other systems to react to.

### `ULyraCharacterMovementComponent` (Movement Logic)

This component extends Unreal Engine's standard `UCharacterMovementComponent` with optimizations and hooks relevant to Lyra and GAS.

* **Purpose:** To handle the physics and logic of character movement, incorporating Lyra-specific features like replicated acceleration and interaction with GAS tags.
* **Location:** Used as the default Movement Component for `ALyraCharacter`.

**Key Responsibilities & Features:**

1. **Standard Character Movement:** Provides all the functionality of `UCharacterMovementComponent` (walking, falling, swimming, flying, crouching, etc.).
2. **Replicated Acceleration:**
   * **`SetReplicatedAcceleration(const FVector& InAcceleration)`:** Used by `ALyraCharacter`'s `OnRep_ReplicatedAcceleration` to apply the decompressed acceleration value received from the server.
   * Overrides `SimulateMovement` to ensure this replicated acceleration is correctly used by simulated proxies, leading to smoother visuals.
3. **Ground Information:**
   * **`GetGroundInfo()`:** Provides cached information about the ground beneath the character (hit result, distance), performing a trace if the cached data is outdated. Useful for abilities or effects that depend on ground state.
4. **GAS Tag Interaction:**
   * Overrides `GetDeltaRotation` and `GetMaxSpeed` to check if the owner's ASC has the `TAG_Gameplay_MovementStopped` tag. If present, it returns zero rotation/speed, effectively allowing abilities to halt movement via a tag.
5. **Lyra Defaults:** Configures default movement parameters (MaxAcceleration, Friction, etc.) suitable for Lyra's feel in its constructor.

* **Why it Matters:** While much of the core movement comes from the base UE component, `ULyraCharacterMovementComponent` provides essential integration points with Lyra's networking optimizations (replicated acceleration) and its gameplay systems (reacting to GAS tags), making movement feel consistent and allowing abilities to directly influence movement capabilities.

***

This breakdown covers the main responsibilities of the core components. Understanding how they collaborate, especially with `ULyraPawnExtensionComponent` acting as the coordinator and the ASC as the central hub for abilities and state, is key to effectively using and extending the character system. Next, we can delve into the **Gameplay Ability System (GAS) Integration**.
