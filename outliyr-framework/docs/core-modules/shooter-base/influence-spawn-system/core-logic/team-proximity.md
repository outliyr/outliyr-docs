# Team Proximity

This component of the spawn bias score aims to influence spawn locations based on the positions of the player's teammates, distinguishing between those who are alive and those who have recently died.

### Goal

The primary goals are:

1. **Encourage Team Cohesion:** Gently favor spawning closer to living teammates to facilitate regrouping and mutual support.
2. **Avoid Danger Zones:** Penalize spawning near locations where teammates have recently been eliminated, as these areas might still be contested or dangerous.

### Mechanism within `CalculateSpawnBias`

During the iteration through the `GameState->PlayerArray`, the code checks if the `APlayerState` (`PS`) belongs to the same team as the spawning `Player`:

```cpp
// Inside CalculateSpawnBias loop...
if (APawn* Pawn = PS->GetPawn())
{
    float Distance = PlayerStart->GetDistanceTo(Pawn);
    if (TeamId == PlayerTeamId) // Teammate found
    {
        // Check if teammate is dead or alive
        if(IsPlayerDead(PS))
        {
            // Apply NEGATIVE bias for dead teammate
            SpawnBias -= DeadTeammateDistanceWeight / FMath::Max(Distance, 1.0f);
        }
        else
        {
            // Apply POSITIVE bias for living teammate
            SpawnBias += TeammateDistanceWeight / FMath::Max(Distance, 1.0f);
        }
    }
    // ... (else clause handles enemies) ...
}
```

### Distinguishing Living vs. Dead Teammates (`IsPlayerDead`)

To apply the correct bias, the system needs to know if a teammate is currently alive or dead. This is done via the `IsPlayerDead` helper function:

```cpp
bool UShooterPlayerSpawningManagmentComponent::IsPlayerDead(APlayerState* PlayerState) const
{
    if(ALyraPlayerState* LyraPlayerState = Cast<ALyraPlayerState>(PlayerState))
    {
        if(ULyraAbilitySystemComponent* ASC = LyraPlayerState->GetLyraAbilitySystemComponent())
        {
            // Checks if the Player State's ASC has the Status_Death tag
            return ASC->HasMatchingGameplayTag(LyraGameplayTags::Status_Death);
        }
    }
    return false; // Assume alive if checks fail
}
```

This function checks if the teammate's Ability System Component has the `Status.Death` Gameplay Tag, which is typically applied by the death handling logic (like the `GA_killcam_Death` ability mentioned in [Killcam](../../kill-cam/) or a standard Lyra death ability).

### Bias Calculation Formulas

The influence is inversely proportional to the distance, meaning closer teammates have a stronger effect (positive or negative) on the score.

1. **Living Teammates:**
   * **Formula:** `SpawnBias += TeammateDistanceWeight / FMath::Max(Distance, 1.0f);`
   * **Effect:** Adds to the score. The contribution decreases as the distance increases. `FMath::Max(Distance, 1.0f)` prevents division by zero if the distance is extremely small. `TeammateDistanceWeight`(`100.0f`) acts as a scaling factor for the positive influence.
   * **Result:** Spawn points closer to living teammates receive a higher bias score.
2. **Dead Teammates:**
   * **Formula:** `SpawnBias -= DeadTeammateDistanceWeight / FMath::Max(Distance, 1.0f);`
   * **Effect:** Subtracts from the score. The penalty decreases as the distance increases. `DeadTeammateDistanceWeight`(`50.0f`) scales the negative influence (currently half as strong as the positive influence from a living teammate at the same distance in this example).
   * **Result:** Spawn points closer to where teammates died receive a lower bias score, making them less likely to be chosen.

### Role of Weight Properties

The class defines `UPROPERTY` members like `TeammateDistanceWeight` and `DeadTeammateDistanceWeight`. These properties allow designers to easily tune the relative importance of living vs. dead teammate proximity via configuration.

By considering both living and dead teammates, this part of the bias calculation helps guide players towards potentially safer and more strategically relevant spawn locations relative to their team's current situation.

***
