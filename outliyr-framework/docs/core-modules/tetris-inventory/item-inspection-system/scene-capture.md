# Scene Capture

The Stage Manager has built a 3D scene inside the pocket level, meshes spawned, attachments socketed, camera positioned. Now that scene needs to become a 2D texture that UMG can display or the icon generator can read back. That translation from 3D world to 2D image is what `UPocketCapture` handles, managed by `UPocketCaptureSubsystem`.

Think of it like a virtual photography studio: the Stage Manager arranges the subject and lights, while the capture system operates the camera and develops the photos.

***

### `UPocketCaptureSubsystem`

This `UWorldSubsystem` manages the lifecycle of all `UPocketCapture` objects in the world.

#### What It Does

* **Creates and destroys** capture objects via `CreateThumbnailRenderer` and `DestroyThumbnailRenderer`
* **Manages texture streaming** so materials on rendered objects stay loaded at the right mip level

#### Key Functions

| Function                                               | Purpose                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CreateThumbnailRenderer(TSubclassOf<UPocketCapture>)` | Creates a new `UPocketCapture` instance, assigns it a unique index, and calls `Initialize`. Typically called once by `APocketLevelStageManager` during `BeginPlay`. |
| `DestroyThumbnailRenderer(UPocketCapture*)`            | Calls `Deinitialize` on the capture object, removes it from tracking, and destroys it.                                                                              |

<details>

<summary>Texture streaming management details</summary>

The subsystem ensures that textures on rendered objects stay loaded at full resolution while they are being captured:

* **`StreamThisFrame(TArray<UPrimitiveComponent*>&)`** - Called internally by `UPocketCapture::CaptureScene`. Marks the rendered primitive components with `bForceMipStreaming = true` for the current frame.
* **Tick logic** - The subsystem tracks which components were streamed last frame. During `Tick`, it resets `bForceMipStreaming = false` for any component that was streamed previously but was not requested this frame. This keeps textures loaded for actively rendered objects without indefinitely forcing mip streaming on objects that are no longer being captured.

</details>

***

### `UPocketCapture`

Each `APocketLevelStageManager` owns one `UPocketCapture` instance. This object encapsulates the configuration and execution of scene capture operations.

#### Core Concept

`UPocketCapture` wraps an internal `USceneCaptureComponent2D` and exposes a simplified interface. You tell it what to render (actors), from what perspective (camera), and it outputs the result onto `UTextureRenderTarget2D` textures.

#### Setup and Configuration

```cpp
// Define the output resolution
SetRenderTargetSize(int32 Width, int32 Height);

// Set which actor provides the camera view (typically the Stage Manager)
SetCaptureTarget(AActor* InCaptureTarget);

// Specify which actors appear in the alpha mask pass
SetAlphaMaskedActors(const TArray<AActor*>& InActors);
```

`SetCaptureTarget` is the crucial call, it finds the `UCameraComponent` within the target actor and uses its location, rotation, FOV, and post-processing settings to define the capture view.

#### Render Targets

The capture system produces up to three render targets, created on demand:

| Render Target  | Format      | Purpose                                         |
| -------------- | ----------- | ----------------------------------------------- |
| **Diffuse**    | `RTF_RGBA8` | Full-color render of the scene                  |
| **Alpha Mask** | `RTF_R8`    | Single-channel silhouette mask for transparency |
| **Effects**    | `RTF_R8`    | Optional channel for specific visual effects    |

```cpp
UTextureRenderTarget2D* GetOrCreateDiffuseRenderTarget();
UTextureRenderTarget2D* GetOrCreateAlphaMaskRenderTarget();
UTextureRenderTarget2D* GetOrCreateEffectsRenderTarget();
```

#### Capture Execution

Three functions trigger rendering, each targeting a different render target:

* **`CaptureDiffuse()`** - Renders the full scene (all attached actors of the capture target) into the diffuse render target using `SCS_FinalColorLDR`.
* **`CaptureAlphaMask()`** - Renders only the actors set via `SetAlphaMaskedActors` into the alpha mask render target. Uses an override material (typically a simple unlit white material) and captures via `SCS_SceneColorHDR` to produce a clean silhouette.
* **`CaptureEffects()`** - Renders using the `EffectMaskMaterial` for specialized effect passes.

<details>

<summary>Inside the CaptureScene function</summary>

All three capture functions call a shared internal `CaptureScene` method. Here is what happens under the hood:

1. Receives the target `UTextureRenderTarget2D`, actor list, capture source mode, and optional override material
2. Gets the `UCameraComponent` from the capture target (`APocketLevelStageManager`)
3. Sets the internal `USceneCaptureComponent2D`'s `TextureTarget` to the provided render target
4. Copies camera settings (view info, post-processing) from the target's camera to the internal capture component
5. Sets `ShowOnlyActors` to the provided actor list
6. **Optimizes show flags** - Disables expensive rendering features (DoF, Motion Blur, AO, GI, Fog, etc.) for performance and clarity in thumbnail renders
7. Sets the `CaptureSource` and applies the override material if provided
8. Calls `CaptureScene()` on the internal `USceneCaptureComponent2D` to execute the render
9. If an override material was used, restores the original materials on the primitive components
10. Calls `UPocketCaptureSubsystem::StreamThisFrame` to manage texture streaming

</details>

{% hint style="info" %}
The show flag optimizations in step 6 are important, they strip away visual effects that look great in gameplay but add noise and cost to item thumbnails. The result is a clean, fast render focused entirely on the item's geometry and materials.
{% endhint %}

***

### Interaction Flow

{% stepper %}
{% step %}
#### Creation

During its `BeginPlay`, the `APocketLevelStageManager` creates a `UPocketCapture` instance via `UPocketCaptureSubsystem::CreateThumbnailRenderer`.
{% endstep %}

{% step %}
#### Configuration

The Stage Manager configures the capture instance: sets the render target size, sets itself as the `CaptureTarget` (providing the camera view), and specifies alpha-masked actors (base mesh + all attachments).
{% endstep %}

{% step %}
#### Rendering

When a render is needed, initial view, after a rotation/zoom change, or for an icon snapshot, the requesting system gets the `UPocketCapture` from the Stage Manager via `GetPocketCapture()`.
{% endstep %}

{% step %}
#### Capture

The requesting system calls `CaptureDiffuse()` and/or `CaptureAlphaMask()`. These trigger the internal `CaptureScene` logic, rendering the Stage Manager's camera view onto the appropriate render targets.
{% endstep %}

{% step %}
#### Consumption

The requesting system accesses the updated render targets:

* **Live inspection:** `UInventoryRepresentationWidget` samples the render targets through a UMG material, the image updates automatically.
* **Icon generation:** `UItemIconGeneratorComponent` reads back the pixel data asynchronously to create a static `UTexture2D`.
{% endstep %}
{% endstepper %}

***

This separation of concerns keeps the system clean: the `APocketLevelStageManager` focuses on scene setup and interaction, while `UPocketCapture` handles the rendering pipeline. Neither needs to know the details of the other's job.
