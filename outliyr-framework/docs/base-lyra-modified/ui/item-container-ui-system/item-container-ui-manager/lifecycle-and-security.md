# Lifecycle & Security

In a multiplayer environment, the client's UI is not the authority. The server controls the state of the world, and the UI must react instantly when that state changes.

This page explains how the **UI Manager** acts as the "Enforcer," ensuring windows close when items are destroyed, out of range, or when permissions are revoked.

## The Observer Pattern

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

This prevents the UI from showing "ghost" windows pointing to deleted objects, which would likely crash the game if the player tried to interact with them. Because the cache is session-owned, closing the affected sessions evicts their ViewModels automatically.

### Handling Access Revocation (`HandleContainerAccessChanged`)

**Scenario:** A player opens a secure bank vault. The server logic decides the player's time is up or their clearance is revoked.

The server updates the `LyraItemPermissionComponent` on the container. This component replicates the new permission state to the client.

1. **Replication:** Client receives updated `AccessRights` (e.g., `ReadWrite` -> `NoAccess`).
2. **Broadcast:** The component broadcasts `TAG_ItemPermission_Message_AccessChanged`.
3. **UI Manager:** Receives `HandleContainerAccessChanged`.
4. **Check:** It verifies if the access level is insufficient (anything less than `ReadWrite`).
5. **Enforcement:** It calls `CloseWindowsForContainer`. It iterates _all_ active sessions, checks if their source matches the revoked container, and force-closes them with `Reason::PermissionRevoked`. Closing those sessions evicts the associated ViewModels through the cache's normal ownership path.

This provides a secure way to manage UI from the server. You don't need to RPC "ClientCloseWindow", you just change the permission, and the UI system cleans itself up.

### Failsafe Cleanup

Most eviction happens through session lifecycle, closing a session removes it from every cache entry it owned, and entries with no remaining owners are uninitialized and removed in the same step. Item destruction and access revocation close the affected sessions, so cache eviction follows by construction.

A separate path handles the cases where a backing object disappears without the matching session ever closing.

`CleanupStaleViewModels` runs at the start of every `GetOrCreateViewModel` call. It walks the cache and drops two kinds of stale entries:

1. **Object-keyed entries** whose `TWeakObjectPtr<UObject> ContainerObject` has gone invalid. This catches actors and components destroyed through code paths that bypass the observer messages.
2. **GUID-keyed entries** whose `ItemGuid` can no longer be resolved through `ULyraItemSubsystem::FindItemByGuid`. This catches items that have been destroyed but whose owning session has not yet closed for some reason.

`ClearAllViewModels` runs during subsystem teardown and on map transition. It uninitializes every cached ViewModel and empties the cache. The base session is recreated immediately after the map transition, so widgets in the next map find the cache fresh but the entry point still available.

{% hint style="success" %}
You never invoke either path by hand. They exist so the system stays consistent when components, items, or maps disappear outside the normal session-driven flow.
{% endhint %}
