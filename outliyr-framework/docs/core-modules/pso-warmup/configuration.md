# Configuration

All PSO Warmup behaviour is controlled from **Project Settings -> Outliyr -> PSO Warmup**. Values are persisted in `Config/DefaultGame.ini` under `[/Script/PSOWarmup.PSOWarmupSettings]` and baked into the packaged build when the project cooks. Runtime overrides are possible by writing the same section into `Saved/Config/Windows/Game.ini`.

This page is organized by category, matching the layout in the editor.

<figure><img src="../../.gitbook/assets/image (279).png" alt=""><figcaption></figcaption></figure>

## General

| Setting                | Default                                     | Purpose                                                                                                                                           |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bEnabled`             | `true`                                      | Master toggle. When `false`, the subsystem still initializes but does no work.                                                                    |
| `bAutoStartOnFrontend` | `true`                                      | Triggers warmup automatically on the first load of `FrontendMap`. Set to `false` if you prefer to call `StartWarmup` manually from gameplay code. |
| `FrontendMap`          | `/Game/System/FrontEnd/Maps/L_LyraFrontEnd` | Map whose `PostLoadMapWithWorld` initiates the warmup run. Change this if your project uses a different front-end or a dedicated boot map.        |

## Roots

Controls which assets the scanner considers as starting points for the dependency walk.

| Setting                  | Default | Purpose                                                                                                                                                                                                                                                           |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bSeedFromAssetManager`  | `true`  | Adds every primary asset registered with `ULyraAssetManager` to the root set. Covers `ULyraGameData`, `ULyraPawnData`, and anything else the game declares as a primary asset.                                                                                    |
| `bSeedFromGameFeatures`  | `true`  | Adds every registered `UGameFeatureData` plus a recursive enumeration of each Game Feature's mount point. Required because Lyra-style Game Features declare content via path-based scan rules that a pure dependency walk from the feature data alone would miss. |
| `WarmupRoots`            | empty   | Explicit additional asset roots. Use for content that lives outside any Game Feature and is not reachable through a primary asset, such as standalone test maps or blueprints.                                                                                    |
| `PackageExcludePrefixes` | empty   | Blocks any package whose name starts with one of the listed strings from entering the root set, even if an automatic source would otherwise include it. Useful for excluding editor-only content subtrees accidentally reachable through soft references.         |

## Asset Types

Filters applied after dependency expansion. A package reaches the final "precache candidates" list only if its primary asset class matches one of the enabled toggles.

| Setting               | Default | Purpose                                                                                                                                       |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `bScanMaterials`      | `true`  | Include every `UMaterialInterface` derivative (`UMaterial`, `UMaterialInstanceConstant`).                                                     |
| `bScanStaticMeshes`   | `true`  | Include every `UStaticMesh`. Submitted with `FLocalVertexFactory`.                                                                            |
| `bScanSkeletalMeshes` | `true`  | Include every `USkeletalMesh`. Skeletal mesh components still rely on runtime proxy-creation precache for their full vertex factory coverage. |
| `bScanNiagaraSystems` | `true`  | so emitter materials are reached by the scan.                                                                                                 |

## Performance

Controls how aggressively the warmup consumes game-thread time and memory during its run.

| Setting                       | Default | Purpose                                                                                                                                                                    |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoadBatchSize`               | `100`   | Number of assets loaded per streamable batch. Lower values bound peak memory; higher values complete faster. Drop to 25-50 on memory-constrained targets.                  |
| `MaxProcessingTimeMsPerFrame` | `5.0`   | Per-frame game-thread budget, in milliseconds, for scan and submit work. At 60fps this leaves roughly 11ms for rendering the loading screen, keeping UI animations smooth. |
| `MaxPendingEnginePrecompiles` | `200`   | Reserved knob for pacing batches against the engine compile queue. Not actively consulted in the current implementation but exposed for future use.                        |
| `bForceGCBetweenBatches`      | `true`  | Requests a non-full-purge garbage collection pass after each batch is submitted. Keeps peak memory bounded on large projects.                                              |

## Signature

Controls the skip-on-match logic. See [Signature Caching](signature-caching.md) for the full treatment.

| Setting                   | Default | Purpose                                                                                                                                                                                                           |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bSkipIfSignatureMatches` | `true`  | When `true`, a successful warmup persists a fingerprint; subsequent boots with a matching fingerprint skip the entire load-and-precache pass. Turn off during development to force a full re-warmup every launch. |

