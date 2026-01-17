# Items

This system provides a robust, flexible, and networked foundation for managing items within your game. It builds upon Lyra's core concepts but significantly extends them to offer a feature-rich solution suitable for complex shooter and RPG mechanics.

***

## Purpose: The Item Foundation

The Items system defines **what items are** - their types, behaviors, data, and how they exist in the world. It provides:

* Complex item types with modular behaviors (**Fragments**)
* Unique, instance-specific data storage (**Transient Data**)
* Sophisticated item interactions (Combining, Attaching)
* Integration with the Gameplay Ability System (**GAS**) for item usage
* Item representation in the game world (**Pickups**)
* Centralized item management (**Global Inventory Manager**)
* Extensibility through external game features (**Fragment Injector**)

{% hint style="info" %}
**Note:** For container-specific documentation (inventory storage, equipment slots), see [Inventory](../inventory/) and [Equipment](../equipment/). To understand the core concepts of item containers like prediction, permission systems, slot system, see [Item Container](../item-container/).
{% endhint %}

***

## Core Philosophy & Design

The design adheres to several key principles:

* **Modularity via Fragments:** Item functionality is broken down into composable `ULyraInventoryItemFragment`s. Instead of deep inheritance chains, items gain behaviors (like being equippable, consumable, attachable) by adding the relevant fragments to their definition.
* **Data-Driven:** Item types (`ULyraInventoryItemDefinition`) and their core behaviors are defined primarily in Data Assets, empowering designers and reducing the need for code changes.
* **Instance-Specific State:** Items can have different runtime states (e.g., different ammo counts, durability, attachments). The system provides **Transient Fragments** (`FTransientFragmentData` and `UTransientRuntimeFragment`) for unique per-instance data.
* **Networked:** Built for multiplayer, the system uses Unreal's replication features including `FFastArraySerializer` and subobject replication.
* **Decoupled & Extensible:** Items are independent of their containers. The **Fragment Injector** allows external plugins to modify existing item definitions non-destructively.

***

## Key Components

### Item Definition & Instance

| Component                      | Description                                           |
| ------------------------------ | ----------------------------------------------------- |
| `ULyraInventoryItemDefinition` | The static template of an item type (Blueprint class) |
| `ULyraInventoryItemInstance`   | A runtime instance holding unique state               |
| `ULyraInventoryItemFragment`   | Base class for modular item behaviors                 |

### Fragment Types

| Type                        | Description                            |
| --------------------------- | -------------------------------------- |
| Static Fragments            | Shared behavior on the definition CDO  |
| `FTransientFragmentData`    | Per-instance struct data               |
| `UTransientRuntimeFragment` | Per-instance UObject for complex logic |

### World & Management

| Component                 | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `IPickupable`             | Interface for world item representation            |
| `ALyraWorldCollectable`   | Actor for pickup logic                             |
| `UGlobalInventoryManager` | Centralized world container tracking               |
| `UItemSubSystem`          | Centralized item creation                          |
| `UFragmentInjector`       | System for modular fragment injection from plugins |

***

## High-Level Architecture

```
ULyraInventoryItemDefinition (Blueprint Class - Static Template)
├── DisplayName
├── Fragments[] (Instanced UObjects)
│   ├── UInventoryFragment_InventoryIcon
│   ├── UInventoryFragment_Equippable
│   ├── UInventoryFragment_Consumable
│   └── UInventoryFragment_Attachment
│
└── Creates ──► ULyraInventoryItemInstance (Runtime)
                ├── StatTags (FGameplayTagStackContainer)
                ├── TransientFragments[] (FInstancedStruct)
                ├── RuntimeFragments[] (UTransientRuntimeFragment)
                └── CurrentSlot (where this item lives)
```

***

## How Items Connect to Containers

Items exist independently of containers. A single `ULyraInventoryItemInstance` can move between:

* **Inventory** (`ULyraInventoryManagerComponent`) - Storage
* **Equipment** (`ULyraEquipmentManagerComponent`) - Active gameplay
* **Attachments** (`UTransientRuntimeFragment_Attachment`) - Nested on other items
* **World** (`ALyraWorldCollectable`) - Dropped in the game world

All containers implement `ILyraItemContainerInterface`. For container-specific documentation, see:

* [Inventory](../inventory/) - Storage containers
* [Equipment](../equipment/) - Equippable item slots
* [Attachment](item-fragments-in-depth/attachment-system/) - Items attached to other items
* [Item Container](../item-container/) - Shared interface and transactions

***

## Section Contents

* [Items & Fragments](items-and-fragments/)\
  Understanding Definitions, Instances, Stat Tags, and the different Fragment types (Base, Transient Struct, Transient UObject).
* [World Interaction & Global Management](world-interaction-and-global-management/)\
  How items exist outside inventories (`IPickupable`, `ALyraWorldCollectable`) and the role of the `UGlobalInventoryManager`.
* [Modularity: Fragment Injector](modularity-fragment-injector/)\
  Adding functionality via plugins using the Fragment Injector system.
* [Item Fragments In-Depth](item-fragments-in-depth/)\
  Detailed explanations and usage for specific fragments (Attachment, Consume, Icon, Category, Pickup, SetStats).

***
