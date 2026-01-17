# Spawning Projectiles

To fire a projectile through the Projectile Manager, you broadcast a message containing all the parameters, start position, velocity, penetration rules, and so on. The manager picks it up and queues it to the simulation thread. No actor spawning, no direct function calls.

***

### How `GA_Weapon_Fire_BulletDrop` Connects

ShooterBase provides `GA_Weapon_Fire_BulletDrop`, a Blueprint ability that handles all the complexity for you. Here's how it connects to the Projectile Manager:

```plaintext
UGameplayAbility_RangedWeapon_Projectile (C++ base):
    StartRangedWeaponTargeting():
        // Perform local traces with spread applied
        FoundHits = TraceBulletsInCartridge(FiringInput)

        // Package into TargetData with timing info
        for each hit in FoundHits:
            SingleTargetHit.HitResult = hit
            SingleTargetHit.Timestamp = ServerTime - (Ping / 2)
            TargetData.Add(SingleTargetHit)

        // Notify via callback
        OnTargetDataReadyCallback(TargetData)

    OnTargetDataReadyCallback():
        if CommitAbility():  // Deduct ammo, etc.
            AddSpread()  // Update weapon state
            OnRangedWeaponTargetDataReady(TargetData)  // Blueprint event!

GA_Weapon_Fire_BulletDrop (Blueprint):
    OnRangedWeaponTargetDataReady(TargetData):
        for each Hit in TargetData:
            // Extract trajectory from hit result
            message = FNewTraceProjectileMessage()
            message.StartLocation = Muzzle socket or TraceStart
            message.StartVelocity = Direction * Speed
            message.Timestamp = Hit.Timestamp
            message.Latency = GetPing()
            // ... fill other fields from weapon config ...

            // Broadcast to manager
            GameplayMessageSubsystem.BroadcastMessage(
                TAG_ShooterGame_TraceProjectile_Message,
                message
            )
```

### Broadcasting the Message (Example from a Gameplay Ability)

This typically happens on the **server** within the `OnTargetDataReadyCallback` (or a function called from it) after the ability cost has been successfully committed.

{% tabs %}
{% tab title="C++" %}
```cpp
// Example within a server-side Ability function (e.g., OnRangedWeaponTargetDataReady)
// Assumes 'ValidatedTargetDataHandle' contains the necessary trajectory info
// Assumes 'WeaponInstance' is a valid pointer to the ULyraRangedWeaponInstance
// Assumes 'InstigatorController' is the firing player's controller

if (ValidatedTargetDataHandle.IsValid(0)) // Check if there's data to process
{
    // Get data for the first "bullet" (or loop if multiple)
    const FLyraGameplayAbilityTargetData_SingleTargetHit* TargetData =
        static_cast<const FLyraGameplayAbilityTargetData_SingleTargetHit*>(ValidatedTargetDataHandle.Get(0));

    if (TargetData && TargetData->HitResult.IsValidBlockingHit()) // Or just use TraceStart/End
    {
        FVector StartLoc = TargetData->HitResult.TraceStart; // Or Muzzle Location
        FVector EndLoc = TargetData->HitResult.Location;    // Or ImpactPoint or TraceEnd

        float ProjectileSpeed = 15000.0f; // Get from WeaponInstance or stats
        FVector VelocityDir = (EndLoc - StartLoc).GetSafeNormal();
        FVector InitialVelocity = VelocityDir * ProjectileSpeed;

        // --- Populate the Message ---
        FNewTraceProjectileMessage ProjMessage;
        ProjMessage.StartLocation = StartLoc;
        ProjMessage.StartVelocity = InitialVelocity;
        ProjMessage.MaxRange = WeaponInstance->GetMaxDamageRange(); // Example
        ProjMessage.MaxLifespan = 2.0f; // Example
        ProjMessage.ProjectileRadius = WeaponInstance->GetBulletTraceSweepRadius(); // Use weapon sweep radius

        ProjMessage.Instigator = InstigatorController;
        ProjMessage.Causer = GetAvatarActorFromActorInfo(); // Or the weapon actor itself

        ProjMessage.HitEffect = GetDamageGameplayEffect(); // Get from Ability or Weapon
        ProjMessage.ImpactCueNotify = GetImpactCueTag();   // Get from Ability or Weapon

        // --- Penetration Setup (Get from Ability properties) ---
        // ProjMessage.MaterialPenetrationMap = GetPenetrationSettingsMap();
        // ProjMessage.MaxPenetrations = GetMaxPenetrations();

        // --- Lag Compensation Data ---
        ProjMessage.Timestamp = TargetData->Timestamp; // Crucial: Use timestamp from client data
        if (APlayerState* PS = InstigatorController->GetPlayerState<APlayerState>())
        {
            ProjMessage.Latency = PS->GetPingInMilliseconds();
        }

        // --- Broadcast ---
        UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(GetWorld());
        MessageSubsystem.BroadcastMessage(TAG_ShooterGame_TraceProjectile_Message, ProjMessage);
    }
}

```


