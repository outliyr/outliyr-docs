# Granting Abilities With Input

> [!success]
> This page will cover the input related aspect of the ULyraAbilitySet, for more information outside of the input behaviour check it's [documentation page](../../gameframework-and-experience/experience-primary-assets/lyra-ability-sets.md).

While `ULyraPawnData` and `ULyraInputConfig` establish how player inputs are interpreted as `GameplayTags`, the **`ULyraAbilitySet`** Data Asset is crucial for granting the actual `ULyraGameplayAbility` instances to an actor and, importantly, specifying which `InputTag` should trigger them.

**Role of `ULyraAbilitySet` in the Input-to-Ability Chain:**

An `ULyraAbilitySet` is a collection of Gameplay Abilities, Gameplay Effects, and Attribute Sets that can be granted to an `AbilitySystemComponent` (ASC) as a single unit. For input-driven abilities, its key contribution is within the `FLyraAbilitySet_GameplayAbility` struct.

* **`FLyraAbilitySet_GameplayAbility` Struct:**
  * This struct is used within the `GrantedGameplayAbilities` array of an `ULyraAbilitySet`.
  * It contains several properties, but the most relevant for input binding is:
    * **`InputTag` (`FGameplayTag`):** This field is where you specify the `GameplayTag` that should be associated with the granted ability for the purpose of input activation.
* **The Connection:**
  1. An `Input Action` (e.g., `IA_PrimaryFire`) is mapped to an `InputTag` (e.g., `InputTag.Ability.PrimaryFire`) in an active `ULyraInputConfig`.
  2. A `ULyraAbilitySet` (e.g., `AbilitySet_Weapon_Rifle`) grants a specific `ULyraGameplayAbility` (e.g., `GA_Weapon_Fire_Rifle`).
  3. Within that `AbilitySet_Weapon_Rifle`, the `FLyraAbilitySet_GameplayAbility` entry for `GA_Weapon_Fire_Rifle` has its `InputTag` field set to `InputTag.Ability.PrimaryFire`.
  4. When `ULyraAbilitySet::GiveToAbilitySystem()` grants this ability, it creates an `FGameplayAbilitySpec`. This `InputTag` (`InputTag.Ability.PrimaryFire`) is added to the `DynamicSpecSourceTags` of that `FGameplayAbilitySpec`.
  5. Later, when the player performs the action that triggers `IA_PrimaryFire`, and this is processed through the `ULyraInputConfig` to become `InputTag.Ability.PrimaryFire`, the `ULyraAbilitySystemComponent` can find the `FGameplayAbilitySpec` for `GA_Weapon_Fire_Rifle` because its `DynamicSpecSourceTags` contains `InputTag.Ability.PrimaryFire`.

**In essence, the `InputTag` in `FLyraAbilitySet_GameplayAbility` must&#x20;**_**match**_**&#x20;an `InputTag` defined in the `AbilityInputActions` list of an active `ULyraInputConfig` for the player's input to successfully trigger that specific granted ability.**

**How `ULyraAbilitySets` are Typically Used for Input:**

* **Pawn Defaults:** `ULyraPawnData` contains an `AbilitySets` array. Ability Sets listed here are granted when the Pawn is initialized, establishing its baseline input-driven abilities.
  * Example: `PawnData_DefaultCharacter` might include `AbilitySet_CoreMovement` which grants a Jump ability linked to `InputTag.Ability.Jump`.
* **Game Feature Actions:** The `UGameFeatureAction_AddAbilities` action can grant `ULyraAbilitySets` when a Game Feature is activated. This allows features to dynamically add new input-driven abilities.
  * Example: A "Grenade" Game Feature might activate an `AbilitySet_GrenadeThrow` that grants a grenade throwing ability linked to `InputTag.Ability.Grenade`.
* **Equipment System:** When a Lyra character equips an item (like a weapon), the equipment system often grants an `ULyraAbilitySet` associated with that item. This is how weapon firing, aiming, and reloading abilities (each linked to their respective `InputTags`) are typically made available.

**Configuration Steps:**

1. **Define your `InputTag` in `GameplayTagsManager`** (e.g., create `InputTag.Ability.SpecialAttack`).
2. **In your `ULyraInputConfig`:**
   * Add an entry to `AbilityInputActions`.
   * Map an existing or new `UInputAction` (e.g., `IA_SpecialAttack`) to your `InputTag.Ability.SpecialAttack`.
3. **In your `ULyraAbilitySet` (e.g., `AbilitySet_MyCharacterSpecials`):**
   * Add an entry to `GrantedGameplayAbilities`.
   * Select your `ULyraGameplayAbility` subclass (e.g., `GA_MySpecialAttack`).
   * Set its `InputTag` field to `InputTag.Ability.SpecialAttack`.
4. **Ensure the `ULyraInputConfig` is active** (e.g., via `ULyraPawnData` or `GameFeatureAction_AddInputBinding`).
5. **Ensure the `ULyraAbilitySet` is granted** to the actor (e.g., via `ULyraPawnData`, `GameFeatureAction_AddAbilities`, or an equipment system).
6. **Ensure an `InputMappingContext` maps a hardware key to `IA_SpecialAttack`.**

***

### **Summary:**

The `ULyraAbilitySet` is the primary vehicle for granting abilities that respond to player input. By setting the `InputTag` field within its `FLyraAbilitySet_GameplayAbility` entries, you create the crucial link between the abstract input intent (defined by `ULyraInputConfig`) and the specific `ULyraGameplayAbility` that should execute. This data-driven approach allows for flexible and modular assignment of input-triggered abilities.

**Next:**

Now that we've seen how `ULyraPawnData` and `ULyraAbilitySet` contribute to configuring input at a base level, let's explore how Game Feature Plugins can dynamically extend and modify these input configurations.

***
