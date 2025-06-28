# Inventory Ability Function Library

The `UInventoryAbilityFunctionLibrary` is a dedicated Blueprint Function Library designed to simplify the process of triggering Gameplay Abilities related to inventory actions, particularly from User Interface widgets or other Blueprint logic. It acts as the primary bridge for sending requests into the GAS layer, packaging the necessary data correctly.

### Purpose

* **Blueprint Accessibility:** Provides easy-to-use Blueprint nodes for common inventory-related GAS interactions.
* **Data Packaging:** **(`FInstancedStruct`):** Handles the complexity of wrapping different **USTRUCT** data types (like `FAbilityData_SourceItem` derivatives) into FInstancedStructs. This is essential because Gameplay Effect Contexts, which carry data for Gameplay Events, store custom data as an `FInstancedStruct`.
* **Abstraction:** Hides the underlying details of creating `FGameplayEffectContextHandle`s and sending `GameplayEventData`.

### Key Functions

The library offers several functions, primarily focused on sending Gameplay Events to the Player State's Ability System Component (ASC), often packaging specific data structures.

`Call Gameplay Ability From UI (Generic)`

* **Node Name:** `CallGameplayAbilityFromUIWithInstancedStruct_Generic`
* **Inputs:**
  * `Lyra Player State`: The target Player State whose ASC should receive the event.
  * `Event Tag`: The `FGameplayTag` identifying the specific Gameplay Event to trigger (which should match the trigger tag on one or more Gameplay Abilities).
  * `Instanced Struct` (Wildcard): **This is the crucial input.** You connect _any_ USTRUCT variable here. The node's internal logic (Custom Thunk) automatically wraps this struct into an `FInstancedStruct` payload. If you pass an `FInstancedStruct` directly, it handles potential double-wrapping.
  * `Gameplay Event Data`: Standard GAS event data (optional, can often be left default).
* **Action:** Creates a `FGameplayEffectContextHandle` containing the provided struct (wrapped in an `FInstancedStruct`) and sends the specified `Event Tag` along with the `GameplayEventData` (including the context handle) to the Player State's ASC.
* **Use Case:** Triggering _any_ custom inventory ability where you need to pass a single, specific data struct as context (e.g., dropping an item, inspecting an item, using a specific consumable action defined by a struct).

<img src=".gitbook/assets/image (11) (1) (1) (1).png" alt="" width="261" title="">

`Call Gameplay Ability From UI (Move Item)`

* **Node Name:** `CallGameplayAbilityFromUIWithInstancedStruct_MoveItem`
* **Inputs:**
  * `Lyra Player State`: Target Player State.
  * `Event Tag`: Gameplay Event Tag (e.g., `Ability.Inventory.RequestMoveItem`).
  * `Source Slot` (Wildcard): The struct identifying the item's original location (must derive from `FAbilityData_SourceItem`).
  * `Destination Slot` (Wildcard): The struct identifying the target location (must derive from `FAbilityData_SourceItem`).
  * `Gameplay Event Data`: Standard GAS event data.
* **Action:** This node specifically packages the `Source Slot` and `Destination Slot` structs into a single `FAbilityData_MoveItem` struct. This `FAbilityData_MoveItem` struct is then wrapped in an `FInstancedStruct` and sent via a Gameplay Event like the generic node.
* **Use Case:** The standard way to trigger an ability designed to handle moving items between different slots (inventory-to-inventory, inventory-to-equipment, equipment-to-attachment, etc.). The receiving ability unpacks the `FAbilityData_MoveItem` struct.

<img src=".gitbook/assets/image (12) (1) (1) (1).png" alt="" width="263" title="">

`Get Item From Ability Source Item Struct`

* **Node Name:** `GetItemFromAbilitySourceItemStruct`
* **Inputs:**
  * `Data Struct` (Wildcard): An input struct that is expected to derive from `FAbilityData_SourceItem`.
  * `Required Permissions`: The specific `ELyraInventoryPermissions` flag needed to access the item via this struct.
  * `Player Controller`: The Player Controller making the request (used for permission checks).
* **Action:** This is primarily a **server-side validation function** intended for use _inside_ the Gameplay Ability that receives an event. It takes the data struct payload from the event context, unwraps it, calls the virtual `GetSourceItem` function on the underlying `FAbilityData_SourceItem`, performing the necessary permission checks against the provided `PlayerController`.
* **Use Case:** Used within server-side Gameplay Abilities to safely resolve the source data struct back into a validated `ULyraInventoryItemInstance*` pointer before performing actions on it.
* **Returns:** The validated `ULyraInventoryItemInstance*` if checks pass, otherwise `nullptr`.

<img src=".gitbook/assets/image (13) (1) (1) (1).png" alt="" width="295" title="">

