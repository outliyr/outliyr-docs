# Client Predicted Pickup Ability

The standard pickup workflow described in [Pickup System](pickup-system.md) is server-authoritative, the client requests a pickup, waits for the server to process it, and only then sees the result. While correct, this introduces noticeable latency that can break immersion in fast-paced games.

The **Client-Predicted Pickup Ability** (`ULyraGameplayAbility_FromPickup`) solves this by letting the client optimistically execute the pickup locally while the server validates. If the server agrees, everything proceeds smoothly. If rejected, the system automatically rolls back the client's prediction.

Beyond responsiveness, this ability introduces **routing policies**, a way to configure where items go based on your game mode's needs.

***

#### The Routing Problem

Different game modes have fundamentally different pickup expectations:

| Game Mode          | Pickup Behavior                                                       |
| ------------------ | --------------------------------------------------------------------- |
| **TDM / Arena**    | Everything goes directly to QuickBar. Full? Swap with current weapon. |
| **Battle Royale**  | Weapons to QuickBar, ammo/consumables to inventory grid.              |
| **Survival / RPG** | Everything to inventory. Player manually equips.                      |
| **Custom**         | Per-item logic defined in Blueprint.                                  |

A single hardcoded pickup flow can't serve all these needs. The routing policy system makes pickup behavior data-driven and game-mode agnostic.

***

### Architecture Overview

```mermaid
flowchart TD
    subgraph Input
        A[Player Presses Interact]
    end

    subgraph Ability["ULyraGameplayAbility_FromPickup"]
        B[CanPickup - Validate]
        C[Routing Policy - Determine Destination]
        D[Hide Pickup - Client Only]
        E[Build Transaction]
        F[Execute Transaction]
        G[PlayPickupEffects - Montage/Sound/VFX]
    end

    subgraph Execution
        H[SERVER: Validate & Execute]
        I[CLIENT: Predicted State]
    end

    subgraph Result
        J{Transaction Result}
        K[OnPickupConfirmed]
        L[OnPickupRejected + Restore Pickup]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    F --> I
    H --> J
    I --> J
    J -->|Success| K
    J -->|Failure| L
```

#### Key Components

| Component                         | Purpose                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `ULyraGameplayAbility_FromPickup` | Abstract base class for pickup abilities. Subclass per game mode. |
| `FPickupAbilityConfig`            | Data-driven configuration for routing and behavior.               |
| `EPickupRoutingPolicy`            | Enum defining the routing strategy.                               |
| `FPickupAbilityResult`            | Result struct passed to Blueprint events.                         |

***

### Routing Policies

#### `EPickupRoutingPolicy`

{% tabs %}
{% tab title="QuickBarOnly" %}
**Use Case:** TDM, Arena, Gun Game

All items route directly to the QuickBar (equipment slots). If the target slot is occupied, the existing item is swapped out and dropped to the world.

```mermaid
flowchart LR
    A[Pickup Rifle] --> B[QuickBar Slot 1]
    B --> C[Swap Out Pistol]
    C --> D[Pistol Drops to World]
```

**Configuration:**

```cpp
FPickupAbilityConfig Config;
Config.RoutingPolicy = EPickupRoutingPolicy::QuickBarOnly;
Config.SlotPolicy = EQuickSwapSlotPolicy::PreferActiveSlot;
Config.bAutoHold = true;  // Immediately equip after pickup
```
{% endtab %}

{% tab title="InventoryOnly" %}
**Use Case:** Survival, RPG, Looter

All items route to the inventory container. Nothing goes directly to equipment—the player must manually equip items.

```mermaid
flowchart LR
    A[Pickup Rifle] --> B[Inventory Grid]
    B --> C[Player Drags to Equip]
```

**Configuration:**

```cpp
FPickupAbilityConfig Config;
Config.RoutingPolicy = EPickupRoutingPolicy::InventoryOnly;
Config.bMergeStacks = true;  // Combine with existing stacks
```
{% endtab %}

{% tab title="SmartRouting" %}
**Use Case:** Battle Royale, Tactical Shooters

Items are routed based on their type:

* **Equipment** (has `InventoryFragment_EquippableItem`) → QuickBar
* **Everything else** (ammo, consumables, resources) → Inventory

```mermaid
flowchart TD
    A[Pickup Item] --> B{Has EquippableItem Fragment?}
    B -->|Yes| C[Route to QuickBar]
    B -->|No| D[Route to Inventory]

    E[Rifle] --> C
    F[Ammo] --> D
    G[Medkit] --> D
```

