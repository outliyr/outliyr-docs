# Configuring Input

Understanding the flow of input is essential, but equally important is knowing where and how to configure all the interconnected pieces. Lyra's input system heavily relies on Data Assets for its setup, promoting a data-driven and modular approach. Furthermore, Game Feature Plugins play a significant role in dynamically adding or modifying input configurations based on the active gameplay context (Experience).

This page will guide you through the key Data Assets and Game Feature Actions involved in configuring player input.

**Core Data Assets for Input Configuration:**

1. **`UInputMappingContext` (IMC) & `UInputAction` (IA):**
   * **Recap:** As discussed in "The Enhanced Input Layer," IMCs map hardware inputs to IAs, and IAs represent abstract player actions.
   * **Configuration:** These are created and edited directly in the Unreal Editor's Content Browser.
     * **IMCs:** Define key-to-IA mappings, priorities, and can include Triggers/Modifiers per mapping.
     * **IAs:** Define the action's name and its Value Type (Bool, Axis1D, etc.).
   * **Your Role:** You will create these assets to define the fundamental vocabulary of your game's inputs (e.g., `IA_Interact`, `IA_OpenInventory`) and how they are triggered by default hardware inputs (e.g., `'E' key` -> `IA_Interact` in `IMC_Default_KBM`).
2. **ULyraInputConfig:**
   * **Recap:** As detailed in "Lyra's Bridge," this Data Asset maps Input Actions to GameplayTags.
   * **Configuration:**
     * Create `ULyraInputConfig` assets in the Content Browser (Right-click > Miscellaneous > Data Asset, then select `LyraInputConfig`).
     * Edit the `NativeInputActions` and `AbilityInputActions` arrays within the asset, assigning your UInputAction assets and the corresponding `FGameplayTags` they should map to (e.g., map `IA_Jump` to `InputTag.Ability.Jump`).
   * **Your Role:** You'll create these to define how Lyra interprets the generic Input Actions. For example, one `ULyraInputConfig` might be `InputConfig_StandardCharacter`, another `InputConfig_VehicleDriver`.

The following sub-pages delve into how these core assets are then utilized and brought into the active game environment.
