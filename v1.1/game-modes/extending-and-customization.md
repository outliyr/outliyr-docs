# Extending & Customization

This page is the guide for customizing a mode or building a new one: how to choose an approach, which existing mode to start from, and the steps to stand up a new mode plugin. It has two companions. Each mode's own **Extending** section lists the specific hooks for changing that mode, and the [game modes overview](game-mode-details/) describes the [shared systems](game-mode-details/#shared-infrastructure) every mode is built on (the scoring component, game phases, control points, and the loot and pickup system). Read those for the foundation; this page is about assembling a mode out of it.

***

## Customization approaches

There are three ways to customize gameplay, each with different tradeoffs:

### Create a new Game Feature Plugin

The cleanest approach. Your content lives in its own plugin, separate from the framework's core and example plugins, so framework updates apply with no merge work. This is the right choice for new game modes, major feature additions, or building on an existing mode by copying its Experience, Pawn Data, and Action Set assets into your plugin and modifying the copies.

See [Installing & Setup](../introduction/installing-and-setup.md) for how to create a Game Feature Plugin.

### Modify an example game mode directly

To tweak an existing mode without a separate plugin, edit its assets in place. This is the fastest path for quick iteration. The tradeoff is that a later framework update to that mode has to be merged with your changes through Git.

### Modify core systems

To change how a shared system works (`ShooterBase`, `ControlPointCore`, `TetrisInventory`), edit it directly and track your changes with Git so future framework updates can be merged.

***

## Start from the closest mode

The fastest way to build a mode is to copy the example that already solves your hardest problem and change it, rather than starting from an empty plugin. Find the row closest to what you are making, open that mode's page for the detail, and copy its plugin as a starting point.

| If your mode needs…                   | Start from                                                                                                       | What it already solves                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Continuous team scoring to a limit    | [Team Deathmatch](game-mode-details/team-deathmatch.md)                                                          | A minimal `UShooterScoring_Base` child with a score and time limit        |
| No teams, every player for themselves | [Free For All](game-mode-details/free-for-all.md)                                                                | Per-player team ids and a highest-score resolve                           |
| Per-kill progression                  | [Gun Game](game-mode-details/gun-game.md)                                                                        | A weapon ladder driven by an ability, separate from scoring               |
| Rounds with no mid-round respawns     | [Search And Destroy](game-mode-details/search-and-destroy.md)                                                    | The round phase loop, `HandleRoundVictory`, and side switching            |
| A planted or defended objective       | [Search And Destroy](game-mode-details/search-and-destroy.md)                                                    | A carried objective with plant and defuse abilities gated by phase        |
| Capturing and holding territory       | [Domination](game-mode-details/domination.md), [Hardpoint](game-mode-details/hardpoint.md)                       | The shared `AControlPoint` actor and its `FControlPointSettings` policies |
| A moving or escorted objective        | [Payload](game-mode-details/payload.md)                                                                          | A control point that moves along a spline with ownership                  |
| A carried pickup objective            | [Capture The Flag](game-mode-details/capture-the-flag.md), [Kill Confirmed](game-mode-details/kill-confirmed.md) | A carry or pickup actor, base scoring, and objective-aware bots           |
| Asymmetric teams or role conversion   | [Infection](game-mode-details/infection.md), [Prop Hunt](game-mode-details/prop-hunt.md)                         | Per-role pawn data, team assignment, and role-transition abilities        |
| A buy economy or hero selection       | [Arena](game-mode-details/arena.md)                                                                              | A persistent economy ledger and a character-selection flow                |
| Looting and extraction                | [Battle Royale](game-mode-details/battle-royale.md), [Extraction](game-mode-details/extraction.md)               | The zone loot spawner, pickup routing, and a stash and loadout flow       |
| Survival in a shrinking space         | [Battle Royale](game-mode-details/battle-royale.md)                                                              | A staged shrinking safe zone and the drop plane                           |

***

## Key design decisions

Whichever mode you start from, a few decisions shape the rest of the build. Most map directly to an asset in your plugin.

