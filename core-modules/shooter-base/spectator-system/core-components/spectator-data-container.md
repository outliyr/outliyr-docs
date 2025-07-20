# Spectator Data Container

The `USpectatorDataContainer` is a lightweight, replicated `UObject` designed specifically to hold the gameplay state information that needs to be mirrored from a spectated player to their active spectators. It lives within and is managed by the `USpectatorDataProxy`, but its properties are replicated independently, subject to the proxy's filtering rules.

### **Replication Strategy and the Killcam**

A key design choice for this system is that the `USpectatorDataContainer` object itself is always replicated to all clients, regardless of their subscription status. While the more complex data it contains (like inventory items) is filtered, the container's basic properties (Camera Mode, ADS Status) are always being broadcast.

This may seem inefficient, but it is a deliberate solution to a problem inherent in creating a Killcam. The Killcam feature works by using the `DemoNetDriver`, which replays the last few seconds of network traffic that the client has already recorded. The problem is that a player is never spectating (and therefore not subscribed to) their killer _before_ they die.

* **The Ideal (But Infeasible) Scenario:** You would know who is about to kill you and subscribe to their data feed a few seconds in advance. This is not possible to predict reliably.
* **The Complex Alternative:** The server could record everyone's state and send a custom, efficient replay packet to a player upon death. This is a significant engineering task and a potential future improvement.
* **The Chosen Solution:** The simplest, most robust approach is to have every player broadcast the minimal information needed for the Killcam. By always replicating the lightweight `USpectatorDataContainer`, we ensure that every client is already recording the necessary data (like camera mode and ADS status) for any potential killer. This allows the Killcam to function correctly by simply replaying the information it was already passively receiving.

### Role and Purpose

* **Data Holder:** Contains the specific variables representing the spectated player's state relevant for immersive spectating (Quickbar, Camera, ADS).
* **Replication Payload:** Acts as the container whose properties are replicated across the network to subscribed spectators.
* **Change Notification:** Uses `OnRep_` functions to detect when replicated data changes on the receiving client (the spectator) and broadcasts local Gameplay Messages to notify other systems (like the Spectator Pawn and UI).
* **Server-Side Logic Host:** Can host server-side logic related to maintaining the integrity of the replicated data, such as managing inventory queries for ammo tracking.

### Key Features and Logic

1. **Ownership and Initialization**
   * Owned by `USpectatorDataProxy`.
   * Created on the server within the proxy's `StartListening` function.
   * Initialize(`USpectatorDataProxy* InOwner`): Called after creation to store a reference back to its owning proxy. It also kicks off initial server-side logic like ManageInventoryQueries.
2. **Replicated Properties**\
   The container replicates several key pieces of state:
   * **QuickBarSlots (`TArray<TObjectPtr<`**[**`ULyraInventoryItemInstance`**](../../../../base-lyra-modified/items/items-and-fragments/item-instance.md)**`>>`):** An array mirroring the `ULyraQuickBarComponent`'s slots on the spectated player's controller. Contains pointers to the actual inventory item instances (which must also support replication). Replication of the items themselves is filtered by the proxy.
   * **`ActiveSlotIndex` (`int32`):** The index of the currently active slot in the quickbar.
   * **`CameraMode` (`TSubclassOf<ULyraCameraMode>`):** The class of the `ULyraCameraMode` currently active on the spectated player's `ULyraCameraComponent`.
   * **`ToggleADS` (bool):** The current Aim Down Sights status of the spectated player.
   * (Internal): OwningProxy (Replicated pointer back to the owner).
3. **`OnRep_` Notifications & Local Messaging**
   * Each replicated property has a corresponding UFUNCTION() marked with `ReplicatedUsing = OnRep_`....
   * **Purpose:** When a property's value changes on a receiving client due to replication, its associated `OnRep_` function is automatically called.
   * **Action:** The primary action within each `OnRep_` function is to construct a specific Gameplay Message containing the updated information and broadcast it **locally** using UGameplayMessageSubsystem.
     * `OnRep_QuickBarSlots` -> Broadcasts `TAG_ShooterGame_Spectator_Message_SlotsChanged` (`FLyraQuickBarSlotsChangedMessage`).
     * `OnRep_ActiveSlotIndex` -> Broadcasts `TAG_ShooterGame_Spectator_Message_ActiveIndexChanged` (`FLyraQuickBarActiveIndexChangedMessage`).
     * `OnRep_CameraMode` -> Broadcasts `TAG_ShooterGame_Spectator_Message_CameraModeChanged` (`FLyraCameraModeChangedMessage`).
     * `OnRep_ToggleADS` -> Broadcasts `TAG_ShooterGame_Spectator_Message_ToggleADS` (`FGameplayADSMessage`).
   * **Decoupling:** This message broadcasting is crucial. It decouples the `USpectatorDataContainer` itself from the systems that consume its data (like `ATeammateSpectator` and UI widgets). These consumers simply listen for the relevant local messages.
