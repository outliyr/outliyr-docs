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
                TotalFOVBias += 200.0f * FOVScore; // Add scaled penalty
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
* **`FOVBiasWeight` (float):** Similar to other weights, this `UPROPERTY` exists but is not directly used in the provided calculation snippet (`TotalFOVBias += 200.0f * FOVScore`). Developers could modify the calculation to incorporate this weight (`TotalFOVBias += FOVBiasWeight * 200.0f * FOVScore`) for easier tuning of the FOV penalty's overall strength relative to distance penalties. The current large constant (`200.0f`) implies a high default importance for avoiding enemy line of sight.

### Visual Diagram Concept

Imagine a top-down view:

```mermaid
graph TD
    subgraph "Enemy (E) View"
        direction N
        E -->|Forward Vector| FV[ ]
        style FV fill:none,stroke:none
        E -.-> ConeEdgeL[FOV Boundary Left]
        E -.-> ConeEdgeR[FOV Boundary Right]
        subgraph "FOV Cone (EnemyFOVAngle)"
            direction N
            ConeEdgeL --- S2[S2 - Inside, Off-Center]
            S2 --- S3[S3 - Inside, Directly Ahead]
            S3 --- ConeEdgeR
        end
    end

    subgraph "Spawn Points"
        S1[S1 - Outside Cone]
        S4[S4 - Behind Enemy]
    end

    E -- DirectionToS1 --> S1
    E -- DirectionToS2 --> S2
    E -- DirectionToS3 --> S3
    E -- DirectionToS4 --> S4

    subgraph "Calculations & Penalties"
        Dot1["DotProduct(E->S1, Forward) < Cos(HalfAngle)"] --> Penalty1["Result: NO FOV Penalty"]
        Dot2["DotProduct(E->S2, Forward) > Cos(HalfAngle)\n(Closer to Cos(HalfAngle))"] --> Penalty2["Result: MEDIUM FOV Penalty"]
        Dot3["DotProduct(E->S3, Forward) ≈ 1.0\n(Much > Cos(HalfAngle))"] --> Penalty3["Result: HIGH FOV Penalty"]
        Dot4["DotProduct(E->S4, Forward) < 0"] --> Penalty4["Result: NO FOV Penalty"]
    end

    style S1 fill:#f9f,stroke:#333,stroke-width:2px
    style S2 fill:#ff9,stroke:#333,stroke-width:2px
    style S3 fill:#f96,stroke:#333,stroke-width:2px
    style S4 fill:#f9f,stroke:#333,stroke-width:2px
```

```
Diagram: Enemy FOV Check for Spawn Point Bias

          Enemy View Direction
                 ^
                 |
                 |
       ----------|----------  <-- FOV Boundary (Left)
        \        |        /
         \       |       /
          \      |      /    Angle Limit = (EnemyFOVAngle / 2)
           \     |θ1   /
            \ E--*---* SP1 (Inside FOV)
             \   |   /
              \  |  /
               \ | / Angle θ2
                \|/
                 * SP2 (Outside FOV)
                 |
       ----------|----------  <-- FOV Boundary (Right)
                 |

Key:
  E   = Enemy Viewpoint Location
  ^   = Enemy Forward View Direction Vector
  SP1 = Potential Spawn Point #1
  SP2 = Potential Spawn Point #2
 ---* = Vector from Enemy (E) to Spawn Point (SP1)
  θ1  = Angle between Enemy View Direction and Vector E->SP1
  θ2  = Angle between Enemy View Direction and Vector E->SP2
 \ /  = Boundary lines representing the edge of the EnemyFOVAngle cone

Check Performed by the System:
  Is the calculated Angle (θ) LESS THAN (EnemyFOVAngle / 2) ?
  (Actual code uses: Is DotProduct(ViewDir, SpawnDir) > Cos(EnemyFOVAngle / 2) ?)

Outcome:
  - For SP1: Angle θ1 < (EnemyFOVAngle / 2) --> TRUE
             Result: SP1 is INSIDE the FOV cone. Significant NEGATIVE bias is added.

  - For SP2: Angle θ2 > (EnemyFOVAngle / 2) --> FALSE
             Result: SP2 is OUTSIDE the FOV cone. No specific FOV bias is added (though proximity bias still applies).
```

The system calculates the angle between the Enemy Forward Vector and the vector from the Enemy to the Spawn Point using the dot product and checks if it's within the cone defined by `EnemyFOVAngle`.

This line-of-sight check provides a crucial layer of safety beyond simple proximity, significantly reducing the chances of players spawning directly under an enemy's watchful eye.

***
