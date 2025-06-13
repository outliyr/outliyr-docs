# Practical Usage & How-To Guides

This section provides practical examples and step-by-step guides to help you effectively use and customize Lyra's UI Indicator System within your project.

***

### **Prerequisite: Adding the `UIndicatorLayer` to Your HUD**

Before any indicators can be displayed, you must add the `UIndicatorLayer` UMG widget to your main game HUD or relevant UI layout. This layer is responsible for hosting the `SActorCanvas` which handles the actual rendering and management of all indicator widgets.

* **How to Add:**
  1. Open your primary HUD UMG Blueprint.
  2. From the UMG Palette, search for `Indicator Layer` and drag it onto your design canvas.
* **Sizing and Placement:**
  * Typically, the `UIndicatorLayer` should be configured to take up the **entire screen**. This is because indicators are projected onto the player's viewport, and the `IndicatorLayer` defines the bounds within which these projections are drawn. You can achieve this by anchoring it to all sides (fill) within a `Canvas Panel` or by ensuring it's sized appropriately within its parent container.
  * If you have a specific design where all indicators should be constrained to a smaller, specific portion of the screen (e.g., a mini-map overlay area that also shows world indicators), you _could_ size the `IndicatorLayer` to match that specific area. However, be aware that this will clip any indicators that would naturally project outside these bounds.
* **Customizing the Default Clamp Arrow:**
  * The `UIndicatorLayer` has a default property for the `ArrowBrush`. This is the `FSlateBrush` used for the arrow that appears when an indicator is clamped to the screen edge and its `UIndicatorDescriptor` has `bShowClampToScreenArrow` set to true.
  * You can select your `IndicatorLayer` instance in the UMG editor and change this `ArrowBrush` in its "Details" panel to use a custom arrow image that fits your game's art style.

**Once the `UIndicatorLayer` is correctly set up in your HUD, the system will be ready to display indicators.**

***

### **Creating a New Indicator Type (Step-by-Step)**

Let's walk through the process of creating a new type of indicator, for example, a simple "Quest Marker" indicator.

1. **Design the UMG Widget (Visual Representation):**
   * Create a new UMG `UserWidget` Blueprint (e.g., `W_QuestIndicator`).
   * **Implement the Interface:** In the "Class Settings" of your new UMG widget, under the "Interfaces" section, add the `IndicatorWidgetInterface` interface.
   * **Design Visuals:** Add elements like an `Image` for an icon, a `TextBlock` for a name or distance, etc.
   * **Implement Interface Functions:**
     *   **`Event Bind Indicator`:**

         * This event receives the `Indicator Descriptor` as a parameter.
         * **Store References:** Promote the `Indicator Descriptor` to a variable in your widget Blueprint for later access.
         * **Access Data Object (Optional):** If you plan to use the `DataObject` on the descriptor, get it, cast it to your expected custom data type (e.g., `B_QuestData`), and store it as well.
         * **Initialize Visuals:** Use the data from the `Indicator Descriptor` (or its `DataObject`) to set up your widget's initial appearance. For example, set the icon image, bind text to a property from the `DataObject`, etc.

         <img src=".gitbook/assets/image (29).png" alt="" width="563" title="Example of WBP_QuestIndicator bind indicator">
     * **`Event Unbind Indicator`:**
       * Clear any references you stored (e.g., set `QuestIndicatorDescriptor` variable to null). Perform any other necessary cleanup.
     *   **`Event On Indicator Clamped`:**

         * This event receives a boolean `bIsClamped`.
         * You can change the widget's appearance based on this. For example, hide certain details or show a different icon when clamped.

         <img src=".gitbook/assets/image (1) (1) (1) (1).png" alt="" width="563" title="Example of changing widget apperance based on clamping">
     *   **`Event On Indicator Display Mode Changed`:**

         * Receives `IsScreenLocked` boolean.
         * Adjust visuals or behavior if the indicator switches between 3D world tracking and 2D screen-locked mode. For instance, a screen-locked indicator might always be a simple icon, while a 3D one shows distance.

         <img src=".gitbook/assets/image (3) (1) (1) (1).png" alt="" title="Domination objective marker handling display mode changes">
