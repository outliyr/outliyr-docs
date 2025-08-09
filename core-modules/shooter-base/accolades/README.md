# Accolades

Welcome to the Shooter Base Accolade System documentation. This system provides a robust, data-driven, and extensible framework for rewarding players with visual and auditory feedback for specific achievements and actions during gameplay.

> [!info]
> This was originally made by Lyra, in their shooter core game feature. I made some slight modifications.

### Purpose

The primary goal of the Accolade System is to enhance the player experience by:

* **Providing Immediate Feedback:** Instantly notifying players of significant accomplishments like multi-kills, kill streaks, assists, or other custom gameplay events.
* **Reinforcing Positive Actions:** Highlighting skillful play or objective completion, making gameplay more satisfying.
* **Improving Game Feel:** Adding dynamic visual and auditory elements that react to player performance.
* **Communicating Achievements:** Clearly displaying recognized feats to the player, contributing to a sense of progression and mastery within a match.

This system is designed to handle everything from standard shooter events (eliminations, assists) to potentially complex, game-mode-specific achievements you might define.

### Core Concepts

The Accolade System is built upon several key concepts working together:

1. **Gameplay Messages (`UGameplayMessageSubsystem`):** The foundation of communication. Game events (like eliminations, damage dealt) are broadcast as messages throughout the game state using Unreal Engine's Gameplay Message Subsystem. This decouples the event source from the listeners.
2. **Server-Side Processors (`UGameplayMessageProcessor`):** These are server-authoritative components (typically residing on the Game State) that listen for specific Gameplay Messages. They analyze patterns and sequences of events (e.g., multiple eliminations in quick succession) to determine if an accolade condition has been met. Examples include `UEliminationChainProcessor` and `UEliminationStreakProcessor`.
3. **Accolade Definitions (`FAccoladeDefinitionRow` / Data Registry):** Accolades themselves (like "Double Kill" or "Killing Spree") are defined as data, typically in a Data Table registered with the Data Registry subsystem. Each definition includes display text, icon, sound, duration, display location tags, and rules for cancelling other accolades. This makes them easy to modify and expand without changing code.
4. **Accolade Relay (`UAccoladeRelay`):** A specific server-side processor that listens for messages indicating an accolade should be awarded (often broadcast by other processors). It packages this information into a targeted notification message (`FLyraNotificationMessage`) specifically intended for the relevant player's UI.
5. **Client-Side Display (`UAccoladeHostWidget`):** A UMG widget placed in your UI layout. It listens for the `FLyraNotificationMessage` sent by the `AccoladeRelay`. Upon receiving a notification, it looks up the corresponding Accolade Definition, asynchronously loads associated assets (icons, sounds), manages a display queue (showing accolades one after another), handles cancellation logic, and ultimately calls Blueprint events to create and destroy the visual representation of the accolade.

### Benefits

Integrating and utilizing the Shooter Base Accolade System provides several advantages:

* **Data-Driven:** Define and tune accolades entirely through Data Tables, allowing designers to easily add, remove, or modify rewards without programmer intervention.
* **Extensible:** Create new types of accolades by implementing custom `UGameplayMessageProcessor` classes to listen for different game events or conditions specific to your game mode.
* **Decoupled UI:** The core logic (detection, relaying) is separate from the visual presentation. You can completely customize the look and feel of accolades via the `UAccoladeHostWidget`'s Blueprint events without altering the underlying system.
* **Asynchronous Loading:** Icons and sounds associated with accolades are loaded asynchronously, preventing potential game hitches or freezes when an accolade is triggered.
* **Performance Conscious:** Server-side processing minimizes client load, and message-based communication is efficient.
* **Network Ready:** Logic is primarily server-authoritative, ensuring consistency across all clients, with efficient relaying to the target player(s).
* **Flexible Display:** Utilize `LocationTag` filtering to direct specific accolades to different areas of the screen by using multiple `UAccoladeHostWidget` instances.
* **Robust Cancellation:** Built-in support for higher-tier accolades (e.g., "Triple Kill") to automatically cancel or suppress lower-tier ones (e.g., "Double Kill") provides a clean and uncluttered display.

### High-Level Flow

Understanding how an event translates into a displayed accolade is key. Here's a simplified example flow for a "Double Kill":

1. **Event:** A player gets their first elimination. A `Lyra.Elimination.Message` is broadcast via the `GameplayMessageSubsystem`.
2. **Processing (Server):** The `UEliminationChainProcessor` (running on the server) receives this message and notes the time for that player.
3. **Event:** The _same_ player gets a second elimination shortly after. Another `Lyra.Elimination.Message` is broadcast.
4. **Processing (Server):** The `UEliminationChainProcessor` receives the second message, checks the time against the first, determines it qualifies as a chain, and finds the `Accolade.DoubleKill` tag configured for a chain of 2.
5. **Accolade Trigger (Server):** The processor broadcasts a _new_ `FLyraVerbMessage` with the `Verb` set to `Accolade.DoubleKill`, targeting the instigator player.
6. **Relaying (Server):** The `UAccoladeRelay` (also on the server) listens for messages like `Accolade.DoubleKill`. It receives the message.
7. **Notification Prep (Server):** The relay constructs a `FLyraNotificationMessage`, setting the `TargetChannel` to `ShooterGame.Accolade`, `TargetPlayer` to the instigator's PlayerState, and `PayloadTag` to `Accolade.DoubleKill`.
8. **Broadcasting (Server -> Client):** The relay uses `ClientBroadcastMessage` (and potentially a local broadcast if not a dedicated server) to send the `FLyraNotificationMessage` to the target client(s).
9. **Receiving (Client):** The player's `UAccoladeHostWidget` (listening for `Lyra.AddNotification.Message` with the correct `TargetChannel`) receives the notification.
10. **Data Lookup (Client):** The widget uses the `PayloadTag` (`Accolade.DoubleKill`) to query the Data Registry for the corresponding `FAccoladeDefinitionRow`.
11. **Asset Loading (Client):** The widget initiates asynchronous loading of the Icon and Sound specified in the definition row.
12. **Queue & Display (Client):** Once assets are loaded, the widget adds the accolade details to its display queue. If it's the next to display (and potentially after cancelling others based on `CancelAccoladesWithTag`), it calls the `CreateAccoladeWidget` Blueprint event, passing in the definition details (Text, Icon, Sound, Duration). Your Blueprint implementation creates the visual UMG element.
13. **Cleanup (Client):** After the specified `DisplayDuration`, the widget calls the `DestroyAccoladeWidget` Blueprint event to remove the visual element.

This overview provides a foundational understanding. Subsequent pages will delve deeper into each component, configuration, and customization possibilities.

***
