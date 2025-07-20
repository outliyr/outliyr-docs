# Pawn Architecture

This page details the fundamental Pawn and Character classes provided in the asset. Understanding these base classes is essential for creating your own characters, AI, or other controllable entities. The system leverages Unreal Engine's standard Pawn/Character hierarchy but builds upon Lyra's modular approach.

### Modular Base Classes (`AModularCharacter` / `AModularPawn`)

Lyra, and therefore this asset, uses `AModularCharacter` and `AModularPawn` as base classes instead of the standard `ACharacter` and `APawn`.

* **Purpose:** These classes integrate seamlessly with Unreal Engine's Game Features and Modular Gameplay plugins. This allows components (like `ULyraHeroComponent`, custom ability sets, etc.) to be added to Pawns dynamically via Game Feature plugins, rather than requiring them to be explicitly added in the base C++ class or every derived Blueprint.
* **Functionality:** They function almost identically to their non-modular counterparts (`ACharacter`, `APawn`) but include the necessary hooks for the `UGameFrameworkComponentManager` to manage components added through plugins.

For most practical purposes when deriving from these classes, you can treat them like standard Characters and Pawns, but benefit from the enhanced modularity they enable.

### `ALyraCharacter`

This is the primary base class intended for most humanoid characters, whether player-controlled or AI-driven.

* **Inheritance:** `AActor` -> `APawn` -> `ACharacter` -> `AModularCharacter` -> `ALyraCharacter`
* **Purpose:** Provides a fully-featured character base with integrated movement, GAS support (via delegation), health management, and essential shooter features.

**Key Features & Responsibilities:**

1. **Standard Character Movement:** Includes and configures the `ULyraCharacterMovementComponent` (derived from `UCharacterMovementComponent`) for networked humanoid movement (walking, crouching, jumping, falling, etc.).
2. **Core Component Integration:** Designed to work with the essential Lyra components, although these are often added in derived Blueprints or via Game Features:
   * `ULyraPawnExtensionComponent`: Expected to be present to manage GAS initialization, PawnData, and coordinate other components.
   * `ULyraHealthComponent`: Expected for managing health and death states.
   * `ULyraCameraComponent`: For handling camera logic, often driven by `ULyraHeroComponent`.
3. **Interface Implementation:** Implements several key interfaces:
   * `IAbilitySystemInterface`: Delegates `GetAbilitySystemComponent()` to the `ULyraPawnExtensionComponent`, ensuring the character uses the correct ASC (usually from the Player State for players).
   * `IGameplayTagAssetInterface`: Delegates tag checks (`HasMatchingGameplayTag`, etc.) to the associated ASC.
   * `IGameplayCueInterface`: Allows the character to respond to Gameplay Cues invoked via GAS.
   * `ILyraTeamAgentInterface`: Allows the character's team to be identified and synchronized, usually reflecting the Controller's team.
4. **Lifecycle Management:** Overrides standard Actor/Pawn functions (`BeginPlay`, `EndPlay`, `PossessedBy`, `UnPossessed`, `NotifyControllerChanged`) to correctly initialize, uninitialize, and update components, particularly the `ULyraPawnExtensionComponent`.
5. **Replication:**
   * Handles standard character replication.
   * Includes optimized replication for acceleration (`FLyraReplicatedAcceleration`) for smoother simulated proxy movement visuals.
   * Supports fast-path movement updates (`FSharedRepMovement`) for reduced network overhead when properties aren't changing rapidly.
6. **Gameplay Logic & Hooks:**
   * Provides basic interaction hooks like `ToggleCrouch`.
   * Overrides `CanJumpInternal_Implementation` (used by `UCharacterMovementComponent`) to potentially allow custom jump conditions.
   * Manages Gameplay Tags related to movement states (`SetMovementModeTag`, applies `Status_Crouching` tag).
7. **Death Handling:**
   * Listens for death events (`OnDeathStarted`, `OnDeathFinished`) broadcast by the `ULyraHealthComponent`.
   * Calls Blueprint-implementable events (`K2_OnDeathStarted`, `K2_OnDeathFinished`) for custom death visuals or logic.
   * Handles the technical aspects of death like disabling collision/movement (`DisableMovementAndCollision`) and initiating destruction (`UninitAndDestroy`, which also ensures ASC cleanup).

**Example: Getting the Lyra Ability System Component**

<!-- tabs:start -->
#### **Blueprint**
<img src=".gitbook/assets/image (77).png" alt="" width="361" title="Getting the Lyra ASC in a Lyra Character">




