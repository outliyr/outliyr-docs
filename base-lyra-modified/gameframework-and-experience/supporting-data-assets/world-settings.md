# World Settings

Each map (`.umap` file) in an Unreal Engine project has an associated **World Settings Actor**. This actor stores map-specific configuration, including which Game Mode class to use by default. Lyra provides a custom subclass, `ALyraWorldSettings`, primarily to specify a **default Gameplay Experience** for a map.

### Role and Purpose

* **Map-Specific Configuration:** Holds settings that apply only when a particular map is loaded.
* **Default Gameplay Experience:** Its most significant role in the Lyra framework is to define a `ULyraExperienceDefinition` that should be loaded by default if a server starts on this map without any other Experience override (e.g., from URL parameters, matchmaking, or command-line arguments).
* **Editor Checks:** Includes editor-time validation to help catch common setup issues.
* **PIE Net Mode Override (Editor Only):** Contains an editor-only flag to force a standalone net mode for testing frontend or single-player experiences.

<img src=".gitbook/assets/image (125).png" alt="" title="LyraWorldSetting exposing the default experience definition for the map">

### Key Property

* **`Default Gameplay Experience` (`TSoftClassPtr<ULyraExperienceDefinition>`)**:
  * **Purpose:** A soft class pointer to the `ULyraExperienceDefinition` asset that should be loaded by default when this map is the entry point for a server.
  * **Mechanism:**
    * When `ALyraGameMode::HandleMatchAssignmentIfNotExpectingOne` runs, it checks various sources for an Experience ID to load.
    * One of these sources is the current `AWorldSettings` actor. It casts it to `ALyraWorldSettings` and calls `GetDefaultGameplayExperience()`.
    * `GetDefaultGameplayExperience()` resolves the `TSoftClassPtr` to an `FPrimaryAssetId` for the `ULyraExperienceDefinition`.
    * If valid, this ID is used by the Game Mode to initiate the Experience loading process via the `ULyraExperienceManagerComponent`.
  * **Configuration:** Set this property in the Details panel of the World Settings actor for each map in your project. Select the `ULyraExperienceDefinition` asset (e.g., `B_Experience_TDM`, `B_Experience_MainMenu`) that is most appropriate for that map's default use case.

### Editor-Only Property

* **`Force Standalone Net Mode` (`bool`)**:
  * **Editor Only (`#if WITH_EDITORONLY_DATA`)**.
  * If true, when you press "Play In Editor" (PIE) for this map, the editor will attempt to force the net mode to Standalone, regardless of your default PIE settings.
  * **Use Case:** Useful for maps designed as frontend menus or for single-player experiences where testing in a client-server PIE setup is unnecessary or undesirable.

### Editor Validation (`CheckForErrors`)

* The `ALyraWorldSettings` class overrides `CheckForErrors()` (an editor-only function called during map checks).
* **Player Start Check:** It iterates through all `APlayerStart` actors in the level. If it finds any that are of the base `APlayerStart` class (instead of a Lyra-specific subclass like `ALyraPlayerStart`, if one is used for advanced spawning logic), it logs a warning in the Map Check dialog. This encourages using specialized player starts if your project requires them for advanced spawning features (though Lyra's spawning often relies more on tags on player starts than their class).
* **Experience Path Check:** It includes a `//@TODO` to add a check to ensure the `DefaultGameplayExperience` path can actually be resolved to a valid Primary Asset ID (e.g., not pointing to an asset in an unscanned directory).

### Configuration File Setup (`DefaultEngine.ini`)

For your custom `ALyraWorldSettings` class (or any subclass of `AWorldSettings`) to be automatically used as the default for new maps, or for existing maps that don't have a specific World Settings class assigned, you need to configure it in your project's `Config/DefaultEngine.ini` file:

```ini
;This configures the default LyraWorldSettings
[/Script/Engine.Engine]
WorldSettingsClassName=/Script/LyraGame.LyraWorldSettings
```

Setting this ensures that when a new map is created, or an existing map has its World Settings reset, it defaults to using your `ALyraWorldSettings` class, making the `Default Gameplay Experience` property available. For existing maps, you can also manually set the `World Settings Class` in the World Settings panel.

***

`ALyraWorldSettings` provides a simple but important mechanism for associating a default gameplay Experience with each map in your project. This, combined with the `.ini` configuration, ensures that maps correctly default to a desired gameplay setup when loaded by a server, forming a key part of the data-driven Experience selection process.
