# Game Phase System

This subsystem provides a powerful and flexible framework for managing the different stages, states, or "phases" of your gameplay session using Gameplay Tags and the Gameplay Ability System (GAS).

### Purpose

Most games progress through distinct stages – think of a match starting with a setup period, moving into active play, perhaps hitting overtime or sudden death, and finally concluding with a scoreboard display. The Game Phase System aims to:

* **Structure Game Flow:** Define and manage these distinct phases in a clear, organized manner.
* **Decouple Logic:** Allow various game systems (UI, AI, spawning, objectives) to react to the current phase without needing complex, hardcoded dependencies on the game mode's state machine.
* **Enable Reactivity:** Provide an event-driven way for systems to be notified when specific phases begin or end.
* **Support Complex Flows:** Handle nested or parallel phases gracefully using a hierarchical tag system (e.g., being in a general "Playing" phase while also being in a specific "Playing.CaptureTheFlag" sub-phase).

Instead of relying solely on complex state variables within your Game Mode, this system uses Gameplay Abilities activated on the GameState to represent the active phase(s), orchestrated by a dedicated World Subsystem.

### Core Concept: Phases as Abilities & Tags

The system revolves around these key ideas:

1. **Phases are Abilities:** Each distinct game phase (e.g., "WaitingToStart", "Playing", "RoundOver") is represented by a dedicated Gameplay Ability class derived from `ULyraGamePhaseAbility`.
2. **Phases are Activated on GameState:** These phase abilities are granted to and activated on the GameState's Ability System Component (ASC). An _active_ phase ability signifies that the game is currently _in_ that phase.
3. **Tags Define Hierarchy:** Each `ULyraGamePhaseAbility` is assigned a specific Gameplay Tag (e.g., `GamePhase.Playing`, `GamePhase.Playing.SuddenDeath`) via its `GamePhaseTag` property. The **structure** of these tags (using parent.child conventions) defines the relationship between phases.
4. **Subsystem Manages Transitions:** A World Subsystem, `ULyraGamePhaseSubsystem`, manages the activation and cancellation of these phase abilities. When a new phase ability is started, the subsystem intelligently ends conflicting sibling phases based on the Gameplay Tag hierarchy, while allowing parent phases to remain active.
5. **Systems Observe Phases:** Other game systems subscribe to the `ULyraGamePhaseSubsystem` to be notified when specific phases (identified by their tags) start or end, allowing them to react accordingly.

### Key Benefits

* **Structured Flow:** Provides a clear, tag-based definition of your game's lifecycle.
* **Decoupling:** Game systems react to phase tags, not direct Game Mode state checks, improving modularity.
* **Event-Driven:** Use delegates (`WhenPhaseStartsOrIsActive`, `WhenPhaseEnds`) for efficient, reactive updates instead of constant polling.
* **Hierarchical Logic:** Naturally handles nested states (e.g., general 'Playing' vs specific 'Playing.SuddenDeath') and ensures only relevant phases are cancelled during transitions.
* **Extensibility:** Easily add new phases by creating new tags and `ULyraGamePhaseAbility` subclasses.
* **GAS Integration:** Leverages the power and familiarity of the Gameplay Ability System.

### Key Components Intro

* **`ULyraGamePhaseSubsystem`:** The central manager (a `UWorldSubsystem`). Tracks active phases, handles transitions, and notifies observers.
* **`ULyraGamePhaseAbility`:** The base class for all phase abilities. Each instance represents an active phase and holds the defining `GamePhaseTag`.
* **Gameplay Tags:** The backbone of the system. Their hierarchical structure (e.g., `GamePhase.Playing.Standard`) dictates the transition logic.

### High-Level Flow Example

Imagine a simple match flow:

1. **Start `GamePhase.Warmup`:** The game begins, `Warmup` phase ability activates. Game systems listening for `GamePhase.Warmup` might initialize spawn points or display pre-round UI.
2. **Start `GamePhase.Playing`:** When setup is complete, the `Playing` phase ability is activated.
   * The `ULyraGamePhaseSubsystem` sees that `GamePhase.Playing` is not an ancestor of the currently active `GamePhase.Setup`.
   * It automatically ends the `GamePhase.Setup` ability.
   * The `GamePhase.Playing` ability becomes active.
   * Systems listening for `GamePhase.Playing` might enable player input and objectives, while systems listening for `GamePhase.Setup` ending might hide pre-round UI.
3. **Start `GamePhase.Playing.SuddenDeath`:** If the match goes into overtime, the `SuddenDeath` phase ability is activated.
   * The subsystem sees that the currently active `GamePhase.Playing` _is_ an ancestor of `GamePhase.Playing.SuddenDeath`.
   * `GamePhase.Playing` **remains active**.
   * `GamePhase.Playing.SuddenDeath` also becomes active.
   * Systems listening for `GamePhase.Playing.SuddenDeath` might apply special rules or UI elements, while systems relying on the general `GamePhase.Playing` continue functioning.
4. **Start `GamePhase.PostGame`:** When the match concludes, the `PostGame` phase ability is activated.
   * The subsystem sees that neither `GamePhase.Playing` nor `GamePhase.Playing.SuddenDeath` are ancestors of `GamePhase.PostGame`.
   * It automatically ends both the `GamePhase.Playing` and `GamePhase.Playing.SuddenDeath` abilities.
   * `GamePhase.PostGame` becomes active.
   * Systems listening for `GamePhase.PostGame` might display the scoreboard, while systems reacting to `GamePhase.Playing` ending might disable player input.

This overview introduces the core concepts. Subsequent pages will delve into the specifics of the tag hierarchy, the subsystem and ability classes, and how to define, transition, and observe game phases.

***
