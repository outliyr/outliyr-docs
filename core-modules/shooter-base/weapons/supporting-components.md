# Supporting Components

While the core weapon logic resides in the Weapon Instances (`UGunWeaponInstance`) and Gameplay Abilities, a few supporting components and classes play specific roles within the ShooterBase weapon system, primarily related to state tracking, hit confirmation, and debugging.

### Weapon State Component (`UWeaponStateComponent`)

* **Header:** `WeaponStateComponent.h`
* **Parent:** `ULyraWeaponStateComponent`
* **Purpose:** This component, typically attached to the `APlayerController`, extends Lyra's base weapon state component. In Lyra, `ULyraWeaponStateComponent` is primarily used to track unconfirmed hits from client-side traces and confirm them later via server RPCs, mainly for hit marker display.
* **ShooterBase Enhancements:**
  * **Direct Confirmed Hit Handling:** `UWeaponStateComponent` adds functionality specifically useful for server-authoritative projectiles or other scenarios where a hit is confirmed directly on the server _without_ relying on the client's initial unconfirmed report.
  * **`AddConfirmedServerSideHitMarkers(const FHitResult& HitResult)`:** This function can be called on the server (e.g., when a server-authoritative projectile actor detects a hit) for a hit that should generate a hit marker. It checks `ShouldShowHitAsSuccess` and, if true, calls `ClientConfirmSingleHit_Implementation`.
  * **`ClientConfirmSingleHit_Implementation(const FVector& HitLocation, UPhysicalMaterial* PhysicalMaterial)`:** This client RPC bypasses the unconfirmed hit system. When received by the owning client, it projects the server-provided `HitLocation` to screen space, determines the hit zone from the `PhysicalMaterial`, updates the last damage time (`ActuallyUpdateDamageInstigatedTime`), and directly adds a `FLyraScreenSpaceHitLocation` entry to `LastWeaponDamageScreenLocations`. This allows server-authoritative sources (like projectiles hitting on the server) to trigger accurate hit markers on the client.
* **Usage:** While hitscan abilities primarily use the base Lyra component's unconfirmed hit system (`AddUnconfirmedServerSideHitMarkers` / `ClientConfirmTargetData`), the extended functions in `UWeaponStateComponent` are crucial for ensuring projectiles spawned by `UGameplayAbility_RangedWeapon_Projectile` or `UGameplayAbility_PredictiveProjectile` can correctly display hit markers when their server-side instance registers an impact.

### Hitscan Debug Settings (`ULyraHitscanDebugSettings`)

* **Header:** `HitscanDebugSettings.h`
* **Parent:** `UDeveloperSettingsBackedByCVars`
* **Purpose:** This class provides a centralized place in the Project Settings (under "Project" > "Plugins" > "Lyra Hitscan Debug" or similar) to control console variables used for debugging hitscan traces and impacts visually. It makes debugging easier than manually typing CVars in the console.
* **Properties (linked to CVars):**
  * `DrawHitscanTraceDuration` (`lyra.Weapon.DrawHitscanTraceDuration`): Controls how long debug lines for hitscan traces remain visible (in seconds). 0 disables.
  * `DrawHitscanHitDuration` (`lyra.Weapon.DrawHitscanHitDuration`): Controls how long debug points/spheres for hitscan impacts remain visible (in seconds). 0 disables.
  * `DrawHitscanHitRadius` (`lyra.Weapon.DrawHitscanHitRadius`): Sets the size (radius in cm) of the debug points drawn at impact locations when `DrawHitscanHitDuration` is active.
* **Usage:** Developers can easily enable/disable trace and hit visualization directly from the editor settings during development to debug weapon accuracy, penetration paths, and collision issues without needing to remember or constantly re-enter console commands. The actual drawing logic using these CVars is typically found within the trace functions (`DoSingleBulletTrace`) using `#if ENABLE_DRAW_DEBUG` guards and functions like `DrawDebugLine` and `DrawDebugPoint`.

These components complement the main weapon instances and abilities, providing necessary state management for hit feedback and convenient debugging tools for developers working with the ShooterBase weapon systems.

***
