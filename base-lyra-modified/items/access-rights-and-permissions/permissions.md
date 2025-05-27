# Permissions

Once a player has **FullAccess** to a container, the **Permissions** bitmask decides _what they can actually do_ with the data that is now in-sync on their client.

***

### The enum at a glance

```cpp
/** Fine-grained actions inside a visible container. */
UENUM(BlueprintType, meta=(Bitflags, UseEnumValuesAsMaskValuesInEditor="true"))
enum class EItemContainerPermissions : uint8
{
	None         = 0,          // baseline
	MoveItems    = 1 << 0,     // reorder / swap inside container
	UseItems     = 1 << 1,     // consume, activate, drop-to-world
	EquipItems   = 1 << 2,     // hand over to EquipmentManager
	PutInItems   = 1 << 3,     // add new items from outside
	TakeOutItems = 1 << 4,     // remove items to another container
	HoldItems    = 1 << 5,     // hold an item inside container
	Full         = MoveItems | UseItems | EquipItems |
	               PutInItems | TakeOutItems | HoldItems
};
ENUM_CLASS_FLAGS(EItemContainerPermissions)
```

| Flag             | Typical meaning (may vary by game)     |
| ---------------- | -------------------------------------- |
| **MoveItems**    | Rearranging slots, stacking, splitting |
| **UseItems**     | Consuming a potion, dropping an object |
| **EquipItems**   | Sending an item to an equipment slot   |
| **PutInItems**   | Adding items from _another_ container  |
| **TakeOutItems** | Removing items to another container    |
| **HoldItems**    | Holding an item inside a container     |

***

### Relationship to Access Rights

* **Permissions are ignored unless `Access == FullAccess`.**\
  A ReadOnly viewer can never “cheat” by having hidden Put-In bits set.
* **Bandwidth cost is identical** for different Permission masks.\
  Permissions are checked **server-side only**; they do _not_ change what is replicated.

***

### Extending the enum

1. Add a new bit constant ( `1 << 6`, `1 << 7`, … ).
2. **Recompile** – Fast-arrays replicate raw bytes, so existing saves stay valid.
3. Use the new flag in abilities’ `RequiredPermission` masks.

> [!info]
> **Tip:** keep each flag focused on one _verb_.\
> If you find yourself gating multiple unrelated UI buttons behind the same flag, you probably need two flags.

***

## Design guidelines

* **Default to the safest mask** – most world chests ship with `TakeOutItems` only.
* **Do not gate Equip/Use behind MoveItems** unless you really mean it.\
  Let players equip directly from loot windows by giving both flags.
* **Pair PutIn and TakeOut thoughtfully.**\
  It’s common for a team-stash to allow _either_ direction but not both ( e.g. donate-only boxes ).

***

### Quick recipes

| Container type                   | Default Mask                             |
| -------------------------------- | ---------------------------------------- |
| **Player inventory**             | `Full`                                   |
| **Read-Only lore chest**         | `None` (because Access will be ReadOnly) |
| **Take-Only loot chest**         | `TakeOutItems`                           |
| **Donation box**                 | `PutInItems`                             |
| **Equipment locker** (swap only) | \`MoveItems                              |

***

### Adding a new flag example

Suppose you add **RepairItems**:

1. ```cpp
   RepairItems = 1 << 6 UMETA(DisplayName="Repair Items"),
   ```
2. Give smith-NPC containers `RepairItems | TakeOutItems`.
3.  In your `GA_RepairItem` ability:

    ```cpp
    RequiredPermission = EItemContainerPermissions::RepairItems;
    ```

No further engine tweaks needed – the permission system is entirely data-driven.

> [!danger]
> **Note:** **only the first 32 values** will be visible in the blueprint drop down editor.\
> Here is some further [unreal engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-uproperties#asbitmasks) on using bitmasks.&#x20;
