# Versions

## Changelog

All notable changes to the Outliyr Framework.

***

### v1.2

Built on Unreal Engine 5.8.

The kill cam is rebuilt on **Visual Replay**, a new plugin that keeps recording what each machine drew and the replicated state of every replicated actor, and plays the recent past back inside the live world. With the demo net driver gone, Iris replication is switched on, and items replicate through the registered subobject list.

#### Breaking changes and upgrade notes

* **The quick bar's `bAutoSelectFirstItem` is now `bAutoDrawWhenEmptyHanded`, and no longer arms a pawn as it spawns.** The old name read as an auto hold competing with the equipment a loadout gives, and the setting did three different jobs under it. What a pawn spawns holding is settled where its equipment is given, by whatever applies the loadout, so the bar no longer draws a weapon while taking stock of equipment the pawn already had. That is what lets a mode start a player with their weapon away: give them no held weapon and the bar leaves it alone. The setting now governs only the two moments during play when the bar would otherwise leave the pawn empty handed, an item arriving in the bar and the active slot being emptied, and the bar follows a weapon the pawn is already holding whatever it is set to. A `PropertyRedirects` entry carries the value across, so an existing quick bar keeps what it was set to. A mode that relied on the bar arming the player at spawn, rather than on its loadout holding a weapon, now needs that weapon marked as held where the loadout is applied.
* **An action ability of your own waits for an equip only once it is listed.** The pawn carries `State.Equipment.Changing` while equipment is being brought up, and what that holds off is decided by the ability tag relationships on the pawn data rather than by the abilities themselves. `TagRelationships_ShooterHero` lists the actions the framework ships. A project with its own relationship mapping, its own pawn data, or its own action abilities adds `State.Equipment.Changing` to the `ActivationBlockedTags` of each action that should wait for the weapon to arrive. An action left off the list behaves as before and can interrupt an equip animation.
* **Reloading now stops firing, where before it did not.** The ranged weapon fire ability listed `Ability.Weapon.NoFiring` in `SourceBlockedTags`, which the ability system only consults when a caller hands `CanActivateAbility` a container of source tags. The input and gameplay event paths that fire weapons hand it nothing, so the tag was ignored and the reload abilities that raise it never stopped a shot. It now sits in `ActivationBlockedTags`, which is checked against the tags the ability system component owns. A project that grew used to firing through a reload will feel the difference, and a weapon that should keep firing while it reloads needs the tag off its reload ability. Anything else written to gate an ability belongs in `ActivationBlockedTags` for the same reason.
* **`ULyraEquipmentManagerComponent::GetFirstHeldInstanceOfType` is now `GetAnyHeldInstanceOfType`.** The old name read as "the weapon in hand" while it really returns whichever held item of a type comes first in slot order, which is a different item whenever two things are held at once. A `CoreRedirects` entry keeps existing Blueprints resolving, and the templated helper is renamed with it. Code that needs a particular hand asks `GetInstanceFromHeldSlot`, and per shot work reads the equipment the firing ability was granted with through `GetAssociatedEquipment`. A new `GetHeldInstancesOfType` returns every held instance of a type.
* **The unused squad id has been removed from the player state.** `GetSquadId`, `SetSquadID`, the replicated `MySquadID` property and its OnRep are gone. Nothing ever assigned the value, so it replicated a permanently unset integer to every client while advertising a squad identity the framework does not have. Squad Play models a squad as a team, and squad membership is read through the team subsystem. A Blueprint that placed the `Get Squad Id` node will report an error on load and should be repointed at `Get Team Id`.
* **Hitscan and projectile shots now carry their shot geometry, and the server refuses shots without it.** `FLyraGameplayAbilityTargetData_SingleTargetHit` gained a `ShotGeometry` and a `BulletIndex`, which changes its wire format. Hitscan and projectile abilities that build their own target data must fill both, which the built in targeting does through the `PerformLocalTargeting` overload that takes a shot index. A subclass overriding `TraceBulletsInCartridge` should read the spread from `InputData.SpreadHalfAngleDegrees` and draw bullet directions from `ComputeSeededSpreadDirection` when `InputData.ShotIndex` is set, or the server will rebuild lines the client never traced.
* **The kill cam no longer duplicates the world or records through a demo net driver.** A project that copied the old kill cam setup can remove `s.World.CreateStaticLevelCollection=1`, `demo.RecordHz` and `demo.RecordHzWhenNotRelevant` from `DefaultEngine.ini`. `ULyraGameEngine` no longer overrides `Experimental_ShouldPreDuplicateMap`; the `GameEngine` entry itself stays.
* **`UKillcamPlayback` and `UKillcamManager::IsInKillCamWorld` were removed**, along with `ALyraPlayerState::GetOverrideViewRotation`. Code that asked whether an actor belongs to the kill cam asks Visual Replay instead.
* **A new LyraReplay module** in `Source/LyraReplay` connects Lyra to Visual Replay. It is listed in the project file and in the Game, Client, Server and Editor targets, so a project merging those files by hand needs all five entries.
* **GameplayMessageRouter gained a `BroadcastFilter`**, a static gate every broadcast passes through. LyraReplay binds it so messages from replay stand-ins never reach live listeners. A project that swaps the plugin for Epic's copy needs to carry the change over.
* **Iris is on**, with `net.Iris.UseIrisReplication=1`. Item instances, their fragments, equipment instances and fitted attachments replicate only through the registered subobject list. A custom container or runtime fragment that overrode `ReplicateSubobjects` registers instead. `UTransientRuntimeFragment::ReplicateSubobjects` and `TearOffReplicatedSubobjects` are replaced by `RegisterNestedSubObjectReplication`, and container prediction traits no longer define `TearOffReplicatedSubObject`.
* **Cameras read a remote pawn's view from its player state.** For a pawn that isn't locally controlled, the Lyra camera modes and the True First Person camera mode take the view rotation from `ALyraPlayerState::GetReplicatedViewRotation`. A camera mode of your own that should look where a spectated player looks does the same.
* **Player controllers need a `ULyraItemContainerClientComponent`** for container windows to follow their items and close when out of reach. `LAS_TetrisInventory_StandardComponents` adds it; another experience that shows shared container windows adds it itself.
* **Async actions end with the life they were started for, through a new AsyncActionLifetime plugin.** Every async action of the framework derives from its `ULifetimeAsyncAction`, including GameplayMessageRouter's `ListenForGameplayMessages` and CommonGame's `CreateWidgetAsync`, `PushContentToLayerForPlayer` and confirmation nodes. Both plugins now list AsyncActionLifetime as a dependency, so a project that swaps either for Epic's copy needs to carry the change over. An async action of your own that waits on the game derives from it too, calls `EndWith` from its factory with what started it and what it watches, and calls `ReplaceEarlierRun` from `Activate` if it keeps listening.
* **Running a listening node again replaces its earlier run.** When the same object runs the same team observer, item query or gameplay message listener node again, with the same inputs and the same event bound, the earlier run ends. A Blueprint that starts a listener on every activation, respawn or bind no longer collects copies that each deliver the same event, and one that relied on that duplicate delivery now receives each event once. A run with other inputs, such as another channel, team or agent, listens alongside.
* **The confirmation nodes and `WaitForExperienceReady` can be cancelled**, and they end without answering once what started them is gone. The experience waiter also ends if its world is cleaned up before the experience loads.
* **Anim Rewind's frame lookups hand back keys rather than copies of frames.** `UAnimRewindComponent::CopyFramePairAtTime` is replaced by `FindFramePairKeysAtTime`, which names the two frames around a time, and `GetPoseForFrameKey`, which reconstructs the pose for one of them or reuses it from the pose cache. `CaptureFrame` takes the pending capture recorded when its sim tick ended, and the hitbox provider's `EvaluateShapeTransformsAtTick` takes a frame key. A trait capturer added to the plugin derives its snapshot from `FAnimRewindTraitSnapshot`, adds it with `AddSnapshot`, restores through the `FRestoreContext` it is handed, and says in its registry entry whether its snapshot can be sent over the network.

