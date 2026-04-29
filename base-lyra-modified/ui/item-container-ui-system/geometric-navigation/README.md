# Geometric Navigation

**Controller-driven UI** navigation becomes significantly more complex in dynamic layouts.\
In a standard UMG setup, Unreal’s built-in directional navigation (Up, Down, Left, Right) works well for simple, static interfaces. However, this system breaks down once you introduce **floating windows**.

* What happens when windows overlap?
* What if one window sits slightly higher than another?
* How should navigation behave when moving from a grid in Window A to a slot in Window B?

Unreal’s default focus system does not account for these spatial relationships. To address this, we implemented custom navigation logic within the **Item Container Layer**.

***

## The Philosophy

Instead of relying on hardcoded tab-indices or explicit "Up/Down" links, this system "looks" at the screen. It treats your UI as a 2D map and calculates the best neighbor based on **Geometry**.

#### Why Built-in Navigation Fails

Imagine two windows side-by-side. The Inventory window is 10 pixels higher than the Chest window. If you press "Right," UMG's default logic might fail to find the neighbor because their centers don't align perfectly.

#### Why Geometric Navigation Wins

Our system uses a **spatial navigation algorithm.** It asks: _"If I am moving Right, which window's entry point is closest to my cursor's exit point, with a bonus for perpendicular alignment?"_ This makes navigation feel intuitive, "sticky," and professional.

***

## The Architecture

```mermaid
flowchart TB
    subgraph Input ["Input"]
        KB[Keyboard Arrows]
        GP[Gamepad D-Pad]
        SB[Shoulder Buttons LB/RB]
    end

    subgraph Window1 ["Window 1"]
        C1[Content Widget]
    end

    subgraph Window2 ["Window 2"]
        C2[Content Widget]
    end

    Layer[Item Container Layer]

    Input --> C1
    C1 -->|"Edge reached: Escape()"| Layer
    Layer -->|"FindWindowInDirection"| Window2
    Layer -->|"FocusWindow + RequestContentFocus"| C2
```

The system is built into the **ItemContainerLayer** which handles both internal content navigation and cross-window movement.

### The Layer as Navigation Controller

The `LyraItemContainerLayer` intercepts navigation events from its child windows. When a content widget reaches its edge and returns `FNavigationReply::Escape()`, the Layer catches this in `NativeOnNavigation` and decides where focus should go next.

***

## How Navigation Works

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Content Widget Navigation

Each content widget (list, tile view, tetris grid) handles its own internal navigation using UE's built-in focus system.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Edge Detection

When navigation reaches the edge of a content widget, it returns `FNavigationReply::Escape()`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Layer Interception

The Layer's `NativeOnNavigation` catches escaped navigation events.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Geometric Search

The Layer uses `FindWindowInDirection()` to find the best target window based on screen position.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Focus Transfer

The Layer defers focus to the next frame via a next-tick timer, then calls `FocusWindow()` which triggers `Shell->RequestContentFocus()` on the target.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Cursor Alignment

Navigation context (direction and cursor position) is passed to the target window so it can align its cursor appropriately.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Navigation Features

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### Cross-Window Edge Navigation

Press D-pad at the edge of a window to jump to the nearest window in that direction. The cursor position is preserved for natural alignment.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Window Cycling (Shoulder Buttons)

Press LB/RB to cycle left/right through open windows. This provides quick access without needing to navigate through intermediate windows.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Auto-Focus on Window Open

When a window opens, it automatically receives focus on its content widget, no manual focus management required.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Core Concepts

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### **The Window**&#x20;

A draggable shell containing a content widget. Windows track their screen geometry for navigation calculations.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### **The Content Widget**

The actual interactive content (ListView, TileView, Tetris Grid, etc.) that implements `ILyraItemContainerWindowContentInterface`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### **The Edge Hit**

When navigation tries to move beyond a content widget's boundaries and triggers `Escape()`.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### **Cursor Alignment**

The system that preserves cursor position when moving between windows.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Implementation Topics Covered

* [The Geometric Algorithm](geometric-algorithm.md)
  * Deep dive into `FindWindowInDirection`.
  * How we the algorithm handles distance, alignment, and overlap.
* [Cross-Window Navigation](cross-window-navigation.md)
  * How the Layer intercepts escaped navigation.
  * The deferred focus pattern and pending navigation context system.
* [Cursor Alignment](cursor-alignment.md)
  * Using `GetCursorScreenPosition` and `ReceiveNavigationEntry` to align cursors.
  * Screen coordinate translation between windows.
* [Window Cycling](window-cycling.md)
  * LB/RB shoulder button navigation.
  * Focus order tracking.
