# Game State

The `ALyraGameState` class, inheriting from `AModularGameStateBase`, serves as the **central replicated container for game-wide state information** accessible to all clients. In this modular framework, its role is expanded beyond simple state replication to become a primary host for crucial manager components, including the system that drives the Experience and Game Feature lifecycle.

### Role and Responsibilities

* **Replicated State Container:** Holds and replicates game state variables that all clients need to be aware of (e.g., elapsed time (inherited), server FPS, potentially game phase, scores, objective status - though complex state is often in components).
* **Host for Manager Components:** Acts as the logical owner and host for key singleton-like manager components responsible for coordinating major systems during the match.
  * **`ULyraExperienceManagerComponent`:** This vital component manages the loading, activation, and deactivation of `ULyraExperienceDefinition`s and their associated Game Features. The Game State provides the stable, replicated actor context needed for this manager.
  * **Other Game Mode Components:** Specific game mode logic (scoring, team management, objective tracking, round timers) is often implemented in `UGameStateComponent` subclasses. These components are typically **added dynamically** to the `ALyraGameState` instance via `UGameFeatureAction_AddComponents` triggered by the loading Experience. This keeps the base `ALyraGameState` clean and makes game mode logic modular.
* **Game-Wide Ability System:** Hosts a `ULyraAbilitySystemComponent` (`AbilitySystemComponent`). This ASC is typically _not_ used for character abilities but rather for triggering **game-wide Gameplay Cues** or applying global Gameplay Effects that aren't tied to a specific pawn.
* **Messaging Hub:** Provides functions (`MulticastMessageToClients`, `MulticastReliableMessageToClients`) for broadcasting `FLyraVerbMessage`s (which wrap a Gameplay Tag and context) to all clients for general notifications (e.g., player join/leave, elimination messages).

### Key Components Hosted

* **`ExperienceManagerComponent` (`ULyraExperienceManagerComponent*`)**:
  * Created in the constructor.
  * Manages the entire lifecycle of the active `ULyraExperienceDefinition` and associated Game Features.
  * **(See Game Features / Activation Flow page for full details)**.
* **`AbilitySystemComponent` (`ULyraAbilitySystemComponent*`)**:
  * Created in the constructor, replicated, and initialized in `PostInitializeComponents`.
  * Implements `IAbilitySystemInterface`.
  * Primarily intended for executing non-targeted, game-wide Gameplay Cues (e.g., match start/end sounds/visuals, global announcements triggered by effects). It generally doesn't own attributes or grant gameplay abilities meant for characters.

### Dynamic Addition of Components

A core aspect of the modular design is that the specific logic for the current game mode often resides in components added _to_ the Game State at runtime.

1. An `ULyraExperienceDefinition` requires a Game Feature (e.g., "CTFMode").
2. That Game Feature includes a `UGameFeatureAction_AddComponents`.
3. That action specifies adding `UCTF_GameStateComponent` to actors of class `ALyraGameState`.
4. When the Experience loads and activates the "CTFMode" feature, the action runs.
5. The `UGameFrameworkComponentManager` ensures that a `UCTF_GameStateComponent` instance is added to the existing `ALyraGameState` instance.
6. This `UCTF_GameStateComponent` now runs its logic (e.g., tracking flag states, scores) within the context of the Game State, replicating its own state as needed.

This pattern keeps the base `ALyraGameState` generic, while specific modes inject their required state and logic components dynamically.

### Key Overrides and Functions

* `PostInitializeComponents`: Initializes the game-wide `AbilitySystemComponent`.
* `GetAbilitySystemComponent()`: Implements `IAbilitySystemInterface`, returning the game-wide `AbilitySystemComponent`.
* `GetLyraAbilitySystemComponent()`: Blueprint-callable version of the above.
* `AddPlayerState` / `RemovePlayerState`: Standard overrides (though `RemovePlayerState` might not always be called depending on the base GameMode class used).
* `SeamlessTravelTransitionCheckpoint`: Used during seamless travel to clean up inactive/bot player states.
* `Tick`: Updates the replicated `ServerFPS` property on the authority.
* `MulticastMessageToClients_Implementation` / `MulticastReliableMessageToClients_Implementation`: Executes on clients, broadcasting the received `FLyraVerbMessage` via the `UGameplayMessageSubsystem`.

### Replicated Properties

* `ServerFPS` (`float`): Average server frame rate.
* `RecorderPlayerState` (`TObjectPtr<APlayerState>`, `COND_ReplayOnly`): Stores a reference to the player state that initiated a replay recording. Used by replay systems to identify the primary viewpoint. Includes an `OnRep_RecorderPlayerState` that broadcasts `OnRecorderPlayerStateChangedEvent`.
* **Inherited:** `PlayerArray`, `ElapsedTime`, etc. from `AGameStateBase`.
* **Dynamically Added Components:** Any replicated properties within components added by Game Feature Actions will also be replicated as part of the Game State.

***

The `ALyraGameState` serves as the replicated backbone of the game session's state and acts as the primary host for the Experience Manager and dynamically added game mode logic components. Its design facilitates the modular, Experience-driven architecture by providing a stable, replicated context for these systems to operate within.
