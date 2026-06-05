# ViewModels Without a Window Shell

The container UI subsystem is independent of the windowing system. Sources, ViewModels, the cache, and reactivity all work without ever opening a window shell or activating the inventory layer.

Most action games do not use windowed inventory UI. The player presses one button, a single screen with their inventory and equipment appears, they press the button again, and it disappears. The window shell system was built for the other case, Tarkov / Tetris-style designs where the player drags separate inventory, equipment, attachment, and item-inspection windows around independently. If your design looks like the first one, you do not need window shells, and this page is the right starting point.

There are two patterns for getting a ViewModel without a window shell. The first is **player-scoped persistence**, a static inventory screen, an equipment panel, anything that should keep its ViewModel state across multiple open/close cycles. These ViewModels live on the base session. The second is **a widget with its own bounded lifecycle**, a loot-container preview that pops up when the player walks up to a chest, a custom interaction screen that opens and closes with a gameplay event. These ViewModels should be released when the widget closes, so the widget creates its own session and closes it on teardown.

This page walks through both patterns and explains how to pick between them.

***

## Why You Can Skip the Windowing System

The windowing system handles drag-rearrangeable surfaces, focusable subwindows, nested context windows, and the cascading close behaviour described under session management. If your design doesn't need those features, you don't need a window shell.

The pieces below stay available regardless:

* **Polymorphic container sources** — describe what container to view through `FInventoryContainerSource`, `FEquipmentContainerSource`, or any custom source you write.
* **The ViewModel cache** — created on `ULyraItemContainerUIManager` initialization, available for the player's lifetime.
* **The base session** — created alongside the manager, survives map transitions, and serves as the owner (or parent) for any session your widgets create.
* **MVVM reactivity** — FieldNotify properties on the ViewModel update bound widgets automatically.

The only piece you skip is `ULyraItemContainerLayer`. The cache, sessions, and ViewModels are not gated on it.

***

## Pattern 1: Player-Scoped Widget Under the Base Session

Use this for the widgets that make up the player's main inventory UI, the static screen they open with one button to see their inventory and equipment, an always-available character panel, any item-container surface the player will open and close many times during a play session. The ViewModels should be cached across reopens so the screen comes back instantly without rebuilding.

### The Basic Call

```cpp
ULyraItemContainerUIManager* UIManager =
    LocalPlayer->GetSubsystem<ULyraItemContainerUIManager>();

FInventoryContainerSource Source;
Source.InventoryComponent = MyInventoryComponent;

ULyraContainerViewModel* VM = UIManager->GetOrCreateViewModelForSession(
    FInstancedStruct::Make(Source),
    UIManager->GetBaseSession());
```

The ViewModel returned is fully initialized, bound to the underlying component's `OnViewDirtied`, and ready for `FieldNotify` bindings. The base session owns the cache entry, so the ViewModel persists for the player's lifetime and is shared with any other widget that asks for the same source.

In Blueprints the same call exists on the UI manager as `GetOrCreateViewModelForSession`. The session handle is `Get Base Session` on the same manager.

### Worked Example: A Static Inventory Screen

This example shows the widget for a single-screen inventory UI, the kind a player opens with one button and that displays their inventory and equipment side by side. No window shell, no layer activation, no session ceremony.

<details>

<summary>Widget header</summary>

```cpp
UCLASS()
class UStaticInventoryScreen : public UUserWidget
{
    GENERATED_BODY()

public:
    virtual void NativeConstruct() override;

protected:
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UInventoryGridWidget> InventoryGrid;

    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UEquipmentPanelWidget> EquipmentPanel;

    UPROPERTY()
    TObjectPtr<ULyraInventoryViewModel> InventoryVM;

    UPROPERTY()
    TObjectPtr<ULyraEquipmentViewModel> EquipmentVM;
};
```

</details>

<details>

<summary>Widget implementation</summary>

