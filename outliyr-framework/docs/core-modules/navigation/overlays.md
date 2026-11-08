# Overlays

A marker says where one thing is. Some of what a player needs to read off a map has a shape instead of a place: the stretch of ground that is closing in, the line a plane is flying, the route a patrol walks, the area a mode will not let anyone stand in.

An overlay is that shape. An actor puts one on the minimap, the compass and the map screen by carrying a `UMapOverlayComponent` and saying where the shape stands, in the same way an actor puts a mark on them by carrying a marker.

***

## Shapes are drawn, not placed

Markers are widgets put in places. Shapes are painted onto a canvas that covers the view, and the difference is worth understanding because it is why the authoring surface looks the way it does.

A widget stretched to the size of a shape scales everything about itself, including the line at its edge. A safe zone that starts as the whole island and ends a few metres across would begin as a hairline and end as a solid disc. A shape drawn as geometry keeps the thickness it was given however far it reaches, which is the only way a shrinking ring stays readable the whole way down.

The sizes involved also rule out a picture. A ring three kilometres across, seen on a minimap reaching forty metres, is a widget a hundred and fifty times the size of the view. Almost all of it is off screen, and all of it is paid for. A drawn shape costs the part of itself that shows.

And a line running through a string of places has no shape of its own to stretch. There is nothing to anchor, so there is nothing to place.

What a developer sees of this is that a shape says how it is drawn rather than being built out of widgets, and that a material is how a shape becomes more than a flat line.

***

## A view asks, and nothing is told

The component answers two questions, and a view asks them in that order every frame.

| Event               | What It Answers                                                                       |
| ------------------- | ------------------------------------------------------------------------------------- |
| `GetOverlayBounds`  | Where the ground the shapes cover is centred and how far it reaches, or that there is nothing to draw |
| `GetOverlayShapes`  | The shapes themselves, in the measures of the world                                   |

Bounds come first because answering them costs nothing, and a view that cannot see that ground asks no further. Something with nothing to draw at this moment says so to the first question and is left alone, which is how a line that has run its course takes itself off every map at once without anything being cleared.

Nothing is cached and nothing is pushed. A shape that moves, grows or disappears needs only to answer differently the next time it is asked, so an overlay has no state to keep in step with the thing it is drawing.

The request a view hands over carries the viewer, where the view is centred and how far it reaches. How far it reaches is the useful part: it says how finely a shape is worth giving, so a long route asked for by a map zoomed out can answer with far fewer places than the same route asked for by a minimap.

| Field        | What It Means                                                        |
| ------------ | -------------------------------------------------------------------- |
| `Viewer`     | The actor the map is being drawn for                                  |
| `ViewCentre` | Where in the world the middle of the view sits                        |
| `ViewReach`  | How far the view reaches from that middle, measured on the ground     |

<details>

<summary>What overlays and markers share</summary>

Both are built on `UMapAnnotationComponent`, which is where the questions that have nothing to do with being a shape or a mark are answered: who may see it, whose side it is on, whether it is switched on, which tags on the owner reveal it or hide it again, and which is drawn over which where two land together.

So a shape is shown to one team alone, revealed by an effect, or tinted with its owner's colour by exactly the fields that do those things for a marker, and the two are ordered against each other rather than in separate passes. [Markers](markers.md) covers all of it.

A component registers itself with `UMapOverlaySubsystem` as its owner begins play and drops out as its owner ends play, and every view draws from that one registry.

</details>

***

## What a shape is

| Field         | What It Means                                                                                |
| ------------- | -------------------------------------------------------------------------------------------- |
| `Kind`        | `Ring` or `Path`                                                                              |
| `Points`      | Where it stands. A ring is about the first of these; a path runs through all of them in order  |
| `bClosed`     | Whether a line runs from its last place back to its first                                     |
| `WorldRadius` | How far a ring reaches from its middle, measured on the ground. A path has no use for it      |
| `Colour`      | The colour it is drawn in, laid over the colour of whatever put it up                          |
| `bAllFloors`  | Whether it is drawn whatever floor is being shown                                             |
| `Height`      | The height it stands at, which says which floor it belongs to                                 |

A closed path covers anything with straight sides, a triangle as much as a wall, so there is no third kind for polygons. A ring is named apart for a reason that only shows at the extremes: a circle given as a list of places cannot be laid out to suit how large it is being drawn, and cannot be cut down to the arc of it that actually shows. A ring given as a middle and a reach gets both.

One thing may put up several shapes, which is what `Colour` on the shape is for. The safe zone draws where it stands and where it is closing to as two rings, told apart by their colours, from one component.

A shape standing through every floor, such as one about a stretch of ground rather than about a room, sets `bAllFloors`. A shape belonging to a storey leaves it off and gives its `Height`, and it is then faded when another floor is being shown, by the same share a marker on another floor is faded by.

***

## How a shape looks

The look belongs to the shape. Whatever puts a shape up says how it is drawn, which means adding a component gives something that looks right on every view without a widget being touched.

| Field              | What It Does                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `Mode`             | `Stroke` draws a line along the shape; `Fill` draws across the whole view                      |
| `Material`         | What it is drawn with. Nothing draws a plain line instead                                      |
| `Colour`           | Laid over the colour the shape itself asked for                                                |
| `Thickness`        | How thick the line is drawn, in the units the interface is laid out in                         |
| `bSmoothed`        | Whether a plain line is softened at its edges. A material does this for itself                  |
| `SpacingOnScreen`  | How far apart the places along a curve are laid, measured on screen                             |
| `bDashed`          | Whether a plain line is drawn in dashes, with `DashLength` and `DashGap`                        |
| `OffFloorOpacity`  | How much is left of a shape standing on a floor other than the one being shown                  |
| `Style`            | What kind of shape this is, only so that a view can single it out. Covered below                |

