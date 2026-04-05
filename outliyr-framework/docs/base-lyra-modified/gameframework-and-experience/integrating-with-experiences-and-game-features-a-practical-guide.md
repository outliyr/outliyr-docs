# Creating Experiences

This guide provides a practical, recommended workflow for creating new game modes or significant gameplay features using this asset's Experience and Game Feature systems. The core philosophy is **modularity** and **data-driven configuration**, where base game features provide foundational logic, and specific game modes (often implemented as their own Game Features) customize and extend this foundation primarily through **Experience Definitions and Action Sets configured in Blueprints.**

***

## Guiding Principles

* **Game Features for Modularity:** Encapsulate distinct game modes or major features within their own Game Feature Plugins. This promotes clean separation, allows for optional content, and simplifies dependency management. Your "Target Practice" mode, for example, will be its own Game Feature.m
* **One-Way Dependencies:** Your game mode plugin depends on core plugins (ShooterBase, LyraGame), never the reverse.
* **Experience Definitions as the Primary Config Point:** The `ULyraExperienceDefinition` is where most game mode-specific configuration should occur. This includes:
  * Specifying the default `ULyraPawnData`.
  * Adding mode-specific `UGameStateComponent`s (like a scoring manager) via `UGameFeatureAction_AddComponents`.
  * Adding mode-specific HUD elements via `UGameFeatureAction_AddWidgets`.
  * Referencing customized or core `ULyraExperienceActionSet`s.
  * Enabling the Game Feature Plugin that contains the mode's specific assets and logic.
* **Action Sets for Reusable, Non-Customizable Logic:** `ULyraExperienceActionSet`s are excellent for bundling sets of actions and feature dependencies that are core to a foundational plugin (like `ShooterBase`) and are generally _not_ meant to be tweaked per individual Experience. These are often internal to the foundational plugin.
* **Customization through Duplication & Overriding (for Action Sets):** If a game mode needs to alter the behavior provided by a core Action Set (e.g., change a default component added by `ShooterBase`), the recommended pattern is to **duplicate that Action Set into the game mode's plugin** and modify the duplicate. The game mode's Experience Definition then references this duplicated, customized Action Set instead of the original. This maintains the integrity of the core plugin's assets while allowing per-mode flexibility. It's a bit redundant but ensures maximum customization without breaking core dependencies.
* **Blueprint-Centric Configuration:** Most of this setup (creating Data Assets, configuring Game Feature Actions within Experience Definitions, creating UI widgets and mode-specific components) is done in Blueprints, minimizing the need for C++ for common game mode variations.

This guide walks through creating a new game mode from scratch, from plugin creation to playable experience. It uses a "Target Practice" mode as the example: players spawn in a shooting range, hit targets for points, and see their score on a HUD.

If you haven't read the earlier pages in this section, start with [Experiences](experiences.md) and [Experience Lifecycle](experience-lifecycle.md) for the conceptual foundation.

***

## The Walkthrough — Target Practice Mode

{% stepper %}
{% step %}
#### Create the Game Feature Plugin

1. **Edit -> Plugins -> + Add** and select the Game Feature template.
2. Name it `TargetPracticeMode`.
3. Open the generated `.uplugin` file and add plugin dependencies: `ShooterBase`, `LyraGame`, `ModularGameplayActors`, `GameplayAbilities`.
4. If your mode uses custom Gameplay Cues, open the plugin's Game Feature Data asset and add a `GameFeatureAction_AddGameplayCuePath` action pointing at your cue directory.
{% endstep %}

{% step %}
#### Create Mode-Specific Assets

These all live inside your plugin's Content folder.

**Scoring Component** (`B_GSC_TargetPracticeScore`):

* A Blueprint inheriting from `UGameStateComponent`.
* Tracks and replicates the score.
* Exposes an `IncrementScore()` function that targets call when hit.

**Target Actor** (`BP_PracticeTarget`):

* An Actor Blueprint with a mesh and collision.
* On hit or destruction, finds the scoring component on the Game State and calls `IncrementScore()`.

**Score Widget** (`WBP_TargetPracticeScore`):

