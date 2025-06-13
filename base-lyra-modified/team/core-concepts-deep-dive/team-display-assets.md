# Team Display Assets

While Team IDs and the Team Agent Interface handle _affiliation_, the `ULyraTeamDisplayAsset` defines the **visual identity** of a team. This Data Asset stores configurable parameters (colors, textures, scalar values) that can be applied to materials, particle effects, and UI elements to give teams a distinct look and feel.

### Role and Purpose

* **Define Team Visuals:** Serves as a centralized asset to configure the visual theme for a specific team (e.g., "Red Team", "Blue Team") or a perspective (e.g., "Ally", "Enemy").
* **Data-Driven Appearance:** Allows designers to easily modify team colors, logos, or material effects by editing this Data Asset, without changing code or material graphs directly (assuming materials are set up to use the defined parameters).
* **Consistent Application:** Provides helper functions to consistently apply these defined visual parameters across various types of components (Meshes, Niagara Systems).

### Creation

Create Team Display Assets in the Unreal Editor:

1. **Content Browser:** Navigate to a suitable folder (e.g., `Content/Teams/DisplayAssets`).
2. **Right-Click:** Right-click in the empty space.
3. **Miscellaneous:** Select `Data Asset`.
4. **Choose Class:** Search for and select `LyraTeamDisplayAsset` as the parent class.
5. **Name Asset:** Give it a descriptive name (e.g., `DA_TeamDisplay_Red`, `DA_TeamDisplay_Blue`, `DA_TeamDisplay_AllyPerspective`).

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/Create_Team_Display_Asset.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Create a team display asset
{% endfile %}

### Key Properties

Configure these properties within the Team Display Asset's Details panel:

<img src=".gitbook/assets/image (19) (1).png" alt="" width="563" title="Blue Team Display Asset">

* **`Scalar Parameters` (`TMap<FName, float>`)**:
  * A map associating parameter **Names** (which should match scalar parameter names used in your Materials or Niagara Systems) with **float** values.
  * _Example:_ `{"TeamGlowIntensity", 5.0}, {"TeamPatternScale", 1.2}`
* **`Color Parameters` (`TMap<FName, FLinearColor>`)**:
  * A map associating parameter **Names** (matching vector/color parameter names in Materials/Niagara) with **Linear Color** values. This is the primary way to define team colors.
  * _Example:_ `{"TeamPrimaryColor", (R=1, G=0, B=0, A=1)}, {"TeamSecondaryColor", (R=0.8, G=0.2, B=0.2, A=1)}`
* **`Texture Parameters` (`TMap<FName, TObjectPtr<UTexture>>`)**:
  * A map associating parameter **Names** (matching texture parameter names in Materials/Niagara) with **Texture** asset references. Used for team logos, specific patterns, etc.
  * _Example:_ `{"TeamLogo", T_TeamLogo_Red}`
* **`Team Short Name` (`FText`)**:
  * A short, displayable name for the team (e.g., "RED", "BLU", "Ally"). Often used in UI elements where space is limited. Supports localization.

**Important:** The **Names** used as keys in these maps _must_ match the parameter names defined within the Material graphs or Niagara Systems you intend to apply these assets to.

### Applying Display Assets at Runtime

The `ULyraTeamDisplayAsset` provides several Blueprint-callable helper functions to apply its stored parameters to different targets:

* `ApplyToMaterial(UMaterialInstanceDynamic* Material)`: Sets scalar, vector (color), and texture parameters directly on a specific Dynamic Material Instance.

<img src=".gitbook/assets/image (2) (1) (1) (1) (1) (1).png" alt="" width="363" title="">

* `ApplyToMeshComponent(UMeshComponent* MeshComponent)`: Iterates through the materials on the mesh component. For scalar and vector parameters, it calls `SetScalar/VectorParameterValueOnMaterials`. For texture parameters, it creates Dynamic Material Instances if needed and sets the texture parameters on them individually.

<img src=".gitbook/assets/image (1) (1) (1) (1) (1) (1).png" alt="" width="321" title="">

* `ApplyToNiagaraComponent(UNiagaraComponent* NiagaraComponent)`: Sets corresponding User Exposed variables (float, LinearColor, Texture Object) on the Niagara component. Parameter names must match the Niagara variable names.

<img src=".gitbook/assets/image (3) (1) (1) (1) (1) (1).png" alt="" width="357" title="">

* `ApplyToActor(AActor* TargetActor, bool bIncludeChildActors = true)`: A convenience function that iterates through all components (optionally including children) on the target actor and calls `ApplyToMeshComponent` or `ApplyToNiagaraComponent` as appropriate for each Mesh or Niagara component found.

<img src=".gitbook/assets/image (4) (1) (1) (1) (1).png" alt="" width="371" title="">

**Typical Usage Flow:**

1. **Get Display Asset:** A system (like a character's cosmetic component or a UI widget) determines the correct `ULyraTeamDisplayAsset` to use. This usually involves:
   * Getting the actor's Team ID using `ULyraTeamSubsystem::FindTeamFromObject`.
   * Getting the local viewer's Team ID using `ULyraTeamStatics::GetCurrentViewerTeam`.
   * Calling `ULyraTeamSubsystem::GetEffectiveTeamDisplayAsset(ActorTeamID, ViewerTeamID)` to get the final asset, respecting perspective color mode.
2. **Apply to Target:** If a valid display asset is retrieved, call the appropriate `ApplyTo...` function on it, passing the target Actor or Component. This is often done when the character spawns, respawns, or potentially when the team/viewer perspective changes.

<img src=".gitbook/assets/image (5) (1) (1) (1).png" alt="" title="Example of setting the player character mesh colour based on the display asset">

### Editor Integration

* `PostEditChangeProperty`: If you modify a `ULyraTeamDisplayAsset` in the editor while the game is running (PIE), this function is triggered. It finds the `ULyraTeamSubsystem` and calls `NotifyTeamDisplayAssetModified(this)`.
* `NotifyTeamDisplayAssetModified`: The subsystem then broadcasts the `OnTeamDisplayAssetChanged` delegate for _all_ teams (and perspective assets in the current implementation). Systems listening to these delegates (like `UAsyncAction_ObserveTeamColors`) can then re-fetch and re-apply the potentially updated display asset, allowing for live visual updates in PIE.

***

`ULyraTeamDisplayAsset` provides a flexible, data-driven approach to defining and applying team-specific visuals. By configuring these assets and ensuring your materials and effects use matching parameter names, you can easily customize and manage the visual identity of different teams or perspectives within your game.
