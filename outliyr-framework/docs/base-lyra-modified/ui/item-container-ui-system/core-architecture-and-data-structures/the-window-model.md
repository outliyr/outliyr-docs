# The Window Model

Why does this system use multiple draggable windows instead of one big inventory panel? This page explains the architectural decision and how it enables flexibility you can't get with a single-widget approach.

***

### The Single Panel Problem

Imagine a typical inventory scenario:

> Player opens their inventory, then opens a chest, then inspects the attachments on their gun, then opens a vendor shop.

With a single-panel approach, you need:

* One mega-widget that handles all these cases
* Complex state machines for what's currently visible
* Hardcoded layouts that can't adapt
* Navigation logic that varies by context

```mermaid
flowchart TB
    subgraph SinglePanel ["Single Panel Approach"]
        SP[Mega Inventory Widget]
        SP --> S1[Player Inventory Section]
        SP --> S2[Chest Section - maybe visible?]
        SP --> S3[Attachment Section - context dependent]
        SP --> S4[Vendor Section - different layout entirely]
    end
```

**The result**: A 3,000-line widget class that's terrifying to modify.

***

### The Window Solution

Instead, each container gets its own window. Windows can be:

* Opened and closed independently
* Dragged and repositioned
* Focused and navigated between
* Styled differently per container type

```mermaid
flowchart TB
    subgraph WindowApproach ["Window Approach"]
        Layer[Item Container Layer]
        Layer --> W1[Player Inventory Window]
        Layer --> W2[Chest Window]
        Layer --> W3[Gun Attachments Window]
        Layer --> W4[Vendor Window]
    end
```

**Each window is simple** because it only handles one container. The complexity is distributed.

***

### Window Architecture

```mermaid
flowchart TB
    subgraph Layer ["LyraItemContainerLayer"]
        direction TB
        Canvas[Canvas Panel]
        Focus[Focus & Z-Order]
        Nav[Cross-Window Navigation]
    end

    subgraph Windows ["Windows on Canvas"]
        W1[Window Shell 1]
        W2[Window Shell 2]
        W3[Window Shell 3]
    end

    subgraph Shell ["Inside a Window Shell"]
        Chrome[Title Bar + Close Button]
        Content[Content Widget]
    end

    Layer --> Canvas
    Canvas --> W1
    Canvas --> W2
    Canvas --> W3
    W1 --> Shell
```

#### Key Components

| Component                                                                           | Role                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [**`LyraItemContainerLayer`**](../the-windowing-system/the-item-container-layer.md) | The canvas that hosts all windows. Manages window creation, dragging, z-order, focus, and cross-window navigation.       |
| [**`LyraItemContainerWindowShell`**](../the-windowing-system/the-window-shell.md)   | The window frame, title bar, close button, drag handle. Contains a content widget.                                       |
| **Content Widget**                                                                  | The actual container display (list panel, tile panel, or custom). Implements `ILyraItemContainerWindowContentInterface`. |

***

### The UI Manager: Conductor of the Orchestra

`ULyraItemContainerUIManager` orchestrates the data side of the system:

```mermaid
flowchart TB
    UIM[UI Manager]
    UIM --> VM[ViewModel Cache]
    UIM --> Sessions[Session Management]
    UIM --> Events[Window Events]

    subgraph VMCache ["ViewModel Cache"]
        VM1[Inventory VM]
        VM2[Equipment VM]
        VM3[Attachment VM]
    end

    subgraph SessionMgmt ["Sessions"]
        S1[Base Session]
        S2[Child Session: Chest]
        S3[Child Session: Attachments]
    end

    VM --> VMCache
    Sessions --> SessionMgmt
```

#### What the UI Manager Does

{% stepper %}
{% step %}
#### Creates and caches ViewModels

One `ViewModel` per container, reused across windows.
{% endstep %}

{% step %}
#### Manages sessions

Groups related windows together.
{% endstep %}

{% step %}
#### Handles lifecycle events

Item destroyed? Close its attachment window.
{% endstep %}

{% step %}
#### Provides shared `ViewModels`

`InteractionViewModel` for drag/drop is shared.
{% endstep %}
{% endstepper %}

***

### Sessions: Grouping Related Windows

A **session** is a logical grouping of windows that belong together. When the session closes, all its windows close.

