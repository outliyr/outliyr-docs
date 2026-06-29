# Default Scoring Logic

The `UShooterScoring_Base` component provides foundational scoring functionality out-of-the-box, handling common events like eliminations and assists using Gameplay Tags for tracking. This page details the default behavior you get simply by adding the base component to your GameState.

### Initialization (`BeginPlay`)

When the component begins play on the **server** (`HasAuthority()` is true), it automatically registers listeners with the `UGameplayMessageSubsystem` for two key events:

```cpp
// Inside UShooterScoring_Base::BeginPlay()
if(HasAuthority())
{
    UGameplayMessageSubsystem& MessageSubsystem = UGameplayMessageSubsystem::Get(this);
    // Listen for player eliminations
    MessageSubsystem.RegisterListener(ShooterScoringBase::TAG_Lyra_Elimination_Message, this, &ThisClass::OnEliminationMessage);
    // Listen for assists on eliminations
    MessageSubsystem.RegisterListener(ShooterScoringBase::TAG_Lyra_Assist_Message, this, &ThisClass::OnAssistMessage);
}
```

* **`Lyra.Elimination.Message`:** This message is typically broadcast when a player is eliminated (e.g., health reaches zero). The component's `OnEliminationMessage` function will be called.
* **`Lyra.Assist.Message`:** This message is broadcast by the `UEliminationAssistProcessor` (if active) when a player qualifies for an assist on an elimination. The component's `OnAssistMessage` function will be called.

This setup ensures the component is ready to react to these core gameplay events without requiring manual registration in each game mode.

### Elimination Handling (`OnEliminationMessage_Implementation`)

This is the default logic executed when the component receives a `Lyra.Elimination.Message`:

1.  **Team Comparison:** It uses the `ULyraTeamSubsystem` to compare the teams of the instigator (killer) and the target (victim) involved in the elimination message (`Payload`). This determines if it was a kill against an enemy, a teammate (friendly fire), or potentially a self-elimination.

    ```cpp
    ULyraTeamSubsystem* TeamSubsystem = GetWorld()->GetSubsystem<ULyraTeamSubsystem>();
    // ... null check ...
    const ELyraTeamComparison TeamComparison = TeamSubsystem->CompareTeams(Payload.Instigator, Payload.Target, TeamIDA, TeamIDB);
    ```
2.  **Scoring Based on Comparison:** The default scoring logic only applies if the comparison results in `ELyraTeamComparison::DifferentTeams`.

    ```cpp
    if(TeamComparison == ELyraTeamComparison::DifferentTeams)
    {
        // --- Team Score ---
        // Adds +1 stack to the killer's team score tag
        TeamSubsystem->AddTeamTagStack(TeamIDA, ShooterScoringBase::TAG_ShooterGame_Score_Elimination, 1);

        // --- Individual Killer Score ---
        if(ALyraPlayerState* KillerPlayerState = Cast<ALyraPlayerState>(Payload.Instigator))
        {
            // Adds +1 stack to the killer's personal elimination score tag
            KillerPlayerState->AddStatTagStack(ShooterScoringBase::TAG_ShooterGame_Score_Elimination, 1);
        }

        // --- Individual Victim Score ---
        // Note: The original code snippet seems to cast Payload.Instigator again here,
        // which is likely a typo and should be Payload.Target. Assuming corrected logic:
        if(ALyraPlayerState* KilleePlayerState = Cast<ALyraPlayerState>(Payload.Target)) // Corrected to Target
        {
            // Adds +1 stack to the victim's personal death count tag
            KilleePlayerState->AddStatTagStack(ShooterScoringBase::TAG_ShooterGame_Score_Death, 1);
        }
    }
    // else: No default scoring for SameTeam or InvalidArgument/NoComparison
    ```

    * **Team Score:** The killer's team (`TeamIDA`) gets one point added to their score tracked by the `ShooterGame.Score.Eliminations` tag via the Team Subsystem.
    * **Killer Score:** The individual killer (`Instigator`) gets one point added to their personal stats tracked by the `ShooterGame.Score.Eliminations` tag on their `ALyraPlayerState`.
    * **Victim Deaths:** The individual victim (`Target`) gets one death added to their personal stats tracked by the `ShooterGame.Score.Death` tag on their `ALyraPlayerState`.
    * **Friendly Fire/Suicide:** The base implementation **does not** award points or penalties for team kills or self-eliminations.
3. **Hook Call:** After processing the potential score changes, it calls the virtual function `OnEliminationScored(TeamComparison)`, passing the result of the team comparison. This allows subclasses to react _after_ the default scoring is applied (covered in "Customization & Extension").

### Assist Handling (`OnAssistMessage_Implementation`)

This is the default logic executed when the component receives a `Lyra.Assist.Message`:

```cpp
void UShooterScoring_Base::OnAssistMessage_Implementation(FGameplayTag Channel, const FLyraVerbMessage& Payload)
{
    // --- Individual Assister Score ---
    if(ALyraPlayerState* AssisterPlayerState = Cast<ALyraPlayerState>(Payload.Instigator)) // Instigator of Assist message is the player getting the assist
    {
        // Adds +1 stack to the assister's personal assist score tag
        AssisterPlayerState->AddStatTagStack(ShooterScoringBase::TAG_ShooterGame_Score_Assist, 1);
    }
}
```

* **Scoring Rule:** The component simply finds the `ALyraPlayerState` of the player who earned the assist (`Payload.Instigator` of the assist message) and increments their personal assist count tracked by the `ShooterGame.Score.Assists` tag.

### Gameplay Tags Used

The default logic relies on the following Gameplay Tags for tracking stats:

* **`ShooterGame.Score.Eliminations`:** Used for both team score and individual player eliminations.
* **`ShooterGame.Score.Death`:** Used for individual player deaths.
* **`ShooterGame.Score.Assists`:** Used for individual player assists.

These tags must exist in your project's Gameplay Tag list. The accumulated stacks on these tags on the `ALyraPlayerState` and `ULyraTeamSubsystem` can then be read by UI elements (like scoreboards) or other game systems.

### Summary

The base `UShooterScoring_Base` provides a solid foundation by automatically listening for eliminations and assists and applying standard scoring rules for enemy kills, player deaths, and assists using Gameplay Tag stacks. It explicitly ignores friendly fire/suicides in its default calculations. This baseline allows developers to focus on mode-specific rules and win conditions by subclassing the component and utilizing the provided hooks, which will be discussed next.

***
