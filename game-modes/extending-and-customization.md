# Extending & Customization

This page covers how to customize existing game modes and create new ones.

***

### Customization Approaches

There are three main ways to customize gameplay, each with different tradeoffs:

#### Create a New Game Feature Plugin

The easiest approach. Your content lives in its own plugin, completely separate from the framework's core and example plugins. Framework updates apply cleanly with no merge work.

This is the right choice for:

* New game modes
* Major feature additions
* Building on an existing game mode (copy the relevant Experience, Pawn Data, and Action Set assets into your plugin and modify the copies)

See [Installing & Setup](../introduction/installing-and-setup.md) for how to create a Game Feature Plugin.

#### Modify an Example Game Mode Directly

If you want to tweak an existing game mode (like TeamDeathmatch or Arena) without creating a separate plugin, you can edit its assets directly. This is the most straightforward approach for quick iteration.

Keep in mind that if you update the framework later, you'll need to merge your changes with any updates to that game mode using Git.

#### Modify Core Systems

If you need to change how a core system works (ShooterBase, TetrisInventory, etc.), you can edit it directly. Use Git to track your changes so you can merge future framework updates.

***

### Creating a New Game Mode

Before jumping into the editor, it helps to think through the design of your game mode. The checklist below covers the key decisions you'll need to make. Each section maps to assets or systems you'll create in your Game Feature Plugin.

#### Planning Checklist

Teams

* [ ] What is the team structure? (No teams, two teams, multiple teams, asymmetric teams)
* [ ] How many players per match?
* [ ] How is team color handled? Perspective-based (ally vs enemy) or team ID-based (team 1 = blue, team 2 = red)?
* [ ] Do different teams need different pawn data? (Relevant for asymmetric modes like Infection or Prop Hunt)

Input

* [ ] Does this mode need new input actions?
* [ ] Does this mode need new input mappings?
* [ ] Does this mode need new gameplay abilities?

Hero Data

* [ ] Which pawns are available in this mode?
* [ ] What abilities does each pawn have? (What can the player do?)
* [ ] What are the tag relationships between abilities? (e.g., action abilities blocked when dead)
* [ ] What input mappings does each pawn use?
* [ ] Does each pawn need different widgets? (e.g., props vs hunters in Prop Hunt)
* [ ] What camera mode does each pawn start with?

User Interface

* [ ] Does this mode need unique UI widgets? (Scoreboard, objective tracker, mode-specific HUD, etc.)

Mode-Specific Features

* [ ] Does this mode need custom mechanics, objectives, or systems? (e.g., safe zone in Battle Royale, buy menu in Arena, control points in Domination, dog tags in Kill Confirmed)

Game Rules & Scoring

* [ ] Does this mode have unique rules? (Create a gamestate component or a Blueprint child of `ShooterScoring_Base`)
* [ ] Can the rules be separated into distinct components? (e.g., Arena separates economy and character selection into different managers, smaller, focused components are more reusable and easier to maintain)

Experience Definition

* [ ] The Experience ties everything together. Think of it as the recipe, the systems and features you created are the ingredients, and the Experience combines them into a playable game.
* [ ] You can create multiple experiences per game mode (e.g., `BattleRoyale_Solo`, `BattleRoyale_Duo`, `BattleRoyale_Squads`, or `TDM`, `TDM_Hardcore`, `TDM_Realism`).
* [ ] The Experience defines: the default pawn, which Game Features to enable, what UI to give players, which components to add, and which Action Sets to include.
* [ ] See [Game Framework & Experiences](../base-lyra-modified/gameframework-and-experience/) for full documentation.

***

### Walkthrough: Creating a TDM Game Mode

A quick walkthrough of the steps involved, using Team Deathmatch as an example.

For each step you can look at the existing `TeamDeathmatch` plugin for a working reference.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Create the Game Feature Plugin

1. In Unreal Engine, go to `Edit > Plugins`
2. Click `Add` and choose **Game Feature Plugin**
3. Select **C++** as the base
4. Name it (e.g., `MyTDM`)
5. Add dependencies: `ShooterBase`, `GameplayMaps`, and any other relevant plugins

See [Installing & Setup](../introduction/installing-and-setup.md) for more details on plugin creation and dependencies.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Set Up Hero Data

Create a `ULyraPawnData` asset in your plugin's `Plugins/GameFeatures/MyTDM/Content/Hero/` folder. This defines the player character for your mode:

* **Pawn Class** — The character Blueprint to spawn
* **Ability Sets** — Which abilities the player has
* **Input Config** — Input action bindings
* **Camera Mode** — Default camera behavior

You can reference an existing pawn data asset (like the one in TeamDeathmatch or ShooterBase) or create your own.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Create the Experience Definition

Create a `ULyraExperienceDefinition` in `Plugins/GameFeatures/MyTDM/Content/Experiences/`:

* **Game Features To Enable** — Add your plugin and `ShooterBase`
* **Default Pawn Data** — Point to the pawn data you set up
* **Action Sets** — Add any action sets for features you want (kill cam, accolades, spectating, etc.)
* **Actions** — Add game feature actions for components, UI, or other systems

See [Game Framework & Experiences](../base-lyra-modified/gameframework-and-experience/) for the full breakdown of experience configuration.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Set Up the Map

1. Create or copy a map to `Plugins/GameFeatures/MyTDM/Content/Maps/`
2. Open **Window > World Settings**
3. Set **Default Gameplay Experience** to your experience definition
<!-- gb-step:end -->

<!-- gb-step:start -->
### Add Game Rules

For scoring and win conditions, create a gamestate component or a Blueprint child of `ShooterScoring_Base`:

* Define score values per kill/event
* Set win conditions (score limit, time limit, etc.)
* Add the component to players through your experience's action sets

Look at the existing `TeamDeathmatch` plugin's `Game/` folder for a working reference.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Add UI

Create any mode-specific widgets in `Content/UserInterface/`:

* Scoreboard widget
* HUD elements
* End-of-match screen

Add these through your experience definition's actions or action sets.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Playtest

1. Open your map in the editor
2. Click **Play** (or use **Play As Client** for multiplayer testing)
3. Iterate on your game rules, scoring, and UI

For a working reference of all these pieces, explore the existing `TeamDeathmatch` plugin at `Plugins/GameFeatures/TeamDeathmatch/`.
<!-- gb-step:end -->
<!-- gb-stepper:end -->
