# Binding & Dispatch

With an `Input Action` triggered by the Enhanced Input system and translated into a `GameplayTag` by an active `ULyraInputConfig`, the next crucial stage is to **bind** this tagged input to executable game logic and **dispatch** commands to the appropriate systems. This responsibility primarily falls to two key components working in tandem: the `ULyraInputComponent` and the `ULyraHeroComponent`, both typically found on a player-controlled Pawn.

**`ULyraInputComponent`**

* **Role:** This component, inheriting from `UEnhancedInputComponent`, is the direct interface with Unreal Engine's Enhanced Input binding mechanism. Its core job is to take `Input Actions` (identified by `GameplayTags` via a `ULyraInputConfig`) and bind their triggered events (Pressed, Released, Held, etc.) to C++ delegate functions.
* **Key Functions for Binding:**
  * **`BindNativeAction(const ULyraInputConfig* InputConfig, const FGameplayTag& InputTag, ETriggerEvent TriggerEvent, UserClass* Object, FuncType Func, bool bLogIfNotFound)`:**
    * This template function is used for binding inputs that will call direct C++ functions (i.e., those mapped in the `NativeInputActions` list of the `ULyraInputConfig`).
    * It looks up the `UInputAction` asset within the provided `InputConfig` that corresponds to the given `InputTag`.
    * If found, it uses the standard `BindAction()` from `UEnhancedInputComponent` to link the `InputAction`'s specified `TriggerEvent` (e.g., `ETriggerEvent::Triggered`) to the provided C++ member function (`Func`) on the given `Object`.
  * **`BindAbilityActions(const ULyraInputConfig* InputConfig, UserClass* Object, PressedFuncType PressedFunc, ReleasedFuncType ReleasedFunc, TArray<uint32>& BindHandles)`:**
    * This template function is specifically designed for inputs intended to trigger Gameplay Abilities (i.e., those mapped in the `AbilityInputActions` list of the `ULyraInputConfig`).
    * It iterates through all `FLyraInputAction` entries in the `InputConfig->AbilityInputActions`.
    * For each entry, if a valid `InputAction` and `InputTag` exist:
      * It binds the `InputAction`'s `ETriggerEvent::Triggered` event to the `PressedFunc` delegate, passing the `InputTag` as a parameter to that function.
      * It binds the `InputAction`'s `ETriggerEvent::Completed` (typically meaning released or the action otherwise finished) event to the `ReleasedFunc` delegate, also passing the `InputTag`.
    * The `BindHandles` array is populated with unique identifiers for these bindings, allowing them to be removed later if needed (e.g., when an `InputConfig` added by a Game Feature is deactivated).
* **Other Responsibilities:**
  * `AddInputMappings()` / `RemoveInputMappings()`: While present, the actual logic for adding/removing `InputMappingContexts` to the `UEnhancedInputLocalPlayerSubsystem` is often orchestrated by the `ULyraHeroComponent` during its initialization. These functions in `ULyraInputComponent` might be more for future extensibility or specific edge cases related to the component itself manipulating IMCs.
  * `RemoveBinds()`: Used to clear bindings associated with a given set of handles.

**`ULyraHeroComponent`**

* **Role:** This component, found on player-controlled Pawns (or Pawns simulating players), is responsible for the overall setup and management of player input and camera controls. It acts as the orchestrator for input binding.
* **Input Initialization (`InitializePlayerInput(UInputComponent* PlayerInputComponent)`):**
  * This is a critical function, usually called when the Pawn's initialization state progresses sufficiently (e.g., when the controller, player state, and pawn extension component are ready).
  * **Get Subsystems:** It retrieves the `UEnhancedInputLocalPlayerSubsystem` for the controlling local player.
  * **Add Input Mapping Contexts (IMCs):**
    * It reads the `InputConfig` from the Pawn's `ULyraPawnData` (obtained via the `ULyraPawnExtensionComponent`).
    * It adds the `InputMappingContexts` specified in `ULyraPawnData->InputMappings` to the `UEnhancedInputLocalPlayerSubsystem`.
    * It also adds any `InputMappingContexts` defined in its own `DefaultInputMappings` array.
  * **Perform Bindings:** Crucially, it then uses the Pawn's `ULyraInputComponent` (which `PlayerInputComponent` is cast to):
    * It calls `LyraIC->BindAbilityActions(PawnDataInputConfig, this, &ThisClass::Input_AbilityInputTagPressed, &ThisClass::Input_AbilityInputTagReleased, ...)`:
      * This tells the `ULyraInputComponent` to iterate through the `AbilityInputActions` in the `PawnDataInputConfig`.
      * For each, it binds the corresponding `UInputAction` to `ULyraHeroComponent::Input_AbilityInputTagPressed` (for `Triggered` event) and `ULyraHeroComponent::Input_AbilityInputTagReleased` (for `Completed` event).
    * It calls `LyraIC->BindNativeAction(...)` for various core inputs (Move, Look, Crouch, AutoRun, Confirm/Cancel for ASC), binding them to specific C++ member functions within the `ULyraHeroComponent` itself or directly on the `AbilitySystemComponent`.
