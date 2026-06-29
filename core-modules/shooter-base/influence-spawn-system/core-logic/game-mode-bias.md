# Game Mode Bias

While proximity and line of sight provide essential safety checks applicable to most shooter scenarios, different game modes often have unique objectives and tactical considerations that should influence spawning decisions. The Influence Spawn System provides a specific mechanism for incorporating this custom, mode-specific logic.

### Goal

* **Mode-Specific Influence:** Allow spawn locations to be biased towards or away from objectives, control points, payload paths, or other elements unique to the current game mode.
* **Strategic Spawning:** Enable spawning logic that supports the specific tactical goals of the game mode (e.g., spawning defenders closer to their objective, spawning attackers nearer to contested areas).
* **Flexibility:** Provide an extensible hook without modifying the core proximity/FOV calculations.

### Mechanism: `CalculateGameModeBias` (BlueprintNativeEvent)

The core hook for this customization is the `CalculateGameModeBias` function within `UShooterPlayerSpawningManagmentComponent`.

```cpp
protected:
    // UFUNCTION allows overriding in Blueprint/C++ subclasses
    UFUNCTION(BlueprintNativeEvent)
    float CalculateGameModeBias(AController* Player, ALyraPlayerStart* PlayerStart) const;

    // Default C++ implementation (can be overridden)
    virtual float CalculateGameModeBias_Implementation(AController* Player, ALyraPlayerStart* PlayerStart) const;

// Default implementation returns zero bias:
float UShooterPlayerSpawningManagmentComponent::CalculateGameModeBias_Implementation(AController* Player, ALyraPlayerStart* PlayerStart) const
{
    // this should be overridden
    return 0.0f;
}

// Called from the main CalculateSpawnBias function:
// SpawnBias += CalculateGameModeBias(Player, PlayerStart);
```

* **`BlueprintNativeEvent`:** This designation means the function has a base C++ implementation (`_Implementation`) but is specifically designed to be easily overridden in **Blueprint subclasses**. You can also override the `_Implementation` function directly in C++ subclasses.
* **Purpose:** This function is called once for _every_ potential `ALyraPlayerStart` being evaluated for the spawning `Player`. Its sole purpose is to calculate and return a `float` value representing the additional bias (positive or negative) that should be applied to that specific spawn point based _only_ on the rules of the current game mode.
* **Default Behavior:** The base implementation simply returns `0.0`, meaning it adds no game-mode-specific bias by default.
* **Integration:** The value returned by `CalculateGameModeBias` is directly added (`+=`) to the `SpawnBias` score calculated from proximity and FOV factors within the main `CalculateSpawnBias` function.

### Implementation Strategy: Subclassing

To use this feature, you **must** create a subclass (Blueprint or C++) of `UShooterPlayerSpawningManagmentComponent` specific to your game mode or experience.

1. **Create Subclass:** Create a new Blueprint class inheriting from `UShooterPlayerSpawningManagmentComponent` (e.g., `BP_SpawningManager_Domination`).
2. **Override Function:** In your new Blueprint class, go to the "Functions" section in the "My Blueprint" panel, hover over "Override," and select `Calculate Game Mode Bias`.
3. **Implement Logic:** Add your custom logic inside this overridden function. You have access to the `Player` controller attempting to spawn and the specific `Player Start` being evaluated.
   * You will likely need to get references to game-mode-specific actors or managers (e.g., control point actors, payload state manager) using techniques like `GameplayStatics::GetAllActorsOfClass` or accessing custom components on the `GameState`.
   * Perform calculations based on distances to objectives, ownership status, game phase (`ULyraGamePhaseSubsystem`), player roles, etc.
   * **Return Value:** Output the calculated bias value (positive to favor the spawn point, negative to penalize it) from the function's return node.

### Example Use Cases

Here are some hypothetical examples of logic you might implement within an overridden `CalculateGameModeBias`:

* **Control Point Modes (Domination, Hardpoint):**
  * Calculate distance from `PlayerStart` to control points.
  * Add positive bias for points owned by the player's team (favor spawning near owned points).
  * Add negative bias for points owned by the enemy team (avoid spawning near enemy-held points).
  * Potentially add a stronger positive bias for contested points to encourage spawning near active fights.
* **Payload Modes:**
  * Calculate distance from `PlayerStart` to the payload.
  * If on Attack: Add positive bias for spawns ahead of the payload on the track.
  * If on Defense: Add positive bias for spawns behind the payload or near upcoming defensive positions/chokepoints.
* **Capture The Flag:**
  * Calculate distance to friendly and enemy flag stands.
  * If friendly flag is taken: Add positive bias near the flag carrier's path or towards the friendly base.
  * If enemy flag is taken: Add positive bias near the escape route or towards the enemy base.
  * Add negative bias near the enemy base if the friendly flag is secure.
* **Phase-Based Logic:**
  * Get the `ULyraGamePhaseSubsystem`.
  * Check the active phase tag (e.g., `IsPhaseActive(GamePhase.Overtime)`).
  * Apply different bias rules during specific phases (e.g., force spawns closer to a central objective during Overtime).
* **Team Size / Role Balancing:**
  * Check team sizes or player roles.
  * If a team is significantly outnumbered, slightly bias spawns closer together to facilitate regrouping.

By overriding `CalculateGameModeBias` in a mode-specific subclass of the spawning manager, you can tailor the spawn logic precisely to the strategic needs and objectives of your game mode, layering this custom influence on top of the base safety checks provided by the proximity and FOV calculations. Remember to integrate your custom spawning manager subclass using Lyra Experiences as described later.

***
