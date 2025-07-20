# Target Data Handling

After performing targeting traces, the results (hit locations, actors hit, surface materials, etc.) need to be packaged and processed. In GAS, this is done using `FGameplayAbilityTargetDataHandle`, which can contain one or more `FGameplayAbilityTargetData` objects. `UGameplayAbility_RangedWeapon` establishes the framework for creating and managing this data, particularly for hitscan-like results.

### Target Data Structure (`FLyraGameplayAbilityTargetData_SingleTargetHit`)

While the base GAS provides `FGameplayAbilityTargetData_SingleTargetHit`, Lyra (and thus ShooterBase) often uses a slightly extended version:

This structure holds the standard `FHitResult` from a trace. ShooterBase abilities often populate or utilize additional fields like:

* **`Timestamp`:** Added by ShooterBase abilities (`UGameplayAbility_RangedWeapon_Hitscan`, `_Projectile`). Captures the client's perceived server time when the shot was fired. This is crucial for the server-side lag compensation system to accurately rewind the world state for validation.
* **`CartridgeID`:** A random ID assigned to all bullet traces originating from a single trigger pull / ability activation, especially useful for multi-pellet weapons like shotguns to group their impacts.
* **`MyItem`:** (Re-purposed by `UGameplayAbility_HitScanPenetration`) Standard `FHitResult` field used by the penetration ability to link consecutive hits that resulted from a single initial bullet trace penetrating multiple surfaces.
* **`bHitReplaced`:** A boolean flag set by the server during hit validation (`PerformServerSideValidation`). If `true`, it indicates the client's hit result was deemed invalid (due to cheating or discrepancy) and potentially replaced with the server's calculated hit (or nullified).

### Packaging Target Data (`StartRangedWeaponTargeting`)

Subclasses implementing `StartRangedWeaponTargeting` are responsible for creating and packaging the `FGameplayAbilityTargetDataHandle`:

1. **Perform Traces:** Use `DoSingleBulletTrace` or similar methods to get `FHitResult`s.
2. **Create Target Data Handle:** Instantiate an `FGameplayAbilityTargetDataHandle TargetData;`.
3. **Assign Unique ID:** Set `TargetData.UniqueId`. This is often linked to the `ULyraWeaponStateComponent`'s unconfirmed hit marker count (`WeaponStateComponent->GetUnconfirmedServerSideHitMarkerCount()`) to correlate target data with hit marker confirmations later.
4. **Populate Data:** For each relevant `FHitResult`:
   * Create a new instance: `FLyraGameplayAbilityTargetData_SingleTargetHit* NewTargetData = new FLyraGameplayAbilityTargetData_SingleTargetHit();`
   * Assign the `HitResult`: `NewTargetData->HitResult = FoundHit;`
   * Assign `CartridgeID` (if applicable).
   * Assign `Timestamp` (using calculated client perceived server time).
   * Assign `MyItem` (if used for grouping, like in penetration).
   * Add it to the handle: `TargetData.Add(NewTargetData);`
5. **Handle Unconfirmed Hits (Hitscan):** If using the hit marker system (primarily for hitscan), call `WeaponStateComponent->AddUnconfirmedServerSideHitMarkers(TargetData, FoundHits)` to register the hits locally for immediate visual feedback while waiting for server confirmation. Projectile abilities skip this and use `ClientConfirmSingleHit` directly upon server-confirmed impact.
6. **Trigger Callback:** Call `OnTargetDataReadyCallback(TargetData, FGameplayTag())` to immediately process the data locally (or pass it to the server if needed).

```cpp
// Example Snippet (from UGameplayAbility_RangedWeapon_Hitscan::StartRangedWeaponTargeting)
// ... PerformLocalTargeting(FoundHits); ...

FGameplayAbilityTargetDataHandle TargetData;
TargetData.UniqueId = WeaponStateComponent ? WeaponStateComponent->GetUnconfirmedServerSideHitMarkerCount() : 0;

if (FoundHits.Num() > 0)
{
    const int32 CartridgeID = FMath::Rand(); // Example
    double Timestamp = CalculateClientTimestamp(); // Example calculation

    for (const FHitResult& FoundHit : FoundHits)
    {
        FLyraGameplayAbilityTargetData_SingleTargetHit* NewTargetData = // ... create new ...
        NewTargetData->HitResult = FoundHit;
        NewTargetData->CartridgeID = CartridgeID;
        NewTargetData->Timestamp = Timestamp;
        // NewTargetData->HitResult.MyItem = LocalBulletID; // If tracking penetration hits

        TargetData.Add(NewTargetData);
    }
}

// Send hit marker info (if using unconfirmed system)
if (WeaponStateComponent)
{
    WeaponStateComponent->AddUnconfirmedServerSideHitMarkers(TargetData, FoundHits);
}

// Process data (sends to server if client, processes locally if server/standalone)
OnTargetDataReadyCallback(TargetData, FGameplayTag());
```

### Processing Target Data (`OnTargetDataReadyCallback`)

As established in the Core Logic page, `OnTargetDataReadyCallback` is the central function where the generated (or received) target data is acted upon.

* **Local Client:** Processes the data immediately for local effects (visuals, sound, potentially adding spread via `WeaponData->AddSpread()`) and sends the `TargetDataHandle` to the server using `CallServerSetReplicatedTargetData`.
* **Server (Receiving from Client):** Receives the `TargetDataHandle`. For hitscan, it performs validation (`PerformServerSideValidation`) using lag compensation. After validation, it processes the _validated_ data (`ProcessValidatedTargetData`), applies gameplay effects (damage), confirms hit markers (`ClientConfirmTargetData`), and potentially applies costs/cooldowns. For server-authoritative projectiles, it might simply use the data to spawn the projectile actor.
* **Server (Standalone/Listen Server):** Processes the data directly without needing explicit validation against a remote client's state. Still applies effects, confirms hits, etc.

### Target Data Cleanup (`EndAbility`)

The `EndAbility` function ensures that any target data associated with the ability's prediction key is consumed by the Ability System Component (`MyAbilityComponent->ConsumeClientReplicatedTargetData(...)`), preventing potential issues with leftover data from previous activations.

This structured approach to creating, packaging, and processing target data within the GAS framework allows ShooterBase abilities to handle complex hit results, integrate with lag compensation, and manage network communication effectively.

***
