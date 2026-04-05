# Input

This system is foundational to how players interact with the game world, controlling characters and activating abilities. It's built upon two powerful Unreal Engine systems: **Enhanced Input** and the **Gameplay Ability System (GAS)**. Our goal here is to provide you with a clear understanding of how these systems work together, enabling you to effectively customize and extend input functionality.

## Why Lyra's Approach to Input?

Lyra's input architecture is designed to be robust, flexible, and highly data-driven. This offers several key advantages for developers:

* **Data-Driven Configuration:** Much of the input setup, from mapping raw key presses to defining what actions they trigger, is handled through Data Assets (`Input Actions`, `Input Mapping Contexts`, `Lyra Input Configs`). This means less hard-coding and more iteration speed, allowing you to tweak input behavior directly in the editor.
* **Seamless Gameplay Ability System (GAS) Integration:** Input events can directly trigger complex Gameplay Abilities. This powerful connection allows for sophisticated character actions and interactions to be initiated by player input with minimal boilerplate code.
* **Support for Advanced Input Processing:** The system inherently supports:
  * **Input Modifiers:** Raw input values can be processed through modifiers (e.g., dead zones, sensitivity scaling, axis inversion) before an action is triggered.
  * **User Settings:** Players can rebind keys and adjust input preferences, which are respected by the system.
  * **Platform Adaptability:** Enhanced Input is designed to handle input from various devices and platforms more easily.
* **Modularity via Game Feature Plugins:** Input schemes, new actions, and ability bindings can be encapsulated within Game Feature Plugins. This means you can add or alter input functionality for specific game modes or content updates without deeply modifying core systems, promoting a cleaner, more extensible architecture.

### The Pipeline

{% stepper %}
{% step %}
#### Hardware to Enhanced Input

Player presses a key or moves a stick, the hardware event is captured by the Enhanced Input Subsystem.
{% endstep %}

{% step %}
#### IMC to Input Action

Enhanced Input maps the hardware event to an abstract Input Action via the active Input Mapping Contexts.
{% endstep %}

{% step %}
#### Input Action to Gameplay Tag

The Input Action is translated to a Gameplay Tag through a `ULyraInputConfig` data asset.
{% endstep %}

{% step %}
#### Dispatch

`ULyraInputComponent` dispatches the tag, either to a native C++ handler (movement, look) or to the Ability System Component.
{% endstep %}

{% step %}
#### Ability Activation

The ASC finds granted abilities matching the input tag and activates them based on their activation policy.
{% endstep %}
{% endstepper %}

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

* [**The Journey of an Input**](key-press-to-gameplay-ability.md)**:** A detailed, step-by-step breakdown of how a key press translates into a Gameplay Ability.
* [**Configuring Input**](configuring-input.md)**:** How to set up and link the various Data Assets (`InputMappingContext`, `InputAction`, `ULyraInputConfig`) and leverage Game Features for modular input.
* [**Customizing Input Behavior**](customizing-input-behaviour.md)**:** Information on using Lyra's custom input modifiers, handling sensitivity, and managing user settings like key rebinding.
* [**Advanced & Low-Level Input**](low-level-input.md)**:** Details on more specialized input components and functionalities.
* [**Practical Guides**](practical-guides.md)**:** Step-by-step instructions for common input-related development tasks.

Let's begin by taking a closer look at the journey of an input.

***
