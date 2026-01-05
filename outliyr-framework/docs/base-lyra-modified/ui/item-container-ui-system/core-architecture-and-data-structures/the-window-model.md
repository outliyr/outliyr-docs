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
    end

    subgraph Windows ["Windows on Canvas"]
        W1[Window Shell 1]
        W2[Window Shell 2]
        W3[Window Shell 3]
    end

    subgraph Shell ["Inside a Window Shell"]
        Chrome[Title Bar + Close Button]
        Content[Content Widget]
        Router[Navigation Router]
    end

    Layer --> Canvas
    Canvas --> W1
    Canvas --> W2
    Canvas --> W3
    W1 --> Shell
```

#### Key Components

| Component                        | Role                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **LyraItemContainerLayer**       | The canvas that hosts all windows. An activatable widget that manages window creation, dragging, and z-order.            |
| **LyraItemContainerWindowShell** | The window frame—title bar, close button, drag handle. Contains a content widget.                                        |
| **Content Widget**               | The actual container display (list panel, tile panel, or custom). Implements `ILyraItemContainerWindowContentInterface`. |
| **LyraNavigationRouter**         | Per-window navigation handler. Routes keyboard/gamepad input to the right panel.                                         |

***

### The UI Manager: Conductor of the Orchestra

`ULyraItemContainerUIManager` orchestrates the whole system:

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
Creates and caches ViewModels — One ViewModel per container, reused across windows.
{% endstep %}

{% step %}
Manages sessions — Groups related windows together.
{% endstep %}

{% step %}
Handles lifecycle events — Item destroyed? Close its attachment window.
{% endstep %}

{% step %}
Provides shared ViewModels — `InteractionViewModel` for drag/drop is shared.
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
Creates the window shell.
{% endstep %}

{% step %}
Creates the content widget.
{% endstep %}

{% step %}
Initializes content with ViewModel.
{% endstep %}

{% step %}
Registers with window manager for navigation.
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
    participant UIManager
    participant ViewModel

    User->>Window: Click close
    Window->>UIManager: RequestCloseWindow
    UIManager->>Window: Destroy widget
    UIManager->>ViewModel: ReleaseViewModel (refcount--)
    Note over ViewModel: If refcount == 0, VM cleaned up
```

***

### Cross-Window Navigation

Players can navigate between windows using keyboard/gamepad:

```mermaid
flowchart LR
    subgraph Win1 ["Inventory Window"]
        P1[List Panel]
    end

    subgraph Win2 ["Equipment Window"]
        P2[Slot Panel]
    end

    P1 -->|"Right at edge"| P2
    P2 -->|"Left at edge"| P1
```

#### How It Works

{% stepper %}
{% step %}
Panel reaches navigation edge (e.g., pressing Right at rightmost item).
{% endstep %}

{% step %}
Panel broadcasts `OnEdgeReached` to its router.
{% endstep %}

{% step %}
Router checks for neighbor panel in same window.
{% endstep %}

{% step %}
If none, asks `WindowManager` for neighbor window.
{% endstep %}

{% step %}
WindowManager uses screen geometry to find adjacent window.
{% endstep %}

{% step %}
Focus transfers to that window's appropriate panel.
{% endstep %}
{% endstepper %}

```cpp
// Window Manager finds geometric neighbors
ULyraItemContainerWindowShell* FindNeighborWindow(
    ULyraItemContainerWindowShell* FromWindow,
    EUINavigation Direction
);
```

{% hint style="info" %}
**Why geometry-based?** Because windows can be dragged anywhere. The system doesn't assume a fixed layout, it calculates neighbors based on actual screen positions.
{% endhint %}

***

### Why This Design?

| Benefit           | How Windows Enable It                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| **Flexibility**   | Add/remove windows dynamically for any container                       |
| **Reusability**   | Same window shell for inventory, equipment, attachments, vendors       |
| **Navigation**    | Unified cross-window navigation without hardcoding                     |
| **Sessions**      | Clean lifecycle management, close a session, close all related windows |
| **Extensibility** | New container type? Just create new content widget                     |

***

### Summary

```mermaid
flowchart TB
    subgraph Summary ["Window Model Summary"]
        L[Layer hosts windows]
        S[Shells provide chrome]
        C[Content displays container]
        R[Routers handle navigation]
        M[Manager orchestrates everything]
    end
```

* **Layer** (`LyraItemContainerLayer`) — Canvas hosting windows
* **Shell** (`LyraItemContainerWindowShell`) — Window frame with drag, close, title
* **Content** — Container-specific display widget
* **Router** (`LyraNavigationRouter`) — Per-window keyboard/gamepad navigation
* **Manager** (`LyraItemContainerUIManager`) — ViewModel factory, session manager, lifecycle handler

***
