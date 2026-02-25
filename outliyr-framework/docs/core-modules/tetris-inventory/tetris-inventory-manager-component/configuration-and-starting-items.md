# Configuration and Starting Items

A player spawns into a survival game. Their backpack already contains a flashlight, two bandages, and a water bottle, each placed at specific grid positions, the flashlight pre-loaded with batteries. Another player spawns with a different loadout entirely, configured from the same component. How does the system set all this up before the player takes their first step?

The Tetris Inventory Manager Component uses a declarative configuration model. You describe the grid layout, capacity rules, and starting items directly on the component, the system handles creation, placement, and fragment initialization at the right time.

***

### Configuration Properties

The component exposes several categories of configuration, all editable in the Details panel.

#### Grid Structure

```
InventoryLayout (TArray<FInventoryLayoutCreator>)
```

This defines the shape of your inventory grid, rows, columns, and clump groupings. It **must not be empty**. Without a layout, items have nowhere to go and the component will log an error at BeginPlay.

```
                  InventoryLayout
                  ┌─────────────────────────────────────┐
                  │ Clump 0: 4x6 grid                   │
                  │ ┌──┬──┬──┬──┬──┬──┐                 │
                  │ │  │  │  │  │  │  │  Row 0          │
                  │ ├──┼──┼──┼──┼──┼──┤                 │
                  │ │  │  │  │  │  │  │  Row 1          │
                  │ ├──┼──┼──┼──┼──┼──┤                 │
                  │ │  │  │  │  │  │  │  Row 2          │
                  │ ├──┼──┼──┼──┼──┼──┤                 │
                  │ │  │  │  │  │  │  │  Row 3          │
                  │ └──┴──┴──┴──┴──┴──┘                 │
                  │                                     │
                  │ Clump 1: 2x3 side pocket            │
                  │ ┌──┬──┬──┐                          │
                  │ │  │  │  │                          │
                  │ ├──┼──┼──┤                          │
                  │ │  │  │  │                          │
                  │ └──┴──┴──┘                          │
                  └─────────────────────────────────────┘
```

Multiple clumps let you model inventories with separate sections, a main compartment and a side pocket, for example, all managed by a single component.