```cpp
void UStaticInventoryScreen::NativeConstruct()
{
    Super::NativeConstruct();

    ULocalPlayer* LP = GetOwningLocalPlayer();
    ULyraItemContainerUIManager* UIManager =
        LP ? LP->GetSubsystem<ULyraItemContainerUIManager>() : nullptr;
    if (!UIManager) { return; }

    if (ULyraInventoryManagerComponent* Inventory = ResolvePlayerInventory())
    {
        FInventoryContainerSource InvSource;
        InvSource.InventoryComponent = Inventory;

        InventoryVM = Cast<ULyraInventoryViewModel>(
            UIManager->GetOrCreateViewModelForSession(
                FInstancedStruct::Make(InvSource),
                UIManager->GetBaseSession()));

        InventoryGrid->SetContainerViewModel(InventoryVM);
    }

    if (ULyraEquipmentManagerComponent* Equipment = ResolvePlayerEquipment())
    {
        FEquipmentContainerSource EquipSource;
        EquipSource.EquipmentComponent = Equipment;

        EquipmentVM = Cast<ULyraEquipmentViewModel>(
            UIManager->GetOrCreateViewModelForSession(
                FInstancedStruct::Make(EquipSource),
                UIManager->GetBaseSession()));

        EquipmentPanel->SetContainerViewModel(EquipmentVM);
    }
}
```

</details>

The widget never touches `ULyraItemContainerLayer`, never opens a window shell, never creates its own session. The base session keeps both ViewModels alive across as many open/close cycles as the player triggers, and FieldNotify drives the bound sub-widgets' refreshes when items change.

If the player closes the screen and reopens it a moment later, the same `InventoryVM` and `EquipmentVM` instances come back from the cache. Nothing rebuilds, nothing re-subscribes.

***

## Pattern 2: Widget With Its Own Bounded Lifecycle

Use this when the widget exists for a limited time, a loot-container preview that appears while the player is near a chest, an inspection panel that opens for a single item, a custom interaction screen that opens and closes with a gameplay event. The ViewModel should disappear when the widget closes, even if the player will eventually open another widget like it.

If you put a transient widget on the base session by mistake, every container the player ever looks at accumulates a ViewModel that lives until the player session ends. The bounded-lifecycle pattern avoids that by giving each widget its own session.

### The Basic Call

```cpp
// On construct: create the session, then acquire the ViewModel under it.
SessionHandle = UIManager->CreateChildSession(
    TAG_UI_Session_LootPreview,      // SessionType: a tag you define
    FInstancedStruct::Make(Source),  // SourceContext: the source that triggered this widget
    UIManager->GetBaseSession()      // ParentSession: usually the base session
);

ViewModel = UIManager->GetOrCreateViewModelForSession(
    FInstancedStruct::Make(Source), SessionHandle);

// On destruct: close the session. The cascade releases the ViewModel.
UIManager->CloseSession(SessionHandle, EItemWindowCloseReason::Programmatic);
```

`CreateChildSession` returns a `FItemWindowSessionHandle`. Store it on the widget, you need it both for any further `GetOrCreateViewModelForSession` calls and for the close call on destruct.

### Worked Example: A Loot-Container Preview

This widget appears when the player walks up to a chest. It shows the contents of the chest's inventory as long as the widget is on screen. When the widget tears down, the ViewModel is released, so reopening the next chest creates a fresh ViewModel for that chest's inventory.

<details>

<summary>Widget header</summary>

```cpp
UCLASS()
class ULootContainerPreview : public UUserWidget
{
    GENERATED_BODY()

public:
    void InitializeForContainer(ULyraInventoryManagerComponent* InContainer);

    virtual void NativeConstruct() override;
    virtual void NativeDestruct() override;

protected:
    UPROPERTY(meta = (BindWidget))
    TObjectPtr<UListView> ItemList;

    UPROPERTY()
    TObjectPtr<ULyraInventoryViewModel> InventoryVM;

private:
    UPROPERTY()
    TWeakObjectPtr<ULyraInventoryManagerComponent> Container;

    FItemWindowSessionHandle SessionHandle;
};
```

</details>

<details>

<summary>Widget implementation</summary>