#### New: Visual Replay (experimental)

* Records what each machine drew, every Movable mesh, pose, material, visibility, effect, decal and light, and the replicated state of every replicated actor, for a window of recent history. Recording runs only on request, and never on a dedicated server.
* Plays a window back inside the live world for one viewer while the match carries on. Puppets reproduce exactly what was drawn, and shells, real instances of the recorded classes, run their own logic from the recorded state so markers, team colours and attached effects behave. Puppets take the looks their shells set for whoever the replay is watched as, so a kill cam colours teams from the killer's side.
* Gameplay cues, context effects and game events are recorded on the replay timeline. A lead-in repeats the events from just before a window that still showed something as it opened, and the later events on the same actor that may have added to it, so lingering effects such as bullet marks are in place from the first frame, and effects first shown partway through their life are caught up.
* A replay is prepared a little each frame within a budget: its window copied out of the recording, its puppets, the shells of what is there as the window opens, the lead-in, and the shells of actors that appear later. Nothing of it shows until it is ready, so the frame it appears in only switches what the viewer sees, and an actor appearing partway through costs only placing its shell.
* Stopping a replay shows the live world again in that frame. What the replay made goes to a removal queue, `UVisualReplayDisposal`, which hides it at once and removes it `Replay.DisposeBudgetMs` milliseconds a frame, 2 by default, and empties as soon as its world starts a seamless travel.
* A skeletal mesh that keeps animating while this machine isn't drawing it has its pose worked out now and then for the recording, `Replay.UnseenPoseRateHz` times a second, 10 by default, for at most `Replay.UnseenPosesPerFrame` meshes a frame, 4 by default. A character this machine never drew during the window still replays its animation. While a replay plays, which hides the live world, every such mesh is posed every frame instead, so a later kill cam covering that stretch shows them moving smoothly.
* Actors kept for reuse, such as recycled gameplay cue actors, are borrowed rather than owned, through pools a game registers with `VisualReplay::RegisterActorPool`.
* Perspective clips carry another machine's recording of chosen actors, compactly encoded and decoded without trusting the sender, and can stream into a replay that is already playing.
* Seeking, pausing, speed, buffering that eases playback rather than stopping it, and a replay sound class with the live mix silenced.
* A debug suite of recorded facts with reports, anomalies, viewport drawing and console commands, compiled out of Shipping, plus a frame cost benchmark and statistics for what preparing, starting, playing and stopping each replay cost.

#### Kill cam

* Rebuilt on Visual Replay. It plays in Play In Editor and standalone, for a listen server's host, and under Iris.
* The victim watches the killer's own recording, streamed from the killer's machine a slice at a time. The server relays only pieces that match its own record of the kill, within fixed limits, and the victim's own recording plays if the killer's doesn't arrive in time. It is sent at most `Killcam.PerspectiveClipBytesPerSecond`, 128 KiB a second by default, and the rest of it stops being sent once the kill cam ends, whether it played out or was skipped.
* The kill cam starts as soon as the opening of its window has arrived, behind static while it is prepared, `Killcam.PrepareBudgetMs` milliseconds a frame, 4 by default. The frames it starts and ends in do little more than switch what the player sees, with the work spread over the frames before and after.
* The killer's aim, camera and hit markers play with the replay, and the killer's exact recorded camera can be shown instead of the copied camera mode.
* Team colours, markers and the HUD show the match from the killer's side. Live characters the kill cam hides don't recolour for it, so switching sides costs only the replay's own characters.
* Indicators of live actors the kill cam hides are hidden with them, including players who respawned after its window opened.
* No kill cam plays without a killing player, and a bot's kill plays the victim's own recording with the bot's tracks.
* Objectives show their recorded state: control points, the planted bomb, flags, the payload and their markers.

#### Networking and items

