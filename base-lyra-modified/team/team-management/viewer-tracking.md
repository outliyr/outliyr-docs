# Viewer Tracking

In many game scenarios, especially those involving spectating, killcams, or replays, the "local player" isn't necessarily the player whose perspective is currently being shown on screen. The **Viewer Tracking** functionality within the `ULyraTeamSubsystem` addresses this by keeping track of the `APlayerState` representing the player whose viewpoint is currently active for the local user.

### Purpose

* **Perspective Context:** Provides a definitive source for knowing _who_ the local user is currently observing. This is crucial for:
  * **Perspective Color Mode:** Determining the correct Ally/Enemy relationship when calling `GetEffectiveTeamDisplayAsset`.
  * **Spectator UI:** Tailoring UI elements to show information relevant to the spectated player.
  * **Other Viewpoint Logic:** Any game system that needs to behave differently based on whether the local user is watching themselves or someone else.
* **Centralized Tracking:** Offers a single, reliable place to query the current viewer state, rather than having individual systems (spectating, killcam) manage it independently.

### Core Components & Logic

* **`CurrentViewer` (`TWeakObjectPtr<APlayerState>`)**:
  * A non-replicated, weak object pointer within the `ULyraTeamSubsystem` instance.
  * Stores a reference to the `APlayerState` of the player currently being viewed by the local user.
  * If `nullptr` or invalid, it implies the local user is viewing their own perspective.
* **`SetCurrentViewer(APlayerState* NewViewer)`:**
  * **Action:** Updates the `CurrentViewer` pointer. Meant to be called by systems that change the player's viewpoint (e.g., starting/stopping spectating, entering/exiting a killcam).
  *   **Logic:**

      1. Compares `NewViewer` with the current `CurrentViewer`.
      2. If they are different, updates the `CurrentViewer` weak pointer.
      3. Broadcasts the `OnViewerChanged` delegate.

      <img src=".gitbook/assets/image (17) (1) (1).png" alt="" width="375" title="">
* **`GetCurrentViewer()`:**
  * **Action:** Returns the currently tracked viewer `APlayerState`.
  * **Logic:**
    1. Checks if the `CurrentViewer` weak pointer is valid. If so, returns the pointed-to `APlayerState`.
    2. If `CurrentViewer` is invalid (e.g., `nullptr` or the PlayerState was destroyed), it calls `GetLocalPlayerState()` as a fallback.
* **`GetLocalPlayerState() const` (Private Helper):**
  * **Action:** Attempts to find the `APlayerState` associated with the _first local player controller_ in the current world.
  * **Purpose:** Provides the default "self" perspective when no explicit viewer is being tracked.
* **`OnViewerChanged` (`FOnViewerChangedDelegate`)**:
  * A multicast delegate (`DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnViewerChangedDelegate, APlayerState*, NewViewer)`) broadcast by `SetCurrentViewer` whenever the viewed player state changes.
  * **Purpose:** Allows other systems (especially UI) to subscribe and react immediately when the viewing perspective shifts. This could trigger UI layout changes, update information displays, or re-evaluate team colors/relationships.

> [!info]
> Directly binding to `OnViewerChanged` in Blueprints is discouraged. Instead, use the dedicated Async Action (`UAsyncAction_ObserveViewerTeam`) which provides a more Blueprint-friendly and reliable way to track perspective changes.

### Usage Scenario (Spectating)

1. **Start Spectating:** The local player activates spectator mode, targeting `Player B`.
2. **Spectator System Calls:** The spectator system code gets the `ULyraTeamSubsystem` and calls `SetCurrentViewer(PlayerB_PlayerState)`.
3. **Subsystem Updates:** The subsystem updates its internal `CurrentViewer` pointer to `PlayerB_PlayerState` and broadcasts `OnViewerChanged` with `PlayerB_PlayerState` as the parameter.
4. **UI Reacts:** HUD elements listening to `OnViewerChanged` update to show Player B's health, ammo, name, etc.
5. **Visual System Reacts:** Systems responsible for applying team colors call `GetEffectiveTeamDisplayAsset`. Inside this function:
   * It calls `GetCurrentViewer()`, which now returns `PlayerB_PlayerState`.
   * It gets `PlayerB_PlayerState`'s Team ID (`ViewerTeamId`).
   * When evaluating colors for other players (e.g., `Player C`), it compares `PlayerC_TeamId` with `ViewerTeamId`. If they are different, and perspective mode is on, it returns the "Enemy" display asset for Player C. If they are the same, it returns the "Ally" asset.
6. **Stop Spectating:** The player returns to controlling their own character.
7. **Spectator System Calls:** The spectator system calls `SetCurrentViewer(nullptr)` or `SetCurrentViewer(MyOwnPlayerState)`.
8. **Subsystem Updates:** `CurrentViewer` is updated, and `OnViewerChanged` is broadcast again.
9. **UI/Visuals Revert:** Systems react, potentially fetching the local player's state via the `GetLocalPlayerState()` fallback in `GetCurrentViewer()` and updating UI/visuals accordingly.

### Blueprint Access (`ULyraTeamStatics`)

* **`GetCurrentViewer(WorldContextObject)`:** Blueprint wrapper for `ULyraTeamSubsystem::GetCurrentViewer()`.

<img src=".gitbook/assets/image (19) (1) (1).png" alt="" width="201" title="">

* **`GetCurrentViewerTeam(WorldContextObject, ...)`:** Blueprint wrapper that calls `GetCurrentViewer` and then feeds the result into `FindTeamFromObject` to get the viewer's team ID and display asset easily.

<img src=".gitbook/assets/image (20) (1).png" alt="" width="240" title="">

### Async Action (`UAsyncAction_ObserveViewerTeam`)

* Provides a reactive way for Blueprints to monitor viewer changes _and_ subsequent team changes _of that viewer_.
* Listens to both `ULyraTeamSubsystem::OnViewerChanged` and the `ILyraTeamAgentInterface::GetOnTeamIndexChangedDelegate()` of the _currently viewed_ PlayerState.
* Outputs `OnViewerTeamChanged(bTeamSet, ObservedPS, TeamId)`. Includes logic to handle cases where the PlayerState might exist before its TeamID is assigned (briefly polling).

<img src=".gitbook/assets/image (21) (1).png" alt="" width="287" title="">

***

Viewer Tracking in the `ULyraTeamSubsystem` provides essential context for features like perspective colors and spectator UI. By maintaining a reference to the currently observed player state and notifying systems of changes, it enables consistent viewpoint-dependent logic across different game systems.
