# Utilities & Blueprint Integration

While the core team logic resides within the `ULyraTeamSubsystem` and `ULyraTeamCreationComponent`, several utilities are provided to make interacting with the team system easier, especially from **Blueprints** and for handling **asynchronous state changes**.

This section covers:

1. **`ULyraTeamStatics`:** A Blueprint Function Library offering convenient wrappers for common team subsystem queries.
2. **Async Actions:** Specialized Blueprint nodes (`UAsyncAction_ObserveTeam`, `UAsyncAction_ObserveTeamColors`, `UAsyncAction_ObserveViewerTeam`) that allow Blueprints to reactively listen for changes in team state without needing to poll on Tick.

### Purpose: Simplifying Access and Reactivity

* **Blueprint Friendliness:** Provides nodes that abstract away some of the C++ complexities of accessing the subsystem and handling interface pointers, making team information readily available in Blueprint graphs (like UI Widgets or character Blueprints).
* **Reactivity:** Enables Blueprints to subscribe to specific team-related events (team assignment changes, display asset changes, viewer changes) and execute logic only when those events occur, which is significantly more efficient and cleaner than checking state every frame.
* **Convenience:** Offers helper functions for common tasks like safely retrieving display asset parameters with fallback values.

### Key Utilities

* **`ULyraTeamStatics`:** Contains static functions mirroring many of the core query functions found on the `ULyraTeamSubsystem`, but exposed for Blueprint use. Examples include getting an actor's team ID, retrieving display assets (including the effective one based on perspective mode), and safely accessing parameters within a display asset.
* **Async Actions:**
  * `UAsyncAction_ObserveTeam`: Monitors a specific team agent and fires an event whenever its Team ID changes.
  * `UAsyncAction_ObserveTeamColors`: Monitors both the agent's Team ID _and_ the display asset associated with that team ID, firing when either changes.
  * `UAsyncAction_ObserveViewerTeam`: Monitors the `ULyraTeamSubsystem`'s concept of the "current viewer" and fires when the viewer changes _or_ when the viewer's _own_ team ID changes.

### Structure of this Section

The following sub-pages will detail these utilities:

* **Team Statics (`ULyraTeamStatics`):** A breakdown of the available Blueprint functions for querying team information.
* **Async Actions (Observing Changes):** Details on how to use the `ObserveTeam`, `ObserveTeamColors`, and `ObserveViewerTeam` async nodes in Blueprints.

***

These utilities bridge the gap between the C++ core of the team system and Blueprint-based gameplay logic and UI, providing both convenient query functions and efficient, event-driven ways to react to changes in team state.
