# Item Container UI Manager

The `ULyraItemContainerUIManager` is the primary entry point for any developer interacting with the item container UI. It exists as a `LocalPlayerSubsystem`, meaning there is exactly one instance per local player.

Its primary responsibility is to act as the **Source of Truth** for all active container data.

***

## Why Do We Need a Manager?

In naive implementations, a widget often creates its own ViewModel:

```cpp
// Bad Implementation
void UMyInventoryWidget::NativeConstruct() {
    MyViewModel = NewObject<UInventoryViewModel>(this);
    MyViewModel->Init(InventoryComponent);
}
```

#### **The Problem**

1. **Duplication:** If you have an Inventory Window open AND a Crafting Window that shows your inventory, you now have two ViewModels processing the same data twice.
2. **State Desync:** If the Inventory Window selects an item, the Crafting Window doesn't know about it.
3. **Memory Leaks:** If the widget is removed but the ViewModel is still bound to a global delegate, it stays in memory forever.

#### **The Solution**&#x20;

the manager keeps one ViewModel per container and shares it across every widget that asks for the same one. When no widget needs it anymore, the manager tears it down. The next pages explain how that works.

***

## Core Responsibilities

The manager handles three jobs, detailed on the sub-pages below.

#### **Sessions**

A single player action often opens several related windows. Opening a chest puts the chest's contents on screen; inspecting an item inside might open a second window; an attachment view of a gun inside that item might open a third. These windows belong together, closing the chest should close all of them.

A **session** is the manager's way of grouping windows that share a lifetime. Closing a session closes every window in it, and sessions can nest (closing a parent closes the children).

One session is always present from the moment the UI is up: the **base session**. It owns the always-on inventory windows like the main inventory and equipment screen, and is also the home for static inventory UI that displays container data without using window shells.

Custom widgets that aren't window shells but still have their own open/close lifecycle, a loot-container preview, a transient interaction screen, can create their own session under the base session, then close it when the widget closes. The ViewModels they acquired during that lifetime are released through the same cascade that closes any other session.

See [Session Management](session-management.md) for the full picture, including how the manager closes sessions automatically when their underlying state goes away.

#### **ViewModels for Containers**

When a widget asks the manager for the ViewModel of a container, the manager either creates one or hands back the instance it created last time. Five widgets viewing the same container all get the same ViewModel and stay in sync because they share its bindable state. The manager releases ViewModels automatically as the sessions that wanted them close.

See [ViewModel Cache](viewmodel-cache.md).

#### **Server-Authority Enforcement**

The server is the source of truth for what containers exist and who can see them. When server state changes, an item gets destroyed, a permission is revoked, an actor goes out of range, the manager listens to the Gameplay Message Subsystem (`Lyra.Item.Message.*`) and closes any open UI that no longer has a right to be there.

See [Lifecycle & Security](lifecycle-and-security.md).

***

## Integration Point

{% tabs %}
{% tab title="Blueprint" %}
<figure><img src="../../../../.gitbook/assets/image (1) (1).png" alt=""><figcaption><p>Example of using the Item Container UI manager to get the interaction view model</p></figcaption></figure>
{% endtab %}

{% tab title="C++" %}
If you are writing a custom C++ widget without a shell, you ask the manager for the ViewModel under a session handle. The base session covers anything player-scoped:

<pre class="language-cpp"><code class="lang-cpp"><strong>void UMyCustomWidget::SetSource(const FInstancedStruct&#x26; Source)
</strong>{
    ULyraItemContainerUIManager* Manager = GetLocalPlayer()->GetSubsystem&#x3C;ULyraItemContainerUIManager>();
    
    // 1. Get the shared ViewModel
    MyViewModel = Manager->GetOrCreateViewModelForSession(
        Source, Manager->GetBaseSession());
    
    // 2. Bind to it
    // ...
}

void UMyCustomWidget::NativeDestruct()
{
    // 3. Return it when done
    if (MyViewModel)
    {
        GetManager()->ReleaseViewModel(Source);
    }
}
</code></pre>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
Widgets hosted inside a `LyraItemContainerWindowShell` should call `Shell->GetOrCreateViewModel(Source)` instead. The shell already owns the session.
{% endhint %}
