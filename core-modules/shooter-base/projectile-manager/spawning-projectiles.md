# Spawning Projectiles

Unlike spawning standard `AActor` projectiles directly, interacting with the high-performance Projectile Manager involves sending a data message containing all the necessary projectile parameters. The Manager listens for these messages and forwards the data to its simulation thread.

### The Message System

The primary mechanism for requesting a projectile spawn is the **`UGameplayMessageSubsystem`**. This engine system provides a decoupled way for different parts of the game to communicate without direct references.

* **Tag:** A specific Gameplay Tag, `TAG_ShooterGame_TraceProjectile_Message` (`ShooterGame.TraceProjectile.Message`), is used to identify messages intended for the Projectile Manager.
* **Broadcasting:** The code initiating the shot (typically a server-side Gameplay Ability) broadcasts a message using this tag.
* **Listening:** The `UProjectileManager` registers itself as a listener for this tag upon initialization.

### The Data Payload (`FNewTraceProjectileMessage`)

All the information needed to define and simulate a projectile is packaged into an `FNewTraceProjectileMessage` struct. This struct is broadcast as the payload of the message.

```cpp
// Defined in ProjectileManager.h (or similar header)
USTRUCT(BlueprintType)
struct FNewTraceProjectileMessage
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite) // World-space location where the projectile simulation begins.
    FVector StartLocation = FVector::ZeroVector;

    UPROPERTY(BlueprintReadWrite) // Initial velocity vector (Direction * Speed).
    FVector StartVelocity = FVector::ZeroVector;

    UPROPERTY(BlueprintReadWrite) // Maximum distance the projectile can travel (in cm).
    float MaxRange = 0.0f;

    UPROPERTY(BlueprintReadWrite) // Maximum time the projectile can exist (in seconds).
    float MaxLifespan = 0.1f;

    UPROPERTY(BlueprintReadWrite) // Radius for sphere traces (if > 0), 0 for line trace.
    float ProjectileRadius = 0.0f;

    UPROPERTY(BlueprintReadWrite) // Controller responsible for this shot.
    TObjectPtr<AController> Instigator;

    UPROPERTY(BlueprintReadWrite) // Actor that directly caused the shot (e.g., the Weapon actor).
    TObjectPtr<AActor> Causer;

    UPROPERTY(BlueprintReadWrite) // Gameplay Effect to apply upon hitting a valid target.
    TSubclassOf<UGameplayEffect> HitEffect;

    UPROPERTY(BlueprintReadWrite) // Gameplay Tag used to trigger impact cosmetic cues (particles, sounds).
    FGameplayTag ImpactCueNotify;

    UPROPERTY(BlueprintReadWrite) // Map defining penetration rules per Physical Material.
    TMap<TObjectPtr<UPhysicalMaterial>, FProjectileMaterialPenetrationInfo> MaterialPenetrationMap;

    UPROPERTY(BlueprintReadWrite) // Max number of surfaces to penetrate (-1 for infinite, 0 for none).
    int32 MaxPenetrations = -1;

    UPROPERTY(BlueprintReadWrite) // Latency of the firing client (in ms) at the time of the shot. Needed for lag comp.
    float Latency = 0.0f;

    UPROPERTY(BlueprintReadWrite) // Estimated server timestamp when the client fired. Needed for lag comp.
    double Timestamp = 0.0f;

    // Constructor...
};
```

**Populating the Struct:**

* **`StartLocation` / `StartVelocity`:** Typically derived from the weapon's muzzle socket location and the calculated aiming direction (including spread) from a Gameplay Ability's trace results (`TargetDataHandle`). Velocity magnitude comes from weapon stats.
* **`MaxRange` / `MaxLifespan` / `ProjectileRadius`:** Usually defined by the weapon's data (e.g., on the `ULyraRangedWeaponInstance` or a specific fragment). `ProjectileRadius` determines if lag comp traces use `Line` or `Sphere`.
* **`Instigator` / `Causer`:** Obtained from the Gameplay Ability's Actor Info.
* **`HitEffect` / `ImpactCueNotify`:** Configured on the Gameplay Ability asset or potentially derived from weapon/ammo data.
* **`MaterialPenetrationMap` / `MaxPenetrations`:** Configured on the Gameplay Ability asset (like `UGameplayAbility_HitScanPenetration`'s settings, but passed along for projectile use) or weapon data.
* **`Latency` / `Timestamp`:** Critical for lag compensation. The Gameplay Ability needs to calculate/retrieve these values. `Timestamp` often comes from the `FLyraGameplayAbilityTargetData_SingleTargetHit`, and `Latency` can be retrieved from the `APlayerState`.

### Broadcasting the Message (Example from a Gameplay Ability)

This typically happens on the **server** within the `OnTargetDataReadyCallback` (or a function called from it) after the ability cost has been successfully committed.

<!-- tabs:start -->
#### **C++**
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




#### **Blueprints**
<img src=".gitbook/assets/image (5).png" alt="" title="">

<!-- tabs:end -->

By populating the `FNewTraceProjectileMessage` with accurate data derived from the weapon, ability, and client's target data, and broadcasting it using the correct tag, you instruct the `UProjectileManager` to initiate the simulation of a high-performance, lag-compensated projectile on its dedicated thread.

***
