# Setup & Integration

This section guides you through the practical steps required to integrate and configure the Shooter Base Accolade and Elimination Feed systems into your project. Following these steps will enable the server-side detection, relaying, and client-side display mechanisms.

### 1. Adding Server Components (Processors & Relays)

The core logic components (`UEliminationAssistProcessor`, `UEliminationChainProcessor`, `UEliminationStreakProcessor`, `UAccoladeRelay`, `UEliminationFeedRelay`) need to run on the server. The standard approach in a Lyra-based project is to add these as components to the `GameState` Actor when a specific gameplay experience is active.

**Using Lyra Experiences (Recommended):**

1. **Identify or Create a Game Feature Plugin:** Your game mode or core gameplay logic should reside in a Game Feature Plugin (GFP).
2. **Define an Experience:** Within your GFP, define a Lyra Experience Definition asset (`ULyraExperienceDefinition`).
3. **Add Component Actions:** In the Experience Definition, add actions of type `GameFeatureAction_AddComponents`.
4. **Configure Actions:** For each processor/relay component you want to enable for that experience:
   * Create a `GameFeatureAction_AddComponents` entry.
   * Specify the **Target Actor** as `GameState`.
   * Add an entry to the **Component List**:
     * Set the **Component Class** to the desired processor (e.g., `UEliminationChainProcessor`).
     * Set **Server Component** and **Client Component** to **true**.
   * **Configure Processor Properties:** If the processor has configurable properties (like `UEliminationChainProcessor::ChainTimeLimit` or its `EliminationChainTags` map), you can often set default values directly within the Game Feature data associated with the action, or create Blueprint subclasses of the processors, configure them there, and add the _subclass_ in the action.

**(Alternative: Manual Addition)** If not using experiences, you could manually add these components to your `AGameStateBase` Blueprint or C++ class, ensuring they are only created on the server (`HasAuthority()`). However, using experiences is the more modular and Lyra- idiomatic approach.

**Example Conceptual Action:**

```
(In LyraExperienceDefinition Asset)
Actions:
  - Action: GameFeatureAction_AddComponents
    Target Actor: GameState
    Components:
      - Component Class: UEliminationChainProcessor
        Client Component: True
        Server Component: True
      - Component Class: UAccoladeRelay
        Client Component: True
        Server Component: True
      - Component Class: UEliminationFeedRelay
        Client Component: True
        Server Component: True
      # ... Add Assist & Streak processors similarly
```

### 2. Data Setup (Accolades)

Refer back to the "[Defining Accolades](defining-accolades.md)" page for full details. The essential steps are:

1. **Define Gameplay Tags:** Create specific tags for each accolade type (e.g., `Accolade.DoubleKill`, `Accolade.Assist`, `Accolade.ObjectiveCapture`) in Project Settings -> Gameplay Tags. Ensure processor configurations (`EliminationChainTags`, `EliminationStreakTags`) use these tags.
2. **Create Data Table:** Create a Data Table asset using `FAccoladeDefinitionRow` as the row struct (e.g., `DT_Accolades`).
3. **Populate Data Table:**
   * Add a row for each accolade tag defined in step 1.
   * Set the **Row Name** to the suffix of the Gameplay Tag (e.g., for `Accolade.DoubleKill`, the Row Name is `DoubleKill`).
   * Configure `DisplayName`, `Sound` (Soft Pointer), `Icon` (Soft Pointer), `DisplayDuration`, `LocationTag` (e.g., `HUD.Accolade.CenterScreen`), `AccoladeTags`, and `CancelAccoladesWithTag` for each row.
4. **Register Data Table:** Go to Project Settings -> Game -> Data Registry. Ensure a Registry Type with the ID `Accolades` exists and that your `DT_Accolades` asset is added to its list of Data Tables.

### 3. UI Setup (Accolades & Feed)

You need to integrate UI elements into your player HUD to display the accolades and the elimination feed.

**Accolade Host Widget (`UAccoladeHostWidget`):**

1. **Create Subclass:** It's highly recommended to create a Blueprint Widget subclass of `UAccoladeHostWidget` (e.g., `WBP_AccoladeHost`).
2. **Implement Display Events:** In `WBP_AccoladeHost`, override the **`CreateAccoladeWidget`** and **`DestroyAccoladeWidget`** events.
   * `CreateAccoladeWidget`: Takes the `FPendingAccoladeEntry` as input. Inside, create your actual visual accolade widget (e.g., `WBP_AccoladeEntry`), populate its text/image using the `Entry` data, play the `Entry.Sound`, add the `WBP_AccoladeEntry` as a child to `WBP_AccoladeHost` (or a specific panel within it), play entry animations, and return the created `WBP_AccoladeEntry`.
   * `DestroyAccoladeWidget`: Takes the `WBP_AccoladeEntry` widget as input. Play exit animations on it, then remove it from its parent.