**Configuration:**

```cpp
FPickupAbilityConfig Config;
Config.RoutingPolicy = EPickupRoutingPolicy::SmartRouting;
Config.SlotPolicy = EQuickSwapSlotPolicy::AnySlot;
Config.bAutoHold = false;  // Don't auto-equip in BR
Config.bMergeStacks = true;
```
{% endtab %}

{% tab title="Custom" %}
**Use Case:** Unique game mechanics

Blueprint decides the destination for each item. Override `DetermineItemDestination` to implement custom logic.

```mermaid
flowchart LR
    A[Pickup Item] --> B[DetermineItemDestination]
    B --> C[Your Blueprint Logic]
    C --> D[Custom Destination]
```

**Example Use Cases:**

* Quest items go to a special quest inventory
* Faction-specific items check faction before accepting
* Weight-based routing (heavy items to backpack, light to pockets)
{% endtab %}
{% endtabs %}

***

### Configuration Reference

<figure><img src="../../../.gitbook/assets/image (223).png" alt=""><figcaption></figcaption></figure>

#### `FPickupAbilityConfig`

| Property                   | Type                                 | Description                                                                          |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `RoutingPolicy`            | `EPickupRoutingPolicy`               | How items are routed to containers. Default: `SmartRouting`                          |
| `SlotPolicy`               | `EQuickSwapSlotPolicy`               | Which QuickBar slot to target. Options: `PreferActiveSlot`, `AnySlot`, `PreferEmpty` |
| `bAutoHold`                | `bool`                               | Automatically equip after QuickBar pickup. Default: `true`                           |
| `bMergeStacks`             | `bool`                               | Merge with existing stacks in inventory. Default: `true`                             |
| `DropParams`               | `FDropParams`                        | Parameters for dropping displaced items.                                             |
| `StaticCollectableClass`   | `TSubclassOf<AWorldCollectableBase>` | Class to spawn for dropped static mesh items.                                        |
| `SkeletalCollectableClass` | `TSubclassOf<AWorldCollectableBase>` | Class to spawn for dropped skeletal mesh items.                                      |

***

### Client Prediction Flow

The prediction system ensures pickups feel instant while maintaining server authority.

```mermaid
sequenceDiagram
    participant Player
    participant Client
    participant Server

    Player->>Client: Press Interact

    rect rgb(200, 230, 200)
        Note over Client: Immediate Feedback
        Client->>Client: HideForPrediction()
        Client->>Client: Play Effects (Montage/Sound)
        Client->>Client: Add Item (Predicted)
    end

    Client->>Server: Transaction Request

    rect rgb(200, 200, 230)
        Note over Server: Authoritative Execution
        Server->>Server: Validate Pickup
        Server->>Server: Execute Transaction
        Server->>Server: Destroy Pickup Actor
    end

    alt Success
        Server->>Client: OnPickupConfirmed
        Client->>Client: Finalize State
    else Rejection
        Server->>Client: OnPickupRejected
        Client->>Client: RestoreFromRejectedPrediction()
        Client->>Client: Rollback Inventory
    end
```

#### Visibility Management

When the client predicts a pickup, the world collectable is hidden immediately using `HideForPrediction()`. This provides instant visual feedback without destroying the actor (which only the server can do).

If the server rejects the pickup, `RestoreFromRejectedPrediction()` makes the collectable visible again, and the predicted inventory changes are rolled back automatically by the transaction system.

***

### Blueprint Extension Points

The ability provides several hooks for game-mode specific customization:

#### Validation

<figure><img src="../../../.gitbook/assets/image (224).png" alt="" width="368"><figcaption></figcaption></figure>

{% hint style="info" %}
**`CanPickup`** _(BlueprintNativeEvent)_

Called before any pickup logic. Return `false` to prevent the pickup entirely.

**Use Cases:**

* Check player has inventory space
* Validate faction/level requirements
* Prevent pickup during certain game states
{% endhint %}

#### Routing

<figure><img src="../../../.gitbook/assets/image (225).png" alt="" width="375"><figcaption></figcaption></figure>

{% hint style="info" %}
**`DetermineItemDestination`** _(BlueprintNativeEvent)_

Only called when `RoutingPolicy == Custom`. Determines where each item should go.

**Parameters:**

* `ItemDef` - The item definition being picked up
* `Pickup` - The world collectable actor
* `OutDestContainer` - Set this to the target container
* `OutDestSlot` - Set this to the target slot (or leave empty for auto-placement)
* `OutEquipmentSlot` - Set this for equipment routing
{% endhint %}

