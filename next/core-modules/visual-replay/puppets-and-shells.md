# Puppets and Shells

A replay is drawn by puppets and run by shells. Puppets reproduce exactly what was on screen, and shells reproduce what the recorded actors *were*, so their own logic can show markers, attach effects and feed the HUD. This page covers what each layer is, how a shell is brought to life, how the two stay together, and what a shell deliberately doesn't do.

***

## Puppets

There is one puppet per recorded actor that had at least one recorded mesh. A puppet is an inert actor that exists only on this machine. It doesn't tick, replicate, collide or take damage, and it holds one **mirror** for each of the actor's recorded meshes.

* **A static mesh mirror** is a static mesh component that takes the recorded transform, visibility and materials.
* **A skeletal mesh mirror** is a real skeletal mesh component that follows a hidden **pose driver** holding the replayed pose. Because the visible mirror is an ordinary skeletal mesh, anything that asks the puppet for a bone or a socket finds the recorded pose.

Mirrors use absolute transforms and have no collision, physics, overlaps or navigation. The one exception is a mesh with cloth: its mirror ticks so the cloth simulates, and the cloth is reset whenever the mirror reappears so it doesn't swing in from where it was last shown.

Each update, mirrors are blended between the two recorded samples around the replay time, and the puppet itself is placed from the part that places its actor, such as a character's capsule. A puppet whose parts are all out of the window waits at the nearest place it was recorded, never at the world origin.

***

## Shells

A shell is a real copy of a recorded replicated actor, of the actor's own class. It is brought up the way a client receives an actor from the network, which is the most important fact about it.

```
bring up a shell:
    spawn the recorded class, construction deferred, at the puppet's place
    make it a simulated proxy with a remote authority    // HasAuthority() is false; BeginPlay waits, as for a network actor
    turn off auto-possess                               // a client never spawns a controller for a pawn it receives
    keep it out of the live world                       // hidden, no collision, no ticks, unseen by AI, off the player list
    apply the whole recorded state at the replay time   // references pointed at stand-ins, then rep notifies
    when the replay reaches the recorded begin-play time:
        begin play, inside the sandbox scope            // with the values the actor had at that moment
```

Because a shell is a simulated proxy with no authority, code written correctly for a late-joining client is correct for a shell. Server logic guarded by `HasAuthority()` doesn't run, presentation driven by rep notifies does, and an actor that only looks right after the server has done something will look wrong in a replay the same way it would for someone joining mid-match. [Writing Replay-Friendly Gameplay Code](replay-friendly-gameplay-code.md) turns this into rules.

### Applying recorded state

The recorded values arrive the way replication would deliver them, with a few rules that keep a shell from touching the live match.

* **References point at stand-ins.** A recorded reference to another recorded object is pointed at that object's stand-in. When a stand-in comes up later, every object whose values refer to it is applied again, so references fill in as their targets appear.
* **References a client couldn't hold arrive empty.** That covers live replicated actors with no stand-in, any controller, and objects that never left the recording machine.
* **Rep notifies run after all the values are in place,** are given the old value, and only fire when a value actually changed. A fresh shell holds its class defaults, so a recorded value equal to the default notifies nothing, just as on a client.
* **Structs and fast arrays arrive like replication.** A struct takes only its replicated fields, or its whole value when it has its own network serializer. A fast array goes through its registered handler, so item callbacks fire.

A shell's subobjects and components are matched by their path inside the actor, and ones created at runtime are recreated under the stand-in of their original owner. They are brought up outermost first, so one made inside another, such as a fragment inside an item, always finds its outer's stand-in in place.

### When a shell begins play

An actor arriving from the network can exist for a while before it begins play, until its first values, such as a reference that has to resolve, have arrived. The recorder notes the moment each actor began play, and its shell begins play at the same point in the replay, with the values it had then. A shell for an actor already playing when the window opens begins play during preparation, and any effects it starts are simulated forward by how long the actor had been playing, so they don't restart. [Events and Cosmetics](events-and-cosmetics.md) covers that catch-up.

<details class="gb-toggle">

<summary>In code: bringing up shells</summary>

`UVisualReplayShellSet` owns every shell of a session. `SpawnShell` and `KeepOutOfLiveWorld` do the bring-up, `ApplyObjectAt` applies values, and `BeginPlayWhenDue` starts play at the recorded moment. The static `UVisualReplayShellSet::OnShellSpawned` fires for every shell once it is filled and about to begin play, for a game that needs to adjust shells of its own classes.

</details>

***

## How a Shell Follows Its Puppet

