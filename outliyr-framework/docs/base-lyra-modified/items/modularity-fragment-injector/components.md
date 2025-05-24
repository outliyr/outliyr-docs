---
description: 'Fragment Injector: Components (UFragmentInjector & UFragmentInjectorManager)'
---

# Components

The Fragment Injector system relies on two key components: a Data Asset to define the injection/removal rules (`UFragmentInjector`) and a manager class to apply these rules at runtime (`UFragmentInjectorManager`).

***

#### `UFragmentInjector` (DataAsset)

This `UDataAsset` acts as the configuration file defining a specific injection or removal rule. You create instances of this asset (Content Browser: Right-Click -> Blueprint -> BlueprintClass -> Select `FragmentInjector`) within your feature plugin or module.

**Purpose:** To declare which fragment(s) should be added to, or which fragment class should be removed from, a specific item definition.

**Key Properties:**

1. **`Item Definition` (`TSubclassOf<ULyraInventoryItemDefinition>`)**
   * **Target:** Specifies the `ULyraInventoryItemDefinition` class whose Class Default Object (CDO) will be modified.
2. **`Fragments To Inject` (`TArray<FFragmentInjectorInfo>`)**
   * **Payload:** An array defining the modifications. Each element is an `FFragmentInjectorInfo` struct:
     * **`bRemoveFragment` (`bool`)**:
       * If `true`, this entry defines a fragment _class_ to be removed. The `Fragment` and `OverrideIndex` properties below will be ignored.
       * If `false` (default), this entry defines a fragment to be injected (added or replacing an existing one).
     * **`Fragment Class To Remove` (`TSubclassOf<ULyraInventoryItemFragment>`)**:
       * Only relevant if `bRemoveFragment` is `true`.
       * Specifies the class of fragment to remove from the target `Item Definition`'s CDO. All fragments of this exact class will be removed.
     * **`Fragment` (`TObjectPtr<ULyraInventoryItemFragment>`)**:
       * Only relevant if `bRemoveFragment` is `false`.
       * An **instanced** `ULyraInventoryItemFragment`. You add the desired fragment type here (e.g., `UInventoryFragment_Decay`) and configure its specific static properties directly within this injector asset instance.
     * **`Override Index` (`int32`, Default: 1)**:
       * Only relevant if `bRemoveFragment` is `false`.
       * Used for conflict resolution when injecting. If multiple `UFragmentInjector` assets try to inject the _same type_ of fragment into the _same_ `Item Definition`, the injector with the **higher** `Override Index` "wins." An index of 0 is typically reserved for fragments defined on the base Item Definition asset itself.

_Example Configuration (`B_FragmentInjector_RifleHardcoreMode` asset):_

* `Item Definition`: `ID_Rifle_Standard`
* `Fragments To Inject`:
  * `[0]`: (To modify gun fragment to remove infinit ammo)
    * `bRemoveFragment`: `true`
    * `Fragment Class To Remove`: `UInventoryFragment_AimAssistPro`
    * `Fragment`: (Not used)
    * `Override Index`: (Not used)
  * `[1]`: (To add a higher recoil fragment, potentially overriding a base one)
    * `bRemoveFragment`: `false`
    * `Fragment Class To Remove`: (Not used)
    * `Fragment`: Instance of `UInventoryFragment_IncreasedRecoil` (with `RecoilMultiplier = 1.5` configured).
    * `Override Index`: `20`

***

#### `UFragmentInjectorManager` (UObject)

This class orchestrates the finding, applying, and restoring of fragment modifications at runtime. It's typically intended to be instantiated and managed by a higher-level system that knows when features/plugins are loaded or unloaded (e.g., `ULyraExperienceManagerComponent`, Game Feature action handlers, or `AGameStateBase`).

**Purpose:**\
To manage the runtime modification and restoration of `ItemDefinition` CDOs based on active `UFragmentInjector` assets.

**Key Logic & Functions:**

* **`OriginalFragments` (`TMap<TSubclassOf<ULyraInventoryItemDefinition>, TArray<TObjectPtr<ULyraInventoryItemFragment>>>`)**:
  * An internal map used to store a deep copy of the original `Fragments` array from an `ItemDefinition` CDO _before_ any modifications are applied to it by this manager in the current session. This backup is crucial for restoration.
* **`InjectAllFragments(const ULyraExperienceDefinition* CurrentExperience)` / `InjectFragmentsForGameFeature(const FString& PluginURL)`**:
  * **Action:** Finds all `UFragmentInjector` Data Asset instances (specifically, their CDOs via their Blueprint classes) within the project or a specific plugin's content directory.
  * **Filtering (Optional):** The `InjectAllFragments` version includes a call to `IsFragmentInjectorForCurrentExperience` which you can implement to filter injectors based on the currently loaded Lyra Experience, ensuring only relevant modifications are applied.
  * **Backup:** Before modifying a target `ItemDefinition`'s CDO for the first time in a session, it stores a deep copy of its `Fragments` array in the `OriginalFragments` map. The fragments in this backup are temporarily added to the root set to prevent garbage collection.
  * **Injection:** For each valid and relevant `UFragmentInjector` asset found:
    * It calls `FragmentInjector->InjectFragments()` (described above), which performs the actual modification (add/remove/override) on the target `ItemDefinition` CDO's `Fragments` array.
    * **Note:** This modifies the CDO _in memory_. It does not save changes to the asset on disk. These changes are temporary for the current game session or until `RestoreOriginalFragments()` is called.
* **`RestoreOriginalFragments()`**:
  * **Action:** Reverts all modified `ItemDefinition` CDOs back to their original state as stored in the `OriginalFragments` map.
  * **Process:**
    1. Iterates through the `OriginalFragments` map.
    2. For each entry, gets the target `ItemDefinition` CDO.
    3. Restores the CDO's `Fragments` array back to the backed-up version.
    4. Removes the backed-up fragments from the root set, allowing them to be garbage collected if no longer referenced.
    5. Clears the `OriginalFragments` map.
  * **When Called:** This **must** be called when the relevant context ends (e.g., in `AGameStateBase::EndPlay`, when a Game Feature is unloaded, or when the Lyra Experience changes) to ensure CDOs are clean for the next session or for editor consistency if modifications were applied in PIE.
* **`GetBlueprintsFromBaseClass(...)` / `GetBlueprintsFromPlugin(...)`**:
  * Helper functions using the `FAssetRegistryModule` to discover `UFragmentInjector` Blueprint assets (which then provide access to their CDOs) based on their parent class and optional plugin location.

**Integration (Typical Scenario):**

1. **Instantiation:** An instance of `UFragmentInjectorManager` is created and managed by a suitable system (e.g., in your custom `AGameModeBase` or `AGameStateBase` subclass, or potentially linked to Game Feature activation/deactivation delegates if using UE's Game Features plugin).
2. **Injection on Load/Activation:**
   * When a game feature/plugin activates: Call `MyFragmentInjectorManager->InjectFragmentsForGameFeature(PluginURL)`.
   * When a Lyra Experience loads: Call `MyFragmentInjectorManager->InjectAllFragments(CurrentExperience)`.
3. **Restoration on Unload/Deactivation/End:**
   * When the game feature/plugin deactivates or the game ends (e.g., `AGameStateBase::EndPlay`): Call `MyFragmentInjectorManager->RestoreOriginalFragments()`.

***

Together, the `UFragmentInjector` Data Asset defines the "what," "where," and "how" (add, remove, override priority) of modifications, while the `UFragmentInjectorManager` handles the "when" and the lifecycle of these runtime CDO alterations. This provides a powerful and managed system for extending item definitions dynamically.
