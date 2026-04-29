# Spawn Preheat

An opt-in phase that runs after the main Loading phase. It covers PSO sources that material-level precache alone cannot reach, by instantiating invisible components whose registration triggers the engine's native precache path with correct render context. Two independent toggles control which content types go through the phase: Niagara systems and meshes.

### Why the phase exists

`UMaterialInterface::PrecachePSOs` submits precache requests for a material against a specific vertex factory list. That covers the case where you know in advance which vertex factory a material will render with. For realistic project content the answer is "it depends":

* **Niagara GPU-simulation compute shaders** are compiled by the renderer the first time a system actually initializes its GPU simulation, which happens when a Niagara component's scene proxy goes through a render pass. `UNiagaraSystem::PrecachePSOs` on a cold-loaded system is a partial measure, not a replacement for a real render.
* **Skeletal meshes** use skin vertex factories (`FGPUSkinPassthroughVertexFactory` family), not `FLocalVertexFactory`. Submitting precache for a skin-rendered material against `FLocalVertexFactory` produces PSOs that the renderer never asks the driver for.
* **Nanite, instanced static, and spline meshes** each bring their own vertex factory. A hardcoded list would either be long and brittle or omit common cases.

The cleanest way to cover all of these is to let the engine fire its own precache path. `UPrimitiveComponent::PrecachePSOs` fires during component registration and picks the correct vertex factory based on the component type and its runtime state. The preheat phase takes advantage of this: spawn an invisible component, let the engine precache fire, destroy the component. No manual VF guessing, no stale API assumptions when engine versions shift.

### How it runs

After the Loading phase completes and the configured settle delay elapses, the subsystem:

1. Spawns a single hidden host actor at `FVector(1e7, 1e7, 1e7)` to own every mesh preheat component.
2. Builds three queues from the scanner's filtered asset list, static meshes, skeletal meshes, and Niagara systems, plus any Niagara systems explicitly registered via `RegisterPreheatSystem`.
3. Drains the queues into a shared active-component slot pool, capped by `MaxConcurrentPreheats`. Mesh queues drain first per round because each mesh component retires after one frame, keeping slot churn high.
4. For each active component, waits the configured frame budget, then destroys it. Mesh components use a one-frame budget since the engine-native precache fires on registration. Niagara components use `FramesPerPreheat` frames because their GPU simulation needs a live tick to initialize.
5. Checks elapsed phase time against `PreheatTimeoutSeconds`. If the timeout hits first, remaining entries are flushed and a warning logged.
6. Destroys the host actor and transitions to the Done phase once every queue is empty and no active components remain.

### Spawn details per type

* **Static mesh:** `NewObject<UStaticMeshComponent>` attached to the host actor's root, `SetStaticMesh` + `SetVisibility(false)` + `SetHiddenInGame(true)` + `SetCollisionEnabled(NoCollision)` + `RegisterComponent`. Registration fires native `PrecachePSOs` with correct vertex factory context, including Nanite and instancing variants when the mesh's render data calls for them.
* **Skeletal mesh:** `NewObject<USkeletalMeshComponent>` similarly attached and configured, using `SetSkeletalMeshAsset` for the UE 5.6 non-deprecated API. Engine-native precache picks the correct skin vertex factory family.
* **Niagara system:** keeps the existing `UNiagaraFunctionLibrary::SpawnSystemAtLocation` path, which creates its own auto-actor. `SetVisibility(false)` on the returned component. The three-frame default budget gives GPU emitters time to initialize their simulation.

### Safety rails

Unbounded preheat would stall boot indefinitely on content-heavy projects. The existing rails bound runtime and memory.

* **`MaxConcurrentPreheats`** bounds the number of live preheat components at any one moment across all three queues. Keeps peak memory and GPU per-frame cost bounded. Default is 8.
* **`FramesPerPreheat`** bounds how long each Niagara component is allowed to run. Mesh components are not affected; they always retire after one frame since engine-native precache fires on registration. Default is 3.
* **`PreheatTimeoutSeconds`** is the hard cap on the whole phase. If the queues are not drained within the window, typically because a project has an unusually large number of preheat candidates or the frame budget is too tight, remaining entries are skipped so boot does not hang. Default is 10 seconds.
* **`PreheatSettleDelaySeconds`** sits between the Loading phase completing and the Preheat phase starting. Gives in-flight material precache requests time to finish before component registrations re-submit the same materials, which can otherwise trigger an engine assertion in `FMaterialPSORequestManager::MarkCompilationComplete`. Default 5 seconds, sized for mesh preheat on projects with many materials. Lower to 2 seconds if mesh preheat is off and boot time matters.

