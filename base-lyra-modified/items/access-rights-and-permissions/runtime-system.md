# Runtime System

Most developers will never call the `UItemPermissionComponent` directly, but you still need to **understand what it does** so you can reason about bandwidth, latency, and when to listen for state changes.\
This page therefore focuses on the moving parts under the hood and on the life-cycle of a single change from _“server updates a flag”_ to _“client UI reacts”_.

***

### The cast of objects

| Piece                                                      | Lives on                      | Role in one sentence                                                                                 |
| ---------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| **UItemPermissionComponent** (sub-object)                  | Server **and** owning clients | Stores default rules, player-specific overrides, and replicates the deltas.                          |
| **FItemAccessRightsContainer / FItemPermissionsContainer** | inside the component          | Fast-array wrappers that keep the network payload minimal.                                           |
| **IItemPermissionOwner** (interface)                       | the container class           | Public API you _do_ call from gameplay and Blueprint.                                                |
| **Gameplay Message Subsystem**                             | every client                  | Zero-coupling event bus used to tell UI (and anything else) that rights or permissions just changed. |

> [!info]
> **Remember:** your game code sees only the _interface_; the component is an internal detail. You do not call functions to the UItemPermissionComponent, but instead use interface functions.

***

### Lifecycle of a change (server → client)

* **Authority change**\
  &#xNAN;_&#x53;ome gameplay rule fires:_\
  `IItemPermissionOwner::Execute_SetContainerAccessRight(Inventory, TargetPC, ReadOnly)`
* **Fast-array marks dirty**\
  `FItemAccessRightsContainer::Set` edits or adds an entry → `MarkItemDirty`/`MarkArrayDirty`.
* **UObject replication pass (same frame)**\
  The container’s `ReplicateSubobjects` is executed for every connection.\
  &#xNAN;_&#x46;or connections **other** than `TargetPC` nothing is written_, because the fast-array diff is empty.\
  For the `TargetPC` channel the delta is serialized into the network bunch.
* **Client receives bunch (frames later)**\
  Fast-array callback `PostReplicatedChange` runs **only** on the affected client.\
  The callback calls `Owner->BroadcastAccessChanged()`.
*   **Component broadcasts Gameplay Message**

    ```cpp
    FItemAccessRightsChangedMessage Msg;
    Msg.Container  = GetOuter();
    Msg.Player     = PC;
    Msg.NewAccess  = GetAccess(PC);
    Subsys.BroadcastMessage(TAG_ItemPermission_Message_AccessChanged, Msg);
    ```
* **Any listener reacts**
  * Typical UI widget → closes itself or greys out buttons.
  * Ability in progress → cancels if it suddenly lost permission.
  * Chest -> Opens up if gained read access

Bandwidth cost? **Only one payload, to one client, containing a single `uint8`.**

***

### Fast-array specifics

* **One entry per player** who deviates from the default.\
  A 64-player server where 55 players just use defaults will replicate **two tiny arrays** of nine entries each. Not 64×2.
* **Delta-based** – unchanged entries are not resent.
* **Replays** – because they are standard `FFastArraySerializer`, the permission data shows up in network replays and demo scrubbing automatically.

***

### Why Gameplay Messages instead of delegates?

* Works in **Blueprint** without exposing raw component pointers.
* Multiple unaffiliated systems can listen to the same event (UI, audio feedback, analytics).
* They survive map-seam travel when both sides stay in memory.
* The message payload is **copy-constructed**, so listeners cannot mutate the authoritative data by mistake.

| Tag                                              | Payload struct                    | Fired when…                                                   |
| ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------- |
| `Lyra.ItemPermission.Message.AccessChanged`      | `FItemAccessRightsChangedMessage` | _Default_ changed or a per-player entry added/edited/removed. |
| `Lyra.ItemPermission.Message.PermissionsChanged` | `FItemPermissionsChangedMessage`  | Same but for the permission bitmask.                          |

> [!info]
> **Hint** : listen for _both_ tags when your widget can only be open with certain permission as both work hand in hand.

#### Common listener blueprint (one-time setup)

<!-- tabs:start -->
#### **Pseduo Code**
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
            FullAccess →  EnableInteraction()
            NoAccess   →  CloseWindow()
```


#### **Example Image**
<img src=".gitbook/assets/image (41).png" alt="" title="">

<!-- tabs:end -->

> [!info]
> _Unregister_ the gameplay message in `Event Destruct` to avoid dangling handles.

***

### Authority & safety recap

* **All mutator functions** on the interface are tagged `BlueprintAuthorityOnly`.\
  Calling them on a predicting client simply does nothing, no runtime crash, no exploit.
* Clients can **never** directly grab the component pointer (private + not exposed).\
  Even a malicious Blueprint can’t alter another player’s rules.
* **Prediction** is safe: abilities typically request _FullAccess + specific Permission_; if the server later denies it, prediction is rolled back automatically.

***

### Putting it together

1. **Container calls setters** whenever the game rules change **using the interface** functions (e.g. player enters interaction range ⇒ grant `ReadOnly`).
2. **Component replicates** minimal deltas to the affected client(s).
3. Client-side **callbacks fire**, which in turn broadcast gameplay messages.
4. **UI & abilities react** instantly and in a fully decoupled fashion.

The runtime layer therefore stays self-contained, performant, and reusable – ready for the higher-level systems (GAS abilities, UI, AI logic) that sit on top.