* Iris replication is switched on.
* Items register on the container holding them, and containers that start with no access filter their items through net condition groups.
* Destroying an item destroys its copies on clients, so a collected pickup is released. Moving an item to another actor destroys its old copies, and clients that can read the new container receive it as a new copy.
* A client lets go of the item copies left in a world it travels out of. Seamless travel can carry an actor the server has not destroyed yet into the next match while the items it holds stay behind, and the copies the client received kept that world in memory.
* A predicted move across actors, such as equipping from the inventory on the controller onto the pawn, confirms when the item's new copy arrives.
* Container windows follow their item to another actor.
* A Tetris child container takes its root from whatever container holds it, of any kind, and its contents replicate to whoever can read that root.

#### Async actions

* An async action ends once anything it is tied to is gone. An actor, or a component or other object inside one, is gone the moment the actor is destroyed or leaves play, a world once it is cleaned up, and any other object, such as a widget, once garbage collection removes it. An actor that seamless travel carries into the next match keeps its actions running there.
* The team observers, item queries, experience waiter and gameplay message listeners used to run until something cancelled them, and a message listener noticed that what started it was gone only when the next message on its channel arrived. Every pawn, weapon and gameplay cue that started one left it registered with the game instance for the rest of the session, so the count grew with every respawn and every cue a match played, and listeners on quiet channels piled up across matches.
* Team observers that listen to a world's team subsystem, and the experience waiter, end with that world. Gameplay messages travel through the game instance, so a listener started by a widget kept across travel goes on listening in the next match.
* `ObserveTeam`, `ObserveTeamColors`, `ObserveTeamAliveCount`, `ObserveTeamAliveCountById`, `QueryInventoryAsync` and `WaitForExperienceReady` are exported from the LyraGame module, so another module can start them in C++.

#### Teams, UI and gameplay

* A quick bar can put the active weapon away. Pressing the slot that is already selected did nothing; with `bReselectActiveSlotToHolster` on, it holsters that slot's item and leaves the pawn unarmed, and pressing the slot again draws it back. The slot stays selected while its item is away, so the bar still shows what the player will draw next and nothing auto-selects around the empty hands. Selecting a different slot draws that slot's item and ends the unarmed state, as does anything else that puts the active item back in hand. `SetActiveSlotHolstered` and `IsActiveSlotHolstered` reach the same state from code, and the active index message carries a `bHolstered` flag, which the quick bar and spectator slot widgets read so a slot whose weapon is away no longer draws as the one in hand. The shooter quick bar ships with the gesture on. A project with its own quick bar leaves `bReselectActiveSlotToHolster` off to keep reselecting a slot doing nothing, and a widget of its own that ignores the flag will show a put away slot as held.
* `ObserveViewerTeam` fires without a team until the local player state is known, then follows the viewer, so team colours resolve on clients whose player state arrives before their player controller.
* An indicator set to go with its component is removed the moment the component's actor ends play.
* Objective markers and nameplates stop their observers when they are unbound, so pooled widgets no longer pile up listeners.
* A control point applies `bStartsActive` on the server only, so clients and late joiners show the replicated state.
* A planted bomb stays where it was planted and keeps its planter named as the last carrier.
* A number pop component makes a new effect when the one it held is gone.
* Generated weapon icons draw from their alpha in the elimination feed, the death footer and the kill cam, and the weapon icon and its glow in the death UI are drawn at the right size.

#### Anim Rewind

* A captured frame no longer records a graph partway through its update. Capture runs on worker threads, and so does the animation update, with nothing ordering the two, so a frame could hold some traits from before the update and some from after. Each character's animation update now waits for its capture.
* Every movement sim tick records the position it ended at. When a frame ran several sim ticks to catch up, all of them were stored with the last tick's position.
* A reconstructed pose comes out in the mesh's bone order. UAF orders bones by level of detail internally, so on a mesh whose lower LODs drop bones, rewound hitboxes could be placed from the wrong bones.
* Blend Smoother and Blend Smoother Per Bone nodes placed in a graph are captured. Capture looked only for the shared core trait, which those nodes don't report themselves as, so their blend weights were never recorded.
* A blend by bool that switched during a smoothed transition reconstructs both of its children. The child blending out was lost, and a child the restore had to create again skipped its initialization.
* Reconstructing on a worker thread is safe against garbage collection. Captured frames are reported to the garbage collector, collection waits for a reconstruction in progress, and a frame holds the graphs and factories it refers to directly, so a worker never loads an asset to find them. Two characters reconstructing on different threads no longer race on a shared counter.
* Network sync anchors are applied through the animation system's task queue, just before the character's next animation update, rather than whenever they arrived. The sync scope node registers its graph with the component on the game thread.
* A full state anchor carries only trait state that survives being sent. Motion matching, pose history, dead blending and blend space keep part of their state outside the property system, so their snapshots arrived on clients with that part empty and reset those traits. Clients now keep their own state for them.
* `RewindSkeletalMesh` falls back to the mesh of the actor's first skeletal mesh component when left empty. The hitbox provider looks bones up on that mesh, which is the one the pose is reconstructed in, and warns when its skeleton differs from the hitbox mesh's.
* A character that switches to a different animation graph starts a new epoch and rebuilds its evaluator, so history captured from the old graph is never reconstructed against the new one.
* Changing the rewind window or sim step while frames are recorded clears the history instead of reading past the end of the buffer.
* The warning for a graph with no registered instance names the Anim Rewind Network Sync Scope node.
* Reconstructing a past pose takes about half as long, from 94 to 45 microseconds at the median on the profile test's graph, because the variable restore for each graph asset is worked out once and reused. Shots against the same moment, such as a shotgun's pellets, reuse the cached pose without copying the captured frames, and the hidden actor each character reconstructs against no longer ticks its mesh.

#### Fixed

