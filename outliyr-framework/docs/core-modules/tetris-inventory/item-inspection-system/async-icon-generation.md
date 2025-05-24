# Async Icon Generation

While `UInventoryRepresentationWidget` provides live, interactive previews, the `UItemIconGeneratorComponent` offers a mechanism to generate static 2D `UTexture2D` icons for items asynchronously using the same PocketWorlds rendering infrastructure. This is particularly valuable for generating accurate icons for items whose appearance changes (e.g., due to attachments) or when a high-quality, pre-rendered snapshot is preferred over live rendering in certain UI contexts (like inventory grids).

### Purpose

* **Asynchronous Operation:** Generates icons in the background without stalling the game thread, crucial for maintaining responsiveness.
* **High-Quality Snapshots:** Renders the item's detailed 3D model (including attachments) from a specific pose defined in the item's configuration (`InventoryFragment_Inspect::InventoryIconImage`).
* **Visual Consistency:** Ensures icons match the appearance configured via `InventoryFragment_Inspect` and can reflect the item's current visual state if its appearance can change.
* **Optional Caching:** Can cache the generated pixel data for specific item _definitions_ to avoid redundant generation, saving resources for items that don't change visually instance-to-instance (unless attachments are involved in a way that changes the base definition's desired icon).

### Workflow Overview

1. **Setup:** Add the `UItemIconGeneratorComponent` to a relevant Controller or Player State Blueprint using [the experience system](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-components.md). Configure its `IconPocketLevelDefinition` property to point to the same `UIdentifyingPocketLevel` used for regular inspection.
2. **Initialization:** The component automatically spawns its _own dedicated_ Pocket Level instance using the specified definition (distinct from any instance used by `UInventoryRepresentationWidget`). It keeps this instance loaded but streamed out initially.
3. **Request (`GenerateItemIcon`):** An external system (e.g., inventory UI needing an icon for a slot) calls `GenerateItemIcon`, providing:
   * The `ULyraInventoryItemInstance` to generate an icon for.
   * The desired `ImageSizeX` and `ImageSizeY` for the output icon texture.
   * A delegate (`FOnIconReadyDelegate`) to call back when the icon `UTexture2D` is ready.