2. **Define How to Spawn and Register the Indicator (C++ or Blueprint):**
   * Decide where and when this indicator should be created (e.g., when a quest becomes active, when an enemy spawns). This logic will typically reside in an Actor, ActorComponent, Gameplay Ability, or a global system.
   * **Get the Indicator Manager:**
     * Obtain a reference to the player's `ULyraIndicatorManagerComponent`. In Blueprint, use the `Get Indicator Manager Component` node (from `UIndicatorLibrary`) with the `PlayerController` as input. In C++, use `ULyraIndicatorManagerComponent::GetComponent(PlayerController)`.
   * **Create and Configure the `UIndicatorDescriptor`:**
     * **Create Instance:** Spawn a new `UIndicatorDescriptor` object. In C++, use `NewObject<UIndicatorDescriptor>(ManagerComponent)`. In Blueprint, you can use the `Construct Object from Class` node, ensuring its "Outer" is set to the owner of the indicator.
     * **Set Target:**
       * `Set Scene Component`: Assign the `USceneComponent` of the actor/object you want to track (e.g., the root component of a quest objective actor).
       * `Set Component Socket Name` (Optional): If tracking a specific socket.
     * **Set Widget Class:**
       * `Set Indicator Class`: Select your newly created UMG widget (e.g., `WBP_QuestIndicator`).
     * **Configure Projection & Behavior:**
       * `Set Projection Mode`: Choose an appropriate `EActorCanvasProjectionMode` (e.g., `ActorBoundingBox` for a quest actor, `ComponentPoint` for a precise location).
       * `Set Clamp To Screen`: `true` if you want it to stick to screen edges.
       * `Set Show Clamp To Screen Arrow`: `true` if you want the arrow when clamped.
       * `Set HAlign / Set VAlign`: Adjust alignment as needed.
       * `Set World Position Offset / Set Screen Space Offset`: Fine-tune positioning.
       * `Set Priority`: If needed for sorting against other indicators.
       * `Set Data Object` (Optional): If your widget needs custom data, create an object (e.g., a `UObject` implementing a `BPI_QuestDataInterface` that holds quest details) and assign it here.
     * **Set Lifetime:**
       * `Set Auto Remove When Indicator Component Is Null`: Often useful to set to `true`.
   * **Add to Manager:**
     * Call `Add Indicator` on the `ULyraIndicatorManagerComponent`, passing in your configured `UIndicatorDescriptor`.
   *   **Example Blueprint Snippet of setting creating an indicator for the kill confirmed dog tag:**

       <img src=".gitbook/assets/image (2) (1) (1) (1).png" alt="" title="">
3. **Removing the Indicator:**
   * When the indicator is no longer needed (e.g., quest completed):
     * If you stored a reference to the `UIndicatorDescriptor`, call `Unregister Indicator` on it.
     * Alternatively, if you have the `IndicatorManagerComponent` and the `Descriptor` reference, call `Remove Indicator` on the manager.
     * If `bAutoRemoveWhenIndicatorComponentIsNull` was true and the target component/actor is destroyed, it will be removed automatically.

***

### **Common Scenarios & Configurations**

* **Indicator for an Off-Screen Enemy:**
  * **Target:** Enemy's `CapsuleComponent` or a specific socket.
  * **Widget Class:** An enemy icon widget.
  * **Projection Mode:** `ComponentPoint` or `ActorBoundingBox`.
  * **Clamping:** `bClampToScreen = true`, `bShowClampToScreenArrow = true`.
  * **Widget Logic:** `OnIndicatorClamped` might change the icon's color or show a "threat" chevron.
* **A "Ping" Style Temporary Screen-Locked Indicator:**
  * **Target:** Can be null or a dummy component if the ping location is purely 2D. If it's a 3D world ping that transitions to 2D, set a 3D target initially.
  * **Widget Class:** A simple "ping" animation or icon.
  * **Initial Setup (if starting from 3D):**
    * Configure as a normal 3D indicator targeting the ping location.
  * **Switching to 2D:**
    * Call `SwitchTo2DMode()` on the `UIndicatorDescriptor`.
    * Call `SetScreenLockedPosition()` on the descriptor with the desired normalized screen coordinates (e.g., calculated from a mouse click or world-to-screen projection at the moment of pinging).
  * **Projection Mode (when in 2D):** Automatically set to `ScreenLocked` by `SwitchTo2DMode()`.
  * **Lifetime:** Likely use a timer to call `UnregisterIndicator()` after a few seconds.
* **Attaching to a Specific Socket on a Skeletal Mesh:**
  * **Target:** The `SkeletalMeshComponent`.
  * **`Set Component Socket Name`:** Provide the name of the socket (e.g., "headSocket").
  * **Projection Mode:** `ComponentPoint` (will use the socket location).
