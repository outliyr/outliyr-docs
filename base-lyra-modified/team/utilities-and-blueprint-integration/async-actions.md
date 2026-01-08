# Async Actions

While `ULyraTeamStatics` provides functions for _querying_ the current team state, constantly polling these functions (e.g., on Tick) in Blueprints to detect changes is inefficient. To enable **reactive** Blueprint logic, the system provides several **Blueprint Async Action nodes** that allow you to subscribe to specific team-related events and execute logic only when those events occur.

### Purpose

* **Efficient Event-Driven Logic:** Avoid polling by executing Blueprint logic only when a relevant change happens (team assignment changes, display asset updates, viewer perspective shifts).
* **Blueprint Reactivity:** Allows UI widgets or other Blueprint systems to automatically update when team information relevant to them changes.
* **Simplified Binding:** Abstracts the underlying C++ delegate binding and subsystem interactions into easy-to-use Blueprint nodes.

### Available Async Action Nodes

These nodes follow the standard async action pattern with `Then` (executes immediately) and event delegate output pins (execute when the event fires). Remember to provide a `World Context Object` (usually `Self`).

1.  **`Observe Team` (`UAsyncAction_ObserveTeam`)**

    * **Watches:** Changes to the Team ID of a _specific_ actor that implements `ILyraTeamAgentInterface`.
    * **Inputs:** `Team Agent` (Object Reference - must implement the interface).
    * **Output Delegate:** `On Team Changed`
      * `bTeamSet` (bool): True if the new Team ID is valid (not INDEX_NONE).
      * `TeamId` (int32): The new Team ID (or INDEX_NONE).
    * **Logic:**
      * Retrieves the `ILyraTeamAgentInterface` from the input object.
      * Binds an internal function (`OnWatchedAgentChangedTeam`) to the agent's `GetTeamChangedDelegateChecked()`.
      * Broadcasts the `OnTeamChanged` delegate **once immediately** with the agent's current Team ID upon activation.
      * Whenever the agent's `OnTeamChangedDelegate` fires in the future, the internal function executes and broadcasts the async node's `OnTeamChanged` delegate again with the new ID.
      * Cleans up the binding when cancelled or the action is destroyed.
    * **Use Case:** Updating UI elements specific to a single character's team (e.g., showing a team icon next to a player name in a scoreboard) or triggering logic when a specific actor changes teams.

    <img src=".gitbook/assets/image (33).png" alt="" width="349" title="">
2.  **`Observe Team Colors` (`UAsyncAction_ObserveTeamColors`)**

    * **Watches:** Changes to the Team ID of a specific Team Agent _AND_ changes to the `ULyraTeamDisplayAsset` associated with that team ID in the `ULyraTeamSubsystem`.
    * **Inputs:** `Team Agent` (Object Reference - must implement `ILyraTeamAgentInterface`).
    * **Output Delegate:** `On Team Changed`
      * `bTeamSet` (bool): True if the Team ID is valid.
      * `TeamId` (int32): The current Team ID.
      * `Display Asset` (`ULyraTeamDisplayAsset*`): The _current_ display asset associated with the `TeamId` (retrieved from the subsystem, could be null).
    * **Logic:**
      * Combines the logic of `ObserveTeam`.
      * It also subscribes to the `ULyraTeamSubsystem::GetTeamDisplayAssetChangedDelegate(TeamId)` for the agent's _current_ team ID.
      * When the agent's team changes (`OnWatchedAgentChangedTeam`), it unbinds from the old team's display asset delegate, retrieves the _new_ team's display asset, broadcasts the `OnTeamChanged` delegate, and binds to the _new_ team's display asset delegate.
      * When the display asset itself changes (`OnDisplayAssetChanged` callback from the subsystem), it retrieves the updated asset and broadcasts the `OnTeamChanged` delegate again.
    * **Use Case:** The most common node for updating visuals. Use this to update character materials, UI colors, or VFX based on the team agent's _current_ team _and_ its associated (potentially changing) display asset.

    <img src=".gitbook/assets/image (34).png" alt="" width="363" title="">
