# Aim Assist

Welcome to the documentation for the Aim Assist system! This system is designed to enhance the gameplay experience, particularly for players using gamepads, by providing subtle assistance in targeting. This page will give you a high-level understanding of what our Aim Assist system does, its design goals, and the main components you'll interact with.

> [!info]
> This was originally made by Lyra, in their shooter core game feature.

### What is Aim Assist in This Asset?

At its core, the Aim Assist system in this asset is a sophisticated tool that subtly helps players keep their aiming reticle on or near designated targets. It's not an "auto-aim" that snaps directly to targets, but rather a nuanced system that provides a gentle guiding hand. This is primarily achieved through two core mechanics:

* **Target Pull (Magnetism):** When a valid target is near the player's reticle, the system can apply a gentle force to nudge the camera's rotation towards that target. This helps players track moving targets or make micro-adjustments more easily.
* **Aim Slowdown (Friction):** As the player's reticle passes over or near a target, the look sensitivity can be dynamically reduced. This "friction" makes it easier to stay on target and avoid overshooting, especially during precise aiming moments.

The entire system is implemented as an **`InputModifier`** within Unreal Engine's **Enhanced Input system**. This means it integrates directly into the input processing pipeline, modifying the player's look input before it's applied to the camera.

### Design Philosophy & Goals

This Aim Assist system was developed with several key principles in mind:

* **Intuitive Feel:** The goal is for the assistance to feel natural and responsive, enhancing the player's skill rather than overshadowing it. It should be subtle enough that players may not always consciously notice it, but appreciate its benefits.
* **Fairness and Configurability:** Aim assist should be a tool that can be finely tuned. The system offers extensive configuration options to allow you, the developer, to tailor its behavior to match the desired feel and balance of your game – whether it's a fast-paced shooter or a more tactical experience.
* **Performance:** The system is designed to be efficient, minimizing its impact on game performance, even when multiple potential targets are present.
* **A Foundation, Not a Final Product:** While this system is robust and ready to use, it's also built as a foundation. I encourage you to understand its workings so you can extend, modify, and integrate it deeply into your project's specific mechanics, rather than treating it as a black box or something to simply "rip out" for isolated use.

The design draws inspiration from established systems like Lyra's, but has been structured to be a clear and adaptable base for your game.

### Key Components Overview (The "Cast of Characters")

To understand how aim assist functions, it's helpful to know the main actors involved. We'll dive deeper into each of these in subsequent pages, but here's a quick introduction:

* **`UAimAssistInputModifier`:** Think of this as the **brain** of the operation. It intercepts the player's raw look input, orchestrates the search for targets, calculates the necessary adjustments, and applies the final assisted input.
* **`UAimAssistTargetManagerComponent`:** This component acts as the **scout**. It's responsible for scanning the game world around the player to find and validate potential actors that could be targeted by aim assist.
* **`IAimAssistTaget` (Interface) & `UAimAssistTargetComponent` (Component):** These are the **markers**. Actors that should be considered by the aim assist system need to either implement the `IAimAssistTaget` interface or use the `UAimAssistTargetComponent` to declare themselves as targetable and provide necessary information like their shape.
* **`FAimAssistSettings` (Struct):** This is the **rulebook**. It's a collection of parameters that define precisely _how_ the aim assist behaves – things like the strength of the pull, the amount of slowdown, the size of the assist reticles, and much more.
* **`FAimAssistFilter` (Struct):** This acts as the **bouncer**. It determines which potential targets are actually considered for aim assist based on criteria like team affiliation, actor type, or specific gameplay tags.

In the following pages, we'll explore how these components work together in a "journey of an input" to bring aim assist to life.
