# Predictive Projectile System

Networked projectiles present unique challenges: latency creates visible delays between firing and seeing the projectile, and the parallax between camera aim and muzzle position causes aiming errors. The Predictive Projectile System addresses both through client-side prediction and converging path trajectories.

This documentation covers the foundation layer, the `AProjectileBase` actor and its supporting systems. For the gameplay ability that drives this system, see [Predictive Projectile Ability](../shooting-gameplay-abilities/predictive-projectile.md).

> [!INFO]
> Do not confuse this with with the [Projectile Manager](../../projectile-manager/), that system is designed for multiple, tiny, fast bullets. This system is design on slow moving projectiles that has arbitrary behaviour e.g sticky grenade, rocket launcher, etc. Or in other words non ballistic projectiles.

***

### Problems Addressed

#### Latency

In a typical client-server model, there's a delay between the client firing and the server spawning the authoritative projectile. Without prediction, the player perceives a noticeable lag before seeing their projectile appear, typically 50–150ms depending on network conditions.

#### Parallax

A projectile's physical path starts at the weapon's muzzle, but the player's intended path originates from their camera. These two trajectories are offset. This parallax causes aiming errors in common scenarios:

* **Bullet drop compensation**: When aiming above a target to account for drop, the muzzle-fired projectile follows a different arc than intended.
* **Leading moving targets**: The projectile's path deviates from the player's predicted intercept course.
* **Shooting around cover**: At close range, projectiles hit cover that the player's camera view was clear of.

#### Reliability

Fast-moving projectiles may spawn, hit something, and be destroyed on the server before the replication system sends spawn information to clients. This results in clients being hit by seemingly invisible projectiles.

***

### System Components

#### `AProjectileBase`

The foundation actor class for all predicted projectiles. Handles:

* Distinction between client-side "fake" projectiles (visual only) and server-authoritative "real" projectiles
* Two-phase movement: Bridge path (custom trajectory) → True path (standard physics)
* Network synchronization via catchup ticks
* Initial replication boost for fast projectiles

See [Projectile Actor](projectile-actor.md) for implementation details.

#### `UProjectileFunctionLibrary`

Static utility functions for trajectory calculations:

* `CalculateMergePoint()`: Find where projectile should join aim line
* `SuggestProjectileVelocity_CustomGravity()`: Ballistic targeting solver
* `SuggestConvergingProjectileVelocity()`: Combined muzzle+camera arc solver

See [Converging Path System](converging-path-system.md) for mathematical details.

### Integration with `UGameplayAbility_PredictiveProjectile`

The [Predictive Projectile ability](../shooting-gameplay-abilities/predictive-projectile.md) orchestrates the system:

* Calculates launch parameters for converging paths
* Spawns fake projectiles on client, real projectiles on server
* Manages fake-to-real interpolation when server projectile replicates
* Handles high-latency scenarios with delayed spawning

***

### Architecture Overview

#### The Muzzle-Camera Offset Problem

Projectiles spawn at the weapon muzzle, but players aim from their camera. In third-person games, these positions are offset by 30-50cm. If a projectile simply launched straight from the muzzle toward the aim point, it would follow a different arc than the player intended—especially noticeable when compensating for bullet drop or leading targets.

{% stepper %}
{% step %}
### Bridge path

For 0.15 seconds, the projectile follows a calculated curve from the muzzle that merges onto the camera's aim line.
{% endstep %}

{% step %}
### True path

After merging, standard `UProjectileMovementComponent` physics take over on the intended trajectory.
{% endstep %}
{% endstepper %}

The result: projectiles visually come from the gun but functionally travel exactly where the player is aiming.

#### Hiding Network Latency

The firing client spawns an immediate visual-only "fake" projectile for instant feedback. The server spawns the authoritative "real" projectile that handles collision and damage. When the real projectile replicates back, the client smoothly transitions from fake to real.

| Aspect      | Fake (Client)             | Real (Server)                    |
| ----------- | ------------------------- | -------------------------------- |
| Spawned by  | Firing client immediately | Server after receiving request   |
| Collision   | Disabled                  | Enabled                          |
| Authority   | Visual only               | Handles damage                   |
| Replication | Not replicated            | Replicated to non-owning clients |

#### Synchronizing Other Clients

When other clients receive the replicated projectile, its position represents where it was when the server sent the packet, not where it is now. The projectile has moved further during network transit.

Upon receiving a replicated projectile, clients calculate how far to simulate forward based on their latency, then advance the projectile to its estimated current position.

```plaintext
Client fires → Spawn fake (visual only)
           → Send request to server

Server receives → Spawn real (authoritative)
              → Replicate to other clients

Other clients receive → Calculate latency offset
                     → CatchupTick() to advance position
                     → Display at estimated server position
```

### Documentation Guide

| Page                                                                                     | Content                                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Projectile Actor](projectile-actor.md)                                                  | `AProjectileBase` implementation, network mechanics, extension guide |
| [Converging Path System](converging-path-system.md)                                      | Trajectory mathematics, utility functions, VFX integration           |
| [Predictive Projectile Ability](../shooting-gameplay-abilities/predictive-projectile.md) | Gameplay ability, fake-to-real handoff, configuration                |
