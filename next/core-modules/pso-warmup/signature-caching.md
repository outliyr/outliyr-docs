# Signature Caching

Once a warmup completes successfully, the plugin persists a fingerprint of the inputs that would invalidate the GPU driver's opaque PSO cache. On subsequent boots the fingerprint is recomputed and compared against the stored value. If they match, nothing has meaningfully changed, the same PSOs from the previous run are already warm in the driver's cache, and the warmup is skipped entirely. A process that took twenty seconds on first launch takes under one second on every subsequent launch.

### What the signature hashes

The fingerprint is an MD5 of several inputs concatenated with a separator. Any change to any input invalidates the cache.

* **Engine version** via `FEngineVersion::Current().ToString()`. Catches engine patch updates that change shader compiler output or pipeline state layout.
* **Build identifier** via `FApp::GetBuildVersion()`. Catches project rebuilds even when the engine version is unchanged.
* **Shader platform** via `LegacyShaderPlatformToShaderFormat(GMaxRHIShaderPlatform)`. Distinguishes between SM5, SM6, Vulkan, and other shader formats.
* **RHI name** via `GDynamicRHI->GetName()`. Catches RHI switches, for example DirectX 12 to Vulkan.
* **GPU adapter** via `GRHIAdapterName`. Changes if the player moves the install to a machine with a different GPU.
* **Internal and user driver versions** via `GRHIAdapterInternalDriverVersion` and `GRHIAdapterUserDriverVersion`. Driver updates invalidate the opaque driver cache, so they must invalidate ours too.
* **Scan digest**, a hash of the sorted package names discovered by the scanner. Captures any content addition, removal, or move that would affect the precache set.

The scan digest is the most important entry from a content-pipeline perspective. It means a patch that adds new materials, removes old ones, or moves content between plugins will automatically trigger a fresh warmup on the next launch, no developer action required.

### Build-version discipline

The scan digest catches package additions, removals, and renames, but does not catch content edits to a package whose name is unchanged. If a developer saves an updated material without adding or removing any asset, the package list hashes identically to the previous run, and the signature will match even though the cook will now produce different PSOs. End users could skip warmup on a content-only patch and render with stale PSO coverage.

`FApp::GetBuildVersion()` and `BUILT_FROM_CHANGELIST` are part of the signature specifically to handle this case. Any patch that bumps either value invalidates every installed player's signature and forces a fresh warmup on the next launch. The operational requirement is:

* **Bump `FApp::GetBuildVersion()` on every content-impacting patch.** Most studios do this automatically via a CI-stamped build number that increments per cook.
* **If your build pipeline does not stamp versions automatically,** treat the version number as a content-patch invariant and bump it manually whenever materials, meshes, or Niagara systems are touched.

The plugin cannot detect content edits on its own in a shipped build because cooked assets live inside `.pak` / `.utoc` containers, not loose `.uasset` files on disk. Build-version discipline is the contract consumers rely on to keep the signature correct across content patches.

If you prefer a belt-and-braces approach, leave `bSkipIfSignatureMatches=false` in shipping builds and accept a short warmup on every launch. The trade-off is a roughly one-to-twenty-second loading screen on every boot instead of only on first launch, in exchange for guaranteed freshness without a discipline requirement.

### Where the signature lives

The persisted value is written to `GameUserSettings.ini` under the `[PSOWarmup]` section:

```ini
[PSOWarmup]
Signature=8B9F1F95D6E630A02811FF8450BA52EC
```

The file path depends on the build:

* **Editor launches:** `<Project>/Saved/Config/WindowsEditor/GameUserSettings.ini`.
* **Packaged builds:** `<Install>/<Project>/Saved/Config/Windows/GameUserSettings.ini`.

`GameUserSettings.ini` is chosen deliberately. It is per-user writable in every UE build configuration, survives an Epic-Games-Launcher reinstall, and the engine already flushes it reliably. Consuming developers do not need to provision a writable path themselves.

### When the signature invalidates automatically

Any of the following changes between launches invalidates the match and triggers a fresh warmup:

* Shipping a game patch that changes content referenced by maps, blueprints, or other discoverable roots.
* The player updating their GPU driver.
* The player switching RHI through a launch argument or Project Settings.
* A reinstallation or move to different hardware.
* An engine hotfix that changes the version string.

The plugin detects all of these automatically. There is no developer-facing configuration for invalidation triggers because the hash inputs cover every relevant dimension.

### When to force a re-warmup

During development or QA, you may want to force a fresh warmup every launch to observe the behaviour or to measure cold-boot timings. Two approaches:

* **Toggle `bSkipIfSignatureMatches` off** under Project Settings -> Outliyr -> PSO Warmup -> Signature. The signature still gets written on successful warmup, but is never consulted on boot. Flip back on when done measuring.
* **Delete the `[PSOWarmup]` section** from `GameUserSettings.ini` manually. One-shot approach; the next launch will do a full warmup, then persist a fresh signature.

During development you can also invoke the subsystem's `ResetCachedWarmupFingerprint` Blueprint function (if your project exposes one) to clear the persisted signature programmatically, for example from a debug command.

### Why signatures are only written on clean runs

The plugin persists a signature only when a warmup completes through the Done phase without a fatal interruption. If an asset-load failure or cancellation aborts the run mid-way, the signature is intentionally not written. This prevents a partially-successful first launch from being incorrectly treated as fully cached on the next boot, which would leave players with uncompiled PSOs and the hitches the system is meant to reduce.

In practice this means: a failed run does no harm beyond the wasted time; the next launch will simply attempt warmup again.

### Interaction with the driver's own cache

Both the plugin's signature and the GPU driver's opaque PSO cache need to be valid for a subsequent boot to be fast. If only the plugin's signature matches but the driver cache has been cleared, for example after a driver reinstall that kept the game directory intact but wiped `%LOCALAPPDATA%\NVIDIA\DXCache\`, the boot will be fast from the plugin's perspective but will still hitch as the driver recompiles PSOs on first render.

The plugin cannot detect this edge case directly because it has no visibility into the driver's cache state. Driver updates are captured through the `GRHIAdapterUserDriverVersion` input, which invalidates the signature and forces a fresh warmup. Manual cache deletion by a user is rare enough not to warrant a separate mechanism; if it happens, the driver will repopulate its cache during the first boot after, and subsequent boots return to normal behaviour.
