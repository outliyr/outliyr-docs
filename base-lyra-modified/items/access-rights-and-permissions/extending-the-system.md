# Extending the System

Once you’ve got the core Access-Rights & Permissions pipeline running, you may need to bend it to your game’s evolving needs. This page shows you how to:

* Add brand-new permission bits
* Build a custom container type
* Squeeze out extra performance and bandwidth savings
* Debug and visualize permission state at runtime

***

### Adding a New Permission Flag

1.  **Define the bit**

    ```cpp
    enum class EItemContainerPermissions : uint8
    {
      …,
      RepairItems   = 1 << 5  UMETA(DisplayName="Repair Items"),
      Full          = MoveItems | UseItems | EquipItems | PutInItems | TakeOutItems | RepairItems
    };
    ```
2. **Recompile**
   * Fast arrays replicate raw bytes, so old data remains valid.
   * Blueprints and serializers auto-pick up the new flag.
3. **Use in abilities and UI**
   *   In your GA_RepairItem ability:

       ```cpp
       RequiredPermission = EItemContainerPermissions::RepairItems;
       ```
   *   Grant it via interface:

       ```cpp
       IItemPermissionOwner::Execute_AddContainerPermission(this, PC, static_cast<int32>(EItemContainerPermissions::RepairItems));
       ```
   * In UMG, hook your “Repair” button’s **IsEnabled** to `Has Container Permission (RepairItems)`.

> [!danger]
> **Note:** **only the first 32 values** will be visible in the blueprint drop down editor.\
> Here is some further [unreal engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-uproperties#asbitmasks) on using bitmasks.&#x20;

***

### Writing a Bespoke Container Type

You’re not limited to inventories or equipment, any UObject or ActorComponent can host permissions.\
Follow the guide on integrating the permission system to your container. Once that is done you know have access to player specific access rights and permissions.

1. **Implement your data logic**
   * Store your own payload (e.g. `TArray<MyEntry> Entries;`)
   *   In your server‐side methods, _always_ call the permission & acces right functions through the interface unless you need to directly acess the PermissionComponent:

       ```cpp
       if (!IItemPermissionOwner::Execute_HasContainerPermission(this, PC, static_cast<int32>(EItemContainerPermissions::MyFlag)))
         return;
       // then proceed...
       ```
2. **Expose Blueprint‐friendly API**
   * Your container can broadcast gameplay messages on changes.
   * UI & abilities stay decoupled by always using `IItemPermissionOwner::Execute_…` calls.

***

### Performance & Bandwidth Tips

* **Lean on defaults**\
  Only create per-player overrides when you really need to deviate from your `DefaultAccessRight` or `DefaultPermission`.
* **Prefer ReadOnly over FullAccess for viewers**\
  ReadOnly still ships all data once, but blocks server-side actions without extra per-item checks.
* **Batch updates sparingly**\
  If you need to mass-grant or revoke rights, group them behind logical events (e.g. team-join) rather than hammering one RPC per player.
* **Cull stale entries**\
  Remove access/permission entries for players who leave proximity or log out to keep your Fast-Array small.
* **Monitor Fast-Array size**\
  A very large `Entries` array can slow delta-serialization; consider sharding or secondary structures for huge player lists.

***

### Debugging & Visualization Helpers

*   **Gameplay-Message Listeners**\
    In PIE, open the **Gameplay Message Log** (Window → Developer Tools → Gameplay Message Log) and filter on

    ```
    Lyra.ItemPermission.Message.AccessChanged
    Lyra.ItemPermission.Message.PermissionsChanged
    ```
* **Verbose Logging**\
  Add `UE_LOG` calls in your `BroadcastAccessChanged` / `BroadcastPermsChanged` to print out `(ContainerName, PC, NewRight)` whenever changes fire.
* **Blueprint Watchers**\
  In a UMG widget, drag in the PermissionComponent reference and tick **Watch this value** in the Details panel; you’ll see live updates in the Blueprint debugger.
* **Console Commands**\
  Consider exposing a `DumpContainerPermissions` exec function that iterates your permission Fast-Arrays and logs each entry—handy for quick sanity checks.
* **Editor Visualizers**\
  For world containers (e.g. loot chests), draw a debug sphere or volume in `OnRender` showing who currently has ReadOnly / FullAccess. Use color-coding to spot mis-configured zones.

***

By following these extension patterns and tools, you can safely evolve your Access-Rights & Permissions system alongside your game’s feature set, adding new verbs, custom containers, performance hacks, or debug utilities without risking regressions in your core security and replication logic.
