# Quick Start

Start here if you want to use the item container UI before learning the full window/session architecture.

The shortest useful path is:

```
Window Host -> Window Shell -> Container Source -> GetOrCreateViewModel -> Bind Widget
```

For a standard inventory window that means:

```
LyraItemContainerWindowHost
  -> LyraItemContainerWindowShell
  -> FInventoryContainerSource
  -> Shell->GetOrCreateViewModel(Source)
  -> LyraInventoryViewModel bindings
```

## Read Order

1. [Minimum Path](minimum-path.md)
2. [Working Example](working-example.md)
3. [Blueprint ViewModel Cheat Sheet](blueprint-viewmodel-cheat-sheet.md)

After that, use the deeper architecture sections only when your game needs them:

* [Specialized Implementations](../data-layers-view-models/specialized-implementations.md) for how each ViewModel (inventory, equipment, attachment, tetris, world pickup) works and how to initialize it.
* Window sessions and dynamic reparenting for multi-window container UI.
* Geometric navigation for gamepad/controller movement across floating windows.
* Custom container sources when you add vendors, crafting stations, vehicles, or other non-standard containers.