* **Team structure.** No teams, two teams, multiple teams, or asymmetric teams, and how many players per match. Asymmetric modes give each role its own pawn data; see Infection and Prop Hunt. Decide whether team color is perspective-based (ally versus enemy) or fixed per team id.
* **Where the rules live.** Win conditions and scoring are a Blueprint child of `UShooterScoring_Base` that drives the [Game Phase System](../base-lyra-modified/game-phase-system/). Keep distinct concerns in distinct components rather than one large one: Arena, for example, splits its economy and character selection into separate managers, which are easier to reuse and maintain.
* **The signature mechanic.** Most modes add one custom system on top of scoring, the buy menu, the bomb, the control point, the safe zone. The catalog above points to the closest existing one to copy.
* **Pawns, input, and UI.** Which pawns are available, what abilities and input each has, the tag relationships between them (for example abilities blocked while dead), and which mode-specific widgets each role needs.
* **The Experience.** The Experience is the recipe that combines everything into a playable mode: the default pawn, which Game Features to enable, which components and UI to add, and which Action Sets to include. You can ship several per mode (for example `BattleRoyale_Solo` and `BattleRoyale_Squads`, or `TDM` and `TDM_Hardcore`). See [Game Framework & Experiences](../base-lyra-modified/gameframework-and-experience/).

***

## Walkthrough: creating a Team Deathmatch mode

A from-scratch walkthrough using Team Deathmatch as the example, the simplest mode in the framework. Open the existing `TeamDeathmatch` plugin alongside these steps as a working reference.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Create the Game Feature Plugin

1. In Unreal Engine, go to `Edit > Plugins`
2. Click `Add` and choose **Game Feature Plugin**
3. Select **C++** as the base
4. Name it (e.g., `MyTDM`)
5. Add dependencies: `ShooterBase`, `GameplayMaps`, and any other relevant plugins

See [Installing & Setup](../introduction/installing-and-setup.md) for more on plugin creation and dependencies.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Set up Hero Data

Create a `ULyraPawnData` asset in your plugin's `Content/Hero/` folder. It defines the player character:

* **Pawn Class** — the character Blueprint to spawn
* **Ability Sets** — which abilities the player has
* **Input Config** — input action bindings
* **Camera Mode** — default camera behavior

You can reference an existing pawn data asset (such as TeamDeathmatch's or ShooterBase's) or create your own.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Create the Experience Definition

Create a `ULyraExperienceDefinition` in `Content/Experiences/`:

* **Game Features To Enable** — your plugin and `ShooterBase`
* **Default Pawn Data** — the pawn data from the previous step
* **Action Sets** — action sets for features you want (kill cam, accolades, spectating)
* **Actions** — game feature actions for components, UI, and other systems

See [Game Framework & Experiences](../base-lyra-modified/gameframework-and-experience/) for the full breakdown.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Set up the map

1. Create or copy a map into `Content/Maps/`
2. Open **Window > World Settings**
3. Set **Default Gameplay Experience** to your experience definition
<!-- gb-step:end -->

<!-- gb-step:start -->
### Add game rules

Create your win logic as a Blueprint child of `UShooterScoring_Base` (the [shared scoring component](game-mode-details/#shared-systems-every-mode-builds-on)). The base already records eliminations and assists; your child defines the rules on top:

* Set the score and time limits
* Override `OnEliminationScored` for kill-driven win checks, and add a timer for clock-driven ones
* Drive the match through its phases and call `HandleVictory` when a side wins

Add the component through your experience's action sets. Team Deathmatch's `Game/B_Scoring_TeamDeathmatch` is the reference, and its [Extending section](game-mode-details/team-deathmatch.md#extending) lists the exact hooks.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Add UI

Create any mode-specific widgets in `Content/UserInterface/` (scoreboard, HUD elements, end-of-match screen) and add them through your experience's actions or action sets.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Playtest

1. Open your map in the editor
2. Click **Play**, or **Play As Client** for multiplayer testing
3. Iterate on rules, scoring, and UI

For a working reference of every piece, explore the existing `TeamDeathmatch` plugin.
<!-- gb-step:end -->
<!-- gb-stepper:end -->