* A Widget Blueprint displaying the current score.
* Binds to the scoring component's delegate for live updates.

**Pawn Data** (`PawnData_TargetPractice`):

* A `ULyraPawnData` asset.
* Pawn class: your standard shooter character.
* Ability sets: movement + starting weapon.
* Input config and camera mode as needed.
* See [Pawn Data](lyrapawndata.md) for what each property controls.
{% endstep %}

{% step %}
#### Handle Core Action Sets

Core plugins like ShooterBase provide action sets (shared input, standard components, standard HUD) that most modes need. You have two options:

* **Use them as-is** — reference the original action sets directly if they work for your mode.
* **Duplicate and customize** — if you need to change something (remove a component, swap a HUD element), duplicate the action set into your plugin and modify the copy. Your experience references your copy instead of the original.

The duplication approach means your mode can evolve independently without affecting other modes that use the originals. It is a small amount of redundancy for maximum flexibility.
{% endstep %}

{% step %}
#### Create the Experience Definition

This is where everything comes together. Create a `ULyraExperienceDefinition` asset in your plugin, for example, `B_Experience_TargetPractice`.

Configure:

* **GameFeaturesToEnable** — add `TargetPracticeMode` (your plugin name) so the framework activates your plugin when this experience loads.
* **DefaultPawnData** — assign `PawnData_TargetPractice`.
* **ActionSets** — reference your core action sets (originals or duplicated copies from Step 3).
* **Actions** — add mode-specific actions inline:
  * `GameFeatureAction_AddComponents`: attach `B_GSC_TargetPracticeScore` to `ALyraGameState` (include both client and server).
  * `GameFeatureAction_AddWidgets`: add `WBP_TargetPracticeScore` to a HUD slot tag (e.g., `HUD.Slot.ModeStatus`).
{% endstep %}

{% step %}
#### Configure the Map

1. Open or create your Target Practice map.
2. In **World Settings**, set the **Default Gameplay Experience** to `B_Experience_TargetPractice`.
3. This tells the [Experience Lifecycle](experience-lifecycle.md) which experience to load when this map opens.
{% endstep %}

{% step %}
#### Create the User-Facing Experience (for Menus)

If your mode should appear in a lobby or mode selector, create a `ULyraUserFacingExperienceDefinition` asset:

| Property          | Value                           |
| ----------------- | ------------------------------- |
| `MapID`           | Your target practice map        |
| `ExperienceID`    | `B_Experience_TargetPractice`   |
| `TileTitle`       | "Target Practice"               |
| `TileDescription` | A short description of the mode |
| `TileIcon`        | An icon texture                 |
| `MaxPlayerCount`  | Appropriate limit for the mode  |
| `bShowInFrontEnd` | `true`                          |

See [Experiences](experiences.md) for full details on the user-facing asset.
{% endstep %}

{% step %}
#### Configure Asset Scanning

The Game Feature system needs to discover your new primary assets. Open your plugin's Game Feature Data asset and in the Asset Manager section, add **Primary Asset Types To Scan** entries for:

* **Maps** — your map directory.
* **LyraExperienceDefinition** — your experiences directory.
* **LyraExperienceActionSet** — your action sets directory (if you duplicated any).
* **LyraUserFacingExperienceDefinition** — your playlists directory.

Without these entries, the asset manager will not find your assets and the experience will fail to load.
{% endstep %}

{% step %}
#### Test

1. Ensure the `TargetPracticeMode` plugin is active.
2. Open your map in PIE, World Settings loads the experience automatically.
3. Verify: correct pawn spawns, scoring component active on the Game State, HUD widget visible, targets increment the score on hit.
{% endstep %}
{% endstepper %}

***

## What You've Built

Your Target Practice mode is a self-contained Game Feature plugin. It depends on ShooterBase for weapon and character functionality but adds its own scoring, targets, and HUD. If you disable the plugin, the mode disappears cleanly. If you want to add this mode to a different map, set that map's World Settings to point at your experience definition.

This is the pattern for every game mode in the project. Arena, Battle Royale, and Prop Hunt all follow the same structure: a dedicated plugin, mode-specific assets, and an Experience Definition that wires everything together.