`Get Custom Ability Data (from GE Context)`

* **Node Name:** `GetCustomAbilityData`
* **Input:** `Gameplay Effect Context Handle`.
* **Action:** Extracts the `FInstancedStruct` payload that was packaged into the context handle (usually by one of the `Call Gameplay Ability From UI...` nodes).
* **Use Case:** Used within Gameplay Abilities or Gameplay Effect Execution Calculations to retrieve the custom data struct sent with the triggering event.
* **Returns:** The `FInstancedStruct` containing the custom data payload.

<img src=".gitbook/assets/image (14) (1) (1) (1).png" alt="" title="Example of getting CustomAbilityData from the GA_EquipTetrisItem">

`Is Null Slot`

* **Input:** `Slot` (`FInstancedStruct`).
* **Action:** Checks if the provided `FInstancedStruct` contains the specific `FNullSourceSlot` struct type.
* **Use Case:** Determining if a source/destination slot represents an invalid or non-specific location.

<img src=".gitbook/assets/image (15) (1) (1) (1).png" alt="" width="151" title="">

### How it Works (Custom Thunks)

The key to the wildcard input pins on nodes like `Call Gameplay Ability From UI (Generic)` is the use of `UFUNCTION(CustomThunk)` and `DECLARE_FUNCTION`.

1. **Wildcard Input:** The Blueprint node presents a generic struct input pin (internally `const int32&` for the thunk signature, but treated as a wildcard struct by Blueprints).
2. **Custom Thunk (`exec...` function):** When the Blueprint node executes, instead of a direct C++ call, it calls a special C++ function specified by `DECLARE_FUNCTION`.
3. **Manual Stack Reading:** Inside the `exec...` function, the C++ code manually reads the memory address and the `FStructProperty` associated with the wildcard pin directly from the Blueprint execution stack (`Stack.StepCompiledIn`, `Stack.MostRecentPropertyAddress`).
4. **Wrapping into FInstancedStruct:**
   * The C++ code determines the actual `UScriptStruct*` type of the data connected.
   * If the input is not already an `FInstancedStruct` holding the desired data, it allocates a new `FInstancedStruct` and uses `InitializeAs` to copy the Blueprint struct's data into it.
   * If the input is an `FInstancedStruct`, it handles it appropriately (e.g., using it directly, or unwrapping if it's a double-wrapped `FInstancedStruct`).
5. **Internal Call:** Finally, the `exec...` function calls the actual internal C++ logic (`CallGameplayAbilityFromUIWithInstancedStruct_Internal`) passing the properly created `FInstancedStruct`.

This allows the Blueprint nodes to accept any struct type while ensuring the data is correctly packaged into the `FInstancedStruct` format expected by the GAS event context system.

> [!info]
> IIf you're unfamiliar with custom thunks, don't worry.  You don't need to understand their internals to use these nodes effectively. Just know that they make Blueprint nodes more user-friendly by allowing flexible wildcard inputs. However, this flexibility comes with a trade-off: custom thunk functions are not directly accessible from C++. For C++ code, equivalent functionality is available through standard functions in the `UInventoryAbilityFunctionLibrary`.

### Usage from UI Widgets

1. **Get Player State:** In your UI widget Blueprint, get a reference to the owning player's `ALyraPlayerState`.
2. **Prepare Data:** Create instances of the necessary `FAbilityData_SourceItem`-derived structs (e.g., `FInventoryAbilityData_Equipment`) and populate them with the correct information (Equipment Manager and Equipment Slot, etc.).
3. **Choose Node:** Select the appropriate function from the `InventoryAbilityFunctionLibrary`:
   * Use `Call Gameplay Ability From UI (Move Item)` for moving items, connecting the source and destination structs.
   * Use `Call Gameplay Ability From UI (Generic)` for other actions, connecting the single relevant data struct.
4. **Set Event Tag:** Provide the correct `FGameplayTag` that corresponds to the Gameplay Ability you want to trigger.
5. **Execute Node:** Call the function node when the player performs the UI action (e.g., Inspect Item, Drop Item).

<img src=".gitbook/assets/image (5) (1) (1) (1) (1) (1) (1).png" alt="" title="Using CallGameplayAbilityFromUI to pass the equipment slot address into the Ability.Inventory.InspectItem">

> [!info]
> FEquipmentAbilityData_SourceEquipment is inherited from FAbilityData_SourceItem. The [Slot Address Page](slot-address.md) will cover FAbilityData_SourceItem and it's child structs in more detail.

***

The `UInventoryAbilityFunctionLibrary` is the designated gateway for Blueprints, especially UI, to securely and conveniently send requests and contextual data into the Gameplay Ability System for processing inventory actions. It abstracts away the complexities of GAS event data packaging, making the integration process much smoother.
