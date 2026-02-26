# Add Abilities

This Game Feature Action is responsible for granting Gameplay Abilities, Ability Sets (both `ULyraAbilitySet` and standard `UAttributeSet`), and initializing Attribute Sets for specific types of actors when the associated Game Feature or Experience is activated. It's a cornerstone for defining the capabilities available to characters or other entities within a given gameplay context.

### Purpose

* **Grant Core Abilities:** Assign fundamental movement, interaction, or combat abilities to Pawns or Player States.
* **Add Attribute Sets:** Ensure actors have the necessary Attribute Sets (like Health, Stamina, Mana) required by the gameplay systems active in the experience.
* **Initialize Attributes:** Optionally provide default values for attributes within the granted sets using Data Tables.
* **Modular Ability Management:** Allow different Game Features or Experiences to contribute specific sets of abilities/attributes to actors without modifying the actor classes directly.

### Configuration

This action is configured by adding instances of it to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet`. Its primary property is:

<img src=".gitbook/assets/image (118).png" alt="" title="Add_Abilities GameFeatureAction configuration">

* **`Abilities List` (`TArray<FGameFeatureAbilitiesEntry>`)**: An array where each entry defines grants for a specific target Actor class.
  * **`FGameFeatureAbilitiesEntry`**:
    * **`Actor Class` (`TSoftClassPtr<AActor>`):** Specifies the target actor class (e.g., `ALyraCharacter`, `ALyraPlayerState`, `AVehicleBase`) that will receive the grants defined in this entry. The action uses the `UGameFrameworkComponentManager` to listen for instances of this class (or subclasses) becoming ready.
    * **`Granted Abilities` (`TArray<FLyraAbilityGrant>`)**: A list of individual `UGameplayAbility` classes to grant.
      * `FLyraAbilityGrant`: Contains `AbilityType` (`TSoftClassPtr<UGameplayAbility>`). _(Note: The original code snippet included an `InputAction` here, but standard Lyra practice usually binds inputs separately via Input Configs/Tags, so granting abilities directly linked to input actions here might be less common unless it's a very specific override)._
    * **`Granted Attributes` (`TArray<FLyraAttributeSetGrant>`)**: A list of `UAttributeSet` classes to grant.
      * `FLyraAttributeSetGrant`: Contains `AttributeSetType` (`TSoftClassPtr<UAttributeSet>`) and an optional `InitializationData` (`TSoftObjectPtr<UDataTable>`) used to initialize the attribute values from a row in the data table.
    * **`Granted Ability Sets` (`TArray<TSoftObjectPtr<const ULyraAbilitySet>>`)**: A list of `ULyraAbilitySet` assets to grant. This is often the preferred method for granting groups of related abilities and attribute sets together, as `ULyraAbilitySet` itself can contain abilities, attributes, and effects.

### Runtime Execution Flow

This action inherits from `UGameFeatureAction_WorldActionBase`.

1. **Activation (`OnGameFeatureActivating` -> `AddToWorld`):**
   * When the owning Game Feature/Experience activates, the action iterates through its `AbilitiesList`.
   * For each `FGameFeatureAbilitiesEntry`, it uses the `UGameFrameworkComponentManager` to register an extension handler for the specified `ActorClass`. This means the `HandleActorExtension` function will be called whenever an actor of that class (or a subclass) is added to the world or reaches a specific initialization state (`NAME_ExtensionAdded`, `NAME_GameActorReady`, or specifically `ALyraPlayerState::NAME_LyraAbilityReady`).
2. **`HandleActorExtension` -> `AddActorAbilities`:**
   * When an actor matching an `Entry.ActorClass` becomes ready, `HandleActorExtension` is triggered.
   * It calls `AddActorAbilities(Actor, Entry, ActiveData)`.
   * **Authority Check:** `AddActorAbilities` first ensures it's running on the server (`Actor->HasAuthority()`).
   * **Find ASC:** It finds or adds an `UAbilitySystemComponent` to the target `Actor` using `FindOrAddComponentForActor` (this helper ensures the component exists, potentially adding it if configured to do so via component manager requests). It expects a `ULyraAbilitySystemComponent`.
   * **Grant Individual Abilities:** Iterates through `Entry.GrantedAbilities`, loads the `AbilityType`, creates a `FGameplayAbilitySpec`, and calls `ASC->GiveAbility()`. Stores the returned `FGameplayAbilitySpecHandle`.
   * **Grant Attribute Sets:** Iterates through `Entry.GrantedAttributes`, loads the `AttributeSetType`, creates a new instance of the Attribute Set using `NewObject`, optionally initializes it using `InitFromMetaDataTable` if `InitializationData` is provided, calls `ASC->AddAttributeSetSubobject()` to register it, and stores the pointer.
   * **Grant Lyra Ability Sets:** Iterates through `Entry.GrantedAbilitySets`, loads the `ULyraAbilitySet` asset, and calls `Set->GiveToAbilitySystem(LyraASC, &AddedAbilitySetHandle)`. Stores the returned `FLyraAbilitySet_GrantedHandles`.
   * **Track Grants:** Stores all granted handles (`FGameplayAbilitySpecHandle`, `UAttributeSet*`, `FLyraAbilitySet_GrantedHandles`) in a map (`ActiveExtensions`) keyed by the target `Actor`, associated with the current activation context.
3. **Deactivation (`OnGameFeatureDeactivating` -> `Reset` -> `RemoveActorAbilities`):**
   * When the owning Game Feature/Experience deactivates, the `Reset` function is called.
   * `Reset` iterates through all actors currently tracked in `ActiveExtensions` for that context and calls `RemoveActorAbilities`.
   * `RemoveActorAbilities`:
     * Finds the actor's `UAbilitySystemComponent`.
     * Iterates through the stored `FGameplayAbilitySpecHandle`s and calls `ASC->SetRemoveAbilityOnEnd()` or `ClearAbility()`.
     * Iterates through the stored `UAttributeSet*` pointers and calls `ASC->RemoveSpawnedAttribute()`.
     * Iterates through the stored `FLyraAbilitySet_GrantedHandles` and calls `Handle.TakeFromAbilitySystem(LyraASC)`.
     * Removes the actor's entry from the `ActiveExtensions` map.
   * The component manager request handles are also cleared.

### Use Cases

* **Core Gameplay Setup:** An `ActionSet_CoreGameplay` included in most combat experiences might use this action to grant basic movement abilities (Jump, Crouch), interaction abilities, and core attribute sets (Health) to `ALyraCharacter`.
* **Mode-Specific Abilities:** A `B_Experience_CTF` might use this action to grant flag interaction abilities (`GA_PickupFlag`, `GA_ReturnFlag`) to players (`ALyraPlayerState` or `ALyraCharacter`).
* **Class Definition:** A specific `ULyraPawnData` (e.g., `PawnData_Medic`) could potentially be associated with an action set that uses this to grant unique healing abilities and attributes to pawns using that data. (Though often PawnData grants abilities directly via its own list).
* **Vehicle Abilities:** An action in a "VehicleGameplay" feature could grant driving/shooting abilities to `AVehicleBase` actors.

***

The `UGameFeatureAction_AddAbilities` provides a powerful, data-driven way to manage the capabilities granted to actors based on the active Game Features and Experience. It ensures that actors receive the correct abilities and attributes required for the current gameplay context and cleans them up properly upon deactivation.
