# Third Person Camera

The camera sits behind and above the character. As the player looks up, the camera rises higher. As they crouch, it smoothly lowers. When the camera would clip into a wall, it pushes forward to maintain line-of-sight. All of this is handled by `ULyraCameraMode_ThirdPerson`.

***

## Pitch-Based Positioning

The camera's offset from the character changes based on where the player is looking. Looking up shifts the camera higher and further back. Looking down brings it closer. The exact relationship between pitch angle and camera position is entirely up to you, these offsets are defined by runtime curves (one per axis: X, Y, Z) that map pitch angle to position. You configure the curves directly in the Blueprint defaults of your camera mode.

For remote players seen by other clients, the camera's pivot location and rotation are interpolated smoothly toward the target values rather than applied directly. This prevents the jitter that would otherwise occur from replicated rotation updates arriving at network tick rate.

> [!INFO]
> A `UCurveVector` asset can be used instead of the three runtime float curves by disabling `bUseRuntimeFloatCurves`. Runtime float curves are preferred because they are editable inline on the Blueprint, but live editing during PIE does not yet work for them (UE-103986).

***

## Crouch Handling

When the character crouches, the camera needs to lower smoothly rather than snapping to the new height. The system detects crouching by comparing the current character state to its default class values, specifically, the difference between `CrouchedEyeHeight` and `BaseEyeHeight`. That difference becomes a vertical target offset that the camera blends toward using an ease-in-out interpolation.

The blend speed is configurable. A higher blend multiplier makes the camera follow crouching fasterm at the default value, the transition completes in roughly 0.2 seconds. When the character stands back up, the same blending brings the camera back to its original height.

***

## Collision Avoidance

Without collision handling, the camera clips through walls. The penetration avoidance system traces rays from the character to the desired camera position and pulls the camera forward when geometry is in the way.

```
Top-down view of collision avoidance:

               Feeler rays (predictive)
              /    |    \
             /     |     \
Character  ●------+------→  Desired camera position
                   |
              Primary ray

If the primary ray hits a wall:

Character  ●------X→         Camera pulled to hit point
                  ↑
             Wall hit
```

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Find the safe location**

A point guaranteed to be inside the character's collision capsule. The system finds the closest point on the aim line to the capsule center, then clamps it vertically to stay within the capsule bounds. This ensures trace origins never start inside world geometry.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Primary sweep**

A sphere trace from the safe location to the desired camera position. If it hits geometry, the camera is pulled forward to the hit point. The primary ray always traces every frame, it is never skipped.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Predictive feelers**

Additional rays fan out at various angles around the primary direction, horizontally and vertically. These detect nearby walls _before_ the camera reaches them, allowing the system to start pulling the camera in preemptively rather than popping when the player rotates into an obstacle.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Blend the result**

The camera pulls in quickly when blocked but eases back out slowly when clear. For the primary ray, the camera snaps directly to the blocked position. For predictive feelers, it interpolates over a short blend-in time. When the obstruction clears, the camera eases back out over a longer blend-out time. This asymmetry prevents the camera from popping in and out when near geometry edges.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

<div class="gb-stack">
<details class="gb-toggle">

<summary>Why multiple feeler rays?</summary>

A single ray only detects walls directly behind the character. Angled feeler rays catch walls to the side, ceiling edges, and doorframes before the player turns into them. Each feeler can be configured with a different angle, weight, and trace frequency.

By default the system ships with seven feelers: the primary ray plus six predictive rays, two pairs offset horizontally at different angles, and two offset vertically (one up, one down). The wider-angle feelers have lower weights, so they nudge the camera gently rather than yanking it.

</details>
<details class="gb-toggle">

<summary>Why asymmetric blend timing?</summary>

When the camera hits a wall, it needs to pull in immediately to avoid clipping. But when the obstruction clears, snapping back instantly would look jarring, especially if the player is moving along a wall where the camera alternates between blocked and clear. The slow blend-out smooths this transition.

</details>
</div>

### Performance

Feeler rays that didn't hit anything on the previous frame can skip tracing for several frames. The primary ray always traces every frame, but predictive feelers only need periodic checks when nothing is nearby. Any feeler that gets a hit resets to tracing every frame until the obstruction clears.

### Special Cases

* Actors tagged with `IgnoreCameraCollision` are invisible to the collision system. Once detected, they are added to the ignore list for the remainder of that frame's traces.
* Camera blocking volumes in front of the player are ignored, only volumes between the player and camera (behind the player) block normally.
* When the camera pushes very close to the character past a configurable threshold, the camera assist interface callback fires so you can respond (e.g., fade the character mesh to prevent it filling the screen).

***

## Camera Assist Interface

Actors and controllers can optionally implement the camera assist interface to customize collision behavior:

* **Provide a custom collision target** — return a different actor for collision traces instead of the default view target. Useful when the pawn is inside a vehicle or the visual root differs from the view target.
* **React to camera penetration** — get notified when the camera pushes too close to the target. The common use case is fading or hiding the character mesh to prevent it from filling the screen.

The system checks for the interface on the controller, the view target actor, and the custom penetration target (if one was provided). All three are notified when penetration occurs.

> [!INFO]
> The interface also defines a method for providing ignored actors, but this is not yet connected in the collision system.
