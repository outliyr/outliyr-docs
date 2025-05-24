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

#### Core Concept

At its core, this system allows the player to interact with objects in the world by:

1. **Detecting nearby or focused interactable objects**
2. **Querying those objects for available interactions**
3. **Optionally granting abilities to the player for those interactions**
4. **Triggering the interaction, activating an ability on either the player or the object**

***

### Interaction Flow

#### 1. **Detection**

Detection happens through two approaches:

* **Proximity Scan:** Using sphere overlaps (handled by `UAbilityTask_GrantNearbyInteraction`)
* **Line Trace Scan:** Using ray tracing (handled by `UAbilityTask_WaitForInteractableTargets_SingleLineTrace`)

Both tasks search for actors or components that implement the `IInteractableTarget` interface.

#### 2. **Option Querying**

Once an interactable is detected, the system queries it using `GatherInteractionOptions`, passing in an `FInteractionQuery` that contains contextual info like the player, controller, etc.

Each interactable can return one or more `FInteractionOption`s, which define:

* The ability to trigger
* Display text and widgets
* Target ability systems
* Hold duration
* location to spawn the widget

These options are then filtered and passed to the interaction UI system.

#### 3. **Ability Granting**

If the `FInteractionOption` includes an `InteractionAbilityToGrant`, that ability is granted to the player temporarily while they remain nearby.

This is done via GAS and allows the player to press an input (e.g. "Interact") to trigger the granted ability.

**Key point:**

* If the interaction is **initiated by the player**, the granted ability is activated by the player’s own Ability System Component.
* If the interaction is **owned by the target**, the ability is triggered on the target’s Ability System Component instead.

#### 4. **Triggering the Interaction**

When the player chooses to interact (via input), the granted ability (typically `ULyraGameplayAbility_Interact`) performs the following:

* Takes the current focused interaction option
* Sends a `FGameplayEventData` with the tag `TAG_Ability_Interaction_Activate`
* Triggers the target ability (on the player or target) using GAS
* Optionally allows the interactable to modify the event payload using `CustomizeInteractionEventData`

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
