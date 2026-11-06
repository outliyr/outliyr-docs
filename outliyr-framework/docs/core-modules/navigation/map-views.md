# Map Views

There are three views of the world in the plugin: a minimap that follows the player, a compass strip, and a map opened over the game. All three work the same way underneath, and none of them draws anything in C++.

***

## Working out a view is not drawing it

`UMapViewWidget` works out what a view of the map shows and stops there. Each frame it decides which part of the authored picture is in view and hands over the markers in the places they belong. How a map looks is settled entirely by the widget built on it.

That split is what makes the two map views cheap to have both of. The minimap in the corner and the map filling the screen differ in only two answers: where the view is centred and how far it reaches. Everything else, including which floor is shown, how markers are placed, how one is pinned to the edge and which kinds are left out, is shared.

| What the view hands over    | Used For                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- |
| The current floor's texture | The picture to draw                                                                 |
| The viewed region           | Which part of that picture is in view, as a centre and an extent                    |
| The viewer's placement      | Where to draw the player's own arrow, and which way it faces                        |
| The marker views            | Each marker's place on the view, its colour, its pin and its floor difference        |
| The map's turn              | How far the picture itself is rotated                                               |

A view also hands the region straight to a material with `ApplyViewToMaterial`, which is how the shipped minimap draws the picture, and `ViewToWorld` turns a point on the view back into a place in the world, which is what lets a player ping somewhere from the map screen.

<details>

<summary>Drawing a view that turns</summary>

A view that rotates has to draw more of the picture than it shows, or the corners of the rotated picture sweep across empty space. `ViewCoverage` says how much larger the picture is drawn than the view: a round view that turns needs the square root of two, and a view that never turns needs one.

The widget drawing the picture has to be made that much larger than the view in the same breath, and the view has to be set to clip, or the picture simply spills out over whatever surrounds it.

</details>

***

## Shared settings

| Field                   | What It Does                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `ViewShape`             | `Round` reaches equally far in every direction; `Square` reaches further into its corners         |
| `bPinMarkersToEdge`     | Whether a marker outside the view keeps a place at its edge                                       |
| `UnpinnedMarkerTypes`   | Kinds of marker that simply disappear instead of being pinned                                     |
| `PinnedEdgeInset`       | How far inside the edge a pinned marker is held, as a share of the view                           |
| `bHideWithoutUsableMap` | Whether the view takes itself off screen in a level with no map drawn for it                       |
| `MapDataOverride`       | A map to show in place of the one the level is being played with                                  |

The shape matters because it decides where a pinned marker belongs. A marker held exactly at the edge is drawn half outside it, and a view that clips cuts that half away, which is what the inset is for.

Every view also inherits from `UNavigationWidget`, which adds two things. It holds a pool of entry widgets, so the markers drawn last frame are handed out again rather than made fresh, and it names kinds of marker to leave out.

| Field                       | What It Does                                                                     |
| --------------------------- | -------------------------------------------------------------------------------- |
| `HiddenMarkerTypes`         | Kinds this view never draws, however visible they are to the viewer              |
| `HiddenAlliedMarkerTypes`   | Kinds this view does not draw for the viewer's own side                           |
| `HiddenEnemyMarkerTypes`    | Kinds this view does not draw for a rival side                                    |

Naming a kind leaves out everything under it, so a view wanting no markers at all names the root tag. This is how the bomb is kept off the defending side's map while the attacking side sees it.

***

## The Minimap

`UMinimapWidget` centres the view on the viewer and reaches `ViewRadius` centimetres around them.

| Rotation    | What Turns                                                      |
| ----------- | --------------------------------------------------------------- |
| `MapTurns`  | The map turns so the way the viewer faces is always up          |
| `NorthUp`   | The map holds north up and the viewer's own marker turns        |

It fills the `HUD.Slot.Minimap` slot, so a mode gets one by adding the action set that asks for it.

***

## The Compass

`UCompassWidget` places markers along a strip by the bearing they lie on, and it needs no map of the level at all, so it works in a level that has none. It fills the `HUD.Slot.Compass` slot.

| Field               | What It Does                                                                          |
| ------------------- | ------------------------------------------------------------------------------------- |
| `FieldOfView`       | How much of the way around the compass covers from end to end                          |
| `MaxMarkerDistance` | How far off a marker may be and still be shown, or nothing to show them however far    |
| `Ticks`             | The fixed marks along the compass                                                      |

A wider field of view shows more at once and moves less as the viewer turns; half of the way around is the usual choice.

The fixed marks are data rather than built in, so what a compass shows along itself is a matter of which marks it is given. Each mark is a bearing, a label and a scale, which is how the cardinal points and the smaller marks between them come from one list. `BearingToStripPosition` places any bearing along the strip, which is what the marks use to find their places and what anything else drawing on the compass can use too.

Each marker view on the compass also carries the distance and the height difference to the marker, so a compass can say how far off something is or that it is above the viewer.

***

## The Map Screen

`UFullscreenMapWidget` is a map the player moves around for themselves, opened over the game rather than sat in a corner.

It opens on a key and stays while that key is held, or stays open until closed again, depending on which ability a mode grants. It follows the viewer until the player moves it, after which it stays where they put it, and the floor it shows follows them in the same way until they choose one. `CentreOnViewer` goes back to following.

| Field               | What It Does                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `ClosestReach`      | The closest the player may zoom in, measured on the ground                                           |
| `FurthestReach`     | The furthest they may zoom out. Left at nothing, this is whatever holds the whole map, which is also what the map opens at |
| `ZoomStep`          | How much one notch of the wheel changes the reach                                                     |
| `bPointerMovesMap`  | Whether dragging and the wheel move the map                                                          |

`ZoomTowards` zooms at the point under the pointer rather than at the centre, so the place a player is looking at stays under their cursor. `Pan` moves the view by a share of itself, `SetZoomFraction` and `GetZoomFraction` are for a widget that draws a zoom slider, and `SetShownFloor` picks a storey.

The screen also binds a close button and the key that closes it, so the prompt shown on screen names whichever key the player actually has bound.