{% hint style="info" %}
Use the Tetris Workspace (`EUW_InventoryLayoutCreator`) to visually design layouts instead of manually editing the array. See [Grid Layout](/broken/pages/bcb1990331a91edf01375aaa93ead2d308328203#best-practice-using-the-layout-editor-utility-widget) for details.
{% endhint %}

#### Capacity Limits

| Property                  | Type                     | Default              | Purpose                                               |
| ------------------------- | ------------------------ | -------------------- | ----------------------------------------------------- |
| `MaxWeight`               | float                    | 0 (unlimited)        | Total weight this inventory can hold                  |
| `ItemCountLimit`          | int32                    | 0 (unlimited)        | Maximum total item count (including stack quantities) |
| `AllowedItems`            | TSet                     | Empty (all allowed)  | Whitelist, only these item definitions can enter      |
| `DisallowedItems`         | TSet                     | Empty (none blocked) | Blacklist, these item definitions are always rejected |
| `SpecificItemCountLimits` | TArray\<FPickupTemplate> | Empty                | Per-item-type quantity caps                           |

These are inherited from the base `ULyraInventoryManagerComponent`. The Tetris component enforces them **in addition to** spatial constraints. An item must fit the grid shape **and** pass weight/count/filter checks.

#### Child Inventory Propagation

When this inventory contains items that are themselves containers (backpacks inside backpacks), these flags control how nested contents affect **this** inventory's limits:

| Property                          | Default | When `true`                                                    | When `false`                                     |
| --------------------------------- | ------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `bIgnoreChildInventoryWeights`    | `true`  | A backpack weighing 2kg with 10kg inside counts as 2kg         | Same backpack counts as 12kg                     |
| `bIgnoreChildInventoryItemCounts` | `true`  | A non-stackable backpack with 10 items inside counts as 1 item | Same backpack counts as 11 items                 |
| `bIgnoreChildInventoryItemLimits` | `true`  | Per-item limits ignore contents of child containers            | Per-item limits include child container contents |

{% hint style="info" %}
These flags control propagation **upward** from children to this inventory. For full details on how constraint propagation works through nested containers, see [Constraint Propagation](nested-containers.md#constraint-propagation).
{% endhint %}

***

### Starting Items

The `StartingItems` array defines which items the inventory spawns with. Each entry is an `FTetrisInventoryStartingItem`:

```cpp
USTRUCT(BlueprintType)
struct FTetrisInventoryStartingItem
{
    // Which item to create
    TSubclassOf<ULyraInventoryItemDefinition> ItemDef;

    // How many to add (obeys stacking rules)
    int32 AmountToAdd = 1;

    // Where to place it. (-1, -1) = auto-find available space
    FIntPoint Position = FIntPoint(-1);

    // Which clump to place into. Ignored when Position is (-1, -1)
    int32 Clump = 0;

    // Item rotation on the grid
    EItemRotation ItemRotation = Rotation_0;

    // Per-instance customization applied before placement
    TArray<FInstancedStruct> FragmentInitData;
};
```

#### Auto-Placement vs Manual Placement

You have two options for where starting items land:

| Approach         | Position Value       | Behavior                                                                                                                                        |
| ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-place**   | `(-1, -1)`           | System calls `FindAvailableSlotsForItem()` to find the first position where the item's shape fits. Clump and rotation are chosen automatically. |
| **Manual place** | Specific coordinates | Item is placed at exactly `Position` in `Clump` with `ItemRotation`. The slot must be accessible or the item is skipped.                        |

Auto-placement is the safe default for most cases. Use manual placement when you need precise control, a weapon always in the top-left, grenades always in the side pocket.

#### Fragment Init Data

`FragmentInitData` lets you customize each starting item **without creating separate item definitions** for every loadout variation. Each entry is an `FInstancedStruct` containing a fragment-specific initialization payload.

When the item is created, these payloads are matched to the item's fragments and applied before the item enters the grid. Common uses:

* **Ammo count:** Start a weapon with a specific magazine and reserve ammo
* **Child container contents:** Pre-fill a nested backpack with its own items via `FContainerFragmentInit`
* **Attachments:** Pre-attach a scope or suppressor to a weapon

```
StartingItems:
┌───────────────────────────────────────────────────────────────┐
│ [0] Assault Rifle                                             │
│     ItemDef:       ID_Rifle_Assault                           │
│     AmountToAdd:   1                                          │
│     Position:      (0, 0)    ← top-left of clump 0            │
│     Clump:         0                                          │
│     ItemRotation:  Rotation_0                                 │
│     FragmentInitData:                                         │
│       └─ FAmmoInitData { Magazine: 30, Reserve: 90 }          │
│                                                               │
│ [1] Bandages                                                  │
│     ItemDef:       ID_Bandage                                 │
│     AmountToAdd:   3                                          │
│     Position:      (-1, -1)  ← auto-place                     │
│     FragmentInitData: (empty, uses definition defaults)       │
│                                                               │
│ [2] Medical Pouch (container item)                            │
│     ItemDef:       ID_MedPouch                                │
│     AmountToAdd:   1                                          │
│     Position:      (-1, -1)  ← auto-place                     │
│     FragmentInitData:                                         │
│       └─ FContainerFragmentInit                               │
│            StartingItems:                                     │
│              ├─ Morphine x1                                   │
│              └─ Splint x1                                     │
└───────────────────────────────────────────────────────────────┘
```

{% hint style="info" %}
For the full details on how fragment initialization payloads work, including how to create custom init structs, see [Fragment Initialization](../../../base-lyra-modified/items/items-and-fragments/fragment-initialization.md).
{% endhint %}

***

### The Tetris Starting Items Workspace

The `StartingItems` array can be edited by hand in the details panel, but for anything beyond a few items you want the visual workspace. It opens directly from the component's details panel and gives you a drag-and-drop canvas for authoring layouts.

<figure><img src="../../../.gitbook/assets/image (236).png" alt=""><figcaption><p>Tetris Workspace</p></figcaption></figure>

It can be accessed using `Tools -> Outliyr -> Tetris Workspace`&#x20;

<figure><img src="../../../.gitbook/assets/image (237).png" alt=""><figcaption></figcaption></figure>

{% hint style="info" %}
The starting items editor is an editor-only tool for authoring initial layouts. At runtime, all placement goes through the standard `AddItemToSlot()` and prediction pipeline.
{% endhint %}

The workspace is split into three panels:

* **Item Palette** (left) - a searchable list of all item definitions in the project. Drag items from here onto the canvas to add them as starting items.
* **Canvas** (center) - the visual grid showing all clumps. Items appear color-coded with their icons. Drag items to place them, right-click for context actions, middle-click drag to pan.
* **Details** (right) - a tabbed panel with three views: **Component** (the selected component's properties), **Instance** (the selected starting item's properties including `FragmentInitData`), and **Definition** (the item definition CDO).

{% hint style="warning" %}
Item definitions are tied to their Game Feature plugins. The palette only shows definitions from currently loaded plugins, if you switch to a map from a different plugin, hit the refresh button to update the list.
{% endhint %}

To load a component, use **Use Selected Actor** to pull from a viewport-selected actor, or **Use Selected Asset** to load from a Content Browser blueprint.

#### Key Interactions

| Action                    | Control                              |
| ------------------------- | ------------------------------------ |
| Place item                | Drag from palette onto grid          |
| Move item                 | Drag item to new position            |
| Rotate item               | `R` key or right-click > Rotate      |
| Delete item               | `Delete` key or right-click > Delete |
| Pan canvas                | Middle-click drag                    |
| Toggle cell accessibility | Left-click on empty cell             |
| Open child container      | Right-click item > Open Container    |

#### Grid Editing

The toolbar above the canvas lets you add/remove clumps, add/remove rows, and add/remove columns. Changes apply to the selected clump. Clumps can be repositioned by clicking on the clump label and then dragging within the grid.

#### Container Windows

Items with an `InventoryFragment_Container` can be opened in a separate window on the canvas via `right-click > Open Container`. This lets you author nested starting items visually, pre-filling a backpack with medical supplies, for example, without leaving the workspace. Non-root windows can be closed when you're done editing them.

{% hint style="info" %}
The workspace writes directly to the `StartingItems` array on the component. At runtime, all placement goes through the standard `AddItemToSlot()` and prediction pipeline, the workspace is purely an editor authoring tool.
{% endhint %}

***

### Initialization Flow

The tetris inventory component follows a specific sequence to go from configuration to a populated inventory.

{% stepper %}
{% step %}
**Component Created**

`InitializeComponent()` runs. The prediction runtime is created and wired up. The grid and placement structures are initialized with their owner references. No items exist yet.
{% endstep %}

{% step %}
**Grid Layout Built**

During `BeginPlay()`, the component checks that `InventoryLayout` is non-empty, then calls `PopulateInventoryGrid()` to create the grid cell structure from the layout definition.
{% endstep %}

{% step %}
**Experience Loads**

The Lyra experience system fires `OnExperienceLoaded`. The component marks itself as initialized on the server. The base class calls `AddStartingItems()`.
{% endstep %}

{% step %}
**Starting Items Placed**

`AddStartingItems()` iterates each `FTetrisInventoryStartingItem` entry:

1. Skips invalid entries (null ItemDef or AmountToAdd <= 0)
2. Creates the item instance via `ULyraStartingItemHelpers::CreateItemWithInit()`, applying any `FragmentInitData`
3. Resolves placement: validates the manual position or auto-finds available space
4. Builds an `FInventoryAbilityData_SourceTetrisItem` slot descriptor and adds the item to the grid
{% endstep %}

{% step %}
**Grid Rebuilt and Broadcast**

The grid is rebuilt from the effective view. `OnTetrisInventoryChanged` broadcasts to notify any listening UI or systems that the inventory is ready.
{% endstep %}
{% endstepper %}

***

### Dynamic Creation (Container Items)

Starting items are not just for player inventories. When `InventoryFragment_Container` creates a child inventory for a container item (like a backpack), the same configuration model applies.

{% stepper %}
{% step %}
**Fragment Creates Component**

`InventoryFragment_Container::CreateNewTransientFragment()` creates a new `ULyraTetrisInventoryManagerComponent` via `NewObject`.
{% endstep %}

{% step %}
**Configuration Passed Through**

The fragment calls `InitialiseTetrisInventoryComponent()`, passing all its configuration: layout, limits, allowed items, and starting items.

```cpp
NewInventoryManager->InitialiseTetrisInventoryComponent(
    ContainerName,
    InventoryLayout,
    StartingItems,
    MaxWeight,
    bIgnoreChildInventoryWeights,
    ItemCountLimit,
    bIgnoreChildInventoryItemCounts,
    AllowedItems,
    DisallowedItems,
    SpecificItemCountLimits,
    bIgnoreChildInventoryItemLimits
);
```
{% endstep %}

{% step %}
**Fragment Init Can Override**

If the container item was itself created with `FContainerFragmentInit` data (from a parent's starting items or a loot table), the init data can **replace** the fragment's default starting items before `AddStartingItems()` runs.

This means the same backpack definition can spawn with different contents depending on context, a medic's pouch has bandages, a scout's has binoculars.
{% endstep %}

{% step %}
**Starting Items Flow Runs**

The same `AddStartingItems()` flow described above executes for the child inventory, populating it with its configured items.
{% endstep %}
{% endstepper %}

<details>

<summary>Why Configuration Lives on the Component</summary>

You might wonder why starting items and layout are component properties rather than being passed in from an external system like a GameMode or DataAsset.

The answer is **locality and reuse**. When an `InventoryFragment_Container` defines a backpack, all the configuration for that backpack's internal inventory lives on the fragment, which delegates to the component. This means:

* **Self-contained items:** A backpack item definition contains everything needed to create and populate its inventory. No external manager required.
* **Hierarchical composition:** Container items inside container items each carry their own configuration. The system creates inventories recursively without any central coordinator.
* **Experience flexibility:** Different experiences can have different Tetris Inventory components with different starting items. Switching experiences switches loadouts automatically.

For player inventories, the component lives on player controller. For container items, the component is dynamically created. Either way, the same properties drive the same initialization flow.

</details>

***

### Troubleshooting

{% hint style="info" %}
**Items not appearing at startup?** Check:

* `InventoryLayout` is not empty, the component logs an error if it is
* `StartingItems` entries have valid `ItemDef` references and `AmountToAdd` >= 1
* Manual positions are within the grid bounds and the target clump exists
* The item's `InventoryFragment_Tetris` shape fits at the specified position and rotation
{% endhint %}

{% hint style="info" %}
**Auto-placed items being skipped?** The grid may be full. Check that your layout has enough accessible cells for all starting items' shapes. Items are placed in order, large items should come first to avoid fragmentation.
{% endhint %}

{% hint style="info" %}
**FragmentInitData not taking effect?** Ensure the init struct type matches the fragment it targets. Each fragment type expects a specific init struct (e.g., `InventoryFragment_Container` expects `FContainerFragmentInit`). See [Fragment Initialization](../../../base-lyra-modified/items/items-and-fragments/fragment-initialization.md) for the matching rules.
{% endhint %}
