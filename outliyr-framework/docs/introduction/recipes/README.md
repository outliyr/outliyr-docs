# Recipes

## **What do you want to build?**

You've finished the [Quick Start Guide](../quick-start-guide.md), played a prebuilt mode, and seen how Experiences and Game Features hang together. Now you have a real project to ship, and a question that the rest of the documentation answers system-by-system, but you need to answer goal-by-goal.

This page is the launchpad. Pick the thing you want to build, follow the linked recipe end-to-end, and dive into the reference docs only when you need the deeper explanation.

{% hint style="success" %}
You can edit, subclass, replace, or duplicate any asset in this framework. There are no untouchable boxes. The recipes below show you the _fastest path_; once you're comfortable, modify whatever you need to fit your game.
{% endhint %}

{% hint style="warning" %}
**A few systems reward extra reading first.** The **Projectile Manager**, **Lag Compensation**, and **Kill Cam** are tightly coupled to networking, replication, and threading. Their docs explain the constraints in detail, read those before you modify the systems themselves. _Linking_ a weapon to the projectile manager is routine; rewriting the projectile thread internals is the deep end.

* [Projectile Manager](../../core-modules/shooter-base/projectile-manager/)
* [Lag Compensation](../../core-modules/shooter-base/lag-compensation/)
* [Kill Cam](../../core-modules/shooter-base/kill-cam/)
{% endhint %}

***

### **I want to build a new game mode**

A self-contained set of rules, win conditions, scoring, HUD, and pawn loadout, like Capture The Flag, an escort mission, or a wave-defense round. Modes live in their own Game Feature Plugin and reference an Experience that wires everything together.

* **Recipe:** [Creating Experiences (Practical Guide)](../../base-lyra-modified/gameframework-and-experience/integrating-with-experiences-and-game-features-a-practical-guide.md) — walks you through a Target Practice mode end-to-end.
* **Reference reading:**
  * [GameFramework & Experience](../../base-lyra-modified/gameframework-and-experience/) — Experiences, Game Features, Pawn Data
  * [Game Phase System](../../base-lyra-modified/game-phase-system/) — round flow, warmup, end states
  * [Game Mode Details](../../game-modes/game-mode-details/) — fifteen worked examples to study
* **Examples to copy from:** Every plugin under `Plugins/GameFeatures/` (Arena, Battle Royale, Domination, Search & Destroy, etc.). Pick the closest match to what you're building, duplicate it into your own Game Feature, and modify from there.

***

### **I want to build new equipment**

Anything the player wears, holds, or wields, armour, shoes, a shield, a tool, a non-combat utility. Equipment is the framework's general composition pattern: an Item Definition with fragments, an Equipment Definition that wires actors and abilities, an Equipment Instance for runtime state, and an Ability Set for what the player gets while equipped. **Guns, bows, and melee weapons are all specialisations of this pattern.**

* **Recipe:** [Custom Equipment Recipe](custom-equipment.md) — uses rocket shoes (jump-high) as the worked example. Quickest end-to-end on the framework; read this before the Weapon recipe if you're new.
* **Reference reading:**
  * [Equipment](../../base-lyra-modified/equipment/) — Defining Equippable Items, Equipment Instance, Equipment Manager
  * [Items & Fragments](../../base-lyra-modified/items/items-and-fragments/) — how items are defined
  * [Ability Sets](../../base-lyra-modified/gas/ability-sets.md) — granting abilities while equipped