3. **Add to HUD:** Add one or more instances of your `WBP_AccoladeHost` to your main player HUD layout widget (e.g., `WBP_PlayerHUD`).
4. **Configure `LocationName`:** For **each instance** of `WBP_AccoladeHost` placed in your HUD, select it in the UMG Designer and set its **`Location Name`** property (a Gameplay Tag) in the Details panel. This tag **must match** the `LocationTag` set in the `DT_Accolades` rows for the accolades you want this specific host instance to display.

**Elimination Feed Widget:**

1. **Create Custom Widget:** Create a completely new UMG Widget Blueprint (e.g., `WBP_EliminationFeed`) to display the scrolling feed. This is _not_ based on `UAccoladeHostWidget`.
2. **Listen for Messages:** In the Event Graph of `WBP_EliminationFeed`, get the `GameplayMessageSubsystem`. In `Event Construct`, register a listener for the tag `TAG_Lyra_Notification_KillFeed` (`Lyra.AddNotification.KillFeed`). Bind a custom event (e.g., `OnEliminationFeedReceived`) to this listener. Remember to unregister the listener in `Event Destruct`.
3. **Handle Message:** Implement the `OnEliminationFeedReceived` custom event. It will receive the `FEliminationFeedMessage` struct.
4. **Create Feed Entry:** Inside the handler, use the data from the message (`Attacker`, `Attackee`, `AttackerTeamID`, `AttackeeTeamID`, `InstigatorTags`) to:
   * Create another small widget representing a single row in the feed (e.g., `WBP_EliminationFeedRow`).
   * Populate this row widget with the text, potentially styling it based on team IDs or comparing them to the local player's team ID.
   * Add the newly created `WBP_EliminationFeedRow` to a container within `WBP_EliminationFeed` (like a `Vertical Box` or `Scroll Box`).
5. **Manage Feed Display:** Implement logic within `WBP_EliminationFeed` to handle scrolling, limiting the number of visible entries, and fading out/removing old entries after a certain time.
6. **Add to HUD:** Add an instance of your `WBP_EliminationFeed` to your main player HUD layout widget.

### 4. Triggering Custom Accolades

Eliminations, assists, chains, and streaks are handled automatically by the processors if they are added. To trigger accolades for other events (e.g., capturing a flag, completing an objective, crafting an item):

1. **Identify Trigger Point:** Find the server-side C++ or Blueprint code where the custom event occurs (e.g., in a Gameplay Ability's activation, in the Game Mode logic checking for objective completion).
2. **Ensure Server Context:** Verify this code is running on the server (`HasAuthority()` check).
3. **Construct Message:** Create an instance of `FLyraVerbMessage`.
4. **Set Verb Tag:** Set the `Verb` field to the specific Gameplay Tag of the custom accolade you defined in your `DT_Accolades` (e.g., `Accolade.ObjectiveCapture`).
5. **Set Instigator:** Set the `Instigator` field to the `APlayerState` of the player who earned the accolade.
6. **Broadcast Message:** Get the `UGameplayMessageSubsystem` and broadcast the message. You should broadcast it on the channel the `UAccoladeRelay` is listening on (`TAG_Lyra_Accolodate_Message` or directly on the `Verb` tag if configured that way).

**Conceptual Blueprint Example (within server-side logic):**

```blueprint
Sequence
|
-> Branch (Has Authority)
   |
   (True) -> Get Gameplay Message Subsystem
           |
           -> Make LyraVerbMessage
              | Verb: Accolade.ObjectiveCapture (Gameplay Tag)
              | Instigator: (Get Player State of player who captured objective)
           |
           -> Broadcast Message (Gameplay Message Subsystem)
              | Channel: Accolade.ObjectiveCapture (Or TAG_Lyra_Accolodate_Message)
              | Message: (Output of Make LyraVerbMessage)
```

### Summary Checklist

* [ ] Added server processors/relays to GameState via Lyra Experience?
* [ ] Configured processor settings (time limits, tag maps)?
* [ ] Defined Accolade Gameplay Tags?
* [ ] Created Accolade Data Table (`FAccoladeDefinitionRow`)?
* [ ] Populated Data Table with correct Row Names and properties (Text, Assets, Tags)?
* [ ] Registered Data Table in Data Registry under ID `Accolades`?
* [ ] Created Blueprint subclass of `UAccoladeHostWidget`?
* [ ] Implemented `CreateAccoladeWidget` and `DestroyAccoladeWidget` in BP subclass?
* [ ] Added `UAccoladeHostWidget` instance(s) to HUD?
* [ ] Set correct `LocationName` tag on each Host Widget instance?
* [ ] Created custom UMG widget for Elimination Feed?
* [ ] Implemented message listening (`Lyra.AddNotification.KillFeed`) and entry display logic in Feed widget?
* [ ] Added Feed widget instance to HUD?
* [ ] Verified custom accolade triggers broadcast correct messages on the server?

Following these steps will integrate the core functionality of the Accolade and Elimination Feed systems into your game, ready for further customization and extension.

***
