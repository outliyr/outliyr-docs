# Execution Modes

A transaction has two ways to start. Pick based on who initiates the change, not how complex the request is.

A **player-initiated** change runs through `ExecuteTransactionRequest` and rides the gameplay ability system so the result appears immediately on the client and reconciles when the server replies. A **server-initiated** change, quest reward, scripted event, save-load, runs through `ExecuteTransactionAuthoritative` and skips the ability system entirely. Both paths share the same validate-then-apply core, so atomicity, rejection reasons, and rollback behave identically.

## Player-Initiated, Predicted

`UItemContainerFunctionLibrary::ExecuteTransactionRequest` wraps the request in a `FGameplayEventData` and sends it to `ULyraItemTransactionAbility`, which is `LocalPredicted`. The client predicts the result locally, the server validates and applies authoritatively, and prediction reconciliation closes the loop. Rejection rolls the prediction back automatically via the prediction key.

This path requires a valid `APlayerController` because the ability lives on the player's ASC and its prediction key bookkeeping is tied to that controller.

<div class="gb-code-title">Predicted-player call site (C++)</div>

```cpp
FItemTransactionRequest Request;
Request.ClientRequestId = FGuid::NewGuid();
Request.AddSplitStackOp(SourceSlotInfo, DestSlotInfo, /*Amount=*/ 5);

UItemContainerFunctionLibrary::ExecuteTransactionRequest(GetOwningPlayerController(), Request);
```


The `ClientRequestId` is required and lets your UI listen for the matching `FItemTransactionResultMessage` so success and failure broadcasts can be correlated.

## Server-Initiated, Authoritative

`UItemContainerFunctionLibrary::ExecuteTransactionAuthoritative` builds an authoritative context, runs the same validate-then-apply core that the predicted path uses, and skips the ability system. There is no GAS round-trip, no prediction key, and the player controller is optional. Calls made from a client return false with a logged rejection.

Per-handler permission checks are skipped because per-player permission gates are meaningless when no player is initiating the action. The context flag `bSkipPermissionChecks = true` instructs handlers to bypass `HasPermission` calls; structural validation, slot occupancy, and stack-bounds checks all still run.

<div class="gb-code-title">Server-only call site (C++)</div>

```cpp
FItemTransactionRequest Request;
Request.ClientRequestId = FGuid::NewGuid();
Request.AddCreateItemOp(DestSlotInfo, RewardItemDef, /*StackCount=*/ 1);

FItemRejectionReason Rejection;
const bool bSuccess = UItemContainerFunctionLibrary::ExecuteTransactionAuthoritative(
    /*WorldContext=*/ this,
    Request,
    /*OptionalAttribution=*/ nullptr,
    Rejection);

if (!bSuccess)
{
    UE_LOG(LogTemp, Warning, TEXT("Quest reward grant failed: %s"), *Rejection.Message.ToString());
}
```


Pass the player controller as `OptionalAttribution` when you want logs and the broadcast `FItemTransactionResultMessage` to identify the recipient. Pass `nullptr` for granting flows that target containers reachable through their slot descriptors alone.

## Choosing Which Path

A change initiated by a client UI input must always go through `ExecuteTransactionRequest` so prediction stays correct. A change initiated by server code must always go through `ExecuteTransactionAuthoritative` so the predicted-client wrapper does not run unnecessarily and so the call can succeed without an attached player.

| Trigger                           | Use                               |
| --------------------------------- | --------------------------------- |
| UI drag, button press, hotkey     | `ExecuteTransactionRequest`       |
| Pickup, consume, equip from input | `ExecuteTransactionRequest`       |
| Quest reward grant                | `ExecuteTransactionAuthoritative` |
| Scripted cinematic, kill bounty   | `ExecuteTransactionAuthoritative` |
| Save-load restoration             | `ExecuteTransactionAuthoritative` |
| Game-mode loot drop, server timer | `ExecuteTransactionAuthoritative` |

Both paths produce the same `FItemTransactionResultMessage` broadcast on the gameplay message subsystem, so any UI or analytics listener subscribed to `Lyra.Item.Message.TransactionResult` works for both.

## Extending With Custom Operations

Custom op types register their handler with `FItemTransactionRunner`, which owns the dispatch registry that the predicted-player path and the server-only path both read from. Register at module startup so the handler is in place before any transaction runs.

<details class="gb-toggle">

<summary>Code: registering a custom op</summary>

```cpp
// In your module's StartupModule()
FItemTransactionRunner::RegisterHandler(
    FMyCustomTxOp::StaticStruct(),
    MakeUnique<FMyCustomTxOpHandler>());
```

Module-startup registration survives map loads and applies to every transaction submitted afterward through either entry point.

</details>

