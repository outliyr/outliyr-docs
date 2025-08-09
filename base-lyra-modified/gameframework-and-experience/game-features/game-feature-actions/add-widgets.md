# Add Widgets

This Game Feature Action provides a data-driven way to add User Interface elements – specifically **HUD Layouts** (using `UCommonActivatableWidget`) and individual **Widgets** (`UUserWidget`) – to the player's screen when the associated Game Feature or Experience is activated. It integrates with Lyra's Common UI and UI Extension systems.

### Purpose

* **Modular HUD Construction:** Allows different Game Features or Experiences to contribute specific UI elements (like health bars, ammo counters, minimaps, objective markers, mode-specific displays) to the overall HUD without requiring a single monolithic HUD class.
* **Contextual UI:** Display UI elements only when they are relevant based on the active Experience (e.g., show Capture the Flag scores only during a CTF match).
* **Data-Driven UI:** Define which widgets appear and where they are placed using Data Assets (this action within an Experience/Action Set) rather than hardcoding widget creation in HUD Blueprints.
* **Leverages Common UI & UI Extensions:** Uses established Lyra/Common UI patterns for managing UI layers (`UCommonUIExtensions`) and inserting widgets into predefined slots (`UUIExtensionSubsystem`).

### Configuration

Add instances of this action to the `Actions` list within a `ULyraExperienceDefinition` or `ULyraExperienceActionSet`.

<img src=".gitbook/assets/image (122).png" alt="" title="Add_Widgets GameFeatureAction configuration">

* **`Layout` (`TArray<FLyraHUDLayoutRequest>`)**: Defines entire UI _layouts_ to be pushed onto the screen's layer stack.
  * **`FLyraHUDLayoutRequest`**:
    * `Layout Class` (`TSoftClassPtr<UCommonActivatableWidget>`): A soft reference to the Activatable Widget class representing the layout (e.g., `WBP_HUD_Layout_Default`). These layouts typically contain named slots for other widgets.
    * `Layer ID` (`FGameplayTag`, meta=(Categories="UI.Layer")): The Gameplay Tag identifying the UI layer where this layout should be added (e.g., `UI.Layer.Game`, `UI.Layer.HUD`). Common UI uses these tags to manage stacking and visibility.
* **`Widgets` (`TArray<FLyraHUDElementEntry>`)**: Defines individual widgets to be added into specific _slots_ provided by the active UI layouts or the base UI structure.
  * **`FLyraHUDElementEntry`**:
    * `Widget Class` (`TSoftClassPtr<UUserWidget>`): A soft reference to the specific `UUserWidget` class to spawn (e.g., `WBP_HealthBar`, `WBP_AmmoDisplay`, `WBP_Minimap`).
    * `Slot ID` (`FGameplayTag`): The Gameplay Tag identifying the **named slot** (defined within a layout widget or potentially registered globally by the UI framework) where this widget should be inserted. The `UUIExtensionSubsystem` uses these tags to manage widget placement.

_Example Configuration (in `ActionSet_StandardHUD`):_

* `Layout`:
  * `[0]`:
    * `Layout Class`: `WBP_HUD_Layout_StandardGame`
    * `Layer ID`: `UI.Layer.Game`
* `Widgets`:
  * `[0]`:
    * `Widget Class`: `WBP_HealthBar`
    * `Slot ID`: `HUD.Slot.HealthBar` (Assuming `WBP_HUD_Layout_StandardGame` has a slot named this)
  * `[1]`:
    * `Widget Class`: `WBP_AmmoDisplay`
    * `Slot ID`: `HUD.Slot.Ammo`
  * `[2]`:
    * `Widget Class`: `WBP_ReticleContainer` (_Might contain logic to query ReticleConfig fragment_)
    * `Slot ID`: `HUD.Slot.Reticle`

### Runtime Execution Flow

This action inherits from `UGameFeatureAction_WorldActionBase`.