3.  **`Observe Viewer Team` (`UAsyncAction_ObserveViewerTeam`)**

    * **Watches:** Changes to the _currently viewed_ player (tracked by `ULyraTeamSubsystem::GetCurrentViewer`) _AND_ changes to that viewer's Team ID.
    * **Inputs:** `World Context Object`.
    * **Output Delegate:** `On Viewer Team Changed`
      * `bTeamSet` (bool): True if the current viewer has a valid Team ID.
      * `Observed PS` (`APlayerState*`): The Player State of the current viewer.
      * `TeamId` (int32): The Team ID of the current viewer.
    * **Logic:**
      * Waits for the Experience to be loaded first (important!).
      * Binds to `ULyraTeamSubsystem::OnViewerChanged`.
      * When the viewer changes (`HandleViewerChanged`):
        * Unbinds from the _previous_ viewer's team change delegate (if any).
        * Gets the new viewer Player State (falling back to local player if needed).
        * Binds to the _new_ viewer's team change delegate (`ILyraTeamAgentInterface::GetTeamChangedDelegateChecked`).
        * Broadcasts the `OnViewerTeamChanged` delegate immediately with the new viewer's current team info.
      * When the _current viewer's_ team changes (`HandleViewerTeamChanged`), it broadcasts the `OnViewerTeamChanged` delegate again.
      * Includes logic (`CheckForValidPlayerState` with a timer) to handle cases where the viewer Player State might exist briefly before its team ID is assigned, ensuring the initial broadcast has valid team info.
    * **Use Case:** Updating UI or objective color elements that depend on the _perspective_ (e.g., a "You are spectating \[PlayerName] - Team \[TeamID]" display, or logic that needs to know the team of the person you are currently watching). Essential for correctly feeding the `ViewerTeamId` into `GetEffectiveTeamDisplayAsset` reactively.

    <img src=".gitbook/assets/image (35).png" alt="" width="263" title="">

### Usage Example (Updating Team Color Based on Viewer)

Imagine wanting to color a health bar based on whether the associated player is an ally or enemy relative to the _local viewer_.

1. **In your Health Bar Widget Blueprint:**
2. **Observe Viewer:** On `Event Construct`, call `Observe Viewer Team`. Store the returned Action object in a variable. Bind its `On Viewer Team Changed` delegate to a custom event (e.g., `OnViewerTeamUpdated`).
3. **Observe Target:** Also on `Event Construct`, call `Observe Team Colors` targeting the Player State associated with _this specific health bar_ (`TargetPlayerState`). Store the Action object. Bind its `On Team Changed` delegate to a custom event (e.g., `OnTargetTeamOrColorUpdated`).
4. **Store IDs:** Create variables in your widget to store `CachedViewerTeamId` and `CachedTargetTeamId`, and `CachedTargetDisplayAsset`. Initialize them to INDEX_NONE / nullptr.
5. **`OnViewerTeamUpdated` Event:**
   * Update `CachedViewerTeamId` with the `TeamId` from the event pin.
   * Call a common update function (e.g., `UpdateHealthBarColor`).
6. **`OnTargetTeamOrColorUpdated` Event:**
   * Update `CachedTargetTeamId` and `CachedTargetDisplayAsset` with data from the event pins.
   * Call the common update function (`UpdateHealthBarColor`).
7. **`UpdateHealthBarColor` Function:**
   * Check if `CachedTargetTeamId` is valid (not INDEX_NONE).
   * If valid, call `ULyraTeamStatics::GetEffectiveTeamDisplayAsset`, passing `CachedTargetTeamId` and `CachedViewerTeamId`.
   * Call `ULyraTeamStatics::GetTeamColorWithFallback` using the result from the previous step, requesting the desired color parameter name (e.g., "TeamPrimaryColor") and providing a default.
   * Set the health bar's color using the result.
8. **Cleanup:** On `Event Destruct`, call `Cancel()` on both stored Async Action object variables.

This setup ensures the health bar color updates reactively whenever the viewer changes, the target's team changes, _or_ the display asset associated with the target's effective team changes, using the efficient async pattern.

***

These Async Action nodes provide powerful, Blueprint-friendly tools for building responsive UI and gameplay systems that react to team changes without inefficient polling. Use them to listen for changes to specific actors' teams, their associated display assets, or the overall viewer perspective managed by the `ULyraTeamSubsystem`.
