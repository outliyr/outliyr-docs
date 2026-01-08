# Validation And Permission

Before any transaction executes, it must pass validation. This page explains the two-stage validation process and the permission model that controls who can do what with container contents.

***

### Two-Stage Validation

Validation happens in two phases, each serving a different purpose.

#### Stage 1: Pre-Filter (Cheap Checks)

Before the ability even activates, `ShouldAbilityRespondToEvent` performs quick sanity checks:

```cpp
bool ShouldAbilityRespondToEvent(const FGameplayEventData& EventData)
{
    // Is the request valid?
    if (!Request.HasOps()) return false;

    // Are slot descriptors recognizable types?
    for (const FInstancedStruct& Op : Request.Ops)
    {
        if (!IsKnownOpType(Op)) return false;
    }

    // Does the player exist?
    if (!PC) return false;

    return true;
}
```

Purpose: Reject obviously invalid requests without allocating ability resources.

What it checks:

* Request has at least one operation
* Operation types are recognized
* Basic data is present (player controller, slots)

What it skips:

* Container resolution (requires object lookups)
* Item existence checks (requires container queries)
* Permission validation (requires permission component access)

#### Stage 2: Full Validation

Once the ability activates, each operation is fully validated:

```cpp
for (const FInstancedStruct& Op : Request.Ops)
{
    if (!ValidateOp(Op, Context))
    {
        RejectTransaction(EItemTransactionResult::Failed_Validation);
        return;
    }
}
```

What it checks:

* Containers can be resolved from slot descriptors
* Items exist in source slots
* Destinations can accept items
* Stack counts are valid
* Permissions allow the operation
* Container limits aren't exceeded

Only after **all** operations pass validation do any execute.

***

### The Permission Model

Permissions control who can interact with containers and how. The model has two layers.

#### Access Rights (Visibility Gate)

Access rights determine if a player can see a container at all:

```cpp
enum class EItemContainerAccessRights : uint8
{
    None,       // Not specified
    NoAccess,   // Container not replicated to this player
    ReadOnly,   // Can see contents, cannot interact
    ReadWrite   // Can see and interact (subject to permissions)
};
```

| Access Level | Replicated | Can View | Can Interact           |
| ------------ | ---------- | -------- | ---------------------- |
| `NoAccess`   | No         | No       | No                     |
| `ReadOnly`   | Yes        | Yes      | No                     |
| `ReadWrite`  | Yes        | Yes      | Yes (with permissions) |

Example scenarios:

* Your inventory: `ReadWrite`
* Teammate's inventory (if sharing): `ReadOnly` or `ReadWrite`
* Enemy's inventory: `NoAccess`
* Vendor stock: `ReadOnly` (items visible) or `ReadWrite` (can purchase)

### Permissions (Action Control)

For `ReadWrite` access, permissions control specific actions:

```cpp
enum class EItemContainerPermissions : uint8
{
    None          = 0,
    MoveItems     = 1 << 0,  // Rearrange within container
    ModifyStack   = 1 << 1,  // Change stack counts
    PutInItems    = 1 << 2,  // Add items from outside
    TakeOutItems  = 1 << 3,  // Remove items to outside
    HoldItems     = 1 << 4,  // Hold/equip from container
    Full          = MoveItems | ModifyStack | PutInItems | TakeOutItems | HoldItems
};
```

Permissions are bitmask flags, a player can have any combination.

| Permission     | Allows                                      |
| -------------- | ------------------------------------------- |
| `MoveItems`    | Rearranging items within the same container |
| `ModifyStack`  | Splitting stacks, consuming items           |
| `PutInItems`   | Adding items from other containers          |
| `TakeOutItems` | Removing items to other containers          |
| `HoldItems`    | Equipping/holding items from this container |

#### Permission Examples

Player's own inventory:

```cpp
Permissions = Full;  // Can do anything
```

Shared storage (deposit only):

```cpp
Permissions = PutInItems;  // Can add, cannot take
```

Display case (view only):

```cpp
AccessRights = ReadOnly;  // Can see, no permissions needed
```

Vendor inventory:

```cpp
AccessRights = ReadWrite;
Permissions = TakeOutItems;  // Can "take" (buy), cannot modify
```

***

### Permission Checking

The slot descriptor provides permission checks:

```cpp
// In FAbilityData_SourceItem (base slot descriptor)
virtual bool HasPermission(
    APlayerController* PC,
    EItemContainerPermissions RequiredPermission) const;
```

Each slot type implements this to check its container's permission component.

#### Move Permission Logic

For move operations, different permissions apply depending on the containers involved:

