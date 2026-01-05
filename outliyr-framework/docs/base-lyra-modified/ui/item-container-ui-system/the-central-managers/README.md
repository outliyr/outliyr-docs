# The Central Managers

If ViewModels are the "muscles" of the system, the Managers are the "Central Nervous System."

These subsystems sit on the `LocalPlayer` and `GameInstance`. They are responsible for coordinating the chaos of a multiplayer environment:

* Creating and destroying ViewModels.
* Tracking window positions across the screen.
* Ensuring the UI closes securely when server permissions change.

Without these managers, every widget would have to manage its own lifecycle, leading to memory leaks and invalid pointer crashes.

### The Two Pillars

#### 1. The UI Manager (`LyraItemContainerUIManager`)

**Scope:** `LocalPlayerSubsystem` **Job:** Data Lifecycle & Logic.

Think of this as the **Factory and Garbage Collector**.

* **Leasing:** It holds the master cache of all active ViewModels.
* **Sessions:** It groups windows together logically (e.g., "This chest window owns this popup").
* **Events:** It listens to the game world for item destruction or movement and tells the relevant ViewModels to react.

#### 2. The Window Manager (`LyraItemContainerWindowManager`)

**Scope:** `GameInstanceSubsystem` **Job:** Spatial Awareness & Visuals.

Think of this as the **Desktop Window Manager (DWM)**.

* **Geometry:** It tracks where every window is on screen.
* **Navigation:** It helps the gamepad find the nearest window when you press "Right."
* **Focus:** It manages Z-order and decides which window is "Active."

***

### Why Separate Them?

You might ask: _Why not put everything in one class?_

The separation concerns **Data vs. Presentation**.

* The **UI Manager** doesn't care about pixels. It deals with `FInstancedStruct`, `FGuid`, and Gameplay Tags. You could use the UI Manager to build a text-based inventory if you wanted.
* The **Window Manager** doesn't care about items. It tracks generic rectangles (`FRegisteredItemContainerWindow`). It doesn't know if a window contains an inventory or a skill tree.

This decoupling allows you to:

1. Use the ViewModels _without_ the Windowing system (e.g., for a fixed HUD hotbar).
2. Use the Windowing system for things _other_ than items (e.g., a draggable character stat sheet).

### In This Section

We will explore the deep mechanics of these two systems:

* [**The UI Manager**](the-item-container-ui-manager/)
  * The "Lease" concept: Reference counting ViewModels.
  * Session trees: How closing a parent window cascades to children.
  * Security: Handling server-side access revocation.
* [**The Window Manager**](the-item-container-window-manager/)
  * Tracking screen geometry.
  * Z-Order sorting logic.
  * Bridging the gap between disconnected navigation routers.
