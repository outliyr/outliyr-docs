# Fragment Injector

Your project has a rifle defined in the ShooterBase plugin. It works in every game mode, deathmatch, elimination, free-for-all. Now you're building a new game mode plugin similar to valorant or CS/GO, we will call it Arena, where players buy weapons from a shop. The rifle needs a price.

But ShooterBase doesn't know about shops, and it shouldn't. If you add a shop price fragment directly to the rifle definition, ShooterBase now depends on the plugin. That's a backwards dependency that breaks the entire plugin architecture. Core plugins should never reference game mode plugins.

You could duplicate the rifle as `ID_Rifle_Arena` with the price fragment baked in. But now you maintain two versions of every weapon. Every balance change needs to be applied twice. Every system that references "the standard rifle" needs to know about both versions. This doesn't scale.

The fragment injector solves this by reversing the dependency. Instead of the item knowing about every possible mode's fragments, each game mode declares what fragments it wants to inject, remove or modify into existing items. The rifle gets a shop price during Arena matches and reverts to its original definition when Arena unloads. One rifle, zero cross-plugin dependencies, zero duplication.

***

### Real Examples from the Project

#### Arena Mode — Shop Prices

The Arena game feature needs every weapon and piece of equipment to have a buy price, sell price, and shop category. None of these concepts exist in ShooterBase, they're Arena-specific.

The Arena plugin contains fragment injectors that add `ArenaShopFragment` to each weapon definition. When a player opens the buy menu during an Arena match, the system reads the shop fragment from the weapon's definition to display the price and handle the purchase. When the Arena experience unloads, every weapon's shop fragment is stripped, the weapons return to their base configuration as if the shop system never existed.

#### Prop Hunt — Size-Based Damage

In the Prop Hunt game mode, players disguised as props take damage based on their size, tiny props are harder to hit and take less damage, while large props are easier targets. The base rifle's hitscan damage effect doesn't know about prop sizes.

The Prop Hunt plugin uses a fragment injector to modify the rifle's damage behavior. The modified equipment fragment changes how the hitscan gameplay effect calculates damage, it reads the target's prop size tag and applies a multiplier. Tiny props might take 0.5x damage, large props 2x. The base rifle definition is never modified; Prop Hunt layers this behavior on top at runtime.

#### Hypothetical — Hardcore Mode with Durability

Imagine building a Hardcore mode where weapons degrade with use. Every weapon starts pristine and slowly loses effectiveness, accuracy drops, fire rate decreases, until it breaks entirely and must be replaced.

A fragment injector adds a `DurabilityFragment` to every weapon in the Hardcore experience. The fragment tracks wear as a stat tag, applies penalties based on condition, and triggers a "weapon broken" event at zero durability. In standard modes, durability doesn't exist, weapons work identically forever. In Hardcore, every weapon degrades. Same weapon definitions, completely different gameplay feel.

The key insight: **none of these modes modify the base weapon assets.** ShooterBase defines weapons once. Arena adds prices. Prop Hunt changes damage. Hardcore adds durability. Each mode owns its own modifications, and they all clean up after themselves.

***

### How It Works

#### The Two Components

**`UFragmentInjector`** — a Data Asset (`UDataAsset` subclass) that declares a single injection rule set. Each injector targets one item definition class and specifies which fragments to add, replace, or remove. You create concrete injectors as Blueprint assets that inherit from this class.

<figure><img src="../../.gitbook/assets/image (48).png" alt=""><figcaption><p>Example of injecting a battle royale category to a weapon</p></figcaption></figure>

**`UFragmentInjectorManager`** — a `UObject` owned by `ULyraExperienceManagerComponent`. It discovers injector Blueprints through the Asset Registry, applies them during experience loading, and restores the original fragment arrays on unload.

#### The Runtime Flow

***

{% stepper %}
{% step %}
**Experience loads and game feature plugins activate**

The Experience Manager loads and activates all game feature plugins referenced by the experience definition.
{% endstep %}

{% step %}
**Manager discovers injectors**

The `UFragmentInjectorManager` uses the Asset Registry to find all Blueprint assets whose native parent class is `UFragmentInjector`. It can discover injectors in two ways: scanning all registered injectors and filtering by whether they belong to the current experience, or scanning a specific plugin's content directory by its URL. Discovery is automatic, you don't register injectors manually.
{% endstep %}

