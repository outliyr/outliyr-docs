# PSO Warmup

Unreal Engine 5 titles compile graphics Pipeline State Objects on demand the first time a material, mesh, or visual effect is rendered. On a player's first run of a cooked build, this manifests as a flurry of short hitches during the first few seconds of gameplay, a muzzle flash stutters, a hit effect pops, a death animation spikes a frame. The **PSO Warmup** plugin is a boot-time asset discovery and precache orchestration layer built on top of Unreal's PSO Precache system. It scans reachable project content, loads it during a loading screen, and submits precache requests through `UMaterialInterface::PrecachePSOs` and `UNiagaraSystem::PrecachePSOs` so that the work happens before the player enters gameplay instead of on first render.

### Purpose

* **Substantially reduce first-play shader hitches** across materials and niagara systems. Most player-perceived stutter in a freshly installed build comes from first-time PSO compilation; moving that cost under the loading screen is the single biggest quality-of-play improvement available on cooked UE5 content. The reduction is substantial, not total, some PSO sources sit outside what the plugin can reach, as described at the bottom of this page.
* **Work across every content root automatically.** The plugin scans `/Game/`, every enabled plugin mount, and every registered Game Feature at front-end load, so adding new maps or game features does not require editing a precache list.
* **Stay out of the way of the engine systems it builds on.** PSO Warmup drives `UMaterialInterface::PrecachePSOs` and `UNiagaraSystem::PrecachePSOs`; it does not reimplement them. When Epic improves those systems in future engine versions, the plugin benefits directly.
* **Skip warmup entirely on repeat boots.** A fingerprint of the current build plus the current hardware is persisted on first successful run. Subsequent launches compare the fingerprint and short-circuit if nothing relevant has changed.

### Core Concept

The plugin is a `UGameInstanceSubsystem` that runs through a short sequence of phases on the first load of the front-end map:

{% stepper %}
{% step %}
#### Scanning

Enumerates every mounted content root via `FPackageName::QueryRootContentPaths`, forces the asset registry to index each mount with `ScanPathsSynchronous`, then walks the dependency graph from every discovered root. The result is filtered to materials, static meshes, skeletal meshes, and niagara systems, the four asset classes that produce the PSOs we care about.
{% endstep %}

{% step %}
#### Signature check

If `bSkipIfSignatureMatches` is enabled, the plugin hashes the scanned package list alongside the engine version, build id, RHI, GPU adapter, and driver version. A match against the persisted value means the warmup already ran for this exact combination on this machine, and the plugin short-circuits straight to the Done phase.
{% endstep %}

{% step %}
#### Loading

Streams the filtered asset list in memory-bounded batches via `FStreamableManager`, submits `PrecachePSOs` on each material and mesh, and releases the streamable handles between batches so peak memory stays bounded.
{% endstep %}

{% step %}
#### Preheating _(optional)_

Spawns scanned niagara systems and mesh components invisibly far from the camera, lets them register, and destroys them. Registration fires the engine's native precache path with correct vertex factory context, covering GPU-simulation compute PSOs for niagara, skin VFs for skeletal meshes, and Nanite or instancing variants for static meshes that material-level precache cannot reach. See [Spawn-Preheat](spawn-preheat.md) for the full explanation.
{% endstep %}

{% step %}
#### Done

Writes the fingerprint and broadcasts completion. The loading screen handler releases.
{% endstep %}
{% endstepper %}

The `CommonLoadingScreen` plugin stays visible throughout because the subsystem implements `ILoadingProcessInterface` and returns `true` from `ShouldShowLoadingScreen` until the final phase.

### Key Components Intro

