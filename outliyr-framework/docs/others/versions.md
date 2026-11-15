# Versions

## Changelog

All notable changes to the Outliyr Framework.

***

#### v1.2 (14 November 2026)

Built on Unreal Engine 5.8. 524 commits since v1.1.2.

The kill cam is rebuilt on Visual Replay, a new plugin that records what each machine drew and the replicated state of every replicated actor, then plays the recent past back inside the live world rather than duplicating it. With the demo net driver gone, Iris replication is switched on, and items replicate through the registered subobject list. Navigation arrives as a game feature covering the minimap, the compass and a ping system, and hitscan shots are now rebuilt and validated on the server. Everything below is covered by automation tests.

#### Breaking changes and upgrade notes

* **The quick bar's `bAutoSelectFirstItem` is now `bAutoDrawWhenEmptyHanded`**, and no longer arms a pawn as it spawns. A `PropertyRedirects` entry carries the value across. It governs only an item arriving in the bar and the active slot being emptied, and the bar follows a weapon the pawn is already holding whatever it is set to. A mode that relied on the bar arming the player at spawn marks that weapon as held where the loadout is applied.
* **An action ability of your own waits for an equip only once it is listed.** The pawn carries `State.Equipment.Changing` while equipment is brought up, and `TagRelationships_ShooterHero` lists the actions the framework ships. A project with its own relationship mapping, pawn data or action abilities adds the tag to the `ActivationBlockedTags` of each action that should wait. An action left off the list can interrupt an equip animation.
* **Reloading now stops firing.** `Ability.Weapon.NoFiring` moved from `SourceBlockedTags`, which the input and gameplay event paths never consult, to `ActivationBlockedTags`. A weapon that should keep firing while it reloads needs the tag off its reload ability, and anything else written to gate an ability belongs in `ActivationBlockedTags` for the same reason.
* **`ULyraEquipmentManagerComponent::GetFirstHeldInstanceOfType` is now `GetAnyHeldInstanceOfType`.** A `CoreRedirects` entry keeps existing Blueprints resolving, and the templated helper is renamed with it. Code that needs a particular hand asks `GetInstanceFromHeldSlot`, per shot work reads `GetAssociatedEquipment`, and a new `GetHeldInstancesOfType` returns every held instance of a type.
* **The unused squad id is gone from the player state.** `GetSquadId`, `SetSquadID`, the replicated `MySquadID` and its OnRep are removed, and squad membership is read through the team subsystem. A Blueprint that placed `Get Squad Id` reports an error on load and should be repointed at `Get Team Id`.
* **Hitscan and projectile shots carry their shot geometry, and the server refuses shots without it.** `FLyraGameplayAbilityTargetData_SingleTargetHit` gained a `ShotGeometry` and a `BulletIndex`, which changes its wire format. An ability that builds its own target data fills both, which the built in targeting does through the `PerformLocalTargeting` overload taking a shot index. A subclass overriding `TraceBulletsInCartridge` reads the spread from `InputData.SpreadHalfAngleDegrees` and draws directions from `ComputeSeededSpreadDirection` when `InputData.ShotIndex` is set, or the server will rebuild lines the client never traced.
* **The kill cam no longer duplicates the world or records through a demo net driver.** A project that copied the old setup can remove `s.World.CreateStaticLevelCollection=1`, `demo.RecordHz` and `demo.RecordHzWhenNotRelevant` from `DefaultEngine.ini`. `ULyraGameEngine` no longer overrides `Experimental_ShouldPreDuplicateMap`, and the `GameEngine` entry itself stays.
* **`UKillcamPlayback` and `UKillcamManager::IsInKillCamWorld` were removed**, along with `ALyraPlayerState::GetOverrideViewRotation`. Code that asked whether an actor belongs to the kill cam asks Visual Replay instead.
* **A new LyraReplay module** in `Source/LyraReplay` connects Lyra to Visual Replay. It is listed in the project file and in the Game, Client, Server and Editor targets, so a project merging those files by hand needs all five entries.
* **GameplayMessageRouter gained a `BroadcastFilter`**, a static gate every broadcast passes through. LyraReplay binds it so messages from replay stand-ins never reach live listeners. A project that swaps the plugin for Epic's copy needs to carry the change over.
* **Iris is on**, with `net.Iris.UseIrisReplication=1`. Item instances, their fragments, equipment instances and fitted attachments replicate only through the registered subobject list. A custom container or runtime fragment that overrode `ReplicateSubobjects` registers instead. `UTransientRuntimeFragment::ReplicateSubobjects` and `TearOffReplicatedSubobjects` are replaced by `RegisterNestedSubObjectReplication`, and container prediction traits no longer define `TearOffReplicatedSubObject`.
* **Cameras read a remote pawn's view from its player state.** For a pawn that is not locally controlled, the Lyra camera modes and the True First Person camera mode take the view rotation from `ALyraPlayerState::GetReplicatedViewRotation`. A camera mode of your own that should look where a spectated player looks does the same.
* **Player controllers need a `ULyraItemContainerClientComponent`** for container windows to follow their items and close when out of reach. `LAS_TetrisInventory_StandardComponents` adds it, and another experience that shows shared container windows adds it itself.
* **Async actions end with the life they were started for, through a new AsyncActionLifetime plugin.** Every async action of the framework derives from its `ULifetimeAsyncAction`, including GameplayMessageRouter's `ListenForGameplayMessages` and CommonGame's `CreateWidgetAsync`, `PushContentToLayerForPlayer` and confirmation nodes. Both plugins list AsyncActionLifetime as a dependency, so a project that swaps either for Epic's copy needs to carry the change over. An async action of your own derives from it too, calls `EndWith` from its factory with what started it and what it watches, and calls `ReplaceEarlierRun` from `Activate` if it keeps listening.
* **Running a listening node again replaces its earlier run.** When the same object runs the same team observer, item query or gameplay message listener with the same inputs and the same event bound, the earlier run ends. A Blueprint that relied on that duplicate delivery now receives each event once. A run with other inputs, such as another channel, team or agent, listens alongside.
* **The confirmation nodes and `WaitForExperienceReady` can be cancelled**, and they end without answering once what started them is gone. The experience waiter also ends if its world is cleaned up before the experience loads.
* **Anim Rewind's frame lookups hand back keys rather than copies of frames.** `UAnimRewindComponent::CopyFramePairAtTime` is replaced by `FindFramePairKeysAtTime`, which names the two frames around a time, and `GetPoseForFrameKey`, which reconstructs or reuses the pose for one of them. `CaptureFrame` takes the pending capture recorded when its sim tick ended, and the hitbox provider's `EvaluateShapeTransformsAtTick` takes a frame key. A trait capturer derives its snapshot from `FAnimRewindTraitSnapshot`, adds it with `AddSnapshot`, restores through the `FRestoreContext` it is handed, and says in its registry entry whether its snapshot can be sent over the network.
* **A settings registry of your own runs the contributors or loses them.** `ULyraGameSettingRegistry::OnInitialize` builds its five pages, runs every registered contributor over them, then registers them, in that order, because registering a page subscribes to the settings it finds in one walk. A project with its own registry class, or its own `OnInitialize`, does the same or the settings other modules contribute will not appear.
* **The Navigation game feature plugin is new, and every team mode lists it.** The shooter base experience and the Team Deathmatch, Domination, Hardpoint, Headquarters, Kill Confirmed, Search and Destroy, Capture the Flag, Payload, Infection, Gun Game and Free For All plugins each declare Navigation as a plugin dependency, so a project merging those descriptors by hand needs the entry in each. The `HUD.Slot.Minimap` and `HUD.Slot.Compass` tags are new, and the mode plugins that mark their objectives depend on the Navigation runtime module.
* **The PSO warmup plugin sets its console variables in `DefaultEngine.ini`.** The variables it used to push were renamed, deprecated or removed in 5.8, and most of the replacements are read only. A project that copied the old setup carries the change over.

