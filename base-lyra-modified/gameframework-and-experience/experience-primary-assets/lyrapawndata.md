# LyraPawnData

The `ULyraPawnData` is a **Primary Data Asset** that serves as a comprehensive configuration bundle defining a specific **type or archetype of controllable Pawn**. It consolidates all the necessary references and settings needed to spawn and initialize a Pawn with its intended class, abilities, input scheme, camera behavior, and associated HUD elements.

### Role and Purpose

* **Define Pawn Archetypes:** Create distinct Pawn types (e.g., "Standard Soldier", "Heavy Tank", "Agile Scout", "Vehicle Driver") as reusable Data Assets.
* **Centralized Configuration:** Group all essential Pawn setup data into a single asset, making it easy to manage and assign.
* **Data-Driven Spawning:** Allows the `ALyraGameMode` (via the loaded Experience or Player State) to spawn and configure Pawns based purely on this data asset, without needing complex conditional logic in the spawning code.
* **Decoupling:** Decouples the specific configuration of a Pawn type from the Pawn's C++ or Blueprint class itself. Multiple ULyraPawnData assets could potentially use the same base PawnClass but grant different abilities or input configs.

### Creation

Create Pawn Data assets in the Unreal Editor:

1. **Content Browser:** Navigate to a suitable folder in your game feeature plugin (e.g., Content/Hero,  Content/Game/Hero).
2. **Right-Click:** Right-click in the empty space.
3. **Miscellaneous:** Select Data Asset.
4. **Choose Class:** Search for and select LyraPawnData as the parent class.
5. **Name Asset:** Give it a descriptive name, often prefixed with `HeroData_` (e.g., `HeroData_StandardSoldier`, `HeroData_Medic`).

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/create_pawn_data.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Create Pawn Data
{% endfile %}

### Key Properties

Configure these properties within the Pawn Data asset's Details panel:

<img src=".gitbook/assets/image (110).png" alt="" title="HeroData_ShooterBase PawnData">

1. **Pawn Class (`TSubclassOf<APawn>`)**:
   * **Crucial:** Specifies the actual APawn (or more likely, ACharacter) derived class that should be instantiated when spawning a Pawn using this data (e.g., `BP_LyraCharacter_Default`, `BP_Vehicle_Tank`).
2. **Ability Sets (`TArray<TObjectPtr<ULyraAbilitySet>>`)**:
   * A list of `ULyraAbilitySet` assets to grant to the Pawn's Ability System Component (ASC) upon initialization. This is a primary way Pawns receive their core gameplay abilities (movement, interaction, passive effects).
3. **Layout (`TArray<FPawnHUDLayoutRequest>`)**:
   * Defines HUD Layout widgets (`UCommonActivatableWidget` subclasses) to be pushed onto specific UI Layers (`FGameplayTag`) when a Pawn configured with this data is possessed by a local player. This is handled by the `ULyraHeroComponent` reading this data.
   * (Struct defined in `ULyraPawnData`):
     * **`LayoutClass`**: The layout widget class.
     * **`LayerID:`** The target UI layer tag.
4. **Widgets (`TArray<FPawnHUDElementEntry>`)**:
   * Defines individual HUD Widgets (`UUserWidget` subclasses) to be added to specific named slots (`FGameplayTag`) within the UI layout(s). Managed via the `UUIExtensionSubsystem`. This is also handled by the `ULyraHeroComponent`.
   * (Struct defined in `ULyraPawnData`):
     * `WidgetClass`: The widget class to add.
     * `SlotID`: The target slot tag.
5. **Tag Relationship Mapping (`TObjectPtr<ULyraAbilityTagRelationshipMapping>`)**:
   * An optional data asset that defines relationships between Gameplay Tags, often used by abilities to determine blocking, canceling, or activation rules (e.g., "Sprinting blocks Aiming", "Aiming cancels Reloading"). The Pawn's **ASC** uses this mapping.
6. **Input Config (`TObjectPtr<ULyraInputConfig>`)**:
   * Specifies the primary `ULyraInputConfig` asset to be applied to the Pawn. This asset maps Input Tags (abstract actions like "Jump") to Ability Tags (abilities to activate like "Ability.Jump"). Handled by `ULyraHeroComponent`.
7. **Input Mappings (`TArray<FPawnInputMappingContextAndPriority>`)**:
   * Specifies Enhanced Input `UInputMappingContext` assets to add directly to the player controlling this Pawn. Defines the raw hardware-to-Input Action bindings. Handled by `ULyraHeroComponent`.
   * (Struct defined in `ULyraPawnData`):
     * `InputMapping`: The `UInputMappingContext` asset.
     * `Priority`: Input context priority.
     * `bRegisterWithSettings`: Whether it should appear in input settings menus.
8. **Default Camera Mode (`TSubclassOf<ULyraCameraMode>`)**:
   * Specifies the default `ULyraCameraMode` class to activate when the player possesses a Pawn using this data. Handled by `ULyraCameraComponent`.

### How It's Used

1. **Experience Default:** An `ULyraExperienceDefinition` specifies a `DefaultPawnData`.
2. **Game Mode Selection:** `ALyraGameMode::GetPawnDataForController` first checks if the `ALyraPlayerState` has specific Pawn Data assigned. If not, it falls back to the `DefaultPawnData` from the currently loaded Experience.
3. **Pawn Spawning:** `ALyraGameMode::SpawnDefaultPawnAtTransform` spawns the `PawnClass` specified in the selected `ULyraPawnData`.
4. **Pawn Initialization:** Immediately after spawning, the Game Mode finds the `ULyraPawnExtensionComponent` on the new Pawn and calls `PawnExtComp->SetPawnData(SelectedPawnData)`.
5. **Component Application:** The `ULyraPawnExtensionComponent` (and other components like `ULyraHeroComponent`, `ULyraCameraComponent`) listens for the Pawn Data to be set. Once set, these components read the relevant properties from the `ULyraPawnData` asset (Ability Sets, Input Config, Input Mappings, Camera Mode, HUD Layouts/Widgets) and apply them to the Pawn and its controller/player subsystems (ASC, Enhanced Input, Common UI, Camera Manager).

***

`ULyraPawnData` is a vital Data Asset that encapsulates the complete configuration for a specific Pawn archetype. By referencing different `ULyraPawnData` assets, Experiences can easily dictate the type of character players will use, ensuring they spawn with the correct class, abilities, input setup, camera, and HUD for that particular gameplay session.
