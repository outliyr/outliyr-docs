# The Window Shell

The Shell (`ULyraItemContainerWindowShell`) is the standardized frame that wraps every content widget. If you look at Windows or macOS, every application has the same bar at the top with "Minimize/Maximize/Close." The Shell is that bar.

By centralizing this logic, we ensure consistent behavior: drag physics, focus rules, and cleanup logic are defined in one place.

### Core Responsibilities

#### 1. The Lease Handshake (Automatic Memory Management)

The most critical job of the Shell is managing data lifecycle. You should not call `UIManager->ReleaseViewModel` manually in your content widgets. The Shell does it for you.

* **Acquire:** When the window opens, the Shell calls `AcquireViewModelLease(Source)`. It stores this lease in an internal list.
* **Release:** When the window closes (User clicks 'X', session ends, or game quits), `NativeDestruct` runs. The Shell iterates its list and calls `ReleaseViewModel`.

This creates a safety net. Even if a developer writes a buggy inventory grid that crashes, the Shell ensures the underlying data connection is cleaned up cleanly.

> [!WARNING]
> This is only for widgets that are inside shell windows. You should call `GetOwningWindowShell->AcquireView` . In widgets that are not windows call `UIManager->AcquireViewModel`

#### 2. Focus & Z-Order

When a user clicks on the Shell (or any part of your content), the Shell catches the `OnMouseButtonDown` event. It calls `BringToFront()`, which notifies the Layer and Window Manager. This ensures the window pops to the top of the stack visually.

#### 3. Dragging Logic

The Shell implements the "Physical" movement.

* **Start:** When you click the Drag Handle, it captures the mouse.
* **Update:** It calculates the delta mouse movement and tells the Layer to update the Canvas Slot.
* **End:** Release mouse capture.

### Blueprint Setup

The C++ class `ULyraItemContainerWindowShell` is abstract logic. You must subclass it in Blueprint (`W_WindowShell`) to give it visuals.

The code looks for specific widgets by name (using `BindWidgetOptional`).

| Widget Name     | Type         | Purpose                                                                    |
| --------------- | ------------ | -------------------------------------------------------------------------- |
| **TitleText**   | `TextBlock`  | Displays the window title (e.g., "Backpack").                              |
| **CloseButton** | `Button`     | Triggers the `RequestClose` logic. Hidden if `bCanUserClose` is false.     |
| **DragHandle**  | `UserWidget` | The "Hit Box" for dragging. Usually the background image of the title bar. |
| **ContentSlot** | `NamedSlot`  | **Crucial.** This is where your Widget will be injected at runtime.        |

#### Visual Feedback Events

The Shell exposes Blueprint events so you can add animations without touching C++.

* `OnDragStarted`: Fade opacity to 0.8?
* `OnDragEnded`: Restore opacity?
* `OnWindowFocused`: Highlight the border color?
* `OnWindowUnfocused`: Dim the border?

### Customizing the Shell

You can create custom shell subclasses for different window styles:

```cpp
UCLASS()
class UMyMinimalWindowShell : public ULyraItemContainerWindowShell
{
    // No title bar, just content with thin border
    // Override visual setup in NativeConstruct
};
```

### Integration Example

If you want to open a window manually from C++ code (bypassing the UIManager/Layer logic, e.g., for testing):

```cpp
// 1. Create Shell
auto* Shell = CreateWidget<ULyraItemContainerWindowShell>(Player, ShellClass);

// 2. Init
FItemWindowSpec Spec;
Spec.Title = FText::FromString("Test Window");
Shell->InitializeWindow(Spec, Layer);

// 3. Create Content
auto* Content = CreateWidget<UUserWidget>(Player, MyInventoryClass);

// 4. Inject
Shell->SetContent(Content); // Calls SetContainerSource on Content automatically
```

> [!INFO]
> _In 99% of cases, you should use `UIManager->RequestOpenWindow`, which handles all of this boilerplate for you._
