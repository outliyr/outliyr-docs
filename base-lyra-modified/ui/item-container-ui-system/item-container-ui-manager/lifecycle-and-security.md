# Lifecycle & Security

In a multiplayer environment, the client's UI is not the authority. The server controls the state of the world, and the UI must react instantly when that state changes.

This page explains how the **UI Manager** acts as the "Enforcer," ensuring windows close when items are destroyed, out of range, or when permissions are revoked.

### The Observer Pattern

The UI Manager does not poll for changes every frame. Instead, it relies on the **Gameplay Message Subsystem**. Upon initialization, it registers listeners for critical item events.

```cpp
// In ULyraItemContainerUIManager::Initialize
ItemDestroyedListenerHandle = Subsystem->RegisterListener(
    TAG_Lyra_Item_Message_ItemDestroyed, ... );

ItemMovedListenerHandle = Subsystem->RegisterListener(
    TAG_Lyra_Item_Message_ItemMoved, ... );

AccessChangedListenerHandle = Subsystem->RegisterListener(
    TAG_ItemPermission_Message_AccessChanged, ... );
```

### Handling Destruction (`HandleItemDestroyed`)

**Scenario:** A player is looking inside a loot bag. Another player shoots the bag, destroying it.

1. The Server destroys the item/actor and replicates this to the Client.
2. The `LyraInventoryItemInstance` broadcasts a destruction message.
3. **UI Manager:** Receives `HandleItemDestroyed`.
4. It calls `CloseSessionsForItem(ItemId, EItemWindowCloseReason::SourceLost)`.
5. Any session (and its windows) tracking that Item ID is immediately closed.

This prevents the UI from showing "ghost" windows pointing to deleted objects, which would likely crash the game if the player tried to interact with them.

### Handling Access Revocation (`HandleContainerAccessChanged`)

**Scenario:** A player opens a secure bank vault. The server logic decides the player's time is up or their clearance is revoked.

The server updates the `LyraItemPermissionComponent` on the container. This component replicates the new permission state to the client.

1. **Replication:** Client receives updated `AccessRights` (e.g., `ReadWrite` -> `NoAccess`).
2. **Broadcast:** The component broadcasts `TAG_ItemPermission_Message_AccessChanged`.
3. **UI Manager:** Receives `HandleContainerAccessChanged`.
4. **Check:** It verifies if the access level is insufficient (anything less than `ReadWrite`).
5. **Enforcement:** It calls `CloseWindowsForContainer`. It iterates _all_ active sessions, checks if their source matches the revoked container, and force-closes them with `Reason::PermissionRevoked`.

This provides a secure way to manage UI from the server. You don't need to RPC "ClientCloseWindow", you just change the permission, and the UI system cleans itself up.

### Garbage Collection Safety

Beyond explicit events, the UI Manager runs a periodic cleanup task (`OnCleanupTimerFired`).

Unreal Engine's Garbage Collector can be aggressive. If a developer forgets to release a ViewModel lease, or if an Actor is destroyed without broadcasting an event (e.g., `DestroyActor` called directly), we could end up with "Stale" ViewModels.

The cleanup loop iterates the `UnifiedViewModelCache`:

1. It checks the `TWeakObjectPtr` to the Owner (the Component/Actor).
2. If the pointer is stale (null or pending kill), it acts as a failsafe.
3. It forcibly calls `Uninitialize()` on the ViewModel and removes it from the cache.

This ensures that even in the worst-case scenario (bugs, crashes, network lag), the UI system eventually self-heals and frees memory.