#### New: Visual Replay (beta)

* Records what each machine drew, every Movable mesh, pose, material, visibility, effect, decal and light, alongside the replicated state of every replicated actor, for a window of recent history. Recording runs only on request, and never on a dedicated server.
* Plays a window back inside the live world for one viewer while the match carries on. Puppets reproduce what was drawn, and shells, real instances of the recorded classes, run their own logic from the recorded state, so markers, team colours and attached effects behave.
* Gameplay cues, context effects and game events play on the replay timeline, with a lead-in that puts lingering effects such as bullet marks in place from the first frame.
* A replay is prepared a little each frame within a budget, and nothing of it shows until it is ready.
* Stopping a replay shows the live world again in that frame, and what the replay made is removed over the frames that follow, `Replay.DisposeBudgetMs` milliseconds each.
* A skeletal mesh animating while this machine is not drawing it is posed for the recording `Replay.UnseenPoseRateHz` times a second, so a character this machine never drew still replays its animation.
* Actors kept for reuse, such as recycled gameplay cue actors, are borrowed through pools a game registers with `VisualReplay::RegisterActorPool`.
* Perspective clips carry another machine's recording of chosen actors, compactly encoded, decoded without trusting the sender, and able to stream into a replay already playing.
* Seeking, pausing, speed, buffering that eases playback rather than stopping it, and a replay sound class with the live mix silenced.
* A debug suite of recorded facts with reports, anomalies, viewport drawing and console commands, compiled out of Shipping, plus a frame cost benchmark and per replay statistics.

