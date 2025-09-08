# Team Creation & Assignment

While the `ULyraTeamSubsystem` manages team information at runtime, the `ULyraTeamCreationComponent` is typically responsible for the **initial setup** of teams and the **assignment of players** to those teams when a game session begins. It's a `UGameStateComponent`, usually added dynamically to the `ALyraGameState` by a Game Feature Action associated with a team-based `ULyraExperienceDefinition`.

### Role and Purpose

* **Initial Team Spawning:** Reads configuration data and spawns the necessary `ALyraTeamInfoBase` (Public and Private) actors for each defined team at the start of the match.
* **Initial Player Assignment:** Assigns newly joining players (and players already present when the component activates) to teams based on defined logic (e.g., balancing, specific rules).
* **Team Visual Setup:** Assigns the appropriate `ULyraTeamDisplayAsset` to each created team's public info actor.
* **Perspective Color Setup:** Configures the `ULyraTeamSubsystem` with the Ally/Enemy perspective display assets and enables/disables the perspective color mode based on its settings.
* **Asymmetric Team Setup:** Allows assigning different `ULyraPawnData` assets to different teams, enabling asymmetric gameplay modes where teams might have different starting characters or abilities.

### Configuration

This component is configured primarily through its properties, usually set within a Blueprint subclass or directly if added via a Game Feature Action's defaults.

<img src=".gitbook/assets/image (22) (1).png" alt="" title="Setting up two teams with perspective colour mode on">

* **`PerspectiveColorConfig` (`FLyraPerspectiveColorConfig`)**:
  * `bPerspectiveColorMode` (`bool`): If true, enables the Ally/Enemy color override system in the `ULyraTeamSubsystem`.
  * `AllyTeamDisplayAsset` (`TObjectPtr<ULyraTeamDisplayAsset>`): The display asset used for teammates when perspective mode is active.
  * `EnemyTeamDisplayAsset` (`TObjectPtr<ULyraTeamDisplayAsset>`): The display asset used for opponents when perspective mode is active.
* **`TeamsToCreate` (`TMap<uint8, TObjectPtr<ULyraTeamDisplayAsset>>`)**:
  * Defines the teams to be created for this experience.
  * **Key (`uint8`):** The integer Team ID to create (e.g., 0, 1).
  * **Value (`TObjectPtr<ULyraTeamDisplayAsset>`):** The display asset to associate with this team ID. Can be null if no specific visuals are needed initially.
* **`TeamPawnData` (`TMap<uint8, TObjectPtr<ULyraPawnData>>`)**:
  * Optional map to assign specific `ULyraPawnData` to players based on their assigned team ID.
  * **Key (`uint8`):** The Team ID.
  * **Value (`TObjectPtr<ULyraPawnData>`):** The Pawn Data asset players on this team should use by default. If a team ID is not present in this map, players assigned to that team will use the `DefaultPawnData` from the `ULyraExperienceDefinition`.
  * For more information on `ULyraPawnData`, see the [dedicated documentation page](../gameframework-and-experience/experience-primary-assets/lyrapawndata.md).
* **`PublicTeamInfoClass` / `PrivateTeamInfoClass` (`TSubclassOf<...>`)**:
  * Specifies the exact classes to spawn for the team representation actors (defaults to `ALyraTeamPublicInfo` and `ALyraTeamPrivateInfo`). Allows customization if needed.

### Runtime Execution Flow (Server-Side Focus)

The component leverages the Experience loading lifecycle.

1. **Activation (`BeginPlay` & `OnExperienceLoaded`):**
   * The component is typically added to the `ALyraGameState` by a `UGameFeatureAction_AddComponents`.
   * Its `BeginPlay` registers a high-priority callback (`OnExperienceLoaded`) with the `ULyraExperienceManagerComponent`.
   * When the Experience finishes loading, `OnExperienceLoaded` is called.
