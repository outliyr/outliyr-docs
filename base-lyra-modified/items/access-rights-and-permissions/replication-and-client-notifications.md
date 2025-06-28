# Replication & Client Notifications

This page explains how your permission data actually travels from the server to each client, how it’s surfaced locally, and how your UI or gameplay code can hook into those updates in a fully decoupled way.

***

### What Is Replicated, to Whom, and When

#### Key Replicated Properties

* **DefaultAccessRight** (`OnRep_DefaultAccess`)\
  – The fallback access level when no player-specific entry exists.
* **DefaultPermission** (`OnRep_DefaultPerms`)\
  – The fallback permission bitmask when no player-specific entry exists.
* **AccessRightsList** (`FItemAccessRightsContainer`)\
  – A Fast-Array of per-player overrides. Delta-replicated when entries are added/changed/removed.
* **PermissionList** (`FItemPermissionsContainer`)\
  – A Fast-Array of per-player permission bitmasks. Same delta-replication behavior.

> [!info]
> **Note:** `UItemPermissionComponent` is a **replicated subobject** of its owner (e.g. your inventory or equipment component). You must forward it in your owner’s `ReplicateSubobjects` override so that the engine knows to serialize it down each actor channel.

#### Replication Flow

1. **Server‐side change**\
   You call one of the `IItemPermissionOwner` mutator methods (e.g. `Execute_AddContainerPermission`).
2. **Mark dirty**\
   The Fast-Array container marks that entry (or the array) dirty.
3. **Network serialization**\
   On the next tick, Unreal serializes:
   * Any changed Fast-Array entries
   * Any changed default property
4. **Client callbacks**
   * Fast-Array invokes `PreReplicatedRemove`, `PostReplicatedAdd`, or `PostReplicatedChange`.
   * Default properties fire their `OnRep` handlers.
5. **Broadcast messages**\
   The component’s callbacks then call `BroadcastAccessChanged` / `BroadcastPermsChanged` → sending gameplay messages.

***

### Gameplay Message Tags & Payloads

When any permission or access‐right value changes, whether default or specific, the component broadcasts:

#### `TAG_ItemPermission_Message_AccessChanged`&#x20;

```cpp
USTRUCT(BlueprintType)
struct FItemAccessRightsChangedMessage
{
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly) UObject*      Container;   // The owning object
  UPROPERTY(BlueprintReadOnly) APlayerController* Player;  // Who changed
  UPROPERTY(BlueprintReadOnly) EItemContainerAccessRights NewAccess;
};
```

#### `TAG_ItemPermission_Message_PermissionsChanged`

```cpp
USTRUCT(BlueprintType)
struct FItemPermissionsChangedMessage
{
  GENERATED_BODY()

  UPROPERTY(BlueprintReadOnly) UObject*      Container;
  UPROPERTY(BlueprintReadOnly) APlayerController* Player;
  UPROPERTY(BlueprintReadOnly) EItemContainerPermissions NewPermission;
};
```

> [!info]
> **Why gameplay messages?**\
> Unlike delegates, messages let _any_ subsystem—UI, AI, abilities—listen without needing a direct reference or extra boilerplate in your component.

***

### Widget & Gameplay Listening Pattern

To make your UI or gameplay logic respond to permission changes:

1. **Register your listener** (e.g. in your widget’s Construct):

<img src=".gitbook/assets/image (6) (1).png" alt="" width="563" title="">

(FLyraInventoryChangeMessage)

1.  **Handle the message**:

    ```blueprint
    OnAccessChanged(FItemAccessRightsChangedMessage Msg)
      if (Msg.Container == MyContainerRef)
        switch (Msg.NewAccess)
          • NoAccess   → Close or hide UI
          • ReadOnly   → Disable all interactive buttons
          • FullAccess → Enable full interaction
    ```

    And similarly for `TAG_ItemPermission_Message_PermissionsChanged` to gray-out or enable individual buttons (e.g. “Take Out” only if `NewPermission & TakeOutItems != 0`).
2.  **Unregister on teardown** (e.g. Destruct):

    ```blueprint
    GameplayMessageSubsystem → Unregister Listener (Handle)
    ```

> [!info]
> **Pro Tips**
> 
> * Listen to **both** messages if you need dynamic button states.
> * Filter on `Msg.Container` so you ignore events from other containers.
> * You can also listen in C++ by binding to `UGameplayMessageSubsystem::OnMessage` with the same tag.

***

By following this pattern, your UI and gameplay code stays fully decoupled from the permission‐storage machinery, yet remains instantly reactive to any server‐driven changes.
