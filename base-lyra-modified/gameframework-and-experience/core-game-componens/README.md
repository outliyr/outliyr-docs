# Core Game Componens

This section covers the standard Unreal Engine framework classes (`GameMode`, `GameState`, `GameInstance`, `GameSession`) as they are customized and utilized within this asset. While these classes retain their fundamental engine roles, their responsibilities are often adapted to work effectively with the **Experience** and **Game Feature** systems.

### Traditional vs. Lyra/Modular Approach

In a traditional UE project, the `AGameMode` class often becomes a large hub containing most of the specific rules, logic, and state management for a particular game type. This can lead to monolithic classes and tight coupling.

This asset, following Lyra's modular approach, shifts responsibilities:

* **`AGameModeBase` (`ALyraGameMode`):** Focuses primarily on **server-authoritative session management**, player joining/leaving, default pawn class selection, and **initiating the loading of the appropriate Experience Definition**. It generally avoids containing logic specific to _one particular_ game mode's rules (like scoring, win conditions, objective tracking).
* **`AGameStateBase` (`ALyraGameState`):** Acts as the **replicated container for game-wide state** and hosts key **manager components**. It's the central hub for systems that need access to the overall game state or need to coordinate across clients. Crucially, it hosts the `ULyraExperienceManagerComponent`.
* **GameState Components:** Much of the logic traditionally found in GameMode (scoring, team management, objective tracking, round timers, specific win conditions) is often encapsulated within **`UGameStateComponent`** subclasses.
* **Experiences & Game Features:** These systems determine _which_ GameState Components (and other components/actors/abilities) are actually **added and activated** for the current session via `UGameFeatureAction_AddComponents` and other actions.

**In essence:** The specific rules and systems for a game mode are packaged into Game Features and their associated components/actions. The Experience Definition selects which features to activate. The Game Mode starts the Experience loading, and the Game State hosts the manager component that loads the features and executes the actions, which in turn add the necessary components (often to the Game State itself) to implement the mode's logic.

### Key Framework Classes in this Asset

* **`ALyraGameMode`:** Handles player connections, default pawn spawning (using `ULyraPawnData` provided by the Experience), and most importantly, selecting and triggering the load of the correct `ULyraExperienceDefinition` based on session parameters or defaults. Delegates detailed spawn location logic to specific manager components.
* **`ALyraGameState`:** Hosts the vital `ULyraExperienceManagerComponent` (managing the Experience/Feature lifecycle) and a game-wide `ULyraAbilitySystemComponent` (often used for global Gameplay Cues). Replicates essential game-wide state like Server FPS. Can have various **GameState Components** added dynamically by Game Feature Actions to implement mode-specific logic (e.g., a `TeamDeathmatchScoringComponent`, `CaptureTheFlagStateComponent`).
* **`ALyraGameInstance`:** Manages the application lifecycle across level transitions. Handles subsystem initialization (like registering the Lyra Init States with the `UGameFrameworkComponentManager`), user login/initialization, and potentially session management interface logic. Includes example network encryption hooks.
* **`ALyraGameSession`:** Handles interactions with online subsystems for session management (hosting, joining, finding matches). Lyra's implementation often relies on the `UCommonSessionSubsystem` for the heavy lifting, which is configured via `ULyraUserFacingExperienceDefinition`.

### Benefits of this Architecture

* **Modularity:** Game mode logic is contained within specific components and Game Features, not monolithic Game Modes.
* **Reusability:** Common logic can be placed in reusable GameState Components added by multiple different Experiences.
* **Data-Driven:** Experiences define which components (and thus which rulesets) are active, making game mode setup highly data-driven.
* **Decoupling:** The base Game Mode and Game State classes remain relatively clean and focused on their core engine roles.

### Structure of this Section

The following sub-pages will provide details on the specific implementations and key overrides within each of these core framework classes:

1. **Game Mode (`ALyraGameMode`):** Focusing on Experience selection, pawn spawning, and player lifecycle management.
2. **Game State (`ALyraGameState`):** Highlighting its role as host for the Experience Manager and other potential mode-specific components.
3. **Game Instance (`ULyraGameInstance`):** Covering initialization and session-related handling.
4. **Game Session (`ALyraGameSession`):** Briefly touching on its role with the online subsystem interface.

***

This overview explains the shift in responsibilities within the core game framework classes compared to traditional UE development, emphasizing the central role of the Experience system and Game State components in defining and managing specific game mode logic in a modular fashion.