```cpp
void ULootContainerPreview::InitializeForContainer(ULyraInventoryManagerComponent* InContainer)
{
    Container = InContainer;
}

void ULootContainerPreview::NativeConstruct()
{
    Super::NativeConstruct();

    ULocalPlayer* LP = GetOwningLocalPlayer();
    ULyraItemContainerUIManager* UIManager =
        LP ? LP->GetSubsystem<ULyraItemContainerUIManager>() : nullptr;
    if (!UIManager || !Container.IsValid()) { return; }

    FInventoryContainerSource Source;
    Source.InventoryComponent = Container.Get();
    FInstancedStruct SourceStruct = FInstancedStruct::Make(Source);

    // Open a session scoped to this widget. The ViewModels we acquire under
    // it are released when the session closes on NativeDestruct.
    SessionHandle = UIManager->CreateChildSession(
        TAG_UI_Session_LootPreview,
        SourceStruct,
        UIManager->GetBaseSession()
    );

    InventoryVM = Cast<ULyraInventoryViewModel>(
        UIManager->GetOrCreateViewModelForSession(SourceStruct, SessionHandle));

    if (InventoryVM)
    {
        ItemList->SetListItems(InventoryVM->Items);
    }
}

void ULootContainerPreview::NativeDestruct()
{
    if (SessionHandle.IsValid())
    {
        ULocalPlayer* LP = GetOwningLocalPlayer();
        if (ULyraItemContainerUIManager* UIManager =
                LP ? LP->GetSubsystem<ULyraItemContainerUIManager>() : nullptr)
        {
            UIManager->CloseSession(SessionHandle, EItemWindowCloseReason::Programmatic);
        }
        SessionHandle = FItemWindowSessionHandle();
    }

    Super::NativeDestruct();
}
```

</details>

When the widget closes, the session closes too. The session's cache entries are released, the `OnViewDirtied` subscription on the container is torn down, and the next chest the player opens starts fresh. If the container is destroyed server-side while the widget is open, the manager's destruction observer closes the session for you, the widget's `NativeDestruct` will still run its close call but `IsValid()` returns false at that point, so the second close is harmless.

***

## Picking Between the Two Patterns

The decision is about lifetime, not visuals:

* **Player-scoped persistence?** Use Pattern 1. The widget will open and close many times during a play session and should keep its ViewModel state across reopens, the main static inventory screen, an equipment panel, anything central to the player's UI.
* **Bounded lifetime tied to the widget's own open/close?** Use Pattern 2. The widget creates a session in `NativeConstruct` and closes it in `NativeDestruct`. Use this for transient containers, loot previews, item inspections, where retaining the ViewModel after the widget closes would just accumulate dead state.

If both apply (a static inventory screen that should persist _and_ a separate inspection widget that should not), each widget picks its own pattern independently. They can both view the same container, the cache de-duplicates as long as the source identity matches.

***

## When to Reach for the Window Shell System Instead

The two patterns above cover the case where the player's inventory UI is a single screen (or a small set of screens) that appears and disappears as a whole. Reach for the window shell system instead when your design is closer to **Tarkov / Tetris-style UI**, separate movable windows for inventory, equipment, attachments, item inspection, loot containers, where the player can drag them around, close individual windows, and open more on demand. That's the case the windowing system was built for.

In windowed UI the shell handles the features you'd otherwise have to wire up by hand:

* **Drag-rearrangeable surfaces** — moving a window shell around the screen with focus and z-order management.
* **Nested context windows** — a parent window shell that spawns child window shells whose lifetime cascades from the parent.
* **Per-shell focus and navigation** — controller navigation that scopes to a window shell and hops to siblings via the cross-window navigation rules.
* **Startup window shells** — registering shells that the Window Host spawns automatically when it activates.

The decision is "does my design have windowed UI?" not "do I need an inventory ViewModel?" If the answer is no, one of the two patterns above is enough.

***

## Mixed UIs

Nothing prevents widgets using different patterns from reading the same container. A static inventory screen (Pattern 1), a loot-container preview (Pattern 2), and a windowed inventory shell all looking at the same source acquire the same `ULyraInventoryViewModel` instance through the cache. Each registers its own session against the entry, and the entry stays alive as long as at least one session still owns it.

Closing the loot preview removes its session from the entry. If the static inventory screen and the windowed inventory still have it open, the ViewModel stays alive, the cache is doing exactly what it should.

This is what the cache exists for. None of the widgets need to know what the others are doing.
