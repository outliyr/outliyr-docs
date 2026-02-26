# Key Press To Gameplay Ability

### The Journey of an Input: From Key Press to Gameplay Ability

Understanding the complete lifecycle of an input event is key to mastering Lyra's input system, especially when it comes to activating Gameplay Abilities. This section breaks down the intricate path an input takes, from the moment a player interacts with their hardware to the point where an ability is triggered or a native action is executed.

Think of this as a relay race, where each component or system hands off information to the next, adding its specific layer of processing or interpretation.

The journey can be broadly divided into these key stages, each of which will be explored in detail on its respective sub-page:

1. **The Enhanced Input Layer (`InputMappingContext` & `InputAction`):**
   * This is where the physical hardware input (a key press, mouse movement, gamepad stick deflection) is first captured by Unreal Engine's Enhanced Input system.
   * `Input Mapping Contexts` (IMCs) define which hardware inputs are relevant and what abstract `Input Actions` (IAs) they correspond to.
   * `Input Actions` represent the generic "intent" of the player (e.g., "I want to move forward," "I want to jump").
   * Input Modifiers and Triggers can further refine the raw input before it's considered "fired."
2. **Lyra's Bridge (`ULyraInputConfig`):**
   * Once an `Input Action` is triggered by the Enhanced Input system, Lyra needs a way to understand what to do with it, especially in the context of its Gameplay Tag-driven architecture.
   * The `ULyraInputConfig` Data Asset serves this crucial bridging role. It translates a generic `Input Action` into a specific `GameplayTag`.
   * These tags differentiate between inputs meant for native C++ functions (like basic movement) and those intended to activate Gameplay Abilities.
3. **Binding & Dispatch (`ULyraInputComponent` & `ULyraHeroComponent`):**
   * With the input now associated with a `GameplayTag` via the `ULyraInputConfig`, the next step is to bind this to actual game logic.
   * The `ULyraInputComponent`, which resides on the Pawn, is responsible for creating these bindings.
   * The `ULyraHeroComponent` orchestrates the setup of these bindings for player-controlled Pawns.
   * For ability-related inputs, this stage typically involves binding the `Input Action` (via its tag) to functions within the `ULyraHeroComponent` that will, in turn, notify the Ability System Component.
   * For native inputs, the `Input Action` (via its tag) is bound directly to a C++ function.
4. **Gameplay Ability Activation (`ULyraAbilitySystemComponent` & `ULyraGameplayAbility`):**
   * This is the final stage for inputs intended to trigger Gameplay Abilities.
   * The `ULyraAbilitySystemComponent` (ASC) on the Pawn (or PlayerState) receives the `InputTag` from the `ULyraHeroComponent`.
   * The ASC then searches through its list of granted abilities to find any that are associated with this specific `InputTag`.
   * If a match is found, and all conditions are met (cooldowns, costs, activation policies), the `ULyraGameplayAbility` is activated.

Each of these stages involves specific assets and C++ classes working in concert. The following sub-pages will dissect each stage, explaining the "why" and "how" of their individual roles and interactions. By understanding this entire pipeline, you'll be well-equipped to debug, customize, and extend Lyra's input system to suit your project's needs.

***
