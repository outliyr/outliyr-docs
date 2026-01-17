# Camera and UI

The goal is to make spectators feel like they're looking at the spectated player's screen. This means matching the camera exactly, including zoom, FOV, and offsets from ADS, and displaying the same UI elements (quickbar, ammo, crosshair).

### Camera Mimicking

Both the player pawn and `ATeammateSpectator` use `ULyraCameraComponent` with a stack of `ULyraCameraMode` instances. The spectator achieves camera matching by activating the **same camera mode class** as the player.

#### How It Works

{% stepper %}
{% step %}
Player enters ADS.
{% endstep %}

{% step %}
Player's camera component pushes ADS camera mode.
{% endstep %}

{% step %}
Player's camera broadcasts "CameraModeChanged" message locally.
{% endstep %}

{% step %}
Player's SpectatorDataProxy listener catches it.
{% endstep %}

{% step %}
Proxy calls `Server_UpdateCameraMode` RPC.
{% endstep %}

{% step %}
Server updates `SpectatorDataContainer.CameraMode`.
{% endstep %}

{% step %}
Container replicates to spectator.
{% endstep %}

{% step %}
Spectator's `OnRep_CameraMode` fires, broadcasts local message.
{% endstep %}

{% step %}
`ATeammateSpectator.OnCameraChangeMessage` catches it.
{% endstep %}

{% step %}
Spectator's `DetermineCameraMode()` now returns the ADS mode.
{% endstep %}

{% step %}
Spectator's camera activates ADS mode.
{% endstep %}

{% step %}
Spectator sees the same zoom/FOV as the player.
{% endstep %}
{% endstepper %}

### Why Same Class = Same View

Camera modes define their view parameters (FOV, offset, blend time) internally. When both pawns activate the same mode class, they use identical settings. The spectator's camera component computes the view relative to the **target pawn** (the spectated player's pawn), so the result matches.

***

### UI Updates via Messages

UI widgets don't bind directly to the `SpectatorDataContainer`. Instead, they listen for **local Gameplay Messages** broadcast when container properties replicate.

#### The Message Pattern

```plaintext
Container property changes (via replication)
    → OnRep_ function fires on spectator client
    → OnRep_ broadcasts a local message with the new data
    → UI widget listener receives message
    → Widget updates its display
```

Why messages? Decoupling. The container doesn't know (or care) which widgets exist. Any widget can listen for the messages it needs. You can add new widgets without modifying the container.

#### Available Messages

| Tag                                                | Payload                 | Triggered When           |
| -------------------------------------------------- | ----------------------- | ------------------------ |
| `ShooterGame.Spectator.Message.SlotsChanged`       | Array of item instances | Quickbar contents change |
| `ShooterGame.Spectator.Message.ActiveIndexChanged` | New active slot index   | Selected weapon changes  |
| `ShooterGame.Spectator.Message.CameraModeChanged`  | New camera mode class   | Camera mode changes      |
| `ShooterGame.Spectator.Message.ToggleADS`          | ADS state (bool)        | ADS on/off               |

### Example: The ADS Flow

A complete walkthrough of what happens when the spectated player toggles ADS:

```mermaid
sequenceDiagram
    participant Player as Spectated Player
    participant ProxyC as Proxy (Client)
    participant ProxyS as Proxy (Server)
    participant Container
    participant Spec as Spectator

    Note over Player: Player presses ADS input

    Player->>Player: Camera pushes ADS mode
    Player->>ProxyC: Local message: CameraModeChanged
    ProxyC->>ProxyS: Server_UpdateCameraMode(ADSMode)
    ProxyS->>Container: SetCameraMode(ADSMode)

    Note over Container: Replicates to subscribed spectators

    Container-->>Spec: CameraMode = ADSMode
    Spec->>Spec: OnRep_CameraMode()
    Spec->>Spec: Broadcast: TAG_Spectator_Message_CameraModeChanged

    Note over Spec: ATeammateSpectator catches message

    Spec->>Spec: CurrentCameraMode = ADSMode
    Spec->>Spec: DetermineCameraMode() returns ADSMode
    Spec->>Spec: Camera activates ADS zoom/FOV

    Note over Spec: Spectator now sees ADS view
```

### Building Spectator UI Widgets

When creating custom spectator UI, follow this pattern.

{% stepper %}
{% step %}
Listen for Messages

In your widget's initialization:

```plaintext
// Blueprint pseudocode
OnInitialized:
    GameplayMessageSubsystem.RegisterListener(
        TAG_ShooterGame_Spectator_Message_SlotsChanged,
        self,
        OnSlotsChanged
    )
    GameplayMessageSubsystem.RegisterListener(
        TAG_ShooterGame_Spectator_Message_ActiveIndexChanged,
        self,
        OnActiveIndexChanged
    )
```
{% endstep %}

{% step %}
Handle the Message

Extract data from the payload and update your widget:

```plaintext
OnSlotsChanged(Message):
    QuickBarSlots = Message.Slots
    RebuildSlotWidgets(QuickBarSlots)

OnActiveIndexChanged(Message):
    ActiveIndex = Message.ActiveIndex
    HighlightSlot(ActiveIndex)
```
{% endstep %}

{% step %}
Read Item Data

The quickbar slots contain actual `ULyraInventoryItemInstance` pointers. You can read their properties:

```plaintext
// Get the active weapon instance
ActiveWeapon = QuickBarSlots[ActiveIndex]

// Read ammo (updated via inventory query system)
SpareAmmo = ActiveWeapon.GetStatTagStackCount(TAG_Lyra_Weapon_SpareAmmo)

// Get weapon definition for icon/name
WeaponDef = ActiveWeapon.GetItemDefinition()
```
{% endstep %}
{% endstepper %}

<img src=".gitbook/assets/image (219).png" alt="" title="Spectator quickbar slot widget listening for spectator events">

### Ammo Tracking

Ammo counts deserve special mention because they're stored in the player's **inventory**, not on the weapon instance. The system handles this through a server-side query mechanism:

{% stepper %}
{% step %}
Container notices quickbar weapon has InventoryAmmoTypes.
{% endstep %}

{% step %}
Container creates a `ULyraInventoryQuery` for those ammo types.
{% endstep %}

{% step %}
Query monitors inventory for stack changes.
{% endstep %}

{% step %}
When ammo changes, query calls `HandleInventoryAmmoUpdated`.
{% endstep %}

{% step %}
Handler sets `TAG_Lyra_Weapon_SpareAmmo` on the weapon instance.
{% endstep %}

{% step %}
Weapon instance replicates to spectator.
{% endstep %}

{% step %}
Spectator UI reads the stat tag.
{% endstep %}
{% endstepper %}

This ensures the spectator sees accurate ammo counts even though they don't have direct access to the player's inventory.

## Summary

| System     | How It Works                                                                           |
| ---------- | -------------------------------------------------------------------------------------- |
| **Camera** | Same mode class = same view parameters. Mode class replicates, spectator activates it. |
| **UI**     | Container OnRep_ → local messages → widgets listen and update                         |
| **Ammo**   | Server queries inventory, sets stat tag on weapon, weapon replicates to spectator      |

The message-based approach means you can build any spectator UI without touching the core system. Just listen for the messages you need and update accordingly.
