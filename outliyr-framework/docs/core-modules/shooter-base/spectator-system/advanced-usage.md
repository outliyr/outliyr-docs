# Advanced Usage

The Spectator System's components are designed for reuse. This page covers when you need the full Proxy/Container system versus when you can use just `ATeammateSpectator`, and how to build custom spectating flows.

***

### TeammateSpectator as a Camera Platform

`ATeammateSpectator` is fundamentally a **camera platform** that can attach to any pawn and mimic its view. The Proxy/Container system is just one way to feed it data.

#### What TeammateSpectator Provides

| Feature                  | Description                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Ability System Component | Integrates with the ability system component so abilities can be run while spectating |
| Camera attachment        | Sets its `ULyraCameraComponent`'s target to any pawn                                  |
| Camera mode mimicking    | Can use any `ULyraCameraMode` class you tell it                                       |
| Tick synchronization     | Ticks after target pawn's mesh for smooth following                                   |
| Target management        | Internal list for cycling through valid targets                                       |
| Message broadcasting     | Notifies listeners when target changes                                                |

#### What It Doesn't Require

* It doesn't need the Proxy to function
* It doesn't need the Container to function
* It can receive camera mode data from any source
* It can be spawned locally without server possession

***

### When You Need Proxy/Container

Use the full Proxy/Container system when:

| Scenario                              | Why Proxy/Container                                     |
| ------------------------------------- | ------------------------------------------------------- |
| **Live spectating teammates**         | Need to replicate current gameplay state across network |
| **Multiple spectators on one target** | Subscription list manages who gets data                 |
| **UI needs quickbar/ammo data**       | Container replicates item instances                     |
| **Client state must reach server**    | Proxy relays camera mode via RPC                        |

***

#### When You Can Bypass Proxy/Container

Bypass them when you already have the data:

| Scenario                    | Why Bypass                                       |
| --------------------------- | ------------------------------------------------ |
| **Replay/Killcam playback** | Data comes from recording, not live replication  |
| **Local-only viewing**      | Single-player or client-only spectating          |
| **Direct data injection**   | You're providing camera/target data directly     |
| **Simple follow-cam**       | Just need to attach to a pawn, no UI data needed |

***

### Example: How Killcam Uses TeammateSpectator

The [Kill Cam system](../kill-cam/) demonstrates bypassing the Proxy/Container:

{% stepper %}
{% step %}
#### Killcam: Player dies, killcam activates

Trigger killcam flow on death.
{% endstep %}

{% step %}
#### Killcam: Spawn spectator locally

Victim's client spawns `ATeammateSpectator` locally
{% endstep %}

{% step %}
#### Killcam: Data source is replay

Killer's data comes from replay recording, not live replication.
{% endstep %}

{% step %}
#### Killcam: Pass killer pawn directly

Killcam passes killer's pawn directly to spectator.
{% endstep %}

{% step %}
#### Killcam: Camera mode from playback component

Camera mode comes from `KillcamCameraPlayback` component, not Container.
{% endstep %}

{% step %}
#### Killcam: No subscription needed

No subscription needed, data is already local.
{% endstep %}
{% endstepper %}

### Key Differences from Live Spectating

| Aspect             | Live Spectating             | Killcam               |
| ------------------ | --------------------------- | --------------------- |
| Spawn location     | Server                      | Client (local)        |
| Possession         | Server possesses            | View target only      |
| Data source        | Proxy/Container replication | Replay recording      |
| Subscription       | Required                    | Not needed            |
| Camera mode source | Container.CameraMode        | KillcamCameraPlayback |

***

### Building Custom Spectating Flows

#### Pattern 1: Local-Only Spectating

For single-player or client-only scenarios:

{% stepper %}
{% step %}
**SpawnTeammateSpectator**

* Spawn locally:
  * `Spectator = SpawnActor(ATeammateSpectator)`
* Initialize without server possession:
  * `Spectator.SpawnedOnClient(LocalController)`
* Set target directly:
  * `Spectator.SetObservedPawn(TargetPawn)`
* Optionally set camera mode directly:
  * `Spectator.CurrentCameraMode = DesiredCameraMode`

Use `SpawnedOnClient()` instead of `PossessedBy()` for client-side initialization.
{% endstep %}
{% endstepper %}

#### Pattern 2: Custom Data Source

If you have your own data source (e.g., recorded data):

{% stepper %}
{% step %}
**UpdateSpectatorFromMyData(Spectator, MyData)**

* Set target:
  * `Spectator.SetObservedPawn(MyData.TargetPawn)`
* Set camera mode directly:
  * `Spectator.CurrentCameraMode = MyData.CameraMode`
* UI updates via your own messages or direct binding:
  * `BroadcastMyCustomUIMessage(MyData.QuickbarState)`

Don't use Container messages, update directly from your data source.
{% endstep %}
{% endstepper %}

#### Pattern 3: Hybrid (Server-Controlled, Custom Data)

Server controls possession but data comes from elsewhere:

{% stepper %}
{% step %}
**Server spawns and possesses normally**

* `Spectator = SpawnActor(ATeammateSpectator)`
* `PlayerController.Possess(Spectator)`
{% endstep %}

{% step %}
**Skip proxy subscription and update directly**

* Skip proxy subscription.
* Directly update the spectator:
  * `Spectator.SpectatePlayerState(TargetPlayerState)`
* Feed camera data from your source:
  * `MyDataSystem.OnCameraChanged.AddListener(Spectator.OnMyCameraChanged)`
{% endstep %}
{% endstepper %}

***

### Helper Functions

`ATeammateSpectator` provides several entry points:

| Function                                  | Use Case                               |
| ----------------------------------------- | -------------------------------------- |
| `PossessedBy()`                           | Standard server possession flow        |
| `SpawnedOnClient()`                       | Local-only client spawning             |
| `SetObservedPawn()`                       | Set target by PlayerState index        |
| `SpectatePlayerState()`                   | Set target directly (clears team list) |
| `PopulatePlayerTeam()`                    | Fill internal target list from team    |
| `WatchNextPawn()` / `WatchPreviousPawn()` | Cycle through targets                  |
| `FinishSpectatingOnClient()`              | Cleanup for client-spawned spectators  |

***

### Cleanup

When spectating ends:

```plaintext
// Server-possessed spectators:
Controller.Possess(NewPawn)  // Automatically unpossesses spectator
// GA_Spectate cleans up widgets/input on EndAbility
```

For client-spawned spectators:

```plaintext
Spectator.FinishSpectatingOnClient()
DestroyActor(Spectator)
```

Always clean up subscriptions if you used them:

```plaintext
TargetProxy.SetSpectatorSubscribed(SpectatorController, false)
```

***
