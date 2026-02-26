# Permissions

Once a player has `ReadWrit`**`e` Access** to a container, the **Permissions** bitmask decides _what they can actually do_ with the data that is now in-sync on their client.

***

### The enum at a glance

```cpp
/** Fine-grained actions inside a visible container. */
UENUM(BlueprintType, meta=(Bitflags, UseEnumValuesAsMaskValuesInEditor="true"))
enum class EItemContainerPermissions : uint8
{
	None         = 0,          // baseline
	MoveItems    = 1 << 0,     // reorder / swap inside container
	ModifyStack  = 1 << 1,     // increase or reduce the count of an item
	PutInItems   = 1 << 2,     // add new items from outside
	TakeOutItems = 1 << 3,     // remove items to another container
	HoldItems    = 1 << 4,     // hold an item inside container
	Full         = MoveItems | UseItems | PutInItems | TakeOutItems | HoldItems
};
ENUM_CLASS_FLAGS(EItemContainerPermissions)
```

| Flag             | Typical meaning (may vary by game)     |
| ---------------- | -------------------------------------- |
| **MoveItems**    | Rearranging slots, stacking, splitting |
| **ModifyStack**  | Consuming a potion, splitting items    |
| **PutInItems**   | Adding items from _another_ container  |
| **TakeOutItems** | Removing items to another container    |
| **HoldItems**    | Holding an item inside a container     |

***

### Relationship to Access Rights

* **Permissions are ignored unless `Access == ReadWrite`.**\
  A ReadOnly viewer can never “cheat” by having hidden Put-In bits set.
* **Bandwidth cost is identical** for different Permission masks.\
  Permissions are checked **server-side only**; they do _not_ change what is replicated.

***

### Extending the enum

1. Add a new bit constant ( `1 << 5`, `1 << 6`, … ).
2. **Recompile** – Fast-arrays replicate raw bytes, so existing saves stay valid.
3. Use the new flag in abilities’ `RequiredPermission` masks.

> [!INFO]
> **Tip:** keep each flag focused on one _verb_.\
> If you find yourself gating multiple unrelated UI buttons behind the same flag, you probably need two flags.

***

## Design guidelines

* **Default to the safest mask** – most world chests ship with `TakeOutItems` only.
* **Do not gate Equip/Attach behind MoveItems** unless you really mean it.\
  Let players equip directly from loot windows by giving permission to `TakeOutItems` from the container and `PutInItems` in their equipment manager.
* **Pair PutIn and TakeOut thoughtfully.**\
  It’s common for a team-stash to allow _either_ direction but not both ( e.g. donate-only boxes ).

***

### Quick recipes

| Container type                   | Default Mask                                      |
| -------------------------------- | ------------------------------------------------- |
| **Player inventory**             | `None` (the owning player has `full` permissions) |
| **Read-Only chest**              | `None` (because Access will be ReadOnly)          |
| **Take-Only loot chest**         | `TakeOutItems`                                    |
| **Donation box**                 | `PutInItems`                                      |
| **Equipment locker** (swap only) | `MoveItems`                                       |

***

### Adding a new flag example

Suppose you add **RepairItems**:

* ```cpp
  RepairItems = 1 << 5 UMETA(DisplayName="Repair Items"),
  ```
* Give smith-NPC containers `RepairItems | TakeOutItems`.
*   In your `GA_RepairItem` ability:

    ```cpp
    RequiredPermission = EItemContainerPermissions::RepairItems;
    ```

No further engine tweaks needed, the permission system is entirely data-driven.

> [!DANGER]
> **Note:** **only the first 32 values** will be visible in the blueprint drop down editor.\
> Here is some further [unreal engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-uproperties#asbitmasks) on using bitmasks.&#x20;
