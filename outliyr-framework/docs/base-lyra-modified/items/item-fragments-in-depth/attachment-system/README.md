# Attachment System

A rifle isn't just a rifle, it has a red dot scope, a vertical grip, and an extended magazine. When the player holds the weapon, the scope grants ADS abilities and spawns a visible mesh. When they holster it, those abilities disappear but the attachments stay attached. When the weapon sits in inventory, the attachments "sleep" with no actors or abilities at all.

The Attachment System is a way for items to host other items, with behavior that changes based on the parent item's state.

***

### The Core Concept

The attachment system solves a specific problem: **items need to contain other items, and those contained items need to react to their parent's state**.

A scope attached to a rifle needs to know when the rifle is held (grant ADS abilities, spawn visible actor) versus holstered (maybe spawn a folded version, no abilities) versus sitting in inventory (do nothing at all). The attachment inherits its behavior from its parent.

This works for more than weapons. A tactical vest can have armor plate modules, when the vest is equipped, the plates grant damage reduction. A scope can have its own attachments like a laser sight. The pattern scales to any "item hosting items" scenario.

***

### Two-Piece Architecture

The system splits into two parts. The runtime/configuration separation keeps shared configuration on the item definition while runtime state is per-instance:

{% stepper %}
{% step %}
#### Static Fragment

The [**Static Fragment**](static-fragment.md) lives on the item definition and says "what CAN attach." It defines attachment slots (scope, grip, magazine), which items are compatible with each slot, and how each attachment should behave when the parent is held versus holstered.
{% endstep %}

{% step %}
#### Runtime Container

The [**Runtime Container**](runtime-container.md) lives on each item instance and tracks "what IS attached." It manages the actual attached items, spawns actors when appropriate, grants abilities, and responds when the parent item's equipment state changes.

This separation means configuration is shared (all assault rifles accept the same attachments) while runtime state is per-instance (this specific rifle has a red dot, that one has a 4x scope).
{% endstep %}
{% endstepper %}

***

### State-Aware Behavior

The key insight is [**state inheritance**](state-behaviors.md). Attachments don't poll for changes or register callbacks everywhere - they simply inherit state from their parent.

{% hint style="info" %}
* Parent in inventory → Attachment inactive (sleeping)
* Parent equipped but holstered → Attachment uses holstered behavior
* Parent equipped and held → Attachment uses held behavior
{% endhint %}

When the player draws their weapon, the equipment system changes the weapon's state. The attachment container notices and automatically switches behaviors, destroying old actors, spawning new ones, removing old abilities, granting new ones, as part of the same state change.

***

## Building Attachment UI

For weapon customization screens and similar interfaces, [**ViewModels**](attachment-viewmodels.md) provide a clean way to bind UI widgets to attachment state. They handle the complexity of prediction, slot paths, and change notifications so your widgets can focus on presentation.

