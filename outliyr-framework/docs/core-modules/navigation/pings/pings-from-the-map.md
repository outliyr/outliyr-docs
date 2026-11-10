# Pings from the Map

A player with the map screen open can right-click a place on it to mark that place for their side. It is the same kind of mark a ping in the world makes, so it shows on the minimap, the compass, the map screen and over the world without anything new to draw it.

What changes is how the server decides whether to allow it. A ping in the world is about where the player is looking, and the server checks that look. A ping from the map has no look to check, because its point is to mark somewhere the player cannot see.

***

## What the server checks instead

A ping in the world is held to how far the player could reach. That rule cannot apply to the map: limiting a map ping to the player's range would rule out the reason to use one.

A ping from the map is held to the map instead. The map's picture covers a known stretch of the world, the server knows that stretch as well as the client does, and every place on it is one the player could legitimately have clicked. The client names a point inside that stretch and nothing else.

| Checked                  | Against                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Whether there is a map   | The level has a map, and the map covers some ground and has at least one floor          |
| Whether the place is on it | The point falls on the map's picture, measured the same way the picture is drawn        |
| Which floor it is on     | The floor the map was showing exists, or the map was showing no floor in particular     |
| Where the ground is      | The server's own trace straight down through that floor                                  |

There is no range check, deliberately. A place nine kilometres away on a large map is as good as one beside the player.

Every ping the server turns down is logged on `LogNavigationFeature` at Verbose, saying where on the map it was asked for and on which floor.

***

## The server finds the height

The client sends a point on the ground and the floor the map was showing. It does not send a height, since a height is something the server can find for itself.

The server traces straight down through the band of heights that floor covers, from the top of the band to the bottom, and places the ping where the trace first strikes. On a level with floors above one another, that is what puts the ping on the storey the player was looking at rather than on the roof above it.

Where the map was showing no floor in particular, the trace runs through every floor at once and the ping lands on whatever stands highest. This is the case for a player above every floor, such as one still in the air before a drop.

Where the trace strikes nothing, no ping is placed. A mark there would stand in the air or underneath the level.

{% hint style="info" %}
The trace uses the ability's `TraceChannel`, `Visibility` by default. Ground a player can see from above but which does not block that channel is ground a map ping passes straight through.
{% endhint %}

***

## Kept apart from pings in the world

The kind of ping placed is `DA_Ping_Map`, which looks like a ping of a place and is placed on a channel of its own. A player who has marked one place by looking at it and another on the map keeps both.

On the same channel, marking a place on the map would take down the place the player had marked in the world, which would look to the player as though the game had lost a ping. Every other limit applies as normal. The map ping has its own count and cooldown, and it counts towards the rate across every kind like any other ping.

***

## Setting it up

`GA_MapPing` is granted alongside `GA_Ping` in `AbilitySet_Ping`, so any mode that asks for pings already has it. It is granted with no input tag, because the map raises it directly.

A screen takes input ahead of the game while it is open, so a key bound for the game is not heard over the map. Instead of answering a key, the map sends the `Navigation.Event.MapPing` gameplay event carrying the place and the floor, and the ability is triggered by that event. The map sends the event on its own behalf and needs nothing set up on it.

| Set On                | Field           | What It Does                                                                 |
| --------------------- | --------------- | ---------------------------------------------------------------------------- |
| `GA_MapPing`          | `PingKind`      | The kind of ping placed                                                       |
| `GA_MapPing`          | `TraceChannel`  | What the downward trace for the ground is stopped by                          |
| The fullscreen map    | `bPointerPings` | Whether a right-click marks the place under the pointer                       |
| The fullscreen map    | `OnPingAsked`   | Raised as a place is asked for, for a sound or a flash under the pointer      |

`OnPingAsked` is raised when the ping is asked for, not when it is placed, because the server may still turn it down. It suits immediate feedback under the pointer. It does not confirm that a mark went down; the mark arriving does that.

Right-click is used because the left button already drags the map. `PingAt` takes a point in the view and asks for the place there, so a widget can mark places by any other means it has.

{% hint style="warning" %}
Pinging from the map needs a pointer, so a player on a gamepad cannot do it yet. A map driven by a stick needs a cursor of its own or a way to step between places, which is a feature of its own.
{% endhint %}

Places only, never things. A right-click over a marker on the map marks the ground beneath it, and does not ping or answer whatever that marker stands for.
