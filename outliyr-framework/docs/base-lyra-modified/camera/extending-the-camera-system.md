# Extending the Camera System

The camera system, built around the `ULyraCameraModeStack`, is designed with modularity and extensibility in mind. Whether you need to tweak the existing third-person view, create entirely new camera perspectives, or dynamically change the camera based on gameplay events, this page provides guidance on common extension points.

### Creating Custom Camera Modes

The most powerful way to customize camera behavior is by creating new classes derived from `ULyraCameraMode`. This allows you to define entirely new perspectives or camera logic.

**Steps (C++ Recommended):**

1. **Create a New Class:** Create a new C++ class inheriting from `ULyraCameraMode`. Let's call it `UMyCustomCameraMode`.
2. **Override `UpdateView`:** This is the most critical step. Implement the logic inside `UpdateView(float DeltaTime)` to calculate the desired camera `Location`, `Rotation`, `ControlRotation`, and `FieldOfView` for your custom mode. Store the results in the inherited `View` member (type `FLyraCameraModeView`).
   * You can get the target actor using `GetTargetActor()`.
   * You can use or override `GetPivotLocation()` and `GetPivotRotation()` to define the reference point for your calculations.
   * Consider player input (e.g., `GetTargetActor()->GetController()->GetControlRotation()`), target velocity, or specific gameplay states in your calculations.
   * Remember to clamp pitch using `ViewPitchMin` and `ViewPitchMax` if applicable.
3. **Set Default Properties:** In the constructor (`UMyCustomCameraMode::UMyCustomCameraMode()`), set appropriate default values for:
   * `FieldOfView`
   * `ViewPitchMin`, `ViewPitchMax`
   * `BlendTime` (How long to blend in? 0 for instant snap)
   * `BlendFunction` (e.g., `ELyraCameraModeBlendFunction::EaseInOut`)
   * `BlendExponent`
   * `CameraTypeTag` (A generic tag, e.g., `Camera.Type.FirstPerson`)
   * `CameraTagToAddToPlayer` (A specific tag, e.g., `Camera.View.FirstPerson`)
4. **Implement Activation/Deactivation (Optional):** Override `OnActivation()` and `OnDeactivation()` if your mode needs specific setup (e.g., initializing internal variables, attaching temporary components) or cleanup when it becomes active or inactive. Remember to call `Super::OnActivation()` / `Super::OnDeactivation()` if you want the base tag-adding/removing behavior.
5. **Compile:** Build your C++ code.
6. **Usage:** Your new `UMyCustomCameraMode` class can now be used like any other mode – assigned as a default, pushed onto the stack via code, or selected by the `DetermineCameraModeDelegate`.

**(Example Idea: First-Person Mode)**\
A first-person `ULyraCameraMode` might override `UpdateView` to position the camera directly at the result of `GetPivotLocation()` (which accounts for eye height) and set the `View.Rotation` directly from the pawn's `GetViewRotation()`. It might also have a shorter `BlendTime` and different `FieldOfView` compared to the third-person mode.

### Modifying Existing Modes

You don't always need to create a mode from scratch. You can modify existing ones:

1. **Blueprint Inheritance:** Create a new Blueprint class that inherits from an existing C++ camera mode (like `ULyraCameraMode_ThirdPerson`).
2. **Adjust Properties:** In the Blueprint's Class Defaults, you can easily tweak properties exposed from the C++ class:
   * Change `FieldOfView`.
   * Adjust `BlendTime`, `BlendFunction`, `BlendExponent`.
   * Assign a different `TargetOffsetCurve`.
   * Modify penetration avoidance settings (`bPreventPenetration`, `PenetrationBlendIn/OutTime`, `PenetrationAvoidanceFeelers` array, etc.).
   * Change the Gameplay Tags (`CameraTypeTag`, `CameraTagToAddToPlayer`).
3. **Override Functions (Limited):** While you can override Blueprint-accessible functions, core logic like `UpdateView` is often best kept in C++ for performance and complexity management.

This Blueprint approach is ideal for creating variations of existing modes (e.g., a third-person mode with a different offset curve or faster blending) without writing new C++ code.

### Switching Base Camera Modes Dynamically

The primary camera mode (the one typically at the bottom of the stack) is usually determined contextually based on gameplay.

