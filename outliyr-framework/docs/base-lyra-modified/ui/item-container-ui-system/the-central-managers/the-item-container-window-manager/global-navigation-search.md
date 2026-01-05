# Global Navigation Search

In a standard UMG grid, navigation is easy. But in a desktop-like environment with free-floating windows, finding the "Next" window is a complex geometric problem.

If you are at the right edge of your Inventory, and you press **Right**, where should the cursor go?

### The Geometric Neighbor Algorithm

The function `FindGeometricNeighborWindow(SourceId, Direction)` performs a global search across all registered windows to find the best candidate.

#### The Algorithm Steps

1. **Filter:** Ignore self and invalid windows.
2. **Direction Check:** Is the candidate actually in the direction we are pressing?
   * _Right:_ `Candidate.Left >= Source.Right`
   * _Down:_ `Candidate.Top >= Source.Bottom`
3. **Score Calculation:** We calculate a "Cost" for moving to that window. Lower is better.

#### The Scoring Formula

We prioritize **Closeness** and **Alignment**.

```cpp
float Score = Distance - (Overlap * 0.5f);
```

* **Distance:** The gap in pixels between the edges. We want the closest window.
* **Overlap:** How much of the window "lines up" with us perpendicularly?
  * If moving Right, we check vertical overlap.
  * A window that is perfectly side-by-side gets a score bonus (negative cost).
  * A window that is nearby but offset vertically gets a smaller bonus.

**Penalty for Non-Overlap:** If a window is nearby but doesn't overlap at all (e.g., diagonally adjacent), we add a heavy penalty based on the perpendicular distance. This prevents "corner jumps" that feel unnatural to players.

### Smart Panel Selection

Once we find the target **Window**, we need to find the target **Panel** inside it. A window might contain an "Inventory Grid," a "Filter Bar," and a "Sort Button."

We don't just dump the cursor at the top-left. We ask: _"Which panel is closest to where the player entered?"_

```cpp
// In FindNeighborWindow
TArray<FNavigationPanelHandle> Panels = NeighborRouter->GetRegisteredPanels();

// Heuristic:
if (Direction == Right)
{
    // Find the panel with the smallest 'Left' coordinate 
    // (i.e., the one on the left edge of the window)
}
```

This ensures that if you navigate Right into a window, you land on the **Leftmost** element of that window, preserving the feeling of continuous movement.

### Integration with Router

This logic is triggered automatically by the `LyraNavigationRouter`.

```cpp
// Inside LyraNavigationRouter::HandleEdgeHit
bool bCrossWindowFound = false;

// 1. Ask Window Manager for a neighbor
ULyraNavigationRouter* NeighborRouter = WindowManager->FindNeighborWindow(
    WindowId, Direction, TargetPanelType);

if (NeighborRouter)
{
    // 2. Fire cross-window event
    OnCrossWindowNavigationRequested.Broadcast(..., NeighborRouter->GetWindowId(), ...);
    return true;
}
```

This architecture means individual windows don't need to know about each other. They just know "I hit an edge," and the Window Manager acts as the bridge to the rest of the UI.
