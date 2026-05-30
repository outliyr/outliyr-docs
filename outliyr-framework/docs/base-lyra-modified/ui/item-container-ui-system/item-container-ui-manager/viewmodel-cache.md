# Viewmodel Cache

Two widgets often want to look at the same container. If each widget built its own ViewModel, they would each subscribe to the underlying component, do their own rebuilds, and drift out of sync the moment one of them changed local state.

The manager solves this by keeping one ViewModel per container and handing the same instance to every widget that asks for it. The widgets bind to shared properties and update together because there is only one ViewModel doing the work.

This page covers how to ask for a ViewModel, the always-available base session that owns the ones outside any window, and the identity rules that decide what counts as "the same container."

***

### Asking for a ViewModel

Two entry points cover every case:

{% tabs %}
{% tab title="Inside a window shell" %}
<figure><img src="../../../../.gitbook/assets/image (329).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="PlayerScoped Outside" %}
<figure><img src="../../../../.gitbook/assets/image (328).png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Bounded LifeCycle" %}
<figure><img src="../../../../.gitbook/assets/image (334).png" alt=""><figcaption><p>Updates the attachment view model when the weapon slot changes</p></figcaption></figure>

<figure><img src="../../../../.gitbook/assets/image (333).png" alt=""><figcaption><p>Closes the current session to remove free the attachment view model from memory <br>(will still close when the base session closes so no chance of leak)</p></figcaption></figure>

<figure><img src="../../../../.gitbook/assets/image (331).png" alt=""><figcaption><p>fetches the new attachment viewmodel and creates a new session for the view model</p></figcaption></figure>
{% endtab %}
{% endtabs %}

* **From inside a window shell** — content widgets call `Shell->GetOrCreateViewModel(Source)`. The shell already knows the session it belongs to and passes it through.
*

    **From outside a window shell, player-scoped** — widgets that should persist while the player's UI is up (a static inventory screen the player opens with one button, an equipment panel) call `UIManager->GetOrCreateViewModelForSession(Source, UIManager->GetBaseSession())`. The ViewModel lives for the player session.
* **From outside a window shell, with a bounded lifecycle** — widgets with their own open/close lifecycle (a loot-container preview, a custom interaction screen) create their own session via `UIManager->CreateChildSession(Tag, SourceContext, ParentSession)` on construct, acquire the ViewModel under that session, and call `UIManager->CloseSession(Handle)` on destruction. ViewModels acquired under that session are released as part of the cascade. See U[ViewModels Without a Window Shell](../extension-and-integration/viewmodels-without-a-window-shell.md) for the worked example.

The `Source` argument is a polymorphic container source. The return value is a fully initialized `ULyraContainerViewModel*` ready to bind.

***

### The Base Session

The base session is created when the UI manager initializes for the local player and stays available until the player is destroyed. It survives map transitions and does not require the windowing layer to be active.

It is the right home for ViewModels backing widgets that the player opens and closes many times during a play session and that should come back from the cache instantly instead of rebuilding. For example:

* A static inventory screen the player opens with one button, the same widget appears every time without re-subscribing to the inventory component.
* The mandatory inventory windows the [windowing layer](../the-windowing-system/) spawns on activation, in games that use windowed inventory UI.

For widgets with their own bounded open/close lifecycle that opted out of using a window shell, a loot-container preview, a transient interaction screen, create a session under the base session via `CreateChildSession` instead, and close it when the widget tears down. See [ViewModels Without a Window Shell](../extension-and-integration/viewmodels-without-a-window-shell.md) for both patterns side by side.

***

### The Cache Key

Cache entries are keyed by `FLyraContainerViewModelKey`. Two container sources resolve to the same ViewModel exactly when their keys are equal.

<details>

<summary>FLyraContainerViewModelKey</summary>

```cpp
USTRUCT()
struct LYRAGAME_API FLyraContainerViewModelKey
{
    GENERATED_BODY()

    UPROPERTY()
    TObjectPtr<const UScriptStruct> SourceStructType = nullptr;

    UPROPERTY()
    TWeakObjectPtr<UObject> ContainerObject;

    UPROPERTY()
    FGuid ItemGuid;

    bool operator==(const FLyraContainerViewModelKey& Other) const;
    friend uint32 GetTypeHash(const FLyraContainerViewModelKey& Key);
};
```

</details>

Three fields combine to form the identity:

* **`SourceStructType`** records which source struct produced the key. A vendor source and an inventory source pointing at the same component still resolve to different ViewModels because they are different views of that component.
* **`ContainerObject`** holds a weak pointer to the owning component or actor. Direct sources rely on this.
* **`ItemGuid`** holds an item identifier. Prediction-resilient item-owned sources rely on this so the ViewModel survives predicted-to-authoritative item replacement.

Equality is field-by-field. The hash exists only so the map can bucket entries. Two different keys never collapse into the same entry because of a hash collision.

Sources populate the key by overriding `BuildContainerViewModelKey`. The default implementation calls `GetOwner()` and fills in `ContainerObject`, which covers any source backed by a component or actor. The page on polymorphic container sources walks through the override contract in detail.

***

### Get-or-Create Flow

When a widget asks for a ViewModel the manager performs these steps in order:

1. **Lazy stale cleanup.** Any cache entry whose `ContainerObject` weak pointer has become invalid, or whose `ItemGuid` can no longer be resolved, is uninitialized and removed.
2. **Build the key.** The manager calls `Source.BuildContainerViewModelKey(OutKey)` and stamps `SourceStructType` from the source's script struct.
3. **Lookup.** If the cache already holds an entry for the key, the manager records the caller's session as an owner of that entry and returns the existing ViewModel.
4. **Create on miss.** Otherwise the manager calls `Source.CreateViewModel(this)`, initializes the result, stores it under the key with the caller's session in the owning set, and returns it.

The same `ULyraContainerViewModel` instance is shared by every widget pointing at the same source. Subscriptions to the underlying component fire once and update every bound widget.

***

### Session Ownership

Each cache entry remembers the set of sessions that currently own it. Acquiring a ViewModel adds the caller's session to that set. Closing a session removes that session from every entry it appeared in. An entry whose owning set becomes empty is uninitialized and removed in the same step.

Two windows pointing at the same container both register their sessions against the same entry. Closing one window does not evict the ViewModel because the other window's session still owns it. The cache exists to make this kind of sharing work without coordination between the widgets.

Closing a parent session also closes its child sessions. Child-container ViewModels evict before parent ones because the child sessions remove themselves first.

***

### Failsafe Cleanup

Sessions handle most eviction. Two background passes catch the rest:

`CleanupStaleViewModels` runs on every get-or-create call. It drops object-keyed entries whose weak `ContainerObject` has gone stale and GUID-keyed entries whose item can no longer be resolved through `ULyraItemSubsystem`. This catches components or items that disappear without the matching session ever closing.

`ClearAllViewModels` runs during subsystem teardown and on map transition through `HandlePreLoadMap`. It uninitializes every cached ViewModel and empties the cache. After the map transition the base session is recreated immediately, so widgets in the next map find the cache empty but the entry point available.
