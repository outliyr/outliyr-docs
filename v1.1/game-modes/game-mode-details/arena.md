# Arena

> [!INFO]
> **Plugin:** `Plugins/GameFeatures/Arena/`\
> **Dependencies:** ShooterBase, TetrisInventory, GameplayMaps

A round-based competitive mode in the tradition of tactical shooters. Before the match begins each player picks a hero from a roster, and every round opens with a buy phase where players spend currency on weapons from a shop. Dead players stay dead until the round ends, the first team to win the target number of rounds takes the match, and the teams swap attack and defense sides each round so neither keeps a map advantage.

***

## How it plays

The match starts on a character-selection screen rather than in the level. Each player possesses a stripped-down selection pawn, browses the hero roster, and locks in a choice; once selection finishes the chosen hero data drives the real pawn for the rest of the match. From there the mode runs as a loop of rounds. Every round begins with a buy phase: players are frozen behind barriers, given damage immunity, and free to open the shop and buy weapons with the currency tracked in their economy ledger. When the buy timer expires the barriers drop, immunity is removed, and the round goes live. A round ends when one team is wiped out or the round clock runs out, the winning team is credited a round, sides switch, and the next round's buy phase begins.

What makes Arena distinct from the other shooter modes is that purchases persist. Currency and bought items are not stored on the pawn, they live on a game-state economy manager that survives every death and respawn, so a player who buys a rifle keeps it across the round's respawns and the manager re-equips it for them.

***

## Match flow

The round lifecycle is driven by `B_Scoring_Arena`, a Blueprint child of the C++ `UShooterScoring_Base` that lives on the game state. On the server it waits for the experience to load, starts the character-selection phase, binds a handler for each gameplay phase it cares about, and caches every buy-phase barrier actor in the level. A single repeating one-second countdown is reused for whichever timer the current phase needs.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Character selection

Holds players on the selection pawn while they pick and lock in a hero. When this phase starts, the scoring component sets the match's round target.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Round start

Increments the round counter, clears leftover pickups, revives any dead players, resets every active player, and starts the buying phase.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Buying phase

Raises the barriers, applies damage immunity and a movement restriction to everyone, plays the buy-phase cue, and arms the countdown with the buy time. Players shop here.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Playing (neutral)

Begins when the buy countdown reaches zero. Barriers drop, immunity and the restriction are removed, and the countdown is re-armed with the round time. This is live combat.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Round end

Clears the timer, announces the round winner, waits, then enters the side-switch phase.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Round end / switch sides

Swaps the offense and defense team ids, waits, and loops back to round start for the next round.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

When a round win pushes a team to the target round count, the match ends with the post-game phase instead of starting another round.

<details class="gb-toggle">

<summary>Verified phase chain</summary>

`B_Scoring_Arena` event flow, read from the Blueprint graph:

* **BeginPlay (authority)** waits for the experience, starts `Phase_StartCharacterSelection_Arena`, binds `HandleRoundStartPhase` / `HandleBuyingPhase` / `HandleNeutralPlayingPhase` / `HandleRoundEnd`, and caches all `B_BuyPhaseBarrier` actors via `GetAllActorsOfClass`.
* **StartNewRound** (on `ShooterGame.GamePhase.RoundStart`) increments `CurrentRound`, clears the user-facing cue, runs `ResetRound`, `ReviveAllDeadPlayers`, and `ResetAllActivePlayers`, then starts `Phase_BuyingPhase_Arena`.
* **BuyingPhase** (on `ShooterGame.GamePhase.RoundStart.BuyingPhase`) calls `ApplyBuyPhaseRestrictions`, sets `CountDownTime` to `BuyPhaseTime`, and starts the one-second `CountDown` timer.
* **NeutralPlayingPhase** (on `ShooterGame.GamePhase.Playing.Neutral`) calls `RemoveBuyPhaseRestrictions`, sets `CountDownTime` to `RoundTime`, and restarts the timer.
* **CountDown** decrements the timer each tick. At zero it checks the active phase: if the buying phase is active it removes damage immunity and starts `Phase_Playing`; if the neutral playing phase is active it compares alive counts on each team and calls `HandleRoundVictory` for the larger (or `HandleRoundVictory(0)` on a tie).
* **RoundEnd** fires the `RoundDecided` cue with the round winner, waits `RoundEndTime`, then starts `Phase_RoundEnd_SwitchSides`. **SwitchSides** fires the `RoundDecided.SwitchSides` cue, calls `SwitchTeamSides` (a straight swap of the offense and defense ids), waits `SwitchingSidesTime`, and returns to `Phase_RoundStart`.
* `ResetRound` destroys every `WorldCollectableBase` pickup left in the level.

The character-selection, round-start, buying, and round-end phases are Arena assets under `Experiences/Phases/`; the playing, round-end, switch-sides, and post-game phases come from ShooterBase.

</details>

***

## Win conditions

A round is won by elimination or by the clock. Eliminating every player on the opposing team ends the round immediately. If the round clock runs out, the team with more players still alive wins, and an equal count is a draw credited to no team. Each round win routes through `HandleRoundVictory`, which credits the winner a round, broadcasts a round-won message, and checks the match target. The match ends when a team reaches the target number of round wins.

