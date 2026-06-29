# Working Example

The fastest way to learn the system is to open a shipped UI and modify it, rather than wiring one up from the low-level APIs. The asset ships two complete examples you can copy and reskin.

The two examples sit at opposite ends of the spectrum, which is the fastest way to see what is core versus optional.

**Windowed UI (TetrisInventory plugin).** The full windowing system, and the example the rest of these docs describe. It uses the advanced pieces: a window host, draggable window shells, multiple windows, geometric cross-window navigation, sessions, and dynamic reparenting.

* `WBP_ItemContainerWindowHost` — the host you push onto your HUD. Its `ContentWidgetClasses` and `SpawnStartupWindows` are where the UI is configured.
* `WBP_ItemContainerWindowShell` — the draggable window chrome (title bar, close button, drag handle, content slot).
* `WBP_TetrisInventoryGrid`, `WBP_TetrisGridClump`, `WBP_TetrisInventoryItem` — the grid content, clump, and item widgets.
* `WBP_EquipmentPanel` / `WBP_EquipmentSlot` and `WBP_AttachmentPanel` / `WBP_AttachmentSlot` — tagged-slot content for equipment and attachments.

**Static inventory (BattleRoyale plugin).** A single-screen inventory that binds the same ViewModels directly, without the windowing system at all: no window host, no window shells, no geometric navigation, no dynamic reparenting. Follow this one when your game has a fixed inventory screen rather than draggable windows. It is the "ViewModels without a window shell" path, covered in ViewModels Without a Window Shell.

* `WBP_InventoryScreen_BR`, `WBP_InventoryGrid_BR`, `WBP_InventoryCell_BR`, `WBP_WeaponSlot_BR`, and `WBP_LootQuickSwap`.

The ViewModel bindings are identical across both; only the windowing layer differs. Start from whichever matches your game.

## Start Here

Open `WBP_ItemContainerWindowHost` first and look at two things:

1. **`ContentWidgetClasses`** — the array mapping each window type tag to the content widget spawned for it. This is how the host knows which widget to create for "inventory", "equipment", and so on.
2. **`SpawnStartupWindows`** — the event that lays out the home UI. The host runs it automatically when it activates.

Together these are the whole entry point: the host activates, runs `SpawnStartupWindows`, and each window pulls its content class from `ContentWidgetClasses`.

## How To Modify It

Change visuals first, structure last:

1. Restyle the item and cell widgets (`WBP_TetrisInventoryItem`, `WBP_InventoryCell_BR`). Rebind their visuals to `Icon`, `DisplayName`, `StackCount`, `bIsGhost`, and `bIsFocused` as needed. See the [Blueprint ViewModel Cheat Sheet](blueprint-viewmodel-cheat-sheet.md).
2. Restyle the window shell, or remove chrome your game does not need.
3. Swap or restyle the content widgets per window type by editing `ContentWidgetClasses`.
4. Only then change source descriptors, sessions, or what `SpawnStartupWindows` opens.

## When To Use Advanced Pieces

* **Child sessions** — for a UI element with its own bounded lifetime, such as a loot preview or vendor window.
* **Dynamic reparenting** — when a window follows an item whose location can change, such as inspecting a backpack that moves between containers.
* **Geometric navigation** — when players need gamepad navigation across multiple floating windows.
* **A custom container source** — when the UI needs to show a new backend container type, such as a vendor, crafting bench, vehicle trunk, or storage actor.
