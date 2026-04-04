# Team Setup

Setting up teams starts with a single component on the game state. The `ULyraTeamCreationComponent` is added as part of your Experience definition, and it carries all the configuration needed to describe which teams exist, how they look, and how players get assigned. Once the experience finishes loading, the component takes over and builds the team infrastructure automatically.

### The Creation Component

`ULyraTeamCreationComponent` inherits from `UGameStateComponent`, so it lives on the game state and participates in the experience lifecycle. You configure it in the Experience's action set or directly on a game state Blueprint. Its properties define the shape of your team setup:

| Property                 | Type                                  | Purpose                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TeamsToCreate`          | `TMap<uint8, ULyraTeamDisplayAsset*>` | Each entry creates a team. The key is the Team ID, the value is the display asset that defines that team's visual identity (colors, textures, scalars). The display asset can be left null if you only need the team ID. |
| `TeamPawnData`           | `TMap<uint8, ULyraPawnData*>`         | Optional. Maps Team IDs to pawn configurations for asymmetric modes. When populated, players on different teams spawn with different pawns.                                                                              |
| `PerspectiveColorConfig` | `FLyraPerspectiveColorConfig`         | Controls whether team colors are absolute or relative to the viewer. Contains `bPerspectiveColorMode`, `AllyTeamDisplayAsset`, and `EnemyTeamDisplayAsset`.                                                              |
| `PublicTeamInfoClass`    | `TSubclassOf<ALyraTeamPublicInfo>`    | The actor class spawned for each team's public (replicated-to-all) info. Defaults to `ALyraTeamPublicInfo`.                                                                                                              |
| `PrivateTeamInfoClass`   | `TSubclassOf<ALyraTeamPrivateInfo>`   | The actor class spawned for each team's private (replicated-to-team-only) info. Defaults to `ALyraTeamPrivateInfo`.                                                                                                      |

For most game modes, you only touch `TeamsToCreate` and possibly `PerspectiveColorConfig`. The info class overrides exist for cases where you need custom replicated state on the team actors themselves.

<img src=".gitbook/assets/image (19).png" alt="" title="Simple example of a two team setup">

### The Creation Flow

When the experience finishes loading, the component's `OnExperienceLoaded` callback fires. On the server, this triggers the full team creation sequence. On all machines (server and clients alike), it registers the perspective color configuration with the team subsystem.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Experience loads**

`BeginPlay` registers with the experience manager's high-priority load callback. When the experience is ready, `OnExperienceLoaded` fires.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Server creates teams**

`ServerCreateTeams()` iterates `TeamsToCreate`. For each entry, `ServerCreateTeam()` spawns two actors: a public info actor (using `PublicTeamInfoClass`) and a private info actor (using `PrivateTeamInfoClass`). The public info actor receives the team ID and the display asset. The private info actor receives the team ID. Both actors register themselves with the `ULyraTeamSubsystem` on `BeginPlay`.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Server assigns existing players**

`ServerAssignPlayersToTeams()` walks every player state in `GameState->PlayerArray`. Any player without a team gets assigned via `ServerChooseTeamForPlayer()`. Players who already have a team (e.g., from a previous round) are skipped.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Late joiner subscription**

The component binds to `ALyraGameMode::OnGameModePlayerInitialized`, a delegate that fires whenever a new player fully initializes. When it fires, `OnPlayerInitialized` calls `ServerChooseTeamForPlayer()` for the new player and then broadcasts `OnPlayerTeamAssigned`.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Perspective color registration**

On all machines, the component registers the perspective display assets with the subsystem. If `bPerspectiveColorMode` is enabled, it calls `RegisterPerspectiveDisplayAsset` for both the ally and enemy assets, then `SetPerspectiveColourMode(true)`. If disabled, it just calls `SetPerspectiveColourMode(false)` so the subsystem knows perspective mode was explicitly configured.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

### Player Assignment

The assignment path has two layers. `ServerChooseTeamForPlayer()` is the entry point, but the actual team selection is delegated to `ServerAssignPlayerTeam()`, a `BlueprintNativeEvent` that you can override.

`ServerChooseTeamForPlayer()` first checks whether the player is a spectator. Spectators get `FGenericTeamId::NoTeam` and skip further assignment. For everyone else, it calls `ServerAssignPlayerTeam()` to get the target team ID, sets the generic team ID on the player state, and then checks `TeamPawnData` to see if that team has a dedicated pawn configuration. If it does, the component calls `SetPawnData()` on the player state to override the default pawn.

The default implementation of `ServerAssignPlayerTeam()` calls `GetLeastPopulatedTeamID()` with empty include and exclude sets, which simply returns the team with the fewest active, non-inactive players. When counts are tied, the lower team ID wins.

<details class="gb-toggle">

<summary>Custom Assignment</summary>

Override `ServerAssignPlayerTeam` in a Blueprint or C++ subclass to implement your own logic. The function receives the `ALyraPlayerState` and returns the desired team ID as an `int32`. Some examples:

* **Party-based**: Look up the player's party and assign them to the same team as their party leader.
* **Player-picked**: Read a team preference from the player state (set during lobby) and honor it if the team isn't full.
* **Skill-based**: Query an MMR value and distribute players to balance team strength rather than team size.

`GetLeastPopulatedTeamID()` is available as a helper even in custom implementations. It accepts `IncludedTeams` and `ExcludedTeams` sets, so you can constrain the balancing to a subset of teams.

<img src=".gitbook/assets/image (22).png" alt="" title="Example that splitting AI into different teams, but keeps all players on the same team">

</details>

After assignment completes (whether from initial assignment or a late joiner), the `OnPlayerTeamAssigned` delegate broadcasts with the assigned controller. Bind to this for post-assignment logic like spawning team-specific UI or sending a welcome message.

### Perspective Colors

Standard team coloring assigns each team a fixed display asset: Team 1 is always blue, Team 2 is always red. This works for spectators and broadcasts, but in first-person competitive modes, players expect their own team to always appear as the "friendly" color regardless of which team they actually joined.

Perspective mode solves this. Instead of asking "what color is Team 1?", the system asks "is this team my ally or my enemy?" and returns the appropriate display asset.

Configure the `PerspectiveColorConfig` struct on the creation component:

| Field                   | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `bPerspectiveColorMode` | Enables or disables perspective-based color resolution.                          |
| `AllyTeamDisplayAsset`  | The display asset returned when the queried team matches the viewer's team.      |
| `EnemyTeamDisplayAsset` | The display asset returned when the queried team differs from the viewer's team. |

When enabled, `GetEffectiveTeamDisplayAsset()` on the subsystem compares the queried team ID against the viewer's team ID. If they match, it returns the ally asset. If they differ, it returns the enemy asset. If perspective mode is off, it falls back to the team's actual display asset from `GetTeamDisplayAsset()`.

The perspective assets are registered with special internal IDs (`PERSPECTIVE_ALLY_ID` and `PERSPECTIVE_ENEMY_ID`) on the subsystem, kept separate from real team entries. This means they don't interfere with team enumeration or tag stacks.

### Asymmetric Modes

The `TeamPawnData` map enables asymmetric game modes where teams have fundamentally different gameplay. One team spawns as soldiers with shooter pawn data, another spawns as creatures with melee pawn data. Each entry maps a team ID to a `ULyraPawnData` asset.

During initial assignment, `ServerChooseTeamForPlayer()` checks this map after setting the team ID. If an entry exists for the player's team, `SetPawnData()` is called on the player state, overriding whatever pawn data the experience would normally provide.

Two runtime functions support dynamic changes:

* `SetTeamPawnData(TeamId, NewPawnData, bApplyToExistingPlayers)` updates the map entry for a team at runtime. When `bApplyToExistingPlayers` is true (the default), it iterates all current players on that team and calls `ApplyTeamPawnDataToPlayer()` on each.
* `ApplyTeamPawnDataToPlayer(PS)` looks up the player's current team in the `TeamPawnData` map and calls `SetPawnData()` if a mapping exists.

> [!INFO]
> The creation component's `TeamPawnData` only applies during initial team assignment. If a player changes teams at runtime via `ChangeTeamForActor()`, the subsystem's implementation calls `ApplyTeamPawnDataToPlayer()` automatically, so the player gets the correct pawn data for their new team.

<img src=".gitbook/assets/image (21).png" alt="" title="Asymmetric Prop Hunt Example, where the two teams have different pawn sets hence abilities, inputs, UI and characters">
