# GameState Scoring System

The GameState Scoring System is a foundational component designed for the Shooter Base asset. This system provides a standardized and extensible framework for implementing scoring rules, tracking statistics, and managing win conditions within various shooter game modes.

### Purpose

Many shooter game modes revolve around scoring points for actions like eliminations, assists, or completing objectives. Implementing this logic consistently across different modes can be repetitive. The GameState Scoring System aims to:

* **Standardize Core Scoring:** Provide built-in handling for common events like eliminations and assists.
* **Centralize Logic:** Offer a dedicated `GameStateComponent` to house server-authoritative scoring rules and state checks.
* **Promote Extensibility:** Offer clear virtual functions and hooks for subclasses to implement mode-specific win conditions, scoring events, and reset logic.
* **Leverage Existing Systems:** Integrate cleanly with Lyra/Shooter Base systems like Gameplay Messages, Gameplay Tags (for stat tracking), the Team Subsystem, and potentially the Game Phase System.
* **Simplify Game Mode Implementation:** Allow Game Mode classes to focus on broader flow control, delegating detailed scoring calculations and win condition checks to this component or its subclasses.

### Core Concept: A Subclassable Scoring Engine

The system is built around the `UShooterScoring_Base` component, which acts as a base class:

1. **GameState Component:** It's designed to be added to your `AGameStateBase` actor.
2. **Server-Authoritative:** All core logic (listening to messages, modifying scores) executes only on the server to maintain state integrity.
3. **Message Listener:** The base class automatically listens for standard `Lyra.Elimination.Message` and `Lyra.Assist.Message` events.
4. **Tag-Based Scoring:** It uses Gameplay Tags (`ShooterGame.Score.Eliminations`, `ShooterGame.Score.Death`, `ShooterGame.Score.Assists`) to increment stats directly on `ALyraPlayerState` (via `AddStatTagStack`) and team scores on `ULyraTeamSubsystem` (via `AddTeamTagStack`).
5. **Subclass for Specifics:** The real power comes from creating Blueprint or C++ subclasses of `UShooterScoring_Base`. These subclasses override specific functions (like `OnEliminationScored`) to implement the unique rules, score limits, win conditions, and potential unique scoring events (like objective captures) for a particular game mode.

### Key Benefits

* **Reduces Boilerplate:** Handles basic elimination/assist scoring automatically.
* **Clean Architecture:** Separates scoring logic from the main Game Mode class.
* **Modular:** Easily swap scoring behavior by adding different subclasses of the component via Lyra Experiences.
* **Data-Driven Stats:** Uses Gameplay Tags for score tracking, integrating well with Lyra's stat system and potentially UI displays driven by these tags.
* **Clear Customization Hooks:** Virtual functions (`OnEliminationScored`, `PostWarmup`) and BlueprintNativeEvents (`ResetAllActivePlayers`) provide well-defined places to inject custom logic.

### Key Component

* **`UShooterScoring_Base`:** The C++ `UGameStateComponent` base class providing the core functionality and virtual hooks. You will typically create subclasses derived from this for each game mode needing score tracking.

### Relationship to Other Systems

The GameState Scoring System relies on and interacts with several other parts of the framework:

* **`UGameplayMessageSubsystem`:** Used to listen for elimination and assist events (and potentially custom events in subclasses).
* **`ULyraTeamSubsystem`:** Used to compare player teams and to track team-based scores via `AddTeamTagStack`.
* **`ALyraPlayerState`:** Used to track individual player stats (kills, deaths, assists) via `AddStatTagStack`.
* **`ULyraGamePhaseSubsystem` (Optional but Recommended):** Game phase changes can be used to trigger logic within the scoring component (e.g., calling `PostWarmup` when the `GamePhase.Playing` starts, or checking win conditions only during specific phases). Subclasses might also trigger phase changes upon reaching score limits. Read [this page](../../../base-lyra-modified/game-phase-system/) for more details on the **Game Phase System**.
* **Gameplay Tags:** Underpin the stat tracking mechanism.

This overview introduces the purpose and core concepts of the GameState Scoring System. The following pages will detail the default logic provided by the base class, explain how to extend it for specific game modes using its various hooks, and cover how to integrate the component into your Lyra Experiences.

***
