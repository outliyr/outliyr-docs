# Custom Hud Widget

## **What you're building**

A **custom score widget** shown to all players in your game mode, bound to a live game-state value through Gameplay Messages. By the end you'll have a working "current score" panel that updates whenever the underlying game state changes, without polling, without ticking.

The bigger goal of this recipe isn't the score widget. It's understanding **the four different ways to put a widget on screen in this framework** and when to use each. Once you know that, the score widget below, and any other HUD widget you build, drops into the right path naturally.

By the end you'll know:

* The four widget-registration paths and when to pick which
* Which base class your widget should subclass for which job
* How to bind a widget to live game state through events (no ticking)
* Where the framework's MVVM examples live for inventory-style UIs

> [!INFO]
> This recipe assumes you've completed the [Quick Start Guide](../quick-start-guide.md) and have a [Game Feature Plugin](../installing-and-setup.md) of your own to drop the widget into.

***

## **Four ways to put a widget on screen**

The framework gives you four registration paths, each suited to a different scenario. Pick the one that matches your goal, they're not interchangeable.

### **`UGameFeatureAction_AddWidget` from an Experience.**&#x20;

The widget is added to the running HUD when the Experience activates and removed when it ends.

* **When to use:** HUD elements that apply to **every player** in a given mode, scoreboards, round timers, objective trackers. The worked example below uses this path.

<img src=".gitbook/assets/image (291).png" alt="" title="Example of default shooter widgets">

### **Pawn Data widget set.**&#x20;

Widgets attached to a specific Pawn Data asset, granted when the player spawns with that Pawn Data and removed when they don't.

* **When to use:** **per-pawn** HUDs in **asymmetric modes**.
* **Example:** in Prop Hunt, hunters and props each spawn with their own Pawn Data, hunters see the quickbar and weapon HUD, props see decoy and disguise hint widgets. The same pattern fits class-based modes (engineer vs. medic vs. recon) or any role-driven HUD difference.

<img src=".gitbook/assets/image (293).png" alt="" title="Specific UI for props in prop hunt">

### **UI Extension Subsystem (`UUIExtensionSubsystem`).**&#x20;

The HUD declares **extension points**, tagged placeholders. Your Game Feature registers a widget against an extension point tag, the HUD slots it in. Unregister, and the widget disappears.

* **When to use:** **interchangeable per-mode widgets** without subclassing the HUD.
* **Example:** Domination's scoring panel and Capture-the-Flag's flag-status panel can both target the same extension point in the base HUD, neither mode needs its own HUD subclass.

<img src=".gitbook/assets/image (294).png" alt="" title="">

> [!WARNING]
> **Always store the handle returned when registering an extension.** You need it to unregister later. Lost handles mean leaked widgets, they keep showing up after the Game Feature unloads.
> 
> <img src="../../.gitbook/assets/image (295).png" alt="" data-size="original">

### **CommonUI layer push.**&#x20;

Push widgets onto layered stacks. Each layer is its own stack, pushing adds a widget on top, popping removes it, and the layers stack on each other for predictable z-ordering.

* **The five layers, lowest z-order to highest:**
  * `UI.Layer.Game` — the gameplay HUD
  * `UI.Layer.Game.Overlay` — overlays that sit above the HUD but below menus
  * `UI.Layer.GameMenu` — in-game menus that don't fully take over (e.g. inventory)
  * `UI.Layer.Menu` — full menus (settings, pause)
  * `UI.Layer.Modal` — top-most dialogs and confirmations
* **When to use:** menus, modals, pause screens, settings dialogs, anything the player navigates to and away from.
* **Constraint:** only works with `UCommonActivatableWidget` subclasses, not regular `UUserWidget`.

<img src=".gitbook/assets/image (296).png" alt="" title="">

***

## **Pick the right base class**

