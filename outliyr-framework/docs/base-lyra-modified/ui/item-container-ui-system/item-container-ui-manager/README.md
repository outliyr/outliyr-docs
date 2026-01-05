# The Item Container UI Manager

The `ULyraItemContainerUIManager` is the primary entry point for any developer interacting with the inventory UI. It exists as a `LocalPlayerSubsystem`, meaning there is exactly one instance per local player.

Its primary responsibility is to act as the **Source of Truth** for all active container data.

### Why Do We Need a Manager?

In naive implementations, a widget often creates its own ViewModel:

```cpp
// Bad Implementation
void UMyInventoryWidget::NativeConstruct() {
    MyViewModel = NewObject<UInventoryViewModel>(this);
    MyViewModel->Init(InventoryComponent);
}
```

**The Problem:**

1. **Duplication:** If you have an Inventory Window open AND a Crafting Window that shows your inventory, you now have two ViewModels processing the same data twice.
2. **State Desync:** If the Inventory Window selects an item, the Crafting Window doesn't know about it.
3. **Memory Leaks:** If the widget is removed but the ViewModel is still bound to a global delegate, it stays in memory forever.

**The Solution:** The UI Manager holds a centralized **Cache**. Widgets request access ("Acquire") and return access ("Release").

### Core Responsibilities

The UI Manager handles three critical systems, which are detailed in the sub-pages below.

#### 1. The Lease System (Memory Management)

This is the "Smart Pointer" logic for ViewModels. It ensures that if five different widgets need the Inventory, only _one_ ViewModel is created and shared. When the last widget closes, the ViewModel is destroyed.

#### 2. Session Management

Windows rarely exist in isolation.

* Opening a Chest creates a **Session**.
* Inspecting an Item inside that Chest creates a **Child Session**.
* Closing the Chest must automatically close the Inspection window.

The Manager maintains this tree structure (`FItemWindowSession`), ensuring that UI flow remains logical and preventing "orphaned" windows from cluttering the screen.

#### 3. Lifecycle Tracking & Security

In a multiplayer game, the state of the world changes constantly.

* What happens if the player walks away from a chest?
* What happens if the item they are inspecting is destroyed by another player?
* What happens if the server revokes access rights?

The Manager listens to the Gameplay Message Subsystem (`Lyra.Item.Message.*`) and acts as the "Enforcer," forcibly closing sessions when their underlying data becomes invalid.

### Integration Point

If you are writing a custom C++ widget, you will interact with this manager to get your data:

```cpp
void UMyCustomWidget::SetSource(const FInstancedStruct& Source)
{
    ULyraItemContainerUIManager* Manager = GetLocalPlayer()->GetSubsystem<ULyraItemContainerUIManager>();
    
    // 1. Get the shared ViewModel
    MyViewModel = Manager->AcquireViewModel(Source);
    
    // 2. Bind to it
    // ...
}

void UMyCustomWidget::NativeDestruct()
{
    // 3. Return it when done
    if (MyViewModel)
    {
        GetManager()->ReleaseViewModel(Source);
    }
}
```

{% hint style="info" %}
_If you use the provided `LyraItemContainerWindowShell`, this Acquire/Release logic is handled for you automatically._
{% endhint %}
