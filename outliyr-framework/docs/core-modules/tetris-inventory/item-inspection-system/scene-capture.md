# Scene Capture

Once the `APocketLevelStageManager` has set up the 3D scene within the pocket level, the next step is to render that scene into 2D textures (`UTextureRenderTarget2D`) that can be used by the UI (for live inspection) or read back for icon generation. This rendering process is handled by the `UPocketCapture` object, managed by the `UPocketCaptureSubsystem`.

### `UPocketCaptureSubsystem`

This `UWorldSubsystem` is responsible for managing the lifecycle of `UPocketCapture` objects.

* **Purpose:** Provides a centralized point for creating and destroying the capture objects used for rendering pocket world scenes. It also includes logic to help manage texture streaming for the captured components.
* **Key Functions:**
  * `CreateThumbnailRenderer(TSubclassOf<UPocketCapture>)`: Creates a new instance of the specified `UPocketCapture` class (or a derived class). It assigns a unique index to the renderer and calls its `Initialize` function. This is typically called once by the `APocketLevelStageManager` during its `BeginPlay`.
  * `DestroyThumbnailRenderer(UPocketCapture*)`: Destroys the provided `UPocketCapture` instance, calling its `Deinitialize` function and removing it from the subsystem's tracking.
* **Texture Streaming Management:**
  * `StreamThisFrame(TArray<UPrimitiveComponent*>&)`: This function is called internally by `UPocketCapture::CaptureScene`. It marks the primitive components being rendered with `bForceMipStreaming = true` for the current frame.
  * **Tick Logic:** The subsystem keeps track of components streamed in the last frame. In its `Tick` function, it resets `bForceMipStreaming = false` for components that were streamed last frame but _not_ requested for the current frame. This helps ensure textures for the actively rendered objects remain loaded without keeping textures loaded indefinitely for objects no longer being viewed.

### `UPocketCapture`

This object encapsulates the configuration and execution of a single scene capture operation. Each `APocketLevelStageManager` typically owns one `UPocketCapture` instance.

* **Purpose:** To render a specific scene (defined by actors and a camera view provided by its "Capture Target") onto designated Render Target textures.
* **Internal Component:** Contains a `USceneCaptureComponent2D` instance which performs the actual rendering work. This component is configured dynamically based on the capture settings.
* **Initialization & Lifecycle:**
  * `Initialize(UWorld*, int32 RendererIndex)`: Called by the subsystem upon creation. Sets up the internal `USceneCaptureComponent2D`.
  * `Deinitialize()`: Called by the subsystem upon destruction. Cleans up the internal capture component.
* **Configuration:**
  * `SetRenderTargetSize(int32 Width, int32 Height)`: Defines the resolution for the output `UTextureRenderTarget2D`s. Resizes existing render targets if necessary.
  * `SetCaptureTarget(AActor* InCaptureTarget)`: **Crucial.** Sets the Actor whose perspective should be used for rendering. This is typically the `APocketLevelStageManager`. The function finds the `UCameraComponent` within this target actor to define the view settings (location, rotation, FOV, post-processing).
  * `SetAlphaMaskedActors(const TArray<AActor*>& InActors)`: Specifies the list of actors that should be rendered _solidly_ during the `CaptureAlphaMask` pass. This usually includes the main item mesh and all its attached actors.
* **Render Target Access:**
  * `GetOrCreateDiffuseRenderTarget()`: Returns a `UTextureRenderTarget2D` (Format: `RTF_RGBA8`) used for the main color pass. Creates it if it doesn't exist.
  * `GetOrCreateAlphaMaskRenderTarget()`: Returns a `UTextureRenderTarget2D` (Format: `RTF_R8` - single channel) used for the alpha mask pass. Creates it if it doesn't exist.
  * `GetOrCreateEffectsRenderTarget()`: Returns a `UTextureRenderTarget2D` (Format: `RTF_R8`) intended for capturing specific effects (less commonly used in the base inspection/icon system). Creates it if it doesn't exist.
* **Capture Execution Functions:**
  * `CaptureDiffuse()`: Renders the full scene (all attached actors of the `CaptureTarget`) into the Diffuse Render Target using standard rendering (`SCS_FinalColorLDR`).
  * `CaptureAlphaMask()`: Renders _only_ the actors specified via `SetAlphaMaskedActors` into the Alpha Mask Render Target. It uses an `OverrideMaterial` (`AlphaMaskMaterial`, typically a simple unlit white material) and captures scene color (`SCS_SceneColorHDR`). The result is effectively a silhouette mask used for transparency.
  * `CaptureEffects()`: Intended to capture specific visual effects using the `EffectMaskMaterial`.
* **Internal Rendering (`CaptureScene` function):**
  1. Takes the target `UTextureRenderTarget2D`, the list of actors to render (`InCaptureActors`), the capture source (`ESceneCaptureSource`), and an optional `OverrideMaterial`.
  2. Gets the `UCameraComponent` from the `CaptureTarget` (the `APocketLevelStageManager`).
  3. Sets the internal `USceneCaptureComponent2D`'s `TextureTarget` to the provided render target.
  4. Copies camera settings (view info, post-processing) from the target's camera to the internal capture component.
  5. Sets `ShowOnlyActors` on the internal capture component to the provided `InCaptureActors`.
  6. **Optimizes Show Flags:** Disables many computationally expensive rendering features (like DoF, Motion Blur, AO, GI, Fog, etc.) on the internal capture component for performance and clarity in the thumbnail render.
  7. Sets the `CaptureSource` and applies the `OverrideMaterial` if provided.
  8. Calls `CaptureScene()` on the internal `USceneCaptureComponent2D` to perform the render.
  9. If an `OverrideMaterial` was used, it restores the original materials on the primitive components.
  10. Calls `UPocketCaptureSubsystem::StreamThisFrame` to manage texture streaming for the rendered components.

### Interaction Flow

1. `APocketLevelStageManager` creates a `UPocketCapture` instance via `UPocketCaptureSubsystem::CreateThumbnailRenderer` during its setup.
2. The Stage Manager configures the `UPocketCapture` instance (sets render target size, sets itself as the `CaptureTarget`).
3. When a render is needed (e.g., initial view, after rotation/zoom, for icon snapshot):
   * The requesting system (e.g., `UInventoryRepresentationWidget`, `UItemIconGeneratorComponent`) gets the `UPocketCapture` instance from the Stage Manager (`GetPocketCapture()`).
   * For alpha masks, the Stage Manager calls `SetAlphaMaskedActors` on the `UPocketCapture` instance with the relevant actors (base mesh + attachments).
   * The requesting system calls `CaptureDiffuse()` and/or `CaptureAlphaMask()` on the `UPocketCapture` instance.
   * These calls trigger the internal `CaptureScene` logic, rendering the view from the Stage Manager's camera onto the appropriate `UTextureRenderTarget2D`.
   * The requesting system then accesses the updated render targets using `GetOrCreateDiffuseRenderTarget()` / `GetOrCreateAlphaMaskRenderTarget()` for display (UMG) or readback (Icon Generator).

This separation allows the `APocketLevelStageManager` to focus on scene setup and interaction, while the `UPocketCapture` object, managed by its subsystem, handles the specifics of the rendering pipeline to the target textures.
