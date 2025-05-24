# Items & Fragments

At the heart of the Inventory System lie the concepts of **Items** and **Fragments**. Understanding how these work together is essential before diving into the specifics of inventory management or advanced features.

* **Items:** Represent the actual things players collect, manage, and use. They exist in two forms:
  * **Definitions:** Static `UObject` "templates" defining an item type.
  * **Instances:** Runtime `UObjects` representing a specific item currently existing in the game world or an inventory, potentially with unique state.
* **Fragments:** Modular `UObjects` attached to Item Definitions that define specific aspects of an item's behavior or properties. They allow for a compositional approach, avoiding complex inheritance hierarchies.

This section will break down these core concepts, starting with this overview and then delving into each component on dedicated sub-pages.

***

### The Item Duo: Definition vs. Instance

The system makes a clear distinction between the _definition_ of an item and an _instance_ of that item:

1. **`ULyraInventoryItemDefinition` (The Template Object):**
   * **Role:** A read-only `UObject` (often used via its Class Default Object - CDO, or potentially as distinct definition objects if needed) that defines the static properties shared by all items of a particular type (e.g., all "AK-47 Rifles", all "Health Potions").
   * **Contains:** Display Name, cosmetic information, and crucially, an array of **`ULyraInventoryItemFragment`s** (which are `Instanced` UObjects) that dictate the item type's inherent capabilities and base properties.
   * **Location:** Exists as Blueprint classes (derived from `ULyraInventoryItemDefinition`) within your project content. You'd configure the properties on the CDO of these Blueprint classes.
2. **`ULyraInventoryItemInstance` (The Runtime Object):**
   * **Role:** A replicated `UObject` representing a specific, individual item that exists at runtime within an inventory, equipped on a character, or potentially dropped in the world.
   * **Contains:**
     * A reference back to its `ItemDef` (`TSubclassOf<ULyraInventoryItemDefinition>`).
     * **`StatTags`:** A `FGameplayTagStackContainer` for managing persistent integer counts (like ammo, charges, stack size) associated with _this specific instance_.
     * **`TransientFragments` & `RuntimeFragments`:** Instance-specific data payloads (structs wrapped in `FInstancedStruct` or `UTransientRuntimeFragment` UObjects) derived from the Fragments on its Definition. This is where durability, current heat, or an internal inventory for _this specific instance_ would live.
     * **`CurrentSlot`:** An `FInstancedStruct` indicating where this item currently resides.
   * **Location:** Created and managed at runtime, typically owned as a subobject by an Actor or Component.

**Analogy:** Think of `ULyraInventoryItemDefinition` as the class definition (`class Rifle {...}`) and `ULyraInventoryItemInstance` as an object instantiated from that class (`Rifle myRifle = new Rifle();`). The instance holds the specific state for `myRifle` (e.g., `myRifle.ammoCount = 25`), while the definition holds the general properties of all `Rifle`s (e.g., `Rifle.maxAmmo = 30`).

***

### Modularity: The Power of Fragments

Instead of creating deeply nested classes for every item variation (e.g., `UWeaponItem -> URangedWeaponItem -> UAutomaticRifleItem`), this system uses a compositional approach via **Fragments**.

* **`ULyraInventoryItemFragment` (The Building Block):**
  * **Role:** A base `UObject` class designed to be added to the `Fragments` array within an `ULyraInventoryItemDefinition`. Each fragment encapsulates a specific piece of data or behavior.
  * **Examples:**
    * `UInventoryFragment_EquippableItem`: Makes the item usable by the Equipment System.
    * `UInventoryFragment_InventoryIcon`: Provides data for grid-based UI (icon, size, max stack).
    * `UInventoryFragment_Consume`: Defines logic for when the item is consumed.
    * `UInventoryFragment_Attachment`: Enables the item to host attachments _or_ be an attachment itself.
    * `UInventoryFragment_SetStats`: Initializes `StatTags` on the Item Instance upon creation.
  * **Composition:** An item definition achieves its full functionality by combining multiple fragments. A rifle might have `EquippableItem`, `InventoryIcon`, `Attachment`, and `SetStats` fragments. A simple consumable might only have `InventoryIcon`, `Consume`, and `SetStats`.
* **Transient Data & Fragments:** A key enhancement is the link between static fragments and instance-specific data:
  * Static `ULyraInventoryItemFragment`s on the Definition can specify associated **Transient Data** types (either `FTransientFragmentData` structs or `UTransientRuntimeFragment` UObjects).
  * When an `ULyraInventoryItemInstance` is created, the system instantiates these transient data payloads and stores them _on the instance_.
  * This allows fragments to define _both_ static behavior/data _and_ provide storage for unique runtime state on each instance, keeping instance data tightly coupled with the fragment that defines its meaning.

### Structure of this Section

The following sub-pages will provide detailed explanations of these core components:

* **Item Definition (`ULyraInventoryItemDefinition`):** How to create and configure the static item templates.
* **Item Instance (`ULyraInventoryItemInstance`):** The runtime representation, its properties, and lifecycle.
* **Stat Tags (`FGameplayTagStackContainer`):** Managing persistent integer counts on instances.
* **Item Fragments (Overview):** The base fragment concept and common virtual functions.
* **Transient Data Fragments (`FTransientFragmentData`):** Using structs for lightweight instance data.
* **Transient Runtime Fragments (`UTransientRuntimeFragment`):** Using UObjects for complex instance data and logic.

***

This overview introduces the fundamental relationship between item definitions, instances, and the fragment system that enables modularity and instance-specific state. The subsequent pages will explore each of these concepts in detail.