#### Kill cam

* Rebuilt on Visual Replay. It plays in Play In Editor and standalone, for a listen server's host, and under Iris.
* The victim watches the killer's own recording, streamed a slice at a time at up to `Killcam.PerspectiveClipBytesPerSecond`. The server relays only pieces matching its own record of the kill, and the victim's own recording plays if the killer's does not arrive in time.
* The kill cam starts as soon as its window opens, behind static while it is prepared within `Killcam.PrepareBudgetMs`.
* The killer's aim, camera and hit markers play with the replay, and their exact recorded camera can be shown instead of the copied camera mode.
* Team colours, markers and the HUD show the match from the killer's side, without recolouring the live characters the kill cam hides.
* Indicators of live actors the kill cam hides are hidden with them, including players who respawned after its window opened.
* No kill cam plays without a killing player, and a bot's kill plays the victim's own recording with the bot's tracks.
* Objectives show their recorded state: control points, the planted bomb, flags, the payload and their markers.

#### New: Navigation

* A minimap, a compass and a map opened over the game, as a game feature an experience asks for rather than widgets a level carries. `LAS_Compass`, `LAS_Minimap` and `LAS_Ping` fill the `HUD.Slot.Minimap` and `HUD.Slot.Compass` slots.
* The shooter base experience asks for the compass, each team mode adds the minimap, battle royale and extraction ask for the minimap too, and battle royale's squad modes ask for the pings.
* A player carrying `Status.Navigation.Hidden` is shown no minimap. Nothing in the plugin grants the tag, so which moments those are is the mode's to say.
* What a level looks like from above is authored as a `UMapLevelData` asset rather than captured as the game runs, which would cost a render every frame and photograph roofs rather than the rooms beneath them.
* The picture is baked in the editor, one per storey, each photographed from the height it gives way at so a roof is left out of the floor beneath it. `Fit Bounds To Level` and `Fit Bounds To Selection` set the area covered.
* A floor is shaded flat, lit as the level is lit, or by how high each surface stands, with a line wherever one surface steps away from another. Actors carrying a named tag are left out.
* A level with floors above one another gets a layer for each. The floor shown follows the viewer's height, and a marker on another floor is drawn faded with a chevron saying which way it lies.
* Which map each level is played with is settled by a `Register Map Data` game feature action, which is also what keeps the asset in a packaged build.
* An actor appears on all three views by carrying a `UMapMarkerComponent`, holding the picture, colour, name, kind, audience, and which marker is drawn on top where two land together.
* A marker is shown to everyone, to its own team or to rival teams alone, and is tinted with its team's colour over its own.
* A reveal is granted rather than written: a marker names the tags its owner must carry to be shown and the tags that hide it again. `SetShowing` and `ShowFor` reach the same state on one machine alone.
* A marker carries how far along whatever it marks is, and in what colour, so a point being captured reads on the map without the map knowing what a control point is.
* A marker whose subject leaves the view keeps a place at the edge of it, as an arrow or a bar, and one with no picture of its own is drawn as a plain dot.
* The minimap follows the viewer, with either the map or the viewer turning. The compass places markers by the bearing they lie on and needs no map of the level. The map over the screen pans and zooms under the pointer and follows the viewer until the player moves it.
* Working out what a view shows is separate from drawing it, so how a map looks belongs to the widget built on the view classes. A view can leave out whole kinds of marker, which is what keeps the bomb off the defending side's map.
* A thing whose shape matters rather than its place carries a `UMapOverlayComponent`, which puts rings and lines on the same three views. Nothing is kept between frames, so a shape that moves, grows or leaves the map needs only to answer differently.
* A ring is named apart from a line because a circle given as a list of places cannot be laid out to suit the size it is drawn at. Everything with straight sides is a closed line.
* Shapes are painted rather than placed as widgets, so a shape keeps the thickness it was given and costs only the part of itself that shows.
* How a shape looks belongs to the shape rather than the view: whether it is drawn along the shape or as a sheet across the view, its material, colour, thickness, curve resolution, dashing, and how much is left of it on another floor. A view may name looks of its own, and names none as shipped.
* A material drawing a shape is handed where it is on that shape in its own coordinates, so any number of shapes share one material. `M_UI_MapStroke` ships as the default line.
* Markers and shapes are built on one `UMapAnnotationComponent`, so a shape is filtered, revealed, tinted and ordered by the same fields as a marker. `FMapViewProjection` carries how a view stands at one moment, for anything drawing over a map of its own.
* Three things that would otherwise draw nothing in silence each say so in the log once: a view with no canvas, a shape asking for a look nothing provides, and a material that cannot be drawn.
* Every mode's objectives are marked: control points with their owner's colour and capture progress, bomb sites and the planted bomb, both flags and their bases, the payload, and dropped tags.
* Battle royale draws its safe zone and the route its plane is flying, each with a material of its own. The zone is told where it stands by the shrink it is running, so nothing is replicated for it.
* The Dock Yards map ships baked, and battle royale's two islands and the extraction site each ship a baked map of their own.

