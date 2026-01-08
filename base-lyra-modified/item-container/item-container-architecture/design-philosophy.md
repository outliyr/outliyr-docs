# Design Philosophy

Every architectural decision involves trade-offs. This page explains _why_ the ItemContainer system is designed the way it is, the problems each decision solves, the alternatives considered, and the trade-offs accepted.

***

### Why Container-Agnostic?

**The problem:** Games have multiple container types (inventory, equipment, attachments, vendors, crafting stations). Each has different slot mechanics, but they share common operations: add, remove, move, query.

**The alternatives:**

{% stepper %}
{% step %}
#### Separate systems

Each container has its own transaction code, prediction system, UI architecture. Duplicates logic, makes cross-container operations awkward.
{% endstep %}

{% step %}
#### Inheritance hierarchy

A base container class with overrides. Gets complex fast, what's the common base between a grid inventory and an attachment rail?
{% endstep %}

{% step %}
#### Interface abstraction

Define _what_ containers must do, let implementations decide _how_. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why interface abstraction wins:**

* **Composition over inheritance**: Containers don't need a common base. An `InventoryFragment_Attachment` isn't a component, it's a fragment that implements the interface.
* **Plugin extensibility**: New container types (Tetris inventory, vendor, vehicle storage) implement the interface without modifying core code.
* **Single transaction system**: One ability handles all container operations, with container-specific behavior delegated to the interface methods.

**The trade-off:** More abstraction means more indirection. Simple containers have interface overhead they don't strictly need. The framework accepts this cost for the benefits of uniformity.

***

### Why FInstancedStruct for Slot Descriptors?

**The problem:** Different containers use different slot identifiers (index, tag, path). The transaction system needs to pass slots around without knowing their type.

**The alternatives:**

{% stepper %}
{% step %}
#### Union struct

A struct with fields for every slot type. Wasteful, requires updating when new containers are added.
{% endstep %}

{% step %}
#### UObject pointers

Flexible but creates GC pressure, requires careful lifetime management, doesn't serialize naturally.
{% endstep %}

{% step %}
#### FInstancedStruct

Polymorphic structs with value semantics. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why FInstancedStruct wins:**

* **Value semantics**: Copy, move, serialize like any struct. No GC, no weak pointer concerns.
* **Type-safe polymorphism**: Runtime type checking via `GetScriptStruct()`, safe casting with `GetPtr<T>()`.
* **Automatic serialization**: Handled by Unreal's struct serialization, works with SaveGame, RPC, etc.
* **Plugin extensibility**: New slot types are just new structs—no engine modification needed.

**The trade-off:** Slight runtime overhead for type checking and virtual calls. Some Blueprint friction (generic structs require special handling). Worth it for the flexibility.

***

### Why Per-Container Occupied Slot Behavior?

**The problem:** When you move an item to an occupied slot, what happens? The answer depends on the game and the container:

* Inventory: Swap items
* Stacking inventory: Merge compatible stacks
* Equipment: Swap (unequip old, equip new)
* Attachments: Route to fragment logic

**The alternatives:**

{% stepper %}
{% step %}
#### Global policy

One rule for all containers. Too restrictive, games need different behaviors.
{% endstep %}

{% step %}
#### Per-operation flags

Each move specifies the behavior. Shifts complexity to callers.
{% endstep %}

{% step %}
#### Container decides

Each container reports its behavior, transaction system respects it. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why container-decides wins:**

* **Encapsulation**: Container behavior lives in the container, not scattered across calling code.
* **Context-sensitive**: A container can return different behaviors based on the items involved (stack-combine for compatible stackables, swap for incompatible).
* **Default safety**: Unknown containers default to `Reject`, preventing accidental data loss.

**The trade-off:** Callers can't override container behavior without modifying the container. This is intentional, consistent behavior prevents edge cases.

***

### Why Atomic Transactions?

**The problem:** Moving an item involves multiple steps: validate, remove from source, add to destination. What if step 2 succeeds but step 3 fails?

**The alternatives:**

{% stepper %}
{% step %}
#### Best effort

Do what you can, report partial success. Creates inconsistent state, confuses UI, breaks predictions.
{% endstep %}

{% step %}
#### Pre-validation only

Check everything first, then execute. Race conditions can still occur between check and execute.
{% endstep %}

{% step %}
#### Atomic with rollback

All operations succeed or all fail, with recorded deltas for reversal. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why atomic wins:**

