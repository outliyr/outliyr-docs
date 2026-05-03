# Quick Start Guide

## **Your First Gameplay Session**

This guide walks you through launching your first gameplay session with the framework. You’ll play a prebuilt game mode, explore its assets, and make a simple customization, all while learning how the modular system works.

{% hint style="info" %}
This guide assumes you've already completed the [Installing & Setup](installing-and-setup.md) steps and have the project open in Unreal Engine.
{% endhint %}

**By the end of this guide, you will have:**

1. Launch and play a prebuilt game mode
2. Locate the assets responsible for that game mode
3. Understand how Experiences and Game Features define gameplay
4. Make a small gameplay tweak safely
5. Know where to go next for deeper customization

Let's get started!

***

## **Launching an Example Game Mode**

Let's jump into a pre-built game mode to see the framework in action. We'll use **Team Deathmatch (TDM)** as an example.

1.  **Locate the TDM Map:**

    * In the Content Browser, make sure "Show Plugin Content" is enabled (Settings cogwheel in the Content Browser).
    * Navigate to the TDM plugin's content folder: `Plugins/TeamDeathmatch/Content/Maps/`
    * Open either TDM map

    <figure><img src="../.gitbook/assets/image (244).png" alt=""><figcaption><p>Team Death match map file and file path</p></figcaption></figure>
2.  **Check World Settings (Informational):**

    * With the map open, go to **Window > World Settings**.
    * You'll see **Default Gameplay Experience** it should be set to an asset like `B_TeamDeathmatch` which defines what systems and features are loaded for this map.

    <figure><img src="../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption><p><em>World Settings panel showing the TDM Experience selected for the map</em></p></figcaption></figure>
3. **Play In Editor (PIE):**
   * Click the **Play** button in the main editor toolbar.
   * If prompted for the number of players, choose **1 or 2**.&#x20;
   * For multiplayer testing:
     * Use **"Play As Client"** to simulate server/client
     * Or use **"Play Standalone"** for a quick local test

You’re now playing the **Team Deathmatch** mode, powered by the framework’s modular components.

Observe:

* Scoring and team logic
* HUD behavior
* Pawn movement and abilities

***

## **Exploring the Team Deathmatch Assets (Initial Peek)**

Now that you've played it, let's briefly see where the TDM setup lives:

1.  **Game Feature Plugin:** The TDM mode resides in its plugin folder (e.g., `Plugins/TeamDeathmatch/`).

    * The `TeamDeathmatch.uplugin` file defines its dependencies (e.g., on `ShooterBase`, `LyraGame`). You can still set dependencies for the plugin in the editor through the game feature asset.

    <figure><img src="../.gitbook/assets/image (245).png" alt=""><figcaption></figcaption></figure>

    <figure><img src="../.gitbook/assets/image (246).png" alt=""><figcaption></figcaption></figure>

    * The `TeamDeathmatch` asset (in the plugin's root content folder) lists any plugin-wide actions, like `AddGameplayCuePath`.
2. **Experience Definition:** Inside the plugin's content (e.g., `Content/TeamDeathmatch/Experiences/`), find `B_TeamDeathmatch` .
   *   Open it to see:

       * **Game Features To Enable:**  `"TeamDeathmatch"` (itself, to ensure its actions and content are processed) and other dependencies like `"ShooterBase"`.
       * **Default Pawn Data:** The `ULyraPawnData` asset used for TDM players.
       * **Action Sets / Actions:** Any `ULyraExperienceActionSet`s it references or direct `UGameFeatureAction`s it uses (e.g., to add TDM scoring components or UI).

       <figure><img src="../.gitbook/assets/image (3) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" width="563"><figcaption><p><em><code>B_TeamDeathmatch</code> asset open, highlighting key properties.</em></p></figcaption></figure>

#### Other Useful Assets in the TeamDeathmatch plugin

* `HeroData_TeamDeathmatch` – Player configuration
* `B_Scoring_TeamDeathmatch` – Scoring logic
* `WBP_ScoreWidget_TeamDeathmatch` – Scoreboard UI

All TDM-specific logic and assets are contained in the TDM plugin.\
It depends on shared systems like ShooterBase, but no other plugin depends on TDM. This makes it safe to modify or remove without impacting the rest of the framework.

***

## **Making a Small Tweak:**

Let’s change a rule or component for learning purposes.

Modify the `B_Scoring_TDM` or `W_ScoreWidget_TeamDeathmatch` blueprint in the TDM plugin’s `Game` folder.

This lets you experiment without breaking core functionality. Feel free to adjust:

* Score values
* Win conditions
* UI elements

{% hint style="info" %}
If you want to keep your changes separate from the example plugins (making future framework updates easier to apply), you can duplicate these assets into your own Game Feature Plugin.\
See the [Installing & Setup](installing-and-setup.md) guide for how to create one.
{% endhint %}

***

## **Next Steps**

You've launched a game mode. Three places to go from here:

#### **Pick what you want to build →** [**Recipes**](recipes/).&#x20;

A goal-driven router for new equipment, weapons, abilities, items, HUD widgets, and game modes, each with a recipe that takes you from blank asset to working in-game. The fastest path to building.

#### **Understand the architecture →** [**Project Architecture**](project-architecture.md).&#x20;

The big picture, how plugins, Experiences, Game Features, and Pawn Data fit together. Read this when you want the _why_ behind the structure.

#### **Read existing modes for inspiration**&#x20;

Each plugin under `Plugins/GameFeatures/` is a complete worked example. **Battle Royale** and **Extraction** show different scales of inventory usage; **Arena** shows character selection and a buy menu; **Prop Hunt** and **Infection** illustrate asymmetric team setups; **Gun Game** uses Gameplay Events to drive progression; **Headquarters** demonstrates advanced respawn logic and so on. Inspect their Experience Definitions and Action Sets to see how the pieces compose in practice.
