# Access rights

Access Rights are the **first gate** every container passes through before it even _thinks_ about permissions or gameplay abilities.\
If the local client does **not** reach “Read-Only”, the server behaves as if that container simply doesn’t exist for that player: no item lists, no weight numbers, no bandwidth spent.

***

### The enum in context

```cpp
/** High-level gate: may the client even *see* the container? */
UENUM(BlueprintType)
enum class EItemContainerAccessRights : uint8
{
	None       UMETA(DisplayName="None"),        // internal value – never returned
	NoAccess   UMETA(DisplayName="No Access"),   // replicate nothing
	ReadOnly   UMETA(DisplayName="Read-Only"),   // replicate, but no interaction
	FullAccess UMETA(DisplayName="Full Access")  // replicate + allow Permission checks
};
```

* **NoAccess**\
  &#xNAN;_&#x4E;othing_ replicates, not the item list, not the weight, not the per-item sub-objects.\
  Ideal for distant chests, enemy player backpacks, or secret admin containers.
* **ReadOnly**\
  The client is sent every replicated property and sub-object the container normally exposes, but any attempt to interact is blocked server-side _before_ permissions are consulted.\
  Perfect for spectators, “look-but-don’t-touch” loot windows, or preview-only vendors.
* **FullAccess**\
  Replication flows and the player can attempt actions. Each action is then filtered by the **Permissions** bitmask.

***

### How Access Rights are evaluated at runtime

1. **Fast-Array lookup**\
   &#xNAN;_&#x44;oes this player have a specific entry?_\
   → If yes, use it.\
   → If no, fall back to the container’s _DefaultAccessRight_ property.
2.  **Replication filter** (inside the container’s `ReplicateSubobjects`)

    ```cpp
    if (Rights < EItemContainerAccessRights::ReadOnly)
        return; // skip every item sub-object for this connection
    ```
3. **Gameplay Ability / UI checks**\
   Every [`FAbilityData_SourceItem::GetSourceItem`](../gas-and-ui-integration-layer/slot-address.md) call passes the required access level.\
   If the player doesn’t meet it, the function returns `nullptr`, short-circuiting the ability.

***

### Impact on bandwidth

| Right          | `UItemPermissionComponent` sub-objects replicated? | Inventory / equipment sub-objects replicated? | Typical use-cases                    |
| -------------- | -------------------------------------------------- | --------------------------------------------- | ------------------------------------ |
| **NoAccess**   | Yes (it’s tiny)                                    | **No**                                        | Out-of-range chests, hidden GM stash |
| **ReadOnly**   | Yes                                                | Yes                                           | Loot chest preview, spectator screen |
| **FullAccess** | Yes                                                | Yes                                           | Local player inventory, team storage |

A remote player with _NoAccess_ won’t even have the `ULyraInventoryItemInstance` objects listed in their `SubobjectRepKey` table – a measurable saving on saturated servers.

***

### Design guidelines

* **Default to NoAccess** for containers spawned in the world.\
  Grant rights explicitly when the player enters an interaction sphere or UI opens.
* **Treat ReadOnly as a UI-only state**.\
  Abilities that modify items should check `RequiredAccessRights == FullAccess` by default.
* **Never rely on Permissions alone**.\
  A mis-configured container that leaves Access at _Full_ but clears every Permission still replicates all item data to the client – fine if you need hover-tooltips, but wasteful if true secrecy is desired.

***

### Quick recipes

| Situation                                                       | Server code snippet                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Player walks up to a chest** – let them preview contents.     | `PermissionOwner->SetContainerAccessRight(PC, EItemContainerAccessRights::ReadOnly);`   |
| **Player presses ‘E’ to interact** – open and allow take / put. | `PermissionOwner->SetContainerAccessRight(PC, EItemContainerAccessRights::FullAccess);` |
| **Player walks away** – stop replication.                       | `PermissionOwner->RemoveContainerAccessRight(PC);` _(falls back to default NoAccess)_   |

***

Next page → **Permissions** – the fine-grained action flags that come into play only _after_ FullAccess is granted.