1. **Activation (`OnGameFeatureActivating` -> `AddToWorld`):**
   * When the owning Game Feature/Experience activates, the action uses the `UGameFrameworkComponentManager` to register an extension handler for the `ALyraHUD` class.
2. **`HandleActorExtension` -> `AddWidgets`:**
   * When an `ALyraHUD` actor is added or becomes ready (`NAME_ExtensionAdded`, `NAME_GameActorReady`), `HandleActorExtension` is triggered for that HUD instance.
   * It calls `AddWidgets(HUD, ActiveData)`.
   * **Get Local Player:** `AddWidgets` gets the `ULocalPlayer` associated with the HUD's owning Player Controller.
   * **Push Layouts:** It iterates through the `Layout` array defined in the action. For each entry:
     * It loads the `LayoutClass`.
     * It calls `UCommonUIExtensions::PushContentToLayer_ForPlayer(LocalPlayer, LayerID, ConcreteWidgetClass)` to add the layout widget to the specified UI layer stack for the local player.
     * It stores a weak pointer to the added layout widget for later removal.
   * **Register Widgets:** It iterates through the `Widgets` array defined in the action. For each entry:
     * It gets the `UUIExtensionSubsystem`.
     * It calls `ExtensionSubsystem->RegisterExtensionAsWidgetForContext(SlotID, LocalPlayer, WidgetClass.Get(), Priority)` to register the desire to place the specified `WidgetClass` into the slot identified by `SlotID` for the given `LocalPlayer`. The subsystem handles the actual creation and insertion when the slot becomes available.
     * It stores the returned `FUIExtensionHandle` for later unregistration.
   * **Track Additions:** Stores the added layouts and extension handles in a map (`ActiveData.ActorData`) keyed by the `ALyraHUD` instance.
3. **Deactivation (`OnGameFeatureDeactivating` -> `Reset` -> `RemoveWidgets`):**
   * When the owning Game Feature/Experience deactivates, the `Reset` function is called.
   * `Reset` iterates through all HUDs this action previously added widgets to (`ActiveData.ActorData`) and calls `RemoveWidgets`.
   * `RemoveWidgets`:
     * Iterates through the stored `LayoutsAdded` weak pointers. If a layout widget is still valid, it calls `DeactivateWidget()` on it (Common UI will typically handle removing it from the layer).
     * Iterates through the stored `ExtensionHandles` and calls `Handle.Unregister()` on each. This tells the `UUIExtensionSubsystem` to remove the widget previously added via that handle.
     * Removes the HUD's entry from the internal tracking map.

### Use Cases

* **Defining Base HUD:** An `ActionSet_CoreGameplay` could add the fundamental HUD layout and essential elements like health/ammo that are present in most game modes.
* **Mode-Specific UI:** A `B_Experience_CTF` could use this action to add a flag status widget to a specific slot (`HUD.Slot.ObjectiveStatus`).
* **Optional Features:** A "Minimap" Game Feature could contain an action that adds the `WBP_Minimap` widget to the `HUD.Slot.Minimap`. Activating/deactivating the feature adds/removes the minimap.
* **Vehicle UI:** A "Vehicle" Game Feature could add a vehicle-specific HUD layout (`UI.Layer.VehicleHUD`) or add widgets like speedometers and fuel gauges to existing slots when the player enters a vehicle state (potentially triggered by other actions or gameplay events).

### Key Dependencies

* **Common UI Plugin:** Relies on the layer system (`UCommonUIExtensions`) for managing layouts.
* **UI Extension Subsystem:** Uses the `UUIExtensionSubsystem` and slot tags for placing individual widgets within layouts.
* **`ALyraHUD`:** Assumes the target HUD actor is derived from `ALyraHUD` or provides similar access to the Local Player and subsystems.

***

The `UGameFeatureAction_AddWidgets` action provides a flexible, data-driven way to construct the player's HUD dynamically based on the active Experience and Game Features. By leveraging Common UI layers and the UI Extension Subsystem, it allows for modular and context-sensitive UI composition.
