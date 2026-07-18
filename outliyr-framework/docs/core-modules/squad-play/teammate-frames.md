# Teammate Frames

A squad plays as a unit, so every member's condition stays on screen: health, shields, downed, dead, each teammate in their own frame in a corner of the HUD. The interesting part is not the widget, it is where the data comes from. Teammates are frequently nowhere near each other, and a pawn that is not relevant to your client cannot be read directly. So the server samples every member into a compact snapshot on the squad's team info actor, and the frames only ever read that.

***

### The Squad Team Info

`ASquadTeamInfo` is a subclass of the team's private info actor, which is the piece of the [team model](../../base-lyra-modified/team/team-model.md) that replicates only to its own team's members. An experience opts in by pointing its team creation component's private team info class at it, covered in [Setup & Integration](setup-and-integration.md). That placement buys two things at once: every squad member receives the data no matter where their pawns are, and enemies receive nothing, so a squad's health states are not readable by the other side.

The same actor also owns the squad's [carried banners](redeploy.md#carried-by-the-squad-not-a-player) and the squad slot colors, so everything a squad shares that its enemies should not see lives in one replicated place.

***

### The Snapshot

The server refreshes a per-member status array on a short interval, reading each member's tracked resources and downed component directly. Each entry carries the member, one reading per tracked resource, and their downed and dead flags. Resource readings are identified by the attribute set they came from, not by array position, so a frame binds its health bar to the health set and its shield bar to the shield set without caring what order the server sampled them in.

Readings are quantized to a whole percentage before they are stored, which is what keeps the replication quiet: a value that has not visibly moved produces no traffic, and a member whose health is ticking down produces at most one small update per refresh. Discrete transitions do not wait out the sampling interval; the team info listens for the downed and elimination messages and refreshes immediately, so a frame flips to its downed state the moment the knock happens rather than up to a quarter second later.

<details>

<summary>The snapshot structures</summary>

```cpp
/** One resource reading, identified by the attribute set it came from. */
struct FSquadResourceValue
{
    TSubclassOf<ULyraResourceAttributeSet> ResourceSet; // the identity a frame keys its bar on
    uint8 Percent;                                      // zero to one hundred, quantized
};

/** Snapshot of one squad member, replicated to the squad. */
struct FSquadMemberStatus
{
    TObjectPtr<APlayerState> Player;
    TArray<FSquadResourceValue> Resources;  // one per tracked resource
    bool bIsDowned;
    bool bIsDead;
};
```

`GetMemberStatuses` returns the latest array, `GetMemberResourcePercent` pulls one reading out of a snapshot by attribute set, and `OnTeamStatusChanged` fires on server and clients whenever anything in the snapshot changes. `StatusRefreshInterval` controls the sampling rate.

Which resources are sampled is the `TrackedResources` array on the team info, health and shield by default. Adding another resource attribute set, a custom armor or stamina pool, surfaces it in every member's snapshot with no code change; binding a bar to it is covered in [Extending](extending.md).

</details>

***

### Squad Slots And Colors

Every member holds a stable slot in the squad, assigned on join and never reordered, so the color that identifies a player is the same for the entire match on every client. Frames, pings, and map markers all resolve a player's color through the same slot lookup, which is what keeps "the yellow teammate" meaning one person everywhere. A departing member's slot is freed and reused by the next joiner; existing members never shift.

The palette itself is a configurable list on the team info, wrapping when a squad outgrows it, with a fallback color for players who have no slot, such as before assignment has replicated. The shipped palette leaves red out so squad colors never collide with enemy and danger coloring.

<details>

<summary>Color and slot lookups</summary>

```cpp
int32 GetSlotForPlayer(const APlayerState* Player) const;   // INDEX_NONE for non-members
FLinearColor GetColorForSlot(int32 Slot) const;             // wraps the palette
FLinearColor GetColorForPlayer(const APlayerState* Player) const;

// Static, resolved through the player's own squad info; safe from any client for
// teammates, and returns the fallback for players whose info never replicates here.
static int32 GetSquadSlotForPlayer(const UObject* WorldContextObject, const APlayerState* Player);
static FLinearColor GetSquadColorForPlayer(const UObject* WorldContextObject, const APlayerState* Player);
```

</details>

***

### The Frame Widgets

The shipped UI is two widgets. `W_SquadTeammateFrames` is the container, added to the HUD layout at the `HUD.Slot.SquadMembers` slot; it finds the local player's squad info, listens to `OnTeamStatusChanged`, and maintains one child frame per member. `W_SquadTeammateFrame` is the single-member row: it binds its health and shield bars by attribute set through `GetMemberResourcePercent`, paints the member's squad color, and swaps its styling when the member's snapshot reports them downed or dead.

Because everything a frame shows comes off the snapshot, the widgets have no dependency on the members' pawns existing on this client. A teammate across the map, or one sitting dead in spectate, renders exactly as well as one standing next to you.

{% hint style="info" %}
The container finds its squad info through a lookup that returns null until the team info actor has replicated, so it retries rather than assumes. Custom squad UI should do the same: treat a null squad info as "not yet," not "never."
{% endhint %}
