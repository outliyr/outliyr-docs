# Setup & Integration

The plugin is `ExplicitlyLoaded`, so nothing happens until an experience asks for it. Each view is a separate action set, so a mode takes the ones it wants.

***

## Giving a mode its views

Add the action sets to the experience's `ActionSets`.

| Action Set     | Adds                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `LAS_Compass`  | The compass strip in the `HUD.Slot.Compass` slot                                                     |
| `LAS_Minimap`  | The minimap in the `HUD.Slot.Minimap` slot, the map screen ability and its key, and the player's own map marker |
| `LAS_Ping`     | The ping ability, its key and its input mapping                                                      |

`LAS_Minimap` carries more than a widget because a minimap without the player on it is not much use: it adds the marker component that puts the viewer on every view, and it grants the ability that opens the map over the screen, with the input mapping that key lives in.

As shipped, the shooter base experience asks for the compass, so every mode built on it has one, and each team mode adds the minimap on top.

{% hint style="info" %}
Two abilities ship for the map screen. One holds the map open while its key is held, the other toggles it open and closed. A mode grants whichever suits it, and a mode that grants neither keeps the minimap without a full screen map.
{% endhint %}

***

## Giving a level its map

A view draws nothing until the level being played has a map. Three steps, once per level:

1. **Author a `UMapLevelData` asset.** Set the area it covers, with `Fit Bounds To Selection` over the playable ground as a starting point, then add one floor layer per storey with its band of heights.
2. **Bake it.** Open the level and press `Bake Floor Textures` on the asset. Check each floor: a floor photographed from too low loses its own geometry, and one photographed from too high picks up the storey above.
3. **Name it on the experience.** Add a `Register Map Data` action listing the level against the map.

Step three is not optional for a packaged build. An asset nothing refers to is left out of the cook, so a map that is only ever found at runtime is a map that works in the editor and is missing in a shipped game.

{% hint style="warning" %}
A level played with no registered map is not an error. The views take themselves off screen, which is what `bHideWithoutUsableMap` is for, so a mode can be played in a level nobody has drawn a map for yet.
{% endhint %}

***

## Putting a game's own things on the map

Marking something takes one component and no code. Add a `UMapMarkerComponent` to the actor, give it a picture, a colour and a `MarkerType` tag, and choose who it is shown to.

What needs deciding per thing:

* **Does it belong to a team that cannot be read from its owner?** A flag, a planted bomb or a dropped tag is owned by a team without being part of it, so it calls `SetMarkerTeam`.
* **Is it shown from the start, or revealed?** Something always on the map starts showing. Something revealed by a condition starts switched off and names the tags that reveal it.
* **Does it have progress worth showing?** A point being captured or a bomb being defused calls `SetProgress` as it changes, and `ClearProgress` when there is nothing to show.
* **Should it come off the map?** A spent bomb site and a flag sitting safely in its base are both better off the map than on it, so each switches its marker off rather than leaving a marker nobody needs to read.

The shipped modes each do this for their own objectives, which is the clearest place to look at a worked example: control points take their owner's colour and show capture progress, bomb sites come and go as the round moves on, and both flags and their bases carry a picture each.

A thing whose shape matters rather than its place carries a `UMapOverlayComponent` instead, which puts a ring or a line on the same three views. The battle royale safe zone and drop route are the shipped examples, and [Overlays](overlays.md) covers it.

<details>

<summary>Where the dependency goes</summary>

A mode plugin whose own actors carry markers depends on the Navigation runtime module, and its descriptor lists Navigation as a plugin dependency.

The dependency only ever runs that way. Nothing in the Navigation plugin depends on a game mode's plugin, because what an experience wires together is content's business rather than the plugin's.

</details>

***

## Giving a mode pings

Pings need two things: the action set on the experience, and the kinds listed on the ability.

The shipped `GA_Ping` already lists the kinds and answers that ship with the plugin, in the order they should be tried, so adding `LAS_Ping` to an experience is enough to have pings working. A game with its own vocabulary of calls makes its own ability asset instead and lists its own kinds, which is covered under [Extending](extending.md).

Worth checking per mode:

* **Does the mode have teams?** A kind fitting only an ally or only an opponent needs teams to mean anything, and a kind whose audience is its own side needs a side to be on. A free for all mode wants its kinds set to `Anything` and `Everyone` instead.
* **Does the wheel's order suit the game?** A call keeps its slot for as long as the wheel offers it, so the order on `WheelKinds` is muscle memory. It is worth settling early and leaving alone.
* **Should a round boundary clear pings?** `ClearPingsOfChannel` takes one channel down and leaves the rest standing, which is what a mode calls at the start of a round rather than clearing everything a player has said.