* A shot's muzzle flash, tracer and impact effects are drawn on the weapon that fired, rather than on whichever weapon the pawn happened to list first. The cues resolved their weapon by asking the pawn which one was in hand, which is the wrong weapon whenever two are held and, during a swap, whichever the equipment manager listed first. The effects then came off a gun that was not the one shooting, including one still on the character's back. The fire abilities now name the firing weapon on the cues they play, and each cue reads it back through `ULyraEquipmentCueLibrary`, which hands back nothing rather than a guess when a cue cannot tell which weapon it belongs to. The shared `ShooterBase_GetGun` and `ShooterBase_GetRangedWeaponInstance` macros are unchanged, since their other callers ask a pawn level question and have no cue to read from.
* Projectiles that are simulated rather than spawned as actors, which bullet drop weapons fire, now carry the equipment that fired them. The firing ability filled the projectile message's source object with its associated inventory item, while both readers of that field want the equipment: the impact cue reads it to find the weapon whose effects to draw, and the damage path casts it to the ability source interface to pick up the material and distance multipliers. Neither resolved, so bullet drop impacts drew nothing and their damage ignored falloff and material. The field is typed as the equipment instance on the message, the simulated projectile and the impact cue batch, so only the equipment fits. Bullet drop damage at range therefore changes, to the numbers the weapon's curves always described. A firing source with no equipment behind it, such as the turret demo, still leaves it unset.
* A weapon swap no longer leaves its weapon stuck in the state it was leaving when the equip animation is cut short. The visual actor swap waited solely on a notify partway through the equip or holster montage, so anything that stopped the montage first meant the notify never arrived and the swap stayed parked for good, which shows as a weapon that reads as held while it is still on the character's back. Firing was the common interrupter: the fire ability plays its montage through `PlayMontageAndWait`, and an ability system component plays one ability montage at a time, so a shot replaced the equip montage part way through. Holding fire across a swap therefore cut the animation and orphaned the swap. The equipment instance now notes the montage that the held state change started and settles the swap when that montage ends for any reason, bringing the actors to the state the equipment reports.
* A shot now leaves the weapon that fired it rather than whichever weapon the equipment manager listed first. The trace origin and the weapon state tick both asked for the first held instance of a type, which is the wrong weapon whenever two are held, and during a weapon swap answered with whichever the manager happened to list first. Muzzle traces left one gun while the ability fired another, and spread and heat built up on a weapon that was not shooting. The trace origin reads the weapon its ability was granted with, and every held weapon is ticked rather than only the first.
* Putting a weapon away now stops an ability that is still running on it. Revoking an ability set clears its abilities, which ends running instances without marking them cancelled and without telling the owning client, so a held fire button went on firing against a weapon already on the character's back and Blueprint cancellation logic never ran. Granted abilities are cancelled before they are revoked.
* A shot that reaches server validation after its weapon has gone no longer dereferences it. Putting equipment away revokes the abilities it granted and clears the spec the weapon is read from, which a shot still in the lag compensation queue did not expect. Those paths now bail, and an activation that finds no weapon ends instead of asserting, which could bring down a packaged build.
* The aim assist debug overlay follows its console variable. `lyra.Weapon.DrawAimAssistDebug` registered the overlay when it was not registered and unregistered it when it was, from a function that runs every frame the look mapping is evaluated, so the overlay drew on every other frame. Turning the variable off left the overlay registered for good, drawing nothing only because the draw itself rechecked the variable. It is now registered while the variable is on and unregistered when it goes off.
* Aim assist finds targets again. The aim assist collision channel is read from a settings section in `DefaultGame.ini` whose class path still named Lyra's ShooterCore module, so it never matched the ShooterBase settings class and the value was never read. Aim assist fell back to the code default of `ECC_EngineTraceChannel5`, an engine reserved channel, and swept for targets on it. The characters and practice targets that can be aimed at carry the `AimAssist_OverlapDynamic` collision profile, which overlaps only `Lyra_TraceChannel_AimAssist` and ignores every other channel, so the sweep returned nothing and no target was ever found. The section names the ShooterBase settings class now, so the configured `ECC_GameTraceChannel5` applies and aim assist behaves as its settings describe. A project that had tuned around aim assist doing nothing will feel it on gamepad, and a project that does not want it turns it off in the aim assist settings as before.
* A quick bar follows a weapon the pawn is already holding, whatever its auto select setting says. That setting decides whether to draw a weapon the pawn is not holding, but it also gated the bar noticing one it was, in both the one-off sync a bar runs when it binds and the path that answers equipment changes. A pawn spawns holding its loadout before its bar exists, so with the setting off the bar sat with no selection while a weapon was in hand: the weapon name and ammo, the spectator bar and anything else reading the active slot showed nothing until the player cycled slots, which selected the weapon they were already holding. Only drawing an unheld weapon is gated now.
* A quick bar slot no longer draws as the weapon in hand before anything has told it which slot is active. The slot widget's idea of the active index started at zero, the index of the first slot, while the quick bar uses minus one for nothing selected. A slot learns the real index when it is constructed, but it starts listening for slot contents before that, and equipment arriving as a pawn spawns broadcasts those contents first, so the first slot compared zero against zero and highlighted itself. It then stayed highlighted until something moved the selection, which is why pressing a slot key cleared it. The widget starts at minus one now, so a slot that has not been told cannot claim to be the one in hand.
* A client no longer keeps a pocket world in memory after leaving the level it was opened in. Pocket levels made the local player controller the owner of every actor in them, and the controller survives seamless travel, so every inspection or icon pocket level opened during a session stayed loaded until the player disconnected. Pocket level actors are now left without an owner.
* The icon generator lets go of a world it is carried out of. Seamless travel can carry the generator into the next match, and it kept the pocket level of the match it left, which kept that whole map in memory. It now releases the pocket level, its stage and any request in flight when that world is cleaned up, answers those requests with null, and streams in a new pocket level for the next request.
* Requesting an icon on a client that never renders, such as one launched with -nullrhi, no longer crashes the render thread. Such a client answers every icon request with null straight away and never streams in the icon pocket level. The readback also answers with null instead of crashing when a render target's resource has been released.
* Replacing or removing the icon generator component while an icon is being captured no longer crashes. Adding a component under a name already in use replaces the old one in place, and a capture timer the old component left behind went on to run on its replacement. Ending play now stops every capture timer and answers the request in flight with null.
* An icon whose stage is destroyed while the capture waits on it is answered with null rather than captured from the destroyed stage.
* Generating an icon no longer stalls the game thread. Each capture waited for every texture streaming request in the game to finish, flushing the render thread as it did, which cost 8 to 10 milliseconds per capture and up to 40 on a busy frame. A capture now issues its own item's texture requests and waits for those alone over the following frames. In a Team Deathmatch match with nine bots, this removed a 10 millisecond hitch from every kill, when the elimination feed renders the killing weapon.
* The ShooterBase guns cache their generated icons. Caching was switched off on all six, so the elimination feed and the kill cam rendered the same weapon again for every kill. The cache key covers the weapon, its attachments and the rendered size, so each loadout now renders once per size and every later request reuses it.
* Shooter bots no longer log "Could not find context actor" and "Missing external data requirements" StateTree errors at match start, or hit the "The tree started with a valid context and it's now invalid" ensure after seamless travel. A bot's StateTree now runs only while the bot possesses a pawn the tree can run against. It stops when the bot unpossesses its pawn, including when seamless travel leaves the pawn behind, and a start request made before a suitable pawn is possessed leaves the tree idle until one is. `StateTreeAI` on `AShooterBotAIController` is now a `UShooterBotStateTreeComponent`, a subclass of the AI StateTree component, so Blueprints that use it keep working.
* A player or bot whose chosen player start has no room for its pawn no longer has a whole pawn built and destroyed on every frame until the start clears. The game mode checks the start before spawning and tries again after `BlockedStartRetryDelay`, half a second by default, and logs one warning per wait that names the start and points at the map having too few free player starts. On a test map with four starts and 31 bots this removed around 500 "SpawnActor failed because of collision" warnings from every match start.
* A client that travels to the next match no longer keeps the previous match's experience running. If the end of the old game state's replication had not reached the client when it travelled, seamless travel carried the old game state into the next match with its experience still active. The next experience then activated on top of it, which fired the `ComponentRequests` and `ExtensionRequestHandles` ensures in the add abilities, add input binding and add input mapping actions. The old game state also picked up the new match's game state components, so eliminations and accolades could show twice, and when it was finally destroyed it switched off the new match's game feature actions and plugins. A client now leaves its copy of the game state behind with the old world when it travels.
* A Lyra anim instance stops receiving gameplay tag callbacks as soon as it is torn down. Its gameplay tag property map stayed bound to the ability system component, which lives on the player state and outlives every pawn, until garbage collection deleted the instance. Tag changes in between called back into the anim instances of destroyed pawns and swapped out anim layers, and logged "GameplayTagEventCallback called with corrupted RegisteredOwner or corrupted CachedOwner" hundreds of times per match. The map is now unbound when the anim instance is uninitialized.
* A client no longer refreshes the bones of every character it isn't drawing. The lag compensation snapshot source switched each character's mesh to refresh its bones every frame and turned off its update rate optimisations on every machine, though only a machine with a lag compensation manager keeps hitbox history. It now stays idle anywhere else and leaves the mesh animating under its own settings.

