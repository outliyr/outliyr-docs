# Input

This system is foundational to how players interact with the game world, controlling characters and activating abilities. It's built upon two powerful Unreal Engine systems: **Enhanced Input** and the **Gameplay Ability System (GAS)**. Our goal here is to provide you with a clear understanding of how these systems work together, enabling you to effectively customize and extend input functionality.

### Why Lyra's Approach to Input?

Lyra's input architecture is designed to be robust, flexible, and highly data-driven. This offers several key advantages for developers:

* **Data-Driven Configuration:** Much of the input setup—from mapping raw key presses to defining what actions they trigger—is handled through Data Assets (`Input Actions`, `Input Mapping Contexts`, `Lyra Input Configs`). This means less hard-coding and more iteration speed, allowing you to tweak input behavior directly in the editor.
* **Seamless Gameplay Ability System (GAS) Integration:** Input events can directly trigger complex Gameplay Abilities. This powerful connection allows for sophisticated character actions and interactions to be initiated by player input with minimal boilerplate code.
* **Support for Advanced Input Processing:** The system inherently supports:
  * **Input Modifiers:** Raw input values can be processed through modifiers (e.g., dead zones, sensitivity scaling, axis inversion) before an action is triggered.
  * **User Settings:** Players can rebind keys and adjust input preferences, which are respected by the system.
  * **Platform Adaptability:** Enhanced Input is designed to handle input from various devices and platforms more easily.
* **Modularity via Game Feature Plugins:** Input schemes, new actions, and ability bindings can be encapsulated within Game Feature Plugins. This means you can add or alter input functionality for specific game modes or content updates without deeply modifying core systems, promoting a cleaner, more extensible architecture.

### The Big Picture: How an Input Becomes an Action or Ability

Understanding the flow of an input event from the player's physical action to an in-game result is crucial. Here's a high-level overview of this journey:

1. **Player Input:** The player presses a key, moves a mouse, or uses a gamepad stick.
2. **Enhanced Input Subsystem Processing:** Unreal Engine's **Enhanced Input Subsystem** captures this hardware event. It looks at the active `Input Mapping Contexts` (IMCs) to see if this hardware input is recognized.
3. **Mapping to an Input Action:** If a match is found in an IMC, the hardware input is translated into an abstract `Input Action` (IA) (e.g., "IA_Jump," "IA_PrimaryFire").
4. **Lyra's Interpretation (ULyraInputConfig):**
   * **(For Gameplay Abilities):** A `ULyraInputConfig` Data Asset maps this `Input Action` to a specific `GameplayTag` (e.g., `InputTag.Ability.Jump`). This tag acts as an identifier for the _intent_ to perform an ability.
   * **(For Native C++ Actions):** Similarly, an `Input Action` can be mapped to a `GameplayTag` (e.g., `InputTag.Move.Forward`) intended for direct C++ function calls, like character movement.
5. **Binding and Dispatch (ULyraInputComponent):** A specialized input component on the Pawn (`ULyraInputComponent`), often set up by the `ULyraHeroComponent`, has bindings for these `Input Actions` (identified by their Gameplay Tags from the `ULyraInputConfig`).
6. **Notifying Systems:**
   * **(For Gameplay Abilities):** When an ability-related `Input Action` is triggered, the `ULyraInputComponent` (via the `ULyraHeroComponent`) notifies the Pawn's `Ability System Component` (ASC) that the associated `InputTag` (e.g., `InputTag.Ability.Jump`) has been pressed or released.
   * **(For Native C++ Actions):** The `ULyraInputComponent` directly calls the bound C++ function (e.g., a movement function on the `ULyraHeroComponent`).
7. **Ability Activation (Ability System Component):** The `Ability System Component` (ASC) then checks if any of its granted Gameplay Abilities are configured to activate in response to the received `InputTag`. If so, it attempts to activate the ability.

This flow, while involving several components, provides a highly decoupled and configurable system. We will explore each of these steps in greater detail in the subsequent pages.

### Key Terminology

As you delve into Lyra's input system, you'll encounter these terms frequently:

* **Input Mapping Context (IMC):** An asset defining how physical hardware inputs (e.g., 'W' key, Left Mouse Button) map to abstract `Input Actions`. Multiple IMCs can be active with different priorities.
* **Input Action (IA):** An asset representing an abstract input a player can perform (e.g., "Move," "Jump," "Fire," "Interact"). They define the _what_ of an input, not the _how_.
* **Lyra Input Config (ULyraInputConfig):** A Lyra-specific Data Asset that acts as a bridge. It maps `Input Actions` to `Gameplay Tags` which are then used to either trigger Gameplay Abilities or call native C++ functions.
* **Input Tag:** A `Gameplay Tag` used specifically to identify an input event or the ability/action it's meant to trigger (e.g., `InputTag.Ability.Primary`, `InputTag.Character.Jump`).
* **Gameplay Ability System (GAS):** A comprehensive Unreal Engine framework for creating and managing character abilities, attributes, and status effects.
* **Ability System Component (ASC):** The core GAS component, typically attached to a Pawn or PlayerState. It owns and manages an actor's abilities, attributes, and active gameplay effects.

### Structure of this Documentation

To help you navigate this complex but powerful system, this documentation is structured as follows:

* **The Journey of an Input:** A detailed, step-by-step breakdown of how a key press translates into a Gameplay Ability.
* **Configuring Input:** How to set up and link the various Data Assets (`InputMappingContext`, `InputAction`, `ULyraInputConfig`) and leverage Game Features for modular input.
* **Customizing Input Behavior:** Information on using Lyra's custom input modifiers, handling sensitivity, and managing user settings like key rebinding.
* **Advanced & Low-Level Input:** Details on more specialized input components and functionalities.
* **Practical Guides & How-Tos:** Step-by-step instructions for common input-related development tasks.

Let's begin by taking a closer look at the journey of an input.

***
