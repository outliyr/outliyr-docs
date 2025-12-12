# Team Tags

The `ULyraTeamSubsystem`, in conjunction with the `ALyraTeamInfoBase` actors, provides a mechanism for associating **replicated Gameplay Tag stacks** with entire teams. This allows for storing and querying team-wide state information or applying team-level buffs/debuffs tracked via tags.

### Purpose

* **Team-Wide State:** Store information relevant to the whole team (e.g., number of flags captured, status effects affecting the team, control point ownership).
* **Gameplay Logic Triggering:** Use team tags as conditions or triggers for team-based objectives, scoring, or special events.
* **Team Buffs/Debuffs:** Apply gameplay effects to entire teams based on the presence or count of specific tags.

### Implementation: `FGameplayTagStackContainer` on `ALyraTeamInfoBase`

* Each `ALyraTeamInfoBase` actor (both Public and Private variants typically exist per team) contains a replicated property:
  * `TeamTags` (`FGameplayTagStackContainer`, Replicated)
* This container works identically to the `StatTags` container found on `ULyraInventoryItemInstance`, allowing you to associate integer counts (stacks) with Gameplay Tags.
* Changes made to this container on the server are replicated to clients (respecting actor relevancy and replication settings).

### Managing Team Tags (via `ULyraTeamSubsystem`)

While the data is _stored_ on the `ALyraTeamInfoBase` actors, modifications and queries are typically funneled through the `ULyraTeamSubsystem` for convenience and centralized logic.

**Modification Functions (Authority Only):**

These functions find the appropriate `ALyraTeamInfoBase` actor for the given `TeamId` and modify its `TeamTags` container. They include logging for failures (e.g., invalid Team ID, called on client, Team Info actor not spawned yet).

*   `AddTeamTagStack(int32 TeamId, FGameplayTag Tag, int32 StackCount)`

    * Adds `StackCount` to the specified `Tag` for the given `TeamId`. Creates the tag if it doesn't exist.

    <img src=".gitbook/assets/image (10) (1) (1).png" alt="" width="375" title="">
*   `RemoveTeamTagStack(int32 TeamId, FGameplayTag Tag, int32 StackCount)`

    * Removes `StackCount` from the specified `Tag` for the given `TeamId`. Removes the tag entirely if the count reaches zero or less.

    <img src=".gitbook/assets/image (12) (1) (1).png" alt="" width="375" title="">

**Query Functions (Client & Server):**

These functions find the relevant `ALyraTeamInfoBase` actor(s) and query their `TeamTags` container(s).

*   `GetTeamTagStackCount(int32 TeamId, FGameplayTag Tag) const`

    * Returns the total stack count for the `Tag` on the specified `TeamId`.
    * **Important:** It sums the counts from _both_ the Public and Private Team Info actors if they exist for that `TeamId`. This allows different systems to potentially write to either public or private state while queries get the combined result.

    <img src=".gitbook/assets/image (13) (1) (1).png" alt="" width="375" title="">
*   `TeamHasTag(int32 TeamId, FGameplayTag Tag) const`

    * Checks if the `GetTeamTagStackCount` for the `Tag` on the specified `TeamId` is greater than 0.
    * Returns `true` if the team has at least one stack of the tag, `false` otherwise.

    <img src=".gitbook/assets/image (14) (1) (1).png" alt="" width="375" title="">

### Use Cases

* **Objective Tracking:**
  * Add `Team.Objective.FlagCarrier` tag when a team member picks up the flag.
  * Add stacks to `Team.Objective.ControlPointCaptured` for each point held.
  * Check `TeamHasTag(TeamId, TAG_Team_State_VictoryConditionMet)`.
* **Team Buffs:**
  * Apply a Gameplay Effect to the _team actor_ (`ALyraTeamInfoBase`) that grants a tag like `Team.Buff.DamageBoost`.
  * Player abilities or damage calculations query the subsystem: `if (TeamSubsystem->TeamHasTag(MyTeamId, TAG_Team_Buff_DamageBoost)) { ... apply boost ... }`.
* **Resource Counting:**&#x20;
  * Use `AddTeamTagStack` / `RemoveTeamTagStack` with a tag like `Team.Resource.Scrap` to track shared team resources.
  * Track team kills and deaths with tags like `Team.Score.eliminations`.

### Example (Conceptual)

<!-- tabs:start -->
#### **Blueprint**
Update the the number of bombs defused for the player and the team in search and destroy game mode.

<img src=".gitbook/assets/image (15) (1) (1).png" alt="" title="">


#### **C++**
```cpp
// --- In a Resource Collection Component (Server) ---
void UResourcePickup::OnCollectedByPlayer(AController* CollectingPlayer)
{
    if (!CollectingPlayer)
    {
        return;
    }

    // Get team ID for the player
    ULyraTeamSubsystem* TeamSubsystem = GetWorld()->GetSubsystem<ULyraTeamSubsystem>();
    ULyraTeamAgentInterface* TeamAgent = Cast<ULyraTeamAgentInterface>(CollectingPlayer->GetPawn());

    if (TeamSubsystem && TeamAgent)
    {
        const int32 TeamId = TeamAgent->GetTeamId();

        // Add resource tag stack to team
        TeamSubsystem->AddTeamTagStack(TeamId, TAG_Team_Resource_Scrap, 1);
    }

    // Destroy the pickup
    Destroy();
}

// --- In a Scoring Component (Server/Client Query) ---
void UScoringComponent::UpdateTeamScore(int32 TeamId)
{
    ULyraTeamSubsystem* TeamSubsystem = GetWorld()->GetSubsystem<ULyraTeamSubsystem>();
    if (TeamSubsystem)
    {
        int32 PointsHeld = TeamSubsystem->GetTeamTagStackCount(TeamId, TAG_Team_Objective_ControlPointCaptured);
        // ... 
        
        update score based on PointsHeld ...
    }
}
```



<!-- tabs:end -->

***

Team Tags provide a flexible, replicated mechanism for managing shared state or status effects associated with an entire team. By leveraging the `FGameplayTagStackContainer` on the `ALyraTeamInfoBase` actors and interacting via the `ULyraTeamSubsystem`, you can build sophisticated team-based gameplay logic and track team-wide conditions.