* Releasing a pawn from its ability system no longer reports the pawn as alive. `ULyraHealthComponent::UninitializeFromAbilitySystem` cleared the death tags and reset `DeathState` to `NotDead` through the same `ClearGameplayTags`, so a pawn that outlives its ability system, such as a body left in the world to be looted, answered `IsDeadOrDying` with false and replicated a death transition running backwards, which `OnRep_DeathState` itself logs as a prediction error. `ClearGameplayTags` now clears only the tags, which still has to happen on the way out because a player state shares its ability system with every pawn it possesses in turn, and the reset moved to `InitializeWithAbilitySystem`. Aim assist skips a target that is dead or dying and Squad Play reads the same state for its downed and team status, so a released body had been an aim assist target that counted as alive.
* The extraction mode's body stays in the world after its player returns to the lobby. A controller takes whatever pawn it still possesses with it when it is torn down, so the body and the loot container on it were destroyed as the dead player left the match, which is the moment anyone else could have looted it. `UExtractionSubsystem::TravelPlayerToMap` unpossesses a body whose death has started before it travels the player, and leaves a pawn that is still alive alone, so a player who reached extraction leaves no lootable copy of themselves behind.
* The extraction mode's body keeps the look it died with. The parts a controller applies belong to the controller and come off when it stops possessing the pawn, which left the body as its invisible base mesh, present and lootable but unseen. The experience adds `B_PickRandomCharacter_Extraction`, a `UExtractionControllerComponent_CharacterParts`, which copies the parts onto the pawn as the pawn's own before the controller takes its copies away.
* The extraction hero plays a death animation again. `B_Hero_Extraction` overrode the inherited `Death Montages` with an empty array, so the inherited death handler read the first entry of an empty array and logged a Blueprint error on the server and on every client at each death, and the body went straight to ragdoll.
* An extraction body's loot prompt and loot window no longer depend on the player who left. `B_Hero_Extraction` built the prompt from the dead player's player state, which is destroyed when its player leaves the match, and `GA_Interact_LootDeadPlayer` read the container for the window's title from a variable nothing assigned. The hero caches the dead player's name as replicated text of its own, and the ability names the body's own container.

* An item that renders its own icon shows it in an equipment or attachment slot. `ULyraItemViewModel::SetupGeneratedIcon` was the only thing routing a view model's icon through the runtime generator, and nothing called it, in C++ or in Blueprint, so every slot driven by the base view model fell back to the static icon and a weapon, which has none, showed nothing at all. Taking an item now finds the icon generator of the local player, who is the player the icon is drawn for rather than the one who owns the item, so the items on a looted body render as well. A view model that renders its icon its own way, as the tetris grid does, refuses this and keeps its own path.
* An icon that finishes rendering after its slot has already drawn now reaches the slot. A slot keeps a copy of its item's icon, taken when it was given the item, and the item view model set its icon from the finished render without announcing the change, so that copy stayed as it was until something handed the slot its item again. An equipment slot was blank until the item was moved out and back, and an icon rendered again after an attachment was fitted never appeared.

#### Changed

