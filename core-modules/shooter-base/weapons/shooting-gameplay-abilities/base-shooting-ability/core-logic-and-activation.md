# Core Logic & Activation

`UGameplayAbility_RangedWeapon` serves as the abstract base class for all Gameplay Abilities designed to fire ranged weapons within the ShooterBase system. It inherits from `ULyraGameplayAbility_FromEquipment` and establishes the fundamental activation flow, validation checks, and common helper functions used by its specialized subclasses (Hitscan, Projectile, etc.).

### Purpose

This base class avoids code duplication by handling common setup and teardown tasks associated with firing a weapon via GAS. Its main responsibilities in the activation flow include:

* Validating that an appropriate `ULyraRangedWeaponInstance` is equipped.
* Setting up the necessary GAS callbacks for handling asynchronous results (like target data).
* Updating weapon state (like the last firing time).
* Cleaning up GAS delegates upon ability completion.
* Providing a common entry point (`StartRangedWeaponTargeting`) for subclasses to initiate their specific firing logic.

### Activation Flow

1.  **`CanActivateAbility`**:

    * Performs the standard checks from `ULyraGameplayAbility_FromEquipment` (e.g., cooldowns, costs, blocking tags like `TAG_WeaponFireBlocked`).
    * **Adds a crucial check:** Ensures that the associated equipment instance (`GetAssociatedEquipment()`) is not only present but also specifically a `ULyraRangedWeaponInstance` (or a subclass like `UGunWeaponInstance`). If the equipped item isn't a compatible ranged weapon, activation fails. This prevents attempting to use ranged abilities with non-ranged equipment.

    ```cpp
    // Inside CanActivateAbility
    if (GetWeaponInstance() == nullptr)
    {
        // Log error: Ability needs a ULyraRangedWeaponInstance
        bResult = false;
    }
    ```
2.  **`ActivateAbility`**:

    * Calls `Super::ActivateAbility` to perform standard GAS activation setup.
    * Gets the `UAbilitySystemComponent` (ASC).
    * **Binds the callback:** Registers the `OnTargetDataReadyCallback` function to handle target data being set for this ability instance, associating it with the current `PredictionKey`. This is vital because targeting and hit processing might happen asynchronously or be delayed.

    ```cpp
    // Inside ActivateAbility
    OnTargetDataReadyCallbackDelegateHandle = MyAbilityComponent->AbilityTargetDataSetDelegate(
            CurrentSpecHandle, CurrentActivationInfo.GetActivationPredictionKey())
            .AddUObject(this, &ThisClass::OnTargetDataReadyCallback);
    ```

    * **Updates Weapon State:** Calls `GetWeaponInstance()->UpdateFiringTime()`. This marks the time the weapon was last fired, which is used by the weapon instance itself for things like spread recovery calculations.
    * _(Subclass Responsibility)_: Typically, the `ActivateAbility` implementation in concrete subclasses (like Hitscan or Projectile) will call `StartRangedWeaponTargeting()` to kick off the actual firing process after this base setup.
3. **`StartRangedWeaponTargeting`**:
   * This protected virtual function is intended to be overridden by subclasses.
   * It serves as the primary entry point where the specific firing logic begins (e.g., performing traces, calculating trajectories).
   * The base implementation does nothing, requiring subclasses to provide the functionality.
4. **`OnTargetDataReadyCallback`**:
   * This function is called automatically by the ASC when target data associated with this ability's `PredictionKey` is set (either locally by `StartRangedWeaponTargeting` or received from the server).
   * The base implementation is virtual and typically empty or contains minimal common logic.
   * **Subclasses override this** to handle the received `FGameplayAbilityTargetDataHandle`. This is where hitscan validation occurs, projectiles are spawned, or damage effects are applied based on the target data.
5.  **`EndAbility`**:

    * Performs standard GAS ability ending procedures.
    * **Cleans up the callback:** Unregisters the `OnTargetDataReadyCallback` delegate using the stored `OnTargetDataReadyCallbackDelegateHandle` to prevent dangling references or callbacks after the ability has finished.

    ```cpp
    // Inside EndAbility
    MyAbilityComponent->AbilityTargetDataSetDelegate(
        CurrentSpecHandle, CurrentActivationInfo.GetActivationPredictionKey())
        .Remove(OnTargetDataReadyCallbackDelegateHandle);
    ```

    * **Consumes Target Data:** Tells the ASC to consume any client-replicated target data associated with this ability instance's prediction key.

### Helper Functions

* **`GetWeaponInstance()`**: A convenience function that simply casts the result of `GetAssociatedEquipment()` (from the parent class) to `ULyraRangedWeaponInstance*`, providing easy typed access for subclasses.

This base class provides the essential structure and GAS integration points, allowing specific firing abilities to focus solely on their unique tracing, validation, and effect application logic.

***