#### New: Pings

* A player points out whatever they are looking at, for their own side. The place is found on their own machine, and the server holds it to how far a ping may reach and to what its own trace finds, within `AcceptedError` centimetres, then decides for itself what kind of ping it is.
* A kind of ping is a `UPingDefinition` asset saying what it fits, what it is drawn with, how long it lasts, who sees it, how many may stand at once and how long a player waits between two. The ability places the first kind that fits, so a kind that fits anything belongs last.
* What a ping fits is said as the relation of the thing to the player, the tags it must and must not carry, and the classes it may be. A ping can take its picture and name from the thing it marked through the `PingDescribable` interface.
* A press pings what the player is looking at, and holding opens a wheel of the calls they can make. A call keeps its direction for as long as the wheel offers it, so a player who knows the wheel reaches a call without reading it.
* A ping placed on somebody else's ping is an answer rather than a second mark. An answer is a position rather than a message, so a player holds one at a time, saying the same thing twice takes it back, and several players saying it show as one answer with a count. Confirm, decline and hold on ship.
* A ping stands in the world as an actor, which is all it takes to reach the minimap, the compass, the map screen and the world itself. Over the world it is drawn by a widget of its kind's choosing and told each moment of its life, so the look of it stays in Blueprint.
* A ping reaches only the side that may see it. Under Iris the actor itself is replicated to those connections alone, so a rival client never learns it exists.
* A kind can settle into another kind's look after a while, keeping the name it was called by. A ping can follow what it marked, be taken back by pinging it again, and be refreshed rather than duplicated within `SamePlaceDistance` centimetres.
* What a player may place is held to each kind's own count and cooldown, and to `MaxPingsPerWindow` in `RateWindow` seconds across every kind at once, so the gaps cannot be worked around by alternating. A further ping on a full channel pushes out the oldest.
* A feed under the minimap says what has just been pinged, since a marker says where something is but not what it is. Pings placed in a run become one line carrying a count.
* The feed also says when a teammate answers one of their pings, one line per teammate per ping, reworded if they change their answer and retired if they take it back. Each answer says through `bShownInFeed` and `FeedLine` whether it reaches the feed and how it is worded.
* A player with the map screen open marks a place by right-clicking it. The server accepts any place on the map's picture and a floor the map has, then finds the ground by tracing down, so the client never says how high anything is. It is placed as `DA_Ping_Map` on a channel of its own. It needs a pointer, so a player on a gamepad cannot ping from the map yet.
* Nine kinds ship, covering a place, an opponent, an item named after itself, a sign somebody has been somewhere, and five calls sharing one channel, with their pictures, wording, materials and text styles.

#### New: Icon Studio

