# Projectile Actor

`AProjectileBase` is the foundation actor for all predicted projectiles. It handles the distinction between client-side "fake" projectiles (visual only) and server-authoritative "real" projectiles, along with the network synchronization between them.

### Design Overview

`AProjectileBase` is designed to be:

* **Networked**: Supports replication with custom logic for client-side prediction and synchronization
* **Movement-driven**: Relies on `UProjectileMovementComponent` for physics simulation after the bridge phase
* **Prediction-aware**: Distinguishes between fake and real projectiles for latency hiding
* **Trajectory-aware**: Incorporates the converging path system for visually intuitive aiming
* **Extensible**: Abstract base class, create Blueprint or C++ subclasses to define specific behaviors

#### Core Components

**`ProjectileMovement` (`UProjectileMovementComponent*`)**

The standard UE component for projectile physics (velocity, gravity, bouncing, collision response). `AProjectileBase` manages this component:

* Disables its tick during the bridge phase
* Re-enables it after the merge point is reached
* Configure `InitialSpeed`, `MaxSpeed`, `bShouldBounce`, `ProjectileGravityScale` on this component in your subclasses

#### Authority vs Fake Projectiles

The distinction between fake and real projectiles is central to the prediction system.

#### `IsFakeProjectile()`

Returns `true` if this instance is the visual-only projectile spawned immediately on the firing client.

* Collision disabled (`SetActorEnableCollision(false)`)
* Does not apply damage or gameplay effects
* Movement is synchronized with the server projectile via interpolation

#### `ProjectileHasAuthority()`

Returns `true` if this instance is the authoritative projectile spawned on the server.

* Performs actual collision checks
* Applies damage (usually via `OnHit` event in subclasses)
* State is replicated to clients

Internally checks `HasAuthority() && !bIsFakeProjectile`.

#### When to Check Authority

Always check `ProjectileHasAuthority()` before applying gameplay-altering effects:

{% code title="Example" %}
```cpp
void AMyProjectile::OnProjectileHit(UPrimitiveComponent* HitComponent,
                                     AActor* OtherActor, ...)
{
    if (!ProjectileHasAuthority())
        return;  // Only server applies damage

    // Apply damage, spawn effects, etc.
}
```
{% endcode %}

#### Lifecycle

{% stepper %}
{% step %}
#### `BeginPlay()`

* Initializes velocity based on `InitialSpeed` set during spawning
* If bridge phase is needed (`!bHasMerged`), disables `ProjectileMovementComponent` tick
* Sets up catchup logic if running as simulated proxy
* Registers `InitialReplicationTick` on server if needed
{% endstep %}

{% step %}
#### `Tick()`

During the bridge phase (`!bHasMerged`):

* Advances `TimeInBridge` by delta time
* Calculates position using kinematic equation: `P(t) = P₀ + V₀t + ½at²`
* Updates actor location via `SetStateFromTimeInBridge()`
* When `TimeInBridge >= BridgeDuration`, triggers transition to normal phase
{% endstep %}

{% step %}
#### `Transition to Normal Phase`

When the bridge completes:

* Position and velocity snap to the final bridge state (which matches the True Path)
* `UProjectileMovementComponent` is re-enabled and activated
* Component velocity is set to the final bridge velocity
* `bHasMerged = true`
{% endstep %}
{% endstepper %}

***

### Replication Setup

#### Default Configuration

```cpp
bReplicates = true;
SetReplicatingMovement(false);  // Custom sync, not generic movement replication
NetPriority = 2.0f;
SetMinNetUpdateFrequency(100.0f);  // High priority for fast-moving objects
```

#### Why Disable Movement Replication?

Standard UE actor movement replication doesn't account for:

* Client-side prediction with fake projectiles
* Precise timing needed for fake-to-real handoff
* Catchup ticks for simulated proxies

Instead, the system uses:

* `FProjectileArray` for efficient replication via the ability
* Custom catchup logic to advance projectiles to estimated server position
* Prediction key matching for fake-to-real correlation

***

### Initial Replication Boost

#### **The Problem**

Fast projectiles (or those with immediate effects) may spawn, hit, and be destroyed on the server before regular replication sends spawn information. This results in "invisible" projectiles hitting players.

#### **The Solution**

`AProjectileBase` includes a special system for forcing early replication:

#### **`InitialReplicationTick` (`FActorTickFunction`)**

A high-priority tick function that runs once very early in the actor's lifecycle on the server.

#### **`SendInitialReplication()`**

