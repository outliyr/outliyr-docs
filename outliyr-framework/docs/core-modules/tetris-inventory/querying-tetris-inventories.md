# Querying Items in Tetris Inventories

Your crafting UI needs to show how many metal ingots the player has, but they could be in the main backpack, a tool belt, or a nested ammo crate inside the backpack. Manually searching every container on every change isn't going to scale.

The Tetris Inventory Query system solves this with **reactive, hierarchical tracking**, you tell it what item types you care about, point it at a root inventory, and it automatically monitors every nested container underneath.

***

### Why Hierarchical Querying Matters

A flat inventory is straightforward to query. But the moment items live inside containers, which live inside other containers, you have a tree:

```mermaid
flowchart TD

    ROOT[Player Root Inventory]

    subgraph Backpack
        B1[Backpack Container]
        B1A[Metal Ingot x12]

        subgraph AmmoCrate
            C1[Ammo Crate Container]
            C1A[Metal Ingot x3]
            C1 --> C1A
        end

        B1 --> B1A
        B1 --> C1
    end

    subgraph ToolBelt
        D1[Tool Belt Container]
        D1A[Metal Ingot x2]
        D1 --> D1A
    end

    A1[Metal Ingot x5]

    TOTAL["Total Metal Ingots = 22<br/>(across 4 inventories)"]

    ROOT --> A1
    ROOT --> B1
    ROOT --> D1

    %% Aggregation contribution
    A1 -.-> TOTAL
    B1A -.-> TOTAL
    C1A -.-> TOTAL
    D1A -.-> TOTAL
```

Polling every level of this tree whenever you need a count is wasteful. Even worse, containers can be added or removed at any time, a player drops a backpack, picks up a crate, or moves items between containers. The Tetris query system discovers child inventories automatically, binds to each one's `OnViewDirtiedWithChanges` delegate, and aggregates results across the entire hierarchy.

<details>

<summary>Internals</summary>

```mermaid
graph TD
    Init[Initialize] --> Rebuild[RebuildFromRoot]
    Rebuild --> Track[TrackInventoryRecursive<br/>from Root]

    Track --> Sub[Subscribe to inventory's<br/>OnViewDirtiedWithChanges]
    Track --> Scan{For each item}
    Scan -->|matches TrackedItemDefs| CacheItem[Cache item +<br/>subscribe stat tags]
    Scan -->|has InventoryFragment_Container| Recurse[TrackInventoryRecursive<br/>on child inventory]
    Recurse --> Sub

    AnyDelegate[OnViewDirtiedWithChanges<br/>fires from any tracked inventory] --> Relevant{HasRelevantChanges?}
    Relevant -->|No| Skip[Return early]
    Relevant -->|Yes| FullRebuild[Snapshot old cache<br/>→ RebuildFromRoot<br/>→ Diff old vs new]
    FullRebuild --> Broadcast[Broadcast OnUpdated<br/>with grouped results]

    StatTag[Item stat tag changes<br/>e.g. stack count] --> Broadcast

    Stop[StopListening] --> Cleanup[Unbind all inventory delegates<br/>+ stat tag subscriptions]
```



</details>

{% hint style="info" %}
This system extends the base [Item Query System](../../base-lyra-modified/inventory/item-query-system.md). The Tetris variant adds recursive container discovery and grouped-by-inventory results on top of the same reactive delegate pattern.
{% endhint %}

***

### C++ - `ULyraTetrisInventoryQuery`

The API mirrors the base `ULyraInventoryQuery`. Create it as a `UPROPERTY` member, call `Initialize` with tracked definitions and the root inventory, and bind to the update delegate. The key difference: results come back **grouped by inventory**, so you know exactly which container holds which items.

<details>

<summary>Example 9 crafting component tracking Wood and Metal</summary>

```cpp
UPROPERTY()
TObjectPtr<ULyraTetrisInventoryQuery> ResourceQuery;

void UCraftingSystemComponent::InitializeResourceTracking()
{
    ULyraInventoryManagerComponent* PlayerRootInventory =
        ULyraInventoryManagerComponent::FindInventoryComponent(GetOwner());

    if (!PlayerRootInventory) return;

    TArray<TSubclassOf<ULyraInventoryItemDefinition>> ResourceItemDefs;
    ResourceItemDefs.Add(UResource_Wood::StaticClass());
    ResourceItemDefs.Add(UResource_Metal::StaticClass());

    ResourceQuery = NewObject<ULyraTetrisInventoryQuery>(this);
    ResourceQuery->Initialize(ResourceItemDefs, PlayerRootInventory);
    ResourceQuery->OnUpdated.AddDynamic(
        this, &UCraftingSystemComponent::HandleResourceQueryUpdate);

    UpdateAvailableRecipes(ResourceQuery->GetItemsGroupedByInventory());
}

void UCraftingSystemComponent::HandleResourceQueryUpdate(
    const TArray<FLyraTetrisInventoryQueryResult>& ItemsByInventory)
{
    UpdateAvailableRecipes(ItemsByInventory);
}

void UCraftingSystemComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (ResourceQuery)
    {
        ResourceQuery->StopListening();
    }
    Super::EndPlay(EndPlayReason);
}
```

</details>

#### Accessors

| Method                         | Returns                                           | Use when...                                                                                   |
| ------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GetItemsGroupedByInventory()` | `TArray<FLyraTetrisInventoryQueryResult>`         | You need to know _which_ inventory holds _which_ items (per-container UI breakdowns)          |
| `GetItems()`                   | `TArray<ULyraInventoryItemInstance*>`             | You just need a flat total regardless of location ("does the player have 10 metal anywhere?") |
| `GetTrackedItemDefs()`         | `TSet<TSubclassOf<ULyraInventoryItemDefinition>>` | You need to inspect what the query is tracking                                                |

`FLyraTetrisInventoryQueryResult` contains:

* `Inventory` - the `ULyraInventoryManagerComponent*` where items were found
* `Items` - `TArray<ULyraInventoryItemInstance*>` of matching items within that specific inventory
* `TotalCount` - pre-calculated sum of `Lyra.Inventory.Item.Count` stat tags across all items in this inventory. Use this directly instead of looping through `Items` to sum counts yourself

***

### Blueprint - `UAsyncAction_TetrisItemQuery`

The `QueryTetrisInventoryAsync` node wraps the C++ query for Blueprint use. It manages the underlying query's lifecycle automatically.

| Output Pin          | When It Fires                                     | Data                                   |
| ------------------- | ------------------------------------------------- | -------------------------------------- |
| **On First Result** | Once, immediately after initialization            | `Items By Inventory` (grouped results) |
| **On Updated**      | Every subsequent change anywhere in the hierarchy | `Items By Inventory` (grouped results) |
| **On Failed**       | If initialization fails (e.g., null inventory)    | -                                      |

{% hint style="info" %}
Both output pins provide an array of `FLyraTetrisInventoryQueryResult`. Loop through the outer array for per-container breakdowns, or flatten and sum for a single total.
{% endhint %}

Store the return value to call `Cancel()` when you no longer need tracking.

<details>

<summary>Blueprint example - Inventory Ammo resource counter</summary>

<figure><img src="../../.gitbook/assets/image (235).png" alt=""><figcaption></figcaption></figure>

The graph passes the player's root inventory and tracked resource definitions to `QueryTetrisInventoryAsync`, then wires both **On First Result** and **On Updated** to the same handler that iterates the grouped results, sums `Lyra.Inventory.Item.Count` stat tags per definition, and updates the UI text blocks.

</details>

***
