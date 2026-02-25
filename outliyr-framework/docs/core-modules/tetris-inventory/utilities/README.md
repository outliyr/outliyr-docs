# Tetris Utilities

You have an L-shaped item that needs to rotate 90 degrees, snap to a grid, and generate a masked icon texture, all before the player finishes their drag. You could write that logic inline every time, or you could reach for a set of tested utility functions that already handle the math, the edge cases, and the Blueprint exposure.

The Tetris Inventory plugin ships several utility libraries and data structures designed for exactly these situations. They cover grid manipulation, shape calculations, UI interactions, and the data types that tie the spatial inventory system together.

***

### Why Utilities Exist

These helpers serve four goals:

* **Simplify complex tasks.** Pre-built functions handle shape rotation, coordinate lookups, bounding box calculations, and masked texture generation so you don't reimplement them per-feature.
* **Encapsulate logic.** Common calculations and data structures live in one place, making them reusable across Blueprints and C++ classes.
* **Improve readability.** Named functions like `RotateShape` or `GetCellBorders` communicate intent far better than raw index arithmetic scattered across your project.
* **Standardize data.** Shared structs for shapes, layouts, navigation hints, and found cells keep every system speaking the same language.

***

### What's Included

{% stepper %}
{% step %}
#### [Data Types (`TetrisInventoryDataLibrary`)](data-types.md)

Fundamental enums and structs used throughout the Tetris system, rotation enum, the boolean/integer row helpers, , inventory layout definitions (`FInventoryLayoutCreator`), the drag-context bundle , starting item configuration, and the gamepad navigation hint.
{% endstep %}

{% step %}
#### [Tetris Utility Library (`UTetrisUtilityLibrary`)](tetris-utility-library.md)

A Blueprint Function Library focused on **shape manipulation, coordinate transformations, and UI-related calculations** for the Tetris grid. Rotate shapes, calculate bounding boxes, generate masked icon materials, determine cell borders, convert coordinates during rotation, and more.
{% endstep %}

{% step %}
#### [Item Utility Library (`UItemUtilityLibrary`)](item-utility-library.md)

A Blueprint Function Library with general-purpose item utilities, currently focused on `GetRandomPointsInSplineArea` for procedural item spawning within spline-defined zones. Useful for loot distribution, scatter spawning, and any scenario where you need random world positions inside an arbitrary boundary.
{% endstep %}
{% endstepper %}

Spend a few minutes browsing these pages before building new features. More often than not, the function you need already exists.
