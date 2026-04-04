# Save Data Structs

When a container is saved, every item in it is broken down into a flat, serializable representation. The item's definition becomes a soft class path. Its runtime state. stat tags, slot position, fragment data, is captured into structs that can be written to disk and reconstructed later. This page covers those structs and the save game object that holds them.

***

### What Gets Saved

A single item's journey from live object to disk:

```
ULyraInventoryItemInstance (live)
    │
    ▼
FSavedItemData (serializable)
    ├── ItemDef          TSoftClassPtr      "Which item definition"
    ├── ItemInstanceId   FGuid              "Unique identity"
    ├── StatTags         TMap<Tag, int32>   "Stat values (ammo, durability)"
    ├── CurrentSlot      FInstancedStruct   "Where in the container"
    └── SavedFragmentData                   "All fragment state"
         ├── [0] FTransientFragmentData_Gun       (auto-saved struct)
         ├── [1] FTransientFragmentData_Container (auto-saved struct)
         └── [2] FSavedContainerData              (runtime fragment opt-in)
```

A container is then a list of these items plus metadata:

```
FSavedContainerData
    ├── SaveTag          FGameplayTag       "Which save slot (e.g., Save.Stash)"
    ├── ContainerClass   TSoftClassPtr      "Blueprint class for reconstruction"
    ├── SpecificData     TArray<FInstancedStruct>  "Container config"
    └── Items            TArray<FSavedItemData>    "All items"
```

***

### FSavedItemData

Each saved item captures everything needed to reconstruct the live instance:

| Field               | Type                                          | Purpose                                                                                                                                                                                                                                                                                     |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ItemDef`           | `TSoftClassPtr<ULyraInventoryItemDefinition>` | Soft reference to the item's Blueprint class. Survives asset renames via redirectors. Loaded synchronously during deserialization                                                                                                                                                           |
| `ItemInstanceId`    | `FGuid`                                       | The item's unique identifier. Preserved across save/load so prediction reconciliation and transaction rollback still work correctly                                                                                                                                                         |
| `StatTags`          | `TMap<FGameplayTag, int32>`                   | Flattened from `FGameplayTagStackContainer`. Captures all gameplay tag stacks (ammo count, durability, kill count, etc.)                                                                                                                                                                    |
| `CurrentSlot`       | `FInstancedStruct`                            | The item's position in its container. Type depends on the container: `FInventoryAbilityData_SourceTetrisItem` for grid inventories (position, rotation, clump), `FEquipmentAbilityData_SourceEquipment` for equipment (slot tag), `FAttachmentAbilityData_SourceAttachment` for attachments |
| `SavedFragmentData` | `TArray<FInstancedStruct>`                    | All fragment data for the item. Struct-based transient fragments are copied directly. Runtime fragments that opt in via `WantsSave()` contribute their save data here too                                                                                                                   |

#### IsValid

`FSavedItemData` exposes an `IsValid()` helper that checks whether the `ItemDef` soft pointer is non-null. The deserializer skips invalid entries silently.

***

### FSavedContainerData

Captures a complete container snapshot, its identity, configuration, and contents:

| Field                      | Type                             | Purpose                                                                                                                                                                                                       |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SaveTag`                  | `FGameplayTag`                   | Identifier for this save entry. Game modes define their own tags. The save subsystem uses this for lookup and deduplication                                                                                   |
| `ContainerClass`           | `TSoftClassPtr<UActorComponent>` | The Blueprint class of the container component. Stored for reconstruction but not currently used during loading (the target container already exists)                                                         |
| `Items`                    | `TArray<FSavedItemData>`         | All items in this container                                                                                                                                                                                   |
| `MaxWeight`                | `float`                          | Saved weight capacity override                                                                                                                                                                                |
| `ItemCountLimit`           | `int32`                          | Saved item count limit override                                                                                                                                                                               |
| `LimitItemInstancesStacks` | `int32`                          | Saved slot count limit override                                                                                                                                                                               |
| `SpecificData`             | `TArray<FInstancedStruct>`       | Container-type-specific config. Each container type defines its own struct (e.g., `FSavedTetrisConfig` for grid layout, `FSavedEquipmentConfig` for held slots). The save system treats these as opaque blobs |

