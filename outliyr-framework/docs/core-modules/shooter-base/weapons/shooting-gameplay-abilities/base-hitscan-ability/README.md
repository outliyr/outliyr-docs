# Base Hitscan Ability

This ability provides the core implementation for weapons that use **hitscan** mechanics – where the "bullet" travels instantaneously along a line or narrow sweep from the firing point to its maximum range, registering hits immediately. This is typical for many rifles, pistols, and SMGs in shooter games.

### Purpose and Key Features

* **Instant Hit Detection:** Uses line traces (or narrow sphere sweeps) performed via the base class (`UGameplayAbility_RangedWeapon`) helper functions (`DoSingleBulletTrace`) to determine impacts along the aiming vector.
* **Responsiveness:** Designed for immediate feedback. The firing client performs local traces and triggers cosmetic effects instantly.
* **Server-Side Validation:** Incorporates robust validation using the **Lag Compensation Manager** to ensure fairness and prevent cheating in networked environments. The server authoritatively verifies client-reported hits against a rewound world state.
* **Hit Marker Integration:** Leverages the `ULyraWeaponStateComponent` to show immediate, unconfirmed hit markers on the client's HUD, which are later confirmed or invalidated by the server.
* **Base for Penetration:** Serves as the direct parent class for `UGameplayAbility_HitScanPenetration`, which extends this logic.

### Execution Flow Summary

The hitscan ability follows a specific flow designed for responsiveness and network security:

1. **Client Activation:** The ability activates on the firing client.
2. **Local Trace & Data Packaging:** The client performs traces (`StartRangedWeaponTargeting` -> `TraceBulletsInCartridge`), applies spread, gathers `FHitResult`s, and packages them along with a `Timestamp` into a `FGameplayAbilityTargetDataHandle`.
3. **Local Feedback:** The client registers unconfirmed hits (`AddUnconfirmedServerSideHitMarkers`) for immediate HUD feedback and triggers local cosmetic effects (`OnRangedWeaponTargetDataReady`).
4. **Send to Server:** The client sends the `TargetDataHandle` and associated `PredictionKey` to the server via RPC.
5. **Server Validation:** The server receives the data, performs basic sanity checks, and uses the Lag Compensation Manager (`PerformServerSideValidation`) to perform authoritative traces in a rewound world state based on the client's `Timestamp`. It compares its results with the client's reported hits.
6. **Server Processing:** The server filters the hits based on validation (`ProcessValidatedTargetData`), confirms valid hits back to the client (`ClientConfirmTargetData`), authoritatively applies costs (ammo), and applies gameplay effects (damage) for the validated hits.

This detailed flow is broken down further in the following sub-pages:

* **Client-Side Execution:** Covers steps 1-4.
* **Server-Side Validation (Lag Compensation):** Covers step 5.
* **Processing Validated Data:** Covers step 6.

Understanding this ability is crucial for implementing most conventional firearms in your ShooterBase project.

***
