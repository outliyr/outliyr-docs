# Lyra Ability Sets

The `ULyraAbilitySet` is a fundamental `UPrimaryDataAsset` within the Lyra/Shooter Base framework, designed to bundle together Gameplay Abilities, Gameplay Effects, and Attribute Sets into a single, manageable unit. Think of it as a pre-packaged "kit" of capabilities that can be granted to an Ability System Component (ASC).

### Core Concept & Purpose

Instead of granting individual abilities or attributes one by one, Ability Sets allow you to define logical groupings. This promotes:

* **Organization:** Keep related abilities, effects, and attribute sets (e.g., everything needed for basic movement, or all abilities for a specific weapon) grouped together in one data asset.
* **Reusability:** Define a common set of capabilities once (like `AbilitySet_CoreMovement`) and easily grant it in multiple different contexts (various player pawn data, different game mode experiences).
* **Composition:** Build complex character or item loadouts by combining multiple Ability Sets.
* **Atomic Management:** Grant or remove the entire set's contents with a single operation, simplifying setup and cleanup logic.
* **Simplified Input Binding:** Abilities defined within the set can be directly associated with an `InputTag`, streamlining the process of making granted abilities respond to player input.

### Creating an Ability Set

You create `ULyraAbilitySet` assets directly in the Unreal Editor:

1. **Content Browser:** Navigate to a suitable folder (e.g., `Content/AbilitySets`).
2. **Right-Click:** Right-click in the empty space.
3. **Miscellaneous:** Select **Data Asset**.
4. **Choose Class:** Search for and select **`LyraAbilitySet`** as the parent class.
5. **Name Asset:** Give it a descriptive name, often prefixed with `AbilitySet_` (e.g., `AbilitySet_CoreMovement`, `AbilitySet_Weapon_Rifle`, `AbilitySet_MedicKit`).