* Weapon actions wait while a weapon is being brought up. The pawn carries `State.Equipment.Changing` from the moment equipment becomes held until the montage animating it ends, and the hero's ability tag relationships hold off firing, melee, grenade, reload, placing an object and inspecting while it is there. Any of those could previously start the instant a slot was pressed, which cut the equip animation short and acted from where the weapon still was, so a weapon could fire from the character's back and then appear in their hand. Jump, dash, drop and emote are deliberately left alone, since none of them plays a weapon montage and holding movement would cost more in feel than it buys. Aiming is left alone for the same reason, and is a row to add for a project that would rather a player could not aim through a weapon that is still coming up. An equip animation that settles before its last frame can declare the weapon ready early with the Equipment Ready notify, rather than making everything wait for the tail of the animation. Without that notify the window lasts until the montage ends.
* The Squad Play plugin description no longer claims the feature is shared with extraction. Only the battle royale duo and trio experiences wire it in.
* `ULyraExperienceDefinition` is exported from the LyraGame module, so another module can subclass it in C++.
* `ULyraAnimInstance` is exported from the LyraGame module, so another module can subclass it in C++.
* A player or bot that stops retrying after a failed spawn now logs a warning instead of logging at Verbose, since it is left without a pawn and nothing restarts it. Bots used to give up without logging anything.
* The server rebuilds every hitscan bullet line itself instead of tracing the endpoints a client reports. Spread is drawn from a stream seeded by a per controller shot index, so the server reproduces each bullet's direction from the origin, aim and spread the client reports, and a client can no longer send pellet lines of its own choosing. The shot index must advance with every shot, which stops a client replaying a shot or picking freely between spread patterns. Where a shot may start and where it may be aimed depend on a game's cameras, vehicles and movement, so the framework does not limit them. A game that wants to can refuse shots by overriding `IsShotGeometryPlausible`.
* Projectile weapons draw their spread from the same seeded stream as hitscan, and the server rebuilds each projectile's direction before it spawns. Every target data entry spawns one projectile, so the client now sends exactly one entry per bullet and the server keeps at most that many. Before this, a modified client could aim each projectile wherever it chose and spawn as many as it sent entries. The server keeps how far along the line the client's aim landed, which converging and gravity aiming need, but not the line itself.
* Every shot or pellet the server refuses is logged to `LogShotValidation` with the shooter, the shot and pellet, and the reason, such as which actor and surface the server's trace hit against what the client claimed. The category is silent unless raised to Verbose, for example with `Log LogShotValidation Verbose` on the server, so it costs nothing in normal play.
* One bullet can no longer be reported as several hits. Each further hit a bullet claims must name a different actor the server's own trace passed through, and bullet indices beyond the weapon's bullets per cartridge are refused.
* Penetrating hitscan validates each bullet as a connected path. A segment must leave the previous impact the way that surface's penetration or ricochet settings allow, within its depth, exit spread, penetration count and the weapon's range, and every segment after a refused one is refused as well.
* Environment queries run for at most 2 milliseconds a frame, down from the engine's 10. A burst of bot cover searches used to take up to 8 milliseconds of one frame and now spreads over a few frames, which only delays a bot's choice by those frames. `MaxAllowedTestingTime` under `[/Script/AIModule.EnvQueryManager]` in `DefaultGame.ini` sets it.

* `ULyraPawnComponent_CharacterParts` is exported from the LyraGame module, so another module can add, remove and read a pawn's character parts in C++. Its controller side counterpart was already exported, and the hand written export on `GetCharacterPartActors` is gone now that the class carries one.
* `ULyraControllerComponent_CharacterParts::OnPossessedPawnChanged` is protected and virtual, so a subclass can decide what a pawn keeps when the controller stops possessing it.

* The icon generator and the view models that ask it for icons say when an icon cannot be produced, on `LogItemContainerUI` at Verbose. Every way a request could be refused used to answer with no texture and no explanation, which left a blank slot and nothing to read. Raise it with `Log LogItemContainerUI Verbose`.

#### Testing

* Visual Replay's automation suite, grouped by area.
* Each game mode's kill cam tests live in that mode's own test module, so removing a mode never breaks another plugin's tests.
* Network tests for item moves and pickups, access filtering, predicted equips across actors, window rebinding and the viewer's team.
* AsyncActionLifetime's own tests, and tests that each of the framework's async actions ends with what it is tied to and replaces its earlier run.
* Anim Rewind tests for the bone order remap, Blend Smoother capture, a blend by bool switched during a transition, live graph registration and switching, network anchor serialization and filtering, and resizing the history buffer. The determinism tests now compare each reconstruction against the live update instead of against another reconstruction.

### v1.1.2 (18 August 2026)

#### Fixed

* Perk stat effects never reached the gunsmith preview. The preview rig granted perks before equipping the weapon, and an on-spawn ability activates as soon as it is granted, so every perk took its reading from a rig carrying nothing and changed no numbers the panel could show. Perks are now granted after the weapon, which is the order used at spawn.

#### Changed

* The debug loadout answers before the player's selection rather than after it, so assigning one overrides as intended. It exists only in editor builds, so a packaged game ignores it however it was left, and each grant that uses it is logged.
* Client loadout submissions are bounded before the server processes them. Sanitization decides what a submission may grant, but it runs over whatever arrives, so a submission describing far more entries than any rule set offers is now refused rather than allocated and walked in full.
* An attachment dropped because another one blocks its slot is reported like every other kind of drop, so a loadout that comes back altered always leaves a trace.

***

### v1.1.1 (18 August 2026)

#### Fixed

* Weapon stat modifiers computed from zero, so attachments and perks could not change vertical or horizontal recoil. An equipment instance whose attributes arrived through property copy began with entries its lookup map knew nothing about, so adding an attribute appended a second entry under the same tag. Queries take the first match, which was the copied one, and its base value had never been set. Adding an attribute now searches the array those queries use, initializes an entry already carrying the tag, and drops duplicates left by an earlier desync, which repairs affected content on load rather than requiring it to be authored again.
* The ACOG static mesh rendered far too small in the loadout.

> [!WARNING]
> This affected gameplay, not only the gunsmith's stat panel. Recoil modifiers were being discarded in a match as well. The gunsmith was simply the first feature to display the value and make it visible.

***

## v1.1 (18 August 2026)

Built on Unreal Engine 5.8. 473 commits since v1.0.