`SpacingOnScreen` is what a curve costs. It is measured on screen rather than in the world, so a ring drawn small is laid out of few pieces however far it reaches, and the same ring filling the map screen is laid out of many.

### Stroke and fill

The two modes exist because outlining a shape and shading one side of it are different jobs.

**Stroke** lays a band of an even thickness along the shape, turning through its corners rather than notching them. This is a line, a ring's outline, a route. It is the default and it is shape agnostic, which is why the plugin ships a stroke material and no fill material of its own.

**Fill** lays a single sheet across the whole view and tells the material where the shape stands. Every part of the view is then free to answer for itself how far it lies from the shape, which is what it takes to shade the ground outside a ring rather than to draw the ring. A fill has to know what shape it is dealing with, so a fill material belongs to whatever put the shape up.

A shape drawn both ways is a shape put up twice with different looks, which is how the battle royale zone gets shaded ground and a bright rim.

<details>

<summary>What a material is handed</summary>

A material has two hard requirements, and failing either draws nothing at all:

* its **domain must be User Interface**
* its **blend mode must be Translucent** or Alpha Composite

It is also handed the shape's colour as the vertex colour, which unlike every other interface element it has to take for itself by multiplying through a `Vertex Color` node. A material that ignores it draws in its own colours and nothing the shape said about colour will reach it.

Where it is on the shape arrives in the texture coordinates.

| Coordinate     | Stroke                                                        | Fill                                                                  |
| -------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `TexCoord(0)`  | How far along the line, in screen units, and across it from nothing at one edge to one at the other | Where in the view it is, from nothing at the top left to one at the bottom right |
| `TexCoord(1)`  | Nothing                                                        | Where the shape's middle sits, in that same measure                    |
| `TexCoord(4)`  | How long the whole line is and how thick it is, both in screen units | How far a ring reaches along each side of the view, in that same measure |

Reading the distance along a stroke is what lets a dash taper, travel or pulse rather than only start and stop, which is why a dashed material is better than `bDashed` wherever one is worth authoring. Knowing how thick the line is drawn is what lets it soften its edges over a fixed number of pixels, so a line keeps the same edge on a map in a corner and on a map filling the screen.

A fill is handed the reach on **each** side because a view wider than it is tall reaches further across the world than it does down. Measuring how far out a part of the view lies against one of the two reads every distance as an oval, so a fill evens the two up before it measures.

Everything a shape needs is carried in the vertices rather than in a material instance, so any number of shapes share one material without one instance each.

</details>

***

## A view that has to differ

The same line reads differently at two hundred pixels and at a thousand, so a view can name looks of its own.

`Overrides` on the canvas is a list of looks, each naming the kind of shape it is for in its `Style` tag. A shape whose own `Style` is covered by one of them is drawn that way instead of the way it asked for. Naming a kind covers everything under it, so one entry serves a family until one of its members is named, and the first entry that covers a kind wins, which means narrower entries go first to be reached at all.

{% hint style="info" %}
`Overrides` is meant to stay empty. Leaving it alone draws every shape the way whatever put it up asked for, which is the ordinary case and the one that needs no authoring. A shape carrying no `Style` tag cannot be singled out at all, which is fine for a shape nothing needs to override.
{% endhint %}

`DefaultLineMaterial` on the canvas is what a shape is drawn with where its look names no material. The plugin's own `M_UI_MapStroke` sits there as shipped, which is why a shape put up with nothing authored still looks drawn rather than plotted. Clearing it falls back to a plain stroke of an even colour.

While a map widget is being authored the canvas puts up a sample ring and a sample line, one pair for every look the view names and a plain pair where it names none, so thickness, colour and material choices can be judged without playing.

***

## Adding the canvas to a view

A view draws shapes only once it has a canvas to draw them in. Add a `UMapOverlayCanvas` to the widget. Three things matter:

* **Name it `OverlayCanvas`.** That is the name the view binds, and a canvas named anything else is simply never given anything to draw.
* **Put it beside whatever draws the markers, not inside whatever draws the picture.** The picture is drawn turned and wider than the view it fills, while shapes arrive already turned. A canvas nested inside the picture is turned twice and scaled once too often.
* **Let it fill the same box the markers use.** It asks for no size of its own.

The shipped minimap and map screen both carry one already. This matters when building a map view from scratch.

{% hint style="warning" %}
Three things that would otherwise draw nothing in silence each say so in the log once: a view with shapes to draw and no canvas bound, a shape asking for a kind of look that nothing provides, and a material whose domain or blend mode make it undrawable. If a shape is not appearing, the log already knows why.
{% endhint %}

***

## Reading places for yourself

Anything else drawing over a map, rather than putting a shape up for the plugin to draw, needs to turn places in the world into places on the view. `GetViewProjection` hands back `FMapViewProjection`, which is how the view stands this moment and the whole of what a reading needs.

| Function              | What It Does                                                             |
| --------------------- | ------------------------------------------------------------------------ |
| `WorldToView`         | Where a place in the world falls on the view                              |
| `ViewToWorld`         | Where a place on the view lies in the world                               |
| `LengthToView`        | How far a distance on the ground reaches across the view                   |
| `TurnFacingIntoView`  | Which way a bearing in the world points on the view                        |

Take it once and read against it rather than asking the view place by place. Gathering what a reading needs costs more than the reading does, so a line of a thousand places asks the view nothing at all.

Places run from minus one at the left and top to one at the right and bottom, with the turn of the picture already in them, which is the same measure markers and shapes are both handed over in.