4. **Caching Check:** The component checks if caching is enabled (`InventoryIconImage.bCacheRenderTarget` in the item's `InventoryFragment_Inspect`) and if a cached icon exists for the item's definition in `CachedIconPixels`. If found, it immediately recreates the texture from cached pixels and executes the callback.
5. **Queueing:** If no cache hit, the request (`FIconRequest`) is added to an internal `IconRequestQueue`.
6. **Processing (`ProcessNextIconRequest`):** If not already busy (`!bIsGeneratingIcon`), the component dequeues the next request, sets `bIsGeneratingIcon = true`, and stores the request details.
7. **Pocket Level Ready (`OnPocketLevelReady`):** Ensures the dedicated pocket level instance, `APocketLevelStageManager`, and `UPocketCapture` are initialized and ready. This happens once after `BeginPlay`.
8. **Staging (`CaptureIcon` -> `DelayedCapture`):**
   * Calls `PocketLevelStageManager->InitialiseSnapCaptor`, passing the `ItemInstance` and target `ImageSize`. This uses the specific `ImageRotation` and `FitToScreenRatio` from the item's `InventoryIconImage` settings (`InventoryFragment_Inspect`) to pose the item correctly for the snapshot.
   * Sets up alpha masking actors.
   * Calls `PocketCaptureInstance->CaptureDiffuse()` and `CaptureAlphaMask()` to render the staged item onto its internal Render Targets.
9. **GPU Readback (`StartAsyncReadback` -> `PollFence` -> `OnReadPixelsComplete`):**
   * **Crucial Step:** Initiates an **asynchronous GPU readback** operation. This is essential to avoid stalling the game thread while waiting for the GPU to finish rendering and transferring pixel data.
   * `StartAsyncReadback`: Enqueues render commands to copy the Diffuse and AlphaMask Render Targets to temporary "staging" textures accessible by the CPU. It also creates and writes to a `FGPUFence`.
   * `PollFence`: A timer periodically checks if the `FGPUFence` has been signaled by the GPU, indicating the copy operation is complete.
   * `OnReadPixelsComplete`: Once the fence is signaled, this function (called back on the game thread via `AsyncTask`):
     * Maps the staging textures to access their pixel data.
     * Reads the raw `FColor` data (Diffuse) and `uint8` data (Alpha).
     * Combines the Diffuse (RGB) and Alpha data into a final `TArray<FColor>`.
     * Creates a new transient `UTexture2D` (`CapturedTexture`).
     * Copies the combined pixel data into the new texture.
     * Updates the texture resource.
     * **Caching:** If caching is enabled for this item type, stores the raw pixel data (`DiffusePixels`, `AlphaPixels`, Width, Height) in the `CachedIconPixels` map using the item definition class as the key.
     * Calls `OnIconGenerationComplete` with the new `CapturedTexture`.
10. **Callback & Next Request (`OnIconGenerationComplete`):**
    * Executes the original `IconReadyCallback` delegate provided in the request, passing the newly generated `UTexture2D`.
    * Resets state (`bIsGeneratingIcon = false`, clears pending request data).
    * Calls `ProcessNextIconRequest` to handle the next item in the queue, if any.
11. **Cleanup (`EndPlay`):** Destroys the dedicated pocket level instance used by the generator component.

### Key Mechanisms

* **Asynchronous GPU Readback:** The use of staging textures and `FGPUFence` is vital for performance. It prevents the game thread from waiting idly for the GPU, allowing icon generation to happen truly in the background.
* **Dedicated Pocket World:** Using a separate pocket world instance (identified by its own tag via the `UPocketLevelBridgeSubsystem`) prevents conflicts if the player is simultaneously using the main live inspection view (which uses a different, unique pocket world instance).
* **`InitialiseSnapCaptor`:** The specific `APocketLevelStageManager` function tailored for posing items according to icon snapshot settings (`ImageRotation`, `FitToScreenRatio`) found in `InventoryFragment_Inspect::InventoryIconImage`.
* **`FIconCache`:** A simple struct holding raw pixel data (`TArray<FColor>`, `TArray<uint8>`) and dimensions. This allows efficient storage in the `CachedIconPixels` map and fast recreation of `UTexture2D` objects without storing bulky texture assets directly in the cache.
* **Request Queue (`TQueue<FIconRequest>`):** Ensures icon generation requests are processed one at a time, preventing race conditions or overwhelming the single pocket world instance dedicated to icon generation.

### Usage Considerations

* **Performance:** While asynchronous, generating many unique, non-cacheable icons (especially complex items with many attachments) still consumes GPU rendering time and CPU time for readback/texture creation.
* **Memory:** Caching icons (`bCacheRenderTarget = true`) consumes memory to store the raw pixel data in the `CachedIconPixels` map. Balance cache benefits against memory usage. Caching is most effective for item _definitions_ whose icons are always the same, regardless of instance data.
* **Setup:** Requires adding the component, configuring the `IconPocketLevelDefinition`, and ensuring items have a correctly configured `InventoryFragment_Inspect` with appropriate `InventoryIconImage` settings (including `bUseAsInventoryImage = true`).
* **Callback Handling:** The system requesting an icon _must_ handle the asynchronous nature. The icon texture is provided via the `FOnIconReadyDelegate` callback, which might execute much later than the initial `GenerateItemIcon` call. UI updates should only happen within the callback.

***

The `UItemIconGeneratorComponent` provides a powerful, albeit complex, method for generating high-quality 2D icons from your 3D item assets on the fly, leveraging the PocketWorlds infrastructure for background rendering and caching.
