# Team Setup

Setting up teams starts with a single component on the game state. The `ULyraTeamCreationComponent` is added as part of your Experience definition, and it carries all the configuration needed to describe which teams exist, how they look, and how players get assigned. Once the experience finishes loading, the component takes over and builds the team infrastructure automatically.

## The Creation Component

`ULyraTeamCreationComponent` inherits from `UGameStateComponent`, so it lives on the game state and participates in the experience lifecycle. You configure it in the Experience's action set or directly on a game state Blueprint. Its properties define the shape of your team setup:

| Property                 | Type                                | Purpose                                                                                                                                                                                                   |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthoredTeams`          | `TMap<uint8, FLyraTeamSetupEntry>`  | Teams authored individually by ID. Each entry carries the team's display asset and, for asymmetric modes, its pawn data. Both can be left unset if you only need the team ID.                             |
| `FirstTeamId`            | `int32`                             | The first team ID the component hands out. The fill range numbers up from here. Defaults to 1.                                                                                                            |
| `FillToTeamCount`        | `int32`                             | Total team count to reach across the ID range starting at `FirstTeamId`. Any ID in that range not claimed by an authored entry is created automatically. Leave at zero to create only the authored teams. |
| `FillDisplayAsset`       | `ULyraTeamDisplayAsset*`            | The display asset shared by every fill-created team. May be left unset.                                                                                                                                   |
| `PerspectiveColorConfig` | `FLyraPerspectiveColorConfig`       | Controls whether team colors are absolute or relative to the viewer. Contains `bPerspectiveColorMode`, `AllyTeamDisplayAsset`, and `EnemyTeamDisplayAsset`.                                               |
| `PublicTeamInfoClass`    | `TSubclassOf<ALyraTeamPublicInfo>`  | The actor class spawned for each team's public (replicated-to-all) info. Defaults to `ALyraTeamPublicInfo`.                                                                                               |
| `PrivateTeamInfoClass`   | `TSubclassOf<ALyraTeamPrivateInfo>` | The actor class spawned for each team's private (replicated-to-team-only) info. Defaults to `ALyraTeamPrivateInfo`.                                                                                       |

The roster is described in two parts. `AuthoredTeams` is for teams that need individual identity: their own colors, or their own pawn data in an asymmetric mode. A classic two-team mode authors teams 1 and 2 and stops there. `FillToTeamCount` is for large symmetric rosters where authoring every team by hand would be busywork: a battle royale with sixty solo players sets it to 60 and lets every team share `FillDisplayAsset`. The two combine, authored entries claim their IDs and the fill creates whatever else the range needs, so a mode can hand-author one special team and generate the rest.

<figure><img src="../../.gitbook/assets/Screenshot 2026-07-18 150322.png" alt=""><figcaption><p>Simple example of a two team setup</p></figcaption></figure>

<figure><img src="../../.gitbook/assets/Screenshot 2026-07-18 150428.png" alt=""><figcaption><p>Creating 60 teams for BR solos</p></figcaption></figure>

### The Creation Flow

When the experience finishes loading, the component's `OnExperienceLoaded` callback fires. On the server, this triggers the full team creation sequence. On all machines (server and clients alike), it registers the perspective color configuration with the team subsystem.

{% stepper %}
{% step %}
**Experience loads**

`BeginPlay` registers with the experience manager's high-priority load callback. When the experience is ready, `OnExperienceLoaded` fires.
{% endstep %}

{% step %}
**Server creates teams**

`ServerCreateTeams()` creates the authored teams first, recording any per-team pawn data as it goes, then loops the ID range from `FirstTeamId` up to `FillToTeamCount`, creating a fill team for every ID an authored entry did not claim. Each creation runs through `ServerCreateTeam()`, which spawns two actors: a public info actor (using `PublicTeamInfoClass`) and a private info actor (using `PrivateTeamInfoClass`). The public info actor receives the team ID and the display asset. The private info actor receives the team ID. Both actors register themselves with the `ULyraTeamSubsystem` on `BeginPlay`.
{% endstep %}

{% step %}
**Server assigns existing players**

`ServerAssignPlayersToTeams()` walks every player state in `GameState->PlayerArray`. Any player without a team gets assigned via `ServerChooseTeamForPlayer()`. Players who already have a team (e.g., from a previous round) are skipped.
{% endstep %}

{% step %}
**Late joiner subscription**

The component binds to `ALyraGameMode::OnGameModePlayerInitialized`, a delegate that fires whenever a new player fully initializes. When it fires, `OnPlayerInitialized` calls `ServerChooseTeamForPlayer()` for the new player and then broadcasts `OnPlayerTeamAssigned`.
{% endstep %}

{% step %}
**Perspective color registration**

On all machines, the component registers the perspective display assets with the subsystem. If `bPerspectiveColorMode` is enabled, it calls `RegisterPerspectiveDisplayAsset` for both the ally and enemy assets, then `SetPerspectiveColourMode(true)`. If disabled, it just calls `SetPerspectiveColourMode(false)` so the subsystem knows perspective mode was explicitly configured.
{% endstep %}
{% endstepper %}

### Player Assignment

The assignment path has two layers. `ServerChooseTeamForPlayer()` is the entry point, but the actual team selection is delegated to `ServerAssignPlayerTeam()`, a `BlueprintNativeEvent` that you can override.

`ServerChooseTeamForPlayer()` first checks whether the player is a spectator. Spectators get `FGenericTeamId::NoTeam` and skip further assignment. For everyone else, it calls `ServerAssignPlayerTeam()` to get the target team ID, sets the generic team ID on the player state, and then checks whether that team has a dedicated pawn configuration. If it does, the component calls `SetPawnData()` on the player state to override the default pawn.

The default implementation of `ServerAssignPlayerTeam()` calls `GetLeastPopulatedTeamID()` with empty include and exclude sets, which returns the team with the fewest active, non-inactive players. The candidates are exactly the teams this component creates, the authored IDs plus the fill range, so balancing never assigns a player to a team that does not exist. When counts are tied, the lower team ID wins.

<details>

<summary>Custom Assignment</summary>

Override `ServerAssignPlayerTeam` in a Blueprint or C++ subclass to implement your own logic. The function receives the `ALyraPlayerState` and returns the desired team ID as an `int32`. Some examples:

* **Party-based**: Look up the player's party and assign them to the same team as their party leader.
* **Player-picked**: Read a team preference from the player state (set during lobby) and honor it if the team isn't full.
* **Skill-based**: Query an MMR value and distribute players to balance team strength rather than team size.

`GetLeastPopulatedTeamID()` is available as a helper even in custom implementations. It accepts `IncludedTeams` and `ExcludedTeams` sets, so you can constrain the balancing to a subset of teams.

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

Per-team pawn data enables asymmetric game modes where teams have fundamentally different gameplay. One team spawns as soldiers with shooter pawn data, another spawns as creatures with melee pawn data. It is configured on the authored team's entry: set the `PawnData` field of the team's `FLyraTeamSetupEntry` in `AuthoredTeams`, which means an asymmetric team is always an authored one. Fill teams start on the experience's default pawn data.

During team creation the component gathers those entries into a runtime pawn-data map. During initial assignment, `ServerChooseTeamForPlayer()` checks that map after setting the team ID; if an entry exists for the player's team, `SetPawnData()` is called on the player state, overriding whatever pawn data the experience would normally provide.

Two runtime functions support dynamic changes:

* `SetTeamPawnData(TeamId, NewPawnData, bApplyToExistingPlayers)` updates the runtime map entry for a team. When `bApplyToExistingPlayers` is true (the default), it iterates all current players on that team and calls `ApplyTeamPawnDataToPlayer()` on each.
* `ApplyTeamPawnDataToPlayer(PS)` looks up the player's current team in the runtime map and calls `SetPawnData()` if a mapping exists.

{% hint style="info" %}
Per-team pawn data only applies automatically during initial team assignment. If a player changes teams at runtime via `ChangeTeamForActor()`, the subsystem's implementation calls `ApplyTeamPawnDataToPlayer()` automatically, so the player gets the correct pawn data for their new team.
{% endhint %}

<figure><img src="../../.gitbook/assets/Screenshot 2026-07-18 150549.png" alt=""><figcaption><p>Asymmetric Prop Hunt Example, where the two teams have different pawn sets hence abilities, inputs, UI and characters</p></figcaption></figure>
