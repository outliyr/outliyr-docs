# Setup and Integration

A control point mode is three pieces: points placed in the level, a mode that reacts to their messages, and the UI and bots that follow along on their own. Domination, Hardpoint, Headquarters, and Payload are the shipped consumers, and between them they demonstrate every pattern here, always-on points, a rotating hill, gated objectives, and an escort cart.

***

### Placing And Tuning Points

`B_ControlPoint` is the placeable Blueprint over the C++ actor; drop one per objective and size its capture sphere to the space. Everything about how it plays lives in its **Settings**: the point's display letter, the capture timing, the three [policies](capture-model.md#the-policies), the empty-point decay, and what locking or deactivating does to its state. The one structural decision at placement time is `bStartsActive` in the activation settings, on for an always-on layout, off for a rotation the mode will drive.

The shipped Blueprint also carries the point's presentation: the capture ring VFX and material react to progress and ownership, and it registers a world marker through the [indicator system](../../base-lyra-modified/ui/lyra-indicator-system/) so every point is readable through walls. A mode that wants different presentation subclasses or replaces the Blueprint; the state machine underneath does not change.

***

### Wiring A Mode

The plugin never scores and never rotates; a mode component does both by reading the point's state and listening to its messages. The shipped patterns:

* **Scoring while held**, Domination's shape: the scoring component gathers the placed points, and on its own pulse asks each point `ShouldScore(TeamId)`, awarding `ScorePerPulse` for every point that answers yes. The point's scoring policy decides what a contest does to that answer, so the scoring loop itself stays one line of logic.
* **Capture and recapture credit**: the captured and recaptured messages carry the contributing players, everyone inside within the `CaptureAssistGraceSeconds` window, capped by `MaxContributorsToAward`, so per-player credit is a message handler, not presence bookkeeping.
* **Rotation**, Hardpoint's shape: points start inactive, and the mode's timer deactivates the current hill and activates the next on a fixed cadence. Headquarters layers locking on top, holding a captured HQ locked while it pays out, then rotating.
* **Escort**, Payload's shape and the one that goes beyond settings: `APayloadPoint` is a C++ subclass whose capture volume is a platform riding a spline. Ownership picks the direction, each team pushes toward its own end, and motion is gated by the point's own `ShouldScore`, so the same scoring policy that pauses a hardpoint stops the cart while it is contested. Reaching an end fires a reached-end message the mode treats as the round result, and `RestartPayload` resets the cart for the next round. The motion model itself is an overridable event for carts that should accelerate, reverse when abandoned, or scale speed with pushers.

<details>

<summary>Message reference`</summary>

All channels are broadcast on the server as typed gameplay messages; each payload carries the point actor.

| Channel                                          | Payload                         | Fired When                                          |
| ------------------------------------------------ | ------------------------------- | --------------------------------------------------- |
| `ShooterGame.ControlPoint.Message.Captured`      | Team, contributing players      | A neutral point reaches full capture                |
| `ShooterGame.ControlPoint.Message.Recaptured`    | Team, start progress, defenders | An owner fully restores a point enemies had chipped |
| `ShooterGame.ControlPoint.Message.OwnerChanged`  | New and previous team           | Ownership changes for any reason, including resets  |
| `ShooterGame.ControlPoint.Message.Contested`     | Contested flag                  | The contested state flips either way                |
| `ShooterGame.ControlPoint.Message.ProgressReset` | Owner, a reason name            | Progress is wiped by decay, lock, or command        |
| `ShooterGame.ControlPoint.Message.LockedChanged` | Locked flag                     | The point locks or unlocks                          |
| `ShooterGame.ControlPoint.Message.ActiveChanged` | Active flag                     | The point enters or leaves the rotation             |

</details>

***

### The Shipped UI

`W_ControlPointStatus` is the HUD strip that shows one marker per point, its letter, its owner as ours-or-theirs coloring, and its live fill; each mode adds a thin subclass of it to its HUD layout. The widgets drive themselves from the points' replicated state through `GetUIStateForViewer`, which resolves the ours-versus-theirs sides for the viewing player, so the same widget is correct on every client with no per-mode logic. The world-space marker each point registers uses the same lookup, which keeps the HUD strip and the in-world marker telling the same story.

***

### Bots

The plugin ships a StateTree evaluator that watches every control point at once, refreshing from the same gameplay messages the modes use with a soft poll as fallback, and publishes one goal for its bot: defend a threatened point we own, capture a neutral, neutralize an enemy point, reinforce a friendly one being chipped, or rotate toward whatever is active. Priorities and distance falloff are tunable on the evaluator, including a per-bot random gate on reinforcing so an entire team does not peel off to defend at once.

The shipped `ST_ControlPoint` and `ST_ControlPointShooter` state trees wrap the evaluator into ready-to-use bot behaviour, and each mode's bot controller builds on them. A mode with its own AI can read the same published goal, the point, its location and capture radius, and whether the bot is already inside, from the evaluator's output without re-deriving any objective logic.

***

### Checklist

| Step                                       | Where                           | Shipped Example                                                    |
| ------------------------------------------ | ------------------------------- | ------------------------------------------------------------------ |
| Enable the `ControlPointCore` game feature | Experience definition           | `B_Domination`, `B_Hardpoint`, `B_Headquarters`, `B_Payload`       |
| Place and tune the points                  | The map                         | `B_ControlPoint`, or `B_PayloadControlPoint` for the escort cart   |
| Score and rotate from a mode component     | Game state scoring component    | `B_Scoring_Domination`, `B_Scoring_Hardpoint`, `B_Scoring_Payload` |
| Add the status strip to the HUD            | HUD layout / experience widgets | `W_ControlPointStatus_Domination` and siblings                     |
| Give bots the objective brain              | Bot controller state tree       | `ST_ControlPointShooter`                                           |
