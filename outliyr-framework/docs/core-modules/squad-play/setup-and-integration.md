# Setup and Integration

SquadPlay is a game feature plugin that stays inert until an experience asks for it. Wiring a mode up touches four places: the experience enables the plugin and its action set, the team setup opts into the squad team info, the HUD adds the squad widgets, and the map places the redeploy content. The battle royale Duo and Trio experiences are the shipped reference for all of it, so each step below names the asset they use.

***

### Enabling The Plugin

The plugin is `ExplicitlyLoaded`, so nothing in it exists at runtime until an experience lists SquadPlay as a game feature dependency. It depends on ShooterBase, which supplies the interaction prompts, the elimination feed the knock relay writes into, and the spectator a dead player is handed to. How experiences activate features is covered in [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md).

***

### The Downed Action Set

`LAS_SquadPlay_Downed` is the one action set that turns downing on, and an experience adds it alongside its usual ones. It does three things:

* **Adds the downed component to the hero pawn.** `BP_SquadDownedComponent` carries every downed, revive, and banner setting described in the Downed System; an experience that wants different numbers points the action set at its own subclass.
* **Adds the knock feed relay to the game state.** `BP_SquadKnockedFeedRelay` turns knockdown messages into kill feed entries so a knock reads like the first half of an elimination.
* **Grants the squad death ability on the player state**, replacing the standard death ability, with the respawn ability granted beside it for the eventual real death.

The death ability ships in two variants, and which one an experience grants is its respawn policy. `GA_Death_SquadPlay` is the base: when death becomes real it applies the death effect, runs the death camera and widget, records the elimination, and starts the respawn countdown, the right shape for a mode where a dead player waits and comes back on their own. `GA_Death_SquadPlay_NoRespawn` overrides only that final step, handing the dead player to the spectator system instead, the battle royale shape where the only way back is a teammate redeploying your banner. The action set grants the no-respawn variant; a mode with automatic respawns swaps in the base one, and a mode wanting a third behaviour subclasses the base and overrides the same step.

{% hint style="warning" %}
The squad death ability activates from the same death event as the standard one, so an experience must grant one or the other, never both. If your hero's ability sets already grant a death ability, remove it from the squad experience rather than stacking the two.&#x20;
{% endhint %}

***

### Team Setup

The squad snapshot, slot colors, and carried banners all live on `ASquadTeamInfo`, and a mode opts in through the team creation component in its team setup asset: set **Private Team Info Class** to `SquadTeamInfo` or a subclass of it. The Duo and Trio experiences each do this in their own team setup, `B_TeamSetup_BattleRoyale_Duo` and `_Trio`, which also size the squads. Team creation itself is covered in [Team Setup](../../base-lyra-modified/team/team-setup.md).

***

### The HUD

Two widgets carry the squad presentation, wired in two different places:

* **Teammate frames** are added by the experience's HUD action set as a layout widget at the `HUD.Slot.SquadMembers` slot; the battle royale experiences do this in `LAS_BattleRoyale_StandardHUD_Duo` and `_Trio` on top of their standard HUD layout.
* **The downed-aware health bar**, `W_SquadPlay_Health`, replaces the standard health bar through the hero pawn data's widget list; the squads hero data, `HeroData_BattleRoyale_Squads`, registers it in place of the ShooterBase one. It reads the local downed component and recolors while its owner is downed, so the player always knows they are crawling on the bleeding pool.

***

### Map Content

Redeploy needs two pieces of placed and configured content:

* **Respawn beacons** placed in the level wherever members should come back; `BP_SquadRespawnBeacon` also contains the default redeploy handler that answers the [redeploy request](redeploy.md#the-mode-fulfils-the-request).
* **A banner class** assigned on the downed component, `BP_SquadBanner` by default. Clearing it disables banner drops, which turns redeploy off for that experience while leaving downing and revives intact.

***

### Checklist

| Step                                             | Where                      | Shipped Example                             |
| ------------------------------------------------ | -------------------------- | ------------------------------------------- |
| Enable the SquadPlay game feature                | Experience definition      | `B_BattleRoyale_Duo`, `B_BattleRoyale_Trio` |
| Add the downed action set                        | Experience action sets     | `LAS_SquadPlay_Downed`                      |
| Remove any competing death ability grant         | Hero ability sets          | `AbilitySet_Hero_BattleRoyale_Squads`       |
| Point private team info at the squad class       | Team setup asset           | `B_TeamSetup_BattleRoyale_Duo`, `_Trio`     |
| Add the teammate frames widget                   | HUD action set             | `LAS_BattleRoyale_StandardHUD_Duo`, `_Trio` |
| Register the downed-aware health bar             | Hero pawn data widget list | `HeroData_BattleRoyale_Squads`              |
| Place respawn beacons                            | The map                    | `BP_SquadRespawnBeacon`                     |
| Confirm the banner class on the downed component | Downed component defaults  | `BP_SquadDownedComponent`                   |
