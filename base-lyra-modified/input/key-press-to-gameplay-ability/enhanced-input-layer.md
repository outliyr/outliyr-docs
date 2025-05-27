# Enhanced Input Layer

The very first step in Lyra's input processing chain (and indeed, any modern Unreal Engine project utilizing it) is handled by the **Enhanced Input Plugin**. This system is responsible for taking raw hardware inputs—like a key press, mouse movement, or gamepad button press—and translating them into abstract, game-relevant signals. The two primary assets at this stage are the `Input Mapping Context` (IMC) and the `Input Action` (IA).

### **`UInputMappingContext` (IMC)**

* **Role:** An `Input Mapping Context` is a Data Asset that defines a collection of mappings between specific physical hardware inputs and abstract `Input Actions`. Think of it as a "control scheme" or a "layer" of input bindings. For example, you might have one IMC for general gameplay controls (`IMC_Default_KBM`), another for vehicle controls (`IMC_Vehicle_KBM`), and yet another for menu navigation (`IMC_Menu_Navigation_KBM`).
* **Creation & Configuration:**
  * You create IMCs in the Content Browser (Right-click > Input > Input Mapping Context).
  * Inside the IMC editor, you add mappings. Each mapping links:
    * A specific **Key** (e.g., `W`, `Space Bar`, `Gamepad Left Thumbstick Y-Axis`, `Mouse X-Axis`).
    * To an **`Input Action`** asset (covered next).
    * Optionally, **Triggers** and **Modifiers** can be added to this mapping (discussed briefly below).
* **Activation & Priority:**
  * IMCs must be added to the `UEnhancedInputLocalPlayerSubsystem` to become active for a player. In Lyra, this is typically handled by the `ULyraHeroComponent` based on configurations in `ULyraPawnData` or via `GameFeatureAction_AddInputContextMapping`.
  * Active IMCs have a **Priority** value. If multiple active IMCs map the same hardware input, the IMC with the higher priority will be processed first. If it "consumes" the input, lower-priority IMCs might not receive it. This is useful for situations like a pause menu (high priority) needing to override gameplay inputs (lower priority).
* **Example:** An IMC named `IMC_Player_KBM` might contain:
  * Mapping: `W` key -> `IA_MoveForward`
  * Mapping: `Space Bar` key -> `IA_Jump`
  * Mapping: `Left Mouse Button` -> `IA_PrimaryFire`

**`UInputAction` (IA)**

* **Role:** An `Input Action` is a Data Asset that represents an abstract, logical action a player can perform within the game. It defines _what_ the player is trying to do, not _how_ they are doing it (i.e., which specific key they pressed). Examples include "Move Character," "Jump," "Fire Weapon," "Interact."
* **Creation:** You create IAs in the Content Browser (Right-click > Input > Input Action).
* **Value Types:** A crucial property of an `Input Action` is its **Value Type**, which determines the kind of data it will output when triggered:
  * `Boolean`: For on/off actions (e.g., jump pressed/released).
  * `Axis1D`: For actions with a single continuous value (e.g., throttle, mouse wheel scroll).
  * `Axis2D`: For actions with two continuous values (e.g., gamepad stick movement, mouse movement for looking).
  * `Axis3D`: For actions with three continuous values (less common for standard player input, more for motion controllers).\
    The Value Type should match the type of input you expect. For example, a "Move Forward/Backward" action driven by W/S keys might be an `Axis1D` (W gives +1, S gives -1), while mouse look would be `Axis2D`.
* **Triggers & Modifiers (on the IA itself):** `Input Actions` can also have their own list of default Triggers and Modifiers, which apply globally whenever that IA is triggered, regardless of which IMC mapping activated it. However, it's often more flexible to apply these per-mapping within the IMC.

### **Input Triggers & Modifiers (Brief Overview)**

While a deep dive into all available Triggers and Modifiers is beyond the scope of this initial overview, it's important to understand their general purpose within the Enhanced Input layer:

* **Triggers:** Define the conditions under which an `Input Action` mapping fires. For example:
  * `Pressed`: Fires when the key is initially pressed.
  * `Released`: Fires when the key is released.
  * `Down`: Fires every tick the key is held down.
  * `Hold`: Fires after a key has been held for a specified duration.
  * `Tap`: Fires if a key is pressed and released quickly.\
    These are added to individual key mappings within an `Input Mapping Context`.
* **Modifiers:** Process the raw input value from the hardware _before_ it's passed to the `Input Action`. For example:
  * `Negate`: Inverts the input value (e.g., turns `1.0` into `-1.0`).
  * `Scalar`: Multiplies the input value by a factor.
  * `Dead Zone`: Ignores small input values, useful for analog sticks.
  * `Swizzle Input Axis Values`: Remaps or ignores axes from a multi-axis input (e.g., using only the Y-axis of a 2D mouse input).\
    Modifiers can be added to individual key mappings within an `Input Mapping Context` or globally to an `Input Action` asset itself. Lyra provides several custom modifiers (e.g., `ULyraInputModifierGamepadSensitivity`, `ULyraInputModifierDeadZone`) that are often applied here. These will be discussed in more detail in the "Customizing Input Behavior" section.

***

### Summary

The Enhanced Input Layer, through `Input Mapping Contexts` and `Input Actions`, takes raw physical inputs and transforms them into meaningful, abstract game actions.

* `IMCs` define _which keys_ trigger _which IAs_.
* `IAs` define _what logical action_ is being performed, along with the type of data it carries.
* Triggers and Modifiers refine _when_ and _how_ these actions fire and what their values are.

This structured approach separates hardware concerns from gameplay logic, making the input system more adaptable and easier to manage.

#### **Next Step in the Journey:**

With an `Input Action` now triggered and carrying a value, the system needs to decide what specific game logic or ability this corresponds to. This is where Lyra's custom layer, primarily the `ULyraInputConfig`, comes into play.

***
