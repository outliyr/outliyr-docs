# Team Visuals

A team needs more than an ID, it needs a visual identity that players can instantly read. The framework handles this through display assets that define what a team looks like, a perspective system that remaps those visuals so the local player always feels like the "home" team, and a set of async observers that let any widget or material react to team changes without polling. These pieces are designed to work together: you define the assets, the subsystem picks the right one for each viewer, and observers push changes to your UI and materials automatically.

***

### Display Assets

A team's visual identity lives in a `ULyraTeamDisplayAsset`, a data asset with three maps of named parameters:

| Map                 | Type                        | Example Entries                         |
| ------------------- | --------------------------- | --------------------------------------- |
| `ScalarParameters`  | `TMap<FName, float>`        | "TeamGlowIntensity", "TeamOutlineWidth" |
| `ColorParameters`   | `TMap<FName, FLinearColor>` | "TeamPrimaryColor", "TeamAccentColor"   |
| `TextureParameters` | `TMap<FName, UTexture*>`    | "TeamLogo", "TeamBanner"                |

You name the parameters whatever makes sense for your project. There is no predefined schema, a competitive shooter might use "TeamPrimaryColor" and "TeamGlowIntensity", while a strategy game might add "TeamBanner" and "TeamFlagTexture". The names are the contract between your display assets and your materials, Niagara systems, and UI.

The asset also carries a `TeamShortName` (`FText`) for localized team names in UI, scoreboards, kill feeds, team selection screens.

#### Application Methods

The display asset provides four methods for pushing its parameters into the rendering pipeline, each building on the last:

`ApplyToMaterial(UMaterialInstanceDynamic*)` sets all matching scalar, color, and texture parameters on a single dynamic material instance. The key insight is **name matching**: if your material has a parameter called "TeamPrimaryColor" and the display asset has a color entry with the same name, they connect automatically. Parameters that exist in the asset but not the material are silently skipped.

`ApplyToMeshComponent(UMeshComponent*)` iterates every material slot on a mesh component, creates dynamic material instances where needed, and calls `ApplyToMaterial` on each one. This is the workhorse for character meshes and props.

`ApplyToNiagaraComponent(UNiagaraComponent*)` sets user-exposed Niagara variables that match the parameter names. Team-colored particle effects, muzzle flashes, shields, auras, just need their Niagara variables named to match the display asset entries.

`ApplyToActor(AActor*, bIncludeChildActors=true)` is the convenience method that walks all mesh and Niagara components on an actor (and optionally its child actors) and applies parameters to each. One call colors an entire character.

<img src=".gitbook/assets/image (39).png" alt="" title="">

#### Live Editing

In the editor, modifying a display asset's properties triggers `PostEditChangeProperty`, which iterates all active `ULyraTeamSubsystem` instances and calls `NotifyTeamDisplayAssetModified`. This broadcasts the change to every registered team color observer, so you see team color updates live in PIE without restarting. Tweak a color in the data asset, and every character, particle, and UI widget using that team's colors updates immediately.

***

### Perspective Mode

Consider a standard two-team setup: Team 1 is blue, Team 2 is red. That works for spectators, but not for players. In an FPS, you expect to always be the "blue" team and your opponents to always be "red", regardless of which team ID you were actually assigned. A Team 2 player shouldn't see themselves as red; they should see allies as blue and enemies as red, just like a Team 1 player does.

Perspective mode solves this. When enabled, the subsystem maintains two special display assets, one for allies and one for enemies, separate from the per-team assets. When any system asks for a team's display asset through `GetEffectiveTeamDisplayAsset`, the subsystem checks the viewer's team and returns:

* The **ally** asset if the requested team matches the viewer's team
* The **enemy** asset if it doesn't

If perspective mode is off, or no viewer team is provided, it falls back to the raw per-team display asset.

#### Configuration

Perspective assets are configured on `ULyraTeamCreationComponent` through its `PerspectiveColorConfig` property, an `FLyraPerspectiveColorConfig` struct with three fields:

| Field                   | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `bPerspectiveColorMode` | Master toggle for the entire perspective system                           |
| `AllyTeamDisplayAsset`  | The display asset shown for teammates from the local player's perspective |
| `EnemyTeamDisplayAsset` | The display asset shown for opponents from the local player's perspective |

During team creation (`BeginPlay`), the component registers these assets with the subsystem via `RegisterPerspectiveDisplayAsset` and enables perspective mode via `SetPerspectiveColourMode`. From that point forward, all calls to `GetEffectiveTeamDisplayAsset` are perspective-aware.