> [!success]
> Same steps as in the [`LyraPawnData` video](lyrapawndata.md#creation), just search for `LyraAbilitySet` instead.&#x20;

### Contents of an Ability Set

Within the editor for your `ULyraAbilitySet` asset, you can define three types of grants:

1. **Granted Gameplay Abilities (`TArray<FLyraAbilitySet_GameplayAbility>`):**
   * Specifies individual `UGameplayAbility` classes to grant.
   * **`FLyraAbilitySet_GameplayAbility` struct:**
     * `Ability` (TSubclassOf): The specific `ULyraGameplayAbility` class to grant.
     * `AbilityLevel` (int32): The level at which to grant the ability.
     * `InputTag` (FGameplayTag): **Crucially**, this tag links the ability to a specific input action defined in your Input Tag hierarchy (e.g., `InputTag.Ability.Primary`, `InputTag.Character.Jump`). When the Ability Set is granted, the ASC automatically configures the granted ability spec to be triggered when input associated with this tag occurs (assuming the necessary `ULyraInputConfig` and `UInputMappingContext` are also active).
2. **Granted Gameplay Effects (`TArray<FLyraAbilitySet_GameplayEffect>`):**
   * Specifies `UGameplayEffect` classes to apply to the owner when the set is granted. Useful for passive buffs, initial attribute modifications, or setting up linked effects.
   * **`FLyraAbilitySet_GameplayEffect` struct:**
     * `GameplayEffect` (TSubclassOf): The specific `UGameplayEffect` class to apply.
     * `EffectLevel` (float): The level at which to apply the effect.
3.  **Granted Attributes (`TArray<FLyraAbilitySet_AttributeSet>`):**

    * Specifies `UAttributeSet` classes to add to the owner's ASC.
    * **`FLyraAbilitySet_AttributeSet` struct:**
      * `AttributeSet` (TSubclassOf): The specific `UAttributeSet` class to grant (e.g., `MyHealthSet`, `MyStaminaSet`).



<img src=".gitbook/assets/image (111).png" alt="" title="Lyra Ability Set, AbilitySet_ShooterHero for the default ShooterBase Pawn">

### Internal Granting Mechanism (`GiveToAbilitySystem`)

The core function responsible for applying the Ability Set's contents is `ULyraAbilitySet::GiveToAbilitySystem`.

```cpp
// Simplified Signature from ULyraAbilitySet.h
void GiveToAbilitySystem(ULyraAbilitySystemComponent* LyraASC, FLyraAbilitySet_GrantedHandles* OutGrantedHandles, UObject* SourceObject = nullptr) const;

void GiveToAbilitySystemWithTag(ULyraAbilitySystemComponent* LyraASC, FLyraAbilitySet_GrantedHandles* OutGrantedHandles, UObject* SourceObject = nullptr, FGameplayTag AddedTag = FGameplayTag()) const; // Version to add an extra tag dynamically
```

* **Execution:** This function is called by systems like `GameFeatureAction_AddAbilities` or potentially directly when processing `ULyraPawnData`.
* **Authority:** It **must** be called on an **authoritative** ASC (i.e., on the server for networked actors, or locally for standalone).
* **Process:** It iterates through the `GrantedGameplayAbilities`, `GrantedGameplayEffects`, and `GrantedAttributes` arrays defined within the Ability Set asset.
  * For abilities, it creates a `FGameplayAbilitySpec`, associates the specified `InputTag` with it, and calls `LyraASC->GiveAbility()`.
  * For effects, it calls `LyraASC->ApplyGameplayEffectToSelf()`.
  * For attribute sets, it creates a new instance (`NewObject`) and calls `LyraASC->AddAttributeSetSubobject()`.
* **`OutGrantedHandles`:** If provided, this function populates a `FLyraAbilitySet_GrantedHandles` struct with handles corresponding to _everything_ it just granted. This is essential for cleanup.
* **`SourceObject`:** Allows specifying the object responsible for granting the set, useful for debugging and context.
* **`GiveToAbilitySystemWithTag`:** An extended version allowing an additional dynamic `FGameplayTag` to be added to all granted ability specs, potentially useful for contextual activation conditions.

### Tracking & Removal (`FLyraAbilitySet_GrantedHandles`)

To cleanly remove everything granted by an Ability Set, the system uses the `FLyraAbilitySet_GrantedHandles` struct.

```cpp
// Simplified struct from ULyraAbilitySet.h
USTRUCT(BlueprintType)
struct FLyraAbilitySet_GrantedHandles
{
    // Stores FGameplayAbilitySpecHandle for granted abilities
    UPROPERTY() TArray<FGameplayAbilitySpecHandle> AbilitySpecHandles;
    // Stores FActiveGameplayEffectHandle for applied effects
    UPROPERTY() TArray<FActiveGameplayEffectHandle> GameplayEffectHandles;
    // Stores pointers to the granted UAttributeSet instances
    UPROPERTY() TArray<TObjectPtr<UAttributeSet>> GrantedAttributeSets;

    // Function to remove everything tracked by this handle struct
    void TakeFromAbilitySystem(ULyraAbilitySystemComponent* LyraASC);
};
```

* **Population:** The `GiveToAbilitySystem` function fills this struct with the handles it creates. Systems like `GameFeatureAction_AddAbilities` store this handle struct.
* **Removal:** Calling `Handles.TakeFromAbilitySystem(LyraASC)` iterates through the stored handles:
  * Calls `LyraASC->ClearAbility()` for ability spec handles.
  * Calls `LyraASC->RemoveActiveGameplayEffect()` for effect handles.
  * Calls `LyraASC->RemoveSpawnedAttribute()` for attribute set pointers.
* **Atomicity:** This ensures that removing the "set" reliably removes all the individual components that were granted _by that specific instance_ of granting the set.

### Integration Points

`ULyraAbilitySet` assets are primarily referenced and utilized in two key places:

1. **`GameFeatureAction_AddAbilities`:** Within the `FGameFeatureAbilitiesEntry` struct, the `GrantedAbilitySets` array allows you to specify Ability Sets to grant when the action activates for a given Actor class. See the[ GameFeatureAction_AddAbilities documentation](../game-features/game-feature-actions/add-abilities.md) for more details.
2. **`ULyraPawnData`:** The `AbilitySets` array (`TArray<TObjectPtr<ULyraAbilitySet>>`) directly within the Pawn Data asset allows you to define a baseline set of capabilities inherent to any pawn using that data. The logic that initializes a pawn from its Pawn Data typically calls `GiveToAbilitySystem` for each set listed here.

### Use Cases & Examples

* **`AbilitySet_CoreMovement`:** Contains abilities like Jump, Sprint, Crouch, maybe a passive movement speed effect, and the Stamina attribute set. Granted to player characters by default.
* **`AbilitySet_Weapon_AssaultRifle`:** Contains `GA_Weapon_Fire`, `GA_Weapon_Reload`, `GA_Weapon_ADS` abilities, potentially a passive effect related to recoil, all linked to appropriate Input Tags (`InputTag.Ability.Primary`, `InputTag.Ability.Reload`, `InputTag.Ability.Secondary`). Granted when the player equips an assault rifle.
* **`AbilitySet_Class_Medic`:** Contains healing abilities, passive aura effects, and maybe attributes related to healing power. Granted to pawns using `PawnData_Medic`.
* **`AbilitySet_Interaction`:** Contains abilities for interacting with doors, items, objectives. Granted generally to player characters.

`ULyraAbilitySet` is a powerful tool for organizing and managing gameplay capabilities within the Lyra framework. By bundling abilities, effects, and attributes, and facilitating input binding, they promote a cleaner, more reusable, and compositional approach to designing character and item functionality.
