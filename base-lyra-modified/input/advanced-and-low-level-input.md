# Advanced & Low-Level Input

While the majority of input handling in Lyra flows through the data-driven configurations of `InputMappingContexts`, `InputActions`, `ULyraInputConfig`, and Gameplay Abilities, there are scenarios where developers might need to interact with the input system at a more fundamental level or understand specialized components.

Lyra includes a custom player input class, **`ULyraPlayerInput`**, which inherits from `UEnhancedPlayerInput`. `UEnhancedPlayerInput` itself is the runtime class responsible for processing input for a local player when using the Enhanced Input system. By creating a custom subclass, Lyra gains the ability to inject specific low-level input processing logic or integrate with other systems directly at the point where input is first evaluated.

**Purpose and Role of `ULyraPlayerInput`**

The primary reasons for Lyra to have its own `ULyraPlayerInput` subclass are:

1. **Custom Input Event Processing:** It allows overriding core functions like `InputKey()` to perform additional actions whenever any key event is processed, before or after the standard Enhanced Input logic.
2. **Integration with Other Systems:** It can serve as a hook point to communicate input events to other specialized systems that might not be directly part of the standard Enhanced Input or Gameplay Ability System flow.
3. **Project-Specific Low-Level Input Logic:** If your project requires unique, low-level input handling that doesn't fit neatly into the higher-level abstractions, this is a potential place to implement it.

In Lyra's current implementation, the most prominent feature demonstrated in `ULyraPlayerInput` is its integration with **latency marker tracking**.

**Key Features and Implementation in Lyra:**

* **Inheritance:** `ULyraPlayerInput` : `UEnhancedPlayerInput` : `UPlayerInput`.
*   **Configuration:** The project must be configured to use this custom player input class. This is typically done in `DefaultEngine.ini` or a platform-specific INI file:

    ```ini
    [/Script/Engine.PlayerInput]
    !PlayerInputClass=ClearArray
    PlayerInputClass=/Script/LyraGame.LyraPlayerInput
    ```

    (Or `/Script/YourModuleName.YourPlayerInput` if you further subclass it).
* **Latency Marker Integration (`ProcessInputEventForLatencyMarker`, `HandleLatencyMarkerSettingChanged`):**
  * **`InputKey(const FInputKeyEventArgs& Params)` Override:** This virtual function is called by the engine for every input key event (press, release, axis change, etc.). `ULyraPlayerInput` overrides this to:
    1. Call `Super::InputKey(Params)` to ensure all standard Enhanced Input processing occurs.
    2. Then, call `ProcessInputEventForLatencyMarker(Params)`.
  * **`ProcessInputEventForLatencyMarker(const FInputKeyEventArgs& Params)`:**
    * Checks if the `bShouldTriggerLatencyFlash` flag is true (this flag is controlled by a user setting: `ULyraSettingsLocal::GetEnableLatencyFlashIndicators()`).
    * If true, and if the specific input event is `EKeys::LeftMouseButton` being pressed, it interacts with any registered `ILatencyMarkerModule` instances.
    * It calls `LatencyMarkerModule->SetCustomLatencyMarker(7, GFrameCounter)` to trigger a latency flash/marker. This is often used with NVIDIA Reflex or similar technologies to measure click-to-photon latency.
  * **Settings Integration (`BindToLatencyMarkerSettingChange`, `HandleLatencyMarkerSettingChanged`):**
    * The constructor of `ULyraPlayerInput` binds to the `ULyraSettingsLocal::OnLatencyFlashInidicatorSettingsChangedEvent()`.
    * When this setting changes, `HandleLatencyMarkerSettingChanged()` is called, which updates the `bShouldTriggerLatencyFlash` flag and enables/disables the flash indicator on the latency marker modules accordingly.

**When to Consider Modifying or Extending `ULyraPlayerInput`:**

While direct modification of `ULyraPlayerInput` should be approached with caution due to its fundamental role, you might consider extending it or examining its pattern if you need to:

* **Implement Custom Low-Level Input Logging/Debugging:** Intercept `InputKey` to log specific input events for debugging purposes.
* **Integrate with a Third-Party Input SDK:** If you're using a specialized input device or SDK that requires direct event handling, `InputKey` could be a place to forward those events.
* **Global Input Pre-Processing:** If you need to globally alter or consume certain input events before Enhanced Input even sees them (though this is generally discouraged in favor of Enhanced Input's own Modifiers and consumption mechanisms).
* **Platform-Specific Input Adjustments:** For very specific, low-level adjustments required only on certain platforms that cannot be handled by higher-level systems.

For most common input tasks, such as defining actions, remapping keys, or triggering abilities, you will interact with the higher-level systems like `InputMappingContexts`, `ULyraInputConfig`, and Gameplay Abilities, rather than directly modifying `ULyraPlayerInput`. However, understanding its existence and purpose is valuable for a complete picture of Lyra's input pipeline.

***

The `ULyraPlayerInput` class demonstrates how Lyra can tap into the earliest stages of input processing for specialized tasks like latency marker integration. While developers will spend most of their time working with higher-level input abstractions, knowing this component exists provides insight into the full depth of the input system. Having explored the theory, configuration, and customization options, we'll next move to practical guides, showing how to apply this knowledge to common development scenarios.

***
