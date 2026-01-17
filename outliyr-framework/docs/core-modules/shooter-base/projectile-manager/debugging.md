# Debugging

When projectiles aren't behaving as expected, visual debugging tools help you see what the simulation thread is actually doing. This page covers the available CVars and how to interpret the visualizations.

### Debug Settings

Configure via **Project Settings > Plugins > Lyra Projectile Manager Debug**, or use console commands:

| CVar                                           | Default | Purpose                                                 |
| ---------------------------------------------- | ------- | ------------------------------------------------------- |
| `lyra.TraceProjectile.DrawBulletTraceDuration` | 0       | Duration (seconds) to draw trace segments. 0 = disabled |
| `lyra.TraceProjectile.DrawBulletHitDuration`   | 0       | Duration (seconds) to draw impact points. 0 = disabled  |
| `lyra.TraceProjectile.DrawBulletHitRadius`     | 5.0     | Size of impact debug spheres (cm)                       |

### Enabling Visualizations

{% stepper %}
{% step %}
#### Enable CVars

Set trace and/or hit duration to a positive value (e.g., 2.0 seconds).
{% endstep %}

{% step %}
#### Run as Server

Simulation only runs on the server, use Listen Server or Standalone mode.
{% endstep %}

{% step %}
#### Fire Weapons

Use weapons that send `FNewTraceProjectileMessage`.
{% endstep %}

{% step %}
#### Observe

Watch for debug lines and spheres appearing.
{% endstep %}
{% endstepper %}

### Interpreting the Visuals

#### Trace Lines

When `DrawBulletTraceDuration > 0`, you'll see:

* Lines: The path segment checked each simulation frame
* Capsules: If `ProjectileRadius > 0`, shows the swept volume
* Color coding: May indicate hit vs no-hit (implementation dependent)

These visualizations show what the **lag compensation system traced against,** historical hitbox positions, not current ones. If a hit registered but the target appears to have moved, the trace is correct; the target was there when the shooter fired.

#### Impact Points

When `DrawBulletHitDuration > 0`, you'll see:

* Spheres: At the exact `ImpactPoint` where collision was detected
* Size: Controlled by `DrawBulletHitRadius`

Compare these with your VFX impact locations from `AddImpactEffects`. They should align. If VFX appears offset, check your effect spawning logic — the simulation is authoritative.

### Common Issues

| Symptom                        | Likely Cause                                | Debug Approach                                                                             |
| ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| No trace lines appear          | CVar not enabled, or simulation not running | Verify server context, check CVar value                                                    |
| Trace lines but no impacts     | Projectile expiring before collision        | Increase `MaxLifespan`, check trajectory                                                   |
| Impacts in wrong location      | Lag comp showing historical position        | Expected behavior, see "[Interpreting the Visuals](debugging.md#interpreting-the-visuals)" |
| Projectiles pass through walls | Collision channel misconfigured             | Check `ECC_` channel setup on surfaces                                                     |
| Projectiles always penetrate   | No material in penetration map              | Materials not in map should block, verify assignment                                       |
| Damage not applying            | Target missing ASC, or effect misconfigured | Check `HitEffect` and target's AbilitySystemComponent                                      |
| Hit markers not showing        | Missing `UWeaponStateComponent`             | Ensure instigator's controller has the component                                           |
| Erratic trajectories           | Incorrect initial velocity                  | Verify `StartVelocity` direction and magnitude                                             |

### Server vs Client Context

Remember:

* Simulation: Server only (debug visuals appear on server)
* Cosmetic tracers: Client only (Niagara effects, not managed by this system)
* Impact VFX: Triggered by server, but may replicate via GameplayCues

When debugging, focus on the server view. Client-side tracer effects are purely cosmetic and may not perfectly match the authoritative simulation.

### Log Category

For detailed logging:

{% code title="Console" %}
```
log LogProjectileManager Verbose
```
{% endcode %}
