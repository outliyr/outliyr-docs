# Team Management

While Core Concepts define _what_ teams are and how actors affiliate with them, the actual runtime **management, tracking, and querying** of teams and their members is handled by the `ULyraTeamSubsystem`. This World Subsystem acts as the central nervous system for all team-related information within a specific game world instance.

### Purpose: Centralized Team Tracking & Logic

The `ULyraTeamSubsystem` serves several critical functions:

1. **Team Registry:** Maintains a registry (the `TeamMap`) of all active teams in the current world, keyed by their Team ID. It tracks the associated `ALyraTeamInfoBase` actors (Public and Private) and their `ULyraTeamDisplayAsset`s.
2. **Affiliation Querying:** Provides the primary functions (`FindTeamFromObject`, `CompareTeams`) used by gameplay systems and UI to determine an actor's team ID and their relationship to other actors.
3. **State Management:** Offers methods to manipulate team-wide state via the `TeamTags` container on the associated `ALyraTeamInfoBase` actors (`AddTeamTagStack`, `RemoveTeamTagStack`, etc.).
4. **Visual Management:** Manages the application of team visuals by providing access to `ULyraTeamDisplayAsset`s, including handling the logic for **Perspective Color Mode** (showing Ally/Enemy colors instead of actual team colors).
5. **Viewer Tracking:** Keeps track of the current "local viewer" (who the player is spectating or controlling), which is essential for determining perspective colors and potentially other viewpoint-dependent logic.
6. **Change Notification:** Provides delegates (`OnTeamDisplayAssetChanged`, `OnViewerChanged`) that other systems can subscribe to for reacting to changes in team visuals or the local player's viewpoint.

### Key Responsibilities & Interactions

* **Registration:** `ALyraTeamInfoBase` actors register themselves with the subsystem upon creation (`RegisterTeamInfo`) and unregister upon destruction (`UnregisterTeamInfo`).
* **Queries:** Gameplay logic (abilities, scoring systems, UI) calls functions like `FindTeamFromObject` or `CompareTeams` to get team information about specific actors. The subsystem uses the `ILyraTeamAgentInterface` (or other methods like checking PlayerStates) to determine the actor's Team ID.
* **Display Assets:** The subsystem retrieves the appropriate `ULyraTeamDisplayAsset` based on the queried Team ID and potentially the current viewer's Team ID if Perspective Color Mode is active (`GetEffectiveTeamDisplayAsset`).
* **Team Tags:** Functions like `AddTeamTagStack` find the correct `ALyraTeamInfoBase` actor based on Team ID and modify its replicated `TeamTags` container.
* **Viewer Updates:** Systems controlling spectating or killcams call `SetCurrentViewer` to update the subsystem's knowledge of the local player's perspective. The `OnViewerChanged` delegate notifies listeners (like UI or visual systems) when this happens.

### Structure of this Section

This section details the various functionalities provided by the `ULyraTeamSubsystem`:

* **Initialization & Registration:** How the subsystem starts and how Team Info actors register/unregister.
* **Agent Management & Queries:** Functions for finding team IDs, comparing teams, checking damage rules, and changing team assignments.
* **Team Tags:** Managing shared team state using Gameplay Tags.
* **Display Assets & Perspective Colors:** How the subsystem manages and provides team visuals, including the Ally/Enemy perspective override.
* **Viewer Tracking:** Managing the concept of the local player's current viewpoint for perspective-based logic.

***

The `ULyraTeamSubsystem` is the authoritative hub for all runtime team information within a world. It connects the static definitions (Display Assets) and actor affiliations (Agent Interface, Team Info) with dynamic gameplay queries and state management, providing the necessary foundation for implementing team-based mechanics and visuals.
