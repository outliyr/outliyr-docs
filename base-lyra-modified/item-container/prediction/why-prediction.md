# Why Prediction

Before diving into how prediction works, let's understand _why_ it exists and what problem it solves.

### The Latency Reality

Every action in a multiplayer game travels across the network:

| Connection Type  | Round-Trip Time |
| ---------------- | --------------- |
| LAN              | 1-5ms           |
| Same region      | 20-50ms         |
| Cross-region     | 80-150ms        |
| Intercontinental | 150-300ms       |

When a player clicks to move an item, the naive approach is:

{% stepper %}
{% step %}
Client sends request to server
{% endstep %}

{% step %}
Server validates and executes
{% endstep %}

{% step %}
Server replicates new state to client
{% endstep %}

{% step %}
Client updates UI
{% endstep %}
{% endstepper %}

That's one full round-trip before the player sees any feedback. At 100ms RTT, there's a noticeable delay between clicking and seeing the item move. At 200ms+, the game feels broken.

***

### Pessimistic vs Optimistic UI

There are two philosophies for handling this latency:

#### Pessimistic UI

_"Don't show anything until the server confirms."_

```
Click → Wait → Server confirms → Show result
```

**Pros:**

* Never shows incorrect state
* Simple implementation

**Cons:**

* Feels laggy
* Every action has visible delay
* Players complain "the game is slow"

#### Optimistic UI

_"Show the expected result immediately, correct if wrong."_

```
Click → Show result immediately → Server confirms (or rollback)
```

**Pros:**

* Feels instant and responsive
* Players rarely notice network latency
* Matches single-player feel

**Cons:**

* Must handle rollback gracefully
* More complex implementation
* Rare visual corrections ("item snapped back")

The prediction system implements optimistic UI for item containers.

***

### When Prediction Matters

Not every interaction benefits equally from prediction:

#### High Value

**Inventory manipulation during gameplay**

* Moving items while in combat or under pressure
* Quick weapon swaps
* Using consumables

The player expects immediate feedback. 100ms delay feels like input lag.

#### Medium Value

**Deliberate actions in menus**

* Organizing inventory in a safe area
* Equipping gear between matches
* Attachment customization

Players are focused and patient, but responsiveness still improves feel.

#### Low Value

**One-shot transactions**

* Buying from a vendor (server controls stock)
* Receiving quest rewards
* Picking up loot

The player isn't repeatedly interacting. A brief delay is acceptable.

***

### The Prediction Philosophy

The system is built on several core principles:

#### Server Authority

The server is always right. Predictions are speculative, the client guesses what the server will do based on the same rules. If the guess is wrong, the server wins.

#### Rare Corrections

Good prediction means corrections are rare. If the client and server run the same validation logic, predictions should almost always be correct. Players should rarely see rollbacks.

#### Graceful Rollback

When corrections do happen, they should be smooth. An item "snapping back" is acceptable. UI glitches, crashes, or duplicate items are not.

#### Opt-In Complexity

Containers that don't need prediction shouldn't pay for it. The system is opt-in, simple containers work without prediction, complex ones add it when needed.

***

### What "Prediction" Means Here

{% stepper %}
{% step %}
#### Local application

The client applies the operation to its local view immediately.
{% endstep %}

{% step %}
#### Overlay tracking

The change is recorded as an "overlay" on top of server state.
{% endstep %}

{% step %}
#### Server validation

The server processes the same request independently.
{% endstep %}

{% step %}
#### Reconciliation

When the server responds, the overlay is cleared.
{% endstep %}
{% endstepper %}

The client doesn't literally "predict" what the server will do, it _does the same thing_ the server will do, just earlier. Because both use the same validation and execution logic, they should reach the same result.

***

### The Cost of Prediction

Prediction isn't free:

<table><thead><tr><th width="244.9090576171875">Cost</th><th>Description</th></tr></thead><tbody><tr><td>Memory</td><td>Overlays store predicted state alongside server state</td></tr><tr><td>Complexity</td><td>Two code paths (predicted vs authoritative)</td></tr><tr><td>Testing</td><td>Must verify rollback works correctly</td></tr><tr><td>Edge cases</td><td>Race conditions, multiple predictions in flight</td></tr></tbody></table>

The framework absorbs most of this complexity. Containers that opt into prediction get it through the prediction runtime without implementing the machinery themselves.

***

### When Not to Predict

Skip prediction when:

* **Server-only logic**: The client can't know what the server will do (e.g., random loot)
* **External dependencies**: The operation depends on state the client doesn't have
* **Rare interactions**: A slight delay is acceptable
* **Security-critical**: You don't trust the client to predict correctly

***