Called by `InitialReplicationTick`. Checks if the projectile meets criteria:

```cpp
if (Velocity.Size() >= 7500.0f)  // Fast enough to need boost
{
    // Force immediate replication to relevant clients
    for (FNetworkObjectInfo& Info : RelevantClients)
    {
        UActorChannel* Ch = Connection->FindActorChannelRef(this);
        Ch->ReplicateActor();  // Force packet now
    }
}
```

If criteria are met, it iterates through connected clients and forces the `UActorChannel` associated with this projectile to replicate immediately, creating the channel if necessary (`Ch->ReplicateActor()`). This increases the chance the client receives the spawn before the projectile is destroyed.

#### **`bForceNextRepMovement`**

Set to `true` after initial replication. Ensures the next replication update includes location/rotation, even though standard movement replication is disabled.

> [!WARNING]
> This system prioritizes getting some information to clients as early as possible for fast-moving or impactful projectiles. It trades some immediate bandwidth for correctness/visibility of fast events.

***

### Client Catchup (Simulated Proxies)

When a client receives replicated data for a server-authoritative projectile, the received position represents where the projectile was when the packet was sent. Due to latency, the server has moved the projectile further.

#### **`PostNetReceiveLocationAndRotation()`**

Called on simulated proxies when updated transform data arrives. Triggers the catchup calculation.

#### **`CalculatePredictionTime()`**

Calculates how much time to simulate forward:

```cpp
float CatchupDelta = PlayerState->GetPingInMilliseconds() / 2000.0f;  // Half RTT
CatchupDelta = FMath::Min(CatchupDelta, MaxLatency / 1000.0f);  // Clamp by MaxLatency
```

Uses half the round-trip time as an approximation. Clamped by `MaxLatency` (configurable, default 200ms) to prevent extreme forward simulation.

#### **`CatchupTick(float DeltaTime)`**

Simulates the projectile forward by `CatchupDelta`:

* If still on bridge path (`!bHasMerged`):
  * Advances `TimeInBridge`
  * Recalculates position along the bridge curve
  * If catchup pushes past merge point, snaps to merge and applies remaining time to physics
* If already merged (`bHasMerged`):
  * Calls `ProjectileMovement->TickComponent()` with the catchup delta
  * Standard physics simulation advances the projectile

This ensures projectiles on other clients appear at approximately their current server position.

***

### Relevancy

#### **`IsNetRelevantFor()`**

Custom logic to control which clients receive the replicated projectile:

```cpp
bool AProjectileBase::IsNetRelevantFor(const AActor* RealViewer,
                                        const AActor* ViewTarget,
                                        const FVector& SrcLocation) const
{
    // Skip replicating to owning client - they have their fake projectile
    if (IsOwnedBy(ViewTarget))
        return false;

    return Super::IsNetRelevantFor(RealViewer, ViewTarget, SrcLocation);
}
```

The owning client already has a locally-predicted fake projectile. Replicating the server projectile to them would cause duplication.

#### Debug Override

For debugging, this behavior can be overridden:

```cpp
// Console command
Shooterbase.Projectile.DrawSimulatedOnOwner 1
```

When enabled, the owning client receives both fake and real projectiles for comparison.

***

### Extending AProjectileBase

Create Blueprint or C++ subclasses to define specific projectile behaviors.

{% stepper %}
{% step %}
#### Configure ProjectileMovementComponent

Set speeds, gravity, bounce properties in your subclass defaults:

{% code title="Example" %}
```cpp
ProjectileMovement->InitialSpeed = 3000.0f;
ProjectileMovement->MaxSpeed = 3000.0f;
ProjectileMovement->ProjectileGravityScale = 1.0f;
ProjectileMovement->bShouldBounce = false;
```
{% endcode %}
{% endstep %}

{% step %}
#### Define Impact Logic

Override collision handlers. Always check authority before applying effects:

{% code title="Example" %}
```cpp
void AMyProjectile::OnProjectileHit(...)
{
    if (!ProjectileHasAuthority())
        return;

    // Apply damage GameplayEffect
    // Spawn explosion
    // Play sound
    Destroy();
}
```
{% endcode %}
{% endstep %}

{% step %}
#### Add Visuals

Assign meshes, particle systems (trails), and sounds in your Blueprint or constructor.
{% endstep %}

{% step %}
#### Implement Custom Logic

Add unique behaviors specific to your projectile type:

* Homing logic
* Proximity detonation
* Splitting into sub-projectiles
* Custom bounce behavior
{% endstep %}
{% endstepper %}