#### Choosing the Right Accessor

`GetEffectiveTeamDisplayAsset(TeamId, ViewerTeamId)` is what you should use for anything the player sees, character materials, UI elements, world markers. It respects perspective mode and returns the correct asset for the viewer's context.

`GetTeamDisplayAsset(TeamId, ViewerTeamId)` returns the raw team asset regardless of perspective. It exists for server-side logic and situations where you genuinely need the team's "true" colors, but using it for client visuals defeats the entire perspective system.

***

### Reacting to Team Changes

Polling for team state every frame is wasteful and fragile. The framework provides three async actions for event-driven updates. Each one fires once immediately on creation with the current state, so you never need to manually query the initial value, just bind your logic and the first callback gives you the starting point.

#### ObserveViewerTeam

This is the most common observer and the one you will reach for first. This observer monitors when the _viewed_ player changes and what team they belong to. It is built for spectator and killcam systems.

The `OnViewerTeamChanged` delegate provides three parameters: `bTeamSet`, `ObservedPS` (the `APlayerState` being observed), and `TeamId`.

Use this for spectator UI that needs to update when switching between observed players, the spectator HUD, team-colored overlays during killcam, or commentary systems that need to know whose perspective is active.

<img src=".gitbook/assets/image (42).png" alt="" title="">

> [!INFO]
> The two observers below return team colors based on the **actor's actual team**, not the viewer's perspective. Use them when colors should stay fixed regardless of who's watching, for example, a control point that's always blue for Team 1 and red for Team 2, even during a killcam or spectating. If instead you want colors to shift with the viewer's perspective (teammates are always blue, enemies always red, even when spectating someone else), use `ObserveViewerTeam` above.

#### ObserveTeamColors

It monitors both team membership and display asset changes.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Create the observer**

Call `UAsyncAction_ObserveTeamColors::ObserveTeamColors(WorldContext, TeamAgent)`, passing any actor that implements `ILyraTeamAgentInterface`.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Immediate callback**

The `OnTeamChanged` delegate fires immediately with the current state: `bTeamSet` (whether the actor has a team), `TeamId`, and the current `DisplayAsset`.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Ongoing monitoring**

The delegate fires again whenever:

* The actor's team ID changes (e.g., a player switches teams mid-match)
* The team's display asset changes (e.g., an editor tweak via `NotifyTeamDisplayAssetModified`)
<!-- gb-step:end -->
<!-- gb-stepper:end -->

Use this for health bars, nameplates, crosshair colors, outline effects, anything that should react to team visuals.

#### ObserveTeam

A simpler variant that only monitors team ID changes, ignoring display asset updates.

The `OnTeamChanged` delegate provides two parameters: `bTeamSet` and `TeamId`. No display asset is included because this observer doesn't track visual changes.

Use this for logic that cares about team membership but not colors, showing or hiding friendly fire indicators, enabling team-specific abilities, filtering team chat.

***

### Getting Colors Safely

Reading parameters from a display asset can fail in several ways: the asset might be null (actor has no team yet), or it might not have the specific parameter you need (different game modes use different parameter sets). `ULyraTeamStatics` provides typed accessors that handle both cases gracefully:

`GetTeamColorWithFallback(DisplayAsset, ParameterName, DefaultColor)` returns the named `FLinearColor` from the asset's `ColorParameters` map, or the default if the asset is null or the parameter doesn't exist.

`GetTeamScalarWithFallback(DisplayAsset, ParameterName, DefaultValue)` does the same for `float` values from `ScalarParameters`.

`GetTeamTextureWithFallback(DisplayAsset, ParameterName, DefaultTexture)` does the same for `UTexture*` values from `TextureParameters`.

These are the safest way to read team parameters from Blueprints. Your UI never crashes because a team doesn't have a specific parameter defined, it just falls back to the default you provided.

#### Viewer Helpers

`ULyraTeamStatics` also provides quick access to the current viewer's team information, useful for any system that needs to know whose perspective is active:

`GetCurrentViewer(WorldContext)` returns the `APlayerState` of the player currently being viewed. In normal gameplay this is the local player; during spectating or killcam, it is whoever is being observed.

`GetCurrentViewerTeam(WorldContext, bIsPartOfTeam, TeamId, DisplayAsset)` goes one step further and resolves the viewer's team membership and display asset in a single call. This is the function you want when building perspective-aware UI, it tells you the viewer's team so you can pass it to `GetEffectiveTeamDisplayAsset` for correct ally/enemy color resolution.
