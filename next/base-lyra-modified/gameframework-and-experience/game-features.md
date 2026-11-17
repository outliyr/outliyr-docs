# Game Features

Game features are the modularity mechanism. Instead of hardcoding "this game mode has weapons and a HUD" in a GameMode subclass, you package that functionality into a game feature plugin. The experience references the plugin, the system loads it on demand, and its actions inject the functionality at runtime. Different experiences can share the same features. Features can be developed and tested independently. Swap a feature out, and the experience changes shape without touching a single line of GameMode code.

***

## What a Game Feature Is

A game feature plugin is a standard Unreal plugin that participates in the Game Features framework. It lives under your project's `Plugins/GameFeatures/` directory, and it contains two categories of things: **content assets** (abilities, widgets, input configs, sub-levels, gameplay cues) and **Game Feature Actions** that inject that content into the world when the feature activates.

The lifecycle is demand-driven. When an experience references a game feature plugin, the framework loads the plugin and fires its actions. When the experience deactivates (a map change, a mode switch, a session ending), the actions clean up after themselves. The plugin can then be unloaded, keeping memory usage proportional to what the current game mode actually uses. A racing experience never pays for the inventory system sitting in a shooter feature plugin.

This also means features compose freely. A "Core Shooter" feature might add weapon abilities and an ammo HUD. A "Battle Royale" feature might add zone shrinking and a player count display. An experience that references both gets all of it. An experience that only references "Core Shooter" gets weapons without zone logic. The features themselves are oblivious to each other.

### Game Feature Actions

When a feature activates, its **actions** execute. Actions are the bridge between the plugin's content and the running game world. Most actions inherit from `UGameFeatureAction_WorldActionBase`, which means they operate per-world and hook into the **extension system**. The extension system lets an action register interest in specific actor classes. Whenever a matching actor spawns, the action injects its functionality onto that actor. Crucially, this works both retroactively (for actors that already exist when the feature activates) and prospectively (for actors that spawn later during the feature's lifetime). You never have to worry about ordering.

When the feature deactivates, actions clean up in reverse. Components are removed, abilities are revoked, widgets are destroyed, levels are unstreamed. The extension system handles this automatically. You do not need to manually undo anything.

#### AddComponents

`UGameFeatureAction_AddComponents` is Unreal Engine's built-in action for injecting components onto actors by class mapping. You configure a list of entries, each pairing an actor class with a component class: "add `UInventoryManagerComponent` to `ALyraCharacter`." When a matching actor spawns, the component is created and attached. When the feature deactivates, the component is removed and destroyed.

This is the most fundamental action type. Gameplay components that a specific game mode needs on pawns, controllers, or the game state go here. A shooter feature might add a weapon manager component. An inventory feature might add a container component. Because the component only exists while the feature is active, you keep your actor classes lean and let the experience decide what they carry.

<img src=".gitbook/assets/image (49).png" alt="" title="">

#### AddAbilities

`UGameFeatureAction_AddAbilities` grants gameplay abilities, attribute sets, and full ability sets to actors that match a specified class. Each entry in the `AbilitiesList` array targets an actor class and defines what to grant:

* **GrantedAbilities** — individual `UGameplayAbility` classes. Each entry is an `FLyraAbilityGrant` that specifies the ability class and an optional `bSkipDuplicates` flag. When skip-duplicates is enabled, the action checks whether the actor's ASC already has that ability class before granting, preventing double-grants for abilities that might come from multiple sources.
* **GrantedAttributes** — individual `UAttributeSet` classes with optional initialization data tables. These are spawned and registered on the actor's ASC.
* **GrantedAbilitySets** — references to `ULyraAbilitySet` assets, which bundle abilities, effects, and attribute sets into a single reusable package. This is the most common path for complex setups.

The action is configurable per actor class. One entry might grant combat abilities to `ALyraCharacter`, while another grants game-level effects to `ALyraGameState`. When the feature deactivates, all granted abilities are revoked, all attribute sets are removed, and all ability set handles are released.

<img src=".gitbook/assets/image (50).png" alt="" title="">

#### AddInputBinding

`UGameFeatureAction_AddInputBinding` adds `ULyraInputConfig` assets to pawns through the Hero Component. The `InputConfigs` array holds soft references to input config assets. When a matching pawn extension event fires, the action calls into the Hero Component to bind the input config's actions, creating the ability-input bindings that let new abilities respond to player input.

This is the action to use when your game feature adds abilities that need input triggers. The input config maps Input Actions to Gameplay Tags, and the ability system routes those tags to the appropriate abilities. The action tracks which pawns it has bound to, and cleanly unbinds on deactivation.

<img src=".gitbook/assets/image (51).png" alt="" title="">

