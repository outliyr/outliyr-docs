# The Item Container Layer



***

## The Container Layer (`ULyraItemContainerLayer`)

The Container Layer is the visual root of the entire windowing system. It is a `CommonActivatableWidget` that you push onto your UI stack (usually as part of your HUD).

While the **Window Manager** subsystem calculates _logic_ (like Z-order and neighbor windows), it has no way to actually draw anything. The Layer is the **Orchestrator**: it listens to the managers and performs the actual work of spawning widgets and moving them on the screen.

### 1. The Spawning Registry (`GetContentWidgetClass`)

When an ability or another window requests a new window via a **Gameplay Tag**, the Layer acts as a lookup table. It needs to know which Blueprint widget matches that tag.

#### Implementation

In your Blueprint subclass (e.g., `W_ItemContainerLayer`), you must override **`GetContentWidgetClassForWindowType`**.

* **Input:** A Gameplay Tag (e.g., `UI.Window.Inventory.Backpack`).
* **Output:** A Widget Class (e.g., `W_BackpackContent`).

<figure><img src="../../../../.gitbook/assets/image (19).png" alt=""><figcaption></figcaption></figure>

{% hint style="info" %}
**Design Tip:** Using Gameplay Tags for routing allows you to swap your entire UI look-and-feel just by changing the return values in this function, without touching any C++ logic or Ability code.
{% endhint %}

This separation is powerful because your C++ code only ever talks about Tags. You can completely swap the visual style of your inventory by changing the return values in this Blueprint function, without ever touching a line of code.

### 2. Initializing the HUD (`SpawnMandatoryWindows`)

When the Inventory UI is first activated, the screen is empty. The Layer is responsible for the "Boot Sequence."

Immediately after activation, the UI Manager triggers the **`SpawnMandatoryWindows`** event. You should override this in Blueprint to define your "Home" UI layout.

**Standard Sequence:**

1. Define an `FItemWindowSpec`.
2. Set the `WindowType` to `UI.Window.Inventory`.
3. Set `bCanUserClose` to `false` (to keep the main inventory pinned).
4. Call `UIManager->RequestOpenWindow(Spec)`.

<figure><img src="../../../../.gitbook/assets/image (20).png" alt=""><figcaption><p>Spawning the inventory and equipment widgets</p></figcaption></figure>

### 3. Visual Execution (The "Muscle")

The Layer carries out the orders given by the Subsystems.

#### Executing Z-Order

The **Window Manager** calculates which window should be on top. It fires an event saying: _"Window A is now index 5."_ The **Layer** catches this event and performs the UMG work:

```cpp
void ULyraItemContainerLayer::HandleWindowZOrderChanged(FGuid WindowId, int32 NewZOrder)
{
    // Find the UCanvasPanelSlot for this specific window
    UCanvasPanelSlot* CanvasSlot = WindowSlots.FindRef(WindowId);
    if (CanvasSlot)
    {
        // Actually change the rendering order in UMG
        CanvasSlot->SetZOrder(NewZOrder);
    }
}
```

#### Auto-Placement Logic

When a window opens without a specific position, the Layer calls **`CalculateAutoPosition`**.

* **Default Behavior:** It uses a "Cascade" algorithm (shifting each new window slightly down and to the right).
* **Override:** You can override this in Blueprint to create specialized layouts (e.g., "Always snap loot containers to the left half of the screen").

### 4. The Backdrop (Input Dismissal)

Since the Layer is a root-level widget covering the screen, it acts as a "Catch-All" for mouse clicks.

The system is pre-programmed to listen for clicks on the "empty space" behind windows. When you click the background, the Layer automatically calls **`UIManager->DismissActivePopup()`**. This ensures that context menus (Action Menus) or Quantity Prompts close gracefully when the user clicks away, matching standard PC desktop behavior.

### Summary for Developers

To get the windowing system running, you must:

1. **Subclass** `ULyraItemContainerLayer` in Blueprint.
2. **Bind** your `WindowCanvas` (a Canvas Panel) in the widget designer.
3. **Implement** the Tag-to-Class mapping in `GetContentWidgetClassForWindowType`.
4. **Define** your default layout in `SpawnMandatoryWindows`.
