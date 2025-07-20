# Spectating Workflows & Initiation

The Immersive Spectator System supports two primary scenarios where a player might spectate another:

1. **Live Spectating:** Typically occurs after a player dies in a team-based mode, allowing them to watch their remaining living teammates. Then potentially move onto other teams. This process is primarily managed and initiated on the server.
2. **Killcam Spectating:** Occurs as part of the Killcam playback sequence, where the player watches a replay of their death from the killer's perspective. This process is initiated and largely managed on the client within the duplicated killcam world, though it still requires some server interaction for data retrieval.

While both workflows utilize the core components (`ATeammateSpectator`, `USpectatorDataProxy`, `USpectatorDataContainer`), the initiation logic, target selection, and execution context differ significantly. This section introduces the two workflows, with detailed explanations provided in the linked sub-pages.

### Overview of Workflows

* **Live Spectating (GA_Spectate):**
  * **Context:** Server-Authoritative.
  * **Trigger:** Usually automatic upon player death confirmation in applicable game modes.
  * **Pawn:** `ATeammateSpectator` is spawned by and possessed on the server. Its state replicates to the client.
  * **Targeting:** Dynamically cycles through living teammates based on team information retrieved via `ULyraTeamSubsystem`. Can potentially fall back to spectating enemies if the team is eliminated.
  * **Data Flow:** Server directly accesses authoritative game state (like Quickbar) to update the target's `USpectatorDataContainer`. Client state (Camera, ADS) is relayed via RPCs from the target player through their Proxy to the server, then to the container. Data replicates from the container to the spectator.
* **Killcam Spectating (GA_Killcam_Camera):**
  * **Context:** Client-Side within the duplicated killcam world.
  * **Trigger:** Initiated by the `TAG_GameplayEvent_Killcam` event sent from `UKillcamPlayback` when the replay is ready.
  * **Pawn:** `ATeammateSpectator` is spawned locally on the client. No server possession occurs.
  * **Targeting:** Fixed target – watches only the killer actor resolved within the duplicated replay world. No cycling.
  * **Data Flow:** Primarily relies on the replay stream itself to reconstruct the killer's actions and viewpoint within the duplicated world.

Understanding these distinct workflows is essential for debugging and potentially extending spectating behavior. The following sub-pages provide detailed breakdowns of how each initiation ability (`GA_Spectate` and `GA_Killcam_Camera`) manages its respective process.
