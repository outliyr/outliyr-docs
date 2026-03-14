# Add Input Mapping Context

This Game Feature Action is responsible for adding **Enhanced Input Mapping Contexts (`UInputMappingContext`)** to local players when the associated Game Feature or Experience activates. Input Mapping Contexts define the raw bindings between physical hardware inputs (like keyboard keys, mouse buttons, gamepad buttons) and abstract **Input Actions** (like `IA_Move`, `IA_Jump`, `IA_Fire`).

### Purpose

* **Define Raw Input Bindings:** Activate sets of key/button bindings relevant to the current gameplay context (e.g., activating vehicle control bindings when entering a vehicle feature, activating menu navigation bindings when a menu feature is active).
* **Contextual Input Layers:** Allows different Game Features to provide their own layers of input mappings that can be added or removed without interfering with base input contexts (like core movement). Enhanced Input handles prioritization between active contexts.
* **Modular Input Setup:** Decouples the definition of raw hardware bindings (`UInputMappingContext` assets) from player controllers or pawn classes, allowing features to bring their own input schemes.
* **Settings Integration:** Optionally registers the added `UInputMappingContext` assets with the Enhanced Input User Settings system, allowing players to potentially rebind the actions defined within those contexts through an options menu.

### Configuration

Add instances of this action to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet`.

<img src=".gitbook/assets/image (121).png" alt="" title="Add_InputMapping GameFeatureAction configuration">

* **`Input Mappings` (`TArray<FInputMappingContextAndPriority>`)**: An array defining which contexts to add.
  * **`FInputMappingContextAndPriority`**:
    * `Input Mapping` (`TSoftObjectPtr<UInputMappingContext>`): A soft object pointer to the `UInputMappingContext` asset to add. This asset contains the actual mappings (e.g., W key -> `IA_MoveForward`, Space Bar -> `IA_Jump`).
    * `Priority` (`int32`): Determines the priority of this context relative to others added to the Enhanced Input subsystem. Higher priority contexts are processed first, potentially consuming input before lower priority ones. Useful for overriding base inputs (e.g., making menu inputs override gameplay inputs).
    * `b Register With Settings` (`bool`): If true, attempts to register this `InputMappingContext` with the `UEnhancedInputUserSettings` subsystem. This makes the mappings within potentially available for user rebinding via a settings menu that integrates with this subsystem.

_Example Configuration (in an action for basic gameplay):_

* `Input Mappings`:
  * `[0]`:
    * `Input Mapping`: `IMC_DefaultGameplay` (Asset mapping WASD to `IA_Move`, Space to `IA_Jump`, etc.)
    * `Priority`: `0` (Base priority)
    * `b Register With Settings`: `true`

_Example Configuration (in an action for a pause menu feature):_

* `Input Mappings`:
  * `[0]`:
    * `Input Mapping`: `IMC_PauseMenuNavigation` (Asset mapping Escape to `IA_CloseMenu`, Arrow Keys to `IA_NavigateMenu`, etc.)
    * `Priority`: `10` (Higher priority to override gameplay inputs)
    * `b Register With Settings`: `false` (Usually don't allow rebinding core menu navigation)

### Runtime Execution Flow

This action also inherits from `UGameFeatureAction_WorldActionBase`.

1. **Registration (`OnGameFeatureRegistering`):**
   * When the Game Feature plugin is _registered_ (often at editor/engine startup or plugin load), this action iterates through its `InputMappings` list.
   * For each entry where `bRegisterWithSettings` is true, it attempts to register the `InputMappingContext` asset with the `UEnhancedInputUserSettings` for _all_ currently existing game instances and local players, and sets up delegates to handle future game instance/local player creation. This ensures the mappings are known to the settings system even before the feature is fully active.
2. **Activation (`OnGameFeatureActivating` -> `AddToWorld`):**
   * When the owning Game Feature/Experience activates for a specific world, the action uses the `UGameFrameworkComponentManager` to register an extension handler for the `APlayerController` class.
3. **`HandleControllerExtension` -> `AddInputMappingForPlayer`:**
   * When a `APlayerController` is added or becomes ready in the target world, `HandleControllerExtension` is triggered.
   * It calls `AddInputMappingForPlayer(PlayerController->GetLocalPlayer(), ActiveData)`.
   * `AddInputMappingForPlayer` gets the `UEnhancedInputLocalPlayerSubsystem` for the associated `ULocalPlayer`.
   * It iterates through the `InputMappings` list defined in the action asset.
   * For each entry, it loads the `UInputMappingContext` asset (if needed).
   * It calls `InputSystem->AddMappingContext(IMC, Priority)` to add the context to the player's active input stack.
   * It tracks which controllers this action has added mappings for.
4. **Deactivation (`OnGameFeatureDeactivating` -> `Reset` -> `RemoveInputMapping`):**
   * When the owning Game Feature/Experience deactivates, the `Reset` function is called.
   * `Reset` iterates through all Player Controllers this action previously added mappings to (`ControllersAddedTo` list, though the comment notes this might need review) and calls `RemoveInputMapping`.
   * `RemoveInputMapping`:
     * Gets the `UEnhancedInputLocalPlayerSubsystem` for the controller's `ULocalPlayer`.
     * Iterates through the `InputMappings` list defined in the action asset.
     * Calls `InputSystem->RemoveMappingContext(IMC)` to remove the context from the player's active input stack.
   * Clears internal tracking.
5. **Unregistration (`OnGameFeatureUnregistering`):**
   * When the Game Feature plugin is _unregistered_, this action iterates through its `InputMappings`.
   * For each entry where `bRegisterWithSettings` was true, it explicitly _unregisters_ the context from the `UEnhancedInputUserSettings` for all game instances and local players, cleaning up the settings registry.

### Use Cases

* **Base Input:** Defining the default gameplay controls (movement, jump, fire, aim) active during standard gameplay.
* **Vehicle Controls:** Activating a separate mapping context with driving/flying controls when the player enters a vehicle.
* **Menu Navigation:** Adding high-priority mappings for UI navigation when a menu or inventory screen is open, temporarily overriding gameplay controls.
* **Contextual Actions:** Enabling specific input actions only when certain features are active (e.g., adding build mode mappings only when a building feature is enabled).

### Relationship with `AddInputBinding`

* **Lower Level:** `AddInputContextMapping` operates at the Enhanced Input system level, defining the link between **Hardware Input -> Input Action**.
* **Higher Level:** `AddInputBinding` operates at the Gameplay Ability System level, defining the link between **Input Action (via Tag) -> Gameplay Ability (via Tag)**.

You typically need **both** actions working together: `AddInputContextMapping` sets up _how_ pressing a key triggers an Input Action like `IA_Jump`, and `AddInputBinding` (using an `InputConfig` that references `InputTag.Jump`) tells the system _which Gameplay Ability_ (`GA_Jump`) should be activated when the `IA_Jump` action occurs.

***

The `UGameFeatureAction_AddInputContextMapping` action allows Game Features and Experiences to dynamically layer input schemes onto the player using Unreal's Enhanced Input system. By managing `UInputMappingContext` assets and their priorities, it enables flexible and context-sensitive control over raw hardware input bindings.