| Winner                | Trigger                                              |
| --------------------- | ---------------------------------------------------- |
| Either team           | All players on the opposing team eliminated          |
| Larger surviving team | Round clock reaches zero with both teams still alive |
| Neither (draw)        | Round clock reaches zero with equal players alive    |

<details class="gb-toggle">

<summary>Verified win routing</summary>

* **Eliminations:** `OnEliminationScored` (override, after the base class records the kill) reads `AlivePlayersInTeam` for each side. Zero defenders alive gives the round to the offense, zero attackers alive gives it to the defense. Otherwise it applies `GE_PlayerDeathNotify_Arena` to everyone for four seconds as a kill notification.
* **Clock:** when `CountDown` reaches zero during the neutral playing phase, it compares `AlivePlayersInTeam` for defense versus offense and calls `HandleRoundVictory` for the larger team, or `HandleRoundVictory(0)` when equal.
* **Round crediting:** `HandleRoundVictory` broadcasts a `Lyra.GamePhase.RoundWon` message, adds `ShooterGame.Score.RoundsWon` to the winning team via the Team Subsystem, then calls `GetTeamScore`, which returns true when that team's rounds-won stack equals `TargetScore`. On a win it calls `HandleVictory`, which fires the `MatchDecided` cue and starts `Phase_PostGame`; otherwise it starts `Phase_RoundEnd`.

</details>

***

## Key systems

### Economy and the buy menu

The economy is the heart of Arena. `UArenaEconomyManagerComponent`, a C++ game-state component, holds a replicated per-player ledger (`FArenaPlayerLedger`) of currency, the items bought into each equipment slot, and the last held slot. Because the ledger lives on the game state rather than the pawn, it outlives death and respawn, which is what lets a player keep what they bought through a round. The buy abilities call into the manager: `PurchaseItem` validates the player can afford the item, updates the ledger, and (by default) equips it immediately through the Equipment Manager, dropping whatever was in that slot as a world pickup. `SellItem` refunds an item but only one bought in the current round, unequipping it and restoring the slot's default if one is configured.

Item prices and shop metadata are not on the economy manager, they are read from an `InventoryFragment_ArenaShop` fragment on each item definition. The fragment carries the buy price, the equipment slot the item belongs in, whether it can be sold, and the icon shown in the shop. The manager reads the price from this fragment when validating a purchase, so adding a buyable weapon is a matter of attaching the fragment and setting its price.

<details class="gb-toggle">

<summary>Verified economy behavior</summary>

From `ArenaEconomyManager.h` and the `B_EconomyManager_Arena` defaults:

* **Ledger persistence:** `PlayerLedgers` is a replicated `FArenaPlayerLedgerArray` (FastArraySerializer). Each `FArenaPlayerLedger` maps slot tags to item definitions and stores `Currency` and `LastActiveSlot`. The manager binds to pawn changes so it can re-equip when a player respawns.
* **Purchase:** `PurchaseItem(PlayerState, ItemDef, EquipmentSlot, CurrentRound, bAutoEquip)` checks currency via `GetItemBuyPrice` (which reads the `InventoryFragment_ArenaShop`), updates the ledger, and when `bAutoEquip` is set drops the displaced slot item with `DropItemFromSlot` and equips the new one.
* **Sell:** `SellItem` only refunds items bought in the current round, controlled by the `RoundBought` field on the item's `FTransientFragmentData_ArenaShop`, and `bCanBeSold` on the fragment. `RefundPercentage` defaults to a full refund.
* **Respawn re-equip:** `ReEquipFromLedger` rebuilds a player's loadout from the ledger and optionally restores the last held slot. Round end calls `SyncAllSurvivorsToLedger` so survivors keep weapons they picked up off the ground, then `ResetAllDeadPlayersLedgers` resets dead players to defaults while keeping their currency.
* **Defaults:** `B_EconomyManager_Arena` ships one default item, a pistol (`ID_Pistol`) in the secondary-weapon slot, re-equipped whenever a slot is empty after a sell or on respawn. The drop collectable classes are the project's static and skeletal world-collectable Blueprints.

</details>

### Character selection

Before combat, players possess `ACharacterSelectionPawn`, a collision-free pawn whose only job is to let the player drive selection abilities. The roster and each player's current pick live on `UArenaCharacterSelectionComponent`, a replicated game-state component, with the per-hero data stored in `UArenaCharacterData` data assets: each holds the hero's display name, selection icon, showcase mesh, the `ULyraPawnData` that becomes the player's real character, cosmetic skin sets, and the level sequences and sounds played on select and lock-in. Selecting a hero applies its cosmetics to the preview, and locking in finalizes the choice.

<details class="gb-toggle">

<summary>Verified selection assets</summary>

