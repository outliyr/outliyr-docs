# Damage & Heal Executions

Gameplay Effect Executions (`UGameplayEffectExecutionCalculation`) are powerful C++ classes used within Gameplay Effects (GEs) to perform custom calculations that determine the final magnitude of attribute modifiers. They are essential for handling complex interactions like damage and healing, which often depend on multiple source and target attributes, context (like hit distance or team affiliation), and specific game rules.

This asset provides two core executions: `ULyraDamageExecution` and `ULyraHealExecution`.

#### The Role of Executions in the Damage/Healing Flow

As outlined previously, Executions act as the central calculation hub:

1. **Triggered:** When a GE containing the Execution is applied to a Target.
2. **Inputs:** They capture attribute values from the Source and/or Target ASCs, as defined in the Execution's constructor (using `FGameplayEffectAttributeCaptureDefinition`). They also receive context information via the `FGameplayEffectCustomExecutionParameters`.
3. **Calculation:** They perform custom C++ logic (`Execute_Implementation`) using the captured attributes and context.
4. **Outputs:** They generate `FGameplayModifierEvaluatedData`, specifying which attribute on the Target should be modified, by how much, and using which operation (`Additive`, `Multiplicative`, `Override`). Crucially, for damage/healing, they typically output to the meta attributes (`Damage` or `Healing`) on the `ULyraHealthSet`.

#### `ULyraDamageExecution`

* **Inheritance:** `UGameplayEffectExecutionCalculation` -> `ULyraDamageExecution`
* **Purpose:** To calculate the amount of damage that should be applied to a target based on the source's potential, context, and game rules.

**Key Aspects:**

1. **Attribute Capture:**
   * In its constructor, it specifies that it needs to capture `ULyraCombatSet::GetBaseDamageAttribute()` from the **Source** (`EGameplayEffectAttributeCaptureSource::Source`). The true parameter indicates this capture is a "Snapshot," meaning it takes the value of `BaseDamage` at the moment the GE Spec is created, not necessarily when the Execution runs (important for effects with durations or delays).
2. **Execution Logic (`Execute_Implementation`):**
   * **Get Context:** Extracts the `FLyraGameplayEffectContext` (a custom context struct likely holding more game-specific data like hit results) and the Source/Target `GameplayTagContainers` from the input `ExecutionParams`.
   * **Get Base Damage:** Retrieves the captured `BaseDamage` value from the Source.
   * **Determine Hit Info:** Extracts hit location, normal, and the actual Hit Actor from the `HitResult` stored in the context. Provides fallback logic if no hit result is present (using target avatar location).
   * **Team Check:** Uses [`ULyraTeamSubsystem`](../../team/)`::CanCauseDamage(EffectCauser, HitActor)` to determine if the interaction is allowed based on team rules (e.g., friendly fire settings). This results in `DamageInteractionAllowedMultiplier` (either 1.0 or 0.0).
   * **Distance Calculation:** Calculates the distance between the damage origin (from context or causer location) and the impact location.
   * **Contextual Attenuation (via `ILyraAbilitySourceInterface` - Optional):**
     * Checks if the `GameplayEffectContext` provides an `ILyraAbilitySourceInterface`. This interface (likely implemented by things like weapon blueprints or ability objects) allows the source of the ability/damage to define custom falloff curves or modifiers.
     * Calls `AbilitySource`->`GetPhysicalMaterialAttenuation()` using the hit `UPhysicalMaterial` (if available) to get a damage multiplier based on the surface hit.
     * Calls `AbilitySource`->`GetDistanceAttenuation()` using the calculated distance to get a damage multiplier based on range.
   * **Final Calculation:** `DamageDone` = `BaseDamage * DistanceAttenuation * PhysicalMaterialAttenuation * DamageInteractionAllowedMultiplier`. Ensures the result is non-negative `(FMath::Max(..., 0.0f))`.
   * **Output:** If `DamageDone > 0.0f`, it adds an **output modifier** using `OutExecutionOutput.AddOutputModifier`. This modifier targets the Target's `ULyraHealthSet::GetDamageAttribute()` with an `EGameplayModOp::Additive` operation and the calculated `DamageDone` magnitude.

**Important Flow Note:** `ULyraDamageExecution` does not directly change Health. It calculates the damage amount and outputs it to the temporary Damage meta attribute on the target's `ULyraHealthSet`. The `ULyraHealthSet` then processes this value in its `PostGameplayEffectExecute` function to actually modify the Health.

#### `ULyraHealExecution`

* **Inheritance:** `UGameplayEffectExecutionCalculation` -> `ULyraHealExecution`
* **Purpose:** To calculate the amount of healing that should be applied to a target based on the source's potential.

**Key Aspects:**

1. **Attribute Capture:**
   * Captures `ULyraCombatSet::GetBaseHealAttribute()` from the **Source** (as a snapshot).
2. **Execution Logic (`Execute_Implementation`):**
   * **Get Base Heal:** Retrieves the captured BaseHeal value from the Source.
   * **Final Calculation:** Calculates HealingDone = `FMath::Max(0.0f, BaseHeal)`. (Currently, no complex context checks like distance or team affiliation are implemented for healing in this base execution).
   * **Output:** If `HealingDone > 0.0f`, it adds an **output modifier** targeting the Target's `ULyraHealthSet::GetHealingAttribute()` with an `EGameplayModOp::Additive` operation and the `HealingDone` magnitude.

> [!success]
> Similar to damage, `ULyraHealExecution` outputs to the Healing meta attribute on the target's `ULyraHealthSet`, which then applies the change to Health in its `PostGameplayEffectExecute`.

#### Extending Executions

You can create custom executions for more complex scenarios:

* **Damage Types & Resistances:**
  * Add resistance attributes (e.g., FireResistance, Armor) to `ULyraHealthSet`.
  * Create a new Damage Execution (e.g., `UMyDamageExecution_Resistances`).
  * Capture the target's resistance attributes (`EGameplayEffectAttributeCaptureSource::Target`).
  * Modify the damage calculation logic to reduce `DamageDone` based on captured resistances. You might use Gameplay Tags on the source GE Spec to indicate the damage type (e.g., `Damage.Type.Fire`).
* **Critical Hits:**
  * Capture a `CritChance` attribute from the Source and potentially a `CritDamageMultiplier`.
  * In the execution logic, perform a random roll against `CritChance`.
  * If a crit occurs, multiply `DamageDone` by `CritDamageMultiplier`.
* **Life Steal:**
  * Capture a `LifeStealPercent` attribute from the Source.
  * After calculating `DamageDone`, calculate `HealAmount = DamageDone * LifeStealPercent`.
  * Add two output modifiers: one for the Damage attribute on the Target, and another for the Healing attribute on the Source.
* **Complex Healing:**
  * Create a `UMyHealExecution` that captures the Target's `MaxHealth`.
  * Modify the calculation to heal based on a percentage of the Target's `MaxHealth` instead of just the Source's `BaseHeal`.

Executions provide the flexibility to implement nearly any calculation logic needed for your game's combat or interaction systems, cleanly integrating source potential, target state, and contextual information.

