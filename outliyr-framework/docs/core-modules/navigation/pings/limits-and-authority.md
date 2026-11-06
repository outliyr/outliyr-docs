# Limits and Authority

Pinging is cheap to do and easy to do constantly, so the interesting part of the system is what a player is *not* allowed. `UPingSubsystem` places every ping and holds each player to their allowance.

Placing is the server's to do. A client asks through the ability, and what arrives at the subsystem has already been checked.

***

## Three limits at once

| Limit            | Set On         | What It Holds                                                               |
| ---------------- | -------------------- | --------------------------------------------------------------------- |
| Channel count    | The kind             | How many pings of that channel may stand at once                      |
| Channel cooldown | The kind             | How long that player waits between two pings of that channel           |
| Rate             | The subsystem        | How many pings of any kind that player may place in a stretch of time   |

The rate is the one that matters most. Counts and cooldowns are per channel, so a player with several kinds available could otherwise alternate between them and ping as fast as they can click. `MaxPingsPerWindow` pings in `RateWindow` seconds is a limit across every channel at once, which closes that.

Each player's allowance is their own, so one player spending theirs leaves everybody else untouched.

### A full channel pushes, it does not refuse

When a channel is full, a further ping takes down the oldest one rather than being turned down. Marking a third place still says something, where a refusal would leave the player pressing a key that does nothing and wondering why.

Taking a ping back frees the place it held, so a player is not charged for a call they withdrew.

### Re-pinging the same place

With `bRepingRefreshes` set, pinging within `SamePlaceDistance` centimetres of a standing ping of that kind refreshes it rather than placing a second. Two marks on top of one another say nothing a brighter mark would not, and refreshing is what a player pressing the key again actually means.

***

## What the server checks

| Checked                              | Against                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Where the ping reached                | The ability's range plus `AcceptedError`, measured from where the server has the player standing |
| What was actually there              | The server's own trace along the reported look                                |
| Which kind of ping it is             | Decided from what that trace found, not from anything the client said         |
| Whether a named ping could be aimed at | `ClaimedAimAngle` degrees off the reported look, within `ResponseRange`      |
| Whether an answered ping was visible | Whether that player had actually been shown it                                 |

A client reports where it was looking, and nothing else. It never reports what it hit or what kind of call it is making from context, because a client can only name what was replicated to it, and ground and walls are replicated to nobody.

Every ping the server turns down is logged on `LogNavigationFeature` at Verbose, with what was found and what was made of it, since what a ping reached is not something a player can see. The category is silent in normal play.

{% hint style="info" %}
Raise it with `Log LogNavigationFeature Verbose` on the server to see what each ping struck, what relation it was to the player, and which kind it was placed as.
{% endhint %}

***

## Who a ping reaches

A ping's audience is its kind's to say, exactly as a marker's is. That decides what the views draw, but drawing is the second half of the problem: an actor a rival client receives is an actor a modified rival client can read, whatever the views choose to draw.

So a ping actor is also limited at the replication level. Where Iris is in use, the marker is replicated to the connections of the side that may see it and to nobody else, through `SetActorTeamOnly` on the team subsystem, so a rival client never learns the ping exists at all.

{% hint style="warning" %}
Where Iris is not in use, nothing is limited and the actor keeps reaching everyone. The ping still refuses to draw itself for a player it is not for, but its existence is readable. The framework ships with Iris on.
{% endhint %}

Pings arriving is a separate matter from pings being placed, because each machine learns of a ping at its own moment and only for the pings its own player is allowed. The subsystem announces arrivals locally, which is where the feed and anything else showing a player what has just been called listens.

***

## Asking the subsystem things

| Function                   | Answers                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `CanPlacePing`             | Whether a player could place a kind right now                           |
| `GetPings`                 | What one player has standing                                            |
| `CountPingsOfChannel`      | How many of a channel they have standing                                |
| `ClearPings`               | Takes down everything a player has out                                  |
| `ClearPingsOfChannel`      | Takes down one channel and leaves the rest standing                     |
| `GetPingUnderAim`          | The ping the local player is looking at, as the marks were drawn        |
| `FindPingOn`               | Whether something already carries a ping                                 |
| `WithdrawPing`             | Takes a ping down, but only for the player who placed it                 |

`ClearPingsOfChannel` is the one worth knowing about for mode content: clearing one channel leaves whatever stands outside it, so one kind of call going quiet at a round boundary does not take the rest of what a player has said with it.