## UI

| Setting                 | Default | Purpose                                                                                                                                                                            |
| ----------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PostWarmupHoldSeconds` | `0.0`   | Extra seconds to keep the loading screen visible after warmup completes. Useful for absorbing texture streaming at the transition point between loading screen and front-end menu. |

## Timeouts and priority

| Setting                              | Default | Purpose                                                                                                                                                                                      |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PrecacheDrainTimeoutSeconds`        | `120.0` | Ceiling on the Draining phase. Reaching it finishes the warmup and logs a warning rather than holding the loading screen on a driver that has stopped making progress.                       |
| `LoadPhaseTimeoutSeconds`            | `300.0` | Ceiling on the Loading phase. Reaching it abandons any batches still outstanding and moves to Draining.                                                                                      |
| `bBoostPrecachePriorityDuringWarmup` | `true`  | Raises every precache request to the highest priority while the warmup runs. Boot has the machine to itself, so there is nothing to yield to.                                                |
| `bValidateEngineCVars`               | `true`  | Logs a warning when a console variable the warmup depends on is missing or set to a value that weakens coverage. These variables are read-only and can only be set from `DefaultEngine.ini`. |

## Advanced

| Setting                      | Default | Purpose                                                                                                                                                                            |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bAlsoOpenPipelineFileCache` | `false` | Optional additional layer that opens a shipped `.upipelinecache` file in parallel with PSO Precache. Useful for teams that record a stable cache at cook time.                     |
| `bIncludeEngineContent`      | `false` | Extends the scanner to `/Engine/` and `/Script/` roots. Normally left off because engine content rarely produces project-specific first-play stutter and multiplies the scan cost. |
| `bVerboseLogging`            | `false` | Per-asset verbose logging during scan and precache. Disable for shipping builds. Useful when diagnosing coverage gaps.                                                             |

## CVar relationship

The plugin drives Unreal's PSO Precache system but does not configure it. Every variable below is read-only, which means the engine only accepts a value read from configuration at startup, so the framework sets them in `Config/DefaultEngine.ini`. The plugin reads them back and warns when one is missing or weakened; the master switch `r.PSOPrecaching` is the only one it sets itself.

| CVar                                             | Value | Purpose                                                                                                                                                                                                        |
| ------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `r.PSOPrecaching`                                | `1`   | Master switch for the engine's PSO precache system.                                                                                                                                                            |
| `r.PSOPrecache.Components`                       | `1`   | Gathers component pipeline states as assets load, with the vertex factory context each component actually uses. This is what covers skinned, Nanite, instanced, landscape, and water factories.                |
| `r.PSOPrecache.GlobalShaders`                    | `1`   | Allows global shader precache.                                                                                                                                                                                 |
| `r.PSOPrecache.Resources`                        | `1`   | Enables resource-level precache collection.                                                                                                                                                                    |
| `r.PSOPrecache.ProxyCreationStrategy`            | `1`   | Delays a new primitive's proxy until its pipeline state is ready, so a gap in coverage becomes a late spawn rather than a stall. Set `2` to draw a fallback material instead, which never stalls but does pop. |
| `r.PSOPrecache.ParticlePrecachingTime`           | `3`   | Precaches particle systems at asset load as well as at component creation.                                                                                                                                     |
| `r.PSOPrecache.UseBackgroundThreadForCollection` | `1`   | Moves precache data collection off the game thread.                                                                                                                                                            |
| `r.PSOPrecache.KeepInMemoryUntilUsed`            | `1`   | On NVIDIA and Qualcomm, keeps precached pipeline states resident until first use so the driver does not rebuild them at the moment they are needed. Bounded by the `KeepInMemory*MaxNum` variables.            |

These CVars are independent of the plugin's settings; they are engine-level switches the framework enables once at the project level.

## Runtime overrides

To toggle a setting in an already-packaged build without repackaging, create `Saved/Config/Windows/Game.ini` under the installed game directory and add the section with the override:

```ini
[/Script/PSOWarmup.PSOWarmupSettings]
bEnabled=False
```

User config overrides the packaged defaults. Used primarily for A/B testing during evaluation rather than for shipping configuration.