* **Consistency**: State is always valid. No orphaned items, no duplicate items, no half-completed moves.
* **Prediction safety**: If the server rejects, rollback is deterministic. UI auto-corrects without manual fixup.
* **Multi-container operations**: Moving between containers either fully succeeds or fully fails across both.

**The trade-off:** More complex implementation. Delta recording adds overhead. Some operations that "should" partially succeed can't (e.g., moving 10 items when only 5 slots available).

***

### Why Opt-In Prediction?

**The problem:** Prediction adds latency hiding but requires careful state management. Not all containers benefit.

**The alternatives:**

{% stepper %}
{% step %}
#### All containers predict

Simpler mental model, but wastes effort on static containers (vendors, loot) and forces every item container to implement prediction logic
{% endstep %}

{% step %}
#### No prediction

Server-authoritative only. Safe but laggy, 300ms round-trip for every inventory click.
{% endstep %}

{% step %}
#### Opt-in prediction

Containers declare prediction support. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why opt-in wins:**

* **Right tool for the job**: Player inventory benefits from prediction. Vendor stock doesn't.
* **Reduced complexity**: Simple containers skip the overlay/reconciliation complexity entirely.
* **Gradual adoption**: Start without prediction, add it later when needed.

**The trade-off:** Two code paths (predicted vs non-predicted). Containers that should predict but don't feel laggy. Developers must consciously enable prediction.

***

## Why Overlay Composition?

**The problem:** Client needs to show predicted state while server state replicates. How do you merge them?

**The alternatives:**

{% stepper %}
{% step %}
#### Dual state

Maintain separate client and server copies. Complex synchronization, easy to diverge.
{% endstep %}

{% step %}
#### Mutate server state

Apply predictions directly, undo on rejection. Destroys server truth, complicates reconciliation.
{% endstep %}

{% step %}
#### Overlay composition

Server state is read-only base, predictions layer on top. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why overlays win:**

* **Server truth preserved**: The replicated state is never modified by predictions.
* **Clean reconciliation**: Clearing overlays reveals server truth instantly.
* **Multiple predictions**: Overlays can stack, prediction 2 builds on prediction 1's overlay.

**The trade-off:** Every read must compose base + overlay. View caching helps, but adds complexity. The composition logic must handle edge cases (item in overlay that doesn't exist in base).

See [The Overlay Model](../prediction/the-overlay-model/) for the full explanation.

***

### Why Polymorphic Container Sources?

**The problem:** UI needs to display different containers. Each container type needs a ViewModel, but UI code shouldn't know about every container type.

**The alternatives:**

{% stepper %}
{% step %}
#### Switch on container type

UI checks "is this inventory? equipment? attachment?" Breaks with new types.
{% endstep %}

{% step %}
#### Container creates ViewModel

Container knows its ViewModel type. Couples container to UI.
{% endstep %}

{% step %}
#### Polymorphic sources

A source struct knows how to create its ViewModel. This is the chosen approach.
{% endstep %}
{% endstepper %}

**Why polymorphic sources win:**

* **UI stays generic**: UI code creates ViewModels from sources without knowing container types.
* **Caching by source**: Sources provide hashes for cache keying.
* **Plugin support**: New containers define their source + ViewModel pair.

**The trade-off:** Another layer of abstraction. Sources duplicate some container information. Worth it for clean UI architecture.

***

## Summary of Trade-offs

| Decision                   | Benefit                                         | Cost                       |
| -------------------------- | ----------------------------------------------- | -------------------------- |
| Interface abstraction      | Plugin extensibility, single transaction system | Indirection overhead       |
| FInstancedStruct slots     | Value semantics, serialization, type safety     | Runtime type checking cost |
| Container-decides behavior | Encapsulation, context-sensitivity              | Callers can't override     |
| Atomic transactions        | Consistency, safe rollback                      | No partial success         |
| Opt-in prediction          | Right-sized complexity                          | Two code paths             |
| Overlay composition        | Server truth preserved                          | Read composition overhead  |

***

## When to Break the Rules

These design decisions are guidelines, not laws. Break them when:

* **Performance critical**: Direct container manipulation may beat transactions for server-side batch operations.
* **Simple prototype**: Skip prediction entirely until you need it.
* **Non-standard containers**: A container that doesn't fit the interface might need its own approach.

The framework is designed to be flexible. Use the patterns that help, adapt or bypass the ones that don't.

***

## Next Steps

Now that you understand the architecture, learn how operations flow through the system in [Transactions](../transactions/).
