# Handling Results

When a projectile hits something, the simulation thread notifies the main game thread. The `UProjectileManager` then handles all the gameplay consequences, damage, hit markers, and VFX via batched GameplayCues. This page explains what happens automatically and how to customize impact effects.

***

### What Happens Automatically

When an impact is detected, the system handles these automatically:

{% stepper %}
{% step %}
#### Damage Application

The `HitEffect` GameplayEffect you specified in the spawn message is applied to the hit actor:

```plaintext
HandleProjectileImpact():
    if hit_actor has AbilitySystemComponent:
        calculate damage_reduction from penetrated materials
        create effect spec from HitEffect with damage_reduction as level
        schedule effect application on next tick (timer)
```

Penetration damage reduction: If the bullet passed through surfaces before this hit, damage is automatically reduced. Each penetrated material's `DamageChangePercentage` is multiplied cumulatively. After passing through two 0.75× materials, damage is 0.75 × 0.75 = 0.5625× (56.25%).
{% endstep %}

{% step %}
#### Hit Markers

The shooter receives visual feedback via `UWeaponStateComponent`:

```plaintext
HandleProjectileImpact():
    find WeaponStateComponent on instigator's controller
    call AddConfirmedServerSideHitMarkers(hit_result)
    // This triggers an RPC to show the hit marker on the shooter's screen
```

No configuration needed, if the controller has a `UWeaponStateComponent`, hit markers work automatically.
{% endstep %}

{% step %}
#### Batched Impact Effects (GameplayCues)

Instead of firing VFX for every individual bullet hit, the system **batches all impacts** with matching characteristics and sends them together at the end of each tick:

```plaintext
HandleProjectileImpact():
    // Create batch key for grouping
    batch_key = FProjectileGameplayCueBatchKey(
        CueTag: projectile.ImpactCueNotify,
        Instigator: projectile.Instigator,
        Causer: projectile.Causer,
        HitEffect: projectile.HitEffect
    )

    // Add to pending batch
    PendingGameplayCueImpacts[batch_key].Add(hit_info)

// At end of tick...
SendBatchedProjectileImpact():
    for each batch_key in PendingGameplayCueImpacts:
        // Collect all impacts for this key
        info = FMultipleShotGameplayCueInfo()
        for each hit in batch:
            info.StartLocations.Add(hit.TraceStart)
            info.EndLocations.Add(hit.ImpactPoint)
            info.Normals.Add(hit.ImpactNormal)
            info.PhysicalMaterials.Add(hit.PhysMaterial)

        // Execute single GameplayCue with all data
        Execute GameplayCue with batch_key.CueTag, info
```

Why batching? A minigun firing 60 rounds per second would trigger 60 GameplayCue executions per second, per weapon. Batching reduces this to one execution per tick containing all impacts.
{% endstep %}
{% endstepper %}

***

### Your Extension Point: GameplayCue Notifies

All VFX customization happens through **GameplayCue Notifies**. Create `GCN_` assets that handle the `ImpactCueNotify` tag you specify in your projectile message.

#### The Data You Receive

Your GameplayCue Notify receives `FMultipleShotGameplayCueInfo` via the Effect Context:

| Array                 | Contains                                                |
| --------------------- | ------------------------------------------------------- |
| `StartLocations[]`    | Trace origins (for tracers/trails)                      |
| `EndLocations[]`      | Impact points (where to spawn VFX)                      |
| `Normals[]`           | Surface normal at each impact (for orienting decals)    |
| `PhysicalMaterials[]` | Material at each impact (for material-specific effects) |

All arrays have matching indices, `EndLocations[2]` corresponds to `Normals[2]` and `PhysicalMaterials[2]`.

#### Creating a GameplayCue Notify

{% stepper %}
{% step %}
Create the asset: Right-click in Content Browser → Blueprint Class → `GameplayCueNotify_Static` or `GameplayCueNotify_Actor`
{% endstep %}

