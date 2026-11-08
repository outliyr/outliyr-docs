# Extending

Most of what a game wants from navigation is authoring rather than code: a map asset, a marker component, a ping definition, a widget. This page covers where the seams are when authoring is not enough.

***

## Marking something new

Add a `UMapMarkerComponent` and fill it in. Nothing else is needed, and nothing has to be told that a new kind of thing exists, because the views never learn what they are drawing.

A new `MarkerType` tag under `Navigation.Marker` is worth adding when a view needs to treat the kind differently, since views leave kinds out, leave kinds unpinned and draw some kinds as bars by tag. A kind nothing needs to single out can share an existing tag.

### A visibility rule the fields cannot express

`IsVisibleTo` is a Blueprint native event. Overriding it replaces the whole answer: whether the marker is switched on, the owner's tags and the audience. This is the place for a rule like a marker only players carrying a particular item can see.

{% hint style="warning" %}
An override replaces all three checks, so an override that wants the ordinary rules as well as its own has to ask for them.
{% endhint %}

***

## Drawing a shape of something

Subclass `UMapOverlayComponent` and answer its two events. [Overlays](overlays.md) covers what the answers are made of; what follows is what is worth deciding when writing one.

**Say where the shape stands, or be told.** A component can read whatever it is drawing, or be handed the numbers as they change. Reading is less to wire and suits anything whose shape is standing still in the world, such as a route laid out in the level. Being told suits anything whose shape lives in a motion rather than in a value, since there is nothing to read while it is between two places. The safe zone is told, because what it is doing at a given moment lives in the shrink it is running.

**Nothing needs replicating for a shape.** Both machines ask the question for themselves, so a shape worked out from something every machine already runs costs nothing on the wire. A route picked at random is one name travelling, and the route's own shape is read out of the level on whichever machine is drawing it.

**Answer the bounds cheaply or the saving is lost.** The two questions exist so that a shape far out of view costs one answer, which only holds while the first answer stays cheap. A component whose bounds are expensive to work out has made the split pointless and should keep them rather than finding them again.

**Give places to suit the view that asked.** `ViewReach` on the request is how far the asking view sees. A long path answered at full detail for a minimap reaching forty metres is almost entirely places nobody will see resolved.

### A shape with no ring and no line in it

Everything with straight sides is a closed path, so a triangle, a rectangle or a corridor is `Points` and `bClosed` rather than anything new. A curve that is not a circle is a path laid out as finely as it needs to read, and the spacing to lay it at is the component's to choose, since only it knows what the curve is.

### A fill material of your own

A fill is told where the shape stands and left to decide what every part of the view does about it, which is what makes it the only way to shade one side of a shape. It is also the one part of the drawing that cannot be written once for every shape, because the answer depends on what shape it is. The plugin therefore ships a stroke material and leaves fills to whatever puts the shape up. The coordinates a fill is handed are set out under [Overlays](overlays.md).

***

## A new kind of ping

Author a `UPingDefinition` and list it on the ability. The ordering is the part that needs thought:

* On `PingKinds`, kinds are tried in order and the first that fits wins, so they run most specific first and the catch-all last.
* On `WheelKinds`, the order is where each call sits on the ring, which is what a player's hands learn.

A kind needing behaviour the fields do not cover sets `MarkerClass` to a subclass of `APingMarker`. The marker already handles its own look, its life, settling, who it is shown to and the answers given to it, so a subclass is for behaviour on top of that rather than for drawing.

### Making something describable

A kind with `bTakesLookFromTarget` set asks the thing it marked what it looks like. Implement `PingDescribable` on the actor and hand back a picture, a name and a colour. A thing that declines leaves the kind wearing its own look, so the interface is safe to implement partially.

This is how an item ping names the item. Anything else a game wants named after itself rather than after the call works the same way.

***

## A game with its own calls

Make an ability asset from `UGameplayAbility_Ping` and list your own kinds and answers on it. Nothing in the plugin refers to any shipped kind by name, so the shipped set can be replaced wholesale.

What a new ability most often changes:

| Field                           | Why                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `PingKinds` and `WheelKinds`    | The game's own vocabulary of calls                                                    |
| `MaxRange`                      | A game played at longer or shorter distances than a shooter                            |
| `TraceChannel` and `TraceRadius` | What a ping is allowed to find, and how forgiving the aim is                          |
| `WheelHoldTime`                 | How long a hold is before it stops being a press                                      |

Two functions are worth knowing about when subclassing in C++ rather than authoring: `ChooseKind` decides which kind fits from context, and `FindPointedPingHere` decides which standing ping the player is pointing at. Each is the whole of one decision.

***

## Replacing how something looks

Everything drawn by the plugin splits the same way: a C++ class works out state and raises events, and a Blueprint widget built on it decides what that looks like. So replacing a look never means touching C++.

| Class                   | Built On For                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| `UMinimapWidget`        | A minimap of a different shape, frame or style                              |
| `UCompassWidget`        | A compass with different marks, or a different strip                        |
| `UFullscreenMapWidget`  | A map screen with its own chrome and controls                               |
| `UMapMarkerWidget`      | How a marker is drawn on a map view                                         |
| `UPingIndicatorWidget`  | How a ping mark looks and behaves over the world                            |
| `UPingWheelWidget`      | How the wheel is laid out and animated                                      |
| `UPingFeedWidget`       | How the feed reads                                                          |

A widget binds as many of its class's named parts as it has a use for and ignores the rest, so a simpler widget is a smaller widget rather than one fighting its base class.

<details>

<summary>What the view classes let a subclass answer</summary>

`UMapViewWidget` leaves four questions virtual, and the two shipped map views are nothing but different answers to them: where the view is centred, how far it reaches, which floor is shown and how far the map is turned. A third kind of map view, such as one locked to a region rather than to a player, is those four answers and no drawing code.

Everything the base then works out follows from them, including the markers, the shapes and `GetViewProjection`, so a new view inherits the whole of the placement maths by answering those four and nothing else.

</details>

***

## Where to stop

Two things are worth saying plainly about what this plugin is not.

A marker's audience decides what a view draws, not what replicates. An actor whose existence is itself information needs limiting at the replication level too, which is what `SetActorTeamOnly` on the team subsystem is for. That mechanism needs Iris, and without it the actor still reaches everyone.

And a reveal granted by tags reaches every machine because the effect does. A reveal switched on with `SetShowing` or `ShowFor` reaches the machine that called it and nowhere else. Mixing the two up is the one mistake that looks like it works in the editor and does not work in a game.
