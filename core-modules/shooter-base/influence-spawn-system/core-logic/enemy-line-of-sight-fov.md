# Enemy Line of Sight (FOV)

While proximity to enemies is important, spawning directly within an enemy's field of view (FOV) is often even more dangerous. The Influence Spawn System incorporates a specific check to heavily penalize spawn points that fall within an enemy's likely line of sight.

### Goal

* **Prevent Instant Death:** Avoid placing the player directly in front of an enemy who is already looking in that direction.
* **Enhance Spawn Safety:** Add a stronger deterrent than distance alone for spawns that are potentially visible to opponents upon spawning.

### Mechanism: `CalculateEnemyFOVBias`

This dedicated function calculates the total negative bias contributed by _all_ enemies whose FOV potentially covers the spawn point. The main `CalculateSpawnBias` function then _subtracts_ this returned value from the total bias score.

```cpp
// Called from CalculateSpawnBias:
// float FOVBias = CalculateEnemyFOVBias(Player, PlayerStart);
// SpawnBias -= FOVBias;

float UShooterPlayerSpawningManagmentComponent::CalculateEnemyFOVBias(AController* Player, ALyraPlayerStart* PlayerStart) const
{
    float TotalFOVBias = 0.0f; // Accumulates the penalty from all enemies

    for (APlayerState* PS : GetWorld()->GetGameState()->PlayerArray)
    {
        // ... (Skip spectators, skip teammates, ensure pawn exists) ...
        if (TeamId != PlayerTeamId) // Check only Enemies
        {
            FVector EnemyViewLocation;
            FRotator EnemyViewRotation;
            // Get the viewpoint location and rotation of the enemy pawn
            PS->GetPawn()->GetActorEyesViewPoint(EnemyViewLocation, EnemyViewRotation);

            // Vector from enemy's eyes to the potential spawn point
            FVector DirectionToSpawn = (PlayerStart->GetActorLocation() - EnemyViewLocation).GetSafeNormal();
            // Forward direction vector of the enemy's view
            FVector EnemyViewDirection = EnemyViewRotation.Vector();

            // Calculate the dot product between the two vectors
            float DotProduct = FVector::DotProduct(DirectionToSpawn, EnemyViewDirection);
            // Convert configured FOV angle (degrees) to radians for cosine calculation
            float FOVRadians = FMath::DegreesToRadians(EnemyFOVAngle / 2.0f); // Use half angle

            // Check if the spawn point is within the FOV cone
            if (DotProduct > FMath::Cos(FOVRadians))
            {
                // Spawn point is within FOV - calculate penalty
                // Normalize score (0=edge of FOV, 1=directly ahead)
                float FOVScore = (DotProduct - FMath::Cos(FOVRadians)) / (1.0f - FMath::Cos(FOVRadians));
                TotalFOVBias += FOVBiasWeight * FOVScore; // Add scaled penalty
            }
        }
    }

    return TotalFOVBias; // Return the total accumulated penalty
}
```

### The FOV Check Explained

1. **Get Enemy Viewpoint:** For each enemy pawn, `GetActorEyesViewPoint` retrieves the location and rotation representing their view origin (usually the camera or head position).
2. **Direction Vectors:**
   * `DirectionToSpawn`: A normalized vector pointing from the enemy's eyes towards the potential spawn point.
   * `EnemyViewDirection`: A normalized vector representing the direction the enemy is currently looking (forward vector from their view rotation).
3. **Dot Product:** The dot product of these two normalized vectors yields the cosine of the angle between them.
   * If the vectors point in the same direction (spawn is directly ahead), the dot product is `1.0`.
   * If they are perpendicular, the dot product is `0.0`.
   * If they point in opposite directions, the dot product is `-1.0`.
4. **Angle Comparison:** The system compares the calculated `DotProduct` with the cosine of _half_ the configured `EnemyFOVAngle`.
   * **Why Cosine?** Comparing dot products directly is computationally cheaper than calculating the actual angle using `acos`. The cosine function decreases as the angle increases (from 0 to 180 degrees).
   * **Why Half Angle?** A standard FOV angle (e.g., 90 degrees) typically represents the _total_ width. The check needs to see if the angle between the forward vector and the direction-to-spawn vector is less than _half_ of the total FOV.
   * **The Check:** `DotProduct > FMath::Cos(FOVRadians)`: If the dot product is _greater_ than the cosine of the half-angle limit, it means the actual angle is _smaller_ than the half-angle limit, therefore the spawn point lies _within_ the enemy's FOV cone.