* **Dynamic Objective Indicator (e.g., Domination Control Point):**
  * This scenario illustrates an indicator that normally tracks a 3D world location but temporarily switches to a fixed 2D screen position when the player interacts with or enters a specific zone related to the objective.
  * **Initial Setup (Objective in the World):**
    * **Target:** A `SceneComponent` at the center of the Domination Control Point actor.
    * **Widget Class:** A UMG widget designed to show objective status (e.g., `WBP_ControlPointIndicator` showing capture progress, faction icon).
    * **Projection Mode:** `ComponentPoint` or `ActorBoundingBox`.
    * **Clamping/Arrow:** Likely `bClampToScreen = true` and `bShowClampToScreenArrow = true` so players can find it when far away.
    * The `UIndicatorDescriptor` is created and added to the manager as usual.
  * **Player Enters Control Point Zone (Transition to 2D Screen-Locked):**
    * When game logic detects the player has entered the control point's capture area (e.g., via an overlap volume):
      1. Retrieve the `UIndicatorDescriptor` associated with this control point.
      2. Call `SetScreenLockedPosition()` on the descriptor, providing normalized screen coordinates for where the indicator should now sit (e.g., `FVector2D(0.5f, 0.1f)` for top-center of the screen).
      3. Call `SwitchTo2DMode()` on the descriptor. This will:
         * Store its current 3D ProjectionMode (e.g., ComponentPoint) in `OriginalProjectionMode`.
         * Change its `ProjectionMode` to `EActorCanvasProjectionMode::ScreenLocked`.
         * Notify the bound UMG widget via `IIndicatorWidgetInterface::OnIndicatorDisplayModeChanged(true)`.
    * The UMG widget (`WBP_ControlPointIndicator`) can then react to `OnIndicatorDisplayModeChanged(true)` by:
      * Perhaps changing its appearance (e.g., becoming larger, showing more detailed capture progress, removing distance text as it's no longer relevant).
      * Ensuring it's visually appropriate for a fixed screen position.
  * **Player Exits Control Point Zone (Transition back to 3D World-Tracking):**
    * When game logic detects the player has left the control point's capture area:
      1. Retrieve the UIndicatorDescriptor.
      2. Call `SwitchTo3DMode()` on the descriptor. This will:
         * Restore its ProjectionMode from `OriginalProjectionMode`.
         * Notify the bound UMG widget via `IIndicatorWidgetInterface::OnIndicatorDisplayModeChanged(false)`.
    * The UMG widget then reacts to `OnIndicatorDisplayModeChanged(false)` by reverting to its 3D world-tracking appearance (e.g., potentially showing distance again, becoming smaller).
  * **Benefits of this approach:**
    * Reduces UI clutter and potential distraction when the player is actively engaged at the objective location by moving the indicator to a less obtrusive, fixed screen position.
    * Still provides essential objective information directly on screen.
    * Seamlessly transitions back to world-tracking when the player moves away.

***

### **Debugging and Inspecting Indicators**

* **Unreal's Widget Reflector:**
  * Access via `Shift+F1` then click the arrow icon, or from the main menu: Tools -> Debug -> Widget Reflector.
  * Hover over your indicators on screen to see their UMG widget hierarchy, properties, and the underlying Slate structure (`SActorCanvas`, `SBox` for the UMG host, etc.). This is invaluable for checking alignment, visibility, and widget properties.
* **Visual Log / Gameplay Debugger:**
  * You can extend the Gameplay Debugger or use the Visual Logger to draw debug information related to indicators:
    * Draw a sphere at the `SceneComponent`'s location.
    * If using bounding box projection, draw the actual bounding box being used.
    * Draw a line from the camera to the projected screen point.
* **Print Strings / Breakpoints:**
  * In `UIndicatorDescriptor` functions (like `SwitchTo2DMode`), `SActorCanvas::UpdateCanvas` / `OnArrangeChildren`, or your UMG widget's interface events, add print strings or breakpoints to trace the flow of execution and inspect variable values.
  * Check the screen coordinates being calculated in `FIndicatorProjection::Project` or `SActorCanvas::UpdateCanvas`.
* **Check `SActorCanvas` Children:**
  * In the debugger, inspect the `CanvasChildren` array within `SActorCanvas` to see if your indicator's slot is present and its properties (`ScreenPosition`, `bIsIndicatorVisible`, etc.) are as expected.
* **Verify `ULyraIndicatorManagerComponent`:**
  * Ensure the manager component is valid on your controller and that your `UIndicatorDescriptor` is present in its `Indicators` array after calling `AddIndicator`.
