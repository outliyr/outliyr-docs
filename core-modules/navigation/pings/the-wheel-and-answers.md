# The Wheel and Answers

A press of the ping key pings whatever the player is looking at. Everything on this page is what happens when the contextual answer is not the one the player wants, or when the thing they are looking at is somebody else's ping.

***

## The Wheel

Holding the key for `WheelHoldTime` opens a wheel of the calls the player can make. The call they move towards is taken when they let go, and letting go while pointing at nothing calls the whole thing off rather than falling back to a contextual ping.

A call keeps its direction for as long as the wheel offers it. That is the point of a fixed wheel: a player who knows it reaches a call without reading it, which is the difference between a wheel that works under pressure and one that does not.

`UPingWheelWidget` works out which call is being reached for and stops there, leaving a widget built on it to draw the calls and show which of them is reached.

| Field           | What It Does                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------- |
| `SlotClass`     | The widget each call is drawn with                                                            |
| `SlotRadius`    | How far from the middle the calls sit                                                         |
| `DeadZone`      | How far from the middle the pointer must travel before any call is reached                    |
| `Reach`         | How wide a slice around each call counts as reaching it                                       |
| `StickDeadZone` | How far a gamepad stick must be pushed to count                                               |

The wheel is handed pictures, names and colours rather than kinds of ping. That is what lets one wheel offer both the calls a player can make about the world and the answers they can give to somebody else's ping, without the wheel being told which of the two it is showing.

<details class="gb-toggle">

<summary>What a slot widget is given</summary>

Each slot is handed the picture, name and colour of its call, and is told when it becomes the one being reached for and when it stops. `Show` dresses the slot, and the look of a slot being reached for is a matter of the widget rather than of the class.

A slot drawn with a material is handed the picture and the colour as parameters, which is what sets the picture off against the slice beneath it, since that slice wears the call's own colour while it is being pointed at. A slot drawn with a plain picture is drawn flat instead.

</details>

> [!WARNING]
> On a gamepad the pointer returns to the middle when the stick is released. Releasing the stick before the button therefore clears the chosen call, and the press falls back to a contextual ping.

***

## Answering somebody else's ping

A ping aimed at a ping already standing is not a second mark. It is a response: a player saying something back about what a teammate called.

A response is a position rather than a message. A player holds one at a time on any given ping, and saying the same thing twice takes it back, so the wheel does not need a "take it back" call and there is no way to stack agreement with yourself.

Three answers ship: confirm, decline and hold on. One of them is marked as the default, which is what a plain press on a teammate's ping gives; naming a call on the wheel gives that one instead.

| Field              | What It Means                                                                   |
| ------------------ | ------------------------------------------------------------------------------- |
| `ResponseType`     | The tag naming this answer                                                       |
| `Icon`             | The picture it is drawn with                                                     |
| `Colour`           | The colour it comes out in                                                       |
| `DisplayName`      | What the answer is called                                                        |
| `RespondedSound`   | What is heard when somebody gives it                                             |
| `bIsDefault`       | Whether a plain press gives this answer                                          |
| `bRefreshesPing`   | Whether giving it puts the ping's life back to full                              |

`bRefreshesPing` is how agreement keeps a call alive. A ping several players have confirmed stays up while they act on it, rather than expiring because nobody re-pinged it.

Several players giving the same answer are shown as that one answer with a count rather than as the answer repeated, so a ping everybody agreed with stays as readable as a ping one player agreed with.

### What has to be true

Answering is held to four things, checked on the server:

* The player's reported look could have reached the ping.
* The ping is one that player has actually been shown.
* The ping is not their own, since agreeing with yourself says nothing.
* The player is past the answer cooldown.

***

## Taking your own ping back

A ping of a player's own comes down when they aim at it and press, since saying the same thing twice about the same place says nothing the first saying did not.

Holding the button on a mark of their own therefore offers the kinds of ping rather than the answers, since an answer is not theirs to give. If they aim at their own ping and name a different call on the wheel, they are saying something else about that place instead. The old mark is then replaced rather than taken down and a new one put up, so it counts as the one change it is and is not charged twice against what they are allowed.

<details class="gb-toggle">

<summary>What counts as aiming at a ping</summary>

Which ping a player meant is settled where the marks are drawn, on their own machine, so the server only asks whether the one they named was somewhere their look could have reached. It asks that of the look exactly as reported, where it began as well as which way it ran, because a look measured from one place along a line drawn from another points at nothing in particular. How far that look was allowed to reach has already been settled against where the server has the player standing.

A mark resting under the crosshair is pointed at. So is a mark carried by what it marks, meaning a ping of a kind with `bFollowsTarget` set, since such a mark is about that thing wherever it has gone and the thing therefore stands for the mark. Aiming at an opponent reaches the ping on them even where the mark itself has drifted off the crosshair.

A mark that stays where it was put is reached only under the crosshair. It is about that place alone, and the floor or wall it was placed against reaches far past the place pinged, so pointing at that same floor somewhere else entirely does not reach it.

A player standing on top of a ping is treated as looking at it from every direction at once rather than from none.

</details>