### Bias Calculation for FOV Penalty

If the spawn point is determined to be within an enemy's FOV:

1. **Normalized Score (`FOVScore`):** The code calculates a score between 0 and 1. This normalization `(DotProduct - Cos(Limit)) / (1.0 - Cos(Limit))` represents how "central" the spawn point is within the FOV cone. A score near 1 means it's almost directly in front of the enemy, while a score near 0 means it's near the edge of their peripheral vision.
2. **Scaled Penalty:** This `FOVScore` is then multiplied by a large constant (`200.0f` in the example) to create a significant penalty value. Spawns directly in front are penalized more heavily than those at the edge of the FOV.
3. **Accumulation (`TotalFOVBias`):** This penalty is added to `TotalFOVBias`. If multiple enemies are looking at the same spawn point, the penalties accumulate, making that spot extremely undesirable.

Finally, `CalculateSpawnBias` _subtracts_ this `TotalFOVBias` from the overall score, applying the strong negative influence.

### Configuration & Tuning

* **`EnemyFOVAngle` (float):** This `UPROPERTY` allows you to define the width (in degrees) of the enemy's view cone used for this check. A wider angle makes the check more aggressive, penalizing a larger area around enemies.
* **`FOVBiasWeight` (float) (**`200.0f`**):** Similar to other weights, this `UPROPERTY` exists so developers can tune the FOV penalty's overall strength relative to distance penalties.

### Visual Diagram Concept (Top-Down view)

```
                                  ▲
                                  | Enemy's Forward View Direction
                                  |
                                  |
  * SP_C (SAFE)                   | * SP_A (DANGEROUS)
    (Angle > Limit)               |  (Angle is near 0°)
     \                            |
      \                           |                          /
       \ <---- FOV Boundary ----- | ----------------------- /
        \     (Angle Limit)       |                        /
         \                        |                       /
          \                       |              * SP_B (RISKY)
           \                 (Angle < Limit)            /
            \                                          /
                                  E
                               (Enemy)

   * SP_D (SAFE)
   (Behind Enemy / Angle > 90°)
```

#### **Detailed Breakdown of the Diagram**

* **E (Enemy):** The viewpoint.
* **▲ (View Direction):** The central vector of the enemy's vision.

**The Spawn Points:**

* **SP_A (DANGEROUS / Max Penalty):**
  * **Position:** Almost directly in front of the enemy.
  * **Angle:** The angle to SP_A is nearly 0 degrees, making it deep inside the FOV.
  * **Result:** Receives the highest possible penalty from `FOVBiasWeight`. The system will strongly avoid this.
* **SP_B (RISKY / Medium Penalty):**
  * **Position:** Inside the FOV cone, but near the edge.
  * **Angle:** The angle to SP_B is less than the `Angle Limit` (`EnemyFOVAngle / 2`), but not by much.
  * **Result:** Receives a graduated penalty. It's considered visible and dangerous, but less so than SP_A.
* **SP_C (SAFE / No Penalty):**
  * **Position:** To the side of the enemy, clearly outside the visual cone.
  * **Angle:** The angle to SP_C is **greater than** the `Angle Limit`.
  * **Result:** The dot product check fails. No FOV bias is applied. This is a good spawn location.
* **SP_D (SAFE / No Penalty):**
  * **Position:** Behind the enemy.
  * **Angle:** The angle to SP_D is greater than 90 degrees, which is far beyond any typical forward-facing `Angle Limit`.
  * **Result:** Just like SP_C, it is safely outside the FOV cone and receives no penalty.

The system calculates the angle between the Enemy Forward Vector and the vector from the Enemy to the Spawn Point using the dot product and checks if it's within the cone defined by `EnemyFOVAngle`.

This line-of-sight check provides a crucial layer of safety beyond simple proximity, significantly reducing the chances of players spawning directly under an enemy's watchful eye.

***
