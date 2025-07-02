# Attribute Sets

Attribute Sets are fundamental components of GAS, holding the numerical data that defines a character's stats and state. Within this asset, the primary sets related to combat interactions are `ULyraHealthSet` and `ULyraCombatSet`. Understanding their distinct roles and how they interact during damage or healing calculations is crucial.

**`ULyraAttributeSet` - The Base**

* This is the simple base class all other Attribute Sets in the project inherit from.
* It mainly provides helper functions like `GetLyraAbilitySystemComponent()` for convenient access to the owning ASC.

**`ATTRIBUTE_ACCESSORS` Macro**

* You'll frequently see this C++ macro used in the header files (.h) of Attribute Set classes.
* Example: `ATTRIBUTE_ACCESSORS(ULyraHealthSet, Health)`
* It automatically generates standard helper functions for accessing and initializing the attribute:
  * `static FGameplayAttribute GetHealthAttribute()`; (Returns the `static FGameplayAttribute` identifier)
  * float `GetHealth()` const; (Gets the current value)
  * void `SetHealth(float NewVal)`; (Sets the current value - use with caution, prefer GameplayEffects)
  * void `InitHealth(float NewVal)`; (Sets the base value)

**The Core Distinction: Source vs. Target Perspective**

The separation between `ULyraCombatSet` and `ULyraHealthSet` stems from the two perspectives involved in any combat interaction (like dealing damage):

1. **The Source:** The actor initiating the action (e.g., the player shooting a gun, an enemy casting a spell). They have attributes defining their potential to cause harm or healing.
2. **The Target:** The actor receiving the action (e.g., the enemy being shot, the player receiving a heal). They have attributes defining their current state and how they react to harm or healing.

* **`ULyraCombatSet` -> Source's Potential:** This set primarily holds attributes representing the source's capacity to inflict damage or provide healing before any target-specific defenses or situational modifiers are considered.
  * **`BaseDamage`:** How much damage does this attack potentially do?
  * **`BaseHeal`:** How much healing does this ability potentially provide?
* **`ULyraHealthSet` -> Target's State & Reaction:** This set primarily holds attributes representing the target's current health status and includes temporary "meta" attributes used during the damage/healing application phase.
  * **`Health`:** What is the target's current health?
  * **`MaxHealth`:** What is the target's maximum health?
  * **`Damage` (Meta):** How much damage is actually being applied to the target this frame after calculations?
  * **`Healing` (Meta):** How much healing is actually being applied to the target this frame after calculations?

**Why the Separation?**

Imagine calculating damage without this separation. If you only had a single "Damage" attribute on the `HealthSet`, and no `CombatSet`, how would you calculate it?