### When to enable each toggle

Two independent settings: `bEnableNiagaraSpawnPreheat` and `bEnableMeshSpawnPreheat`. Both default off because they trade extra boot seconds for first-play smoothness, and not every project wants the trade.

**Enable `bEnableMeshSpawnPreheat` when:**

* Your game uses skeletal meshes in gameplay contexts, characters, weapons, animated props.
* Your content uses Nanite, instanced static meshes, or spline meshes extensively.
* Measured testing shows residual graphics-PSO hitches during gameplay on first spawns.

**Enable `bEnableNiagaraSpawnPreheat` when:**

* Your game relies heavily on GPU-emitter Niagara VFX for combat feedback, muzzle flashes, impacts, explosions, death effects.
* Measured testing shows residual compute-PSO hitches during gameplay.
* Your project can afford an additional few seconds of loading screen on cold-cache boots.

**Leave them off when:**

* Your content is primarily CPU-simulation Niagara and static-mesh-rendered materials, where the base Loading phase alone covers the work.
* Boot time is tightly constrained, for example, a mobile title where every second on the loading screen is measured.
* Testing shows the base Loading phase alone leaves no observable gameplay stutter.

A practical benchmark from a Lyra-based shooter: the Loading phase cut PSO hitches by about half. Enabling the mesh preheat removes the remaining skeletal and Nanite hitches that would otherwise appear on first character spawn or first weapon equip. Enabling the Niagara preheat removes the compute-PSO hitches on first VFX spawn. Together they add roughly 3-8 seconds to the loading screen depending on content count; individually they are additive but cheaper.

### Registering extra Niagara systems

Most Niagara systems are picked up automatically from the scanner's filtered asset list. Systems that arrive after the scan runs, DLC content, systems referenced only via runtime string paths, or content gated behind a late-activating Game Feature, can be added to the queue explicitly:

```cpp
UPSOWarmupSubsystem* Sub = GetGameInstance()->GetSubsystem<UPSOWarmupSubsystem>();
Sub->RegisterPreheatSystem(TSoftObjectPtr<UNiagaraSystem>(MyLateLoadedSystem));
```

The API is also available from Blueprint as `Register Preheat System`. Registered systems are merged with auto-discovered systems; duplicates are handled by a set-based dedup.

Calling `RegisterPreheatSystem` after the Preheat phase has already begun adds the system to the queue mid-flight, provided the timeout has not expired. Calling it after the phase has finished has no effect; the system will instead get caught by the runtime proxy-creation precache the first time it spawns in gameplay.

There is currently no equivalent API for registering extra meshes explicitly. Mesh preheat relies entirely on auto-discovery from the scanner, which covers every static and skeletal mesh reachable from configured roots.

### What the loading screen shows

When the subsystem transitions into Preheat, it resets the progress counters so the bound UI reflects preheat scope rather than carrying over the final Loading-phase total.

* `OnPhaseChanged` broadcasts with the name `"Preheating"`. Consuming widgets typically swap their status text to something like "Preparing effects..." in response.
* `OnProgressUpdated` starts at `(0, 0, QueueSize)` and climbs as components retire. Final broadcast is `(1.0, QueueSize, QueueSize)` when the phase ends. `QueueSize` is the combined count across all three queues.
* The `ShouldShowLoadingScreen` reason string emitted for `CommonLoadingScreen` debug logging reads `"Preparing effects... X / Y"` during the phase.

The loading screen stays visible throughout; no additional wiring is required.

### Interactions with other phases

Preheat is always the final phase before Done when any toggle is on. It cannot run without a successful scan, and it is skipped entirely if the signature check short-circuits the warmup to Done directly.

If `PostWarmupHoldSeconds` is non-zero, the hold delay applies after Preheat completes, keeping the loading screen visible for the grace window before handing off to the front-end menu.
