# Reconciling Spawned Actors

When the framework swaps a locally-predicted spawned actor for its authoritative server-replicated copy, any local-only state the predicted actor accumulated during its lifetime is lost. The `ILyraReconcilablePredictedActor` interface gives the authoritative actor a chance to carry that state across the swap so the transition is invisible to the predicting client.

***

## The Problem

The item container prediction system spawns a local predicted actor as soon as the predicting client issues an operation, then replaces it with the server-replicated actor once the prediction is confirmed. The predicted actor is the only one the player sees during that window, and it can accumulate local-only state during its lifetime. An actor driven by a client-side timeline might have drifted away from its spawn transform. An animated reticle might be paused on a particular frame. A particle component might be partway through a phase.

The replicated actor spawns clean from its configured attach transform. Without intervention, the swap produces a visible hitch on the predicting client: the drifted transform snaps back to its spawn pose, the reticle resets, the particle restarts. Only the predicting client sees this. Other clients see only the authoritative actor and never experience the swap.

The interface lets the actor class opt in to carrying its local-only state across the swap.

***

## The Contract

Implement `ULyraReconcilablePredictedActor` on the actor class and override `OnReconcileFromPredictedActor`.

<div class="gb-stack">
<details class="gb-toggle">

<summary>C++</summary>

```cpp
UCLASS()
class APredictedActor : public AActor, public ILyraReconcilablePredictedActor
{
    GENERATED_BODY()

public:
    virtual void OnReconcileFromPredictedActor_Implementation(AActor* PredictedActor) override;
};
```

</details>
<details class="gb-toggle">

<summary>Blueprint</summary>

Add `LyraReconcilablePredictedActor` to the actor Blueprint's implemented interfaces. The graph exposes an event named **On Reconcile From Predicted Actor** with a single `Predicted Actor` input pin. Implement the event to read the cosmetic state from the predicted actor and apply it to self.

<img src=".gitbook/assets/image (317).png" alt="" title="">

<img src=".gitbook/assets/image (320).png" alt="" title="">

</details>
</div>

The framework calls the override on the authoritative actor with a pointer to the predicted one. The predicted actor is valid for the duration of the call and is destroyed immediately after it returns.

***

## Example: Kinetic Shield Drift

A kinetic shield that drifts via a client-side timeline carries one piece of local-only state worth preserving: its relative transform. Copying it onto the authoritative actor is a single line.

<details class="gb-toggle">

<summary>Full implementation</summary>

<img src=".gitbook/assets/image (321).png" alt="" title="">

<img src=".gitbook/assets/image (319).png" alt="" title="">

</details>

The drifted position the player was looking at right before the swap becomes the position the authoritative actor takes over at, and the drift timeline on the authoritative actor continues from there.

***

## When the Interface Fires

The framework calls the interface on the freshly arrived authoritative actor while its predicted twin is still alive, immediately before the predicted twin is destroyed. The dispatch sites match the prediction phase ordering for each container.

For equipment, the interface fires inside `ReconcileWithPredictedInstance` when the spawned actor array has already arrived, or inside `OnRep_SpawnedActors` when the array arrives after the reconciliation pass has moved the predicted twins onto the authoritative instance. The container handles both orderings so the interface still fires regardless of which side of the swap arrives first.

For attachments, the interface fires inside `HandlePredictionConfirmed` when the prediction engine matches the authoritative entry to the predicted overlay.

Any future container that uses the prediction system and spawns predicted actors can dispatch to the same interface.

***

## Visibility Handling

The framework keeps the authoritative actor hidden from the moment it arrives on the predicting client until immediately after the interface function has finished. The predicted twin continues to render its drifted state right up until destruction, and the authoritative actor takes over already wearing the carried-across state. No frame ever renders both copies at the same position, and no frame ever shows the authoritative copy at its default attach transform.

Implementing actors do not need to manage hide and show themselves. The framework handles the visibility wrap around the interface.

***

## What to Copy, What Not to Copy

Copy local-only cosmetic state that the server is not authoritative over. That covers transforms produced by client-side animation, timeline progress, particle and niagara handles, decal phase, and similar visual state that exists only on the predicting client.

Do not copy state the server reconciles. Copying ammo counts, durability values, cooldown timers or any other authoritative field through this interface silently defeats the prediction system. The authoritative actor would overwrite the server-confirmed values with whatever the predicted copy was holding, producing desynchronised gameplay state that the server cannot detect or correct.

***

## Related Concerns

The interface addresses divergence on the predicted copy. It does not address divergence on the authoritative copy.

A common case is an attachment that grants a server-side gameplay effect modifying the equipment actor, for example an attachment that scales a kinetic shield up. The predicted shield spawns at its base size because the granting effect runs only on the server. The authoritative shield arrives already scaled. The interface cannot help here, because the divergence is in the authoritative direction and the interface cannot guess what server-side effects are pending.

Buyers who need to mirror such effects at predict time can read their own attachments at predicted-spawn time and apply the cosmetic modifier locally inside the predicted actor, without predicting the underlying ability. That keeps prediction confined to the visual without touching the gameplay rules the server owns.
