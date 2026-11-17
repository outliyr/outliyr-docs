# Weapon State Component

The `ULyraWeaponStateComponent` is a **Controller Component**, meaning it should be added to your `APlayerController` (or potentially AI Controllers if they need similar feedback). Its primary role is to manage weapon-related state that is specific to the _controller's perspective_, particularly focusing on client-side feedback like **confirmed hit markers**. It can also serve as a convenient location to drive the `Tick` function of the currently held weapon instance.

### Role and Purpose

* **Client-Side Feedback:** Manages the process of displaying accurate hit markers. It tracks server-confirmed hits and provides the necessary screen-space location data for UI elements.
* **Hit Confirmation:** Bridges the gap between server-side hit detection (done by firing abilities) and client-side visual feedback, ensuring hit markers only appear for hits the server acknowledges.
* **Damage Timing:** Tracks the time of the last confirmed damage instigated by this controller, useful for timing hit marker display duration or related feedback.
* **Weapon Ticking (Optional):** Provides a centralized place (`TickComponent`) to call the `Tick` function on the currently equipped `ULyraRangedWeaponInstance`, ensuring its internal logic (like spread/heat updates) runs consistently while held.

### Setup

Add the `ULyraWeaponStateComponent` to your primary Player Controller Blueprint or C++ class. It is replicated by default.

### Hit Marker Logic

This is the most complex feature of this component, handling the confirmation loop between server-side hit registration and client-side display.

1. **Server Hit Detection (Gameplay Ability):**
   * A server-side firing ability performs its trace or projectile hit detection.
   * It gathers the hit results (`TArray<FHitResult>`).
   * It generates a `FGameplayAbilityTargetDataHandle` containing relevant hit information and a `UniqueId`.
   * **Crucially**, before sending the Target Data to the client for prediction (if applicable) or confirming the ability, it calls `OwnerController->FindComponentByClass<ULyraWeaponStateComponent>()->AddUnconfirmedServerSideHitMarkers(TargetDataHandle, HitResultsArray)`.
2. **`AddUnconfirmedServerSideHitMarkers` (Server):**
   * Creates a new `FLyraServerSideHitMarkerBatch` associated with the `TargetDataHandle.UniqueId`.
   * Iterates through the provided `HitResultsArray`.
   * For each `FHitResult`:
     * Creates an `FLyraUnconfirmedHitLocation` entry.
     * Stores the world-space `Hit.Location`.
     * Calls `ShouldShowHitAsSuccess(Hit)` to determine if this hit should be displayed visually as a "successful" hit (e.g., hitting an enemy vs. hitting a friendly or geometry). Stores this boolean.
     * Determines the hit zone tag (e.g., `Gameplay.Zone.Headshot`) by checking the `Tags` on the hit `UPhysicalMaterialWithTags`. Stores this tag.
   * Adds the batch to the `UnconfirmedServerSideHitMarkers` array on the server instance of the component.
3. **Server Ability Confirmation:** The firing ability continues, potentially applying damage Gameplay Effects.
4. **Server Confirms to Client:** After processing the target data and applying effects, the server needs to tell the _originating client_ which hits were valid and should be displayed. It calls a **Client RPC** on the `ULyraWeaponStateComponent`: `ClientConfirmTargetData(UniqueId, bSuccess, HitReplaces)`.
   * `UniqueId`: Matches the `UniqueId` from the original `TargetDataHandle`.
   * `bSuccess`: Indicates if the overall ability activation was successful (might be false if canceled).
   * `HitReplaces`: An array indicating indices within the original hit batch that should _not_ be shown (e.g., hits that were rejected by server logic after initial trace).
5. **`ClientConfirmTargetData_Implementation` (Client):**
   * This RPC executes on the owning client's `ULyraWeaponStateComponent`.
   * It finds the matching `FLyraServerSideHitMarkerBatch` in its _local_ (but previously added on server) `UnconfirmedServerSideHitMarkers` array using the `UniqueId`.
   * If found and `bSuccess` is true:
     * It iterates through the `Markers` in the batch.
     * For each marker **not** listed in the `HitReplaces` array:
       * It calls `ActuallyUpdateDamageInstigatedTime()` if `bShowAsSuccess` is true (ensuring the timer resets only for damaging hits).
       * It projects the stored world-space `UnconfirmedLocation` onto the client's screen using `UGameplayStatics::ProjectWorldToScreen`.
       * It creates an `FLyraScreenSpaceHitLocation` struct containing the calculated `ScreenLocation`, the `HitZone` tag, and the `bShowAsSuccess` flag.
       * It adds this confirmed entry to the `LastWeaponDamageScreenLocations` array.
   * It removes the processed batch from `UnconfirmedServerSideHitMarkers`.
6. **UI Reads Confirmed Hits:**
   * A UI widget responsible for displaying hit markers (e.g., part of the crosshair/reticle system) gets the local player's `ULyraWeaponStateComponent`.
   * Periodically (e.g., on its Tick), it calls `GetLastWeaponDamageScreenLocations(MyHitLocationsArray)` on the component.
   * It iterates through `MyHitLocationsArray`, creating or updating hit marker widgets at the specified screen locations, potentially styling them based on `bShowAsSuccess` and `HitZone`.
   * It likely uses `GetTimeSinceLastHitNotification()` to fade out or remove hit markers after a short duration.
   * After processing, it might clear its local copy or wait for the `LastWeaponDamageScreenLocations` array on the component to be cleared (which happens in `ActuallyUpdateDamageInstigatedTime` if enough time passes).

**Helper Logic:**

* `ShouldShowHitAsSuccess(const FHitResult& Hit) const`: Virtual function determining if a hit counts as "successful" for visual feedback. Default checks team affiliation using `ULyraTeamSubsystem`. Can be overridden for different game modes or logic.

### Damage Timing

* `UpdateDamageInstigatedTime(const FGameplayEffectContextHandle& EffectContext)`: Meant to be called when damage is applied (e.g., from a Gameplay Effect Execution Calculation). It checks `ShouldUpdateDamageInstigatedTime` before calling `ActuallyUpdateDamageInstigatedTime`.
* `ShouldUpdateDamageInstigatedTime(...) const`: Virtual function to filter which damage events should update the timer (default just checks for a valid causer, but ideally filters for weapon damage).
* `ActuallyUpdateDamageInstigatedTime()`: Resets the `LastWeaponDamageScreenLocations` array if significant time has passed since the last update, then records the current world time in `LastWeaponDamageInstigatedTime`.
* `GetTimeSinceLastHitNotification() const`: Returns `WorldTime - LastWeaponDamageInstigatedTime`.

### Weapon Ticking

* `TickComponent(...)`: The component's tick function.
* **Logic:** It finds the owning Pawn's `ULyraEquipmentManagerComponent` and checks if the currently held item is a `ULyraRangedWeaponInstance`. If so, it calls `CurrentWeapon->Tick(DeltaTime)`.
* **Purpose:** Provides a reliable place to ensure the held ranged weapon's `Tick` logic (for spread/heat updates) is executed while it's active.

***

The `ULyraWeaponStateComponent` plays a crucial role in providing accurate client-side feedback like hit markers by managing the confirmation process between server-side actions and client display. It also serves as a potential driver for the held weapon's continuous updates.