4. **Server-Side State Updates (Set... functions)**
   * Provides `SetQuickBarSlots`, `SetActiveSlotIndex`, `SetCameraMode`, `SetToggleADS` functions.
   * These are called by the owning `USpectatorDataProxy` (either directly for server-side changes like quickbar updates, or via RPC implementations for client-side changes like camera mode).
   * They include an authority check `(!OwningProxy->GetOwner()->HasAuthority()`) to ensure only the server modifies these replicated properties.
5. **Dynamic Ammo Tracking (Server-Side)**
   * **Problem:** Quickbar weapon instances might not directly store replicated ammo counts if ammo is managed within the player's inventory. Spectators need to see the correct spare ammo.
   * **`ManageInventoryQueries()`:**
     * Called on the server when the QuickBarSlots change or when spectating starts (`UpdateSpectatorList`).
     * Checks if the container's owner `IsBeingSpectated`. If not, or if not on the server, it does nothing or cleans up.
     * Gets the spectated player's `ULyraInventoryManagerComponent`.
     * Iterates through the current `QuickBarSlots`.
     * For each weapon with an [`UInventoryFragment_Gun`](../../weapons/gun-fragment/) specifying `InventoryAmmoTypes`, it determines the set of required ammo ItemDefinition classes.
     * It maintains a list (`ActiveInventoryQueries`) of `ULyraInventoryQuery` objects. For each required ammo type set, it ensures a query exists, creating one if needed (`NewObject<ULyraInventoryQuery>`).
     * Each `ULyraInventoryQuery` is initialized to monitor the specified ammo types within the player's inventory. It listens for `Lyra.Inventory.Message.StackChanged`.
     * It binds the `HandleInventoryAmmoUpdated` function to the query's `OnUpdatedWithTrackedDefs` delegate.
     * It removes any `ULyraInventoryQuery` instances from `ActiveInventoryQueries` that are no longer needed (because the corresponding weapon is no longer in the quickbar).
   * **`HandleInventoryAmmoUpdated()`:**
     * Called (on the server) when an active `ULyraInventoryQuery` detects a change in the stack count of a tracked ammo type.
     * Receives the set of ammo definitions (`AmmoSet`) and the current list of matching ammo instances (Items).
     * It finds which weapon(s) in the `QuickBarSlots` use that exact `AmmoSet`.
     * It calculates the total count of ammo across all Items instances (`GetStatTagStackCount(TAG_Lyra_Inventory_Item_Count)`).
     * It updates a specific stat tag on the relevant weapon instance(s) within the QuickBarSlots: `WeaponInstance->SetStatTagStack(TAG_Lyra_Weapon_SpareAmmo, TotalAmmo)`.
   * **Replication:** Because the `ULyraInventoryItemInstance` (the weapon) is replicated (when filtered by the proxy), the change to its `TAG_Lyra_Weapon_SpareAmmo` stat tag **replicates** to the subscribed spectator. Spectator UI widgets can then read this tag directly from the weapon instance to display the spare ammo count.
   * **Cleanup (`UpdateSpectatorList`):** When `IsBeingSpectated` becomes false, existing inventory queries are stopped and cleared to save server resources.

### Summary

The `USpectatorDataContainer` is the replicated data packet carrying the essential state needed for immersive spectating. It acts as a bridge between the authoritative game state (managed server-side, sometimes relayed from the client via the proxy) and the spectator client. Its use of `OnRep_` functions and local Gameplay Message broadcasting provides a clean, decoupled way for spectator systems like the `ATeammateSpectator` camera and UI widgets to react to changes in the spectated player's state, while its server-side logic handles complex tasks like tracking inventory-based ammo counts.
