# Control Point Core

Welcome to the documentation for the **ControlPointCore Plugin**, the shared capture-point logic behind Domination, Hardpoint, Headquarters, and Payload. It exists because those modes are, mechanically, the same game: players stand in a volume, a bar fills, ownership changes, and a team scores for holding it. What differs between them is policy, how contests resolve, when scoring pauses, and whether points rotate, so the plugin ships one authoritative control point actor whose behaviour is chosen through settings, and each mode supplies the rules around it. Payload stretches the idea furthest: its cart is a control point subclass whose capture volume rides a spline, with ownership deciding which way it rolls.

The plugin deliberately stops at the edge of the point. It decides ownership, progress, and contest state, and announces every transition as a gameplay message, but it never awards a single point of score and never decides which point is active next. Those calls belong to the mode, which is what lets three very different scoreboards share one actor.

## What You Get

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ControlPointCore Plugin                       │
├────────────────────────┬────────────────────────────────────────────┤
│                        │                                            │
│   Control Point Actor  │   Authoritative capture volume and state   │
│   Capture Policies     │   Contest, takeover, and scoring rules     │
│   Lifecycle Commands   │   Lock, activate, and reset from the mode  │
│   Gameplay Messages    │   Every transition announced for scoring   │
│   Point UI             │   Status row, world markers, capture VFX   │
│   Bot Evaluator        │   StateTree goal selection over all points │
│                        │                                            │
└────────────────────────┴────────────────────────────────────────────┘
```

## Key Concepts

* **One Actor, Many Modes** — `AControlPoint` owns presence, progress, ownership, and contest state on the server, replicating each piece for UI. Domination's always-on points, Hardpoint's rotating hill, and Headquarters' locked objectives are all the same actor under different settings and mode direction, and Payload's moving cart is a C++ subclass of it.
* **Policies, Not Subclasses** — How a contested point behaves, what happens to a rival's half-filled bar, and when an owner stops scoring are each an enum on the capture settings. Changing the feel of a mode is a settings change on the placed point, not a new class.
* **The Mode Owns The Consequences** — The point reports; the mode acts. Scoring components poll `ShouldScore` and listen for the captured and recaptured messages, which carry the contributing players for credit. Rotation-style modes drive `Activate`, `Deactivate`, and `Lock` from their own timers.
* **Messages As The Only Coupling** — Every transition, ownership, contest, progress reset, lock, activation, broadcasts a typed gameplay message. Scoring, spawning rules, UI, and bots all subscribe; none of them reference each other.
* **Bots Understand Points Natively** — A StateTree evaluator keeps a cached snapshot of every point and publishes a single goal, defend, capture, neutralize, reinforce, or rotate, so mode bots fight over objectives without bespoke AI per mode.

## How It Builds On Base Lyra

| Base System                                                            | How ControlPointCore Uses It                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [Team](../../base-lyra-modified/team/)                                 | Presence is counted per team through the team subsystem, and ownership is a team ID; the optional team whitelist gates who may interact |
| Gameplay Message Subsystem                                             | Every state transition is broadcast as a typed message that mode scoring, spawning, UI, and bots subscribe to                           |
| [Indicator System](../../base-lyra-modified/ui/lyra-indicator-system/) | The shipped point Blueprint registers a world marker indicator so every point is visible through walls with its live state              |

{% hint style="info" %}
This plugin is `ExplicitlyLoaded`; nothing exists at runtime until an experience that uses control points enables it. The Domination, Hardpoint, Headquarters, and Payload experiences are its four shipped consumers and the reference for every integration pattern.
{% endhint %}

## Documentation Structure

| Section                                             | What It Covers                                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [**The Capture Model**](capture-model.md)           | Presence, the capture and neutralize tracks, the contest, takeover, and scoring policies, empty-point decay, and the lifecycle commands |
| [**Setup & Integration**](setup-and-integration.md) | Placing and tuning points, wiring a mode's scoring and rotation, the message reference, the shipped UI, and the bot evaluator           |