* **`UPSOWarmupSubsystem`:** The central orchestrator. Lives as a `UGameInstanceSubsystem`, hooks `PostLoadMapWithWorld`, and drives the phase state machine. Exposes `OnProgressUpdated`, `OnPhaseChanged`, and `OnWarmupComplete` delegates for UI binding, plus `StartWarmup`, `AddWarmupSeedMap`, and `RegisterPreheatSystem` Blueprint-callable functions for explicit control.
* **`UPSOWarmupSettings`:** Project-wide configuration under Project Settings -> Outliyr -> PSO Warmup. Controls scan scope, batch sizes, time-slice budget, signature behaviour, and the opt-in preheat phase. See [Configuration](configuration.md).
* **`FPSOWarmupScanner`:** Internal asset-discovery component. Builds the root set, forces registry indexing, expands dependencies, filters to precache-eligible classes.
* **Signature cache:** A persisted fingerprint under `[PSOWarmup]` in `GameUserSettings.ini`. Read on boot to decide whether warmup can be skipped; written on successful completion. See [Signature Caching](signature-caching.md).

### Integration

The plugin is enabled automatically when the framework is installed. No code, blueprint, or level changes are required for the default behaviour, the subsystem self-registers with `ULoadingScreenManager` at `Initialize` and fires on first load of the configured front-end map.

The only integration buyers commonly add is a progress bar on their loading widget. Bind to the subsystem's delegates and drive a `UProgressBar` from the fraction value:

```cpp
UPSOWarmupSubsystem* Sub = GetGameInstance()->GetSubsystem<UPSOWarmupSubsystem>();
Sub->OnProgressUpdated.AddDynamic(this, &UMyLoadingWidget::HandleProgress);
Sub->OnPhaseChanged.AddDynamic(this, &UMyLoadingWidget::HandlePhaseChanged);
Sub->OnWarmupComplete.AddDynamic(this, &UMyLoadingWidget::HandleComplete);
```

The `OnPhaseChanged` delegate broadcasts a phase name, `Scanning`, `Loading`, `Preheating`, or `Done`, suitable for switching a status text label. `OnProgressUpdated` broadcasts at roughly 30Hz during active work and carries `(fraction, compiledCount, totalCount)` for progress bars and counters.

### Invalidation

A valid signature is invalidated automatically when any of the following change between boots:

* Engine version or build id.
* RHI (for example switching from DirectX 12 to Vulkan).
* GPU adapter name or driver version.
* The set of packages reached by the scanner, adding, removing, or moving content.

Players updating their GPU driver, patching content, or installing a DLC that introduces new materials will see a fresh warmup on the next launch. No developer action is needed; the plugin detects these changes automatically.

### Disabling

If a project decides PSO Warmup is unnecessary, for example a very small game where the cook alone produces no perceptible stutter, the plugin can be turned off without removing the files:

* **Project Settings -> Outliyr -> PSO Warmup -> Enabled = off.** The subsystem still initializes but does no work. Lowest-impact option.
* **Remove the `PSOWarmup` entry from the `Plugins` array in `OutliyrFramework.uproject`.** Hard disable; the subsystem is never created.

Either path is safe; neither affects the rest of the framework.

### What PSO Warmup does not cover

The plugin addresses every PSO that can be reached through the PSO Precache system with materials, meshes, and niagara systems as inputs. A small minority of first-play hitches come from sources the plugin cannot reach:

* **Loading-screen UI materials.** `CommonUI` widgets, font glyph compute shaders, and loading-screen composition compile on the render thread the first time a widget is drawn. These typically account for a short burst of hitches during the first second of boot, before gameplay is reachable.
* **Lumen and Virtual Shadow Map compute permutations.** Engine-side compute PSOs that are assembled by the renderer itself, not by material precache. Stabilize after a few seconds of scene rendering.
* **Post-process compute** such as temporal anti-aliasing, motion blur, and depth-of-field feature-level permutations. Similar to Lumen, engine-internal, first-use compile.

For most shooter content, these residual hitches are short, happen during the loading-to-menu handoff, and are not perceived by players as gameplay stutter. Explicit coverage would require rendering a calibration scene at boot, which is outside the scope of this plugin.
