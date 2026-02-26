# Team Identification

At its most fundamental level, the Team System identifies distinct teams using simple **integer IDs**. However, to represent the existence and shared state of these teams within the networked game world, replicated **`AInfo` actors** derived from `ALyraTeamInfoBase` are used.

### Team IDs

* **Representation:** A standard `int32`.
* **Valid Range:** By convention, valid Team IDs are typically small, non-negative integers (e.g., 0, 1, 2...). The specific range depends on the game mode configuration.
* **No Team:** The value `INDEX_NONE` (-1) is universally used to signify that an actor or entity does **not** belong to any team.
* **`FGenericTeamId` Compatibility:** Unreal Engine's AI Perception system uses the `FGenericTeamId` struct (which is essentially a `uint8`). This team system provides helper functions (`GenericTeamIdToInteger`, `IntegerToGenericTeamId`) within the `ILyraTeamAgentInterface` header to convert seamlessly between the `int32` Team IDs used here and the `FGenericTeamId` used by the engine interface. `FGenericTeamId::NoTeam` (value 255) corresponds to `INDEX_NONE`.

### `ALyraTeamInfoBase` Actor

This `abstract` class serves as the base for replicated actors that represent a team within the world. It's not intended to be used directly but rather subclassed (like `ALyraTeamPublicInfo` and `ALyraTeamPrivateInfo`).

**Role and Purpose:**

* **World Presence:** Provides a networked actor representing the team, allowing team-wide state to be replicated.
* **Registration Anchor:** Acts as the object that registers a specific `TeamId` with the `ULyraTeamSubsystem`.
* **State Container:** Holds shared, replicated team data.

**Key Properties & Logic:**

* **`TeamId` (`int32`, Replicated `COND_InitialOnly`)**:
  * Stores the unique integer ID assigned to this team.
  * Set **once** on the server by the `ULyraTeamCreationComponent` via the private `SetTeamId` function.
  * Replicated only during initial spawn (`COND_InitialOnly`) as team IDs are generally static for the duration of a match.
  * The `OnRep_TeamId` function calls `TryRegisterWithTeamSubsystem` on clients to ensure they also register the info actor upon receiving the replicated ID.
* **`TeamTags` (`FGameplayTagStackContainer`, Replicated)**:
  * A replicated container allowing game modes or systems to associate Gameplay Tag stacks with the entire team.
  * **Use Cases:** Tracking team-wide states (e.g., `Team.State.HasFlag`, `Team.Buff.MoraleHigh`), counting team resources, or applying team-wide Gameplay Effects targeted via tags.
  * Managed via functions on the `ULyraTeamSubsystem` (`AddTeamTagStack`, `RemoveTeamTagStack`, `GetTeamTagStackCount`, `TeamHasTag`), which find the appropriate `ALyraTeamInfoBase` actor and modify its `TeamTags` container (authority only for modifications).
* **Replication Settings:** Configured to be replicated (`bReplicates = true`), always relevant (`bAlwaysRelevant = true`), and with a high network priority (`NetPriority = 3.0f`) to ensure team information is reliably distributed. Movement replication is disabled.
* **Registration Logic (`BeginPlay`, `EndPlay`, `TryRegisterWithTeamSubsystem`, `RegisterWithTeamSubsystem`):**
  * On `BeginPlay` (and in `OnRep_TeamId`), it calls `TryRegisterWithTeamSubsystem`.
  * `TryRegisterWithTeamSubsystem` checks if `TeamId` is valid (not `INDEX_NONE`) and then calls the virtual `RegisterWithTeamSubsystem`, passing the world's `ULyraTeamSubsystem`.
  * The base `RegisterWithTeamSubsystem` calls `Subsystem->RegisterTeamInfo(this)`. Subclasses could potentially override this for custom registration behavior.
  * On `EndPlay`, if a valid `TeamId` was assigned, it calls `Subsystem->UnregisterTeamInfo(this)` to remove itself from the subsystem's registry.

### Subclasses: Public vs. Private Info

The base class is subclassed to potentially separate replicated information based on visibility requirements:

* **`ALyraTeamPublicInfo`:**
  * Intended to hold information replicated to **all** clients.
  * Crucially holds the `TeamDisplayAsset` (`TObjectPtr<ULyraTeamDisplayAsset>`, replicated `COND_InitialOnly`) which defines the team's visual appearance.
  * Has `SetTeamDisplayAsset` (authority only) and `OnRep_TeamDisplayAsset`.
* **`ALyraTeamPrivateInfo`:**
  * Intended for information replicated **only to members of the same team**.
  * The comment `//@TODO: Actually make private (using replication graph)` indicates that the full private replication logic might require further implementation using Unreal's Replication Graph system to filter replication based on team membership. By default, it likely replicates similarly to the public info without specific filtering.

**Runtime Structure:** Typically, for each Team ID created by the `ULyraTeamCreationComponent`, _both_ a `ALyraTeamPublicInfo` and an `ALyraTeamPrivateInfo` actor are spawned and assigned the same `TeamId`. The `ULyraTeamSubsystem` stores pointers to both in its internal `FLyraTeamTrackingInfo` struct for that Team ID.

***

Team IDs provide the simple numerical identification, while the `ALyraTeamInfoBase` derived actors provide the replicated world presence and state storage (like Team Tags and Display Assets) necessary for the team system to function within the networked environment. These actors act as the registration point and data source queried by the `ULyraTeamSubsystem`.
