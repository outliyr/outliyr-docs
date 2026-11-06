# Navigation

Welcome to the documentation for the **Navigation Plugin**, the layer that tells a player where things are. It covers a minimap, a compass, a map opened over the game, the markers all three draw from, and a ping system a player uses to point things out to their own side.

The plugin is one game feature an experience asks for, one view at a time. A mode that wants a minimap adds an action set; a mode that wants none adds nothing and is unaffected. Nothing in the plugin is a game mode, and nothing in it knows what kind of game is being played: an actor appears on the map by carrying a component, and which kinds of ping a game has is a list of data assets handed to an ability.

***

### What You Get

| Navigation Plugin | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| Map Asset         | What a level looks like from above, authored and baked in editor  |
| Floors            | One picture per storey, so upstairs does not show downstairs      |
| Markers           | A component that puts anything on all three views                 |
| Granted Reveals   | A marker shown for as long as an effect grants a tag              |
| Minimap           | A view that follows the player                                    |
| Compass           | A bearing strip that needs no map of the level                    |
| Map Screen        | A full screen map the player pans, zooms and changes floor on     |
| Pings             | Contextual calls a player places for their side, with a wheel     |
| Ping Answers      | Confirm, decline or hold on, counted rather than repeated         |
| Ping Feed         | A short readout of what has just been called                      |

***

### How It Builds on Base Lyra

Navigation introduces no new team, ability, input or UI concepts. It arranges existing ones so that a position becomes something a player can read.

| Base System                                                                         | How Navigation Uses It                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md) | A mode opts in through an action set that adds the views to the HUD and grants the ping ability; the plugin itself is `ExplicitlyLoaded`                |
| [Team](../../base-lyra-modified/team/)                                              | A marker's colour and audience are read from the team owning whatever carries it, and a ping is replicated to its own side's connections alone          |
| [GAS Abilities](../../base-lyra-modified/gas/)                                      | Pinging and opening the map screen are ordinary abilities granted by an ability set, so a mode decides which of them a player has                       |
| [Input](../../base-lyra-modified/input/)                                             | The ping key and the map key are input actions in the feature's own mapping, added and removed with the feature                                         |
| [UI](../../base-lyra-modified/ui/)                                                   | The views are tagged widgets filling HUD slots, so they hide themselves in answer to the tags the player carries                                       |

{% hint style="info" %}
You should be comfortable with [Experiences](../../base-lyra-modified/gameframework-and-experience/experiences.md), the [Team](../../base-lyra-modified/team/) model and [GAS Abilities](../../base-lyra-modified/gas/) before diving in. This documentation covers what the plugin adds and links to the base docs for shared concepts.
{% endhint %}

***

### Key Concepts

* **The map is authored, not captured.** What a level looks like from above is a data asset holding a picture per floor, baked in the editor from the level that is open. A capture taken as the game runs costs a render of the world every frame and photographs roofs rather than the rooms beneath them, so every shooter authors it instead.
* **Anything is marked by carrying a component.** A `UMapMarkerComponent` holds the picture, colour, name, kind, audience and ordering of one marker, so the views never learn what kind of actor they are drawing. An objective, a player, a ping and anything a game invents reach the map the same way.
* **Reveals are granted rather than written.** A marker names the tags its owner must carry to be shown and the tags that hide it again, so a gameplay effect that marks somebody as spotted reveals them for exactly as long as it lasts, and an attachment that keeps its owner off the map defeats it.
* **Working out a view is separate from drawing it.** The view classes hand over which part of the picture is in view and the markers in the places they belong. How a map looks is settled entirely by the widget built on them, and the minimap and the map screen differ only in where the view is centred and how far it reaches.
* **A ping is contextual, and the server decides what it was.** A player presses one key and what they get depends on what they were looking at. Where they were looking is known only on their machine, so the place travels to the server, which checks it and then decides for itself what kind of ping it is from what was actually there.
* **A kind of ping is content.** What a kind fits, what it is drawn with, how long it lasts, who sees it and how many may stand at once are all fields on a data asset. Adding a call to a game is authoring an asset and listing it, not writing code.
* **An answer is a position, not a message.** A player holds one answer at a time on any ping, saying the same thing twice takes it back, and several players saying the same thing show as that one answer with a count.

***

### Documentation Structure

| Section                                                     | What It Covers                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [**The Map Asset**](the-map-asset.md)                       | Authoring a map, baking its floors, fitting the area it covers, and naming which map each level is played with                        |
| [**Markers**](markers.md)                                   | The marker component end to end: pictures, teams and audience, granted reveals, progress, ordering and the edge of the view          |
| [**Map Views**](map-views.md)                               | How a view is worked out, and what the minimap, the compass and the map screen each add to it                                         |
| [**Pings**](pings/)                                         | The ping system: how a ping is placed and checked, what a kind of ping is, the wheel, answers, limits and presentation                |
| [**Setup & Integration**](setup-and-integration.md)         | Adding navigation to an experience, baking a map for a level, and putting a game's own objectives on it                               |
| [**Extending**](extending.md)                               | Marking something new, writing a kind of ping, replacing a view's look, and the hooks a widget binds                                  |