{% endtab %}

{% tab title="Blueprints" %}
<figure><img src="../../../.gitbook/assets/image (5) (1) (1).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

Key insight: The C++ base handles spread, targeting, timestamps, and ability commitment. The Blueprint just packages the data and broadcasts. For most use cases, you configure `GA_Weapon_Fire_BulletDrop` in your weapon data, no C++ required.

{% hint style="info" %}
The `Timestamp` is calculated as `ServerTime - (Ping / 2)` to estimate when the shooter actually clicked, accounting for network latency. This is critical for accurate lag compensation.
{% endhint %}

***

### The Message System

Communication happens through `UGameplayMessageSubsystem`:

```plaintext
Your Gameplay Ability:
    Create FNewTraceProjectileMessage with all parameters
    Broadcast with tag: ShooterGame.TraceProjectile.Message

UProjectileManager (listening):
    Receives message
    Converts to FTraceProjectile
    Queues to simulation thread
```

This decoupled design means your ability doesn't need a reference to the manager—it just broadcasts and trusts the system.

***

### Message Fields

The `FNewTraceProjectileMessage` struct contains everything needed to simulate a projectile:

| Field                    | Type          | Purpose                                      |
| ------------------------ | ------------- | -------------------------------------------- |
| `StartLocation`          | FVector       | World-space origin of the projectile         |
| `StartVelocity`          | FVector       | Direction × Speed                            |
| `MaxRange`               | float         | Maximum travel distance (cm)                 |
| `MaxLifespan`            | float         | Maximum lifetime (seconds)                   |
| `ProjectileRadius`       | float         | Sphere sweep radius (0 = line trace)         |
| `Instigator`             | AController\* | The player who fired                         |
| `Causer`                 | AActor\*      | The weapon or actor that caused the shot     |
| `HitEffect`              | TSubclassOf   | Effect applied on hit (damage)               |
| `ImpactCueNotify`        | FGameplayTag  | Tag for batched GameplayCue impacts          |
| `MaterialPenetrationMap` | TMap          | Per-material penetration rules               |
| `MaxPenetrations`        | int32         | Max surfaces to pass through (-1 = infinite) |
| `Timestamp`              | double        | Server time when client fired                |
| `Latency`                | float         | Client ping at fire time (ms)                |

Critical fields for lag compensation: `Timestamp` and `Latency` must be accurate. These come from the client's target data and player state respectively.

***

### Penetration Configuration

The `MaterialPenetrationMap` maps each `UPhysicalMaterial` to a set of rules:

```plaintext
MaterialPenetrationMap:
    PM_Wood_Thin → rules for thin wood
    PM_SheetMetal → rules for metal
    PM_Glass → rules for glass
    (materials not in map = cannot penetrate)
```

#### The `FProjectileMaterialPenetrationInfo` Struct

