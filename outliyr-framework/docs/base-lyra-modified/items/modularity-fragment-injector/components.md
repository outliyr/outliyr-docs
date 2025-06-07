# Components

The Fragment Injector system is already integrated and ready to use.\
It consists of two runtime-only classes:

| Component                      | Type         | Responsibility                                                                                                          |
| ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **`UFragmentInjector`**        | `UDataAsset` | Declares **what** fragment(s) to add or remove on a specific `ULyraInventoryItemDefinition`.                            |
| **`UFragmentInjectorManager`** | `UObject`    | Applies those rules when a feature or game-mode is activated, then restores the originals when the feature is unloaded. |

***

### `UFragmentInjector` (Data Asset)

Each `UFragmentInjector` asset is a self-contained rule set.\
The engine loads these assets automatically from active plugins / game-feature packs and applies them through the manager.

#### Key properties

| Property                                                            | Purpose                              |
| ------------------------------------------------------------------- | ------------------------------------ |
| **`Item Definition`** (`TSubclassOf<ULyraInventoryItemDefinition>`) | The item whose CDO will be modified. |
| **`Fragments To Inject`** (`TArray<FFragmentInjectorInfo>`)         | One or more add/remove operations.   |

`FFragmentInjectorInfo` fields:

| Field                   | When used                   | Meaning                                                                                                                                                                                   |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bRemoveFragment`       | always                      | `true` = _remove_ a fragment class, `false` = _add / override_ a fragment instance.                                                                                                       |
| `FragmentClassToRemove` | when removing               | Class to strip from the item. All instances of **this exact class** are removed if the override check passes.                                                                             |
| `Fragment`              | when adding                 | Instanced fragment configured directly in the asset.                                                                                                                                      |
| `OverrideIndex`         | when adding **or removing** | Conflict resolver. A modification only proceeds if its index is **≥** the index of any existing fragment of the same class. Base assets typically use `0`; plugin injectors start at `1`. |

**Example asset**

| Setting                 | Value                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `Item Definition`       | `ID_Rifle_Standard`                                                                                     |
| **Fragments To Inject** |                                                                                                         |
| • Index 0               | Remove `UDurabilityFragment` (sets `bRemoveFragment=true`, `FragmentClassToRemove=UDurabilityFragment`) |
| • Index 1               | Add `UArenaShopInfoFragment` (price = 750 credits) with `OverrideIndex=1`                               |

Result while **Arena Mode** is loaded:\
`ID_Rifle_Standard` loses durability, gains shop data, but reverts the moment Arena Mode unloads.

***

### `UFragmentInjectorManager`

The manager lives for the duration of a match or feature activation.\
It performs three jobs:

1. **Discovery** – scans active plugins for `UFragmentInjector` assets.
2. **Injection** – patches the target Item-Definition CDOs **in memory**.
   * Before the first patch it saves a deep copy of the original fragment list.
   * Overrides and removals obey the `OverrideIndex` rule.
3. **Restoration** – on feature unload or `EndPlay`, restores every modified CDO to its saved copy and releases GC roots.

#### Core API

| Function                                   | When the engine calls it                                            |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `InjectFragmentsForGameFeature(PluginURL)` | Immediately after a Game Feature plugin is activated.               |
| `InjectAllFragments(CurrentExperience)`    | After the Lyra Experience loads (called once).                      |
| `RestoreOriginalFragments()`               | On Game Feature deactivation, experience change, or world shutdown. |

#### Internal data

`TMap< ItemDefClass , OriginalFragmentArray > OriginalFragments`\
Stores pristine arrays so restoration is exact and deterministic.

***

### Typical Runtime Flow

```
Game/Feature Loads ─▶ Manager finds injectors ─▶
    Saves pristine CDO ▸ Applies add/remove rules ▸
    … gameplay runs with modified items …
Feature Unloads / EndPlay ─▶ Manager restores pristine CDO
```

No asset files on disk are touched; every change lives only for the active session.

***

### Practical Benefits

* **One true item ID** – `ID_Rifle_Standard` stays the same across all modes.
* **No cross-plugin coupling** – core plugins never reference optional mode fragments.
* **Zero asset duplication** – no `ID_Rifle_Standard_Arena`, `…_BR`, etc.
* **Safe rollback** – CDOs are guaranteed to return to their original state.

***

With the injector system in place, adding or removing behaviour for a specific game feature is as simple as **creating a new `UFragmentInjector` asset inside that feature’s plugin** and configuring its array.\
The manager will do the rest automatically.
