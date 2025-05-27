# Display Assets & Perspective Colors

A key function of the `ULyraTeamSubsystem` is managing how teams are visually represented. This involves retrieving the correct **Team Display Asset (`ULyraTeamDisplayAsset`)** for a given team and handling the **Perspective Color Mode**, which allows overriding team colors based on the local player's viewpoint (Ally vs. Enemy).

### Retrieving Team Display Assets

* `GetTeamDisplayAsset(int32 TeamId, int32 ViewerTeamId)`
  * **Action:** Attempts to retrieve the specific `ULyraTeamDisplayAsset` associated with the given `TeamId`.
  * **Logic:**
    1. Finds the `FLyraTeamTrackingInfo` struct for `TeamId` in the internal `TeamMap`.
    2. If found, returns the `DisplayAsset` pointer stored within that tracking struct (this pointer is originally set when the `ALyraTeamPublicInfo` actor registers itself).
  * **Note on `ViewerTeamId`:**\
    Although the function signature includes a `ViewerTeamId` parameter, it is not used in the current Lyra implementation. This function always returns the display asset directly associated with the given `TeamId`, without applying any viewer-based perspective logic.\
    For viewer-dependent visuals (such as Ally/Enemy differentiation), use `GetEffectiveTeamDisplayAsset`, which fully supports `ViewerTeamId` and the Perspective Color Mode system.
  * **Returns:** The `ULyraTeamDisplayAsset*` for the team, or `nullptr` if the team ID is invalid or the team info/display asset hasn't been registered yet.

### Perspective Color Mode

This optional mode changes how team visuals are determined, prioritizing immediate recognizability (Ally vs. Enemy) over specific team colors, which can be beneficial in fast-paced competitive modes.

* **Enabling/Disabling:**
  * Controlled by the `bPerspectiveColorMode` boolean flag within the subsystem.
  * Set via `SetPerspectiveColourMode(bool bInPerspectiveColorMode)`, typically called once during initialization by the `ULyraTeamCreationComponent` based on its `PerspectiveColorConfig` settings.
  * The process of enabling this functionality is explained in more detail on the [**Team Creation & Assignment**](../team-creation-and-assignment.md) page.
* **Perspective Display Assets:**
  * The system defines two special IDs: `PERSPECTIVE_ALLY_ID` (-254) and `PERSPECTIVE_ENEMY_ID` (-255).
  * Specific `ULyraTeamDisplayAsset`s representing the "Ally" look and the "Enemy" look are registered with the subsystem using these IDs via `RegisterPerspectiveDisplayAsset(int32 AssetId, ULyraTeamDisplayAsset* DisplayAsset)`. This registration is also typically done by the `ULyraTeamCreationComponent` based on its config.
  * `GetPerspectiveTeamDisplayAsset(int32 AssetId)` retrieves the asset registered for the Ally or Enemy ID.
* **`GetEffectiveTeamDisplayAsset(int32 TeamId, int32 ViewerTeamId)`:**
  * **Action:** This is the **primary function** to call when determining which display asset to apply to an actor or UI element. It automatically handles the perspective color mode logic.
  * **Logic:**
    1. Checks if `bPerspectiveColorMode` is `true` **and** if a valid `ViewerTeamId` (not -1) was provided.
    2. **If Perspective Mode is Active:**
       * Compares `TeamId` and `ViewerTeamId`.
       * If `TeamId == ViewerTeamId`, it calls `GetPerspectiveTeamDisplayAsset(PERSPECTIVE_ALLY_ID)` to get the "Ally" visuals.
       * If `TeamId != ViewerTeamId`, it calls `GetPerspectiveTeamDisplayAsset(PERSPECTIVE_ENEMY_ID)` to get the "Enemy" visuals.
    3. **If Perspective Mode is Inactive (or ViewerTeamId is invalid):**
       * It falls back to calling the basic `GetTeamDisplayAsset(TeamId, ViewerTeamId)` to retrieve the actual display asset defined for the specific `TeamId`.
  * **Returns:** The appropriate `ULyraTeamDisplayAsset*` based on the mode and viewer relationship, or `nullptr`.

**Determining the Viewer:** The `ViewerTeamId` required by `GetEffectiveTeamDisplayAsset` is typically obtained by:

1. Getting the current viewer `APlayerState*` using `ULyraTeamSubsystem::GetCurrentViewer()`.
2. Finding the Team ID for that viewer Player State using `ULyraTeamSubsystem::FindTeamFromObject(ViewerPlayerState)`.

### Reacting to Changes

* **`NotifyTeamDisplayAssetModified(ULyraTeamDisplayAsset* ModifiedAsset)`:**
  * Called automatically when a `ULyraTeamDisplayAsset` is modified in the editor during PIE (`ULyraTeamDisplayAsset::PostEditChangeProperty`).
  * **Action:** Broadcasts the `OnTeamDisplayAssetChanged` delegate for _all_ registered teams and perspective assets (in the current implementation). This triggers listeners (like `UAsyncAction_ObserveTeamColors`) to potentially refresh visuals.
* **`GetTeamDisplayAssetChangedDelegate(int32 TeamId)`:**
  * **Action:** Returns a reference to the specific `FOnLyraTeamDisplayAssetChangedDelegate` associated with a given `TeamId` (stored within the `FLyraTeamTrackingInfo`).
  * **Usage:** Allows systems to subscribe directly to visual changes for a _specific_ team, rather than listening to all changes triggered by `NotifyTeamDisplayAssetModified`. The `UAsyncAction_ObserveTeamColors` uses this to update when the display asset for the _currently observed team_ changes.

### Utility Functions (`ULyraTeamStatics`)

The `ULyraTeamStatics` library provides Blueprint-friendly wrappers:

* `GetTeamDisplayAsset(WorldContextObject, TeamId)`: Wrapper for the base subsystem function.
* `GetEffectiveTeamDisplayAsset(WorldContextObject, TeamId, ViewerTeamId = -1)`: Wrapper for the perspective-aware subsystem function.
* `GetTeamScalarWithFallback`, `GetTeamColorWithFallback`, `GetTeamTextureWithFallback`: Helper functions to safely retrieve specific parameter values from a potentially null `ULyraTeamDisplayAsset`, returning a default value if the asset or parameter is missing.

### Summary

The `ULyraTeamSubsystem` centralizes the management of team visuals. It retrieves the appropriate `ULyraTeamDisplayAsset` based on either the actual Team ID or the viewer's perspective if Perspective Color Mode is enabled. It also provides mechanisms for systems to react to changes in these display assets, ensuring visuals can update dynamically. Use `GetEffectiveTeamDisplayAsset` in most rendering or UI logic to ensure correct handling of the perspective mode.

***
