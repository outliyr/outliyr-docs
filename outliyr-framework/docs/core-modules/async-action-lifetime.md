# Async Action Lifetime

A Blueprint async action, such as **Observe Team Colors** or **Listen For Gameplay Messages**, is registered with the game instance and stays alive until it ends. An action that waits on the game, by observing or listening, has no end of its own. The **AsyncActionLifetime** plugin gives every async action in the framework one rule for when it ends: with the life it was started for. A Blueprint can still cancel any of them at any time.

***

## Ending With What It Is Tied To

An action is tied to the objects it was started for, the object whose Blueprint started it and whatever it watches, and it ends once any of them is gone.

| Tied to | Gone when |
| --- | --- |
| An actor, or a component or other object inside one | The actor is destroyed or leaves play. An actor that seamless travel carries into the next match keeps its actions running there. |
| A world | The world is cleaned up. |
| Any other object, such as a widget | Garbage collection removes it. |

The framework's actions are tied like this:

| Action | Ends with |
| --- | --- |
| `ObserveTeam` | The team agent it watches |
| `ObserveTeamColors`, `ObserveTeamAliveCount` | What started it, the team agent it watches, and the world whose teams it watches |
| `ObserveTeamAliveCountById`, `ObserveViewerTeam` | What started it, and the world whose teams it watches |
| `QueryInventoryAsync`, `QueryTetrisInventoryAsync` | What started it, and the inventory it watches |
| `WaitForExperienceReady` | What started it, and the world whose experience it waits for |
| `ListenForGameplayMessages` | What started it. Messages travel through the game instance, so a listener started by a widget kept across travel goes on listening in the next match. |
| `CreateWidgetAsync` | What started it, and the owning player |
| `PushContentToLayerForPlayer` | The owning player |
| The confirmation nodes | What started them |

***

## Running the Same Node Again

A Blueprint loses its handle on an action once the node that started it runs again. An action that keeps listening, which is every team observer, item query and gameplay message listener, therefore ends its earlier run when a new one activates with the same ties, the same inputs and the same event bound. An actor or widget that starts a listener each time it is reused, bound or respawned keeps exactly one, rather than collecting copies that each deliver the same event.

A run with other inputs, such as another channel, team or agent, or bound to another event, listens alongside the earlier one. One-shot actions, which create a widget, push content, show a confirmation or wait for the experience, never replace a run, since several runs of them are meant.

***

## Writing Your Own

An async action of your own that waits on the game derives from `ULifetimeAsyncAction` rather than `UCancellableAsyncAction`, and its module and plugin depend on AsyncActionLifetime. Its factory ties it with `EndWith` to the object that started it and to each object it watches, and to the world when what it listens to belongs to one world. An action that keeps listening calls `ReplaceEarlierRun` at the start of `Activate`, passing anything beyond its ties that tells its runs apart, such as a channel or a team id.

<details>

<summary>In code: an action that observes a door</summary>

```cpp
UCLASS()
class UAsyncAction_ObserveDoor : public ULifetimeAsyncAction
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, meta = (BlueprintInternalUseOnly = "true", WorldContext = "WorldContextObject"))
	static UAsyncAction_ObserveDoor* ObserveDoor(UObject* WorldContextObject, ADoor* Door);

	virtual void Activate() override;

	UPROPERTY(BlueprintAssignable)
	FDoorObservedDelegate OnDoorChanged;

private:
	TWeakObjectPtr<ADoor> Door;
};

UAsyncAction_ObserveDoor* UAsyncAction_ObserveDoor::ObserveDoor(UObject* WorldContextObject, ADoor* Door)
{
	UAsyncAction_ObserveDoor* Action = NewObject<UAsyncAction_ObserveDoor>();
	Action->Door = Door;
	Action->RegisterWithGameInstance(WorldContextObject);
	Action->EndWith(WorldContextObject);
	Action->EndWith(Door);
	return Action;
}

void UAsyncAction_ObserveDoor::Activate()
{
	ReplaceEarlierRun();

	// Bind to the door and broadcast its current state.
}
```

`ReplaceEarlierRun` reads the events the Blueprint bound, so it is called from `Activate`, after the node has bound them. An action that cleans up in `SetReadyToDestroy` calls the base version, which unbinds what `EndWith` bound.

</details>
