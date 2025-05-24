# Pocket Level Management

The foundation of the item inspection and icon generation system relies on effectively managing isolated pocket world instances. Several components work together to handle the spawning, identification, streaming, and cleanup of these dedicated levels.

### `UIdentifyingPocketLevel` (Data Asset)

This Data Asset class serves as the definition for a specific type of pocket world.

* **Inheritance:** It inherits from `UPocketLevel`, the base class likely provided by the PocketWorlds plugin functionality.
* **Purpose:** Defines the actual Unreal Engine Level (`.umap`) that should be streamed in when this pocket world type is requested. It also contains information about the level's bounds (`Bounds`).
* **Key Property:**
  * `IdentifingGameplayTag` (`FGameplayTag`): This is the crucial addition. It allows each pocket level _definition_ to be associated with a unique Gameplay Tag (e.g., `PocketWorld.Inventory.Inspection`). This tag can be used by management systems (like the `UPocketLevelBridgeSubsystem`) to request specific types of pocket worlds.
* **Usage:** You create instances of `UIdentifyingPocketLevel` as Data Assets in your project's Content Browser. For each asset, you assign the desired Level asset to the `Level` property and set a unique `IdentifingGameplayTag`.

### `UPocketLevelInstance` (Runtime Object)

This class represents a _runtime instance_ of a streamed pocket level within the game world.

* **Creation:** Instances are typically created by the `UPocketLevelSubsystem` (potentially via the `UPocketLevelBridgeSubsystem`).
* **Role:** It manages the state of a single streamed pocket level, including:
  * Holding references to the owning `ULocalPlayer` and the `UPocketLevel` definition asset it was created from.
  * Managing the underlying `ULevelStreamingDynamic` object responsible for the actual level streaming.
  * Tracking the instance's position and bounds in the world.
* **Lifecycle:**
  * `Initialize`: Sets up the instance, linking it to the player, definition, and spawn point, and initiates the level streaming process via `ULevelStreamingDynamic::LoadLevelInstanceBySoftObjectPtr`.
  * `StreamIn()` / `StreamOut()`: Functions to control the visibility and loading state of the associated level.
  * `HandlePocketLevelLoaded()`: Internal callback executed when the level is loaded. It performs necessary setup, such as setting `bClientOnlyVisible` and potentially adjusting actor ownership/roles within the loaded level to ensure correct client-side behaviour.
  * `HandlePocketLevelShown()`: Internal callback executed when the level becomes visible. This triggers the `OnReadyEvent`.
* **Events:**
  * `OnReadyEvent` (`FPocketLevelInstanceEvent`): A multicast delegate that broadcasts when the pocket level instance is fully loaded _and_ visible, signaling that it's safe to interact with its contents (like the `APocketLevelStageManager`). Systems like `UInventoryRepresentationWidget` listen to this event.
* **Access:** You typically get access to `UPocketLevelInstance` objects via the `UPocketLevelBridgeSubsystem`.

### `UPocketLevelBridgeSubsystem` (Management Hub)

This `UWorldSubsystem` acts as the primary interface for managing pocket levels specifically used by the inventory system's rendering features. It simplifies interaction and provides tailored functionality.

* **Purpose:** Centralizes pocket level management, abstracts underlying system calls, and provides convenient access methods.
* **Spawning Methods:**
  * `SpawnPocketLevel(ULocalPlayer*, UIdentifyingPocketLevel*, FVector)`: Spawns a pocket level based on the provided definition asset. It uses the `IdentifingGameplayTag` from the definition to track this instance internally. If an instance with that tag already exists for the player, it might be reused (depending on the exact internal logic, often relies on `UPocketLevelSubsystem::GetOrCreatePocketLevelFor`). Suitable for shared or singleton pocket worlds.
  * `SpawnPocketLevelWithUniqueID(ULocalPlayer*, UIdentifyingPocketLevel*, FVector)`: Spawns a pocket level based on the definition but assigns and returns a _new unique integer ID_. It tracks the instance using this ID. This guarantees a _new_ instance is created (via `UPocketLevelSubsystem::CreatePocketLevelFor`) and is essential when multiple independent pocket worlds of the same type are needed simultaneously (like multiple inspection windows).
* **Lifecycle Control:**
  * `StreamInLevel(FGameplayTag)` / `StreamInLevel(int32)`: Tells the corresponding `UPocketLevelInstance` to stream in.
  * `StreamOutLevel(FGameplayTag)` / `StreamOutLevel(int32)`: Tells the corresponding `UPocketLevelInstance` to stream out.
  * `DestroyPocketLevelInstance(FGameplayTag)` / `DestroyPocketLevelInstance(int32)`: Finds the corresponding `UPocketLevelInstance`, tells the base `UPocketLevelSubsystem` to destroy it, handles cleanup (streaming out, marking for destruction), and removes it from its internal tracking maps.
* **Accessing Content:**
  * `GetPocketLevelInstance(FGameplayTag)` / `GetPocketLevelInstance(int32)`: Retrieves the managed `UPocketLevelInstance` object using its tag or ID.
  * `GetStageManager(FGameplayTag)` / `GetStageManager(int32)`: **A key convenience function.** It retrieves the `UPocketLevelInstance` and then searches _within its loaded level_ to find and return the `APocketLevelStageManager` actor. This saves other systems from needing to manually iterate through actors in the pocket level.

**Interaction Summary:**

1. Define pocket world types using `UIdentifyingPocketLevel` assets.
2. Use `UPocketLevelBridgeSubsystem` to spawn instances of these definitions, choosing between tag-based (`SpawnPocketLevel`) or ID-based (`SpawnPocketLevelWithUniqueID`) creation depending on whether you need a shared or unique instance.
3. The bridge subsystem creates and tracks `UPocketLevelInstance` objects.
4. Listen to the `UPocketLevelInstance::OnReadyEvent` (often obtained via the bridge subsystem) to know when the level is loaded and visible.
5. Use `UPocketLevelBridgeSubsystem::GetStageManager` to easily access the primary actor (`APocketLevelStageManager`) within the loaded pocket level instance to begin staging items for rendering.
6. Use `UPocketLevelBridgeSubsystem::DestroyPocketLevelInstance` when the pocket world is no longer needed.

This layered approach provides a robust and organized way to handle the complexities of dynamic level streaming for the specific purpose of item rendering.