```cpp
// Same container internal move
if (AreSlotsInSameContainer(Source, Dest))
{
    RequiredPermission = MoveItems;
}
// Cross-container move
else
{
    // Need TakeOut from source, PutIn to destination
    if (!Source.HasPermission(PC, TakeOutItems)) return false;
    if (!Dest.HasPermission(PC, PutInItems)) return false;
}
```

### The Permission Component

Containers that use permissions have a `UItemPermissionComponent`:

```cpp
UCLASS()
class UItemPermissionComponent : public UObject
{
    // Per-player access rights
    void SetAccess(APlayerController* PC, EItemContainerAccessRights Rights);
    EItemContainerAccessRights GetAccess(APlayerController* PC) const;

    // Per-player permissions
    void SetPermissions(APlayerController* PC, EItemContainerPermissions Perms);
    void AddPermissions(APlayerController* PC, EItemContainerPermissions Perms);
    void RemovePermissions(APlayerController* PC, EItemContainerPermissions Perms);
    bool HasPermissions(APlayerController* PC, EItemContainerPermissions Perms) const;

    // Defaults when no player-specific entry exists
    EItemContainerAccessRights DefaultAccessRight = NoAccess;
    EItemContainerPermissions DefaultPermission = Full;
};
```

### Defaults and Overrides

The system supports both defaults and per-player overrides:

{% stepper %}
{% step %}
#### Check for player-specific entry

Look for an explicit per-player entry first.
{% endstep %}

{% step %}
#### If none, use defaults

Use `DefaultAccessRight` / `DefaultPermission` when no per-player entry exists.
{% endstep %}

{% step %}
#### Player-specific entries override defaults

A per-player entry replaces the default values for that player.
{% endstep %}
{% endstepper %}

Example:

```cpp
// Example: Public container, but one player is banned
PermissionComponent->SetDefaultAccessRight(ReadWrite);
PermissionComponent->SetDefaultPermissions(Full);
PermissionComponent->SetAccess(BannedPlayer, NoAccess);
```

***

### Validation Per Operation Type

Each operation type has specific validation requirements.

#### Move Validation

```cpp
bool ValidateMove(const FItemTxOp_Move& Op, FItemTransactionContext& Context)
{
    // 1. Resolve containers
    ILyraItemContainerInterface* SourceContainer = Op.SourceSlot.ResolveContainer(PC);
    ILyraItemContainerInterface* DestContainer = Op.DestSlot.ResolveContainer(PC);
    if (!SourceContainer || !DestContainer) return false;

    // 2. Get source item
    ULyraInventoryItemInstance* Item = SourceContainer->GetItemInSlot(Op.SourceSlot);
    if (!Item) return false;

    // 3. Check destination acceptance
    if (DestContainer->CanAcceptItem(Op.DestSlot, Item) == 0)
    {
        // Check for swap behavior
        ULyraInventoryItemInstance* ExistingItem = DestContainer->GetItemInSlot(Op.DestSlot);
        if (!ExistingItem) return false;

        EContainerOccupiedSlotBehavior Behavior =
            DestContainer->GetOccupiedSlotBehavior(Op.DestSlot, Item, ExistingItem);

        if (Behavior == Reject) return false;
        // Additional swap validation...
    }

    // 4. Check permissions
    return ValidateMovePermissions(Op.SourceSlot, Op.DestSlot, PC);
}
```

Move validation steps:

{% stepper %}
{% step %}
#### Resolve containers

Resolve source and destination containers from the slot descriptors. If either cannot be resolved, validation fails.
{% endstep %}

{% step %}
#### Get source item

Ensure there is an item in the source slot. If no item exists, validation fails.
{% endstep %}

{% step %}
#### Check destination acceptance

Verify the destination can accept the item. If occupied, check swap behavior and whether swapping is allowed.
{% endstep %}

{% step %}
#### Check permissions

Ensure the appropriate permissions exist (MoveItems for internal moves, TakeOut/PutIn for cross-container moves).
{% endstep %}
{% endstepper %}

### ModifyTagStack Validation

```cpp
bool ValidateModifyTagStack(const FItemTxOp_ModifyTagStack& Op, FItemTransactionContext& Context)
{
    // 1. Resolve and get item
    ILyraItemContainerInterface* Container = Op.TargetSlot.ResolveContainer(PC);
    ULyraInventoryItemInstance* Item = Container->GetItemInSlot(Op.TargetSlot);
    if (!Item) return false;

    // 2. Check resulting value
    int32 CurrentValue = Item->GetStatTagStackCount(Op.Tag);
    int32 NewValue = CurrentValue + Op.DeltaAmount;

    if (!Op.bClampToBounds)
    {
        if (NewValue < 0) return false;
        if (MaxValue > 0 && NewValue > MaxValue) return false;
    }

    // 3. Check permission
    return Op.TargetSlot.HasPermission(PC, ModifyStack);
}
```