#### Feedback

<figure><img src="../../../.gitbook/assets/image (226).png" alt="" width="334"><figcaption></figcaption></figure>

{% hint style="info" %}
**`PlayPickupEffects`** _(BlueprintImplementableEvent)_

Called immediately after prediction executes. Use for:

* Animation montages (pickup grab animation)
* Sound effects (pickup sound)
* VFX (particle burst, UI flash)

**Parameters:**

* `Pickup` - The world collectable being picked up
* `Items` - Array of item instances being picked up
{% endhint %}

#### Result Callbacks

| Event               | When Called                       | Typical Use                            |
| ------------------- | --------------------------------- | -------------------------------------- |
| `OnPickupPredicted` | Immediately after client predicts | Update UI optimistically               |
| `OnPickupConfirmed` | Server confirms the pickup        | Finalize any pending UI states         |
| `OnPickupRejected`  | Server rejects the pickup         | Show error message, play failure sound |

***

### Creating a Game-Mode Pickup Ability

{% stepper %}
{% step %}
#### Create Blueprint Subclass

Create a new Blueprint class inheriting from `ULyraGameplayAbility_FromPickup`.\
Name it appropriately (e.g., `GA_Pickup_BattleRoyale`).
{% endstep %}

{% step %}
#### Configure Default Settings

In the Blueprint defaults, set up `DefaultConfig`:
{% endstep %}

{% step %}
#### Implement Effects (Optional)

Override `PlayPickupEffects` to add your pickup feel:
{% endstep %}

{% step %}
#### Wire Up Interaction

Grant this ability and trigger it from the [interaction system](../../interaction/). The pickup is passed via the `TriggerEventData->Target` field.
{% endstep %}
{% endstepper %}

***

### Common Configurations

#### TDM

```cpp
// Instant swap, always equip what you pick up
Config.RoutingPolicy = EPickupRoutingPolicy::QuickBarOnly;
Config.SlotPolicy = EQuickSwapSlotPolicy::PreferActiveSlot;
Config.bAutoHold = true;
```

#### Battle Royale

```cpp
// Smart routing, manual equip, merge ammo stacks
Config.RoutingPolicy = EPickupRoutingPolicy::SmartRouting;
Config.SlotPolicy = EQuickSwapSlotPolicy::AnySlot;
Config.bAutoHold = false;
Config.bMergeStacks = true;
```

#### Survival / RPG

```cpp
// Everything to inventory, player manages equipment
Config.RoutingPolicy = EPickupRoutingPolicy::InventoryOnly;
Config.bMergeStacks = true;
```

***

### Relationship to Other Systems

```mermaid
flowchart TB
    subgraph PickupAbility["Client-Predicted Pickup Ability"]
        A[ULyraGameplayAbility_FromPickup]
    end

    subgraph WorldSystems["World Systems"]
        B[IPickupable Interface]
        C[AWorldCollectableBase]
    end

    subgraph Containers["Container Destinations"]
        D[QuickBar Component <br> Equipment Manager]
        E[Inventory Manager]
    end

    subgraph Transaction["Transaction System"]
        F[Item Transaction System]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F

    B -.->|Provides items| A
    C -.->|Visibility control| A
    F -.->|Prediction & rollback| A
```

| System                                                                                               | Relationship                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Pickup System](pickup-system.md)                                                                    | Provides `IPickupable` interface and `AWorldCollectableBase` actors |
| [Item Transaction System](../../item-container/transactions/)                                        | Handles the actual container mutations with prediction support      |
| [QuickBar Component](../../equipment/quick-bar-component.md) / [Equipment Manager](../../equipment/) | Destination for `QuickBarOnly` and equipment in `SmartRouting`      |
| [Inventory Manager](../../inventory/inventory-manager-component.md)                                  | Destination for `InventoryOnly` and non-equipment in `SmartRouting` |

***

### Troubleshooting

{% hint style="warning" %}
**Pickup disappears then reappears**

The server rejected the pickup. Check:

* Does the player have inventory space?
* Is another player picking up simultaneously?
* Are there permission/validation failures?
{% endhint %}

{% hint style="warning" %}
**Items go to wrong destination**

Verify your `RoutingPolicy` setting. For `SmartRouting`, ensure equipment items have the `InventoryFragment_EquippableItem` fragment.
{% endhint %}

{% hint style="warning" %}
**No pickup effects playing**

Ensure you've overridden `PlayPickupEffects` in your Blueprint subclass. The base C++ class doesn't play any effects by default.
{% endhint %}