1. **The Delegate:** The `ULyraCameraComponent` uses its `DetermineCameraModeDelegate` to query for the appropriate `TSubclassOf<ULyraCameraMode>`.
2. **The Provider (`ULyraHeroComponent`):** On player-controlled Pawns, the `ULyraHeroComponent` typically binds its `DetermineCameraMode` function to this delegate during initialization.
3. **Custom Logic:** Modify the `ULyraHeroComponent::DetermineCameraMode` function (or create your own component that binds to the delegate):
   * Check game state: Is the player aiming? Sprinting? In a specific vehicle? Interacting with an object?
   * Check active Gameplay Abilities: Does the player have an ability active that requires a specific camera view (e.g., an aiming ability)? Use `AbilitySystemComponent->GetTagCount` or check for specific ability spec handles.
   *   Return the appropriate `TSubclassOf<ULyraCameraMode>` based on the current context. For example:

       ```cpp
       // Inside a function bound to DetermineCameraModeDelegate
       if (IsPlayerAimingDownSights()) // Check GAS or input state
       {
           return AimingCameraModeClass; // TSubclassOf<ULyraCameraMode_Aiming>
       }
       else
       {
           // Fallback to default from PawnData or a hardcoded default
           if (const ULyraPawnData* PawnData = GetPawnData())
           {
                return PawnData->DefaultCameraMode; // TSubclassOf<ULyraCameraMode_ThirdPerson>
           }
           return DefaultThirdPersonModeClass;
       }
       ```
4. **Result:** When the context changes (player starts/stops aiming), the delegate returns a different class. The `ULyraCameraComponent` calls `PushCameraMode` with the new class, and the stack handles blending smoothly to the new perspective.

### Pushing Temporary Modes (Overrides/Layers)

Gameplay Abilities, interaction systems, or cinematic sequences often need to temporarily override the base camera mode.

1.  **Get Camera Component:** Obtain a pointer to the `ULyraCameraComponent` on the target Pawn.

    ```cpp
    // Example from within a Gameplay Ability targeting the Pawn
    ALyraCharacter* AvatarCharacter = Cast<ALyraCharacter>(GetAvatarActorFromActorInfo());
    if (AvatarCharacter)
    {
        ULyraCameraComponent* CameraComponent = ULyraCameraComponent::FindCameraComponent(AvatarCharacter);
        if (CameraComponent)
        {
            // Proceed to push mode
        }
    }
    ```
2. **Push the Mode:** Call `CameraComponent->PushCameraMode(MyTemporaryModeClass);` where `MyTemporaryModeClass` is the `TSubclassOf<>` for your temporary mode (e.g., a cinematic camera, a scope view).
3. **Blending:** The stack automatically handles blending this new mode in over the existing modes based on its `BlendTime` and `BlendFunction`.
4. **Removal:**
   * **Implicit:** If the temporary mode has a `BlendTime` > 0 and eventually reaches a `BlendWeight` of 1.0, the stack will automatically remove all modes below it.
   * **Explicit:** To explicitly remove the temporary mode and return to the previous state, you typically need to push the _desired underlying mode_ back onto the stack. For example, when a cinematic ability ends, it would get the Pawn's _current_ default mode (perhaps by querying the `DetermineCameraModeDelegate` itself or storing what it was before the cinematic) and push that mode back onto the stack. The temporary cinematic mode will then eventually be blended out or removed by the stack logic. _Note: The base system doesn't have an explicit `PopCameraMode` function._

### Implementing `ILyraCameraAssistInterface`

To fine-tune how the third-person camera interacts with specific actors, especially regarding penetration:

1. **Choose Actor:** Decide which actor should provide hints (e.g., the player character Blueprint, a vehicle Blueprint).
2. **Implement Interface:** Add `ILyraCameraAssistInterface` to the class (C++ inheritance or Blueprint Class Settings -> Interfaces).
3. **Implement Functions:**
   * **`GetIgnoredActorsForCameraPentration`:** Add actors (like self, maybe a parent vehicle) to the output array that the camera sweeps should ignore.
   * **`GetCameraPreventPenetrationTarget`:** If the penetration checks should focus on a different actor than `Self` (e.g., a mount the character is riding), return that actor here. Otherwise, return an empty `TOptional`.
   * **`OnCameraPenetratingTarget`:** Implement the desired reaction (e.g., hide mesh components, start a fade material effect) when the camera notifies this actor that it's very close due to collisions.

### Advanced Customization

While less common, further customization is possible:

* **Custom `APlayerCameraManager`:** Inherit from `ALyraPlayerCameraManager` to add custom logic for view target selection, post-processing, or camera shakes beyond what the mode stack provides.
* **Custom `ULyraUICameraManagerComponent`:** Enhance the UI component to actively control the camera during `UpdateViewTarget` if complex UI-driven camera behaviors are needed.
* **New Blend Functions:** Adding new `ELyraCameraModeBlendFunction` options typically requires modifying engine source code or implementing a custom blending mechanism outside the existing enum/switch statements within the stack.

By leveraging these extension points, you can tailor the camera system extensively to fit the specific needs and feel of your shooter game.

