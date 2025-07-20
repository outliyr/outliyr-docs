# Team Statics

The `ULyraTeamStatics` class is a **Blueprint Function Library** providing convenient, static functions for accessing information from the `ULyraTeamSubsystem` directly within Blueprint graphs. These functions mirror many of the core query capabilities of the subsystem but abstract away the need to explicitly get the subsystem instance first.

### Purpose

* **Blueprint Accessibility:** Make common team queries easily available as nodes in any Blueprint graph (Widgets, Actor Blueprints, Function Libraries, etc.).
* **Simplification:** Provide direct functions for tasks like finding an actor's team ID or getting the correct display asset, without needing to handle subsystem pointers directly in BP.
* **Safe Access:** Include helper functions for safely extracting parameters (colors, scalars, textures) from potentially null `ULyraTeamDisplayAsset` pointers, providing fallback default values.

### Key Static Blueprint Functions

These functions are callable from any Blueprint graph. They typically require a `World Context Object` input pin (usually connected to `Self`) to locate the correct `UWorld` and thus the `ULyraTeamSubsystem`.

*   **`Find Team From Object`**

    * **Inputs:** `Agent` (Object Reference - the actor/object to check), `bLogIfNotSet` (bool - log a warning if team found but display asset isn't set yet).
    * **Outputs:** `bIsPartOfTeam` (bool), `TeamId` (int32), `DisplayAsset` (`ULyraTeamDisplayAsset*`).
    * **Action:** Calls `ULyraTeamSubsystem::FindTeamFromObject` to get the Team ID for the `Agent`, then uses that ID to call `ULyraTeamSubsystem::GetTeamDisplayAsset` to retrieve the _actual_ team display asset (not necessarily the perspective-aware one). Sets output parameters accordingly.

    <img src=".gitbook/assets/image (23) (1).png" alt="" width="255" title="">
*   **`Get Team Display Asset`**

    * **Inputs:** `WorldContextObject`, `TeamId` (int32).
    * **Outputs:** Return Value (`ULyraTeamDisplayAsset*`).
    * **Action:** Calls `ULyraTeamSubsystem::GetTeamDisplayAsset(TeamId, INDEX_NONE)` (passing INDEX_NONE for ViewerTeamId, meaning it ignores perspective mode). Retrieves the display asset explicitly assigned to the given `TeamId`.

    <img src=".gitbook/assets/image (25) (1).png" alt="" width="226" title="">
*   **`Get Effective Team Display Asset`**

    * **Inputs:** `WorldContextObject`, `TeamId` (int32 - the ID of the team whose asset you want), `ViewerTeamId` (int32 - Optional, defaults to -1. The Team ID of the player viewing the target `TeamId`).
    * **Outputs:** Return Value (`ULyraTeamDisplayAsset*`).
    * **Action:** Calls `ULyraTeamSubsystem::GetEffectiveTeamDisplayAsset(TeamId, ViewerTeamId)`. This is the **recommended function** for getting visuals, as it correctly handles Perspective Color Mode. It returns the Ally/Enemy asset if perspective mode is active and applicable, otherwise falls back to the actual `TeamId`'s display asset. If `ViewerTeamId` is left at -1 (or not provided), the subsystem will use the `CurrentViewer` it tracks.

    <img src=".gitbook/assets/image (26) (1).png" alt="" width="279" title="">
*   **`Get Team Scalar With Fallback`**

    * **Inputs:** `DisplayAsset` (`ULyraTeamDisplayAsset*`), `ParameterName` (FName), `DefaultValue` (float).
    * **Outputs:** Return Value (float).
    * **Action:** Safely attempts to find the `ParameterName` in the `DisplayAsset`'s `ScalarParameters` map. Returns the found value if successful, otherwise returns the `DefaultValue`. Prevents errors if `DisplayAsset` is null or the parameter doesn't exist.

    <img src=".gitbook/assets/image (27) (1).png" alt="" width="273" title="">
*   **`Get Team Color With Fallback`**

    * **Inputs:** `DisplayAsset` (`ULyraTeamDisplayAsset*`), `ParameterName` (FName), `DefaultValue` (LinearColor).
    * **Outputs:** Return Value (LinearColor).
    * **Action:** Safely attempts to find the `ParameterName` in the `DisplayAsset`'s `ColorParameters` map. Returns the found color if successful, otherwise returns the `DefaultValue`.

    <img src=".gitbook/assets/image (28) (1).png" alt="" width="312" title="">
*   **`Get Team Texture With Fallback`**

    * **Inputs:** `DisplayAsset` (`ULyraTeamDisplayAsset*`), `ParameterName` (FName), `DefaultValue` (Texture Object Reference).
    * **Outputs:** Return Value (Texture Object Reference).
    * **Action:** Safely attempts to find the `ParameterName` in the `DisplayAsset`'s `TextureParameters` map. Returns the found texture if successful, otherwise returns the `DefaultValue`.

    <img src=".gitbook/assets/image (29) (1).png" alt="" width="279" title="">
*   **`Get Current Viewer`**

    * **Inputs:** `WorldContextObject`.
    * **Outputs:** Return Value (`APlayerState*`).
    * **Action:** Calls `ULyraTeamSubsystem::GetCurrentViewer()`. Returns the `APlayerState` currently being observed by the local player, falling back to the local player's own PlayerState if none is explicitly set.

    <img src=".gitbook/assets/image (31).png" alt="" width="194" title="">
*   **`Get Current Viewer Team`**

    * **Inputs:** `WorldContextObject`.
    * **Outputs:** `bIsPartOfTeam` (bool), `TeamId` (int32), `DisplayAsset` (`ULyraTeamDisplayAsset*`).
    * **Action:** Calls `GetCurrentViewer` and then feeds the result into `FindTeamFromObject` to conveniently get the team information for the player whose perspective is currently active.

    <img src=".gitbook/assets/image (32).png" alt="" width="220" title="">

### Usage Example in Blueprints

* **Setting Team Color on a Widget:**
  1. Get pawn's `TeamId` using `Find Team From Object`.
  2. Get local player controller's `PlayerState`.
  3. Get viewer's `TeamId` using `Find Team From Object` on the viewer's PlayerState.
  4. Call `Get Effective Team Display Asset` using the pawn's `TeamId` and viewer's `TeamId`.
  5. Call `Get Team Color With Fallback` using the result from step 4, providing the material parameter name (e.g., "TeamPrimaryColor") and a default color.

***

The `ULyraTeamStatics` library provides essential Blueprint nodes for easily querying team affiliation and retrieving visual display assets, including support for perspective color mode and safe parameter access with default fallbacks. Use these functions to integrate team information into your UI and gameplay Blueprints.
