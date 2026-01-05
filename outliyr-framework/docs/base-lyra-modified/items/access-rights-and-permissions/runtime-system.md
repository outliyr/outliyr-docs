# Runtime System

Most developers will never call the `UItemPermissionComponent` directly, but you still need to **understand what it does** so you can reason about bandwidth, latency, and when to listen for state changes.\
This page therefore focuses on the moving parts under the hood and on the life-cycle of a single change from _“server updates a flag”_ to _“client UI reacts”_.

***

### The cast of objects

<table><thead><tr><th width="259.9090576171875">Piece</th><th>Lives on</th><th>Role in one sentence</th></tr></thead><tbody><tr><td><strong>UItemPermissionComponent</strong> (sub-object)</td><td>Server <strong>and</strong> owning clients</td><td>Stores default rules, player-specific overrides, and replicates the deltas.</td></tr><tr><td><strong>FItemAccessRightsContainer / FItemPermissionsContainer</strong></td><td>inside the component</td><td>Fast-array wrappers that keep the network payload minimal.</td></tr><tr><td><strong>IItemPermissionOwner</strong> (interface)</td><td>the container class</td><td>Public API you <em>do</em> call from gameplay and Blueprint.</td></tr><tr><td><strong>Gameplay Message Subsystem</strong></td><td>every client</td><td>Zero-coupling event bus used to tell UI (and anything else) that rights or permissions just changed.</td></tr></tbody></table>

{% hint style="info" %}
**Remember:** your game code sees only the _interface_; the component is an internal detail. You do not call functions to the UItemPermissionComponent, but instead use interface functions.
{% endhint %}

***

### Lifecycle of a change (server → client)

{% stepper %}
{% step %}
**Authority change**

_Some gameplay rule fires:_\
`IItemPermissionOwner::Execute_SetContainerAccessRight(Inventory, TargetPC, ReadOnly)`
{% endstep %}

{% step %}
**Fast-array marks dirty**

`FItemAccessRightsContainer::Set` edits or adds an entry → `MarkItemDirty`/`MarkArrayDirty`.
{% endstep %}

{% step %}
**UObject replication pass (same frame)**

The container’s `ReplicateSubobjects` is executed for every connection.\
For connections **other** than `TargetPC` nothing is written, because the fast-array diff is empty.\
For the TargetPC channel the delta is serialized into the network bunch.
{% endstep %}

{% step %}
**Client receives bunch (frames later)**

Fast-array callback `PostReplicatedChange` runs **only** on the affected client.\
The callback calls `Owner->BroadcastAccessChanged()`.
{% endstep %}

{% step %}
**Component broadcasts Gameplay Message**

```
FItemAccessRightsChangedMessage Msg;
Msg.Container  = GetOuter();
Msg.Player     = PC;
Msg.NewAccess  = GetAccess(PC);
Subsys.BroadcastMessage(TAG_ItemPermission_Message_AccessChanged, Msg);
```
{% endstep %}

{% step %}
**Any listener reacts**

* Typical UI widget → closes itself or greys out buttons.
* Ability in progress → cancels if it suddenly lost permission.
* Chest -> Opens up if gained read access
{% endstep %}
{% endstepper %}

Bandwidth cost? **Only one payload, to one client, containing a single `uint8`.**

***

### Fast-array specifics

* **One entry per player** who deviates from the default.\
  A 64-player server where 55 players just use defaults will replicate **two tiny arrays** of nine entries each. Not 64×2.
* **Delta-based** – unchanged entries are not resent.
* **Replays** – because they are standard `FFastArraySerializer`, the permission data shows up in network replays and demo scrubbing automatically.

***

### Gameplay Message Broadcasts

Changes are broadcasted therough gameplay messages. The permission and access rights have separate tags and pyaload structs.

<table><thead><tr><th width="251.727294921875">Tag</th><th>Payload struct</th><th>Fired when…</th></tr></thead><tbody><tr><td><code>Lyra.ItemPermission.Message.AccessChanged</code></td><td><code>FItemAccessRightsChangedMessage</code></td><td><em>Default</em> changed or a per-player entry added/edited/removed.</td></tr><tr><td><code>Lyra.ItemPermission.Message.PermissionsChanged</code></td><td><code>FItemPermissionsChangedMessage</code></td><td>Same but for the permission bitmask.</td></tr></tbody></table>

{% hint style="info" %}
**Hint** : listen for _both_ tags when your widget can only be open with certain permission as both work hand in hand.
{% endhint %}

#### Common listener blueprint (one-time setup)

{% tabs %}
{% tab title="Pseduo Code" %}
```blueprint
Event Construct →
    Get GameplayMessageSubsystem →
    Register Listener
        Channel Tag = "Lyra.ItemPermission.Message.AccessChanged"
        Function    = OnAccessRightChanged   (custom event)

OnAccessRightChanged (Msg : ItemAccessRightsChanged)
    If Msg.Container == MyContainer and Mes.PlayerController == MyPlayerController
        Switch (Msg.NewAccess)
            ReadOnly   →  DisableDragDrop()
            ReadWrite →  EnableInteraction()
            NoAccess   →  CloseWindow()
```
{% endtab %}

{% tab title="Example Image" %}
<figure><img src="../../../.gitbook/assets/image (41).png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
_Unregister_ the gameplay message in `Event Destruct` to avoid dangling handles.
{% endhint %}

***

### Authority & safety recap

* **All mutator functions** on the interface are tagged `BlueprintAuthorityOnly`.\
  Calling them on a predicting client simply does nothing, no runtime crash, no exploit.
* Clients can **never** directly grab the component pointer (private + not exposed).\
  Even a malicious Blueprint can’t alter another player’s rules.
* **Prediction** is safe: abilities typically request `ReadWrite` _+ specific Permission_; if the server later denies it, prediction is rolled back automatically.

***

### Putting it together

1. **Container calls setters** whenever the game rules change **using the interface** functions (e.g. player enters interaction range ⇒ grant `ReadOnly`).
2. **Component replicates** minimal deltas to the affected client(s).
3. Client-side **callbacks fire**, which in turn broadcast gameplay messages.
4. **UI & abilities react** instantly and in a fully decoupled fashion.

The runtime layer therefore stays self-contained, performant, and reusable, ready for the higher-level systems that sit on top.
