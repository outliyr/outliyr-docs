# Customization & Advanced Topics

This section explores more advanced ways to customize Lyra's UI Indicator System, discusses performance considerations, and offers ideas for deeper integration with other game systems.

***

### **Extending `UIndicatorDescriptor`**

While the base `UIndicatorDescriptor` provides a rich set of properties, you might encounter scenarios where you need to store additional, indicator-specific data or logic.

* **Using `DataObject` for Custom Data:**
  * The simplest way to associate custom data is by using the `DataObject` property (`UObject*`) on `UIndicatorDescriptor`.
  * **Process:**
    1. Create a new `UObject` C++ class or Blueprint (derived from `UObject`). This class will hold your custom data fields (e.g., `QuestID`, `EnemyThreatLevel`, `InteractionType`).
    2. Optionally, create a Blueprint Interface (e.g., `BPI_IndicatorCustomData`) that your custom data object class implements. This allows your UMG widget to interact with the data object via interface calls without needing to cast to a specific concrete class.
    3. When creating and configuring your `UIndicatorDescriptor`, also create an instance of your custom data object and assign it using `SetDataObject()`.
    4. In your UMG widget's `BindIndicator` event, get the `DataObject` from the `UIndicatorDescriptor`, cast it to your custom class or interface, and store/use it.
  * **Benefits:** Keeps `UIndicatorDescriptor` clean, good for purely data-centric extensions.
* **Subclassing `UIndicatorDescriptor` (C++):**
  * For more complex behavior or if you need to add new functions directly to the descriptor itself, you can create a C++ subclass of `UIndicatorDescriptor`.
  * **Process:**
    1. Create a new C++ class inheriting from `UIndicatorDescriptor`.
    2. Add your new properties and functions to this subclass.
    3. When creating indicators, instantiate your subclass instead of the base `UIndicatorDescriptor`.
    4. Your UMG widget, in `BindIndicator`, can then cast the received `UIndicatorDescriptor` to your subclass to access the extended functionality.
  * **Considerations:** This approach is more involved and should be used when the `DataObject` method isn't sufficient, particularly if the new functionality is tightly coupled with the descriptor's core identity.

**Modifying Projection Behavior (`FIndicatorProjection`)**

The `FIndicatorProjection::Project` method contains the core logic for translating 3D world positions to 2D screen coordinates.

* **Understanding the Existing Logic:** Before making changes, thoroughly understand how each `EActorCanvasProjectionMode` is currently implemented. Pay attention to how it handles targets behind the camera and its interaction with screen bounds.
* **Adding New Projection Modes:**
  1. Add a new entry to the `EActorCanvasProjectionMode` enum.
  2. In `FIndicatorProjection::Project`, add a new `case` to the `switch` statement for your new mode.
  3. Implement the custom projection logic. This might involve new ways of interpreting the target component, custom math for screen positioning, or unique handling of depth.
* **Modifying Existing Modes:**
  * Carefully consider the implications. Changes here will affect all indicators using that projection mode.
  * For example, you might want to change how bounding box anchors are interpreted or how off-screen targets are handled before clamping.
* **Performance:** Projection calculations happen frequently for visible indicators. Ensure any new or modified logic is performant. Avoid overly complex calculations or expensive operations within the `Project` method.

***

### **Performance Considerations**

While the system is designed with performance in mind (e.g., widget pooling), several factors can impact its performance, especially with many indicators:

* **Number of Active Indicators:** The most direct impact. Each active (even if not currently visible due to `bVisible=false` on descriptor) indicator adds some overhead in `SActorCanvas`'s update loop for checking visibility and auto-removal. Each _visible_ indicator undergoes projection and layout calculations.
  * **Mitigation:** Only add indicators when necessary. Remove them promptly when they are no longer needed. Use `bAutoRemoveWhenIndicatorComponentIsNull` judiciously.
* **UMG Widget Complexity:**
  * Complex UMG widgets with many elements, heavy `Tick` logic, or frequent updates can be costly.
  * **Mitigation:**
    * Keep indicator UMGs as simple as possible.
    * Avoid using `Tick` in UMG widgets if updates can be event-driven (e.g., via `BindIndicator` or custom events from your `DataObject`).
    * Optimize UMG widget textures and materials.
* **`FUserWidgetPool` (in `SActorCanvas`):**
  * This pool significantly helps by reusing UMG widget instances, avoiding repeated construction/destruction costs. The system handles this automatically.
* **`bDrawIndicatorWidgetsInOrder` (on `UIndicatorLayer`):**
  * When `false` (default), Slate can batch draw calls for similar widgets, improving rendering performance.
  * Setting this to `true` forces Slate to draw widgets strictly in their sorted order, which can break batching and increase draw calls. Only enable it if strict draw order is absolutely critical and you've identified Z-fighting or ordering issues that cannot be solved by `Priority` and depth sorting alone.
* **Projection Mode Complexity:**
  * Simpler modes like `ComponentPoint` are generally faster than bounding box modes, which require more calculations.
  * **Mitigation:** Use the simplest projection mode that meets your needs.
* **Frequency of Updates:**
  * `SActorCanvas` updates via an active timer. The default interval (0) means it runs every frame. If extreme performance is needed for a very high number of indicators and updates don't need to be per-frame, one could theoretically modify the timer registration, but this is an advanced and potentially risky change.

By thinking about these integration points, you can make the UI Indicator System a deeply embedded and highly informative part of your game's user experience.