Two finished systems land in this release, loadouts with a gunsmith editor and Squad Play, alongside the engine upgrade and a large amount of structural work in replication, lag compensation and the item system. Two more arrive unfinished and are labelled as such: Anim Rewind is experimental, and True First Person is early groundwork rather than something to build on. Everything below is covered by automation tests.

### Breaking changes and upgrade notes

Redirects were deliberately removed for several of these, so content still pointing at the old paths will not resolve. Read this section before upgrading a project built on v1.0.

* **The legacy team map has been removed.** Teams are now authored by id, with a fill rule covering the rest. The shipped game modes were migrated. Modes you authored yourself need the same change, and team assignment now reads from the authored teams.
* **The details fragment was renamed, and the icon fragment split out of it.** Items carry an icon fragment with either an authored or a generated source. The renamed paths were baked into the shipped content and the redirects dropped.
* **Item icon generation and item inspection moved out of TetrisInventory into the core item system.** You no longer need the Tetris inventory to use either. The Tetris inspection widget subclass has been removed, class paths were baked into content, and the redirects dropped.
* **Lag compensation is now its own plugin** rather than living inside ShooterBase. Include paths and module dependencies change for anything that referenced it.
* **CommonStartupLoadingScreen is now its own plugin.**
* **The Battle Royale solo experience was renamed** to `B_BattleRoyale_Solo`, and the hero split into solo and squads variants.
* **`GetRewindTime` was dropped** from the ShooterBase death ability, where it duplicated the base implementation.
* **Redirectors left by the Loadout plugin move have been removed** now that the move has settled.

### Engine / Lyra Updates

* Upgraded the entire project from Unreal Engine 5.6 to 5.8, covering both files unmodified since 5.6 and locally modified files merged by hand.
* Added the 5.8 HDR display settings feature, with an HDR calibration widget wired into the settings screen.
* Split CommonStartupLoadingScreen into its own plugin.
* Replaced deprecated RHI and interface object accessors, and cleared plugin dependency and StructUtils deprecation warnings.
* Switched UPROPERTY metadata to fully qualified type paths.
* Disabled the editor async loading thread, which was racing skeleton curve metadata on first load and silently filtering animation curves.

### New: Loadout and Gunsmith

A loadout system with a menu time editor. Players build configurations up front and spawn with exactly what they authored.

* Loadout data model covering weapons with recursive attachment trees, gear, spare inventory items and perks, identified by a stable id and stored in the player's save.
* Rule sets per experience declaring which builder slots exist, what each slot offers, the attachment budget per weapon, the custom loadout cap, and the fallback loadout. Different modes use different rule sets with no code changes.
* Perks as their own definition asset carrying a name, description, icon and the ability set they grant, plus an ability for perks that change how the weapons a player brought handle.
* Live stat preview that equips the candidate build on an isolated rig and lets the real ability pipeline run, so any attachment that changes stats the normal way previews correctly with no extra authoring. Stat rows carry display units, bar ranges and two decimal deltas.
* Preview of what an attachment would do before fitting it.
* Gunsmith editor built on view models you can rebind or replace, with a 3D weapon stage, generated weapon and attachment icons, and a workbench layout.
* Validation runs twice, reporting one error per violation when the player saves, and stripping anything illegal when the server grants. Every strip is logged with what was dropped and why.
* Loadouts can be taken into a match, with an in match picker in the pause menu that applies at the next spawn.
* Game modes can consume loadouts without depending on the gunsmith.
* Loadout contents readable by group, and read in the order the rule set lists its slots.
* Gunsmith example plugin with its own experience, armory map and preset loadouts.
* Automation suite covering the data model, validation and persistence.

### New: Squad Play

A game feature covering squadmate state and the downed loop. Opt in per experience.

* Downed state that intercepts death, with a bleed out that drains over time and shortens with each knockdown in a life, plus an invulnerability window on entering it.
* Revive, self revive driven by a granted charge, and squad wipe sharing.
* Redeploy from a dropped banner at a respawn beacon, with banner retrieve and beacon redeploy abilities carried on the squad. Members who are already spectating can be redeployed.
* Teammate frames widget and HUD slot showing every tracked resource rather than health alone, with a per player squad colour resolver and a resource bar that recolours at runtime for the downed state.
* Squad knockdown relayed to the kill feed.
* Squad death moved into a gameplay effect so it stops interfering with the downed state.
* Members are not reported dead during pawn swaps or on pawns without health.

### New: Anim Rewind (experimental)

Rewinds animation by re-running the animation graph rather than storing bone transforms, which keeps memory flat and covers systems a transform buffer cannot.

**This plugin is experimental.** It requires a UAF graph and Mover, and the existing snapshot backend remains the default for lag compensation.

* Reconstructs a past tick by re-simulation, covering animation graphs, state trees including nested and stacked dynamic ones, and standalone blend stacks.
* Determinism audit across the full core trait catalog, with control rig, motion matching, chooser, layer stack, mirroring and montage injection each classified and covered by tests.
* Cross process determinism gate proving bit identical replay of live Mover simulation capture from a packaged build.
* Capture ships as a placeable node sourcing its graph from the live instance, with buyer graph variables carried generically.
* Configurable history window, capture in a single walk with a reused variable manifest, a flat array pose cache, and reconstruction on a warm evaluator.
* Capture runs in parallel across characters, and reconstruction is safe to call from a worker thread.
* Bridges into lag compensation as a deterministic pose provider, producing poses on demand on the worker thread.
* Debug view drawing rewound hitboxes and logging the inputs a rewound tick reconstructs from.
* Network animation sync scope and lean rewind anchor, with the estimated one way latency stored from clock sync.
* Performance and memory profile test, with cycle counters across rewind, lag compensation and the projectile manager.

### True First Person (alpha)

Groundwork for a true first person camera driven from the character's eye rather than a bone coupled camera. This is foundation rather than a feature. It is a stage earlier than Anim Rewind, it is not something to build on yet, and its shape is expected to change.