#### AddInputContextMapping

`UGameFeatureAction_AddInputContextMapping` registers Input Mapping Contexts with the Enhanced Input subsystem. Where `AddInputBinding` connects abilities to input actions via tags, this action connects _hardware inputs to input actions_ via mapping contexts. Each entry in the `InputMappings` array is an `FInputMappingContextAndPriority` with three fields: the `UInputMappingContext` asset, an integer priority (higher wins when mappings conflict), and a `bRegisterWithSettings` flag that controls whether the mapping is registered with the Input Registry subsystem for rebinding support.

This action operates at a broader scope than most. It hooks into both `OnGameFeatureRegistering` and `OnGameFeatureActivating`. During registration, it registers mappings with the settings subsystem so they appear in key rebinding UI. During activation, it adds the mapping contexts to each local player's Enhanced Input subsystem. It also listens for new game instances starting and new local players being added, ensuring late joiners receive the mappings.

On deactivation, the contexts are removed from all players. On unregistration, the settings bindings are cleaned up.

<img src=".gitbook/assets/image (52).png" alt="" title="">

#### AddWidgets

`UGameFeatureAction_AddWidgets` spawns HUD layouts and individual HUD elements for players. It configures two arrays:

* **Layout** — `FLyraHUDLayoutRequest` entries, each specifying a `UCommonActivatableWidget` class and a UI layer tag. These are the structural widget containers that define the HUD's shape.
* **Widgets** — `FLyraHUDElementEntry` entries, each specifying a `UUserWidget` class and a slot tag. These are the individual elements (score display, round timer, objective markers) that slot into the layout's extension points via the `UIExtensionSystem`.

The action tracks widgets per actor through `FPerActorData`, storing both the layout widget references and the `FUIExtensionHandle` entries for slotted elements. When the feature deactivates, all layouts are deactivated and all extension handles are released. This gives each game mode its own HUD configuration without touching a shared widget blueprint.

<img src=".gitbook/assets/image (53).png" alt="" title="">

#### AddGameplayCuePath

`UGameFeatureAction_AddGameplayCuePath` registers asset directory paths with the gameplay cue manager so that gameplay cue notifies from this feature's content are discoverable at runtime. The `DirectoryPathsToAdd` array holds paths relative to the game content directory.

Unlike most other actions, this one inherits directly from `UGameFeatureAction` rather than `UGameFeatureAction_WorldActionBase`. It is not a world action — it applies globally. When your feature contains gameplay cue Blueprint notifies in its content directory, this action ensures the cue manager knows to scan those paths.

<img src=".gitbook/assets/image (54).png" alt="" title="">

#### StreamLevels

`UGameFeatureAction_StreamLevels` streams sub-levels into the world when the feature activates. Each entry in the `LevelsToStream` array is an `FStreamedLevelEntry` with three fields:

* **LevelToStream** — a soft reference to the `UWorld` asset to stream in.
* **bShouldBeVisible** — whether the level is visible immediately after loading (defaults to true).
* **bShouldBlockOnLoad** — whether the game waits for the level to finish loading before proceeding (defaults to true).

This is how game modes inject mode-specific level content. A Battle Royale experience might stream in zone boundary markers and loot spawn volumes. An arena mode might stream in different obstacle layouts. When the feature deactivates, the streamed levels are unloaded, restoring the base map to its original state.

<img src=".gitbook/assets/image (56).png" alt="" title="">

#### SplitscreenConfig

`UGameFeatureAction_SplitscreenConfig` controls whether splitscreen is allowed during this experience. It exposes a single `bDisableSplitscreen` flag (defaults to true, meaning it disables splitscreen when the feature is active). The implementation uses a voting system through `GlobalDisableVotes` and `LocalDisableVotes`, multiple features can each cast a disable vote, and splitscreen only re-enables when all votes are removed. This prevents one feature's deactivation from re-enabling splitscreen while another feature still wants it off.

<img src=".gitbook/assets/image (55).png" alt="" title="">

### How Actions Clean Up

When an experience deactivates, every action's `OnGameFeatureDeactivating` is called. World-scoped actions (those inheriting from `UGameFeatureAction_WorldActionBase`) tear down their per-world state: component requests are released, actor extensions are undone, delegate handles are cleared. The extension system ensures that components added to actors are removed, abilities granted are revoked, input bindings are unbound, and widgets are destroyed. Level streaming actions unload their levels. Input mapping actions remove their contexts from all players.

The cleanup is deterministic and automatic. If you follow the pattern of registering through the extension system in `AddToWorld` and storing your handles in the per-context data map, deactivation handles itself. This is what makes the modular approach viable, you never accumulate stale state from a previous experience.
