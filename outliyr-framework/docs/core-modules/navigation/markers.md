# Markers

An actor appears on the minimap, the compass and the map screen by carrying a `UMapMarkerComponent`. Everything about the marker lives on the component, so none of the three views ever learns what kind of actor it is drawing. A control point, a player, a ping, a dropped tag and anything a game invents all reach the map the same way.

A marker registers itself as its owner begins play and drops out as its owner ends play. Every view draws from that one registry rather than searching the world for itself.

{% hint style="info" %}
Everything on this page from **Teams and audience** onwards belongs to `UMapAnnotationComponent`, which the marker is built on. [Overlays](overlays.md), the shapes drawn over a map, are built on the same thing, so who may see one, whose side it is on, how it is revealed and which is drawn over which all work for a shape exactly as they are described here.
{% endhint %}

***

## What a marker looks like

| Field         | What It Means                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `Icon`        | The picture drawn for the marker. A marker with none is drawn as a plain dot                                   |
| `IconColour`  | The colour the picture is drawn in, applied on top of any team colour                                          |
| `DisplayName` | Name shown beside the marker, where the widget drawing it has room for one                                     |
| `MarkerType`  | What kind of thing the marker stands for, under `Navigation.Marker`                                            |
| `Priority`    | Which marker is drawn on top where two land in the same place, higher winning                                  |

`MarkerType` is a gameplay tag, and the plugin names three it treats differently: `Navigation.Marker.Objective`, `Navigation.Marker.Player` and `Navigation.Marker.Ping`. A marker of any other kind still works, since what a marker is drawn as and who it is shown to are read off the marker itself.

Markers left on the same priority are ordered by kind instead, with pings above players and players above objectives. Setting a priority is only needed to order markers that their kinds alone would not.

***

## Teams and audience

| Visibility   | Who Sees It                                                     |
| ------------ | --------------------------------------------------------------- |
| `Everyone`   | Every player                                                    |
| `SameTeam`   | Only players on the same team as whatever carries the marker    |
| `EnemyTeam`  | Only players on a different team                                |

A marker on something belonging to a team is tinted with that team's colour on top of its own colour, so a marker left white takes the team colour exactly, and a marker given a colour keeps it.

The team is read from the owner, which covers a pawn or a player state without any setup. A thing a team owns without being part of it, such as a flag, a planted bomb or a dropped tag, is told its team with `SetMarkerTeam`, and passing an unset index goes back to working it out from the owner.

{% hint style="warning" %}
Audience here decides what a view draws. It does not stop the actor from replicating. An actor whose very existence is something a rival should not learn needs limiting at the replication level as well, which is what [pings](pings/limits-and-authority.md) do.
{% endhint %}

***

## When a marker is shown

Three things have to agree before a marker is drawn: it has to be switched on, the owner's tags have to allow it, and the audience has to include the viewer.

### Granted reveals

The tag fields are the interesting half, because they are what let a reveal be granted rather than coded.

| Field                | What It Means                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `bStartShowing`      | Whether the marker is shown from the moment its owner begins play                         |
| `RequiredOwnerTags`  | Tags the owner must carry for the marker to be shown, on top of it being switched on      |
| `BlockedOwnerTags`   | Tags on the owner that hide the marker even where everything else would show it           |

A gameplay effect that marks a player as spotted grants the tag named in `RequiredOwnerTags`, and the marker is shown for exactly as long as that effect lasts. Nothing has to remember to switch the marker off again, and nothing has to replicate the reveal, because the effect already reaches every machine.

`BlockedOwnerTags` is the other half, covering whatever is meant to defeat a reveal, such as a weapon attachment that keeps its owner off the map.

### Switching one on by hand

`SetShowing` and `ShowFor` switch a marker on, the second switching it off again after a while and extending rather than restarting if called again before the time is up.

{% hint style="danger" %}
Neither of these travels to other machines. They change the marker on the machine that called them and nowhere else, which suits a reveal only one player is meant to get. A reveal every player should see belongs in the tag fields instead.
{% endhint %}

### Deciding for yourself

`IsVisibleTo` is a Blueprint native event. It answers by whether the marker is switched on, then by the owner's tags, then by the audience, and overriding it replaces all three. This is where a game puts a rule the fields cannot express, such as a marker visible only to players holding a particular item.

***

## Progress

A marker carries how far along whatever it marks is, which is how a point being captured or a bomb being defused reads on the map without the map knowing what either of those is.

`SetProgress` takes a fraction from zero to one and the colour to draw it in; anything outside that range is brought back in. `ClearProgress` leaves the marker showing none, which is where it starts. Until something sets it, `bShowsProgress` is false and there is nothing to draw.

The marker widget draws it by handing the fraction and the colour to a material parameter, so what progress looks like is a matter of the material rather than of the component.

***

## Leaving the view

A marker whose subject falls outside the view keeps a place at the edge of it when `bClampToEdge` is set, rather than disappearing until it comes back in. The widget draws a pinned marker as an arrow or as a bar according to its kind, and a view can leave particular kinds unpinned so they simply disappear instead.

A marker on a floor other than the one being shown is drawn faded, with a chevron saying which way it lies.

<details>

<summary>What the view hands the marker widget</summary>

Every marker on a view is drawn with the same widget, so what tells one from another is the state the view worked out for it rather than the widget itself. That state carries where the marker falls on the view, the colour it came out, whether it is pinned to the edge and which way the pin points, the bearing and distance from the viewer, which way the marker itself faces, and how many floors and how far in height it stands from the viewer.

The widget built on `UMapMarkerWidget` binds as many of its parts as it has a use for: the picture, a shape used for player markers, a progress ring, an edge arrow, an edge bar, a floor chevron and a label. It needs none of them.

</details>