ModifyTagStack validation steps:

{% stepper %}
{% step %}
#### Resolve and get item

Resolve the container and fetch the target item. If missing, validation fails.
{% endstep %}

{% step %}
#### Check resulting value

Compute the new tag stack value and ensure it respects bounds (unless clamping is enabled).
{% endstep %}

{% step %}
#### Check permission

Verify the caller has `ModifyStack` permission on the target slot.
{% endstep %}
{% endstepper %}

### SplitStack Validation

```cpp
bool ValidateSplitStack(const FItemTxOp_SplitStack& Op, FItemTransactionContext& Context)
{
    // 1. Source has stackable item
    ULyraInventoryItemInstance* Item = GetItemFromSlot(Op.SourceSlot);
    if (!Item || !Item->IsStackable()) return false;

    // 2. Valid split amount
    int32 CurrentStack = Item->GetStackCount();
    if (Op.AmountToSplit <= 0 || Op.AmountToSplit >= CurrentStack) return false;

    // 3. Destination is available
    ILyraItemContainerInterface* DestContainer = Op.DestSlot.ResolveContainer(PC);
    if (DestContainer->GetItemInSlot(Op.DestSlot) != nullptr) return false;

    // 4. GUID provided
    if (!Op.SplitItemGUID.IsValid()) return false;

    // 5. Permissions
    return Op.SourceSlot.HasPermission(PC, ModifyStack);
}
```

SplitStack validation steps:

{% stepper %}
{% step %}
#### Source has stackable item

Confirm the source contains a stackable item.
{% endstep %}

{% step %}
#### Valid split amount

Ensure the split amount is > 0 and less than the current stack count.
{% endstep %}

{% step %}
#### Destination is available

Resolve destination and ensure its slot is empty.
{% endstep %}

{% step %}
#### GUID provided

A valid GUID for the split item must be included.
{% endstep %}

{% step %}
#### Permissions

Caller must have `ModifyStack` permission on the source slot.
{% endstep %}
{% endstepper %}

***

### Permission Events

When permissions change, the system broadcasts messages:

```cpp
USTRUCT(BlueprintType)
struct FItemAccessRightsChangedMessage
{
    TObjectPtr<UObject> Container;
    TObjectPtr<APlayerController> Player;
    EItemContainerAccessRights NewAccess;
};

USTRUCT(BlueprintType)
struct FItemPermissionsChangedMessage
{
    TObjectPtr<UObject> Container;
    TObjectPtr<APlayerController> Player;
    EItemContainerPermissions NewPermission;
};
```

UI listens for these to update interactive states (graying out slots, hiding containers, etc.).

***

### Containers Without Permissions

Not all containers use permissions. The interface methods default to allowing operations:

```cpp
// In FAbilityData_SourceItem base
virtual bool HasPermission(APlayerController* PC, EItemContainerPermissions Perm) const
{
    return true;  // Default: no permissions = full access
}
```

Simple containers can skip the permission component entirely.

***

### Common Patterns

<div class="gb-stack">
<details class="gb-toggle">

<summary>Grant Temporary Access</summary>

```cpp
// Player opens a chest
PermissionComponent->SetAccess(Player, ReadWrite);
PermissionComponent->SetPermissions(Player, TakeOutItems | PutInItems);

// Player closes the chest
PermissionComponent->SetAccess(Player, NoAccess);
```

</details>
<details class="gb-toggle">

<summary>Progressive Unlock</summary>

```cpp
// Initially locked
PermissionComponent->SetDefaultAccessRight(NoAccess);

// After unlocking
PermissionComponent->SetDefaultAccessRight(ReadWrite);
PermissionComponent->SetDefaultPermissions(Full);
```

</details>
<details class="gb-toggle">

<summary>Player Inventory</summary>

**Goal:** The local player always has full visibility and all permissions on their own inventory.

1. **Defaults**
   * `DefaultAccessRight = NoAccess`
   * `DefaultPermission = None`
