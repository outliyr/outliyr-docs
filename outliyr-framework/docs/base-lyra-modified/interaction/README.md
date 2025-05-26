# Interaction

The Interaction System allows players to interact with objects in the world through **GAS-driven gameplay abilities**. It is designed to support both **automatic interactions based on proximity** and **manual interactions through aiming or tracing**, using a flexible, modular, and multiplayer-safe architecture.

This system enables features such as:

* Pressing a button to open a door
* Holding a key to pick up an item
* Context-sensitive interaction UIs
* Proximity-based ability granting
* Server-authoritative ability activation

The interaction system is entirely opt-in and driven by gameplay tags, interfaces, and ability components. It is intended to be used within the GAS (Gameplay Ability System) framework and fully supports networked multiplayer.

***

### How the Interaction System Works

The interaction system enables players to interact with world objects through a coordinated series of steps:

* **Detect interactable objects**, using both:
  * A sphere overlap (for nearby objects that may grant abilities)
  * A line trace (for focused/aimed-at objects that determine current options)
* **Query detected objects** for available interaction options via the `IInteractableTarget` interface
* **Grant abilities to the player**, if required by the interaction (e.g., proximity-based loot or terminals)
* **Filter and display valid interaction options** based on current focus and ability availability
* **Trigger the selected interaction**, activating an ability either on the player or on the target object

***

### Actor Responsibilities

#### `IInteractableTarget`

Implemented by any actor or component that can be interacted with. It defines:

* What options it supports (`GatherInteractionOptions`)
* How it customizes the event data (`CustomizeInteractionEventData`)
* Cosmetic effects on proximity (`Nearby`, `NoLongerNearby`, `SetFocused`)

#### `ULyraGameplayAbility_Interact`

This is the core ability used by the player to manage nearby interactions:

* Tracks nearby interactables
* Spawns UI widgets for each interaction
* Sends interaction events when triggered
* Focuses interactables for highlight/feedback

#### `FInteractionOption`

Defines how an interaction works, including:

* Abilities to grant
* Abilities to trigger
* UI to display
* Duration of hold, etc.

#### `UAbilityTask_GrantNearbyInteraction`

Runs in the background while the interaction ability is active:

* Continuously scans for nearby interactables
* Grants abilities defined in interaction options
* Notifies actors when the player enters/exits range

#### `UAbilityTask_WaitForInteractableTargets`

Similar to the above, but uses ray traces to detect interactables based on where the player is looking.

***

### GAS Integration

This system heavily utilizes the Gameplay Ability System for:

* Granting interaction abilities
* Triggering interaction events
* Passing contextual data (`FGameplayEventData`)
* Activating abilities on different actors (player or target)

It ensures that:

* All ability execution is server-authoritative
* Events are flexible and customizable
* UI is purely cosmetic and client-driven

***

### Typical Use Case

1. You place an actor in the world and implement `IInteractableTarget`.
2. When the player is near (or looking at) the actor, it is detected by the appropriate task.
3. The actor returns interaction options (e.g. "Open", "Pick Up").
4. The player receives a temporary ability (if needed) or activates the option through the UI/input.
5. The system fires the event, and GAS triggers the ability either on the player or the actor.

***

### Extending the System

You can extend the system by:

* Adding new `FInteractionOption` types (e.g. timed puzzles, resource usage).
* Creating new UMG widgets to show interaction details.
* Overriding `CustomizeInteractionEventData` to provide richer payloads.
* Adding support for interaction queues, menus, or confirmation dialogs.
* Creating new interaction abilities that use `ULyraGameplayAbility_Interact` as a base.

***

### Notes

* All interaction logic is multiplayer-aware and GAS-safe.
* Cosmetic feedback (e.g. UI, highlighting) only occurs client-side.
* All triggering of abilities is done through `FGameplayEventData` for flexibility and decoupling.
