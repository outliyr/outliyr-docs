# How-To: Add a New Native Input Binding (Non-Ability)

Not all player inputs need to trigger a full Gameplay Ability. Sometimes, you need a simple input to call a C++ function directly on a component—for example, to toggle a cosmetic item, cycle through camera views, or trigger a simple interaction that doesn't warrant the complexity of GAS. This guide shows how to set up such a "native" input binding.

**Goal:** Make pressing the 'H' key call a C++ function `ToggleHat()` on a custom component attached to the player's character.

**Assumptions:**

* You have a C++ class `UMyCharacterComponent` (inheriting from `UActorComponent` or similar) that will be added to your player character.
* `UMyCharacterComponent` has a UFUNCTION named `void ToggleHat()`.

**Steps:**

1. **Step 1: Define the `UInputAction` (IA)**
   * **Purpose:** Create an abstract representation of the "Toggle Hat" action.
   * **Action:**
     * In the Content Browser, right-click > Input > Input Action.
     * Name it `IA_ToggleHat`.
     * Open `IA_ToggleHat`. Set its **Value Type** to `Boolean`.
     * Save the asset.
2. **Step 2: Define the `InputTag` for the Native Action**
   * **Purpose:** Create a unique `GameplayTag` that will represent this native input.
   * **Action:**
     * Open your project's `GameplayTag` manager.
     * Add a new tag, for example: `InputTag.Character.Cosmetic.ToggleHat`.
3. **Step 3: Update or Create a `ULyraInputConfig`**
   * **Purpose:** Map your new `IA_ToggleHat` to the `InputTag.Character.Cosmetic.ToggleHat`. This time, it will be in the `NativeInputActions` list.
   * **Action:**
     * Locate an existing `ULyraInputConfig` that's active for your player pawn (e.g., `InputConfig_DefaultCharacter` from `ULyraPawnData`).
     * Open `InputConfig_DefaultCharacter`.
     * Find the `NativeInputActions` array.
     * Add a new element:
       * `InputAction`: Set to your `IA_ToggleHat`.
       * `InputTag`: Set to `InputTag.Character.Cosmetic.ToggleHat`.
     * Save the `ULyraInputConfig`.
4. **Step 4: Create or Update an `InputMappingContext` (IMC)**
   * **Purpose:** Map the physical 'H' key to your `IA_ToggleHat`.
   * **Action:**
     * Locate an existing IMC active for Keyboard & Mouse (e.g., `IMC_Default_KBM`).
     * Open `IMC_Default_KBM`.
     * Add a new mapping:
       * `Input Action`: `IA_ToggleHat`.
       * Key: Press 'H'.
     * Save the `IMC_Default_KBM`.
5. **Step 5: Implement the C++ Function and Binding Logic**
   * **Purpose:** Write the `ToggleHat()` function and bind the input to it. This binding typically happens where other input bindings for the Pawn are set up, often in `ULyraHeroComponent` or a component that owns the `ULyraInputComponent`. For this example, we'll assume you might add this logic to `ULyraHeroComponent` or your custom `UMyCharacterComponent` if it has access to the `InputComponent`.
   *   **Action (Example in `ULyraHeroComponent::InitializePlayerInput`):**

       ```cpp
       // In ULyraHeroComponent.h (or your component's header)
       // UFUNCTION() // If you need it to be a UFUNCTION for other reasons
       // void HandleToggleHatInput(); // Or directly bind to MyCharacterComponent->ToggleHat

       // In ULyraHeroComponent.cpp, inside InitializePlayerInput after LyraIC is valid:
       // ...
       if (ULyraInputComponent* LyraIC = Cast<ULyraInputComponent>(PlayerInputComponent))
       {
           // ... other bindings ...

           // Assuming MyCharacterComponent is a member or can be found on the Pawn
           UMyCharacterComponent* MyCharComp = GetPawn<APawn>()->FindComponentByClass<UMyCharacterComponent>();
           if (MyCharComp)
           {
               // Find the InputConfig (e.g., from PawnData)
               // const ULyraPawnExtensionComponent* PawnExtComp = ULyraPawnExtensionComponent::FindPawnExtensionComponent(GetPawn<APawn>());
               // const ULyraPawnData* PawnData = PawnExtComp ? PawnExtComp->GetPawnData<ULyraPawnData>() : nullptr;
               // const ULyraInputConfig* InputConfig = PawnData ? PawnData->InputConfig : nullptr;
               // ensure(InputConfig); // Make sure InputConfig is valid

               // If InputConfig is valid:
               LyraIC->BindNativeAction(InputConfig, MyProjectGameplayTags::InputTag_Character_Cosmetic_ToggleHat, ETriggerEvent::Triggered, MyCharComp, &UMyCharacterComponent::ToggleHat, /*bLogIfNotFound=*/ true);
           }
       }
       ```

       * **Explanation:**
         * `MyProjectGameplayTags::InputTag_Character_Cosmetic_ToggleHat`: Make sure you have a globally accessible way to reference your gameplay tags in C++ (often defined in a dedicated `GameplayTags.h` file).
         * `ETriggerEvent::Triggered`: We want the function to be called when the input is pressed.
         * `MyCharComp`: The instance of your component that has the `ToggleHat` function.
         * `&UMyCharacterComponent::ToggleHat`: A pointer to the member function to call.
         * `bLogIfNotFound=true`: Useful for debugging; it will log an error if the `InputTag` or corresponding `InputAction` isn't found in the `InputConfig`.
       * **Alternative:** If `UMyCharacterComponent` itself sets up its own input (less common in Lyra's pattern but possible), it would need to get the Pawn's `InputComponent`, cast it to `ULyraInputComponent`, and perform the binding.
6. **Step 6: Implement `UMyCharacterComponent::ToggleHat()`**
   *   **Action (in `MyCharacterComponent.cpp`):**

       ```cpp
       void UMyCharacterComponent::ToggleHat()
       {
           UE_LOG(LogTemp, Warning, TEXT("ToggleHat() called!"));
           // Add your logic here to show/hide a hat mesh, etc.
       }
       ```
7. **Step 7: Ensure `UMyCharacterComponent` is on your Pawn**
   * Add `UMyCharacterComponent` to your player character Blueprint or C++ class.
8. **Step 8: Test**
   * Play the game.
   * Press 'H'.
   * Check your Output Log for "ToggleHat() called!" and observe if your hat logic works.

**Troubleshooting Checklist:**

* **Component Exists?** Is `UMyCharacterComponent` actually present on the Pawn when `InitializePlayerInput` (or your binding code) runs?
* **InputConfig Correct?** Does the active `ULyraInputConfig` have `IA_ToggleHat` mapped to `InputTag.Character.Cosmetic.ToggleHat` in its `NativeInputActions` list?
* **IMC Active & Correct?** Is the IMC mapping 'H' to `IA_ToggleHat` active?
* **Tag Correct in C++?** Is the `GameplayTag` used in `BindNativeAction` (`MyProjectGameplayTags::InputTag_Character_Cosmetic_ToggleHat`) exactly matching the one in the `InputConfig`?
* **Binding Code Executed?** Is the `LyraIC->BindNativeAction(...)` line actually being reached? Add log messages to verify.
* **Object for Binding Valid?** Is `MyCharComp` a valid pointer when `BindNativeAction` is called?

***

Binding inputs to native C++ functions provides a direct and efficient way to handle simpler interactions that don't require the overhead or features of the Gameplay Ability System. By leveraging `ULyraInputConfig`'s `NativeInputActions` and the `ULyraInputComponent::BindNativeAction` method, you can maintain a data-driven approach even for these direct bindings.

***