2. **`OnExperienceLoaded` (Server Authority):**
   * Calls `ServerCreateTeams()`:
     * Iterates through the `TeamsToCreate` map.
     * For each entry (TeamID, DisplayAsset), calls `ServerCreateTeam()`.
       * **`ServerCreateTeam`:** Spawns instances of `PublicTeamInfoClass` and `PrivateTeamInfoClass`, sets their `TeamId` using the private `SetTeamId` function, and sets the `DisplayAsset` on the public info actor using `SetTeamDisplayAsset`. These actors then automatically register with the `ULyraTeamSubsystem`.
   * Calls `ServerAssignPlayersToTeams()`:
     * Assigns teams to players already connected using `ServerChooseTeamForPlayer`.
     * Subscribes to the `ALyraGameMode::OnGameModePlayerInitialized` delegate to handle players who join _after_ this point.
   * **(Client & Server):** Configures the `ULyraTeamSubsystem`'s perspective color mode and registers the Ally/Enemy display assets using the `PerspectiveColorConfig` data.
3. **`OnPlayerInitialized` (Server Authority):**
   * Callback executed when `ALyraGameMode` finishes initializing a new player controller (after `BeginPlay` and Experience load).
   * Gets the associated `ALyraPlayerState`.
   * Calls `ServerChooseTeamForPlayer(LyraPS)`.
   * Broadcasts its own `OnPlayerTeamAssigned` delegate.
4. **`ServerChooseTeamForPlayer(ALyraPlayerState* PS)` (Server Authority):**
   * **Spectator Check:** If `PS->IsOnlyASpectator()`, sets their team ID to `NoTeam`.
   * **Assign Team:** Otherwise, calls the virtual function `ServerAssignPlayerTeam()` to get the desired Team ID for this player.
   * Sets the player's team using `PS->SetGenericTeamId()`.
   * **Apply Team Pawn Data:** Checks the `TeamPawnData` map. If an entry exists for the assigned Team ID, it calls `PS->SetPawnData()` to assign the specific pawn data for that team. If no entry exists, the player will use the Experience's default pawn data.
5. **`ServerAssignPlayerTeam()` (Virtual, Server Authority):**
   * **Default Logic:** The base implementation calls `GetLeastPopulatedTeamID()` to find the team with the fewest current members (ignoring inactive players) for simple balancing.
   * **Customization Hook:** This is the **primary function to override** in a Blueprint or C++ subclass of `ULyraTeamCreationComponent` if you need custom team assignment logic (e.g., based on squads, player rank, specific game mode rules).
   * Returns the chosen `int32` Team ID.
6. **`GetLeastPopulatedTeamID()` (Helper, Server Authority):**
   * Counts active players on each team defined in `TeamsToCreate`.
   * Returns the ID of the team with the lowest count (breaking ties by lowest ID). Returns `INDEX_NONE` if no teams are defined.

### Use Cases

* **Standard Team Setup:** Configure 2 teams (ID 0, ID 1) with Red/Blue display assets in `TeamsToCreate`. Use the default balancing logic.
* **Asymmetric Modes:** Configure teams and optionally assign different `ULyraPawnData` assets via the `TeamPawnData` map (e.g., Team 0 uses `PawnData_Attackers`, Team 1 uses `PawnData_Defenders`).
* **Custom Assignment:** Subclass `ULyraTeamCreationComponent`, override `ServerAssignPlayerTeam`, and implement logic to assign teams based on party/squad information, player skill, or specific mode requirements.
* **Perspective Colors:** Configure the `PerspectiveColorConfig` to enable Ally/Enemy visuals for competitive clarity.

***

The `ULyraTeamCreationComponent` provides the essential server-side logic for establishing the team structure defined by an Experience. It spawns the necessary actors, assigns initial teams (with default balancing), applies team-specific pawn data if configured, and sets up the visual perspective mode, acting as the bridge between static configuration and the runtime `ULyraTeamSubsystem`. Override `ServerAssignPlayerTeam` for custom assignment rules.
