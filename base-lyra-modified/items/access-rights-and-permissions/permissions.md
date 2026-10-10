# Permissions

Your team stash should accept donations but not withdrawals. Your vendor should let players browse and buy, but not rearrange the stock. Your player's own inventory should allow everything. Once a player has `ReadWrite` [Access](access-rights.md) to a container, the **Permissions** bitmask decides _what they can actually do_ with the data that is now in-sync on their client.

***

## The Enum

```cpp
UENUM(BlueprintType, meta=(Bitflags, UseEnumValuesAsMaskValuesInEditor="true"))
enum class EItemContainerPermissions : uint8
{
    None         = 0,
    MoveItems    = 1 << 0,     // reorder / swap inside container
    ModifyStack  = 1 << 1,     // increase or reduce a stack's count
    PutInItems   = 1 << 2,     // add new items from outside
    TakeOutItems = 1 << 3,     // remove items to another container
    HoldItems    = 1 << 4,     // hold an item inside container
    Full         = MoveItems | ModifyStack | PutInItems | TakeOutItems | HoldItems
};
ENUM_CLASS_FLAGS(EItemContainerPermissions)
```

| Flag             | Typical Meaning                        |
| ---------------- | -------------------------------------- |
| **MoveItems**    | Rearranging slots, stacking, splitting |
| **ModifyStack**  | Consuming a potion, splitting items    |
| **PutInItems**   | Adding items from _another_ container  |
| **TakeOutItems** | Removing items to another container    |
| **HoldItems**    | Holding an item inside a container     |

***

## Relationship to Access Rights

* **Permissions are ignored unless `Access == ReadWrite`.** A ReadOnly viewer can never bypass this by having hidden permission bits set.
* **Bandwidth cost is identical** across different permission masks. Permissions are checked **server-side only**, they don't affect what gets replicated.

***

## Design Guidelines

* **Default to the safest mask.** Most world chests ship with `TakeOutItems` only.
* **Don't gate Equip/Attach behind MoveItems** unless you really mean it. Let players equip directly from loot windows by giving `TakeOutItems` on the source container and `PutInItems` on their equipment manager.
* **Pair PutIn and TakeOut thoughtfully.** Donation-only boxes grant `PutInItems` alone. Withdraw-only stashes grant `TakeOutItems` alone.

> [!INFO]
> Keep each flag focused on one _verb_. If you find yourself gating multiple unrelated UI buttons behind the same flag, you probably need two flags.

***

## Quick Recipes

| Container Type                   | Default Mask                                      |
| -------------------------------- | ------------------------------------------------- |
| **Player inventory**             | `None` (the owning player has `Full` permissions) |
| **Read-Only chest**              | `None` (because Access will be ReadOnly)          |
| **Take-Only loot chest**         | `TakeOutItems`                                    |
| **Donation box**                 | `PutInItems`                                      |
| **Equipment locker** (swap only) | `MoveItems`                                       |

***

## Extending the Enum

Adding a new permission flag is straightforward, the system is entirely data-driven.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Add a new bit constant

```cpp
RepairItems = 1 << 5 UMETA(DisplayName="Repair Items"),
```
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Recompile

Fast-arrays replicate raw bytes, so existing saves stay valid.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Use the new flag in your abilities' `RequiredPermission` masks

Give smith-NPC containers `RepairItems | TakeOutItems`, then in your repair ability:

```cpp
RequiredPermission = EItemContainerPermissions::RepairItems;
```

No further engine changes needed.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

> [!DANGER]
> **Only the first 32 values** will be visible in the Blueprint dropdown editor. See Epic's [bitmask documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-uproperties#asbitmasks) for details.
