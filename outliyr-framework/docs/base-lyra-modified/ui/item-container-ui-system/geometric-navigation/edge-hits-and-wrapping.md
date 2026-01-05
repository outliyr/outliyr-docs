# Edge Hits & Wrapping

What happens when you press **Right**, but there is nothing to the right?

In a standard UI, the cursor just stops. This feels "dead." In a modern console game, you often want one of three behaviors:

1. **Stop:** The edge is a hard boundary.
2. **Wrap:** The cursor jumps to the far left of the current window.
3. **Cross:** The cursor jumps to a completely different window.

This page explains how the Router handles the "End of the Road."

### The Edge Hit Event

When you navigate, the Router first performs its Geometric Search. If `FindGeometricNeighbor` returns no result, the Router declares an **Edge Hit**.

This triggers the `HandleEdgeHit` function, which checks the current **Wrap Mode**.

### Wrap Modes (`ENavigationWrapMode`)

You can configure the Wrap Mode directly on the `ULyraNavigationRouter` (usually in your Window Shell blueprint).

| Mode                 | Behavior                                                                         | Use Case                                     |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| **None**             | Stop at the edge. Do nothing.                                                    | Simple dialogs; "Are you sure?" popups.      |
| **WithinWindow**     | Jump to the furthest panel in the opposite direction _inside this window_.       | Simple tab lists; Hotbars.                   |
| **CrossWindow**      | Ignore local wrapping; try to find a neighbor window immediately.                | Desktop-style UI where windows are adjacent. |
| **AfterCrossWindow** | **(Default)** Try to find a neighbor window first. If none exists, wrap locally. | The most flexible option; feels "smart."     |

### The Wrap Algorithm

Wrapping isn't just about index math (0 -> N). It is geometric.

When wrapping **Right**, the Router searches for the **Furthest Panel** to the **Left**.

```cpp
// If moving Right, and no neighbor found:
// Search Direction = Left
// Score = Maximize Distance (instead of minimizing it)
```

This ensures that if you have a complex layout (e.g., a header with 3 buttons and a grid with 5 columns), wrapping correctly finds the "start" of the visual row you are currently on, rather than blindly jumping to Index 0.

### Direction Hints

When a wrap occurs, we have a problem: **Entry Direction.**

* If you press **Right** to wrap, you physically enter the target panel from the **Right** side of the screen (because you teleported).
* However, visually, you want it to feel like you entered from the **Left** (cycling around).

The Router handles this by injecting a `FNavigationDirectionHint`.

1. **User Input:** Right.
2. **Wrap Action:** Find furthest Left panel.
3. **Hint Injection:** "Tell the target panel that the user pressed **Right**, even though we are entering from the Left side."

This allows the target panel (like a Grid) to place the cursor on its first column, preserving the "Cycle" illusion.

### Cross-Window Handoff

If the Wrap Mode allows it, the Router delegates to the **Window Manager**.

1. **Local Fail:** Router finds no local neighbor.
2. **Escalation:** Router calls `WindowManager->FindNeighborWindow`.
3. **Global Search:** Window Manager looks at the desktop geometry.
4. **Handoff:** If a window is found, the Router fires `OnCrossWindowNavigationRequested`, and focus leaves the current window entirely.

This layered approach (Local -> Global -> Wrap) creates a navigation flow that feels fluid and unbroken, regardless of how messy your window layout becomes.