{% step %}
Set the tag: In the class defaults, set the GameplayCue tag to match your `ImpactCueNotify` (e.g., `GameplayCue.Impact.Bullet`)
{% endstep %}

{% step %}
Override OnExecute: Extract `FMultipleShotGameplayCueInfo` from the Effect Context and spawn effects:

```plaintext
GCN_BulletImpact::OnExecute(Target, Parameters):
    // Get the batched impact data from context
    context = Parameters.EffectContext
    impact_info = context.GetInstancedData() as FMultipleShotGameplayCueInfo

    // Spawn effect for each impact in the batch
    for i = 0 to impact_info.EndLocations.Length:
        location = impact_info.EndLocations[i]
        normal = impact_info.Normals[i]
        material = impact_info.PhysicalMaterials[i]

        // Spawn material-appropriate effect
        effect = get_effect_for_material(material)
        Spawn Emitter at Location(effect, location, Rotation from Normal)

        // Spawn decal
        decal = get_decal_for_material(material)
        Spawn Decal at Location(decal, location, normal)

        // Play sound (limit to avoid audio spam)
        if i < 3:  // Only play sound for first few hits
            sound = get_sound_for_material(material)
            Play Sound at Location(sound, location)
```
{% endstep %}
{% endstepper %}

#### Example: Material-Based Impact Effects

```plaintext
GCN_BulletImpact::OnExecute(Target, Parameters):
    impact_info = get_instanced_data(Parameters.EffectContext)

    for i in range(impact_info.EndLocations):
        material = impact_info.PhysicalMaterials[i]
        location = impact_info.EndLocations[i]
        normal = impact_info.Normals[i]

        switch material:
            case PM_Flesh:
                Spawn(BloodSplatter, location, normal)
                Play Sound(SFX_FleshHit, location)

            case PM_Metal:
                Spawn(SparkEffect, location, normal)
                Spawn Decal(BulletHoleMetal, location, normal)
                Play Sound(SFX_MetalRicochet, location)

            case PM_Concrete:
                Spawn(DustPuff, location, normal)
                Spawn Decal(BulletHoleConcrete, location, normal)
                Play Sound(SFX_ConcreteImpact, location)

            default:
                Spawn(GenericImpact, location, normal)
```

***

### Setting Up the ImpactCueNotify Tag

In your `FNewTraceProjectileMessage`:

```plaintext
message.ImpactCueNotify = FGameplayTag::RequestGameplayTag("GameplayCue.Impact.Bullet")
```

The manager uses this tag to group impacts and execute your GameplayCue Notify.

> [!INFO]
> Tag structure suggestion: Use hierarchical tags like `GameplayCue.Impact.Bullet.Rifle` vs `GameplayCue.Impact.Bullet.Shotgun` to allow shared parent handling with specialized child effects.

***

### VFX Limitation

> [!WARNING]
> Important: The VFX system receives limited data about penetration and ricochet events.

| Data Available          | Status        |
| ----------------------- | ------------- |
| Impact Location         | Available     |
| Surface Normal          | Available     |
| Physical Material       | Available     |
| Trace Origin            | Available     |
| Ricochet Exit Direction | Not Available |
| Penetration Exit Angle  | Not Available |

> [!WARNING]
> This means decals and effects can only orient based on the **surface normal** (where the bullet hit), not the actual exit direction after ricochet or penetration.
> 
> If your game requires VFX that follow ricochet paths, you would need to extend the `FMultipleShotGameplayCueInfo` struct and the batching system.

***

### Summary

| Aspect                       | Handled By              |
| ---------------------------- | ----------------------- |
| Damage application           | Automatic (C++)         |
| Penetration damage reduction | Automatic (C++)         |
| Hit markers to shooter       | Automatic (C++)         |
| Impact batching              | Automatic (C++)         |
| Cosmetic VFX/SFX             | Your GameplayCue Notify |

You don't need to modify `HandleProjectileImpact` or `SendBatchedProjectileImpact`, just create GameplayCue Notify assets for your `ImpactCueNotify` tags, and the system delivers all the impact data in batched form.

***