* An editor tool that stages what an item icon should show, frames it, and saves the result as a texture asset, with a staging viewport on one side and the panel the scene is described in on the other.
* A scene is a list of parts, each an actor class, a static mesh or a skeletal mesh, placed with its own transform and able to be hidden without losing it.
* An actor is built but never begins play, so one that only reveals its meshes once a match has started stages as nothing.
* Parts are placed by dragging the viewport's transform handles as well as by typing values, and framing pulls the camera back until everything staged is in view.
* What sits behind the parts is the preview environment, a flat colour, or nothing at all. The environment is there to judge a material against, so a saved texture carries only what was staged.
* Exposure is held still in both the viewport and the capture, so the picture taken is the picture that was framed.
* Coverage is taken from depth rather than from what the scene rendered, and translucent parts are left out of the shape that is kept.
* The texture's size, oversampling and destination are set in the panel. The staging scene lives only as long as the tab, so closing the tool leaves no asset behind.

#### New: Fragments in Blueprint

* Item fragments can be written in Blueprint. The hooks open to one are what it contributes to an item's weight and count, whether an item may enter or leave a container, what happens when an instance is created, and which runtime fragment it keeps its per item state in.
* Runtime fragments can be written in Blueprint as well, so a fragment and the state it carries are both authored without C++. One holds per item state, reacts to being added, removed and moved, and hands that state over when a prediction is reconciled.
* A fragment's struct payload stays native, since a struct declared in Blueprint cannot derive from the native struct that receives the lifecycle calls. Replicating owned subobjects stays native for the same reason.
* A Blueprint fragment holding state every item would share is warned about, since a fragment is shared by every item built from its definition. The hooks carry tooltips saying what each one is asked.

#### Networking and items

* Iris replication is switched on.
* Items register on the container holding them, and containers that start with no access filter their items through net condition groups.
* Destroying an item destroys its copies on clients, and moving it to another actor destroys the old copies while clients that can read the new container receive it as a new one.
* A client releases the item copies left in a world it travels out of, which had kept that world in memory.
* A predicted move across actors, such as equipping from the inventory onto the pawn, confirms when the item's new copy arrives.
* Container windows follow their item to another actor.
* A Tetris child container takes its root from whatever holds it, of any kind, and its contents replicate to whoever can read that root.
* `Build Pickup To Inventory Transaction` picks a slot for each item that already exists, and leaves an item the container has no room for in the pickup rather than failing the transaction.

#### Async actions

* An async action ends once anything it is tied to is gone: an actor when it is destroyed or leaves play, a world once it is cleaned up, and any other object once garbage collection removes it. An actor seamless travel carries into the next match keeps its actions running.
* The team observers, item queries, experience waiter and gameplay message listeners used to run until cancelled, so every pawn, weapon and cue that started one left it registered with the game instance for the rest of the session.
* Team observers and the experience waiter end with their world. Gameplay messages travel through the game instance, so a listener started by a widget kept across travel goes on listening.
* `ObserveTeam`, `ObserveTeamColors`, `ObserveTeamAliveCount`, `ObserveTeamAliveCountById`, `QueryInventoryAsync` and `WaitForExperienceReady` are exported from the LyraGame module.

#### Teams, UI and gameplay

* A quick bar can put the active weapon away. With `bReselectActiveSlotToHolster` on, pressing the selected slot holsters its item and pressing again draws it back, and the slot stays selected while its item is away. `SetActiveSlotHolstered` and `IsActiveSlotHolstered` reach the same state from code, and the active index message carries a `bHolstered` flag.
* `ObserveViewerTeam` fires without a team until the local player state is known, so team colours resolve on clients whose player state arrives before their controller.
* An indicator set to go with its component is removed the moment the component's actor ends play.
* Objective markers and nameplates stop their observers when unbound, so pooled widgets no longer pile up listeners.
* A control point applies `bStartsActive` on the server only, so clients and late joiners show the replicated state.
* A planted bomb stays where it was planted and keeps its planter named as the last carrier.
* A number pop component makes a new effect when the one it held is gone.
* Generated weapon icons draw from their alpha in the elimination feed, the death footer and the kill cam, and the death UI draws the icon and its glow at the right size.
* The gunsmith can be opened from the main menu rather than only through the experience list, through the new `HUD.Slot.MainMenu` extension point.
* A project opts the gunsmith into its front end by adding `LAS_Gunsmith_FrontEnd` to that experience, which carries the plugins, the rule set and the icon generator.

#### Settings