When an actor has both a puppet and a shell, the puppet draws the meshes and the shell provides everything else. The shell **follows** the puppet.

```
   puppet (draws)                         shell (runs the actor's logic)
   ┌─────────────────────────┐            ┌─────────────────────────────────────┐
   │ body mirror  ◄──────────┼── pose ────┤ body mesh, hidden, ticking          │
   │ weapon mirror ◄─────────┼─ transform ┤ weapon mesh, hidden                 │
   └─────────────────────────┘            │ effect at the muzzle socket, shown  │
                                          │ marker, sounds, rep notifies, shown │
                                          └─────────────────────────────────────┘
```

* Each of the shell's meshes follows the mirror drawn from the same component of the recorded actor, preferring the one whose recording covers the present. The meshes stay hidden, because the puppet already draws them, but each update they move to exactly where their mirror is, and skeletal ones take the mirror's pose. A shell mesh whose own code swaps in another mesh, or whose mirror's recording ends, finds its mirror again, so it follows whatever draws it now. Anything the shell attaches to a socket, such as a muzzle flash, therefore appears exactly where the puppet draws it.
* Each mirror takes the material values its shell's mesh has, over the recorded ones. A puppet draws what the recording machine drew, but a look some logic picks for whoever watches, such as team colours seen from one side, comes from the shell, which runs that logic for whoever the replay is watched as. A kill cam therefore colours the killer's team as friendly from its first frame. The meshes of what the shell spawns for itself and hangs from itself, such as a character's body parts, give their look to the mirrors of the same parts in the same way. A value the shell's logic never set stays as recorded.
* A shell's skeletal meshes keep ticking under the replayed pose, so montages they play advance by themselves and their notifies fire once, as on a client.
* The shell itself is shown so whatever it spawns or attaches appears, and is hidden whenever the recorded actor was hidden. Its own code may change its hidden flag during an update, but the recording has the last word, so an objective that was inactive and hidden stays hidden along with its effects and lights.

A shell whose actor has no puppet in the window follows nothing. If the actor's meshes stopped being recorded before the window, such as a pickup collected earlier, the shell stands where the recording last placed the actor. If they were never recorded, such as an actor whose meshes are all Static, it is placed where the live actor is, or at the world origin if that actor is gone, and starts hidden, so only its own code can show it. The debug suite flags that second case as `ShellWithoutPuppet`, because it is often a sign that an actor's look wasn't recorded.

***

## What a Shell Doesn't Do

A shell's state comes from the recording, so anything that would move it forward by itself is stopped after every update.

| A shell… | Because |
| --- | --- |
| Has no authority | It is a simulated proxy, like any actor a client receives. |
| Doesn't tick | Its actor and component ticks are turned off again after each update, since a tick would advance the actor on the live clock. Following skeletal meshes are the exception, for animation. |
| Never fires timers | A timer would run the shell's logic later, outside the sandbox scope and on its own clock, while the shell should only show what was recorded. Timers are cleared after every update. |
| **Does** finish latent actions | A Blueprint `Delay` is often how presentation waits, for example before adding a marker. The shell set runs stand-ins' latent actions itself, before the world would, inside the sandbox scope and at the replay's speed. |
| Doesn't collide, overlap or get sensed by AI | It must never affect the live match. |
| Isn't in the game state's player list | A player state shell would otherwise appear on scoreboards and in everything that walks the players. |
| Keeps its effects and sounds running | They are part of what the replay shows. |

A shell is retired one update after its actor ended, so events recorded at the moment an actor ended, such as a projectile's impact, still find it.

***

## The Sandbox Scope

While the session brings shells up, applies their state, plays events and runs their latent actions, it holds the **sandbox scope** open. Inside it:

* nothing is recorded, so the replay never records itself;
* actors spawned are made non-replicating before they finish spawning, which matters on a listen server, where the host's replay runs in the authoritative world;
* game systems can check whether they are being called for the replay, through `FVisualReplaySandboxScope::IsActive`.

Actors a shell spawns between updates, such as a projectile fired by an animation notify, run outside the scope. They still belong to the replay, through their owner, instigator or attachment. They aren't recorded, don't replicate, never collide, have their meshes hidden because the puppets already draw every recorded mesh, and are destroyed with their shell. Their effects and sounds still show. `VisualReplay::IsReplayActor` answers whether any actor belongs to a replay this way.

***

## Speed

Puppets, shells and everything they spawn run at the replay's speed through their time dilation, so animation, latent waits and effects slow down and speed up with the replay. Pausing sets the speed to zero, which freezes them. [Sessions](sessions.md) covers speed, pause and the replay's sound.
