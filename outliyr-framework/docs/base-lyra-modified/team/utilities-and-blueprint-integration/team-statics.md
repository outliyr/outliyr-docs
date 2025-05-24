# Team Statics

The `ULyraTeamStatics` class is a **Blueprint Function Library** providing convenient, static functions for accessing information from the `ULyraTeamSubsystem` directly within Blueprint graphs. These functions mirror many of the core query capabilities of the subsystem but abstract away the need to explicitly get the subsystem instance first.

### Purpose

* **Blueprint Accessibility:** Make common team queries easily available as nodes in any Blueprint graph (Widgets, Actor Blueprints, Function Libraries, etc.).
* **Simplification:** Provide direct functions for tasks like finding an actor's team ID or getting the correct display asset, without needing to handle subsystem pointers directly in BP.
* **Safe Access:** Include helper functions for safely extracting parameters (colors, scalars, textures) from potentially null `ULyraTeamDisplayAsset` pointers, providing fallback default values.

### Key Static Blueprint Functions

These functions are callable from any Blueprint graph. They typically require a `World Context Object` input pin (usually connected to `Self`) to locate the correct `UWorld` and thus the `ULyraTeamSubsystem`.

* **`Find Team From Object`**
  * **Inputs:** `Agent` (Object Reference - the actor/object to check), `bLogIfNotSet` (bool - log a warning if team found but display asset isn't set yet).
  * **Outputs:** `bIsPartOfTeam` (bool), `TeamId` (int32), `DisplayAsset` (`ULyraTeamDisplayAsset*`).
  * **Action:** Calls `ULyraTeamSubsystem::FindTeamFromObject` to get the Team ID for the `Agent`, then uses that ID to call `ULyraTeamSubsystem::GetTeamDisplayAsset` to retrieve the _actual_ team display asset (not necessarily the perspective-aware one). Sets output parameters accordingly.
* **`Get Team Display Asset`**
  * **Inputs:** `WorldContextObject`, `TeamId` (int32).
  * **Outputs:** Return Value (`ULyraTeamDisplayAsset*`).
  * **Action:** Calls `ULyraTeamSubsystem::GetTeamDisplayAsset(TeamId, INDEX_NONE)` (passing INDEX\_NONE for ViewerTeamId, meaning it ignores perspective mode). Retrieves the display asset explicitly assigned to the given `TeamId`.
* **`Get Effective Team Display Asset`**
  * **Inputs:** `WorldContextObject`, `TeamId` (int32 - the ID of the team whose asset you want), `ViewerTeamId` (int32 - Optional, defaults to -1. The Team ID of the player viewing the target `TeamId`).
  * **Outputs:** Return Value (`ULyraTeamDisplayAsset*`).
  * **Action:** Calls `ULyraTeamSubsystem::GetEffectiveTeamDisplayAsset(TeamId, ViewerTeamId)`. This is the **recommended function** for getting visuals, as it correctly handles Perspective Color Mode. It returns the Ally/Enemy asset if perspective mode is active and applicable, otherwise falls back to the actual `TeamId`'s display asset. If `ViewerTeamId` is left at -1 (or not provided), the subsystem might use the `CurrentViewer` it tracks.
* **`Get Team Scalar With Fallback`**
  * **Inputs:** `DisplayAsset` (`ULyraTeamDisplayAsset*`), `ParameterName` (FName), `DefaultValue` (float).
  * **Outputs:** Return Value (float).
  * **Action:** Safely attempts to find the `ParameterName` in the `DisplayAsset`'s `ScalarParameters` map. Returns the found value if successful, otherwise returns the `DefaultValue`. Prevents errors if `DisplayAsset` is null or the parameter doesn't exist.
* **`Get Team Color With Fallback`**
  * **Inputs:** `DisplayAsset` (`ULyraTeamDisplayAsset*`), `ParameterName` (FName), `DefaultValue` (LinearColor).
  * **Outputs:** Return Value (LinearColor).
  * **Action:** Safely attempts to find the `ParameterName` in the `DisplayAsset`'s `ColorParameters` map. Returns the found color if successful, otherwise returns the `DefaultValue`.
* **`Get Team Texture With Fallback`**
  * **Inputs:** `DisplayAsset` (`ULyraTeamDisplayAsset*`), `ParameterName` (FName), `DefaultValue` (Texture Object Reference).
  * **Outputs:** Return Value (Texture Object Reference).
  * **Action:** Safely attempts to find the `ParameterName` in the `DisplayAsset`'s `TextureParameters` map. Returns the found texture if successful, otherwise returns the `DefaultValue`.
* **`Get Current Viewer`**
  * **Inputs:** `WorldContextObject`.
  * **Outputs:** Return Value (`APlayerState*`).
  * **Action:** Calls `ULyraTeamSubsystem::GetCurrentViewer()`. Returns the `APlayerState` currently being observed by the local player, falling back to the local player's own PlayerState if none is explicitly set.
* **`Get Current Viewer Team`**
  * **Inputs:** `WorldContextObject`.
  * **Outputs:** `bIsPartOfTeam` (bool), `TeamId` (int32), `DisplayAsset` (`ULyraTeamDisplayAsset*`).
  * **Action:** Calls `GetCurrentViewer` and then feeds the result into `FindTeamFromObject` to conveniently get the team information for the player whose perspective is currently active.

### Usage Examples in Blueprints

* **Setting Team Color on a Widget:**
  1. Get pawn's `TeamId` using `Find Team From Object`.
  2. Get local player controller's `PlayerState`.
  3. Get viewer's `TeamId` using `Find Team From Object` on the viewer's PlayerState.
  4. Call `Get Effective Team Display Asset` using the pawn's `TeamId` and viewer's `TeamId`.
  5. Call `Get Team Color With Fallback` using the result from step 4, providing the material parameter name (e.g., "TeamPrimaryColor") and a default color.
  6. Use the returned color to set the tint or color property of a widget element.
* **Checking if Target is Enemy:**
  1. Get `MyTeamId` using `Find Team From Object` on `Self` or `Get Owning Player Pawn`.
  2. Get `TargetTeamId` using `Find Team From Object` on the `TargetActor`.
  3. Use a `Compare` node (or `!=`) on the integer Team IDs. Check also that neither ID is `INDEX_NONE`. If they are valid and not equal, they are enemies (assuming no neutral teams).

### Code Definition Reference

```cpp
UCLASS(MinimalAPI)
class ULyraTeamStatics : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()
public:
	// Find Team ID and Display Asset for an object
	UFUNCTION(BlueprintCallable, Category=Teams, meta=(...))
	static UE_API void FindTeamFromObject(const UObject* Agent, bool& bIsPartOfTeam, int32& TeamId, ULyraTeamDisplayAsset*& DisplayAsset, bool bLogIfNotSet = false);

	// Get the specific display asset for a Team ID (ignores perspective)
	UFUNCTION(BlueprintCallable, Category=Teams, meta=(WorldContext="WorldContextObject"))
	static UE_API ULyraTeamDisplayAsset* GetTeamDisplayAsset(const UObject* WorldContextObject, int32 TeamId);

	// Get the display asset considering perspective mode (RECOMMENDED for visuals)
	UFUNCTION(BlueprintCallable, Category = "Teams", meta=(WorldContext="WorldContextObject"))
	static UE_API ULyraTeamDisplayAsset* GetEffectiveTeamDisplayAsset(const UObject* WorldContextObject, int32 TeamId, int32 ViewerTeamId = -1);

	// Safe parameter accessors with fallbacks
	UFUNCTION(BlueprintCallable, Category = Teams)
	static UE_API float GetTeamScalarWithFallback(ULyraTeamDisplayAsset* DisplayAsset, FName ParameterName, float DefaultValue);
	UFUNCTION(BlueprintCallable, Category = Teams)
	static UE_API FLinearColor GetTeamColorWithFallback(ULyraTeamDisplayAsset* DisplayAsset, FName ParameterName, FLinearColor DefaultValue);
	UFUNCTION(BlueprintCallable, Category = Teams)
	static UE_API UTexture* GetTeamTextureWithFallback(ULyraTeamDisplayAsset* DisplayAsset, FName ParameterName, UTexture* DefaultValue);

	// Viewer information accessors
	UFUNCTION(BlueprintCallable, Category="Teams|Viewer", meta=(WorldContext="WorldContextObject"))
	static UE_API APlayerState* GetCurrentViewer(const UObject* WorldContextObject);
	UFUNCTION(BlueprintCallable, Category="Teams|Viewer", meta=(WorldContext="WorldContextObject"))
	static UE_API void GetCurrentViewerTeam(const UObject* WorldContextObject, bool& bIsPartOfTeam, int32& TeamId, ULyraTeamDisplayAsset*& DisplayAsset);
};
```

***

The `ULyraTeamStatics` library provides essential Blueprint nodes for easily querying team affiliation and retrieving visual display assets, including support for perspective color mode and safe parameter access with default fallbacks. Use these functions to integrate team information into your UI and gameplay Blueprints.
