# Extending the System

The Shooter Base Accolade system is designed with flexibility and extensibility in mind. While the built-in processors and relay handle common shooter scenarios, you will likely want to tailor the system further to match your game's unique mechanics and reward structure. This page outlines common ways to extend and customize the system.

### 1. Creating Custom Accolade Types (Data-Driven)

The simplest way to add variety is by defining new types of accolades that can be triggered by existing mechanisms (like the built-in processors or manual triggers).

**Steps:**

1. **Define Gameplay Tag:** Create a new, specific Gameplay Tag for your custom accolade (e.g., `Accolade.Gameplay.Headshot`, `Accolade.Objective.FlagReturned`). Follow a consistent naming convention.
2. **Add Data Table Row:**
   * Open your main Accolade Data Table (`DT_Accolades`).
   * Add a new row.
   * Set the **Row Name** to the suffix of your new Gameplay Tag (e.g., `Headshot` or `FlagReturned`).
   * Configure the `DisplayName`, `Sound`, `Icon`, `DisplayDuration`, `LocationTag`, `AccoladeTags`, and `CancelAccoladesWithTag` properties for this new accolade type just like any other.
3. **Trigger the Accolade:** Ensure that the corresponding Gameplay Tag (e.g., `Accolade.Gameplay.Headshot`) is broadcast as the `Verb` in a `FLyraVerbMessage` when the condition occurs.
   * **If using existing processors:** You might need to modify a processor's configuration map (like `EliminationChainTags`) if the new accolade fits its pattern (e.g., adding `Accolade.MegaKill` for a chain of 6).
   * **If manually triggering:** Follow the steps in "Setup & Integration -> Triggering Custom Accolades" to broadcast the message from your server-side game logic (Gameplay Abilities, Game Mode, etc.) when the specific event happens.

This purely data-driven approach allows designers to add many new reward types without requiring new C++ or complex Blueprint logic, provided the trigger event already exists or can be easily added.

### 2. Creating Custom Processors (`UGameplayMessageProcessor`)

For accolades based on entirely new conditions or patterns not covered by existing processors or simple manual triggers, you'll need to create a custom processor.

**Steps:**

1. **Create New Class:** Create a new C++ class (or Blueprint class, though C++ is often preferred for server logic) inheriting from `UGameplayMessageProcessor`.
2. **Define State (if needed):** In your class header (`.h`), declare any member variables needed to track the state required to detect your condition (e.g., a `TMap` to track player interactions with an objective, a `float` to track accumulated damage of a specific type). Mark them with `UPROPERTY()` if they need reflection or garbage collection (`Transient` is often appropriate for state maps).
3. **Override `StartListening()`:** In your class source (`.cpp` or Blueprint Event Graph), override the `StartListening` function.
   * Get the `UGameplayMessageSubsystem`.
   * Register listeners (`RegisterListener`) for the specific Gameplay Messages that provide the input data for your logic (e.g., `Lyra.Damage.Message`, a custom `MyGame.ObjectiveInteraction.Message`, etc.).
   * Use `AddListenerHandle` to ensure automatic cleanup.
4. **Implement Listener Functions:** Create the functions that will be called when the messages you registered for are received (e.g., `void UMyCustomProcessor::OnObjectiveInteraction(FGameplayTag Channel, const FMyObjectiveMessage& Payload)`).
5. **Implement Logic:** Inside your listener functions:
   * Perform necessary checks (e.g., `HasAuthority()`).
   * Update the internal state you defined in step 2 based on the incoming message payload.
   * Check if the conditions for your custom accolade have now been met based on the updated state.
6. **Broadcast Accolade Message:** If the conditions _are_ met:
   * Construct a `FLyraVerbMessage`.
   * Set the `Verb` to the Gameplay Tag of the custom accolade you defined (e.g., `Accolade.MyGame.ComboBreaker`).
   * Set the `Instigator` to the relevant `APlayerState`.
   * Populate other fields (`Magnitude`, `ContextTags`) as needed.
   * Broadcast the message using the `GameplayMessageSubsystem`, targeting the channel the `UAccoladeRelay` listens on (or directly on the `Verb` tag).
7. **Add to GameState:** Integrate your new custom processor into the game by adding it as a component to the `GameState` via Lyra Experiences or manual addition, ensuring it only spawns on the server (see "Setup & Integration").

**Example Idea: Headshot Processor**

* Listen to `Lyra.Damage.Message`.
* Check if the damage message payload contains a specific Gameplay Tag indicating a headshot (e.g., `Damage.Type.Headshot` - this would need to be added by the damage calculation logic).
* If it does, and if the damage resulted in an elimination (perhaps check an accompanying `Lyra.Elimination.Message` or have the damage message indicate fatality), broadcast `FLyraVerbMessage` with `Verb = Accolade.Gameplay.Headshot`.

### 3. Customizing Accolade Widgets

The visual flair of your accolades comes from the implementation of `CreateAccoladeWidget` and `DestroyAccoladeWidget` within your `UAccoladeHostWidget` Blueprint subclass.

**Ideas for Customization:**

* **Unique Animations:** Implement distinct intro/outro animations based on the `AccoladeTags` or even the specific `PayloadTag` found within the `FPendingAccoladeEntry`.
* **Dynamic Text/Icons:** Change text color, font size, or even swap icons based on the `Magnitude` field (e.g., showing the streak number within the accolade text).
* **Sound Variation:** Play different sound cues based on the accolade type or magnitude.
* **Interaction:** Have accolades briefly interact with other UI elements (e.g., highlighting a score counter).
* **Advanced Styling:** Use materials, particles, or complex UMG animations for high-impact accolades.

Remember to keep performance in mind, especially if creating many complex widgets rapidly.

### 4. Adding New Display Locations

If you want different categories of accolades to appear in different screen regions (e.g., multi-kills center-screen, objective points near the objective tracker), simply:

1. **Define Location Tags:** Ensure you have distinct Gameplay Tags defined for your locations (e.g., `HUD.Accolade.CenterScreen`, `HUD.Accolade.ObjectiveFeed`).
2. **Configure Data Table:** Assign the appropriate `LocationTag` to each accolade definition in your `DT_Accolades`.
3. **Add Host Widget Instances:** Place multiple instances of your `WBP_AccoladeHost` (or different subclasses if needed) into your main HUD layout.
4. **Set `LocationName`:** For each instance, set its `LocationName` property in the UMG editor to match one of the location tags you defined (e.g., one instance gets `HUD.Accolade.CenterScreen`, another gets `HUD.Accolade.ObjectiveFeed`).

The system will automatically route accolades defined with a specific `LocationTag` only to the host widget instance configured with the matching `LocationName`.

### Advanced Considerations

* **Scoring/Experience:** You could create another system (perhaps another `UGameplayMessageProcessor`) that listens for the same accolade `Verb` tags (like `Accolade.DoubleKill`) and grants score or experience points to the `Instigator`.
* **Magnitude Display:** The `Magnitude` field in `FLyraVerbMessage` (carried through to `FPendingAccoladeEntry`) can be used creatively. While Streaks/Chains use it for the count, you could use it to pass other data like the amount of damage dealt for an Assist accolade and display it in the `CreateAccoladeWidget` function.
* **Complex Dependencies:** If you need accolades that depend on the _combination_ of other recent accolades or complex game state, custom processors become essential.

By leveraging data definition, custom processors, and Blueprint UI customization, you can extend the Shooter Base Accolade system significantly to create a rich and rewarding feedback experience tailored precisely to your game.

***