* **Option 1: Target calculates damage based on source stats:** The target would need access to the source's stats (like Attack Power). This creates complex dependencies and coupling.
* **Option 2: Source calculates damage and applies it directly to target's Health:** This bypasses the target's defenses (like armor or damage reduction buffs stored on the target's ASC/Attributes) and makes it hard for the target to react (e.g., trigger an "on damaged" effect before health changes).

The `CombatSet` (source) / `HealthSet` (target) split, combined with Gameplay Effect Executions, provides a clean, standard GAS pattern:

1. **Source Defines Potential:** The source actor triggers a Gameplay Effect containing an Execution (like `ULyraDamageExecution`).
2. **Execution Captures Potential:** The Execution captures the source's potential (`BaseDamage` from the source's `ULyraCombatSet`).
3. **Execution Calculates Application:** The Execution performs calculations considering context (distance, hit location, team checks) and potentially captures target attributes (like resistances, if you added them to `ULyraHealthSet`). It determines the final amount to apply.
4. **Execution Modifies Target's Meta Attribute:** The Execution outputs a modifier to the target's **meta attribute** (Damage or Healing on the target's `ULyraHealthSet`).
5. **Target Reacts & Applies:** The target's `ULyraHealthSet` (`PostGameplayEffectExecute`) detects the change in the meta attribute (Damage/Healing), applies the final modification to the actual Health attribute (clamping it), broadcasts events (`OnHealthChanged`, `OnOutOfHealth`), and finally resets the meta attribute (Damage/Healing) back to zero, ready for the next calculation.

This flow keeps source potential, calculation logic, and target state management distinct and ordered correctly.

#### Damage Scenario Walkthrough

Let's trace a simple Hitscan weapon damage event:

1. **Player Fires:** Player character (Source) fires a weapon. The weapon ability is activated.
2. **Hit Detected:** A hitscan trace confirms a hit on an Enemy character (Target).
3. **Ability Applies GE:** The weapon ability applies a Gameplay Effect (GE) to the Target. This GE contains:
   * The `ULyraDamageExecution`.
   * A modifier to set the Source's `ULyraCombatSet::BaseDamage` attribute (e.g., to 25.0 for this weapon). Alternatively, BaseDamage might be a permanent attribute on the Player's `CombatSet` influenced by stats.
4. **Execution Begins (on Target):** The GE attempts to execute on the Target. `ULyraDamageExecution::Execute_Implementation` runs.
5. **Capture Source Potential:** The Execution captures BaseDamage (value: 25.0) from the Source's `ULyraCombatSet`. It also captures relevant Source/Target tags.
6. **Context & Calculation:** The Execution:
   * Gets context (hit result, causer).
   * Checks teams via `ULyraTeamSubsystem` (assume Player vs Enemy is allowed, multiplier is 1.0).
   * Calculates distance/material attenuation (assume multiplier is 1.0 for simplicity).
   * Final `DamageDone = 25.0 * 1.0 * 1.0 * 1.0 = 25.0`.
7. **Execution Output:** The Execution adds an output modifier: `FGameplayModifierEvaluatedData(ULyraHealthSet::GetDamageAttribute(), EGameplayModOp::Additive, 25.0)`. This targets the Target's `HealthSet`.
8. **Target Attribute Set - PreExecute:** `ULyraHealthSet::PreGameplayEffectExecute` runs on the Target. It checks for `Gameplay.DamageImmunity` or GodMode tags. Assume none are present. It caches `HealthBeforeAttributeChange`.
9. **Target Attribute Set - PostExecute:** `ULyraHealthSet::PostGameplayEffectExecute` runs on the Target.
   * It detects the change was to the Damage attribute.
   * It reads the magnitude (25.0).
   * It applies the change to the actual Health attribute: `SetHealth(FMath::Clamp(GetHealth() - GetDamage(), MinimumHealth, GetMaxHealth()))`. Let's say current Health was 100, MaxHealth 100, MinHealth 0. New Health becomes `Clamp(100 - 25, 0, 100) = 75.0`.
   * It **resets the Damage attribute back to 0.0:** `SetDamage(0.0f)`.
   * It broadcasts `OnHealthChanged` (`OldValue`: 100, `NewValue`: 75).
   * If health had `dropped <= 0`, it would broadcast `OnOutOfHealth`.
10. **Completion:** The GE application is complete. The Target's Health is now 75. The meta Damage attribute is 0, ready for the next hit.

#### `ULyraCombatSet` - Deeper Dive

* **Purpose:** Holds source-centric potential values.
* **Attributes:**
  * **`BaseDamage` (`FGameplayAttributeData`):** Input for damage executions. Replicates `COND_OwnerOnly` (only the owner needs to know their base damage potential for prediction/UI, the server calculates final damage).
  * **`BaseHeal` (`FGameplayAttributeData`):** Input for heal executions. Replicates `COND_OwnerOnly`.
  *   **`TotalDamage` (`FGameplayAttributeData`):** `TotalDamage` may appear unused in the default damage application logic, but it plays an important **supporting role for UI feedback and gameplay cues**. It's intended as a **meta attribute** that can be set by a custom `ExecutionCalculation` (e.g., `ULyraShieldDamageExecution`) to represent the **final total damage dealt after all calculations and splits**, such as damage first absorbed by shields, then applied to health.

      This is particularly useful in scenarios where damage is **distributed across multiple layers** (e.g., shield and health) but the game needs to **display a single unified damage number** to the player through damage popups or gameplay cues.

      Although `TotalDamage` doesn't directly influence attribute values (its `PostGameplayEffectExecute` just resets it), you can modify your executions to assign the **final calculated damage** to this attribute alongside applying individual damage to `ShieldSet::Damage` and `HealthSet::Damage`.

#### `ULyraHealthSet` - Deeper Dive

* **Purpose:** Holds target-centric state and handles the application of damage/healing.
* **Attributes:**
  * **`Health` (`FGameplayAttributeData`):** Current health. Replicates `REPNOTIFY_Always` (clients need accurate health, `OnRep_Health` handles client-side updates/events). Hidden from direct GE mods.
  * **`MaxHealth` (`FGameplayAttributeData`):** Max health. Replicates `REPNOTIFY_Always`. Can be modified by GEs (e.g., buffs).
  * **`Damage` (`FGameplayAttributeData`):** Meta attribute. Receives output from damage executions. **Not replicated**, as it's transient and only relevant during server-side calculation within `PostGameplayEffectExecute`. Hidden from direct GE mods.
  * **`Healing` (`FGameplayAttributeData`):** Meta attribute. Receives output from heal executions. **Not replicated**.
* **Core Logic (`PostGameplayEffectExecute`):** This function is central. It takes the calculated values from the Damage or Healing meta attributes, applies them to the actual Health (respecting clamping and minimum health rules like GodMode), triggers relevant delegates (`OnHealthChanged`, `OnMaxHealthChanged`, `OnOutOfHealth`), and resets the meta attributes.
* **Clamping (`PreAttributeBaseChange`, `PreAttributeChange`, `ClampAttribute`):** Ensures Health stays within 0 and MaxHealth, and MaxHealth stays >= 1.
* **Delegates:** Provide hooks for other systems (`ULyraHealthComponent`, UI) to react to changes in health state.

By understanding this separation and the flow through Executions and `PostGameplayEffectExecute`, you can more effectively modify damage calculations, add resistances (likely as new attributes on `ULyraHealthSet` captured by the execution), or create new combat-related effects.

