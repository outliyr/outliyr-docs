# Game Mode

The `ALyraGameMode` class serves as the **server-authoritative foundation** for defining the rules and managing the player lifecycle within a gameplay session. While inheriting from `AModularGameModeBase` (which itself inherits from `AGameModeBase`), its role in this modular framework is focused primarily on session initialization, player connection management, and pawn spawning logic, delegating specific game mode rules to systems loaded via Experiences.

### Role and Responsibilities

* **Session Initialization:** Determines which `ULyraExperienceDefinition` to load for the current session based on map settings, URL options, command-line arguments, or defaults (`InitGame`, `HandleMatchAssignmentIfNotExpectingOne`).
* **Experience Initiation:** Kicks off the Experience loading process by calling `SetCurrentExperience` on the `ULyraExperienceManagerComponent` (hosted on the `ALyraGameState`).
* **Player Connection & Initialization:** Handles new players connecting (`HandleStartingNewPlayer`, `GenericPlayerInitialization`), waiting for the Experience to be fully loaded before allowing players to fully join and spawn. Broadcasts the `OnGameModePlayerInitialized` delegate upon successful player initialization.
* **Default Pawn Selection:** Overrides `GetDefaultPawnClassForController_Implementation` to select the appropriate Pawn class based primarily on the `ULyraPawnData` associated with the controller (checking `ALyraPlayerState` first, then falling back to the `DefaultPawnData` specified in the currently loaded `ULyraExperienceDefinition`).
* **Pawn Spawning:** Overrides `SpawnDefaultPawnAtTransform_Implementation` to:
  * Spawn the Pawn class determined by `GetDefaultPawnClassForController`.
  * Find the `ULyraPawnExtensionComponent` on the newly spawned Pawn.
  * Set the correct `ULyraPawnData` on the extension component, ensuring the Pawn initializes with the right abilities, input config, camera mode, etc., as defined by the data asset.
* **Spawn Location Logic:** Defers the choice of _where_ a player spawns to other systems, typically the `ULyraPlayerSpawningManagerComponent` (if present on the `ALyraGameState`), by overriding `ChoosePlayerStart_Implementation` and returning `ShouldSpawnAtStartSpot = false`.
* **Restart Logic:** Handles player restart requests (`RequestPlayerRestartNextFrame`) and checks if restarts are allowed (`ControllerCanRestart`), often delegating the permission check to the spawning manager.
* **Dedicated Server Handling:** Includes logic (`TryDedicatedServerLogin`, `HostDedicatedServerMatch`, `OnUserInitializedForDedicatedServer`) for handling dedicated server startup, online login (if required by the platform), and hosting based on command-line parameters or defaults, often using `ULyraUserFacingExperienceDefinition` to configure the session.

### Key Overrides and Functions

* `InitGame`: Calls `Super::InitGame` and then schedules `HandleMatchAssignmentIfNotExpectingOne` for the next tick to allow initial settings to settle.
* `HandleMatchAssignmentIfNotExpectingOne`: Contains the core logic for determining the `FPrimaryAssetId` of the `ULyraExperienceDefinition` to load, checking URL options, developer settings, command line, world settings, and defaults in order of precedence. Calls `OnMatchAssignmentGiven`.
* `OnMatchAssignmentGiven`: Called with the determined Experience ID. Gets the `ULyraExperienceManagerComponent` from the Game State and calls `SetCurrentExperience` to start the loading process.
* `OnExperienceLoaded`: A callback function registered with the `ULyraExperienceManagerComponent`. Called when the experience is fully loaded. It attempts to restart any players who connected _before_ the experience finished loading.
* `GetDefaultPawnClassForController_Implementation`: Returns the `PawnClass` defined within the resolved `ULyraPawnData` for the controller.
* `SpawnDefaultPawnAtTransform_Implementation`: Spawns the pawn and crucially **sets the Pawn Data** on its `ULyraPawnExtensionComponent`, linking the pawn instance to its configuration data asset.
* `HandleStartingNewPlayer_Implementation`: Delays the `Super` call until `IsExperienceLoaded()` returns true.
* `ChoosePlayerStart_Implementation`: Delegates to `ULyraPlayerSpawningManagerComponent` on the GameState if available.
* `PlayerCanRestart_Implementation` / `ControllerCanRestart`: Delegates the restart permission check to `ULyraPlayerSpawningManagerComponent` if available, after performing base checks.
* `GenericPlayerInitialization`: Calls `Super` and then broadcasts the `OnGameModePlayerInitialized` delegate.

### Interaction with Other Systems

* **`ALyraGameState` / `ULyraExperienceManagerComponent`:** The Game Mode relies heavily on the Game State to host the Experience Manager. It initiates the loading process via the manager.
* **`ULyraPawnData`:** Reads Pawn Data (typically sourced from the loaded Experience or Player State) to determine which Pawn class to spawn and to configure the spawned Pawn via its extension component.
* **`ULyraPawnExtensionComponent`:** The Game Mode sets the `ULyraPawnData` on this component after spawning a pawn.
* **`ULyraPlayerSpawningManagerComponent`:** (Often added via Game Feature Action to the Game State) The Game Mode delegates spawn point selection and restart permission checks to this component if it exists.
* **`ULyraWorldSettings`:** Uses the `DefaultGameplayExperience` property as one of the potential sources when determining which Experience to load.

### Decoupling Game Rules

It's important to reiterate that `ALyraGameMode` itself generally **does not contain rules specific to a particular game mode** (like TDM scoring, CTF flag logic, etc.). These rules are expected to be implemented in components (often `UGameStateComponent` subclasses) that are added to the `ALyraGameState` dynamically via **Game Feature Actions** triggered by the loaded **Experience Definition**. The Game Mode's primary role is the setup and management of the session and player lifecycle within the context defined by the Experience.

***

`ALyraGameMode` acts as the entry point and lifecycle manager for gameplay sessions. It determines which Experience to run, ensures players are handled correctly based on the Experience load state, and spawns Pawns according to the configuration provided by `ULyraPawnData` assets linked to the Experience, while delegating specific game rules and spawn location logic to other components.
