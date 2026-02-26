# Core Concepts - Deep Dive

Before diving into the managers and setup components, it's essential to understand the core building blocks that represent teams and team affiliation within the system. These concepts define how teams are identified, how actors belong to them, and how their visual identity is managed.

### Key Building Blocks

1. **Team Identification (Team IDs):**
   * At its simplest, a team is represented by an **integer ID**.
   * By convention, valid Team IDs are usually small, non-negative integers (0, 1, 2...).
   * The value `INDEX_NONE` (-1) is reserved to indicate **no team affiliation**.
   * The engine also uses `FGenericTeamId`, primarily for AI perception. This system provides helpers (`GenericTeamIdToInteger`, `IntegerToGenericTeamId`) to convert between the integer ID used predominantly in this system and the engine's `FGenericTeamId` struct.
2. **Team Representation (`ALyraTeamInfoBase` Actors):**
   * While a simple ID identifies a team, replicated **`AInfo` actors** derived from `ALyraTeamInfoBase` represent the _existence_ and _shared state_ of a team within the game world.
   * These actors are spawned by the `ULyraTeamCreationComponent` (one set per team) and register themselves with the `ULyraTeamSubsystem`.
   * They typically hold team-wide replicated data, like:
     * `TeamTags`: A `FGameplayTagStackContainer` for storing team-level state or flags.&#x20;
     * Display Assets (on the `ALyraTeamPublicInfo` subclass).
   * Splitting into `ALyraTeamPublicInfo` and `ALyraTeamPrivateInfo` allows for potential future separation of publicly visible vs. privately replicated team data (though the current implementation primarily uses the public variant).
3. **Team Membership (`ILyraTeamAgentInterface`):**
   * Actors that can _belong_ to a team (like `ALyraPlayerState`, potentially Pawns or Controllers) implement the `ILyraTeamAgentInterface`.
   * This interface (which extends the engine's `IGenericTeamAgentInterface`) provides the standard functions `SetGenericTeamId(FGenericTeamId ID)` and `GetGenericTeamId() const`.
   * It also defines the `FOnLyraTeamIndexChangedDelegate` delegate, allowing other systems to directly listen for team changes _on a specific actor_.
4. **Team Visuals (`ULyraTeamDisplayAsset`):**
   * A **Data Asset** defining the visual identity of a team or perspective (Ally/Enemy).
   * Contains configurable maps for scalar parameters, color parameters, and texture parameters, along with a short display name.
   * Includes helper functions (`ApplyToMaterial`, `ApplyToMeshComponent`, etc.) to easily apply these parameters to various components at runtime.

### How They Fit Together

* The `ULyraTeamCreationComponent` spawns `ALyraTeamInfoBase` actors based on configuration, assigning them unique **Team IDs**.
* These Team Info actors register with the `ULyraTeamSubsystem`, making the team "exist" within the subsystem's registry.
* The `ULyraTeamCreationComponent` assigns a **Team ID** to actors implementing the **`ILyraTeamAgentInterface`**.
* Gameplay systems query the **`ULyraTeamSubsystem`** using an actor reference. The subsystem uses the **Team Agent Interface** to find the actor's **Team ID**.
* The subsystem then uses the **Team ID** to look up the corresponding **`ALyraTeamInfoBase`** actor (specifically the Public info) to retrieve the associated **`ULyraTeamDisplayAsset`**.
* Visual systems then use the **Team Display Asset** to apply colors and textures.

### Structure of this Section

The following sub-pages provide detailed explanations of each core concept:

* **Team Identification (`ALyraTeamInfoBase`, Team IDs):** Covers Team IDs and the role of the replicated Team Info actors.
* **Team Agent Interface (`ILyraTeamAgentInterface`):** Details how actors declare their team membership.
* **Team Display Assets (`ULyraTeamDisplayAsset`):** Explains how to configure and apply team visuals.

***

This overview introduces the fundamental elements used to define and manage teams within the game. Understanding these core concepts – IDs, Info Actors, the Agent Interface, and Display Assets – is essential before exploring how the Team Subsystem and Creation Component utilize them to orchestrate team-based gameplay.
