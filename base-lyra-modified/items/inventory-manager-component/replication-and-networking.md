# Replication & Networking

This section explains how `ULyraInventoryManagerComponent` synchronizes inventory data between the server and clients. You'll learn how items, stacks, and gameplay fragments are kept in sync, and how access-controlled visibility ensures that each player only sees what they’re meant to. By understanding this replication layer, you’ll see how inventory updates remain consistent across gameplay and UI, even in a multiplayer environment.

***

### 1. High‑Level Flow

1. **Server‑authority only** mutates the inventory (add / remove / combine / stack‑split).
2. Mutation updates:
   * The **`FLyraInventoryList`** fast‑array (adds, removes, stack‑count deltas)
   * Replicated primitives on the component (`Weight`, `ItemCount` …)
   * Subobjects that need to exist on the client (`ULyraInventoryItemInstance` + any `UTransientRuntimeFragment`s)
3. Unreal’s replication system ships the deltas. On clients:
   * Fast‑array callbacks (`PostReplicatedAdd` / `Change` / `Remove`) fire – UI can refresh via gameplay‑message broadcasts.
   * `OnRep_Weight` / `OnRep_ItemCount` broadcast lightweight messages for HUD widgets.

The diagram below shows the ownership chain:

```
ACharacter (or chest actor)
 └─ ULyraInventoryManagerComponent  ▸ primitive props + ReplicateSubobjects()
      └─ FLyraInventoryList (FastArraySerializer)
           ├─ FLyraInventoryEntry[0] ▸ ULyraInventoryItemInstance* (subobject)
           │       ├─ FInstancedStruct[] (struct transient fragments)
           │       └─ UTransientRuntimeFragment*[] (sub‑subobjects)
           └─ FLyraInventoryEntry[1] …
```

***

### 2. Delta‑Friendly Item List – `FFastArraySerializer`

| Concept                   | Where                                  | Why it matters                                                                                                                                       |
| ------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`FLyraInventoryEntry`** | One per item stack                     | Inherits `FFastArraySerializerItem` so only _row_ changes replicate.                                                                                 |
| **`FLyraInventoryList`**  | Owns `TArray<FLyraInventoryEntry>`     | Implements `PreReplicatedRemove`, `PostReplicatedAdd`, `PostReplicatedChange` to emit gameplay‑messages (`TAG_Lyra_Inventory_Message_StackChanged`). |
| **NetDeltaSerialize()**   | Delegates to `FastArrayDeltaSerialize` | Engine handles efficient bit‑packing of only mutated entries.                                                                                        |

Key details:

* **Client‑prediction clean‑up** – `PostReplicatedAdd` strips any entry whose `Instance->bIsClientPredicted` is true, preventing duplicates created for predictive pickup.
* `LastObservedCount` lets the list work out `Delta` values for broadcast without storing extra state server‑side.

***

### 3. Subobject Replication – Items & Runtime Fragments

#### Manual vs. Registered‑list

```cpp
bReplicateUsingRegisteredSubObjectList = false;
```

Because we set the flag to **false**, replication is **fully manual** in `ULyraInventoryManagerComponent::ReplicateSubobjects()`. The component decides _per connection_ which objects to copy into the bunch.

#### Access‑controlled visibility

```cpp
EItemContainerAccessRights Rights = Execute_GetContainerAccessRight(this, PC);
if (Rights < ReadOnly) return; // skip all items
```

The permission system sits **in front** of subobject replication. If a client lacks at least _ReadOnly_ rights, they never receive:

* The `ULyraInventoryItemInstance` objects
* Any `UTransientRuntimeFragment`s they own

> [!info]
> This keeps secret‑inventories and fog‑of‑war data private without extra bandwidth or teardown logic. For more detail on the access & permissions documentaion check this [page](../access-rights-and-permissions/).

#### What actually replicates

| Object                           | Rep rule                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **`ULyraInventoryItemInstance`** | Always considered, but only sent if `IsValid()` and rights allow.                                              |
| **`UTransientRuntimeFragment`**  | Nested loop replicates each runtime fragment, then lets the fragment replicate its own subobjects recursively. |
| **`UItemPermissionComponent`**   | Sent unconditionally so the client can evaluate future access changes.                                         |

`ReadyForReplication()` adds already‑existing instances/fragments to the channel _after_ hot‑join or BeginPlay, preventing "late joiner" desyncs.

***

### 4. Primitive Properties with OnRep

| Property        | OnRep             | Purpose                                                                        |
| --------------- | ----------------- | ------------------------------------------------------------------------------ |
| `Weight`        | `OnRep_Weight`    | Broadcasts `TAG_Lyra_Inventory_Message_WeightChanged`, used by HUD weight bar. |
| `ItemCount`     | `OnRep_ItemCount` | Broadcasts `TAG_Lyra_Inventory_Message_ItemCountChanged`.                      |
| `InventoryList` | _FastArray_       | No rep‑notify; callbacks live inside the list.                                 |
| `OwningActor`   | automatic         | Lets UI widgets know which actor owns this inventory on the client.            |

***

### 5. Lifecycle of an _Add Item_ RPC

1. **Server** calls `AddItemDefinition()`
2. Creates new `ULyraInventoryItemInstance` (subobject) and `FLyraInventoryEntry`.
3. Marks the entry dirty ➜ fast‑array records delta.
4. Adds the item instance to the `ReplicateSubobjects` list.
5. Next network tick
   * Engine serialises the mutated entry + serialises the subobject header for the new item.
6. **Client** receives:
   * Fast‑array delta ➜ fires `PostReplicatedAdd` → gameplay‑message → UI adds row.
   * New subobject ➜ constructs the `ULyraInventoryItemInstance`, initialises its replicated props.

**Prediction note**: if the client already had a predicted copy, `PreReplicatedRemove` discards it so the authoritative one wins.

***

### 7. Troubleshooting Checklist

| Symptom                           | Likely Cause                                | Fix                                                                                     |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Clients never see inventory items | Access rights < ReadOnly                    | Verify `PermissionComponent` is initialised (`BeginPlay` auto‑grants controller owner). |
| Runtime fragment data not syncing | Not added as subobject / no `DOREPLIFETIME` | Add `Channel->ReplicateSubobject`, implement `GetLifetimeReplicatedProps`.              |

***

#### TL;DR

* **FastArraySerializer** for cheap stack‑level deltas.
* **Manual `ReplicateSubobjects()`** for fine‑grained, permission‑aware item replication.
* **Item instances → runtime fragments → nested UObjects** all piggy‑back on the same channel.
* Rep‑notifies fire gameplay‑messages so UI remains decoupled from inventory code.

Armed with this knowledge you can safely extend the inventory (bigger containers, secret stashes, custom fragments) without breaking multiplayer sync.