* Any module can put settings in the settings menu and amend the ones already there, without editing the registry. A function registered with `FGameSettingExtensions` runs while the tree is built, and resolves pages and sections by developer name, places settings, adds pages of its own, and retargets, renames, clamps, conditions or hides what is there. Registration is held outside any engine object, so it works from a module on any loading phase.
* Contributors run in the order of their names rather than the order they registered in, so a page holds its rows in the same order every run. A setting naming a page the menu does not have, or reusing a developer name, is dropped and reported.
* A contributed value can be kept without a property of its own. `ULyraSettingsShared` and `ULyraSettingsLocal` hold values under a name as strings, read and written through `FLyraExtensionSettingDataSource`, so one key serves a toggle, a number, a slider or a list.

#### Anim Rewind

**Anim Rewind is beta rather than experimental.** The fixes below close the gaps that stopped a reconstructed pose being trusted in a match. It still asks that a character runs on a UAF graph with Mover, and lag compensation decides per hitbox source whether poses ride the trail it records or are reconstructed on demand.

* A captured frame no longer records a graph partway through its update. Each character's animation update waits for its capture.
* Every movement sim tick records the position it ended at, where a frame that ran several to catch up had stored all of them with the last tick's position.
* A reconstructed pose comes out in the mesh's bone order, so on a mesh whose lower levels of detail drop bones, rewound hitboxes are no longer placed from the wrong bones.
* Blend Smoother and Blend Smoother Per Bone nodes placed in a graph are captured, where their blend weights had never been recorded.
* A blend by bool that switched during a smoothed transition reconstructs both children, where the one blending out was lost.
* Reconstructing on a worker thread is safe against garbage collection, and two characters reconstructing on different threads no longer race on a shared counter.
* Network sync anchors are applied through the animation system's task queue, just before the character's next animation update.
* A full state anchor carries only trait state that survives being sent. Motion matching, pose history, dead blending and blend space keep part of their state outside the property system, so clients now keep their own.
* `RewindSkeletalMesh` falls back to the first skeletal mesh component's mesh when left empty, and warns when its skeleton differs from the hitbox mesh's.
* A character that switches animation graph starts a new epoch and rebuilds its evaluator, so history from the old graph is never reconstructed against the new one.
* Changing the rewind window or sim step while frames are recorded clears the history instead of reading past the end of the buffer.
* The warning for a graph with no registered instance names the Anim Rewind Network Sync Scope node.
* Reconstructing a past pose takes about half as long, from 94 to 45 microseconds at the median on the profile test's graph. Shots against the same moment reuse the cached pose.
* The replicated network sync anchors are push based, so a net tick that published neither costs no comparison.

#### Performance

Measured on an RTX 4090 and a Ryzen 9 7900X.

* A kill cam is prepared a little each frame inside `Killcam.PrepareBudgetMs`, 4 by default. In a soak with 32 players the frame a kill cam starts on costs about 17 milliseconds, 24 on the worst of them, and the frame it stops on about 8. Preparing the whole of one on a single frame costs hundreds.
* Recording costs about 0.7 milliseconds a frame while a match runs.
* Generating an icon no longer stalls the game thread, where each capture waited on every texture streaming request in the game and cost 8 to 10 milliseconds, up to 40 on a busy frame. In a Team Deathmatch with nine bots this removed a 10 millisecond hitch from every kill.
* The ShooterBase guns cache their generated icons, which had been switched off on all six, so each loadout renders once per size.
* A client no longer refreshes the bones of every character it is not drawing.
* Environment queries run for at most 2 milliseconds a frame, down from the engine's 10, so a burst of bot cover searches that took up to 8 milliseconds of one frame spreads over a few. `MaxAllowedTestingTime` in `DefaultGame.ini` sets it.
* The loading screen waits for precached pipeline states to finish compiling, where it used to drop while the graphics driver was still at work.
* Boot is about five seconds shorter, because the spawn preheat pass is gone and `r.PSOPrecache.Components` already collects that work as assets load.

#### Fixed

