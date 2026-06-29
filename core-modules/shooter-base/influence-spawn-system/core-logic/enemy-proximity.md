# Enemy Proximity

A primary goal of any intelligent spawn system is to prevent players from spawning too close to opponents, which often leads to immediate death and frustration. The Influence Spawn System addresses this by applying a negative bias based on proximity to enemy players.

### Goal

* **Increase Spawn Safety:** Actively penalize spawn points that are located near known enemy positions.
* **Prevent Immediate Engagements:** Give the spawning player a slightly better chance to orient themselves before potentially entering combat.

### Mechanism within `CalculateSpawnBias`

Continuing within the loop iterating through the `GameState->PlayerArray`, after checking for teammates, the code handles players identified as enemies:

```cpp
// Inside CalculateSpawnBias loop...
if (APawn* Pawn = PS->GetPawn())
{
    float Distance = PlayerStart->GetDistanceTo(Pawn);
    if (TeamId == PlayerTeamId) // Teammate
    {
        // ... (Teammate logic as discussed previously) ...
    }
    else // Enemy found
    {
        // Apply NEGATIVE bias for enemy proximity
        SpawnBias -= EnemyDistanceWeight / FMath::Max(Distance, 1.0f);
    }
}
```

* **Team Check:** The `else` condition executes when the `TeamId` of the `APlayerState` (`PS`) being checked is _different_ from the `PlayerTeamId` of the player attempting to spawn.
* **Distance Calculation:** It calculates the Euclidean distance between the potential spawn point (`PlayerStart->GetActorLocation()`) and the enemy's current pawn location (`Pawn->GetActorLocation()`).

### Bias Calculation Formula

Similar to the teammate bias, the enemy proximity influence uses a formula inversely proportional to distance, but applies it as a penalty:

* **Formula:** `SpawnBias -= EnemyDistanceWeight / FMath::Max(Distance, 1.0f);`
* **Effect:** Subtracts from the `SpawnBias` score. The closer the enemy, the larger the subtraction (penalty). The penalty diminishes rapidly as the distance increases. `FMath::Max(Distance, 1.0f)` prevents division by zero. `EnemyDistanceWeight` (`100.0f`) acts as a scaling factor for this negative influence.
* **Result:** Spawn points closer to enemies receive a significantly lower bias score, making them much less likely to be selected compared to points further away from detected enemies.

### Role of Weight Property (`EnemyDistanceWeight`)

The class defines a `UPROPERTY` named `EnemyDistanceWeight`. This property provides designers with a configurable multiplier to adjust the importance or strength of the enemy proximity penalty relative to other factors (like teammate proximity or FOV).

This enemy proximity check is a fundamental part of the system's safety mechanism. It works in conjunction with the Enemy Line of Sight check (discussed next) to create zones of negative influence around opponents, pushing spawns towards safer locations.

***
