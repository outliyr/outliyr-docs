# Presentation

A ping has to be legible from across a map, so most of the plugin's drawing work goes into the mark standing over the world and the short readout beside the minimap. Neither decides how anything looks: both work out state and raise events, and the look is built in Blueprint.

***

## The mark over the world

`UPingIndicatorWidget` draws one ping where it stands. What it settles is only what a widget cannot work out for itself: where the ping is on the screen, how far off it is, the length of the line its kind asks for, and that a ping changing its look never has both pictures on screen at once.

How the ping arrives, how it answers distance and how it shows that the player is aiming at it are all left to the widget built on it.

### Parts a widget can bind

| Part      | What It Is                                                                      |
| --------- | ------------------------------------------------------------------------------- |
| `Icon`    | The ping's picture                                                               |
| `Head`    | What the picture is held in, which is what the line is drawn up to               |
| `Halo`    | A ring around the picture                                                         |
| `Sweep`   | An arrival flourish                                                              |
| `Tether`  | The line down to what the ping marks                                             |
| `Label`   | The ping's name                                                                  |
| `Answers` | Where the answers teammates have given are listed                                |

A widget binds as many as it has a use for and none are required. Anything meant to carry the whole mark at once is animated on `Head`, since that holds the picture and whatever else is drawn with it.

### State a widget can read

| Asked                   | Answers                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `GetPing`               | The ping being drawn                                           |
| `IsAimedAt`             | Whether the player is looking at this ping                      |
| `IsClamped`             | Whether the mark is being held at the edge of the screen        |
| `GetMetresAway`         | How far off the ping is, in whole metres                        |
| `GetMetresText`         | That distance already worded                                   |
| `GetAimAngle`           | How far the ping lies from the middle of the view               |
| `IsTethered`            | Whether this kind draws a line at all                           |
| `IsNamed`               | Whether this kind writes its name beside the mark               |

### Events a widget answers

| Event                     | Raised When                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| `OnPingBound`             | The widget is given a ping to draw                                 |
| `OnPingPlaced`            | The ping goes up                                                   |
| `OnPingRefreshed`         | The ping's life is put back to full                                |
| `OnLookChanging`          | The ping is about to change its look, so the old one can be seen out |
| `OnPingResponsesChanged`  | A teammate has answered                                            |
| `OnAimedAtChanged`        | The player starts or stops looking at it                            |
| `OnClampedChanged`        | The mark starts or stops being held at the screen edge              |
| `OnPingUpdated`           | Every frame, carrying the distance and the frame time               |

`OnLookChanging` is the one that matters for a kind that settles. The old look is seen out before the new one arrives, so the two pictures are never on screen together, and what that looks like is the widget's business.

{% hint style="info" %}
`OnPingUpdated` exists for the things an animation cannot be driven by. A distance is one of those: it changes with the player's own movement rather than with time, so it cannot be a track on a timeline.
{% endhint %}

<details>

<summary>Drawing the picture with a material</summary>

A kind's picture and colour are handed to the widget's material under `IconParameter` and `ColourParameter`, and a settling ping fades through `DesaturationParameter`. A widget authored with a plain texture brush instead gets the picture set on the brush and the colour as a tint, which is flatter but works.

The shipped material derives the picture's outline from the picture's own transparency rather than from a copy drawn behind it, so an icon of any shape is outlined all the way round, including inside any holes in it. A picture whose artwork runs to the very edge of its canvas has nothing for the outline to grow into and will be flat on that side.

</details>

***

## The feed

A marker says where something is but not what it is, because reading a marker means looking at it, and the player who most needs to know what was called is usually facing the other way. `UPingFeedWidget` is the short readout that fixes that, sitting wherever the minimap leaves room.

| Field         | What It Does                                                                     |
| ------------- | -------------------------------------------------------------------------------- |
| `LineClass`   | The widget each line is drawn with                                                |
| `MaxLines`    | How many lines may stand at once                                                  |
| `HoldTime`    | How long a line is held before it goes                                            |
| `FadeTime`    | How long it takes to see itself out                                               |
| `RunWindow`   | How close together pings have to be to become one line                            |
| `ViewerName`  | What the viewer's own calls are attributed to                                     |

Lines are deliberately few and short lived. Pings placed in a run inside `RunWindow` become one line carrying a count rather than a column of their own, so anything placing several at once cannot take the corner over.

Which kinds reach the feed at all is each kind's own business, through `bShownInFeed`. A kind that only says what a player means to do can leave the saying to the mark standing there.

A line is handed something already worded and counted and adds nothing of its own, so a line stands for a run of pings as readily as for one. It is also told when it is shown and when it is retiring, and the feed waits for it to see itself out before taking it away.

***

## Answers on the mark

`UPingResponseWidget` draws one thing a side has said back about a ping. It is handed the answer's picture, name and colour and a count, because several players saying the same thing is shown as that one answer with a count rather than as the answer repeated. A ping everybody agreed with is then as readable as a ping one player agreed with.