* True first person camera mode replacing the bone coupled camera, with the eye derived from the rig rest pose and pitch bent through the spine chain instead of swinging a pivot.
* Spine pitch trait, the first custom UAF trait in the project.
* First person body split that hides the head, gated on the camera mode and driven by camera distance, with per part hiding for character part pawns and a distance exit for the blend out.
* Opt in breathing and sway.
* A Mover driven pawn and a Mover jump ability, with character parts able to attach to non character pawns.
* Uses the UAF animation graph and Anim Rewind, and requires the UAF and Mover plugins.

### Networking and replication

* **Push model replication enabled project wide**, covering the core pawn, player state, health component death state, pawn data and team id, weapon spawner availability, kill confirm team, teammate spectator and character selection team, and the capture the flag, search and destroy bomb, bomb site and control point state.
* Replication filtered by access: inventory items and container items reach only connections with container access, spectator data only subscribed spectators, and team private info only its own team. Items registered before an owner connects are now delivered when they do. Each filter is implemented for both replication drivers, so scoping holds whether or not Iris is enabled.
* Character part, shared tag and permission, inventory family and predictive projectile lists backed by the Iris fast array serializer, which behaves as a normal fast array under the legacy driver. Lists carrying item subobjects stayed on the polling serializer.
* Container viewers tracked on the server so unreachable views are invalidated rather than going stale.
* Same container item swaps execute in place instead of remove and add, which fixes the weapon swap desync and lets the delta be its own inverse.
* Each item registers on only one container, so equipment replicates correctly.
* Item instances reset to the null slot when they stop replicating, and keep a deterministic identifier on the class default object.

### Lag compensation

* Extracted from ShooterBase into its own plugin.
* Rewritten snapshot backend behind a unified hitbox source contract, with the narrowphase shared between backends.
* Deterministic hitbox provider seam, letting Anim Rewind supply poses as an alternative source.
* History edge clamping reported rather than silently applied, and hitbox source registration covered by tests.
* Hitbox sources register on experience load, and silent capture and registration misconfigurations now warn.
* Server hitscan rewind trace matched to the client sweep radius, bone materials resolved through the body instance, and the ranged weapon rewind timestamp centralised.

### Items, inventory and icons

* Item icon generation and the item inspection widget moved into the core item system, so neither depends on the Tetris inventory.
* Dedicated icon fragment with an authored or generated source, resolved through one shared library. Icon and inspect fragments are independent mesh sources, and an item with no inspect fragment falls back to its pickup mesh.
* Generated icons supported in the base item view model, rendered a row at a time, sized to the requested dimensions, and able to render Nanite meshes.
* Icon captures wait for the pocket world to be ready and for their textures, compile override materials before use, and cache only settled captures.
* Items render where they are looked at and draw flat where they are not, and are captured at the size they are drawn.
* Ability costs can be paid out of the inventory.
* Fragment injection now works in cooked builds.
* TetrisInventory keeps the child inventory when an empty container is loaded.

### Equipment, weapons and attachments

* Deployable equipment slot, with a frag grenade and a claymore as working examples. A deployable slot can carry more than one, and shows a HUD count of what is left.
* The claymore places against the surface it is aimed at, arms, and detonates server side, with laser cosmetics and its own cooldown.
* Attachments can declare other slots unavailable while fitted, and the gunsmith shows a blocked slot as unavailable.
* Attachments can hand over the magazine and spare ammunition their capacity implies, returning it when removed.
* Attachment actors reach clients in every net mode, are granted and placed without a controller in the way, appear when fitted before the weapon is held, and are put down when the weapon leaves a player.
* A weapon on the ground wears the attachments it was carrying, controlled per item and spawned locally on each machine.
* Tag attributes recompute from a base value so modifiers reverse exactly.
* Recoil state clears when a gun is holstered, and the recoil calculation can be overridden by subclasses.

### Teams

* Teams are authored by id with a fill rule for the rest, replacing the legacy team map.
* Team display asset exposed to Blueprint, team private info exposed through the team subsystem and kept always relevant.
* Blueprint can ask whether one actor may damage another.
* Team alive count updates guarded against world teardown.

### Game modes

* Battle Royale duo and trio squad modes, each with their own HUD and team setup, and a hero split into solo and squads variants.
* A Battle Royale team is eliminated only when its last player dies, players spawning outside the safe zone take damage, and the death box UI validates items and their fragments.
* The current experience and its default pawn data are exposed to Blueprint.
* PropHunt property bindings on the prop hero repaired.

### Kill feed and death

* The firing equipment is carried through the projectile simulation into the damage context, so the killing weapon's own icon reaches the feed.
* The killing loadout is carried to the feed, with loadout icons rendered from asset paths and cached per loadout.
* Death screens show the kill by what actually caused it, read from the death ability's own event.
* Knockdown markers and feed marker icons carried as textures.

### Testing

* Automation suites added for loadouts, game phase replication over the network, push model replication, and rewind determinism, performance and memory.
* Container and equipment network tests run on the shipped driver.
* Networked test for team private info filtering.

### Fixes

* Weapon swap desync between client and server.
* Attachment slots not being removed correctly in the Battle Royale game mode.
* Lag compensation snapshot source not being added to lag compensation targets.
* Health bar not reading from the health set.
* Item zone spawner ignoring the spline's z location.
* Inventory icon background colour using doubles instead of floats.
* The exposure a captured item is rendered at, and the icon stage lighting for static and dark items.
* Render image mouse down binding after the widget moved into core.
* Client target linking, and cooking for packaged builds.
* A deleted loadout reappearing when the builder saved.
* The deployable HUD count not returning after a respawn.
* Play in editor world context in async rewind callbacks.
* Mover delegates rebinding uniquely so they survive editor reinstancing.
* The rewind component naming an asset outside the editor, which prevented client and packaged builds from compiling.
* Equipment instance validity checks in the equipment attribute modifier.

### Not enabled in this release

* **Iris.** The migration is complete and lives on its own branch. Iris is not currently compatible with replays, which breaks the killcam, so main ships with it disabled and the legacy subobject replication restored. It can be merged once that is resolved.

***

## v1.0 (10 June 2026)

Initial release.
