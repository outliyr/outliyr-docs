# Server-Side Validation

Because hitscan weapons rely on instantaneous traces, simply trusting the client's reported hit results would make cheating trivial (e.g., aimbots reporting headshots regardless of actual aim). Therefore, the server must authoritatively validate the client's shot using the state of the world _as the client perceived it_ when the shot was fired. This is achieved using the [**Lag Compensation Manager**](../../../lag-compensation/).

### The Need for Lag Compensation

Network latency means that by the time the server receives the client's `TargetDataHandle` (containing hit results and a timestamp), the actors in the server's world have moved. If the server performed a trace using the _current_ positions of actors, it would likely get different results than the client, unfairly invalidating legitimate shots or failing to register hits on targets that the client clearly saw.

Lag compensation temporarily "rewinds" relevant actors (opponents, potentially physics objects) back to their positions at the specific `Timestamp` reported by the client, performs the trace in this rewound state, and then restores the actors.

### Server-Side Entry Point (`OnTargetDataReadyCallback`)

When the server's Ability System Component receives the `TargetDataHandle` sent by the client via the `CallServerSetReplicatedTargetData` RPC, it eventually triggers the _server's_ instance of the `OnTargetDataReadyCallback` function for that ability activation.

Inside the server's `OnTargetDataReadyCallback`:

1. **Authority Check:** It verifies it's running on the server (`CurrentActorInfo->IsNetAuthority()`).
2. **Prediction Key:** It retrieves the `ValidationKey` (the `FPredictionKey` sent by the client) associated with the incoming target data. This key is crucial for later creating a dependent prediction window _after_ validation completes.
3. **Validation Trigger:** It calls the dedicated server-side validation function: `PerformServerSideValidation(MyAbilityComponent, LocalTargetDataHandle, ValidationKey);`

### Performing Validation (`PerformServerSideValidation`)

This function orchestrates the core lag compensation and validation logic (guarded by `#if WITH_SERVER_CODE`):

1. **Get Lag Compensation Manager:** Retrieves the `ULagCompensationManager` component, typically expected to be attached to the `AGameStateBase`. If the manager isn't found, validation cannot proceed (a warning is logged).
2. **Prepare Trace Parameters:** Sets up basic `FCollisionQueryParams` and determines actors to ignore (self, attached actors).
3. **Iterate Through Client Hits:** Loops through each `FGameplayAbilityTargetData` entry in the received `LocalTargetDataHandle`.
4. **Extract Client Hit Data:** For each entry (cast to `FLyraGameplayAbilityTargetData_SingleTargetHit`):
   * Gets the client's reported `FHitResult* ClientHitResult`.
   * Gets the client's `Timestamp`.
   * Gets the client's `TraceStart` and `TraceEnd`.
5. **Basic Sanity Checks (`IsLineTracePossible`):** Before involving lag compensation, it performs preliminary checks:
   * Is the `ClientHitResult` valid?
   * Is the `TraceStart` reasonably close to the player's current server location (accounts for some latency/movement)? (e.g., `< 1000.0f` units).
   * Does the trace distance (`TraceEnd` - `TraceStart`) exceed the weapon's `MaxDamageRange`?
   * If any check fails, the hit is considered invalid due to potential cheating or extreme desync. The `SingleTargetHit->ReplaceHitWith(nullptr, &EmptyHitResult)` function is used to mark this specific hit data as invalid within the handle.
6.  **Initiate Rewind Trace:** If basic checks pass _and_ the client actually hit something (`ClientHitResult->GetActor()` is not null), it calls the Lag Compensation Manager:

    ```cpp
    TFuture<FRewindLineTraceResult> ResultFuture = LagCompensationManager->RewindLineTrace(
        Timestamp,         // Time to rewind to
        TraceStart,        // Client's trace start
        TraceEnd,          // Client's trace end
        TraceInfo,         // Extra trace info (optional)
        Lyra_TraceChannel_Weapon, // Collision channel
        IgnoreActors       // Actors to ignore
        );
    ```

    This function performs the trace asynchronously in a separate thread using the rewound world state.
7. **Handle Asynchronous Result (`ResultFuture.Then(...)`):** Because `RewindLineTrace` is asynchronous, a callback (`.Then(...)`) is attached to its `TFuture` result. This callback executes when the rewind trace completes.
   * **Switch to Game Thread:** The callback first uses `AsyncTask(ENamedThreads::GameThread, ...)` to ensure the subsequent logic runs back on the main game thread, which is required for modifying gameplay state safely.
   * **Compare Server vs. Client Hit:** Inside the game thread task:
     * Retrieves the `FRewindLineTraceResult Result` (containing the server's `HitResults` from the rewound trace).
     * **The Core Validation:** Compares the server's first hit result (`Result.HitResults[0]`) with the client's original hit (`SingleTargetHit->GetHitResult()`). The validation checks:
       * **Actor Match:** `Result.HitResults[0].GetActor() == SingleTargetHit->GetHitResult()->GetActor()`
       * **Physical Material Match:** `Result.HitResults[0].PhysMaterial.Get() == SingleTargetHit->GetHitResult()->PhysMaterial.Get()` (Important for preventing fake headshots/weak point hits).
     * **Trust But Verify:** If the actor and physical material _match_, the server generally trusts the client's _precise_ hit location details (impact point, normal) from `SingleTargetHit->GetHitResult()`. This accounts for minor discrepancies due to interpolation differences or floating-point precision.
     * **Invalidate/Replace:** If the actor or material _do not match_, the server considers the client's hit invalid for that target. It calls `SingleTargetHit->ReplaceHitWith(...)`, either passing the _server's_ hit result (`&Result.HitResults[0]`) or `nullptr` if the server didn't hit anything relevant where the client claimed a hit. This effectively nullifies or corrects the client's hit data _within the TargetDataHandle_.
   * **Track Completion:** Increments a shared counter (`CompletedTraceCount`) for outstanding asynchronous traces.
   * **Final Processing Trigger:** When the counter reaches the total number of expected traces (`*CompletedTraceCount == LocalTargetDataHandle.Num()`), it means all validations for this ability activation are complete. It then proceeds to the final step:
     * **Create Dependent Prediction Window:** Creates a _new_ `FScopedPredictionWindow ValidatedScopedPrediction(MyAbilityComponent, ValidationKey)`. This links the subsequent processing steps back to the original client action using the saved `ValidationKey`. This is crucial for GAS to correctly handle predicted costs/effects if the overall action is ultimately confirmed.
     * **Call Final Processing:** Calls `ProcessValidatedTargetData(LocalTargetDataHandle)` to handle the now-validated (or invalidated/corrected) hit results.

### Summary of Server Validation

* Server receives `TargetDataHandle` and `PredictionKey` from the client.
* Server calls `PerformServerSideValidation`.
* Basic sanity checks (`IsLineTracePossible`) are performed on client trace data.
* For each plausible client hit, an asynchronous `RewindLineTrace` is initiated using the client's timestamp and trace vectors.
* When the rewind trace completes, the server compares its hit result (actor, material) with the client's reported hit.
* If mismatched, the server marks the client's hit data as invalid (`ReplaceHitWith`) within the `TargetDataHandle`.
* Once all async traces are validated, `ProcessValidatedTargetData` is called within a new prediction window linked to the original client action.

This rigorous process ensures that hitscan impacts are authoritatively verified against a historically accurate world state, maintaining fairness in the networked environment while leveraging client prediction for responsiveness.

***
