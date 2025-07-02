# Agent Management & Queries

Once teams are registered via their `ALyraTeamInfoBase` actors, the `ULyraTeamSubsystem` provides the core functionality for determining which team an actor belongs to, changing an actor's team affiliation, and comparing the relationship between different actors.

### Finding an Actor's Team

The primary function for determining affiliation is `FindTeamFromObject`.

* `FindTeamFromObject(const UObject* TestObject) const` (**C++ Only**)
  * **Action:** Attempts to determine the integer Team ID associated with the provided `UObject`.
  * **Logic Hierarchy:** It checks the `TestObject` in the following order:
    1. **`ILyraTeamAgentInterface`:** Casts the `TestObject` to the team agent interface. If successful, it calls `GetGenericTeamId()` and converts the result to an `int32` (returning `INDEX_NONE` for `FGenericTeamId::NoTeam`). This is the most direct way for actors like Player States or Pawns to report their team.
    2. **Instigator:** If the `TestObject` is an `AActor` and the first step failed, it checks if the actor has an `Instigator`. If so, it recursively calls `FindTeamFromObject` on the `Instigator`. This allows projectiles or effects to inherit the team of their firer.
    3. **`ALyraTeamInfoBase`:** If the `TestObject` is itself one of the Team Info actors (`ALyraTeamInfoBase` or its subclasses), it directly returns the `TeamId` stored within that actor.
    4. **Associated `ALyraPlayerState`:** If the `TestObject` is an `AActor` (like a Pawn or Controller), it calls the helper `FindPlayerStateFromActor`. If a valid `ALyraPlayerState` is found, it recursively calls `FindTeamFromObject` on the Player State (which should implement the `ILyraTeamAgentInterface`).
  * **Returns:** The `int32` Team ID if found, otherwise `INDEX_NONE`.
* `FindPlayerStateFromActor(const AActor* PossibleTeamActor) const`  (**C++ Only**)
  * **Action:** Helper function used by `FindTeamFromObject`. Tries to find the `ALyraPlayerState` associated with a given Actor.
  * **Logic:** Checks if the input actor is a Pawn (gets Player State via `GetPlayerState<ALyraPlayerState>`), a Controller (gets Player State via `PlayerState` property), or directly an `ALyraPlayerState`.
  * **Returns:** The found `ALyraPlayerState*` or `nullptr`.
* `FindTeamFromActor(const UObject* TestActor, bool& bIsPartOfTeam, int32& TeamId) const`
  * **Action:** Blueprint-callable wrapper around `FindTeamFromObject`.
  * **Output:** Sets `bIsPartOfTeam` (true if `TeamId != INDEX_NONE`) and `TeamId`.

<img src=".gitbook/assets/image (7) (1) (1).png" alt="" width="375" title="">

> [!success]
> Majority of the time you will use the `FindTeamFromObject`  static function below (which internally calls `FindTeamFromObject` form the `TeamSubSystem`) and passing in actor or object that has has the `ILyraTeamAgentInterface`

<img src=".gitbook/assets/image (6) (1) (1).png" alt="" width="375" title="">

### Comparing Team Affiliations

*   `CompareTeams(const UObject* A, const UObject* B, int32& TeamIdA, int32& TeamIdB) const`

    * **Action:** Determines the relationship between two objects based on their team IDs.
    * **Logic:**
      1. Calls `FindTeamFromObject` for both `A` and `B` to get `TeamIdA` and `TeamIdB`.
      2. If either `TeamIdA` or `TeamIdB` is `INDEX_NONE`, returns `ELyraTeamComparison::InvalidArgument`.
      3. If `TeamIdA == TeamIdB`, returns `ELyraTeamComparison::OnSameTeam`.
      4. Otherwise (valid IDs but different), returns `ELyraTeamComparison::DifferentTeams`.
    * **Output:** Returns the `ELyraTeamComparison` enum value and provides the resolved Team IDs via output parameters.

    <img src=".gitbook/assets/image (8) (1) (1).png" alt="" width="375" title="">
* `CompareTeams(const UObject* A, const UObject* B) const`  (**C++ Only**)
  * **Action:** Simpler version that doesn't return the specific IDs.
  * **Returns:** The `ELyraTeamComparison` enum value.

### Changing an Actor's Team (Authority Only)

* `ChangeTeamForActor(AActor* ActorToChange, int32 NewTeamId)`
  * **Authority:** This function can only be successfully called on the server or network authority.
  * **Action:** Attempts to change the team affiliation of the specified actor.
  * **Logic:**
    1. Converts the input `NewTeamId` (int32) to an `FGenericTeamId`.
    2. Tries to find the `ALyraPlayerState` associated with `ActorToChange`. If found, it calls `LyraPS->SetGenericTeamId(NewTeamID)`.
    3. If no Player State is found, it tries to cast `ActorToChange` directly to `ILyraTeamAgentInterface`. If successful, it calls `TeamActor->SetGenericTeamId(NewTeamID)`.
  * **Returns:** `true` if a team was successfully set on either the Player State or directly on the actor via the interface, `false` otherwise (e.g., the actor doesn't represent a team agent).
  * **Notification:** The actual `SetGenericTeamId` implementation within the Player State or other agent class is responsible for replicating the change and broadcasting the `OnTeamChangedDelegate` (using `ConditionalBroadcastTeamChanged`).

<img src=".gitbook/assets/image (9) (1) (1).png" alt="" width="375" title="">

### Damage Application Logic

* `CanCauseDamage(const UObject* Instigator, const UObject* Target, bool bAllowDamageToSelf = true) const`  (**C++ Only**)
  * **Action:** Determines if damage is permissible between an `Instigator` and a `Target` based on their team relationship and self-damage allowance.
  * **Logic:**
    1. Checks if `bAllowDamageToSelf` is true and if the instigator and target represent the same logical entity (direct pointer comparison or comparing associated Player States). If so, returns `true`.
    2. Calls `CompareTeams` to get the relationship between `Instigator` and `Target`.
    3. If `DifferentTeams`, returns `true`.
    4. If `InvalidArgument` (meaning the Target likely doesn't have a team), it currently includes a fallback check (`@TODO`) to allow damage if the target has an `AbilitySystemComponent` (intended for things like target dummies without explicit teams). This might need refinement based on specific game rules.
    5. If `OnSameTeam`, returns `false` (default behavior prevents friendly fire).
  * **Use Case:** Called by damage execution logic (e.g., in Gameplay Effect Execution Calculations or damage processing functions) to check for friendly fire or invalid targets before applying damage.

***

The `ULyraTeamSubsystem` acts as the central point for querying team relationships. By leveraging the `ILyraTeamAgentInterface` on actors and maintaining its own registry, it provides robust functions to determine affiliations, compare teams, and enforce basic gameplay rules like friendly fire checks. Remember that changing team assignments is an authority-only operation.
