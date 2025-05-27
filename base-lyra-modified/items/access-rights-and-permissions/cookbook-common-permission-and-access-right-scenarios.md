# Cookbook: Common Permission & Access-Right Scenarios

This page provides “recipes” for typical container setups. Each recipe shows the minimal configuration and code (or Blueprint) to grant exactly the rights and permissions you need.

***

### Player Inventory

**Goal:** The local player always has full visibility and all permissions on their own inventory.

1. **Defaults**
   * `DefaultAccessRight = NoAccess`
   * `DefaultPermission = None`
2.  **On BeginPlay** (authority-only)

    ```cpp
    // Grant this player full access & permissions to their own inventory:
    if (APlayerController* Controller = Cast<APlayerController>(GetOwner()))
    {
        if (Implements<UItemPermissionOwner>())
        {
    	Execute_SetContainerAccessRight(this, Controller, EItemContainerAccessRights::FullAccess);
    	Execute_SetContainerPermissions(this, Controller, /* bitmask */ static_cast<int32>(EItemContainerPermissions::Full));
        }
    }
    ```

    Or in Blueprint, call **Set Container Access Right** and **Set Container Permissions** with the owning player’s controller.
3. **Result**
   * Player sees and can freely move/use/equip items in their own inventory.
   * All other players still default to **NoAccess**.

***

### Read-Only Loot Chest

**Goal:** Players can see container contents but cannot take or move anything.

1. **Defaults**
   * `DefaultAccessRight = ReadOnly`
   * `DefaultPermission = None`
2. **No per-player overrides needed**
3. **Result**
   * Every approaching player’s client replicates the item list and weight.
   * All interaction attempts are blocked server-side before permissions check.

***

### Team Stash (Put-Only / Take-Only)

**Goal:** A shared stash where team members can both deposit and withdraw, but the rest of the world cannot see it.

1. **Defaults**
   * `DefaultAccessRight = NoAccess`
   * `DefaultPermission = None`
2.  **Grant per-player**

    ```cpp
    for (APlayerController* TeamPC : TeamMembers)
    {
      // FullAccess to replicate list...
      IItemPermissionOwner::Execute_SetContainerAccessRight(this, TeamPC, EItemContainerAccessRights::FullAccess);

      // But fine-grain: only PutInItems + TakeOutItems
      IItemPermissionOwner::Execute_SetContainerPermissions(this, TeamPC,
        static_cast<int32>(EItemContainerPermissions::PutInItems | EItemContainerPermissions::TakeOutItems));
    }
    ```

    Or in Blueprint loop, call **Set Container Access Right** → **FullAccess**, then **Set Container Permissions** → “Put-In” & “Take-Out.”
3. **Result**
   * Team members see and can deposit/withdraw.
   * Non-team players see nothing.

***

### Ad-Hoc Container Spawned at Runtime

**Goal:** Dynamically create a temporary container that starts hidden, then grant exactly one player full control.

1. **Actor Setup**
   * Your container actor/component class must include `LYRAGAME_DECLARE_PERMISSION_COMPONENT()` (C++ mix-in).
2.  **Spawn & Initialize**

    ```cpp
    AMyContainerActor* NewContainer = GetWorld()->SpawnActor<AMyContainerActor>(…);
    // Ensure defaults:
    IItemPermissionOwner::Execute_SetContainerDefaultAccessRight(NewContainer, EItemContainerAccessRights::NoAccess);
    IItemPermissionOwner::Execute_SetContainerDefaultPermissions(NewContainer, static_cast<int32>(EItemContainerPermissions::None));
    ```
3.  **Grant to one player**

    ```cpp
    IItemPermissionOwner::Execute_SetContainerAccessRight(NewContainer, TargetPC, EItemContainerAccessRights::FullAccess);
    IItemPermissionOwner::Execute_SetContainerPermissions(NewContainer, TargetPC, static_cast<int32>(EItemContainerPermissions::Full));
    ```
4. **Result**
   * Only `TargetPC` will see and use that container until you revoke or destroy it.

***

### World Drop with Delayed Looting

**Goal:** When an item is dropped, no one can see it for X seconds; afterward, nearby players get Read-Only or FullAccess.

1. **Defaults**
   * `DefaultAccessRight = NoAccess`
   * `DefaultPermission = None`
2.  **Spawn Drop**

    ```cpp
    AMyDropActor* Drop = World->SpawnActor<AMyDropActor>(…);
    ```
3.  **After Delay**

    ```cpp
    GetWorldTimerManager().SetTimer(TimerHandle, [Drop]()
    {
      for (APlayerController* PC : GetOverlappingPlayers(Drop->GetSphere()))
      {
        IItemPermissionOwner::Execute_SetContainerAccessRight(Drop, PC, EItemContainerAccessRights::ReadOnly);
        // Optionally allow picking up:
        IItemPermissionOwner::Execute_AddContainerPermission(Drop, PC, static_cast<int32>(EItemContainerPermissions::TakeOutItems));
      }
    }, LootDelaySeconds, /*bLoop=*/false);
    ```
4. **Optional Cleanup**
   * Revoke ReadOnly or destroy actor after loot window closes.

***

#### Tips & Variations

* **Revoke vs. Remove:**
  * `Execute_RemoveContainerAccessRight`, `Execute_RemoveContainerPlayerPermissions`→ falls back to default.
  * `Execute_RemoveContainerPermission` → bitwise clears specific flags for that specific player. Will still keep player specific permissions.
* **UI Reactivity:**
  * Listen for `TAG_ItemPermission_Message_AccessChanged` to close or open UI.
  * Listen for `TAG_ItemPermission_Message_PermissionsChanged` to enable/disable buttons.
* **Authority Only:**
  * All interface mutations are `BlueprintAuthorityOnly` or no-ops on clients—safe to call from mixed C++/Blueprint logic.

With these recipes, you can cover the vast majority of container‐permission requirements in your game, securely, efficiently, and without polluting your container classes with bespoke logic.
