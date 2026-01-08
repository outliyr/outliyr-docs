# Customization & Advanced Topics

This section explores more advanced ways to customize Lyra's UI Indicator System, discusses performance considerations, and offers ideas for deeper integration with other game systems.

***

### **Extending `UIndicatorDescriptor`**

While the base `UIndicatorDescriptor` provides a rich set of properties, you might encounter scenarios where your indicator UMG widget needs to access more specific data or trigger custom logic on the game object it represents.

* **Using `DataObject` for Rich Interaction and Custom Data:**
  * The `DataObject` property (`UObject*`) on `UIndicatorDescriptor` is a powerful way to link your indicator UMG widget directly to the underlying game entity or a dedicated data payload. This allows the widget to query data or even send messages back to the game object.
  * **Common Pattern: The `DataObject` is the Game Entity Itself (e.g., an Actor):**
    1. **Define an Interface (Optional but Recommended for Decoupling):**
       * Create a Blueprint Interface (e.g., `BPI_IndicatorDataSource`) with functions that your UMG widget might need to call on the `DataObject`. Examples: `GetDisplayName()`, `GetCurrentHealth()`, `GetInteractionPromptText()`, or even event-like functions like `NotifyIndicatorClicked()`.
    2. **Implement the Interface:** The Actor class (or other `UObject` class) that will serve as the `DataObject` should implement this interface and provide logic for its functions. For instance, an "Objective" actor might implement `BPI_IndicatorDataSource` to return its current status or name.
    3.  **Set the `DataObject`:** When creating the `UIndicatorDescriptor`, set the instance of your Actor (or other relevant `UObject`) as the `DataObject`.

        ```c++
        // In C++ when setting up the descriptor
        MyObjectiveActor* Objective = /* ... get your objective actor ... */;
        IndicatorDescriptor->SetDataObject(Objective); 
        ```

        ```blueprint
        // In Blueprint
        // Assuming 'MyObjectiveActor' is a variable holding your objective actor instance
        NewDescriptor -> Set Data Object (DataObject: MyObjectiveActor)
        ```
    4.  **Interact from the UMG Widget:**

        * In your UMG widget's `Event Bind Indicator`, get the `DataObject` from the `UIndicatorDescriptor`.
        * Attempt to call interface messages on this `DataObject`. If the object implements the interface, the messages will be executed.
        * You can also cast the `DataObject` to its known class if you need to access properties or functions not exposed via an interface, though using interfaces promotes better decoupling.

        ```cpp
        // In WBP_MyIndicator's Event Bind Indicator
        Set MyIndicatorDescriptor (From Event Parameter)
        LocalDataObject = MyIndicatorDescriptor -> GetDataObject

        if (IsValid(LocalDataObject)) {
            // Option 1: Using an Interface (Preferred for decoupling)
            // Assuming BPI_IndicatorDataSource has a function 'GetIndicatorDisplayName'
            if (LocalDataObject -> DoesImplementInterface (BPI_IndicatorDataSource)) {
                DisplayName = BPI_IndicatorDataSource::GetIndicatorDisplayName (Target: LocalDataObject)
                MyTextBlock_Name -> SetText (DisplayName)
            }

            // Option 2: Direct Casting (If you know the specific type and need direct access)
            // MyObjectiveActorReference = Cast To MyObjectiveActor (Object: LocalDataObject)
            // if (IsValid(MyObjectiveActorReference)) {
            //    SomeValue = MyObjectiveActorReference.ObjectiveSpecificProperty
            // }
        }
        ```
    5. **Benefits:** Allows the UMG widget to directly query live game state from the relevant actor or send events back to it without hard-coding dependencies on specific actor classes in the widget (if using interfaces). The game entity remains the source of truth for its data.
  * **Alternative Pattern: The `DataObject` is a Dedicated Data Payload `UObject`:**
    1. Create a custom `UObject` C++ class or Blueprint (e.g., `MyIndicatorDataPayload`) specifically designed to hold all the static or snapshot data your indicator widget needs.
    2. When creating the `UIndicatorDescriptor`, instantiate this payload object, populate it with the necessary data, and then assign it via `SetDataObject()`.
    3. In your UMG widget's `Event Bind Indicator`, get the `DataObject`, cast it to `MyIndicatorDataPayload`, and then access its properties.
    4. **Benefits:** Useful when the data for the indicator is a snapshot at the time of creation or doesn't need to be live from an actor. Can be simpler if you don't need two-way communication or interface calls.
  * **Key Idea:** The `DataObject` is flexible. It can be the actual game world entity (like an Actor) that the indicator represents, allowing for rich, dynamic interaction through interfaces, or it can be a more passive UObject just carrying data. The choice depends on the needs of your specific indicator.
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