| Subclass                                                      | When to use                                                                                                                                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ULyraHUDWidget`                                              | A widget that's part of the persistent HUD, added via Path 1 or Path 2 above. The default for HUD elements.                                                                                    |
| `UCommonActivatableWidget`                                    | A widget that gets pushed and popped on a CommonUI layer (Path 4). Required for menus, modals, pause screens.                                                                                  |
| `ULyraTaggedWidget` (`Source/LyraGame/UI/LyraTaggedWidget.h`) | A widget whose visibility is driven by gameplay tags on the player. Useful for "hide on death," "show only while aiming," etc. Cross-cutting, combine with any of the four registration paths. |
| `UUserWidget`                                                 | Plain UMG widget. Right for scoreboards, resource bars, ticker entries, anything that doesn't need framework-specific behaviour. The worked example below uses this.                           |

The rule of thumb: **start with `UUserWidget` and only subclass something more specific when you need that subclass's specific behaviour.** Most HUD widgets don't need to be HUD widgets in the technical sense; they just need to render on the HUD.

***

## **Bind to live state without ticking**

The cardinal rule for HUD widgets in this framework: **don't tick to read state.** Update through events. Three event mechanisms cover almost every case:

* **Gameplay Messages.** A pub/sub system. The `UGameplayMessageSubsystem` lets a widget listen on a tag and react when something broadcasts on that tag. Best for **discrete events** (score changed, round timer ticked, kill happened). The worked example below uses this.
* **Attribute change callbacks (GAS).** When the value you care about lives in an `AttributeSet` (health, stamina, ammo), bind a delegate to the attribute's change event on the player's Ability System Component. Best for **GAS-owned numeric state**.
* **MVVM (Model-View-ViewModel).** A widget binds to a ViewModel, the ViewModel listens to the underlying system, the widget reflects the ViewModel automatically. Best for **complex container UIs** where multiple widgets share state and rendering logic. The framework ships MVVM examples for inventory and equipment, look at the inventory UIs in the **Tetris Inventory** plugin (`Plugins/GameFeatures/TetrisInventory/Content/UI/`) and **Battle Royale** plugin for two stylistically different takes (jigsaw / extraction-style vs. Apex-style). Both use MVVM specifically so the inventory rendering logic isn't duplicated across every widget that touches the inventory.

When in doubt: **start with Gameplay Messages**. They're the simplest event mechanism and cover most HUD-update scenarios.

***

## Common pitfalls

* **Forgetting to unregister the Gameplay Message listener on widget destruction.** The single most common mistake. Always pair `RegisterListener` in `OnInitialized` with `UnregisterListener` in `NativeDestruct`, using the stored handle. Skipped unregistrations leak references and crash later when the broadcast hits a destroyed widget.
* **Forgetting to store the UI Extension Subsystem handle.** Same pattern as above but for Path 3. If you register a widget with the `UUIExtensionSubsystem` and don't store the returned handle, you can't unregister, the widget stays alive after your Game Feature unloads.
* **Reading state on tick.** A widget that polls a game state value every frame is a sign you're using the wrong binding mechanism. Switch to Gameplay Messages, attribute callbacks, or MVVM.
* **Using `UUserWidget` where you needed `UCommonActivatableWidget`.** A widget pushed onto a CommonUI layer must be activatable. Plain `UUserWidget` won't work on Path 4, the widget won't appear in the widget dropdown class selector.
* **Tag mismatch between listener and broadcaster.** Gameplay Messages route by tag matches. If your listener uses `Game.Score.Changed` and your broadcaster uses `Game.Score.Updated`, nothing happens, and there's no error.

***

## Debug helpers

* **Slate Widget Reflector** — built-in UE tool, reachable through Window → Developer Tools → Widget Reflector (or the `WidgetReflector` console command). Lets you click on a widget on screen and see its class, hierarchy, and bindings. Useful when you can't tell why a widget is or isn't where you expect. Worth the time to learn even if you bounce off it the first try.
* **Gameplay Tag inspectors** — when a Gameplay Message listener doesn't fire, the tag itself is usually the suspect. UE's Gameplay Tag manager (Window → Gameplay Tags) lets you browse all registered tags and confirm yours exists / matches what you think it does.

***

## Extra

Two topics worth knowing about that the recipe above doesn't cover:

* **`ULyraTaggedWidget`** — for visibility driven by gameplay tags. Subclass it instead of `UUserWidget` when a widget should hide and show automatically based on tags on the player. e.g. hiding the HUD when the player is downed (`Status.Death.Dying`), The configuration lives in the header at `Source/LyraGame/UI/LyraTaggedWidget.h`.
* **MVVM** — for inventory, equipment, and other complex UIs where multiple widgets share state. Examples live under `Plugins/GameFeatures/TetrisInventory/Content/UI/` and in the Battle Royale plugin's UI folder. See [Item Containers UI MVVM](../../base-lyra-modified/ui/item-container-ui-system/core-architecture-and-data-structures/mvvm.md) for more info.

When you're ready for a different system, head back to the [Recipes](./).
