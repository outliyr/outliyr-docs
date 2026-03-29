# Game Mode and State

The framework extends Unreal's standard GameMode and GameState to support data-driven experiences. If you have worked with Unreal multiplayer before, these classes will be familiar, the extensions add experience loading, modular player initialization, and a game-wide ability system. The rest of the game framework classes (WorldSettings, GameInstance, GameSession) receive lighter modifications, mostly wiring them into the experience pipeline.

***

### `ALyraGameMode`

The GameMode orchestrates two things: selecting which experience to load, and managing the player lifecycle. It inherits from `AModularGameModeBase`, which provides the hooks that game feature plugins use to inject components and extend behavior.

#### Experience Selection

When the map loads, `InitGame` kicks off experience selection. The GameMode determines which experience to use by checking multiple sources in precedence order, URL options, command line arguments, developer settings, and the map's World Settings default. Once resolved, the result is passed to the `ULyraExperienceManagerComponent` on the GameState via `OnMatchAssignmentGiven`. See [Experience Lifecycle](experience-lifecycle.md) for the full selection chain.

The GameMode also listens for the experience to finish loading. `OnExperienceLoaded` fires when the experience is fully activated, at which point the GameMode processes any players that joined early and were waiting for the experience before receiving pawns.

#### Player Lifecycle

The GameMode controls how players join and get their pawns:

* **`GetPawnDataForController()`** determines which `ULyraPawnData` a player should use. It checks for per-team overrides on the `ULyraTeamCreationComponent` first, then falls back to the experience's `DefaultPawnData`. This is the single decision point for which pawn configuration a player receives.
* **`GetDefaultPawnClassForController_Implementation()`** reads the pawn class from the resolved PawnData. This is how Unreal's standard spawning pipeline gets the correct class without the GameMode needing a hardcoded pawn reference.
* **`HandleStartingNewPlayer_Implementation()`** delays pawn spawning until the experience is loaded. If the experience is not yet ready, the player simply waits, no early spawn, no placeholder pawn.
* **`SpawnDefaultPawnAtTransform_Implementation()`** handles the actual pawn spawn, reading the class from PawnData.
* **`FinishRestartPlayer()`** and **`FailedToRestartPlayer()`** manage the restart flow, with extension points for custom restart logic.
* **`RequestPlayerRestartNextFrame()`** queues a respawn for the next frame, optionally force-resetting the controller (abandoning any currently possessed pawn).

After a player is fully initialized, the **`OnGameModePlayerInitialized`** delegate fires. Subsystems that need to respond to new players, team assignment, spectator setup, analytics, bind to this delegate rather than overriding GameMode methods directly.

#### Bot Management

The GameMode provides `ControllerCanRestart()` as an agnostic version of `PlayerCanRestart` that works for both player controllers and AI controllers, keeping the restart logic unified across human and bot players.

***

### `ALyraGameState`

The GameState hosts the experience and provides game-wide services. It inherits from `AModularGameStateBase` and implements `IAbilitySystemInterface`, making it a valid target for gameplay effects and cues at the game level.

#### Core Components

* **`ULyraExperienceManagerComponent`** — the private component that manages the entire experience lifecycle: loading, activation, deactivation, and broadcasting readiness to the rest of the framework. The GameState is where this component lives because the GameState replicates to all clients, which is how the experience ID reaches joining players.
* **`ULyraAbilitySystemComponent`** — a game-wide ASC used for global gameplay cues and game-level effects. Accessible via `GetLyraAbilitySystemComponent()` (Blueprint-callable) or the standard `IAbilitySystemInterface::GetAbilitySystemComponent()`. This is not the per-pawn ASC, it exists for effects that apply to the match as a whole.

#### Messaging

The GameState provides two multicast message functions for broadcasting `FLyraVerbMessage` structs to all clients:

* **`MulticastMessageToClients()`** — unreliable. Use for notifications that can tolerate being lost (elimination feeds, cosmetic events).
* **`MulticastReliableMessageToClients()`** — reliable. Use for notifications that must arrive (round transitions, critical game state changes).

#### Supplementary State

* **`ServerFPS`** — replicated server frame rate for client-side performance monitoring.
* **`RecorderPlayerState`** — tracks which player state recorded a replay, used to select the correct pawn to follow during replay playback. The `OnRecorderPlayerStateChangedEvent` delegate fires when this changes.

The GameState also overrides `AddPlayerState` and `RemovePlayerState` to participate in the modular player tracking flow, and `SeamlessTravelTransitionCheckpoint` to handle seamless travel correctly.

***

### `ALyraWorldSettings`

Each map can specify a default experience in its World Settings. `ALyraWorldSettings` extends `AWorldSettings` with a single meaningful addition: the `DefaultGameplayExperience` property, a soft class pointer to a `ULyraExperienceDefinition`.

This is the simplest way to associate a map with a game mode. Open the map's World Settings, assign an experience definition, and the GameMode will read it as one of its experience selection sources via `GetDefaultGameplayExperience()`. Maps without an assigned experience fall through to other selection sources (URL options, developer settings).

In editor builds, `ForceStandaloneNetMode` lets you mark front-end or standalone levels so they force Standalone net mode when you hit Play, preventing accidental client/server splits during testing. The `CheckForErrors` override validates the World Settings configuration during map checks.

***

### `ULyraGameInstance`

Minimal. `ULyraGameInstance` inherits from `UCommonGameInstance` (from the CommonGame plugin) and provides the game instance lifecycle. It offers `GetPrimaryPlayerController()` for quick access to the first local player's controller, handles `CanJoinRequestedSession()` for online session flow, and manages user initialization through `HandlerUserInitialized()`.

The GameInstance also handles network encryption handshakes (`ReceivedNetworkEncryptionToken`, `ReceivedNetworkEncryptionAck`) and pre-client-travel URL manipulation. Most game-level functionality lives on the GameState or in subsystems rather than here.

***

### `ALyraGameSession`

`ALyraGameSession` inherits from `AGameSession` and handles online session management. It overrides `ProcessAutoLogin` to disable the default auto-login behavior, and provides `HandleMatchHasStarted` / `HandleMatchHasEnded` hooks for session lifecycle events. The class is intentionally thin, it integrates with the framework's player initialization flow without adding significant custom logic.