#### Config via ILyraSaveableInterface

Containers that implement `ILyraSaveableInterface` can persist custom configuration through `SpecificData`. During save, `GetSaveableConfig()` produces the array; during load, `ApplySavedConfig()` restores it. This is how tetris grid layouts and equipment slot configurations round-trip through the save.

***

### ULyraPlayerSaveGame

The root save game object, inheriting from `ULocalPlayerSaveGame`. One instance per player per save slot.

| Field             | Type                                   | Purpose                                                                                                                                                 |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SavedContainers` | `TArray<FSavedContainerData>`          | All saved containers, each keyed by `SaveTag`. A player might have entries for `Save.PlayerInventory`, `Save.PlayerEquipment`, `Save.BankStorage`, etc. |
| `CustomSaveData`  | `TMap<FGameplayTag, FInstancedStruct>` | Generic key-value store for arbitrary game data. Quest progress, currency, settings, anything that fits in an `FInstancedStruct`                        |

#### Key Methods

| Method                          | Returns                | Description                                                 |
| ------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `FindContainerByTag(SaveTag)`   | `FSavedContainerData*` | Find a saved container by tag. Returns nullptr if not found |
| `AddOrUpdateContainer(Data)`    | `void`                 | Add or replace a container entry (matched by `SaveTag`)     |
| `RemoveContainerByTag(SaveTag)` | `bool`                 | Remove a container entry                                    |
| `SaveCustomData(Key, Data)`     | `void`                 | Store arbitrary data under a tag                            |
| `LoadCustomData(Key)`           | `FInstancedStruct`     | Retrieve arbitrary data. Returns empty if not found         |
| `HasCustomData(Key)`            | `bool`                 | Check if a key exists                                       |
| `RemoveCustomData(Key)`         | `bool`                 | Remove a custom data entry                                  |

***

### Stale Reference Protection

Item slot structs and transient fragments can contain `TObjectPtr` members pointing to live components (the inventory manager, equipment manager, child inventory). These pointers become stale after map travel, the old world is destroyed, but the cached save game still holds the pointers.

Three mechanisms prevent this:

#### 1. ClearContainerReference on Slot Structs

Every slot struct inherits from `FAbilityData_SourceItem`, which provides a virtual `ClearContainerReference()`. `SerializeItem` calls this immediately after copying the slot, nulling out the component pointer while preserving the positional data (grid position, rotation, equipment slot tag).

| Slot Struct                               | Cleared Field                                  |
| ----------------------------------------- | ---------------------------------------------- |
| `FInventoryAbilityData_SourceItem`        | `InventoryManager`                             |
| `FInventoryAbilityData_SourceTetrisItem`  | `TetrisInventory`                              |
| `FEquipmentAbilityData_SourceEquipment`   | `EquipmentManager`                             |
| `FAttachmentAbilityData_SourceAttachment` | Recursively clears nested `RootAttachmentSlot` |

#### 2. PrepareForSave on Fragment Structs

`FTransientFragmentData` provides a virtual `PrepareForSave()` called by `SerializeItem` on every copied fragment. Subclasses override it to null out their UObject pointers.

The container fragment (`FTransientFragmentData_Container`) uses this to serialize its child inventory's items into `SavedChildInventory` and then null the `ChildInventory` pointer, preventing the GC from tracing into the old world.

#### 3. Automatic Cache Clearing

The save subsystem binds to `FCoreUObjectDelegates::PreLoadMap`. When any map starts loading, the in-memory cache is emptied. Even if some stale pointers slipped through, they're discarded before the new world loads. The next `GetOrCreateSaveGame` call reloads clean data from disk.
