# Supported Traits and Extension

A pose reconstructs correctly only if every trait that carried state across ticks is put back exactly where it was. "Supported" means precisely that: the trait either reconstructs from the restored timelines and variables alone, or it has a **capturer** that snapshots and restores its cross-tick state. A trait that carries hidden temporal state with no capturer reconstructs to the wrong pose.

***

## What reconstructs without a capturer

Any trait whose entire cross-tick state is its timeline position or a graph variable needs no dedicated capturer. The restored timelines and the generically captured variables already put it back. Sequence players, mirroring, choosers, and layer selection fall in this group: replaying the graph from the restored timelines and variables reproduces them.

## Traits with a capturer

The rest carry state that cannot be recomputed from the timelines, a smoothed weight mid-transition, a state machine's active state, a motion-matching search result, a control rig's node memory. Each of these has a capturer that snapshots its state at capture and writes it back at restore.

| Trait                                           | State the capturer preserves                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `BlendStack`                                    | The set and order of child clips currently on the stack.                                                |
| `InlineSubGraph`                                | The child graph instances an inline subgraph has allocated.                                             |
| `BlendByBool`                                   | The active branch and its transition.                                                                   |
| `DeadBlending`                                  | The decaying pose the dead-blend is carrying.                                                           |
| `BlendSmoother` / `BlendSmootherPerBone`        | The in-flight smoothed blend weights, whole-pose and per-bone.                                          |
| `StateTree`                                     | The state tree trait's active state and instance data.                                                  |
| `MotionMatching` / `PoseHistory`                | The current search result and the pose history the next search reads, so the re-search is reproducible. |
| `ApplyAdditive`                                 | The additive layer's cross-tick state.                                                                  |
| `BlendSpace`                                    | The blend space player's sample position and phase.                                                     |
| `StrafeWarping` / `Steering` / `OffsetRootBone` | The warping and root-offset state that evolves with root motion.                                        |
| `ControlRig`                                    | The rig's RigVM work memory, so temporal rig nodes (springs, foot locks) resume rather than restart.    |

> [!INFO]
> The order of the capturer list is load-bearing. Where two captured traits share a stack, a trait that rebuilds the stack's child set runs before any smoother whose restore reads that rebuilt set. Keep new entries in the right place relative to the structural traits.

***

## Adding a capturer

A consuming project supports its own stateful trait by adding a capturer. The pattern is the same for every trait in the table above.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Define a snapshot struct

Declare a `USTRUCT` holding exactly the trait's cross-tick state, nothing recomputable. This is what a captured frame stores for the trait.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Implement capture and restore

Write a capture function that reads the trait's instance data off the stack into the snapshot, and a restore function that writes the snapshot back onto a matching stack. Both share the fixed signatures the registry expects, so they can be held as plain function pointers.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Register in the ordered list

Add an entry, the capture and restore functions, the snapshot struct, and a debug name, to the ordered capturer list, placed correctly relative to any structural trait it shares a stack with.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Validate with the determinism audit

Exercise the trait through the audit (below) and confirm it reconstructs deterministically before relying on it.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

> [!DANGER]
> Capturing a trait whose state has no public accessor means reading the trait's instance-data layout from engine-internal headers. Those layouts are not a stable interface, so a capturer written against them is **engine-version fragile** and may need revisiting on an engine upgrade. This is inherent to the approach, not a defect, but it is why every capturer should be re-validated after an engine update.

***

## The determinism audit

The plugin ships a determinism audit that answers one question per trait: does a reconstructed pose match the live one bit for bit? It poses a graph live over a span of ticks, then reconstructs a scattered sample of those ticks from a clean instance and requires every reconstructed pose to hash identically to the live one.

The verdict distinguishes the outcomes that matter:

| Verdict           | Meaning                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deterministic** | The reconstructed pose matched the live one on every sampled tick. The trait is safe on the rewound path.                                                          |
| **Divergent**     | The reconstruction differed. The trait carries temporal state the capture does not reach, and must gain a capturer for that state or be kept off the rewound path. |

When you add a capturer, add a graph that exercises the trait to the audit and confirm it moves from divergent to deterministic. This is the intended way to prove a new trait is supported.

***

## The world-query hazard

There is one class of trait no capturer can fix: a trait whose input is **queried from live external state at evaluation time** rather than flowing through the graph. The clearest example is a motion-matching trajectory generated from the live movement component each tick. At capture time that trajectory reflects the real, moving character. At reconstruction time the headless evaluator has no live movement component, so the trait regenerates a different trajectory, and the pose diverges even though the motion-matching _state_ was captured perfectly.

The symptom is distinctive: the part of the body driven by the live query reconstructs wrong while everything else is correct.

The fix is not a capturer but a **data-flow change**. Route the external input through captured state instead of a live query:

* compute the value once, on the live tick, and write it into a graph **public variable**, then have the trait read the variable;
* the variable is captured generically with the rest of the frame, so reconstruction feeds the trait the same value it saw live.

The rule of thumb: a trait may read anything that flows through the graph (timelines, variables, its own captured state), but it must not reach outside the graph for input on the tick it evaluates. Anything read from the live world at evaluation time cannot be rewound.