```mermaid
flowchart TB
    subgraph BaseSession ["Base Session (Player's UI)"]
        W1[Player Inventory]
        W2[Player Equipment]
    end

    subgraph ChildSession1 ["Child Session (External Container)"]
        W3[Chest Contents]
    end

    subgraph ChildSession2 ["Child Session (Item Inspection)"]
        W4[Gun Attachments]
        W5[Scope Attachments]
    end

    BaseSession --> ChildSession1
    BaseSession --> ChildSession2
```

**Use cases:**

| Session Type                  | Contains                        | Closes When                                |
| ----------------------------- | ------------------------------- | ------------------------------------------ |
| **Base Session**              | Player inventory, equipment     | Player closes inventory UI                 |
| **Child Session (Container)** | Chest, vendor, crafting station | Player moves away, container closes        |
| **Child Session (Item)**      | Attachment windows for an item  | Item is destroyed, moved, or parent closes |

***

### Window Lifecycle

#### Opening a Window

```cpp
// Request to open a window
FLyraWindowOpenRequest Request;
Request.WindowType = WindowTypeTag;           // Tag identifying content widget class
Request.SourceDesc = ContainerSource;         // Polymorphic container source
Request.SessionHandle = ParentSession;        // Which session to add to
Request.Placement = EWindowPlacement::Auto;   // Where to put it

UIManager->RequestOpenWindow(Request);
```

{% stepper %}
{% step %}
UI Manager creates (or reuses) a ViewModel for the container.
{% endstep %}

{% step %}
Layer creates the window shell.
{% endstep %}

{% step %}
Layer creates the content widget.
{% endstep %}

{% step %}
Shell calls `SetContainerSource` on content with the ViewModel.
{% endstep %}

{% step %}
Layer registers window and focuses it.
{% endstep %}
{% endstepper %}

#### Closing a Window

Windows can close:

* **Manually** — User clicks close button
* **Session close** — Parent session closes
* **Item destruction** — Item tracked by window is destroyed
* **Access revoked** — Player moves away from chest

```mermaid
sequenceDiagram
    participant User
    participant Window
    participant Layer
    participant UIManager
    participant ViewModel

    User->>Window: Click close
    Window->>Layer: RequestCloseWindow
    Layer->>UIManager: NotifyWindowClosed
    Layer->>Window: Destroy widget
    UIManager->>ViewModel: ReleaseViewModel (refcount--)
    Note over ViewModel: If refcount == 0, VM cleaned up
```

***

### Cross-Window Navigation

Players can navigate between windows using keyboard/gamepad. The Layer intercepts navigation that escapes from a window and transfers focus to a neighboring window.

```mermaid
flowchart LR
    subgraph Win1 ["Inventory Window"]
        C1[Content Widget]
    end

    subgraph Win2 ["Equipment Window"]
        C2[Content Widget]
    end

    C1 -->|"Right at edge"| C2
    C2 -->|"Left at edge"| C1
```

#### How It Works

{% stepper %}
{% step %}
Content widget reaches navigation edge (e.g., pressing Right at rightmost item).
{% endstep %}

{% step %}
Content returns `FNavigationReply::Escape()` to signal edge reached.
{% endstep %}

{% step %}
Layer's `NativeOnNavigation` intercepts the escaped navigation.
{% endstep %}

{% step %}
Layer uses `FindWindowInDirection` with geometric scoring to find neighbor.
{% endstep %}

{% step %}
Layer stores pending navigation context (direction and cursor position).
{% endstep %}

{% step %}
Layer focuses the target window, which calls `ReceiveNavigationEntry` on content.
{% endstep %}
{% endstepper %}

```cpp
// Layer finds geometric neighbors
FItemWindowHandle FindWindowInDirection(
    FItemWindowHandle FromWindow,
    EUINavigation Direction,
    FVector2D CursorScreenPos
);
```

{% hint style="info" %}
**Why geometry-based?** Because windows can be dragged anywhere. The system doesn't assume a fixed layout, it calculates neighbors based on actual screen positions.
{% endhint %}

***

### Summary

```mermaid
flowchart TB
    subgraph Summary ["Window Model Summary"]
        L[Layer hosts windows & handles navigation]
        S[Shells provide chrome]
        C[Content displays container]
        M[Manager orchestrates data lifecycle]
    end
```

* **Layer** (`LyraItemContainerLayer`)
  * Canvas hosting windows, focus management, z-order, cross-window navigation
* **Shell** (`LyraItemContainerWindowShell`)
  * Window frame with drag, close, title
* **Content**
  * Container-specific display widget implementing `ILyraItemContainerWindowContentInterface`
* **Manager** (`LyraItemContainerUIManager`)
  * ViewModel factory, session manager, lifecycle handler

***