#### **C++**
```cpp
// In ALyraCharacter.h
virtual UAbilitySystemComponent* GetAbilitySystemComponent() const override;

// In ALyraCharacter.cpp
UAbilitySystemComponent* ALyraCharacter::GetAbilitySystemComponent() const
{
	// Delegates to the Pawn Extension Component, which typically gets
	// the ASC from the Player State for controlled Pawns.
	if (PawnExtComponent == nullptr)
	{
		return nullptr;
	}
	return PawnExtComponent->GetLyraAbilitySystemComponent();
}
```



<!-- tabs:end -->

* **Use `ALyraCharacter` when:** You need a character with humanoid movement, collision, skeletal mesh, and tight integration with GAS, health, input, and camera systems as provided by the core Lyra components. This is the default choice for player characters and humanoid AI.

### `ALyraPawn`

A simpler base class for non-character Pawns.

* **Inheritance:** `AActor` -> `APawn` -> `AModularPawn` -> `ALyraPawn`
* **Purpose:** Provides a minimal networked Pawn base suitable for entities that don't require built-in character movement or the full suite of components expected by `ALyraCharacter`.

**Key Features & Responsibilities:**

1. **No Character Movement:** Does _not_ include a `UCharacterMovementComponent` or Capsule Collision/Mesh components by default. Movement and collision must be added via custom components.
2. **Basic Pawn Lifecycle:** Handles essential possession logic (`PossessedBy`, `UnPossessed`).
3. **Team Interface:** Implements `ILyraTeamAgentInterface` for team management, similar to `ALyraCharacter`.
4. **Component-Driven:** Relies heavily on components added in derived Blueprints or via Game Features to provide its actual functionality (e.g., custom movement logic, an ASC if needed directly, weapon systems for a turret).

* **Use `ALyraPawn` when:**
  * You are creating vehicles.
  * You are creating stationary or simple-moving objects like turrets.
  * You need a controllable entity that doesn't fit the humanoid character mold.
  * You want a lighter base and will add specific movement/interaction components yourself.

### `ALyraCharacterWithAbilities`

A specialized version of `ALyraCharacter` that directly includes and manages its own GAS components.

* **Inheritance:** `AActor` -> `APawn` -> `ACharacter` -> `AModularCharacter` -> `ALyraCharacter` -> `ALyraCharacterWithAbilities`
* **Purpose:** Represents a character that is self-contained regarding its abilities and attributes, not relying on an external Player State to host them.

**Key Features & Responsibilities:**

1. **Owns ASC & Attributes:** Creates its own `ULyraAbilitySystemComponent`, `ULyraHealthSet`, and `ULyraCombatSet` as direct subobjects in its constructor.
2. **Direct ASC Access:** Overrides `GetAbilitySystemComponent()` to return its _own_, internally held ASC instance.
3. **Self-Initialization:** Initializes its Ability Actor Info in `PostInitializeComponents`, setting itself as both the Owner and Avatar actor for its ASC.
4. **Replication:** The ASC and its attributes replicate as part of this character actor directly.

* **Use `ALyraCharacterWithAbilities` when:**
  * Creating AI characters that don't have or need a `APlayerState`.
  * Creating networked gameplay objects (that behave like characters) which need their own abilities/attributes independent of any player's state (e.g., a destructible objective that can have status effects applied).
  * You need a character whose abilities and state are entirely encapsulated within that single actor.

### Choosing the Right Base Class

| Feature Needed                 |        `ALyraCharacter`        |           `ALyraPawn`           | `ALyraCharacterWithAbilities` | Notes                                                               |
| ------------------------------ | :----------------------------: | :-----------------------------: | :---------------------------: | ------------------------------------------------------------------- |
| Humanoid Movement              |                ✅               |                ❌                |               ✅               | Provided by `UCharacterMovementComponent`.                          |
| Standard Capsule/Mesh Setup    |                ✅               |                ❌                |               ✅               | Standard `ACharacter` setup.                                        |
| Relies on Player State for ASC |                ✅               |                NA               |               ❌               | `ALyraCharacter` delegates ASC lookup via `PawnExtensionComponent`. |
| Owns ASC Directly              |                ❌               |                NA               |               ✅               | ASC is a subobject of the character itself.                         |
| Basic Pawn Lifecycle           |                ✅               |                ✅                |               ✅               | All inherit basic Pawn functionality.                               |
| Team Interface                 |                ✅               |                ✅                |               ✅               | All implement `ILyraTeamAgentInterface`.                            |
| **Best For**                   | Player Characters, Humanoid AI | Vehicles, Turrets, Custom Pawns |   Self-Contained AI/Objects   | Choose based on movement and ASC ownership requirements.            |

