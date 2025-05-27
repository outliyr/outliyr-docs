# Predictive Projectile Ability

This ability represents the most sophisticated approach to firing projectiles in ShooterBase, specifically designed to combat network latency and provide a highly responsive experience for the player firing the weapon. It builds upon the projectile trajectory concepts (`AProjectileBase`, Merge Point) and integrates **client-side prediction** for the projectile itself.

```cpp
// Header: GameplayAbility_PredictiveProjectile.h
// Parent: UGameplayAbility_RangedWeapon_Projectile

UCLASS(MinimalAPI)
class UGameplayAbility_PredictiveProjectile : public UGameplayAbility_RangedWeapon_Projectile
{
    GENERATED_BODY()

public:
    // Constructor, Replication setup

    // Spawns projectile with prediction & merge point logic
    UFUNCTION(BlueprintCallable)
    UE_API AProjectileBase* SpawnProjectile(
        TSubclassOf<AProjectileBase> ProjectileClass,
        const FVector& MuzzleLocation,
        const FVector& CameraLocation,
        const FVector& EndTrace,
        float InitialSpeed
        );

    // Handles synchronizing delayed client projectiles with server ones
    UE_API void SynchronizeDelayedProjectile(const FProjectileInfo& ClientProjectileInfo);
    // Handles reconciling newly replicated server projectiles with existing client ones
    UE_API void HandleReplicatedServerProjectile(const FProjectileInfo& ServerProjectileInfo);

    // Max latency threshold for prediction vs. delayed spawn
    UPROPERTY(EditDefaultsOnly, Category = Customization)
    float MaxLatency = 200.0f;

    // Bias for calculating the merge point
    UPROPERTY(EditDefaultsOnly, Category = Customization)
	float ForwardBias = 300.0f;

private:
    // Logic for delayed spawning when latency is high
    UE_API void SpawnProjectileDelayed(int32 DelayedProjectileID);
    // Logic for smoothly interpolating client projectile to server projectile position
    UE_API void InterpolateProjectile(
        AProjectileBase* ClientProjectile,
        AProjectileBase* ServerProjectile,
        int32 ProjectileID
        );

    // --- State Tracking ---
    // Info for projectiles needing delayed spawn
    UPROPERTY() TArray<FDelayedProjectileInfo> DelayedProjectiles;
    // Tracking for locally spawned fake projectiles
    UPROPERTY() TArray<FProjectileInfo> ClientProjectiles;
    // Replicated list of server-spawned projectiles for synchronization
    UPROPERTY(Replicated) FProjectileArray ServerProjectiles;
    // Timers for interpolation logic per projectile
    TMap<int32, FTimerHandle> InterpolationTimers;

    // Helper functions for prediction timing and IDs
    UE_API float CalculatePredictionTime() const;
    UE_API float CalculatePredictionSleepTime() const;
    UE_API int32 GetPredictionKeyAsProjectileID() const;

    // RPC to notify server when client has finished interpolation
    UFUNCTION(Server, Reliable, WithValidation)
    UE_API void ServerNotifyProjectileReplicated(int32 ProjectileID);
};

// Supporting structs (defined in the same header or related file)
USTRUCT() struct FDelayedProjectileInfo { /* ... */ };
USTRUCT(BlueprintType) struct FProjectileInfo : public FFastArraySerializerItem { /* ... */ };
USTRUCT(BlueprintType) struct FProjectileArray : public FFastArraySerializer { /* ... */ };
```

### Purpose and Key Features

* **Latency Hiding:** Its primary goal is to eliminate the perceived delay between firing and seeing the projectile appear and move.
* **Client-Side Prediction:** The firing client _immediately_ spawns a visual-only "fake" `AProjectileBase` actor that follows the calculated trajectory (including the merge point curve).
* **Server Authority:** The server still spawns the authoritative, gameplay-relevant `AProjectileBase` actor.
* **Synchronization & Interpolation:** When the server's replicated projectile arrives on the client, this ability matches it with the corresponding fake client projectile (using a shared ID derived from the prediction key) and smoothly interpolates the fake projectile's position to match the server's before destroying the fake one and revealing the server one.
* **Merge Point Integration:** Fully utilizes the `AProjectileBase` merge point trajectory system for both client and server projectiles, ensuring visual consistency with aiming.
* **Delayed Spawning:** Includes logic to delay the _client's_ fake projectile spawn if the player's latency exceeds a configurable threshold (`MaxLatency`), preventing the fake projectile from getting too far ahead of where the server projectile will eventually appear.

### Core Concept: Fake Client, Real Server, Smooth Handoff

1. **Client Fires:** Spawns a fake `AProjectileBase` (visual only, no collision) immediately. This projectile starts moving along its calculated merge point trajectory. The client tracks this projectile locally.
2. **Server Spawns:** Receives the firing info, spawns the real `AProjectileBase` (server authoritative, handles collision/damage), applies catchup ticks if needed, and adds it to a replicated list (`ServerProjectiles`).
3. **Replication:** The server's projectile is replicated to the client.
4. **Client Receives:** The client detects the newly replicated server projectile.
5. **Matching:** The client finds its corresponding fake projectile using a shared ID (Prediction Key).
6. **Interpolation:** The client hides the newly arrived server projectile. It then starts smoothly moving its fake projectile towards the replicated position of the server projectile over a short duration.
7. **Handoff:** Once the fake projectile is very close to the server projectile's position, the client destroys the fake projectile and unhides the server projectile. From this point on, the client is simply viewing the replicated movement of the authoritative server projectile.

This complex process creates the illusion of an instantly responsive projectile for the firing player.

The detailed mechanisms for spawning, tracking, replicating, and interpolating are covered in the following sub-pages:

* **Core Concept & Spawning:** Details the spawning logic on client and server, including delayed spawning.
* **Synchronization & Interpolation:** Explains how client and server projectiles are matched and reconciled visually.

***

**Next Steps:**

* Delving into the specifics, let's examine the **"`UGameplayAbility_PredictiveProjectile` - Core Concept & Spawning"** sub-page next.