| Property                          | Default    | Purpose                                                 |
| --------------------------------- | ---------- | ------------------------------------------------------- |
| `MaxPenetrationDepth`             | 20 cm      | Maximum distance the bullet can travel through material |
| `PenetrationDepthMultiplierRange` | (0.9, 1.1) | Randomizes actual depth for variation                   |
| `MaxPenetrationAngle`             | 25°        | Max angle from perpendicular for penetration            |
| `MinimumPenetrationVelocity`      | 10 m/s     | Speed threshold to penetrate                            |
| `VelocityChangePercentage`        | 0.75       | Speed retained after penetration (75%)                  |
| `DamageChangePercentage`          | 0.75       | Damage multiplier for subsequent hits                   |
| `MaxExitSpreadAngle`              | 10°        | Random deviation after penetration/ricochet             |
| `MinRicochetAngle`                | 60°        | Min angle for ricochet eligibility                      |
| `RicochetProbability`             | 0.5        | Chance of ricochet when angle qualifies                 |
| `RicochetVelocityPercentage`      | 0.75       | Speed retained after ricochet                           |
| `MaxRicochetBounces`              | 0          | Max bounces (0 = ricochet disabled)                     |

Note on PenetrationDepthMultiplierRange: The actual penetration depth is `MaxPenetrationDepth * RandomInRange(0.9, 1.1)`, adding variation so bullets don't always exit at exactly the same point through a material.

***

### Impact Angle Zones

The angle between the bullet's direction and the surface determines what happens:

```
       0°            25°           60°           90°
        |             |             |             |
        v             v             v             v
   [PENETRATION] [DEAD ZONE] [RICOCHET ZONE]

   Head-on hit                           Grazing hit
```

* 0° to 25°: Penetration eligible (if velocity and material allow)
* 25° to 60°: Dead zone, bullet stops
* 60° to 90°: Ricochet eligible (subject to probability roll)

#### Penetration Check

```plaintext
can_penetrate(hit):
    rules = MaterialPenetrationMap[hit.PhysicalMaterial]
    if rules not found:
        return false  // Material blocks all penetration

    angle = angle_between(bullet_direction, surface_normal)

    if angle > rules.MaxPenetrationAngle:
        return false  // Too steep

    if bullet_speed < rules.MinimumPenetrationVelocity:
        return false  // Too slow

    return true
```

#### Ricochet Check

```plaintext
should_ricochet(hit):
    rules = MaterialPenetrationMap[hit.PhysicalMaterial]
    if rules not found or rules.MaxRicochetBounces == 0:
        return false

    if current_ricochets >= rules.MaxRicochetBounces:
        return false

    angle = angle_between(bullet_direction, surface_normal)

    if angle < rules.MinRicochetAngle:
        return false  // Too direct for ricochet

    // Deterministic random based on position
    if random_roll() > rules.RicochetProbability:
        return false

    return true
```

Deterministic seeding: Ricochet probability uses a deterministic random seed based on the impact position. This ensures consistent results between client prediction and server validation.

***

### Example: Rifle Bullet Setup

```plaintext
// In your firing ability, on server

message = FNewTraceProjectileMessage()

// Trajectory
message.StartLocation = muzzle_socket_location
message.StartVelocity = aim_direction * 15000  // 150 m/s

// Limits
message.MaxRange = 10000  // 100 meters
message.MaxLifespan = 2.0

// Sphere sweep (use weapon's configured radius)
message.ProjectileRadius = weapon.BulletTraceSweepRadius

// Attribution
message.Instigator = owning_controller
message.Causer = weapon_actor

// Effects
message.HitEffect = DamageEffect_Rifle
message.ImpactCueNotify = TAG_GameplayCue_Impact_Bullet

// Penetration: allow thin wood and glass
message.MaterialPenetrationMap = {
    PM_Wood_Thin: { MaxDepth: 15, MaxAngle: 45, VelocityRetain: 0.8, DamageRetain: 0.85 },
    PM_Glass: { MaxDepth: 5, MaxAngle: 60, VelocityRetain: 0.95, DamageRetain: 0.95 }
}
message.MaxPenetrations = 2  // At most 2 surfaces

// Lag compensation
message.Timestamp = target_data.Timestamp
message.Latency = player_state.PingInMilliseconds

// Fire!
GameplayMessageSubsystem.BroadcastMessage(
    TAG_ShooterGame_TraceProjectile_Message,
    message
)
```