* A shot's muzzle flash, tracer and impact effects are drawn on the weapon that fired rather than on whichever weapon the pawn listed first, which during a swap could be one still on the character's back.
* Simulated projectiles, which bullet drop weapons fire, carry the equipment that fired them, so their impacts draw effects and their damage reads falloff and material. Bullet drop damage at range therefore changes, to the numbers the weapon's curves always described.
* A weapon swap settles even when the equip animation is cut short, which firing across a swap used to do, leaving a weapon that reads as held while it is still on the character's back.
* The first weapon swap after a pawn spawns is animated on the client that asked for it rather than taken over at once, which had shown as the incoming weapon appearing, vanishing and appearing again.
* A shot leaves the weapon that fired it, and every held weapon is ticked, so spread and heat no longer build on a weapon that is not shooting.
* Putting a weapon away cancels an ability still running on it, so a held fire button stops and Blueprint cancellation logic runs.
* A shot validated after its weapon has gone, and an activation that finds no weapon, end instead of asserting, which could bring down a packaged build.
* The aim assist debug overlay follows `lyra.Weapon.DrawAimAssistDebug` rather than drawing on every other frame.
* Aim assist finds targets again. Its collision channel was read from a config section naming a module that is not here, so it swept a channel the aimable targets ignore and never found one. A project that had tuned around aim assist doing nothing will feel it on gamepad.
* A quick bar follows a weapon the pawn is already holding whatever its auto select setting says, so the weapon name, ammo and spectator bar are no longer blank until the player cycles slots.
* A quick bar slot no longer draws as the weapon in hand before anything has told it which slot is active.
* A client releases a pocket world after leaving the level it was opened in, where every inspection and icon pocket level had stayed loaded until the player disconnected.
* The icon generator releases a world it is carried out of, which had kept that whole map in memory, and streams in a new pocket level for the next request.
* Requesting an icon on a client that never renders, such as one launched with `-nullrhi`, no longer crashes the render thread.
* Replacing or removing the icon generator component while an icon is being captured no longer crashes.
* An icon whose stage is destroyed while the capture waits on it is answered with null.
* Shooter bots no longer log StateTree context errors at match start or after seamless travel, since a bot's tree runs only while it possesses a pawn the tree can run against. `StateTreeAI` on `AShooterBotAIController` is now a `UShooterBotStateTreeComponent`, so Blueprints that use it keep working.
* A blocked player start no longer has a whole pawn built and destroyed on every frame. The game mode checks the start first, retries after `BlockedStartRetryDelay`, half a second by default, and warns once per wait.
* A client travelling to the next match leaves the previous match's game state and experience behind, which had fired ensures in the add abilities and input actions, could show eliminations twice, and switched off the new match's game feature actions when it was finally destroyed.
* A Lyra anim instance stops receiving gameplay tag callbacks when it is torn down, which had swapped anim layers on destroyed pawns and logged a corrupted owner warning hundreds of times per match.
* Releasing a pawn from its ability system no longer reports the pawn as alive, so a body left in the world to be looted is not an aim assist target that counts as alive.
* An extraction body stays in the world after its player returns to the lobby, keeps the look it died with, and plays its death animation rather than going straight to ragdoll.
* An extraction body's loot prompt and loot window no longer depend on the player who left.
* An item that renders its own icon shows it in an equipment or attachment slot, including on a looted body, where every slot driven by the base view model fell back to a static icon a weapon does not have.
* An icon that finishes rendering after its slot has already drawn reaches the slot, where an equipment slot was blank until the item was moved out and back.
* Custom pickup routing works. `DetermineItemDestination` is asked whenever the policy is Custom, where nothing ever called it and the pickup failed outright, and a hook naming no container leaves the pickup routed as auto-equip-or-store.
* A selected item under custom routing goes where the hook says rather than to the inventory.
* Picking up an item when the avatar has no controller no longer risks a crash.
* A gameplay cue that shows a widget draws it on clients again, where it had asked the instigator's player state for a controller that is not replicated. The round start countdown picks up where it is rather than announcing one second more than is left.
* The battle royale safe zone wall reads as a curved wall rather than a run of flat panels, as its own mesh of a thousand sides rather than the engine's basic cylinder scaled out to the width of the zone.
* The battle royale safe zone closes to a circle lying inside the one it is closing from, where the next centre landed exactly on the current ring every time and over half of each new zone stood on ground players had just been driven off.
* A default attachment is created by the item subsystem like any other item, so it carries a count rather than reading as an empty stack, and can be resolved by its GUID.
* A resource component waits for the attribute set it reads to arrive rather than giving up for good, which is why a battle royale player could land with no shield while health was fine.
* An ability set grants its attribute sets before its abilities and effects, so an effect capturing a target attribute from a set in the same ability set captures it.
* Equipment drops a receipt for a stat it no longer carries instead of reporting the stat as missing, which read as a fault in the attachment and which the gunsmith reached on every close.
* A weapon icon asked for while a kill cam is showing no longer comes out blank, which had been cached and left the weapon blank for the rest of the session. A pocket level can now opt into the world's static collection, which nothing hides or duplicates.

#### Changed

