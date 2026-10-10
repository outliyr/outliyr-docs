# Versions

## Changelog

All notable changes to the Outliyr Framework.

***

### v1.2

Built on Unreal Engine 5.8.

The kill cam is rebuilt on **Visual Replay**, a new plugin that keeps recording what each machine drew and the replicated state of every replicated actor, and plays the recent past back inside the live world. With the demo net driver gone, Iris replication is switched on, and items replicate through the registered subobject list. Everything below is covered by automation tests.

#### Breaking changes and upgrade notes

* **The kill cam no longer duplicates the world or records through a demo net driver.** A project that copied the old kill cam setup can remove `s.World.CreateStaticLevelCollection=1`, `demo.RecordHz` and `demo.RecordHzWhenNotRelevant` from `DefaultEngine.ini`. `ULyraGameEngine` no longer overrides `Experimental_ShouldPreDuplicateMap`; the `GameEngine` entry itself stays.
* **`UKillcamPlayback` and `UKillcamManager::IsInKillCamWorld` were removed**, along with `ALyraPlayerState::GetOverrideViewRotation`. Code that asked whether an actor belongs to the kill cam asks Visual Replay instead, as [Telling Replay Code Apart](../core-modules/visual-replay/replay-friendly-gameplay-code.md#telling-replay-code-apart) describes.
* **A new LyraReplay module** in `Source/LyraReplay` connects Lyra to Visual Replay. It is listed in the project file and in the Game, Client, Server and Editor targets, so a project merging those files by hand needs all five entries.
* **GameplayMessageRouter gained a `BroadcastFilter`**, a static gate every broadcast passes through. LyraReplay binds it so messages from replay stand-ins never reach live listeners. A project that swaps the plugin for Epic's copy needs to carry the change over.
* **Iris is on**, with `net.Iris.UseIrisReplication=1`. Item instances, their fragments, equipment instances and fitted attachments replicate only through the registered subobject list. A custom container or runtime fragment that overrode `ReplicateSubobjects` registers instead, as [Item Replication](../base-lyra-modified/items/item-replication.md#writing-a-container) describes. `UTransientRuntimeFragment::ReplicateSubobjects` and `TearOffReplicatedSubobjects` are replaced by `RegisterNestedSubObjectReplication`, and container prediction traits no longer define `TearOffReplicatedSubObject`.
* **Cameras read a remote pawn's view from its player state.** For a pawn that isn't locally controlled, the Lyra camera modes and the True First Person camera mode take the view rotation from `ALyraPlayerState::GetReplicatedViewRotation`. A camera mode of your own that should look where a spectated player looks does the same.
* **Player controllers need a `ULyraItemContainerClientComponent`** for container windows to follow their items and close when out of reach. `LAS_TetrisInventory_StandardComponents` adds it; another experience that shows shared container windows adds it itself.
* **Async actions end with the life they were started for, through a new AsyncActionLifetime plugin.** Every async action of the framework derives from its `ULifetimeAsyncAction`, including GameplayMessageRouter's `ListenForGameplayMessages` and CommonGame's `CreateWidgetAsync`, `PushContentToLayerForPlayer` and confirmation nodes. Both plugins now list AsyncActionLifetime as a dependency, so a project that swaps either for Epic's copy needs to carry the change over. An async action of your own that waits on the game derives from it too, as [Async Action Lifetime](../core-modules/async-action-lifetime.md#writing-your-own) describes.
* **Running a listening node again replaces its earlier run.** When the same object runs the same team observer, item query or gameplay message listener node again, with the same inputs and the same event bound, the earlier run ends. A Blueprint that relied on two runs of one node delivering the same event twice now receives it once, and a run with other inputs, such as another channel, team or agent, listens alongside.
* **The confirmation nodes and `WaitForExperienceReady` can be cancelled**, and they end without answering once what started them is gone. The experience waiter also ends if its world is cleaned up before the experience loads.
* **Anim Rewind's frame lookups hand back keys rather than copies of frames.** `UAnimRewindComponent::CopyFramePairAtTime` is replaced by `FindFramePairKeysAtTime`, which names the two frames around a time, and `GetPoseForFrameKey`, which reconstructs the pose for one of them or reuses it from the pose cache. `CaptureFrame` takes the pending capture recorded when its sim tick ended, and the hitbox provider's `EvaluateShapeTransformsAtTick` takes a frame key. A trait capturer added to the plugin derives its snapshot from `FAnimRewindTraitSnapshot` and says whether the snapshot can be sent over the network, as [Adding a capturer](../core-modules/anim-rewind/supported-traits-and-extension.md#adding-a-capturer) describes.

#### New: Visual Replay (experimental)

* Records what each machine drew, every Movable mesh, pose, material, visibility, effect, decal and light, and the replicated state of every replicated actor, for a window of recent history. Recording runs only on request, and never on a dedicated server.
* Plays a window back inside the live world for one viewer while the match carries on. Puppets reproduce exactly what was drawn, and shells, real instances of the recorded classes, run their own logic from the recorded state so markers, team colours and attached effects behave. Puppets take the looks their shells set for whoever the replay is watched as, so a kill cam colours teams from the killer's side.
* A skeletal mesh that keeps animating while this machine isn't drawing it works out its pose for the recording now and then, `Replay.UnseenPoseRateHz` times a second, so a character this machine never drew still replays its animation. While a replay plays, which hides the live world, every such mesh is posed every frame instead, so a later kill cam covering that stretch shows them moving smoothly.
* Actors kept for reuse, such as recycled gameplay cue actors, are borrowed rather than owned, through pools a game registers with `VisualReplay::RegisterActorPool`.
* Gameplay cues, context effects and game events are recorded on the replay timeline. A lead-in repeats the events from just before a window that still showed something as it opened, and the later events on the same actor that may have added to it, so lingering effects such as bullet marks are in place from the first frame, and effects first shown partway through their life are caught up.
* A replay is prepared a little each frame within a budget: its window copied out of the recording, its puppets, the shells of what is there as the window opens, the lead-in, and the shells of actors that appear later. Nothing of it shows until it is ready, so the frame it appears in only switches what the viewer sees, and an actor appearing partway through costs only placing its shell.
* Stopping a replay shows the live world again in that frame. What the replay made goes to a removal queue, `UVisualReplayDisposal`, which hides it at once and removes it `Replay.DisposeBudgetMs` milliseconds a frame, 2 by default, and empties as soon as its world starts a seamless travel.
* Perspective clips carry another machine's recording of chosen actors, compactly encoded and decoded without trusting the sender, and can stream into a replay that is already playing.
* Seeking, pausing, speed, buffering that eases playback rather than stopping it, and a replay sound class with the live mix silenced.
* A debug suite of recorded facts with reports, anomalies, viewport drawing and console commands, compiled out of Shipping, plus a frame cost benchmark and statistics for what preparing, starting, playing and stopping each replay cost. Every replay checks as it stops that it put the live game back and left nothing of its own behind.

#### Kill cam

* Rebuilt on Visual Replay. It plays in Play In Editor and standalone, for a listen server's host, and under Iris.
* The victim watches the killer's own recording, streamed from the killer's machine a slice at a time. The server relays only pieces that match its own record of the kill, within fixed limits, and the victim's own recording plays if the killer's doesn't arrive in time.
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
* A client lets go of the item copies left in a world it travels out of, so seamless travel never keeps the previous match's world in memory.
* A predicted move across actors, such as equipping from the inventory on the controller onto the pawn, confirms when the item's new copy arrives.
* Container windows follow their item to another actor.
* A Tetris child container takes its root from whatever container holds it, of any kind, and its contents replicate to whoever can read that root.

#### Async actions

* An async action ends once anything it is tied to is gone: an actor or anything inside one the moment the actor is destroyed or leaves play, a world once it is cleaned up, and any other object, such as a widget, once garbage collection removes it. An actor that seamless travel carries into the next match keeps its actions running there.
* The team observers, item queries, experience waiter and gameplay message listeners no longer stay registered with the game instance after what they were started for is gone, so their count no longer grows with every respawn and every cue a match plays.
* Team observers that listen to a world's team subsystem, and the experience waiter, end with that world. Gameplay messages travel through the game instance, so a listener started by a widget kept across travel goes on listening in the next match.

#### Teams, UI and gameplay

* `ObserveViewerTeam` fires without a team until the local player state is known, then follows the viewer, so team colours resolve on clients whose player state arrives before their player controller.
* An indicator set to go with its component is removed the moment the component's actor ends play.
* Objective markers and nameplates stop their observers when they are unbound, so pooled widgets no longer pile up listeners.
* A control point applies `bStartsActive` on the server only, so clients and late joiners show the replicated state.
* A planted bomb stays where it was planted and keeps its planter named as the last carrier.
* A number pop component makes a new effect when the one it held is gone.
* Generated weapon icons draw from their alpha in the elimination feed, the death footer and the kill cam, and the weapon icon and its glow in the death UI are drawn at the right size.

#### Anim Rewind

* A captured frame no longer records a graph partway through its update. Capture runs on worker threads alongside the animation update, so a frame could hold some traits from before the update and some from after. Each character's animation update now waits for its capture.
* Every movement sim tick records the position it ended at. When a frame ran several sim ticks to catch up, all of them were stored with the last tick's position.
* A reconstructed pose comes out in the mesh's bone order. UAF orders bones by level of detail internally, so on a mesh whose lower LODs drop bones, rewound hitboxes could be placed from the wrong bones.
* Blend Smoother and Blend Smoother Per Bone nodes placed in a graph are captured, and a blend by bool that switched during a smoothed transition reconstructs both of its children.
* Reconstructing on a worker thread is safe against garbage collection and never loads an asset.
* Network sync anchors are applied just before the character's next animation update rather than whenever they arrive, and a full state anchor carries only trait state that survives being sent. Motion matching, pose history, dead blending and blend space keep their own state on each client, as [Network sync](../core-modules/anim-rewind/how-it-works.md#network-sync) describes.
* `RewindSkeletalMesh` falls back to the mesh of the actor's first skeletal mesh component when left empty, and the hitbox provider warns when that mesh's skeleton differs from the hitbox mesh's.
* A character that switches to a different animation graph starts a new epoch, and changing the rewind window or sim step clears the history instead of reading past the end of the buffer.
* Reconstructing a past pose takes about half as long, from 94 to 45 microseconds at the median on the profile test's graph. Shots against the same moment, such as a shotgun's pellets, reuse the cached pose without copying the captured frames.

#### Testing

* Visual Replay's automation suite, grouped by area.
* Each game mode's kill cam tests live in that mode's own test module, so removing a mode never breaks another plugin's tests.
* Network tests for item moves and pickups, access filtering, predicted equips across actors, window rebinding and the viewer's team.
* AsyncActionLifetime's own tests, and tests that each of the framework's async actions ends with what it is tied to and replaces its earlier run.
* Anim Rewind tests for the bone order remap, Blend Smoother capture, a blend by bool switched during a transition, live graph registration and switching, network anchor serialization and filtering, and resizing the history buffer. The determinism tests compare each reconstruction against the live update.

***

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
