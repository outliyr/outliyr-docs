# Kinds of Ping

A kind of ping is a `UPingDefinition` data asset. It says what the kind fits, what it is drawn with, how long it lasts, who sees it and how many of it a player may have out. Adding a call to a game is authoring one of these and listing it on the ability, not writing code.

***

## What a kind fits

When the server is deciding from context rather than from a wheel, it tries the kinds in the order the ability lists them and places the first that fits. A kind that fits anything therefore belongs last, as a fallback.

| Field                 | What It Means                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `TargetRelation`      | What the thing has to be to the player pinging it                                         |
| `RequiredTargetTags`  | Tags the thing must carry                                                                 |
| `BlockedTargetTags`   | Tags that rule the thing out                                                              |
| `TargetClasses`       | Classes the thing may be                                                                  |

| Relation    | Fits                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `Anything`  | Whatever was pinged, a bare place included                               |
| `Ally`      | Only something on the pinger's own team                                   |
| `Enemy`     | Only something on another team                                           |
| `Teamless`  | Only something on no team, which includes a ping that reached nothing     |

A kind with nothing set under any of these fits everything, which is exactly what the fallback kind wants.

***

## What a kind is drawn with

| Field                | What It Means                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `Icon`               | The picture the ping is drawn with                                                               |
| `Colour`             | The colour it comes out in, on the mark, the map and the feed alike                              |
| `DisplayName`        | What the call is named                                                                           |
| `bNameDrawnInWorld`  | Whether that name is written beside the mark standing in the world                               |
| `IndicatorWidget`    | The widget that draws the mark over the world                                                    |
| `IndicatorOffset`    | How far above the place the mark is drawn                                                        |
| `TetherLength`       | How long a line is drawn from the mark down to what it marks, or nothing for no line             |
| `PlacedSound`        | What is heard when the ping goes up                                                              |

`bNameDrawnInWorld` is worth a thought per kind. A name is useful on a call that says something the player could not otherwise tell, and noise on a general location mark that would only ever read "Here".

### Borrowing the look of the thing pinged

With `bTakesLookFromTarget` set, a ping takes its picture and name from the thing it marked rather than from the kind. A thing says what it looks like by implementing the `PingDescribable` interface, which is how pinging an item names that item instead of calling it an item.

A thing that will not describe itself, and a ping that reached nothing at all, leave the kind wearing its own look.

***

## How long it lasts, and what it becomes

| Field              | What It Means                                                                          |
| ------------------ | -------------------------------------------------------------------------------------- |
| `Lifetime`         | How long the ping lasts before it goes of its own accord                                |
| `SettlesInto`      | A kind whose look this one takes on after a while, or nothing to keep its own           |
| `ArrivalDuration`  | How long this kind's own look is held before it settles                                 |

Settling replaces the whole look: the picture, the colour and the name all come from the kind settled into. It suits a set of kinds saying different things about the same place, where the difference matters at the moment of the call and the mark afterwards is simply a mark. Who may see the ping and how long it lasts stay with the kind it was placed as.

{% hint style="warning" %}
Settling is all or nothing, so a kind that settles loses its own name as well as its own picture. A call whose name is the point of it, such as one naming an opponent or saying what a player means to do, usually wants to keep its look for its whole life.
{% endhint %}

### Following and centring

| Field               | What It Means                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `bFollowsTarget`    | Whether the ping moves with whatever it marked                                                    |
| `bCentresOnTarget`  | Whether the ping stands in the middle of the thing rather than where the player's aim landed      |

A ping about a thing belongs on that thing, which is what both of these are for. A ping that reached no actor at all stays where it was aimed whatever they say, and a ping is only moved to the middle of something the call could actually have been made about, so a call about an opponent made while pointing at the ground is about the ground the player pointed at.

The middle is taken across the parts of the actor that can be struck rather than from where the actor stands, since what stands at an actor's own place is up to whoever built it and is as often its feet as its middle.

***

## Who sees it and how many stand

| Field                 | What It Means                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `Audience`            | Who the ping is shown to, the same three choices a marker has                                      |
| `PingType`            | The tag naming this kind                                                                           |
| `ReplacementChannel`  | The channel this kind counts against                                                               |
| `MaxAtOnce`           | How many of that channel may stand at once                                                         |
| `Cooldown`            | How long a player waits between two pings of that channel                                          |
| `bRepingRefreshes`    | Whether pinging the same place again refreshes the ping rather than placing a second                |
| `SamePlaceDistance`   | How close counts as the same place                                                                 |
| `bShownInFeed`        | Whether this kind reaches the feed                                                                 |
| `FeedLine`            | How the feed words it                                                                              |
| `MarkerClass`         | The actor the ping stands as, for a kind that needs one of its own                                 |

Channels are what let several kinds share a limit. Kinds left on the same channel push one another out, which is how a set of calls about places can hold one mark between them while a call about an opponent holds its own. The counting itself is covered on [Limits and Authority](limits-and-authority.md).

{% hint style="info" %}
`FeedLine` is wording, not a sentence to be assembled in code. A kind placed in a run is shown as one line carrying a count, so the wording needs to read correctly with a number beside it.
{% endhint %}

***

## The kinds that ship

Nine kinds ship with the plugin, which between them cover the shapes a call takes rather than the calls a particular game needs.

| Kind       | Says                                                                | Shape It Shows Off                                                            |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Location   | "Here", as the fallback when nothing more specific fits              | A kind that fits anything, placed last                                        |
| Enemy      | "Enemy", fitting only somebody on another team                       | A short lived call that follows what it marked, with several allowed at once   |
| Item       | The item's own name                                                  | A kind that borrows its look from the thing pinged                            |
| Trace      | "Somebody's been here"                                               | A long lived call about a place rather than a thing                           |
| Going      | "Going here"                                                         | Intent, and the shared channel below                                         |
| Attacking  | "Attacking here"                                                     | Intent                                                                        |
| Defending  | "Defending here"                                                     | Intent                                                                        |
| Looting    | "Looting here"                                                       | Intent                                                                        |
| Watching   | "Watching here"                                                      | Intent                                                                        |

The five intent kinds all count against one `Navigation.Ping.Location` channel holding a single mark, so a player saying they are defending somewhere takes down their own "going here" rather than standing both. Location, Enemy, Item and Trace each count on their own.

{% hint style="info" %}
These are proof that the kinds work, not the set a game has to use. A game with its own vocabulary authors its own assets and lists them; nothing in the plugin refers to any kind by name.
{% endhint %}
