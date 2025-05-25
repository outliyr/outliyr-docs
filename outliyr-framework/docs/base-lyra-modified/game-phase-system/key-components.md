# Key Components

The Lyra Game Phase System relies on two primary C++ classes working in tandem: the `ULyraGamePhaseSubsystem` acts as the central manager, while instances of `ULyraGamePhaseAbility` represent the active phases themselves.

### `ULyraGamePhaseSubsystem`

This class is the brain of the operation, responsible for tracking the game's current phase(s) and orchestrating transitions.

* **Role:** Central manager and orchestrator of game phases.
* **Type:** It's implemented as a `UWorldSubsystem`. This means an instance of this subsystem is automatically created for each active game world (including PIE worlds, though phase logic is typically server-authoritative). You can access it from any `UObject` that has access to a `UWorld` pointer using `UWorld::GetSubsystem<ULyraGamePhaseSubsystem>(World)`.
* **Key Responsibilities:**
  * **Tracking Active Phases:** Maintains an internal map (`ActivePhaseMap`) linking active `FGameplayAbilitySpecHandle` instances (representing running phase abilities) to their corresponding `GamePhaseTag` and any registered end callbacks.
  * **Initiating Transitions:** Provides the `StartPhase` function (and its Blueprint equivalent `K2_StartPhase`) which is the primary way to request a change to a new phase.
  * **Enforcing Hierarchy Logic:** Implements the core cancellation rule within its `OnBeginPhase` method. When a phase starts, this method checks the `GamePhaseTag` hierarchy against currently active phases and cancels non-ancestor phases.
  * **Managing Observers:** Stores lists (`PhaseStartObservers`, `PhaseEndObservers`) of registered delegates that should be notified when specific phases start or end.
* **Execution Context:** While the subsystem exists on both client and server, the core logic for starting phases and enforcing transitions (`StartPhase`, `OnBeginPhase`, `OnEndPhase`) is designed to run on the **server/authority**, as game state progression is typically server-controlled. Functions like `IsPhaseActive` might be callable on clients if phase state were replicated, but the default implementation focuses on server-side management. Observer notifications triggered by server-side phase changes also occur on the server.
* **Key Functions Overview (Detailed in later pages):**
  * `StartPhase`: Initiates a transition to a new phase by activating its corresponding ability.
  * `IsPhaseActive`: Checks if any active phase matches the provided tag.
  * `WhenPhaseStartsOrIsActive`: Registers a delegate to be called when a matching phase starts, or immediately if already active.
  * `WhenPhaseEnds`: Registers a delegate to be called when a matching phase ends.
  * `OnBeginPhase` / `OnEndPhase`: Internal callbacks triggered by `ULyraGamePhaseAbility` instances.

### `ULyraGamePhaseAbility`

This class serves as the blueprint for any ability that represents a specific game phase. You don't use this class directly; instead, you create subclasses for each distinct phase in your game.

* **Role:** Represents the state of _being in_ a specific game phase. Its activation and duration correspond to the duration of the phase itself.
* **Type:** Inherits from `ULyraGameplayAbility`.
* **Key Property: `GamePhaseTag` (FGameplayTag):**
  * This is the **single most critical property** to configure on your `ULyraGamePhaseAbility` subclasses.
  * **Purpose:** You **must** set this in the ability's Class Defaults to the specific, unique Gameplay Tag that identifies the phase this ability represents (e.g., `GamePhase.Playing`, `GamePhase.Warmup`).
  * **Usage:** The `ULyraGamePhaseSubsystem` reads this tag via `GetGamePhaseTag()` during `OnBeginPhase` and `OnEndPhase` to perform hierarchy checks and notify the correct observers.
* **Lifecycle Integration Hooks:**
  * **`ActivateAbility`:** Overridden to call `PhaseSubsystem->OnBeginPhase(this, Handle)` on the authority. This notifies the subsystem that this phase is starting, triggering the hierarchy check and cancellation logic for other phases.
  * **`EndAbility`:** Overridden to call `PhaseSubsystem->OnEndPhase(this, Handle)` on the authority. This notifies the subsystem that this phase has ended (either naturally or because it was cancelled by the subsystem), allowing it to clean up tracking and notify end observers.
* **Typical Configuration (Class Defaults):**
  * **`ReplicationPolicy`:** `ReplicateNo`. The ability activation itself doesn't usually need to replicate; the _consequences_ of the phase change (handled by other systems observing the phase) might involve replication.
  * **`InstancingPolicy`:** `InstancedPerActor`. Each active phase needs its own instance running on the GameState's ASC.
  * **`NetExecutionPolicy`:** `ServerInitiated`. Phase changes are typically initiated by server logic.
  * **`NetSecurityPolicy`:** `ServerOnly`. Ensures only the server can activate these authoritative abilities.
* **Subclassing:** For each phase in your game (e.g., Setup, Playing, RoundOver), you will create a new Blueprint or C++ class inheriting from `ULyraGamePhaseAbility` and set its unique `GamePhaseTag`. Often, these subclasses require no additional logic beyond setting the tag, as the core transition management is handled by the base class and the subsystem.

Together, the `ULyraGamePhaseSubsystem` provides the management framework, while instances of `ULyraGamePhaseAbility` subclasses (defined by their unique `GamePhaseTag`) represent the nodes within your game's state flow, interacting with the subsystem via their activation and deactivation.

***
