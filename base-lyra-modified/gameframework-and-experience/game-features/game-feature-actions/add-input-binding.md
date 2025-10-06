# Add Input Binding

This Game Feature Action is responsible for dynamically adding **Input Configurations (`ULyraInputConfig`)** to Pawns when the associated Game Feature or Experience is activated. Input Configs define mappings between specific Input Tags (representing abstract actions like "Jump" or "Fire") and Gameplay Ability Tags (representing the abilities that should be activated by those inputs).

### Purpose

* **Contextual Input:** Allows different Game Features or Experiences to change how player input triggers abilities without modifying the core Pawn input handling. For example, the "Jump" input might trigger a standard jump ability in one experience but a jetpack ability in another.
* **Modular Input Setup:** Defines input-to-ability mappings within data assets (`ULyraInputConfig`) associated with specific features, rather than hardcoding them in player controllers or pawn classes.
* **Enable/Disable Action Sets:** Activate or deactivate entire sets of input-driven abilities based on the current gameplay context defined by the active Experience/Features.

### Configuration

This action is configured by adding instances of it to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet`.

<img src=".gitbook/assets/image (120).png" alt="" title="Add_InputBinding GameFeatureAction configuration">

* **`Input Configs` (`TArray<TSoftObjectPtr<const ULyraInputConfig>>`)**: An array of soft object pointers to `ULyraInputConfig` data assets. Each `ULyraInputConfig` asset contains a list mapping Input Tags to Gameplay Ability Tags.

_Example Configuration (in an Action Set for standard movement):_

* `Input Configs`:
  * `[0]`: `InputConfig_CoreMovement` (This asset would map `InputTag.Move` to `Ability.Move`, `InputTag.Jump` to `Ability.Jump`, etc.)

_Example Configuration (in an Experience for vehicle gameplay):_

* `Input Configs`:
  * `[0]`: `InputConfig_VehicleControls` (This asset might map `InputTag.Move` to `Ability.Vehicle.Accelerate`, `InputTag.Jump` to `Ability.Vehicle.Boost`, etc.)

### Runtime Execution Flow

This action also inherits from `UGameFeatureAction_WorldActionBase`.

1. **Activation (`OnGameFeatureActivating` -> `AddToWorld`):**
   * When the owning Game Feature/Experience activates, the action uses the `UGameFrameworkComponentManager` to register an extension handler specifically for the `APawn` class (and its subclasses).
2. **`HandlePawnExtension` -> `AddInputMappingForPlayer`:**
   * When a Pawn is added to the world or reaches the `NAME_BindInputsNow` event state (typically broadcast by `ULyraHeroComponent` when ready), `HandlePawnExtension` is triggered for that Pawn.
   * It calls `AddInputMappingForPlayer(Pawn, ActiveData)`.
   * **Find Hero Component:** `AddInputMappingForPlayer` first finds the `ULyraHeroComponent` on the Pawn (as this component manages the input config stack).
   * **Add Configs:** If the Hero Component is found, it iterates through the `InputConfigs` array defined in the action asset. For each valid `ULyraInputConfig` asset reference:
     * It loads the asset if necessary.
     * It calls `HeroComponent->AddAdditionalInputConfig(LoadedInputConfig)`.
   * **Track Bindings:** The `AddAdditionalInputConfig` function internally handles binding the input actions defined in the config (via the Enhanced Input system) to activate abilities with matching tags on the Pawn's ASC. It returns an array of `BindHandles` (unique IDs for the bindings). This action stores these handles associated with the Pawn in its internal `PawnsAddedTo` list within `FPerContextData`.
3. **Deactivation (`OnGameFeatureDeactivating` -> `Reset` -> `RemoveInputMapping`):**
   * When the owning Game Feature/Experience deactivates, the `Reset` function is called.
   * `Reset` iterates through all Pawns currently tracked in `PawnsAddedTo` for that context and calls `RemoveInputMapping`.
   * `RemoveInputMapping`:
     * Finds the `ULyraHeroComponent` on the Pawn.
     * Retrieves the stored `BindHandles` associated with this Pawn and this action instance.
     * Calls `HeroComponent->RemoveAdditionalInputConfig(StoredBindHandles)`. This unbinds the input actions previously set up by this action.
     * Removes the Pawn's entry from the internal tracking list.

### Use Cases

* **Core Controls:** Defining the standard movement, interaction, and ability inputs for the default player experience.
* **Mode-Specific Controls:** Overriding or adding input bindings for specific game modes (e.g., adding build actions in a construction mode, vehicle controls when possessing a vehicle).
* **Temporary Ability Inputs:** Granting temporary abilities (like a special power-up) along with the specific input binding needed to activate them via a short-lived Game Feature activation.
* **Separating Concerns:** Keeps the definition of _what input triggers what ability_ separate from both the Pawn class and the Ability definition itself, residing within the `ULyraInputConfig` data assets.

### Relationship with Other Actions

* **`UGameFeatureAction_AddAbilities`:** Often used in conjunction. `AddAbilities` grants the actual `UGameplayAbility` to the Pawn's ASC, while `AddInputBinding` provides the `ULyraInputConfig` that tells the input system _how_ to trigger that granted ability via player input.
* **`UGameFeatureAction_AddInputContextMapping`:** Works at a lower level, adding entire `UInputMappingContext` assets (which define the raw hardware input-to-Input Action mappings). `AddInputBinding` works at a higher level, mapping abstract Input Actions (represented by Input Tags) to Ability Tags. You typically need both: `AddInputContextMapping` to define _what_ keys/buttons map to actions like "Jump", and `AddInputBinding` to define _what gameplay ability_ the "Jump" action should trigger _in this context_.

***

The `UGameFeatureAction_AddInputBinding` action provides a crucial link between abstract player input and specific gameplay abilities within the context of an active Experience or Game Feature. By managing `ULyraInputConfig` assets, it allows for flexible and modular control over how players interact with the game's abilities.