***

### Physical Material Setup

{% stepper %}
{% step %}
#### Create materials

In the Content Browser, create `UPhysicalMaterial` assets for the surfaces you want to model, for example:

* `PM_Concrete` (blocking)
* `PM_Wood_Thin` (penetrable)
* `PM_SheetMetal` (penetrable with different rules)
{% endstep %}

{% step %}
#### Assign to surfaces

Apply the physical materials to your static meshes via their material slots or collision settings so traces report the correct `UPhysicalMaterial`.
{% endstep %}

{% step %}
#### Configure rules

In your ability's `MaterialPenetrationMap`, define the penetration/ricochet rules for each penetrable material. Materials not present in the map will block all projectiles (no extra configuration needed for blocking).
{% endstep %}
{% endstepper %}

***

### GPU Tracer System

While projectile collision and damage are simulated on the background thread, the bullet **tracers** use a different approach: GPU-side particle physics computed in Niagara.

#### The Problem with Replicated Tracers

If the server sent position updates for every tracer, bandwidth would explode. A minigun firing 60 rounds per second would need 60 position updates per second per weapon, unacceptable for a multiplayer game.

#### The Solution: Local GPU Simulation

Instead of replicating tracer positions, each client receives only the **initial fire parameters** and calculates tracer positions locally on the GPU using Niagara:

| Parameter         | Description                       |
| ----------------- | --------------------------------- |
| `MuzzleLocation`  | Starting position (weapon muzzle) |
| `CameraLocation`  | Player's camera position          |
| `TargetLocation`  | Crosshair aim point               |
| `ProjectileSpeed` | Initial velocity magnitude (cm/s) |
| `PathJoinTime`    | Bridge phase duration (seconds)   |
| `ParticleGravity` | Gravity vector (cm/s²)            |
| `LinearDrag`      | Drag coefficient                  |

#### The Muzzle-Camera Offset Problem

The actual projectile simulation traces from the **camera to the target**, this is the player's intended aim line, the path their crosshair represents. Players instinctively aim using the crosshair, leading targets and compensating for bullet drop along this camera-based trajectory.

But tracers need to spawn from the **weapon muzzle** for visual authenticity. If a tracer simply flew straight from the muzzle toward the aim point, it would follow a different arc than the actual projectile, the visual wouldn't match where bullets actually land.

#### Two-Phase Tracer Trajectory

To solve this, GPU tracers use the same converging path approach as actor projectiles:

1. **Bridge Phase**: For `PathJoinTime` seconds, the tracer follows a constant-acceleration curve from the muzzle that merges onto the camera's aim trajectory
2. **Ballistic Phase**: After merging, the tracer follows standard ballistic physics (gravity + drag) along the true aim path

The result: tracers visually originate from the gun but travel along the same path as the actual projectiles, without any network traffic.

{% hint style="info" %}
This is handled in the Niagara ProjectileTracer VFX using custom HLSL scripts
{% endhint %}

#### Why Penetration Doesn't Work with Tracers

GPU tracers can only calculate ballistic flight. The GPU has no knowledge of:

* When/where bullets penetrate surfaces
* When/where bullets ricochet
* Material interactions

Penetration and ricochet effects must be spawned separately via `ImpactCueNotify` when the simulation thread reports hits. The tracers simply fly in a straight ballistic arc, they don't visually show penetration or direction changes.

***

***
