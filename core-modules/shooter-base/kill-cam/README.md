# Kill Cam

This feature allows players, shortly after being eliminated, to witness their final moments from the perspective of their killer, providing valuable context and insight into the encounter.

### Purpose

The primary goal of the Killcam system is to enhance the player experience after death by:

* **Providing Context:** Showing the player _how_ they were eliminated, revealing the opponent's position, strategy, or skillful play.
* **Reducing Frustration:** Understanding the circumstances of death can make it feel less arbitrary.
* **Learning Opportunity:** Players can potentially learn from observing their opponent's actions.
* **Highlighting Action:** Showcasing key moments and engagements from a different viewpoint.

### Core Concept

At its heart, the Killcam system leverages Unreal Engine's **Replay System** and an experimental **World Duplication** feature. Here's the high-level idea:

1. **Record:** The game client constantly records recent gameplay activity into a short, in-memory replay buffer.
2. **Duplicate:** When the game starts (**outside PIE**), the engine creates an invisible, in-memory duplicate of the current game world's dynamic level collection.
3. **Trigger:** Upon player death, the system identifies the killer and victim and prepares for playback.
4. **Playback:** When triggered, the system stops recording, activates the duplicated world, plays back the relevant segment of the recorded replay within this isolated world, focusing the camera appropriately (usually on the killer).
5. **Switch View:** The player's viewport is temporarily switched to view the action unfolding in the duplicated world.
6. **Restore:** After a set duration, playback stops, the duplicated world is hidden/cleaned up, the player's view is restored to the main game world, and recording resumes for the next potential death.

### Key Benefit

The main advantage is offering players immediate visual feedback on their elimination, transforming a potentially frustrating moment into an informative or even impressive spectacle.

### <mark style="color:red;">CRITICAL WARNINGS & LIMITATIONS</mark>

<mark style="color:red;">**Please read these points carefully before using or attempting to modify the Killcam system:**</mark>

<div class="collapse">
<p class="collapse-title">Experimental Engine Feature Dependency</p>
<div class="collapse-content">

This system fundamentally relies on the engine's `Experimental_ShouldPreDuplicateMap` functionality within a custom `UGameEngine` class (`ULyraGameEngine` in this implementation). This feature is marked as experimental by Epic Games and its behavior, availability, or API **may change or be removed** in future Unreal Engine versions, potentially breaking this system.

</div>
</div>

<div class="collapse">
<p class="collapse-title">Standalone Mode ONLY</p>
<div class="collapse-content">

Due to the reliance on world duplication via `Experimental_ShouldPreDuplicateMap`, the Killcam system **WILL NOT FUNCTION** in any Play-In-Editor (PIE) mode (Selected Viewport, New Editor Window, etc.). It **ONLY works** when the game is run as a **Standalone executable** (e.g., launched via the command line with `-game`, through the Launch button targeting Standalone Game, or in a packaged build). Testing requires launching in Standalone.

</div>
</div>

<div class="collapse">
<p class="collapse-title">High Complexity &#x26; Modification Risk</p>
<div class="collapse-content">

The core logic, particularly within `UKillcamPlayback`, interacts with complex, low-level engine systems including replay streaming, world context management, level collections, actor spawning/destruction across worlds, and collision handling between duplicated and source actors. **Modifying this core logic is strongly discouraged** unless you possess a deep understanding of these Unreal Engine internals. Incorrect changes can easily lead to crashes, replication issues, visual artifacts, physics problems, or other unpredictable behavior.

</div>
</div>

### Main Components

The system involves several key C++ classes working together:

* **`ULyraGameEngine`:** (Engine Subclass) Enables the necessary world duplication via `Experimental_ShouldPreDuplicateMap`.
* **`UKillcamManager`:** (Controller Component) The client-side coordinator. It listens for death events, manages the `UKillcamPlayback` instance, handles start/stop messages, and provides utility functions.
* **`UKillcamPlayback`:** (Tickable UObject) The core engine performing the heavy lifting. Manages the duplicated world context, replay recording/playback via `UDemoNetDriver`, time scrubbing, view switching coordination, and collision handling between the source and duplicated worlds.
* **Gameplay Messages:** (`FLyraVerbMessage` for eliminations, `FLyraKillCamMessage` for start/stop triggers) Used for communication.
* **`ULyraExperienceManagerComponent`:** (Modified) Adapted to correctly handle loading logic in duplicated worlds.

### Simplified Flow

Here’s a basic sequence of events for a successful Killcam playback:

1. **Game Start (Standalone):** `ULyraGameEngine` enables map duplication.
2. **Experience Loads:** `UKillcamManager` initializes and starts `UKillcamPlayback` recording (using in-memory replay).
3. **Player Death:** `UKillcamManager` listens for the elimination message and tells `UKillcamPlayback` to cache killer/victim info (GUIDs, death time).
4. **Killcam Trigger:** Game logic sends a `ShooterGame.KillCam.Message.Start` message to the client.
5. **Playback Begins:** `UKillcamManager` receives the start message and instructs `UKillcamPlayback` to start.
6. `UKillcamPlayback` stops recording, ensures the duplicate world is ready, starts replay playback, and scrubs to the calculated start time (`DeathTime - KillCamStartTime`).
7. **View Switched:** `UKillcamPlayback` makes the duplicate world visible, hides the source world, handles collision setup, and triggers logic (likely a Gameplay Ability) to set the player's view target to the killer in the duplicate world.
8. **Playback Duration:** The replay plays for the specified `KillCamFullDuration`.
9. **Killcam Stop:** Game logic sends a `ShooterGame.KillCam.Message.Stop` message (or playback ends naturally).
10. **Playback Ends:** `UKillcamManager` receives the stop message and tells `UKillcamPlayback` to stop.
11. **View Restored:** `UKillcamPlayback` cleans up the replay driver, hides/destroys the duplicate world actors, makes the source world visible again, restores collision, and triggers logic to restore the player's view in the source world (usually ready for respawn).
12. **Recording Resumes:** `UKillcamManager` tells `UKillcamPlayback` to start recording again.

This overview provides a conceptual understanding. Subsequent pages will delve into the technical details of world duplication, recording, playback, collision handling, and integration steps, always keeping the critical limitations in mind.

***
