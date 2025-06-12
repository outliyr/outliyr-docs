# Core Components

The Lag Compensation system relies on two primary components working together: the `ULagCompensationManager` acting as the central orchestrator and the `ULagCompensationSource` marking actors for tracking.

### `ULagCompensationManager` (The Hub)

* **Header:** `LagCompensationManager.h`
* **Parent:** `UGameStateComponent`
* **Location:** Designed to be added as a component to your project's `AGameStateBase`. This central location ensures it exists singleton-like on the server and has easy access to world time and state.
* **Purpose:** Acts as the main interface and manager for the entire lag compensation system on the server.
* **Key Responsibilities:**
  * **Source Management:** Maintains a list (`LagCompensationSources`) of currently active `ULagCompensationSource` components in the world. It listens for registration/unregistration messages (`TAG_Lyra_LagCompensation_Add_Message`, `TAG_Lyra_LagCompensation_Remove_Message`) broadcast via the `UGameplayMessageSubsystem` to keep this list up-to-date. It also broadcasts a discovery message (`TAG_Lyra_LagCompensation_Discover_Message`) upon initialization to catch any sources that might have been created before it.
  * **Thread Ownership:** Creates and manages the lifecycle of the dedicated lag compensation background thread (`FLagCompensationThreadRunnable`). It passes necessary context (like the `UWorld*`) to the thread upon creation and ensures the thread is properly shut down (`EnsureCompletion`) when the manager is destroyed (`EndPlay`).
  * **Request Handling (`RewindLineTrace`):** Provides the public C++ functions (`RewindLineTrace` overload for Latency or Timestamp) that server-side game code calls to request a lag-compensated trace. It takes the trace parameters, creates a request structure (`FRewindLineTraceRequest`), and enqueues it for processing by the background thread.
  * **Asynchronous Results:** Manages the `TPromise`/`TFuture` mechanism to return results from the background thread asynchronously to the calling game thread code.
  * **Tick Synchronization:** In its `TickComponent`, it triggers the `GameTickEvent` semaphore that the background thread waits on. This helps synchronize the background thread's main loop (specifically history updates) with the game thread's tick, preventing excessive drift.
  * **Initialization:** Waits for the Lyra Experience to be loaded (`OnExperienceLoaded`) before fully initializing its listeners and thread (if applicable, i.e., not Standalone) to ensure the game world is in a stable state.
  * **Disabling:** Listens to the `lyra.LagCompensation.DisableLagCompensation` CVar to bypass thread creation and potentially perform synchronous, non-rewound traces if lag compensation is disabled globally.

### `ULagCompensationSource` (The Marker)

* **Header:** `LagCompensationSource.h`
* **Parent:** `UGameFrameworkComponent` (can be added to any `AActor`)
* **Location:** Designed to be added as a component to any `AActor` whose position and collision shapes need to be tracked historically for lag compensation purposes. This is **typically added to player-controlled Pawns** and potentially important AI characters or dynamic objects.
* **Purpose:** Marks an actor as relevant for lag compensation. Its presence signals the system to start recording historical data for its associated mesh's hitboxes.
* **Key Responsibilities:**
  * **Self-Registration:** On `BeginPlay`/`OnExperienceLoaded`, it broadcasts the `TAG_Lyra_LagCompensation_Add_Message` via the `UGameplayMessageSubsystem`, signaling the `ULagCompensationManager` to start tracking it. It also listens for the manager's `TAG_Lyra_LagCompensation_Discover_Message` to register itself if it initializes _before_ the manager.
  * **Self-Unregistration:** On `EndPlay`, it broadcasts the `TAG_Lyra_LagCompensation_Remove_Message`, signaling the `ULagCompensationManager` to stop tracking it and eventually allowing the background thread to clean up its historical data.
  * **Mesh Association:** It attempts to find and cache a pointer to the primary `UMeshComponent` (specifically `UStaticMeshComponent` or `USkeletalMeshComponent`) on its owning Actor. This mesh component is the source from which the lag compensation thread extracts hitbox information (simple collision or physics asset bodies). **It's crucial that the actor has a valid Mesh Component with appropriate collision/physics asset setup for this component to function correctly.**

### Interaction Summary

1. `ULagCompensationSource` components on Actors register themselves with the `ULagCompensationManager` on the GameState.
2. The `ULagCompensationManager` creates and manages the `FLagCompensationThreadRunnable`.
3. The `FLagCompensationThreadRunnable` periodically queries the `ULagCompensationManager` for its list of active `ULagCompensationSource`s.
4. The thread accesses the `MeshComponent` associated with each source to capture and store historical hitbox data (`FLagCompensationData`).
5. Game code requests a rewind trace from the `ULagCompensationManager`.
6. The `ULagCompensationManager` queues the request for the `FLagCompensationThreadRunnable`.
7. The thread processes the request using its stored historical data and returns the result asynchronously via a `TFuture`.

These two components form the backbone of the system's architecture on the game thread side, enabling the selective tracking and management necessary for the background thread to perform its work efficiently.

***