* Weapon actions wait while a weapon is being brought up. The pawn carries `State.Equipment.Changing` until the montage animating it ends, and the hero's tag relationships hold off firing, melee, grenade, reload, placing an object and inspecting while it is there, any of which could previously start the instant a slot was pressed and fire from the character's back. Jump, dash, drop, emote and aiming are deliberately left alone. An equip animation can declare the weapon ready early with the Equipment Ready notify.
* The server rebuilds every hitscan bullet line itself instead of tracing the endpoints a client reports. Spread is drawn from a stream seeded by a per controller shot index, which must advance with every shot, so a client cannot replay a shot or pick freely between spread patterns. Where a shot may start and be aimed depends on a game's cameras, vehicles and movement, so the framework does not limit them, and a game that wants to overrides `IsShotGeometryPlausible`.
* Projectile weapons draw their spread from the same seeded stream, and the server rebuilds each projectile's direction before it spawns. One target data entry spawns one projectile, so the server keeps at most as many as the weapon fires.
* Penetrating hitscan validates each bullet as a connected path, within the surface's penetration or ricochet settings, its depth, exit spread, penetration count and the weapon's range, and every segment after a refused one is refused as well.
* One bullet can no longer be reported as several hits. Each further hit must name a different actor the server's own trace passed through, and bullet indices beyond the weapon's bullets per cartridge are refused.
* Every shot or pellet the server refuses is logged to `LogShotValidation` with the shooter, the shot and pellet, and the reason. The category is silent unless raised to Verbose.
* The team subsystem can limit an actor to one team's connections, with `SetActorTeamOnly` and `ClearActorTeamOnly`, for an actor whose whole existence a rival player should not learn. An actor holding a mixture, as a player's own pawn does, cannot be limited this way, and where Iris is not in use nothing is limited.
* The pickup routing surface is protected rather than private, and `BuildTransactionForRouting` is virtual, so a subclass can replace the routing decision and compose the existing builders instead of reimplementing the pickup flow.
* `BuildEquipmentTransaction` takes a preferred equipment slot, which is how custom routing steers which slot held gear is equipped into.
* The base `DetermineItemDestination` names no destination and clears its out parameters, so an override that calls it first starts from nothing.
* An icon can be asked for at its item's own aspect ratio, so a wide weapon asked for at a square size fills its texture rather than floating in the middle of one.
* The icon generator and the view models that ask it for icons say when an icon cannot be produced, on `LogItemContainerUI` at Verbose, where every refusal used to answer with no texture and no explanation.
* A player or bot that stops retrying after a failed spawn logs a warning rather than at Verbose, since it is left without a pawn and nothing restarts it. Bots used to give up without logging anything.
* `ULyraControllerComponent_CharacterParts::OnPossessedPawnChanged` is protected and virtual, so a subclass can decide what a pawn keeps when the controller stops possessing it.
* `ULyraExperienceDefinition`, `ULyraAnimInstance`, `ULyraPawnComponent_CharacterParts`, `ULyraDamageExecution` and `ULyraHealExecution` are exported from the LyraGame module, so another module can subclass them in C++.
* The Squad Play plugin description no longer claims the feature is shared with extraction. Only the battle royale duo and trio experiences wire it in.

#### Testing

* Visual Replay's automation suite, grouped by area, with each mode's kill cam tests in that mode's own test module so removing a mode never breaks another plugin's tests.
* Network tests for item moves and pickups, access filtering, predicted equips across actors, window rebinding and the viewer's team.
* AsyncActionLifetime's own tests, and tests that each async action ends with what it is tied to and replaces its earlier run.
* Anim Rewind tests for the bone order remap, Blend Smoother capture, a blend by bool switched during a transition, live graph registration and switching, network anchor serialization, and resizing the history buffer. The determinism tests now compare each reconstruction against the live update rather than against another reconstruction.
* Pickup routing tests for the custom routing hook.
* Ping tests for the rate limit across kinds, a channel pushing out its oldest, taking a ping back only as the player who placed it, which pings a reported look could have reached, and that an answer is reported with the player who gave it.
* Map ping tests for what the server accepts from the map: a place off the edge, a floor the map does not have and a level with no map are turned down, and the ground is found beneath the place on the floor that was shown.

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

{% hint style="warning" %}
This affected gameplay, not only the gunsmith's stat panel. Recoil modifiers were being discarded in a match as well. The gunsmith was simply the first feature to display the value and make it visible.
{% endhint %}

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