* **Examples to copy from:** Demo equipment in `Plugins/GameFeatures/TetrisInventory/Content/Demo/Items/`, `RocketShoes/` (simplest), `VortexArmor/` (custom input + GE + cue), `KineticShield/` (host with attachment slots), `PowerCrystal/` (an item the shield's slot accepts).

***

### **I want to build a new weapon**

A new gun, rifle, shotgun, pistol, projectile launcher, with its own firing behaviour, ammo, recoil curve, animations, and attachments. Guns are a specialisation of equipment: the Equipment recipe above teaches the foundation; this recipe adds the gun-specific layers (Gun Fragment, recoil/spread, firing abilities, audio, reticle).

* **Recipe:** [Custom Weapon Recipe](custom-weapon.md) — walks through the rifle end-to-end, then turns it into a sniper variant by tuning values and swapping a parent class.
* **Reference reading:**
  * [Weapons (Base Lyra)](../../base-lyra-modified/weapons/) — Weapon Instance, Range Weapon Instance, Weapon State
  * [ShooterBase Weapons](../../core-modules/shooter-base/weapons/) — Gun Fragment, recoil, firing abilities, predictive projectiles
* **Examples to copy from:** Existing guns in `Plugins/GameFeatures/ShooterBase/Content/Weapons/Guns/`. Find the closest archetype to yours (rifle, shotgun, pistol, projectile launcher) and duplicate it.

***

### **I want to build a new ability**

A discrete gameplay action, grenade throw, custom reload, melee strike, ultimate, dash. Abilities are GAS-native: subclass `ULyraGameplayAbility`, attach effects and cues, and grant the ability through an Ability Set.

* **Recipe:** [Custom Ability Recipe](/broken/pages/652e02ba3c28a2dd5bcd91ae867ff93eb963a9f1)
* **Reference reading:**
  * [GAS](../../base-lyra-modified/gas/) — Abilities, Ability Sets, Gameplay Effects, Gameplay Cues
  * [Input](../../base-lyra-modified/input/) — wiring an input action to your ability
* **Examples to copy from:** Existing abilities under `Plugins/GameFeatures/ShooterBase/Content/Weapons/.../Abilities/` and `Source/LyraGame/AbilitySystem/Abilities/`.

***

### **I want to build a new inventory item**

Anything a player can pick up, carry, drop, stack, or use, consumables, key items, attachments, ammo packs. Items are data-driven: an `ULyraInventoryItemDefinition` plus the fragments that describe its behaviour.

* **Recipe:** [Custom Item Recipe](custom-item.md) — uses a consumable medkit as the worked example.
* **Reference reading:**
  * [Items & Fragments](../../base-lyra-modified/items/items-and-fragments/) — item definition, instance, fragment composition
  * [Item Fragments In-Depth](../../base-lyra-modified/items/item-fragments-in-depth/) — consumables, attachments, pickup, icons
  * [Inventory](../../base-lyra-modified/inventory/) — how items live inside a manager component
  * [Creating Custom Fragments](../../base-lyra-modified/items/items-and-fragments/creating-custom-fragments.md) — when no existing fragment fits
* **Examples to copy from:** Items under `Plugins/GameFeatures/TetrisInventory/Content/Items/` (e.g. AntiSepticBottle, MedBox, KineticShield).

***

### **I want to add a HUD widget to my game**

Building UMG widgets themselves is standard Unreal, the editor workflow and the `UUserWidget` lifecycle are unchanged from any UE5 project. What's framework-specific is _how_ a widget reaches the screen and _how_ it gets live game state without ticking. The page below covers the registration paths, base classes, and event-driven binding mechanisms.

* **Page:** [Adding HUD Widgets](custom-hud-widget.md)
* **Reference reading:**
  * [GameFramework & Experience](../../base-lyra-modified/gameframework-and-experience/game-features.md#addwidgets) — `UGameFeatureAction_AddWidget` registration
* **Examples to study:** existing widgets like `W_ScoreWidget_TeamDeathmatch` and the inventory UIs in the TetrisInventory and Battle Royale plugins show the patterns from the page applied in real assets.

***

### **I want to build a new Game Feature Plugin**

The wrapper around everything else: a plugin that holds your custom mode, weapons, items, abilities, and assets, and depends on the parts of the framework you actually use. Every customization above lives inside one of these.

* **Setup:** [Installing & Setup](../installing-and-setup.md) covers creating one.
* **Reference reading:**
  * [Game Features](../../base-lyra-modified/gameframework-and-experience/game-features.md) — what a Game Feature does at runtime
  * [Project Architecture](../project-architecture.md) — how plugins fit into the layered framework
* **Examples to copy from:** Any of the twenty plugins under `Plugins/GameFeatures/`. **Team Deathmatch** is the simplest end-to-end reference.

***

### **Where to next**

* If your goal isn't on this page, the closest fit usually starts with **a new Game Feature Plugin**. Build the wrapper first, then add the custom pieces inside it.
* If you need something the recipes don't cover, head to the system reference docs linked above. Every system has an introductory page that explains the design philosophy before the API.