2.  **On BeginPlay** (authority-only)

    ```cpp
    // Grant this player read write & permissions to their own inventory:
    if (APlayerController* Controller = Cast<APlayerController>(GetOwner()))
    {
        if (Implements<UItemPermissionOwner>())
        {
    	Execute_SetContainerAccessRight(this, Controller, EItemContainerAccessRights::ReadWrite);
    	Execute_SetContainerPermissions(this, Controller, /* bitmask */ static_cast<int32>(EItemContainerPermissions::Full));
        }
    }
    ```

    Or in Blueprint, call **Set Container Access Right** and **Set Container Permissions** with the owning player’s controller.
3. **Result**
   * Player sees and can freely move/use/equip items in their own inventory.
   * All other players still default to **NoAccess**.

</details>
<details class="gb-toggle">

<summary>Read-Only Chest</summary>

**Goal:** Players can see container contents but cannot take or move anything.

1. **Defaults**
   * `DefaultAccessRight = ReadOnly`
   * `DefaultPermission = None`
2. **No per-player overrides needed**
3. **Result**
   * Every approaching player’s client replicates the item list and weight.
   * All interaction attempts are blocked server-side before permissions check.

</details>
<details class="gb-toggle">

<summary>Team Stash (Put-Only / Take-Only) </summary>

**Goal:** A shared stash where team members can both deposit and withdraw, but the rest of the world cannot see it.

1. **Defaults**
   * `DefaultAccessRight = NoAccess`
   * `DefaultPermission = None`
2.  **Grant per-player**

    ```cpp
    for (APlayerController* TeamPC : TeamMembers)
    {
      // ReadWrite to replicate list and be about to interact with it
      IItemPermissionOwner::Execute_SetContainerAccessRight(this, TeamPC, EItemContainerAccessRights::ReadWrite);

      // But fine-grain: only PutInItems + TakeOutItems
      IItemPermissionOwner::Execute_SetContainerPermissions(this, TeamPC,
        static_cast<int32>(EItemContainerPermissions::PutInItems | EItemContainerPermissions::TakeOutItems));
    }
    ```

    Or in Blueprint loop, call **Set Container Access Right** → `ReadWrite`, then **Set Container Permissions** → `Put-In` & `Take-Out`.
3. **Result**
   * Team members see and can deposit/withdraw.
   * Non-team players see nothing.

</details>
<details class="gb-toggle">

<summary>Ad-Hoc Container Spawned at Runtime</summary>

**Goal:** Dynamically create a temporary container that starts hidden, then grant exactly one player full control.

1. **Actor Setup**
   * Add the desired item conatainer component. Ensure the component has the permission interface.
2.  **Spawn & Initialize**

    ```cpp
    AMyContainerActor* NewContainer = GetWorld()->SpawnActor<AMyContainerActor>(…);
    // Ensure defaults:
    IItemPermissionOwner::Execute_SetContainerDefaultAccessRight(NewContainer, EItemContainerAccessRights::NoAccess);
    IItemPermissionOwner::Execute_SetContainerDefaultPermissions(NewContainer, static_cast<int32>(EItemContainerPermissions::None));
    ```
3.  **Grant to one player**

    ```cpp
    IItemPermissionOwner::Execute_SetContainerAccessRight(NewContainer, TargetPC, EItemContainerAccessRights::ReadWrite);
    IItemPermissionOwner::Execute_SetContainerPermissions(NewContainer, TargetPC, static_cast<int32>(EItemContainerPermissions::Full));
    ```
4. **Result**
   * Only `TargetPC` will see and use that container until you revoke or destroy it.

</details>
<details class="gb-toggle">

<summary>World Drop with Delayed Looting</summary>

**Goal:** When an item is dropped, no one can see it for X seconds; afterward, nearby players get Read-Only or ReadWrite.

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

</details>
</div>

#### Tips & Variations

> [!SUCCESS]
> **Revoke vs. Remove:**
> 
> * `Execute_RemoveContainerAccessRight`, `Execute_RemoveContainerPlayerPermissions`→ falls back to default.
> * `Execute_RemoveContainerPermission` → bitwise clears specific flags for that specific player. Will still keep player specific permissions.

> [!SUCCESS]
> **UI Reactivity:**
> 
> * Listen for `TAG_ItemPermission_Message_AccessChanged` to close or open UI.
> * Listen for `TAG_ItemPermission_Message_PermissionsChanged` to enable/disable buttons.

> [!INFO]
> **Authority Only:**
> 
> * All interface mutations are `BlueprintAuthorityOnly` or no-ops on clients, safe to call from mixed C++/Blueprint logic.

With these examples, you can cover the vast majority of container‐permission requirements in your game, securely, efficiently, and without polluting your container classes with bespoke logic.

***

#### Next Steps

With transactions understood, learn how prediction makes them responsive in multiplayer in the [Prediction](../prediction/) section.
