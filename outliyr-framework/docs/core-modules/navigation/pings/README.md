# Pings

A ping is a player pointing at something and their side being told what it was. One key does it, and what comes out depends on what they were looking at: an opponent, a teammate, an item, a place. Holding that same key opens a wheel of the calls they can make instead, for when the contextual answer is not the one they want.

A ping is an actor standing in the world. That is the whole of what it has to do to reach the minimap, the compass, the map screen and the view of the world itself, because all four already draw whatever carries a [marker](../markers.md).

***

## The journey of a ping

Where a player is looking is known only on their own machine, so that is where the call starts and the server is what decides what it meant.

1. **The player's machine finds the look.** The ping ability traces from the camera along the player's aim and keeps the whole hit result, where the trace began and which way it ran. If the wheel was open, which call the player reached for travels with it.
2. **It is sent as target data.** The look and the chosen call go together, because neither means anything without the other.
3. **The server traces along the same line itself.** It follows the reported look exactly as given, both where it begins and which way it runs, but it finds what stands along that line for itself. A client can only name what was replicated to it, and ground and walls are replicated to nobody.
4. **The server checks how far it reached.** The place found is measured against where the server has the player standing, and anything beyond the ability's range plus `AcceptedError` is turned down and logged.
5. **The server decides what kind of ping it is.** If the player named a call on the wheel, that call is placed as asked. Otherwise the kinds are tried in order and the first that fits whatever was actually there is used.
6. **The ping is placed, or it answers one already there.** A ping aimed at one of the player's own marks replaces it; a ping aimed at somebody else's becomes an [answer](the-wheel-and-answers.md) to it.
7. **It is placed only if the player is allowed.** Each kind's own count and cooldown, and a rate across every kind at once, are checked before the ping goes up.

{% hint style="success" %}
A client never says what kind of ping it is making from context, only where it was looking and which call it reached for. That is what stops a modified client passing a wall off as an opponent.
{% endhint %}

***

## What the ability holds

`UGameplayAbility_Ping` is granted through an ability set, so which players can ping at all is a mode's decision.

| Field            | What It Means                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `PingKinds`      | The kinds to try, in order, when deciding from context. A kind that fits anything belongs last               |
| `ResponseKinds`  | The answers a player can give to somebody else's ping                                                        |
| `WheelKinds`     | The calls offered on the wheel, in slot order                                                                |
| `WheelWidget`    | The wheel to open                                                                                            |
| `WheelHoldTime`  | How long the key is held before the wheel opens rather than the press being a ping                            |
| `MaxRange`       | How far a ping may reach                                                                                     |
| `TraceChannel`   | The channel the look is traced on                                                                            |
| `TraceRadius`    | How thick that trace is, so a player need not be pixel accurate                                              |
| `AcceptedError`  | How much further than the range a reported place may be before it is turned down                             |

`PingKinds` and `WheelKinds` are separate lists on purpose. The contextual list is ordered by how specific each kind is, since the first that fits wins. The wheel's list is ordered by where each call sits on the ring, and a call keeps its slot for as long as the wheel offers it so a player who knows the wheel can reach a call without reading it.

***

## Where to go next

| Page                                                       | What It Covers                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [**Kinds of Ping**](ping-kinds.md)                         | The definition asset: what a kind fits, what it is drawn with, how long it lasts, and settling into another kind  |
| [**The Wheel and Answers**](the-wheel-and-answers.md)      | Holding the key, how a call is chosen, and answering somebody else's ping                                        |
| [**Limits and Authority**](limits-and-authority.md)         | Counts, cooldowns, the rate across kinds, taking a ping back, and who a ping is replicated to                     |
| [**Pings from the Map**](pings-from-the-map.md)             | Marking a place on the map screen, held to the map rather than to range, with the server finding the ground      |
| [**Presentation**](presentation.md)                         | The mark drawn over the world, the feed, and the Blueprint hooks a widget binds                                   |
