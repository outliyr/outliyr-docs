# The Map Asset

A level's map is a `UMapLevelData` asset: a picture of the level seen from above, the stretch of world that picture covers, and the floors it is drawn as. Everything that draws a map reads this one asset, which is what lets a single minimap widget be authored and then shown in every level a mode is played in.

The picture is authored and baked in the editor rather than captured as the game runs. A live capture costs a render of the world every frame, and it photographs the roofs rather than the rooms beneath them, so a player indoors would be looking at the outside of the building they are standing in.

***

## Placement

Three fields settle where the picture sits in the world.

| Field                | What It Means                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `WorldBounds`        | The stretch of the world the picture covers, measured on the ground plane. Every floor is drawn over this same stretch                   |
| `RotationFromWorld`  | How far the picture is turned from the world's axes, for a level built at an angle to them                                               |
| `DisplayName`        | What to call the map where it is named on screen. Left empty, nothing shows a name                                                       |

Because every floor covers the same stretch, a marker keeps its place on the map as the floor shown beneath it changes.

Two editor buttons set the area for you. `Fit Bounds To Level` takes whatever the open level occupies, which is a starting point rather than an answer, since a level built to look bigger than it plays reaches well past the ground a player can stand on. `Fit Bounds To Selection` takes whatever is selected instead, so selecting the playable floor, or the volume that already marks the playable area out, says where the map reaches far more precisely.

<details>

<summary>Turning a place on the map into a place in the world</summary>

`WorldToNormalised` places a world point on the picture, from zero at the top left corner to one at the bottom right. A point outside the area the picture covers falls outside that range rather than being clamped, which is what lets a caller decide between hiding the marker and pinning it to the edge.

`NormalisedToWorld` goes the other way, which is what turns a place a player chose on the map screen into somewhere that can be marked.

</details>

***

## Floors

A level laid out on one storey needs a single `FMapFloorLayer` covering every height it reaches. A level with floors above one another needs one layer for each, so a player upstairs is not shown the walls downstairs.

| Field                       | What It Means                                              |
| --------------------------- | ---------------------------------------------------------- |
| `Texture`                   | The picture of this floor                                  |
| `DisplayName`               | Name for the floor where one is shown, such as a storey    |
| `MinHeight` / `MaxHeight`   | The band of heights this floor covers                      |

The layers are ordered from the lowest upward. The bands also decide whether one player is read as standing above another, so a map players can be airborne over is best left with its topmost floor ending at the rooftops: a player higher than every floor then belongs to none of them and is read as being on no particular storey, rather than being lumped in with the top floor.

***

## Baking

`Bake Floor Textures` photographs the level that is open, once for every floor, and points each floor at what it took. Each floor is photographed from the height it gives way at, so whatever stands above it is left out and the rooms beneath a roof are visible rather than the roof.

| Setting             | What It Does                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `BakeResolution`    | How many pixels across each floor is taken at, the other side following the shape of the area  |
| `BakeOutputPath`    | Where the pictures are written, which is beside the asset when left empty                       |
| `BakeLighting`      | How the level is lit in the picture                                                             |
| `bDrawEdges`        | Whether a line is drawn wherever one surface steps away from another                            |
| `IgnoredActorTags`  | Actors carrying any of these tags are left out of the picture                                   |

### How the level is lit

Seen from overhead, a level is mostly flat faces of the same few materials, so colour says almost nothing about shape.

* **Flat** owes nothing to the lights, which keeps every corner of the level equally readable.
* **Lit** is the level as it is actually lit. A level lit for standing in it is not lit for looking down on it, so a bright sky flattens the roofs into the ground; this suits a level deliberately built to be read from above.
* **Height** shades each surface by how high it stands, between `LowGroundColour` and `HighGroundColour`. This is the default, because height says everything that colour does not.

### Edges

Shading alone leaves anything lying close to the ground reading as the ground. A line drawn wherever one surface steps away from another, by more than `EdgeThreshold`, says that something is there whatever its height or colour, and it is what carries a map built out of a single material.

### Leaving scenery out

A level built to look bigger than it plays has scenery standing where nobody can walk, and drawing it tells a player about ground they cannot reach. Tagging those actors and naming the tag in `IgnoredActorTags` leaves them out. Scenery standing clear of the area the map covers needs nothing, since the area alone excludes it.

{% hint style="info" %}
Baking writes a texture asset, so it only exists in an editor build. The baked textures are ordinary assets that ship in the cook.
{% endhint %}

***

## Naming the map for a level

An experience is often played in more than one level, and a level is often played by more than one mode. The `Register Map Data` game feature action settles which map goes with which level.

| Field                     | What It Means                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `MapsByLevel`             | Levels listed against the maps drawn for them                                                              |
| `MapForUnlistedLevels`    | The map drawn in a level that is not listed. Left unset, such a level is played with no map at all         |

Listing the levels here is what lets one experience, and one minimap, serve all of them. It is also what keeps a map in a packaged build, since an asset nothing refers to is left out of the cook.

The map for the level being played is held by a world subsystem, which announces when it arrives. A view may well be built before any map has been supplied, so a view is told rather than left watching for one, and a level played with no map takes its views off screen instead of drawing an empty square.

<details>

<summary>Reading the map from code</summary>

`UMapLevelDataSubsystem::FindMapData` hands back the map for a world, or nothing where none was supplied. `SetMapData` supplies one, and `ClearMapData` takes one away, but only if the map being cleared is still the one being held, so a feature shutting down cannot remove a map another has since supplied.

A view also takes a `MapDataOverride`, which is how a screen shows a map other than the one the level is being played with.

</details>