* `ACharacterSelectionPawn` implements the team-agent interface and exposes `GetLyraAbilitySystemComponent`, but holds no selection state itself, behavior is added through pawn components and the selection abilities `GA_RequestCharacter` and `GA_LockInCharacter`.
* `UArenaCharacterSelectionComponent` keeps a replicated `FArenaCharacterSelectionArray`; each `FArenaCharacterSelection` records the player state, team, chosen `UArenaCharacterData`, lock-in flag, and skin id. `ApplyCosmeticsForSelection` pushes the pick's cosmetics to the preview.
* `UArenaPawnComponent_PreviewParts` spawns cosmetic child actors on the selection pawn from the chosen skin's `FLyraCharacterPart` list. It is deliberately not replicated so each client renders its own preview, and `ReapplyBodyFromTags` rebuilds the body mesh from the combined cosmetic tags.
* `UArenaCharacterData` is the per-hero data asset; the roster ships three heroes under `Hero/Hero1`, `Hero/Hero2`, `Hero/Hero3`.

</details>

### Buy-phase barriers

During the buy phase players are physically confined and protected. The scoring component caches every `B_BuyPhaseBarrier` actor at startup and toggles their collision on at the start of the buying phase and off when it ends, while applying a shared damage-immunity effect and a movement restriction to all players. This is what freezes the round at the top and prevents early peeking or trading before the round goes live.

<details class="gb-toggle">

<summary>Verified barrier toggling</summary>

`ApplyBuyPhaseRestrictions` enables collision on each cached barrier, applies `GE_DamageImmunity_FromGameMode` (`ShooterBase`) and `GE_BuyPhasePlayerRestriction` (Arena) to all players through the global ability system, and activates the buy-phase cue. `RemoveBuyPhaseRestrictions` disables barrier collision, removes both effects, and clears the cue. The barrier actor exposes `EnableCollision` / `DisableCollision` for these calls.

</details>

***

## Configuration

The round rules are properties on the `B_Scoring_Arena` component:

| Property             | Default | Meaning                                                                          |
| -------------------- | ------- | -------------------------------------------------------------------------------- |
| `TargetScore`        | 5       | Round wins needed to take the match                                              |
| `BuyPhaseTime`       | 30      | Seconds players have to shop each round                                          |
| `RoundTime`          | 300     | Length of the live combat phase in seconds                                       |
| `RoundEndTime`       | 5       | Pause after a round is decided                                                   |
| `SwitchingSidesTime` | 7       | Pause during the side swap                                                       |
| `CountDownTime`      | 15      | Working countdown value, overwritten each phase by `BuyPhaseTime` or `RoundTime` |

Per-item shop values live on each item's `InventoryFragment_ArenaShop`: `BuyAmount` defaults to 100, `bCanBeSold` to true, and `EquipmentSlot` decides where a purchase lands. Buy-phase barriers are placed in the level as `B_BuyPhaseBarrier` actors and discovered automatically. The economy manager's default loadout and drop collectables are set on `B_EconomyManager_Arena`.

***

## Content structure

```
Content/
├── Accolades/
├── Effects/
│   └── Material/
├── Experiences/
│   └── Phases/
├── Game/
│   ├── BuyPhase/
│   ├── Death/
│   └── KillCam/
├── GameplayCues/
├── Hero/
│   ├── Hero1/
│   ├── Hero2/
│   └── Hero3/
├── Input/
│   ├── Ability/
│   ├── Action/
│   └── Mapping/
├── Items/
├── Maps/
├── System/
│   └── Playlists/
└── UserInterface/
    ├── BuyMenu/
    └── CharacterSelection/
```

The scoring, economy manager, and selection components sit under `Game/`; the buy-phase barrier, its restriction effect, and material under `Game/BuyPhase/`; the buy and sell abilities under `Input/Ability/`; each hero's data, icon, and ability sets under its `Hero/HeroN/` folder; and the shop and selection widgets under `UserInterface/BuyMenu/` and `UserInterface/CharacterSelection/`.

***

## C++ classes

* `UArenaEconomyManagerComponent` — game-state component holding the replicated per-player currency-and-purchase ledger; provides purchase, sell, equip, respawn re-equip, and round-end sync.
* `UArenaCharacterSelectionComponent` — game-state component tracking each player's hero pick and applying its cosmetics.
* `UArenaCharacterData` — per-hero data asset (name, icon, pawn data, skins, select and lock-in sequences).
* `ACharacterSelectionPawn` — collision-free pawn possessed during character selection.
* `UArenaPawnComponent_PreviewParts` — spawns cosmetic preview parts on the selection pawn; intentionally not replicated.
* `UInventoryFragment_ArenaShop` — item fragment carrying shop price, equipment slot, sellability, and icon.

***

## Extending

* **New heroes** are added by authoring a `UArenaCharacterData` asset with its pawn data, icon, and cosmetics, then registering it with the roster the selection component reads, no code change is needed for the selection flow.
* **New buyable items** need only an `InventoryFragment_ArenaShop` fragment with a price and equipment slot; the economy manager reads the price through `GetItemBuyPrice` and the shop UI through the fragment.
* **Economy rules** such as round-end payouts, loss bonuses, or starting currency belong on a child of `UArenaEconomyManagerComponent`, which already centralizes currency through `AddCurrency` / `RemoveCurrency` and exposes the round-end sync and reset hooks the scoring component calls.
