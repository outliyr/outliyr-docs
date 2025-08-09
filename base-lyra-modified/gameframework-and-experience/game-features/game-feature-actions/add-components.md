# Add components

This Game Feature Action, provided directly by Unreal Engine's `GameFeature` plugin, allows a Game Feature to **dynamically add specified Actor Components** to Actors of a specific class when the feature is activated.

> [!warning]
> **Note:** This is an engine-provided action (`Engine/Plugins/Runtime/GameFeatures/Source/GameFeatures/Public/GameFeatureAction_AddComponents.h`). While customized actions are used elsewhere in this asset (like for abilities or widgets), this standard engine action is fundamental for adding component-based logic via features.

### Purpose

* **Modular Component Addition:** Enables Game Features to attach new components (and thus new behaviors or data) to existing Actor classes without modifying the Actor class definitions directly.
* **Conditional Logic:** Add components only when specific features are active (e.g., add a `UJetpackComponent` only when the "Jetpack" feature is enabled).
* **Data Association:** Components added this way can hold data or logic specific to the feature that added them.

### Configuration

Add instances of this action to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet`.

<img src=".gitbook/assets/image (119).png" alt="" title="Add_Components GameFeatureAction configuration">

* **`Component List` (`TArray<FGameFeatureComponentEntry>`)**: An array where each entry specifies a component to add to a target actor class.
  * **`FGameFeatureComponentEntry`**:
    * **`Actor Class` (`TSoftClassPtr<AActor>`):** The target base class of Actor (e.g., `APawn`, `ALyraCharacter`, `AController`) that should receive the new component. The system will add the component to all instances of this class (and its subclasses) that exist or spawn while the feature is active.
    * **`Component Class` (`TSoftClassPtr<UActorComponent>`)**: The specific `UActorComponent` class to add (e.g., `UMyFeatureLogicComponent`, `UHealthComponent`, `UInventoryManagerComponent`).
    * **`b Client Component` (`bool`)**: If true, the component will be added on clients.
    * **`b Server Component` (`bool`)**: If true, the component will be added on the server. (You can use these flags to add components only on the relevant authority/client).
    * **`Addition Flags` (`EGameFrameworkAddComponentFlags`)**: Optional flags (Bitmask) from the `UGameFrameworkComponentManager` that control _when_ the component is added relative to the Actor's initialization lifecycle (e.g., `रिक्वायरड` ensuring the component is added before certain initialization steps). Defaults to `None`.

_Example Configuration (Adding a custom feature component to the player character):_

* `Component List`:
  * `[0]`:
    * `Actor Class`: `ALyraCharacter`
    * `Component Class`: `UMyAwesomeFeatureComponent` (Your custom component class)
    * `b Client Component`: `true`
    * `b Server Component`: `true`
    * `Addition Flags`: `None`

### Runtime Execution Flow

This action utilizes the `UGameFrameworkComponentManager`, a subsystem designed to handle requests for adding components to actors dynamically.

1. **Activation (`OnGameFeatureActivating`):**
   * When the owning Game Feature/Experience activates, the action registers a listener for `FWorldDelegates::OnStartGameInstance`.
   * It also iterates through currently existing worlds and calls `AddToWorld` for relevant ones.
2. **`AddToWorld` / `HandleGameInstanceStart`:**
   * When called for a specific world context, it gets the `UGameFrameworkComponentManager` for that game instance.
   * It iterates through the `ComponentList` configured in the action asset.
   * For each `FGameFeatureComponentEntry`:
     * It checks the `bClientComponent`/`bServerComponent` flags against the current network mode (`NetMode`) to see if the component should be added in this context.
     * If it should be added, it loads the `ComponentClass` if necessary.
     * It calls `GFCM->AddComponentRequest(Entry.ActorClass, ComponentClass, Entry.AdditionFlags)`. This tells the manager "Whenever an actor matching `ActorClass` becomes ready, please ensure it has a component of type `ComponentClass`, respecting the `AdditionFlags`."
   * The action stores the `FComponentRequestHandle` returned by the manager. These handles represent the active request.
3. **`UGameFrameworkComponentManager` Logic:**
   * The Component Manager listens for actors being spawned or reaching certain initialization states.
   * When an actor matching a registered request (`ActorClass`) becomes ready, the manager checks if it already has the requested `ComponentClass`.
   * If the component is missing _and_ was not natively part of the actor's class definition (to avoid adding duplicates of native components), the manager adds the component to the actor instance. The timing depends on the `AdditionFlags`.
4. **Deactivation (`OnGameFeatureDeactivating`):**
   * When the owning Game Feature/Experience deactivates, the action retrieves the `FComponentRequestHandle`s it stored during activation.
   * It simply **empties** the array holding these handles. Releasing the `TSharedPtr` to the handle signals to the `UGameFrameworkComponentManager` that this specific request is no longer active.
   * The `UGameFrameworkComponentManager` internally reference counts these requests. When the reference count for adding a specific component type to a specific actor type drops to zero, the manager will automatically **remove** components it previously added based on those requests from existing actors.

### Use Cases

* **Adding Feature Logic:** Attaching components that contain the core logic or data for a specific game feature (e.g., adding a `USurvivalComponent` managing hunger/thirst to characters when a "Survival" feature is active).
* **Adding Core Components Conditionally:** Ensuring standard components like `UAbilitySystemComponent` or `UHealthComponent` are present on actors specified by a feature, potentially adding them if the base actor class doesn't include them natively (though adding core components this way needs careful consideration of dependencies).
* **Extending AI/Pawns:** Adding specialized AI behavior components or movement components to specific Pawn types only when a certain AI feature or game mode is active.
* **Dynamic Actor Setup:** Building up complex actor functionality by composing components added via multiple different Game Features.

### Important Considerations

* **Actor Awareness:** The documentation comment `//@TODO: Write more documentation here about how to make an actor game feature / modular gameplay aware` is important. For the `UGameFrameworkComponentManager` to effectively manage components added by this action (especially regarding initialization timing via `AdditionFlags` and receiving events), the target `ActorClass` (or its components) often needs to participate in the manager's event system, typically by calling `UGameFrameworkComponentManager::SendExtensionEvent` at appropriate points in its initialization (like `BeginPlay`, `PossessedBy`, `OnRep_PlayerState`). Lyra's base classes like `ALyraCharacter` and `ALyraPlayerState` already integrate with this system. Custom actor classes might need manual integration.
* **Dependencies:** Ensure that any systems relying on a component added by this action correctly handle cases where the component might not be present (if the Game Feature is inactive). Use safe checks (`FindComponentByClass`, `GetComponentByClass`) rather than assuming the component always exists.

***

The `UGameFeatureAction_AddComponents` is a powerful engine-provided tool for building modular actors. By requesting components via the `UGameFrameworkComponentManager`, Game Features can dynamically extend the functionality of existing actor classes in a clean and managed way, ensuring components are added and removed correctly based on feature activation state.
