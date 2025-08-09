# Using the Access-Permissions Interface

Whenever your gameplay code or UI needs to **check** or **modify** access rights or permissions, **always** go through the `IItemPermissionOwner` interface.\
Never reach into the `PermissionComponent` pointer directly, its storage is private and may change.\
This circumvents the need to bloat each component the permission container is added with generic getter/setter functions instead the interface would have all the generic access rights & permission functions typically required.

***

#### C++ vs. Blueprint

```cpp
// ✗ WRONG: bypasses encapsulation
PermissionComp->SetAccess(PC, EItemContainerAccessRights::ReadOnly);

// ✔ RIGHT: routes through the interface thunk
IItemPermissionOwner::Execute_SetContainerAccessRight(
    ContainerObject,    // any UObject* implementing the interface
    PC,                 // APlayerController*
    EItemContainerAccessRights::ReadOnly
);

IItemPermissionOwner::Execute_SetContainerPermissions(
    ContainerObject,     // any UObject* implementing the interface
    Controller,          // APlayerController*
    /* bitmask */ static_cast<int32>(EItemContainerPermissions::Full)
);
```

> [!warning]
> **Note:** `EItemContainerPermissions` is a Bitmasks enum. To allow for bitmask manipulation in blueprints the interface uses int32 inputs. This means that in c++, `EitemContainerPermissions` has to be cast to `int32`. Which you can simply do with `static_cast<int32>(PermissionEnum)`.\
> \
> **No need to cast** in blueprints, blueprints will automatically handle the bitmask.

<div class="collapse">
<p class="collapse-title">Why “Execute_”?</p>
<div class="collapse-content">

Unreal’s UInterface mechanism generates static thunk functions prefixed with `Execute_…`. When you call one of those, it will:

1. **Validate** that the target `UObject*` actually implements `UItemPermissionOwner`.
2. **Dispatch** to the correct C++ `_Implementation` or Blueprint override.
3. **Enforce** any `BlueprintAuthorityOnly` tags (mutators will no-op on non-authoritative clients).

</div>
</div>

In Blueprints, you don't have to worry about "Execute_" you’ll get automatically generated nodes like below, which you can just call as is:

* **Set Container Access Right**
* **Remove Container Access Right**
* **Set Container Permissions**

***

#### Interface Methods at a Glance

| Method                              | Description                                                                                           | C++ “Execute_” Call                                                                                                       | Authority Required? |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **SetContainerAccessRight**         | Grant or override a player’s access level (e.g. ReadOnly/Full).                                       | `IItemPermissionOwner::Execute_SetContainerAccessRight(ContainerObj, PC, Rights);`                                         | ✔ Yes               |
| **RemoveContainerAccessRight**      | Remove a specific override, falling back to the container default.                                    | `IItemPermissionOwner::Execute_RemoveContainerAccessRight(ContainerObj, PC);`                                              | ✔ Yes               |
| **SetContainerPermissions**         | Override the full bitmask of fine-grained permissions.                                                | `IItemPermissionOwner::Execute_SetContainerPermissions(ContainerObj, PC, Perms);`                                          | ✔ Yes               |
| **AddContainerPermission**          | Add (bitwise OR) one or more permission flags.                                                        | `IItemPermissionOwner::Execute_AddContainerPermission(ContainerObj, PC, PermToAdd);`                                       | ✔ Yes               |
| **RemoveContainerPermission**       | Remove (bitwise AND NOT) one or more permission flags.                                                | `IItemPermissionOwner::Execute_RemoveContainerPermission(ContainerObj, PC, PermsToRemove);`                                | ✔ Yes               |
| **RemoveContainerPlayerPermission** | Remove all player specific permissions, player will now use the default permissions of that container | `IItemPermissionOwner::Execute_RemoveContainerPlayerPermission(ContainerObj, PC);`                                         | ✔ Yes               |
| **GetContainerAccessRight**         | Query the player’s **effective** access right.                                                        | `auto Rights = IItemPermissionOwner::Execute_GetContainerAccessRight(ContainerObj, PC);`                                   | No                  |
| **HasContainerPermission**          | Test if the player has the given permission bit(s).                                                   | `bool bOK = IItemPermissionOwner::Execute_HasContainerPermission(ContainerObj, PC, EItemContainerPermissions::MoveItems);` | No                  |
| **SetContainerDefaultAccessRight**  | Grant or override a **default** access level (e.g. ReadOnly/Full).                                    | `IItemPermissionOwner::Execute_SetContainerDefaultAccessRight(ContainerObj, Rights);`                                      | ✔ Yes               |
| **SetContainerDefaultPermissions**  | Override the **default** full bitmask of fine-grained permissions.                                    | `IItemPermissionOwner::Execute_SetContainerDefaultPermissions(ContainerObj, PC, Perms);`                                   | ✔ Yes               |

> [!info]
> **Tip:**
> 
> * Mutation methods (`Set…`, `Add…`, `Remove…`) are marked **BlueprintAuthorityOnly** and will do nothing on clients.
> * If you already have a `TScriptInterface<IItemPermissionOwner>` you can call the methods directly on that, but the static `Execute_` entrypoints work with any raw `UObject*`.

***

### Example Usage

<div class="collapse">
<p class="collapse-title">Grant Read-Only Access in C+</p>
<div class="collapse-content">

```cpp
// Inside some server-only logic (e.g. overlap event handler):
IItemPermissionOwner::Execute_SetContainerAccessRight(
    MyContainerComponent,    // any UObject* implementing the interface
    PlayerController,        // whose access to change
    EItemContainerAccessRights::ReadOnly
);
```

</div>
</div>

<div class="collapse">
<p class="collapse-title">Check “MoveItems” Permission </p>
<div class="collapse-content">

```cpp
bool bCanMove = IItemPermissionOwner::Execute_HasContainerPermission(
    MyContainerComponent, // any UObject* implementing the interface
    PlayerController, // whose access to change
    EItemContainerPermissions::MoveItems
);
```

</div>
</div>

<div class="collapse">
<p class="collapse-title">Blueprint</p>
<div class="collapse-content">

In Blueprint graphs you’ll see nodes auto-generated from the interface, for example:

<img src=".gitbook/assets/image (42).png" alt="" title="">

</div>
</div>

***

By always dispatching through `IItemPermissionOwner::Execute_…`, you

* keep the component’s internals private (future-proofing),
* automatically respect server-only authority rules, and
* allow both C++ and Blueprint overrides to coexist seamlessly.
