# Async Icon Generation

A weapon's icon needs to show its current attachments, a red dot sight, suppressor, and extended magazine. Pre-made icons cannot capture every possible combination. With three attachment slots and five options each, that is 125 unique icons for a single weapon. Add more weapons and the number explodes.

`UItemIconGeneratorComponent` solves this by generating icons on the fly. It uses the same PocketWorlds rendering pipeline as live inspection, but instead of displaying a live render target, it performs an asynchronous GPU readback to produce a static `UTexture2D`, complete with optional caching so the same icon is not generated twice.

***

### What It Provides

* **Asynchronous operation** - Icons generate in the background without stalling the game thread
* **High-quality snapshots** - Renders the full 3D model (with attachments) from a pose defined in `InventoryFragment_Inspect::InventoryIconImage`
* **Visual accuracy** - Icons reflect the item's current visual state, not a generic pre-made image
* **Optional caching** - Stores raw pixel data per item definition to skip redundant generation

***

### The 11-Step Workflow

{% stepper %}
{% step %}
#### Setup

Add `UItemIconGeneratorComponent` to a relevant Controller or Player State Blueprint using [the experience system](../../../base-lyra-modified/gameframework-and-experience/). Configure its `IconPocketLevelDefinition` property to point to a `UIdentifyingPocketLevel` asset.
{% endstep %}

{% step %}
#### Initialization

The component automatically spawns its own dedicated pocket level instance using the specified definition. This instance is separate from any pocket world used by `UInventoryRepresentationWidget`. It starts loaded but streamed out.
{% endstep %}

{% step %}
#### Request

An external system (e.g., inventory UI needing a slot icon) calls `GenerateItemIcon`, providing:

* The `ULyraInventoryItemInstance` to generate an icon for
* The desired `ImageSizeX` and `ImageSizeY`
* A delegate (`FOnIconReadyDelegate`) to call when the `UTexture2D` is ready
{% endstep %}

{% step %}
#### Cache Check

The component checks if caching is enabled (`InventoryIconImage.bCacheRenderTarget` in the item's `InventoryFragment_Inspect`) and if cached pixel data exists for this item's definition in `CachedIconPixels`. On a cache hit, it immediately recreates the texture from stored pixels and fires the callback.
{% endstep %}

{% step %}
#### Queueing

On a cache miss, the request (`FIconRequest`) is added to the internal `IconRequestQueue`.
{% endstep %}

{% step %}
#### Processing

If not already busy (`!bIsGeneratingIcon`), the component dequeues the next request, sets `bIsGeneratingIcon = true`, and stores the request details.
{% endstep %}

{% step %}
#### Pocket Level Ready

Ensures the dedicated pocket level, Stage Manager, and `UPocketCapture` are initialized. This happens once after `BeginPlay` via the `OnPocketLevelReady` callback.
{% endstep %}

{% step %}
#### Staging and Capture

Calls `PocketLevelStageManager->InitialiseSnapCaptor`, passing the item instance and target image size. The Stage Manager uses `ImageRotation` and `FitToScreenRatio` from the item's `InventoryIconImage` settings to pose the item. Then sets up alpha masking actors and calls `CaptureDiffuse()` / `CaptureAlphaMask()` to render onto render targets.
{% endstep %}

{% step %}
#### GPU Readback

Initiates an asynchronous GPU readback, the critical step that avoids stalling the game thread while the GPU finishes rendering and transfers pixel data.
{% endstep %}

{% step %}
#### Texture Creation

Once the GPU fence signals completion, pixel data is read back and a transient `UTexture2D` is created. If caching is enabled, the raw pixel data is stored in `CachedIconPixels` keyed by item definition class.
{% endstep %}

{% step %}
#### Callback and Next Request

The original `FOnIconReadyDelegate` fires with the new texture. State resets (`bIsGeneratingIcon = false`), and `ProcessNextIconRequest` is called to handle the next item in the queue.
{% endstep %}
{% endstepper %}

***

### GPU Readback - The Technical Core

The asynchronous readback is what makes this system production-viable. Without it, the game thread would stall waiting for the GPU to finish rendering every icon.

<details>

<summary>How the async readback works internally</summary>

**StartAsyncReadback:**

1. Enqueues render commands to copy the Diffuse and AlphaMask render targets to temporary "staging" textures that the CPU can access
2. Creates and writes to an `FGPUFence`

**PollFence:**

1. A timer periodically checks if the `FGPUFence` has been signaled by the GPU, indicating the copy is complete
2. This polling avoids blocking the game thread

**OnReadPixelsComplete (called via AsyncTask on the game thread):**

1. Maps the staging textures to access their pixel data
2. Reads raw `FColor` data (Diffuse) and `uint8` data (Alpha)
3. Combines RGB from Diffuse with the Alpha channel into a final `TArray<FColor>`
4. Creates a new transient `UTexture2D`
5. Copies the combined pixel data into the texture and updates its resource
6. If caching is enabled, stores the raw pixel data (`DiffusePixels`, `AlphaPixels`, Width, Height) in the `CachedIconPixels` map
7. Calls `OnIconGenerationComplete` with the finished texture

</details>

***

### Key Mechanisms

#### Dedicated Pocket World

The icon generator uses its own pocket level instance, separate from any live inspection widget. This prevents conflicts if the player is inspecting an item while icons are being generated in the background. Both are tracked independently through the `UPocketLevelBridgeSubsystem`.

#### Request Queue

```
TQueue<FIconRequest> IconRequestQueue
```

Icon requests are processed one at a time. This prevents race conditions and avoids overwhelming the single pocket world instance dedicated to icon generation. When one icon finishes, `ProcessNextIconRequest` dequeues the next.

#### FIconCache

A lightweight struct holding raw pixel data (`TArray<FColor>`, `TArray<uint8>`) and dimensions. This allows efficient storage in the `CachedIconPixels` map and fast recreation of `UTexture2D` objects without storing full texture assets in memory.

#### Cleanup

During `EndPlay`, the component destroys its dedicated pocket level instance through the bridge subsystem.

***

### Performance and Memory Considerations

{% hint style="warning" %}
**Performance:** While asynchronous, generating many unique, non-cacheable icons (especially complex items with many attachments) still consumes GPU rendering time and CPU time for readback/texture creation. Profile if you are generating large batches simultaneously.
{% endhint %}

{% hint style="info" %}
**Memory:** Caching icons (`bCacheRenderTarget = true`) consumes memory to store raw pixel data in the `CachedIconPixels` map. Caching works best for item definitions whose icons are always the same regardless of instance data. For items where every instance looks different (e.g., weapons with varying attachments), caching at the definition level may not help.
{% endhint %}

{% hint style="info" %}
**Setup checklist:**

* Add `UItemIconGeneratorComponent` to the appropriate Blueprint
* Configure `IconPocketLevelDefinition` to point to a valid `UIdentifyingPocketLevel`
* Ensure items have `InventoryFragment_Inspect` with `InventoryIconImage` settings configured (including `bUseAsInventoryImage = true`)
{% endhint %}

{% hint style="warning" %}
**Callback handling:** The icon texture arrives via `FOnIconReadyDelegate`, which may fire well after the initial `GenerateItemIcon` call. UI updates should only happen inside the callback -- never assume the texture is available synchronously.
{% endhint %}

***

The `UItemIconGeneratorComponent` turns the PocketWorlds rendering pipeline into a background icon factory. Every possible attachment combination gets an accurate, high-quality icon, generated on demand, cached where it makes sense, and delivered asynchronously without interrupting gameplay.
