# Gameplay Cues

Damage lands. Shield sparks fly. A health bar shakes. A hit marker flashes. None of these affect game state, they're purely cosmetic responses to gameplay events. Gameplay cues handle this feedback layer.

***

### How Cues Work

Cues are triggered by gameplay tags matching the `GameplayCue.*` prefix. When a matching tag fires, the cue system finds the corresponding handler and runs it. There are three event types:

| Type    | When                  | Example                                       |
| ------- | --------------------- | --------------------------------------------- |
| Execute | One-shot event        | Grenade explosion, hit impact                 |
| Add     | Ongoing effect starts | Shield activation glow, burning DOT particles |
| Remove  | Ongoing effect ends   | Shield deactivation, fire extinguished        |

Cues can be implemented as Blueprints (static handlers for one-shot events, actor-based handlers for ongoing effects that need to track state between Add and Remove) or in C++.

***

### Triggering Cues

**From a gameplay effect:** Add a `GameplayCue.*` tag to the effect's Gameplay Cue Tags array. The cue fires automatically when the effect applies (Add) and when it expires (Remove). Instant effects trigger Execute.

**From code or abilities:** Call `ExecuteGameplayCue()`, `AddGameplayCue()`, or `RemoveGameplayCue()` directly on the ASC. Useful for cues that aren't tied to an effect.

Either way, the cue receives context about what caused it, the instigator, target, hit location, and the [custom effect context](gameplay-effects.md#the-custom-effect-context) with weapon source info.

***

### The Custom Cue Manager

A project with hundreds of gameplay cues can't load them all at startup, it would bloat memory and extend load times. The framework's cue manager (`ULyraGameplayCueManager`) loads cue assets on demand instead of all at once.

When a cue is first triggered, the manager async-loads the handler in the background without blocking the game thread. Previously used cues can be preloaded based on tag references in loaded assets, as gameplay tags are loaded during asset loading, any tag matching a known cue triggers an early async load of its handler. Cues preloaded this way are automatically cleaned up when the assets that referenced them are garbage collected.

The loading behavior is configurable per-project in the editor.

<details class="gb-toggle">

<summary>Why a custom cue manager?</summary>

The engine's default manager loads all cue handlers at startup. This works for small projects but becomes a bottleneck as the project grows. The custom manager trades first-trigger latency (a brief async load on first use) for dramatically faster startup and lower memory usage. On dedicated servers, cue loading is skipped entirely since there are no visuals to render.

</details>
