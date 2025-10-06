# Initialization & Registration

The `ULyraTeamSubsystem` needs to be initialized correctly when the game world starts and requires `ALyraTeamInfoBase` actors (representing the teams) to register themselves so the subsystem can track them.

### Subsystem Initialization

* **Inheritance:** `ULyraTeamSubsystem` inherits from `UWorldSubsystem`. Instances of world subsystems are automatically created by the engine for each active `UWorld` instance (including PIE worlds).
* **`Initialize(FSubsystemCollectionBase& Collection)`:**
  * Called automatically by the engine when the subsystem is created for a world.
  * Calls `Super::Initialize()`.
  * **Cheat Manager Hook:** Registers a delegate (`CheatManagerRegistrationHandle`) with `UCheatManager::RegisterForOnCheatManagerCreated`. This delegate (`AddTeamCheats`) adds the `ULyraTeamCheats` extension to the cheat manager when it's created, making team-related cheats available.
* **`Deinitialize()`:**
  * Called automatically when the world is destroyed or the subsystem is shut down.
  * Unregisters the cheat manager delegate (`UCheatManager::UnregisterFromOnCheatManagerCreated`).
  * Calls `Super::Deinitialize()`.

### Team Info Actor Registration

The core mechanism for the subsystem to become aware of active teams relies on the `ALyraTeamInfoBase` actors registering themselves.

* **Triggering Registration:**
  * `ALyraTeamInfoBase::BeginPlay()` calls `TryRegisterWithTeamSubsystem()`.
  * `ALyraTeamInfoBase::OnRep_TeamId()` also calls `TryRegisterWithTeamSubsystem()` on clients when the `TeamId` (which is replicated `COND_InitialOnly`) is received.
* **`ALyraTeamInfoBase::TryRegisterWithTeamSubsystem()`:**
  * Checks if the actor has a valid `TeamId` (not `INDEX_NONE`). Team IDs are assigned authoritatively by the `ULyraTeamCreationComponent` shortly after spawning the Team Info actor.
  * Gets the `ULyraTeamSubsystem` for the current world.
  * Calls the virtual function `RegisterWithTeamSubsystem(Subsystem)`.
* **`ALyraTeamInfoBase::RegisterWithTeamSubsystem(ULyraTeamSubsystem* Subsystem)`:**
  * The base implementation simply calls `Subsystem->RegisterTeamInfo(this)`. Subclasses could override this for more complex registration if needed.
* **`ULyraTeamSubsystem::RegisterTeamInfo(ALyraTeamInfoBase* TeamInfo)`:**
  * **Duplicate Level Check:** Performs a check to avoid registration attempts from actors potentially existing in dynamically duplicated levels (e.g., during seamless travel transitions before the old level is fully gone), returning `false` if detected.
  * Validates the input `TeamInfo` and its `TeamId`.
  * Finds or adds an entry (`FLyraTeamTrackingInfo`) in the internal `TeamMap` using the `TeamId` as the key.
  * Calls `Entry.SetTeamInfo(TeamInfo)` on the tracking struct.
    * **`FLyraTeamTrackingInfo::SetTeamInfo`:** This function updates the `PublicInfo` or `PrivateInfo` pointer within the tracking struct based on the type of `TeamInfo` being registered. Crucially, if it's setting the `PublicInfo` and the associated `TeamDisplayAsset` changes as a result, it broadcasts the `OnTeamDisplayAssetChanged` delegate for that specific team.
  * Returns `true` if registration was successful.

### Team Info Actor Unregistration

* **Triggering Unregistration:**
  * `ALyraTeamInfoBase::EndPlay()` is called when the Team Info actor is being destroyed (e.g., end of match, level change).
* **`ALyraTeamInfoBase::EndPlay()`:**
  * Checks if it has a valid `TeamId`.
  * Gets the `ULyraTeamSubsystem`.
  * Calls `Subsystem->UnregisterTeamInfo(this)`.
* **`ULyraTeamSubsystem::UnregisterTeamInfo(ALyraTeamInfoBase* TeamInfo)`:**
  * Performs the duplicate level check.
  * Validates the input `TeamInfo` and its `TeamId`.
  * Finds the `FLyraTeamTrackingInfo` entry in the `TeamMap` using the `TeamId`.
  * If found, calls `Entry.RemoveTeamInfo(TeamInfo)` on the tracking struct.
    * **`FLyraTeamTrackingInfo::RemoveTeamInfo`:** Sets the corresponding `PublicInfo` or `PrivateInfo` pointer within the tracking struct back to `nullptr`. _Note: It does not currently remove the entry from the `TeamMap` entirely if both pointers become null, though this might be a potential area for refinement if teams could be dynamically destroyed mid-match._
  * Returns `true` if unregistration was successful.

### Summary

The initialization process relies on the engine automatically creating the `ULyraTeamSubsystem`. Team awareness is built dynamically as `ALyraTeamInfoBase` actors (spawned typically by `ULyraTeamCreationComponent`) register themselves with the subsystem during their `BeginPlay` lifecycle, providing the necessary information (like Team ID and associated Display Assets) for the subsystem to manage and respond to queries. Proper unregistration during `EndPlay` ensures the subsystem doesn't hold onto stale references.
