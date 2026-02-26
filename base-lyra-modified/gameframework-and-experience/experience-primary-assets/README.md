# Experience Primary Assets

In this framework, an **Experience** represents the complete definition of a specific gameplay session or mode. It encapsulates the rules, content, features, and player configurations required for a particular scenario, such as Team Deathmatch, Capture the Flag, a tutorial level, or even the main menu frontend.

Experiences provide a powerful, data-driven way to configure distinct gameplay loops and environments without needing separate, monolithic Game Mode classes for every variation.

### Purpose: Defining the Gameplay Session

The core idea behind Experiences is to define "What is the player _experiencing_ right now?". This involves specifying:

* **Required Features:** Which modular Game Features (plugins containing specific logic, content, and actions) need to be active for this session?
* **Default Player Setup:** What is the standard Pawn type (`ULyraPawnData`) players should use if no other specific configuration overrides it? This includes their default abilities, input bindings, camera settings, and base HUD layout.
* **Core Actions:** What initial setup actions need to occur when this Experience loads (beyond those contained within the Game Features)? These might include setting specific game rules via console commands, loading specific subsystems, or configuring world properties.
* **Composability:** Experiences can be built by combining reusable sets of features and actions (**Action Sets**).

### How Experiences Work

1. **Selection:** At the start of a game or map load, the `ALyraGameMode` determines which `ULyraExperienceDefinition` asset to use based on various factors (URL options, world settings, defaults).
2. **Loading:** The `ULyraExperienceManagerComponent` (on the `ALyraGameState`) takes the selected Experience Definition's Primary Asset ID and begins the loading process.
3. **Activation:** As the Experience loads, the Manager Component:
   * Identifies all required Game Features listed in the Experience Definition and its associated Action Sets.
   * Loads and activates these Game Features using the `UGameFeaturesSubsystem`.
   * Executes all `UGameFeatureAction`s defined directly in the Experience Definition and within its included Action Sets. These actions configure various aspects of the game based on the Experience's requirements.
4. **Readiness:** Once all assets are loaded, features are activated, and actions are executed, the Experience is considered "Loaded". Other systems waiting for the Experience (like player spawning logic in the Game Mode) can then proceed.

### Benefits of Using Experiences

* **Data-Driven Game Modes:** Define entire game modes primarily through Data Assets instead of complex C++ Game Mode subclasses.
* **Modularity:** Easily swap between different gameplay experiences by simply changing the loaded `ULyraExperienceDefinition`.
* **Decoupling:** Core systems don't need explicit knowledge of every possible game mode; they just react to the currently loaded Experience and its activated features/actions.
* **Composability:** Build complex Experiences by combining smaller, reusable `ULyraExperienceActionSet`s.
* **Clear Configuration:** Provides a centralized asset (`ULyraExperienceDefinition`) to understand the components and setup for a specific gameplay session.

### Key Experience-Related Assets

This section will detail the specific asset types used to define and manage Experiences:

1. **Experience Definition (`ULyraExperienceDefinition`):** The core asset defining the gameplay session's features, default pawn, and actions.
2. **Experience Action Set (`ULyraExperienceActionSet`):** Reusable collections of features and actions.
3. **User Facing Experience (`ULyraUserFacingExperienceDefinition`):** Defines how an Experience is presented in UI and the parameters for hosting it.

***

Experiences are the central concept for defining distinct gameplay sessions in a modular and data-driven way. By leveraging Experience Definitions, Action Sets, and their integration with the Game Features system, you can create and manage diverse game modes and scenarios effectively.
