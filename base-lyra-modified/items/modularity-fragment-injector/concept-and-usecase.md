# Concept & Usecase

Understanding _why_ the Fragment Injector system exists is key to using it effectively. It directly addresses challenges related to **modularity, dependencies, and extending functionality** in complex projects, especially those utilizing Unreal Engine's **Game Features** or a plugin-based architecture like the one employed in this asset.

### The Core Problem: Modifying Shared Assets

Imagine your project structure:

* **Core Engine/Lyra:** Base systems.
* **Core Gameplay Plugins (e.g., `ShooterBase`, `TetrisInventory`):** Define fundamental mechanics and base asset types like `ID_Rifle_Standard`. These plugins generally shouldn't know about specific game modes.
* **Game Mode Plugins (e.g., `Arena`, `BattleRoyale`, `OneHitKill`):** Define specific rulesets and experiences, potentially needing to alter how base items behave _within that mode_.

**The Challenge:** How does `ArenaMode` add a "shop price" to `ID_Rifle_Standard` (defined in `ShooterBase`) without forcing `ShooterBase` to know about shops, or without creating a duplicate `ID_Rifle_Standard_Arena` item? How does `BattleRoyaleMode` make the _same_ `ID_Rifle_Standard` consume ammo, while in another mode it might have infinite ammo?

**Direct modification leads to problems:**

1. **Cross-Plugin Dependencies:** If `ShooterBase`'s `ID_Rifle_Standard` directly referenced an `ArenaShopFragment`, `ShooterBase` would suddenly depend on `ArenaMode`. This breaks the desired one-way dependency flow (Game Modes depend on Core Plugins, not vice-versa).
2. **Asset Duplication:** Creating `ID_Rifle_Standard_Arena`, `ID_Rifle_Standard_BR`, etc., leads to asset bloat and makes it hard to refer to "the standard rifle" generically across different systems.
3. **Maintenance & Updates:** Modifying shared assets (`ID_Rifle_Standard`) directly creates merge conflicts and complicates updating the core plugins.

### The Solution: Runtime Fragment Injection - The "Conveyor Belt"

The Fragment Injector system flips the responsibility. Instead of the base item knowing about all possible feature fragments, the **feature or game mode plugin** declares its intention to modify specific base items _as they pass through its context_.

**Think of it like an assembly line or conveyor belt:**

1. **Base Item (`ID_Rifle_Standard`):** Enters the line defined in `ShooterBase` with its core fragments.
2. **Plugin/Feature Activation (e.g., `ArenaMode` Loads, `HardcoreMode` Loads):**
   * `ArenaMode` defines `UInventoryFragment_ArenaShopInfo`. It provides an `UFragmentInjector` asset: "Inject `ArenaShopInfo` fragment into `ID_Rifle_Standard`."
   * `HardcoreMode` might provide an `UFragmentInjector` asset: "**Remove** `InventoryFragment_InfiniteAmmoHelper` from `ID_Rifle_Standard`."
   * The `UFragmentInjectorManager` finds these injectors.
   * It **temporarily modifies the in-memory Class Default Object (CDO)** of `ID_Rifle_Standard`, adding the `ArenaShopInfo` fragment and/or removing the `InfiniteAmmoHelper` fragment for the duration that the respective mode is active.
3. **Item Creation (During Active Mode):** Any `ULyraInventoryItemInstance` of `ID_Rifle_Standard` created _now_ will be based on the modified CDO.
4. **Plugin/Feature Deactivation:** When the mode unloads, the `UFragmentInjectorManager` restores the `ID_Rifle_Standard` CDO to its original state.

### Use Cases & Scenarios within Your Architecture

This system enables powerful, decoupled workflows:

* **Game Mode Specific Properties:**
  * **Arena Mode:** Inject an `ArenaShopInfo` fragment (defining buy/sell price) into weapons and gear defined in core plugins.
  * **Battle Royale Mode:** Inject or modify a fragment (perhaps on the `EquippableItem` fragment or a dedicated `AmmoConsumer` fragment) on weapons to make them require and consume specific ammo types (`StatTags`), while they might have infinite ammo in a TDM mode.
  * **Hardcore Mode:** _Remove_ fragments that grant advantages (e.g., remove a fragment grants infinite ammo if it was on the base item for a different default mode).
* **Game Mode Rule Variations:**
  * **One-Hit Kill Mode:** Injectors could modify the `UInventoryFragment_EquippableItem` on weapons to point to entirely different `ULyraEquipmentDefinition` assets (created within the One-Hit Kill plugin) that grant abilities dealing extremely high damage, without changing the base weapon item definition itself.
* **Adding Optional Mechanics:** As before, easily add systems like durability, decay, enchantments, or socketing via separate feature plugins that inject their respective fragments onto relevant base items.
* **Maintaining Item Identity:** Crucially, **`ID_Rifle_Standard` remains `ID_Rifle_Standard`**. Different game modes modify its _runtime behavior_ via fragment injection, but core systems and other plugins can still refer to the item by its single, consistent definition. No need for `ID_Rifle_Standard_Arena`, `ID_Rifle_Standard_BR`, etc.
* **Plugin Decoupling:** `ShooterBase` defines guns, `ArenaMode` defines shop prices, `BattleRoyaleMode` defines ammo consumption – none of these plugins need direct references to each other's specific fragments or systems, only to the base item definition they are modifying.

### Creating a Fragment Injector

You typically create FragmentInjector by creating Blueprint Classes (you can think of it like an item definition scoped to that specific plugin).

1. **Content Browser:** Navigate to where you want to store your FragmentInjector (e.g., `Content/Items/Weapons`).
2. **Right-Click:** Right-click in the empty space, select Blueprint -> Blueprint Class.
3. **Choose Parent Class:** Search for and select `FragmentInjector` as the parent class.
4. **Name Asset:** Give your Blueprint class a descriptive name, often prefixed with `ID_FragmentInjector` (e.g., `BPID_Rifle_AK47`, `BPID_Consumable_HealthPotion`).
5. **Configure Defaults:** Open the Blueprint class and edit its Class Defaults. This is where you'll set add/configure/remove `Fragments` and set their override index.

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/create_fragment_injector.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
Create a Fragment Injector
{% endfile %}

***

By reversing the dependency and allowing features/modes to modify base item CDOs temporarily at runtime, the Fragment Injector system is essential for the clean, modular, and extensible architecture of this asset. It facilitates the "conveyor belt" approach where items pass through different feature layers, gaining relevant behaviors without polluting the original item definitions or creating unwanted cross-plugin dependencies.