* **Input Dispatch Functions:**
  * **`Input_AbilityInputTagPressed(FGameplayTag InputTag)`:**
    * This function is the delegate target for "pressed" ability inputs bound by `ULyraInputComponent::BindAbilityActions`.
    * Its primary job is to take the `InputTag` it receives (which originated from the `ULyraInputConfig`) and pass it to the Pawn's `ULyraAbilitySystemComponent` by calling `LyraASC->AbilityInputTagPressed(InputTag)`.
  * **`Input_AbilityInputTagReleased(FGameplayTag InputTag)`:**
    * Similarly, this is the delegate target for "released" ability inputs.
    * It calls `LyraASC->AbilityInputTagReleased(InputTag)`.
  * **Native Input Handlers (e.g., `Input_Move`, `Input_LookMouse`, `Input_Crouch`):**
    * These are the direct C++ functions bound by `ULyraInputComponent::BindNativeAction`.
    * They contain the logic to directly manipulate the Pawn (e.g., `Pawn->AddMovementInput()`, `Pawn->AddControllerYawInput()`, `Character->ToggleCrouch()`).
* **Dynamic Input Configuration:**
  * `AddAdditionalInputConfig(const ULyraInputConfig* InputConfig)`: Allows external systems (like `GameFeatureAction_AddInputBinding`) to request that new `InputConfigs` be bound. It uses the Pawn's `ULyraInputComponent` to `BindAbilityActions` from this new config.
  * `RemoveAdditionalInputConfig(TArray<uint32>& BindHandles)`: Removes bindings previously added by `AddAdditionalInputConfig`.

**The Flow of Control (Binding Example for an Ability):**

1. `ULyraHeroComponent::InitializePlayerInput()` is called.
2. It gets the `ULyraInputConfig` (e.g., `InputConfig_Player`) from `PawnData`.
3. It calls `MyLyraInputComponent->BindAbilityActions(InputConfig_Player, this, &ULyraHeroComponent::Input_AbilityInputTagPressed, ...)`
4. `ULyraInputComponent` iterates `InputConfig_Player->AbilityInputActions`. Let's say it finds an entry: `IA_Fire` -> `InputTag.Ability.PrimaryFire`.
5. `ULyraInputComponent` effectively does: `EnhancedInputComponent->BindAction(IA_Fire, ETriggerEvent::Triggered, MyHeroComponent, &ULyraHeroComponent::Input_AbilityInputTagPressed, InputTag.Ability.PrimaryFire)`.
6. **Later, when the player triggers `IA_Fire` (e.g., by pressing Left Mouse Button, as defined in an active IMC):**
7. The Enhanced Input binding fires, calling `MyHeroComponent->Input_AbilityInputTagPressed(InputTag.Ability.PrimaryFire)`.
8. `Input_AbilityInputTagPressed` then calls `MyAbilitySystemComponent->AbilityInputTagPressed(InputTag.Ability.PrimaryFire)`.

***

### Summary

The `ULyraInputComponent` handles the low-level work of binding `Input Actions` to C++ delegates using the Enhanced Input system, guided by a `ULyraInputConfig`. The `ULyraHeroComponent` orchestrates this process, ensuring the correct IMCs are active and that `Input Actions` are bound to its own handler functions. These handlers then dispatch the interpreted input (as a `GameplayTag`) to the `AbilitySystemComponent` for ability activation, or execute native C++ logic directly for non-ability inputs.

#### **Next Step in the Journey:**

The input, now represented as a `GameplayTag`, has reached the doorstep of the Gameplay Ability System. The final stage is how the `ULyraAbilitySystemComponent` and `ULyraGameplayAbility` classes consume this tag to activate abilities.

***