{% step %}
**Manager backs up originals**

Before modifying any item definition, the manager copies the target CDO's `Fragments` array and roots each fragment pointer to prevent garbage collection. This backup is stored in a `TMap` keyed by item definition class, and it's what makes clean restoration possible. Each item definition is only backed up once, even if multiple injectors target it.
{% endstep %}

{% step %}
**Injections applied to CDOs**

For each discovered injector, the manager calls `InjectFragments()` on the `UFragmentInjector` CDO, which modifies the target `ULyraInventoryItemDefinition`'s Class Default Object directly:

* **Adding a new fragment:** If no fragment of the same class exists on the item, the new fragment instance is appended to the CDO's `Fragments` array.
* **Replacing an existing fragment:** If a fragment of the same class already exists, it is replaced only if the existing fragment's `OverrideIndex` is strictly less than the injector's. If the existing index is equal or higher, the replacement is skipped.
* **Removing a fragment:** Fragment classes matching `FragmentClassToRemove` are stripped from the array, but only if the injector's `OverrideIndex` is greater than or equal to the existing fragment's index.

Since all item instances are created from the CDO, any items spawned during the session automatically carry the modified fragments.
{% endstep %}

{% step %}
**Gameplay runs with modified items**

Items created during this session reflect the injected fragments. The shop system reads shop prices. The damage system reads size-based multipliers. The durability system reads wear state. All from fragments that exist only because the current game mode injected them.
{% endstep %}

{% step %}
**Experience unloads** — **originals restored**

When the experience changes or the world shuts down, `RestoreOriginalFragments()` writes the backed-up array back into each modified CDO and removes the root references so the injected fragments can be garbage collected. The item definitions return to their original state as if the injections never happened.
{% endstep %}
{% endstepper %}

### Creating a Fragment Injector

{% stepper %}
{% step %}
In your game feature plugin's Content directory, create a new Blueprint Class with `UFragmentInjector` as the parent.
{% endstep %}

{% step %}
Name it descriptively (e.g., `BFJ_Rifle`).
{% endstep %}

{% step %}
In the Blueprint's Class Defaults:

* Set **Item Definition** to the target item definition class (e.g., `ID_Rifle`).
* Add entries to the **Fragments To Inject** array. For each entry:
  * **To add or replace a fragment:** Leave `bRemoveFragment` false, configure the `Fragment` instance with your data, set `OverrideIndex` (defaults to 1, which is sufficient to override base fragments at index 0).
  * **To remove a fragment:** Set `bRemoveFragment` to true, set `FragmentClassToRemove` to the class you want stripped, and set `OverrideIndex` to at least the target fragment's index.
{% endstep %}

{% step %}
Place the Blueprint in your plugin's content directory. The manager discovers it automatically when the plugin loads
{% endstep %}
{% endstepper %}

{% file src="../../.gitbook/assets/create_fragment_injector.mp4" %}
Create a Fragment Injector
{% endfile %}

***

### The Override Index

When multiple sources want to set the same fragment type on an item, the override index decides who wins.

Base item fragments, the ones defined directly on the item definition class, default to an `OverrideIndex` of 0. Injected fragments default to 1. This means any injector can override base fragments out of the box, but the system also supports finer-grained priority control when multiple plugins compete.

The replacement rule is asymmetric depending on the operation:

* **Replacement** uses a strict less-than comparison: a new fragment replaces an existing one only if the existing fragment's override index is **strictly less than** the injector's. Equal indices do not trigger a replacement.
* **Removal** uses a greater-than-or-equal comparison: a fragment is removed if the injector's override index is **greater than or equal to** the target fragment's index.

This means if two plugins both inject the same fragment type at the same override index, the first one applied wins and subsequent injectors at the same level cannot overwrite it. A higher-priority plugin (higher index) always takes precedence.

***

### Integration with the Experience Lifecycle

The fragment injector system runs as part of the [Experience Lifecycle](../gameframework-and-experience/experience-lifecycle.md). The `UFragmentInjectorManager` is held as a `UPROPERTY` on `ULyraExperienceManagerComponent`. After game feature plugins are loaded and activated, the manager scans for injectors and applies them. This ensures item definitions are fully configured before any gameplay actions execute and begin spawning item instances.

During `EndPlay`, the manager restores all modified CDOs, guaranteeing that no injected state leaks between experiences or persists after a session ends.
